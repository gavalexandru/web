const db = require('../database/db');
const { parse } = require('url');
const fetch = require('node-fetch');

require('dotenv').config({ path: __dirname + '/../../../.env' });

const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY;
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET;
const DROPBOX_REDIRECT_URI = process.env.DROPBOX_REDIRECT_URI;

const DOWNLOAD_URL = 'https://content.dropboxapi.com/2/files/download';



const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const REVOKE_URL = 'https://api.dropboxapi.com/2/auth/token/revoke';
const CHECK_USER_URL = 'https://api.dropboxapi.com/2/users/get_current_account';

const UPLOAD_URL = 'https://content.dropboxapi.com/2/files/upload';
const SPACE_USAGE_URL = 'https://api.dropboxapi.com/2/users/get_space_usage';


function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}


async function handleLogin(req, res, appUser) {
    try {
        const queryObject = parse(req.url, true).query;
        const { code } = queryObject;

        if (!code) {
            return sendJSON(res, 400, { success: false, message: 'Authorization code is missing from the request URL.' });
        }

        const params = new URLSearchParams();
        params.append('code', code);
        params.append('grant_type', 'authorization_code');
        params.append('redirect_uri', DROPBOX_REDIRECT_URI);

        const response = await fetch(TOKEN_URL, {
            method: 'POST',
            body: params,
            headers: {
                'Authorization': 'Basic ' + Buffer.from(DROPBOX_APP_KEY + ':' + DROPBOX_APP_SECRET).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        const tokens = await response.json();

        if (!response.ok) {
            console.error('Dropbox token exchange error:', tokens);
            return sendJSON(res, response.status, { success: false, message: tokens.error_description || 'Failed to retrieve tokens from Dropbox.' });
        }
        
        const { access_token, refresh_token } = tokens;

        const query = `
            INSERT INTO cloud_tokens (user_id, provider, access_token, refresh_token)
            VALUES ($1, 'dropbox', $2, $3)
            ON CONFLICT (user_id, provider)
            DO UPDATE SET access_token = EXCLUDED.access_token, 
                          refresh_token = EXCLUDED.refresh_token;
        `;
        await db.query(query, [appUser.userId, access_token, refresh_token]);

        sendJSON(res, 200, { success: true, message: 'Successfully connected to Dropbox.' });

    } catch (error) {
        console.error('Error during Dropbox OAuth login:', error);
        sendJSON(res, 500, { success: false, message: 'An internal server error occurred during Dropbox authentication.' });
    }
}


async function refreshAccessToken(refreshToken, userId) {
    console.log(`Dropbox access token expired for user ${userId}. Refreshing...`);
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);

    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        body: params,
        headers: {
            'Authorization': 'Basic ' + Buffer.from(DROPBOX_APP_KEY + ':' + DROPBOX_APP_SECRET).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    const data = await response.json();

    if (!response.ok) {
        console.error(`Failed to refresh Dropbox token for user ${userId}:`, data.error_description || data);
        throw new Error('Could not refresh Dropbox token.');
    }

    const { access_token } = data;
    await db.query(
        'UPDATE cloud_tokens SET access_token = $1 WHERE user_id = $2 AND provider = $3',
        [access_token, userId, 'dropbox']
    );
    console.log(`Dropbox token refreshed successfully for user ${userId}.`);
    return access_token;
}


async function checkLogged(req, res, appUser) {
    try {
        const tokenResult = await db.query(
            'SELECT access_token, refresh_token FROM cloud_tokens WHERE user_id = $1 AND provider = $2',
            [appUser.userId, 'dropbox']
        );

        if (tokenResult.rows.length === 0) {
            return sendJSON(res, 200, { authorized: false });
        }

        let { access_token, refresh_token } = tokenResult.rows[0];

        const checkResponse = await fetch(CHECK_USER_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${access_token}` }
        });

        if (checkResponse.ok) {
            return sendJSON(res, 200, { authorized: true });
        }
        
        const errorData = await checkResponse.json();
        if (checkResponse.status === 401 && errorData.error_summary?.startsWith('expired_access_token')) {
             if (!refresh_token) {
                await db.query('DELETE FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'dropbox']);
                return sendJSON(res, 200, { authorized: false, message: 'Dropbox connection expired. Please log in again.' });
            }
            try {
                await refreshAccessToken(refresh_token, appUser.userId);
                return sendJSON(res, 200, { authorized: true });
            } catch (refreshError) {
                await db.query('DELETE FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'dropbox']);
                return sendJSON(res, 200, { authorized: false, message: 'Failed to refresh Dropbox connection. Please re-authenticate.' });
            }
        } else {
            console.error(`Dropbox API error for user ${appUser.userId}:`, errorData);
            await db.query('DELETE FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'dropbox']);
            return sendJSON(res, 200, { authorized: false, message: 'Failed to connect to Dropbox. Please re-authenticate.' });
        }

    } catch (error) {
        console.error('Error in Dropbox checkLogged:', error);
        sendJSON(res, 500, { authorized: false, message: 'An internal server error occurred.' });
    }
}


async function handleLogout(req, res, appUser) {
    try {
        const tokenResult = await db.query(
            'SELECT access_token FROM cloud_tokens WHERE user_id = $1 AND provider = $2',
            [appUser.userId, 'dropbox']
        );

        if (tokenResult.rows.length > 0) {
            const { access_token } = tokenResult.rows[0];
            try {
                await fetch(REVOKE_URL, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${access_token}` }
                });
            } catch(revokeError) {
                console.warn(`Could not revoke Dropbox token (it may have already been invalid):`, revokeError.message);
            }
            await db.query('DELETE FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'dropbox']);
        }

        sendJSON(res, 200, { success: true, message: 'Successfully disconnected from Dropbox.' });
    } catch (error) {
        console.error('Error during Dropbox logout:', error);
        sendJSON(res, 500, { success: false, message: 'An internal error occurred during logout.' });
    }
}

async function createFolder(accessToken, path) {
    const FOLDER_CREATE_URL = 'https://api.dropboxapi.com/2/files/create_folder_v2';
    try {
        const response = await fetch(FOLDER_CREATE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ path: path, autorename: false })
        });
        
       
        if (response.status === 409) {
            const errorData = await response.json();
            if (errorData.error_summary.startsWith('path/conflict/folder')) {
                console.log(`Folder '${path}' already exists, skipping creation.`);
                
                const METADATA_URL = 'https://api.dropboxapi.com/2/files/get_metadata';
                const metaRes = await fetch(METADATA_URL, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: path, include_media_info: false })
                });
                if (!metaRes.ok) throw new Error(`Could not get metadata for existing folder ${path}`);
                return await metaRes.json();
            }
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Dropbox folder creation failed for ${path}: ${errorData.error_summary}`);
        }
        
        const data = await response.json();
        return data.metadata;

    } catch (e) {
        
        throw e;
    }
}


async function handleUpload(appUser, files) {
    
    const tokenResult = await db.query('SELECT access_token, refresh_token FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'dropbox']);
    if (tokenResult.rows.length === 0) throw new Error('Not connected to Dropbox.');
    
    let { access_token, refresh_token } = tokenResult.rows[0];
    if (!refresh_token) {
        await db.query('DELETE FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'dropbox']);
        throw new Error('Dropbox connection expired. Please log in again.');
    }

 
    const disallowedNames = ['.ds_store', 'thumbs.db', '.dropbox'];
    const filteredFiles = files.filter(file => {
        const fileName = file.originalName.split('/').pop().toLowerCase();
        return !disallowedNames.includes(fileName);
    });

    const allCreatedItems = [];
    
    const folderCache = new Map();

    
    for (const file of filteredFiles) {
        const fullPath = `/${file.originalName.replace(/\\/g, '/')}`;
        const pathParts = fullPath.split('/');
        pathParts.pop(); 

        let currentPath = '';
        for (const part of pathParts) {
            if (!part) continue;
            currentPath += `/${part}`;
            if (!folderCache.has(currentPath)) {
                try {
                    const folderMeta = await createFolder(access_token, currentPath);
                    folderCache.set(currentPath, folderMeta); 
                } catch (error) {
                    if (error.message.includes('expired_access_token')) {
                        access_token = await refreshAccessToken(refresh_token, appUser.userId);
                        const folderMeta = await createFolder(access_token, currentPath);
                        folderCache.set(currentPath, folderMeta);
                    } else {
                        throw error;
                    }
                }
            }
        }
    }
    
   
    for (const [path, meta] of folderCache.entries()) {
        const parentPath = path.substring(0, path.lastIndexOf('/'));
        const parentId = parentPath ? folderCache.get(parentPath)?.id : null;
        allCreatedItems.push({
            providerId: meta.id,
            parentId: parentId,
            type: 'folder',
            name: meta.name,
            size: 0 
        });
    }

   
    for (const file of filteredFiles) {
        const fullPath = `/${file.originalName.replace(/\\/g, '/')}`;
        const parentPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
        const parentId = parentPath ? folderCache.get(parentPath)?.id : null;
        
        const apiArgs = { path: fullPath, mode: 'add', autorename: true, mute: false };
        let response = await fetch(UPLOAD_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${access_token}`, 'Dropbox-API-Arg': JSON.stringify(apiArgs), 'Content-Type': 'application/octet-stream' },
            body: file.buffer
        });
        
        if (response.status === 401) {
            const errorData = await response.json();
            if (errorData.error_summary?.startsWith('expired_access_token')) {
                access_token = await refreshAccessToken(refresh_token, appUser.userId);
                response = await fetch(UPLOAD_URL, {
                    method: 'POST', headers: { 'Authorization': `Bearer ${access_token}`, 'Dropbox-API-Arg': JSON.stringify(apiArgs), 'Content-Type': 'application/octet-stream' }, body: file.buffer
                });
            }
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Dropbox API error for ${file.originalName}: ${errorData.error_summary || 'Unknown upload error'}`);
        }

        const data = await response.json();
        allCreatedItems.push({
            providerId: data.id,
            parentId: parentId,
            type: 'file',
            name: data.name,
            size: data.size 
        });
    }

    return allCreatedItems;
}


async function getDownloadStream(appUser, fileId) {
    const tokenResult = await db.query('SELECT access_token, refresh_token FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'dropbox']);
    if (tokenResult.rows.length === 0) throw new Error('Not connected to Dropbox.');
    
    let { access_token, refresh_token } = tokenResult.rows[0];

    const apiArgs = { path: fileId }; 
    let response = await fetch(DOWNLOAD_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${access_token}`, 'Dropbox-API-Arg': JSON.stringify(apiArgs) },
    });

    if (response.status === 401) {
        const errorData = await response.json(); 
        if (errorData.error_summary?.startsWith('expired_access_token')) {
            console.log(`Dropbox token expired during download, refreshing for user ${appUser.userId}`);
            access_token = await refreshAccessToken(refresh_token, appUser.userId);
            
            response = await fetch(DOWNLOAD_URL, { method: 'POST', headers: { 'Authorization': `Bearer ${access_token}`, 'Dropbox-API-Arg': JSON.stringify(apiArgs) } });
        }
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Dropbox API Error on download: ${errorText}`);
    }

    return response.body; 
}



async function handleDownload(appUser, fileId, originalFileName, fileSize, res) {
    try {
        res.setHeader('Content-Disposition', `attachment; filename="${originalFileName}"`);
        res.setHeader('Content-Length', fileSize);

        const downloadStream = await getDownloadStream(appUser, fileId);
        downloadStream.pipe(res);

    } catch (error) {
        console.error(`Dropbox download failed for file ID ${fileId}:`, error);
        if (error.message.includes('expired') || error.message.includes('Could not refresh')) {
            await db.query('DELETE FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'dropbox']);
        }
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: error.message || 'Could not download file from Dropbox.' }));
        }
    }
}

async function handleDelete(appUser, itemId) {
    const tokenResult = await db.query('SELECT access_token, refresh_token FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'dropbox']);
    if (tokenResult.rows.length === 0) throw new Error('Not connected to Dropbox.');

    let { access_token, refresh_token } = tokenResult.rows[0];
    
    const DELETE_URL = 'https://api.dropboxapi.com/2/files/delete_v2';
    
    
    const body = JSON.stringify({ path: itemId });

    const tryDelete = async (token) => {
        return await fetch(DELETE_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: body
        });
    };

    let response = await tryDelete(access_token);
    
    if (response.status === 401) {
        const errorData = await response.json();
        if (errorData.error_summary?.startsWith('expired_access_token')) {
            access_token = await refreshAccessToken(refresh_token, appUser.userId);
            response = await tryDelete(access_token); 
        }
    }

    if (response.ok) {
        console.log(`Successfully deleted item ${itemId} from Dropbox.`);
        return; 
    }

   
    const errorData = await response.json();
    const errorSummary = errorData.error_summary || '';

    
    if (errorSummary.startsWith('path_lookup/not_found/')) {
        console.warn(`Item ${itemId} was already deleted from Dropbox.`);
        return; 
    }

    
    throw new Error(`Dropbox delete failed: ${errorSummary}`);
}

async function getStorageInfo(appUser) {
    const tokenResult = await db.query(
        'SELECT access_token, refresh_token FROM cloud_tokens WHERE user_id = $1 AND provider = $2',
        [appUser.userId, 'dropbox']
    );
    if (tokenResult.rows.length === 0) {
        throw new Error('Not connected to Dropbox');
    }
    let { access_token, refresh_token } = tokenResult.rows[0];

    const makeRequest = async (token) => {
        const response = await fetch(SPACE_USAGE_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) return response.json();
        if (response.status === 401) {
            if (!refresh_token) throw new Error('Dropbox connection expired');
            const newAccessToken = await refreshAccessToken(refresh_token, appUser.userId);
            return makeRequest(newAccessToken);
        }
        throw new Error('Failed to get Dropbox space usage.');
    };

    const data = await makeRequest(access_token);
    return {
        used: data.used,
        total: data.allocation.allocated
    };
}




module.exports = { 
    handleLogin, 
    checkLogged, 
    handleLogout, 
    handleUpload, 
    handleDownload,
    getDownloadStream,
    handleDelete, 
	getStorageInfo
};