const https = require('https');
const querystring = require('querystring');
const { parse } = require('url');
const db = require('../database/db');
const fetch = require('node-fetch');

require('dotenv').config({ path: __dirname + '/../../../.env' });


const ONEDRIVE_CLIENT_ID = process.env.ONEDRIVE_CLIENT_ID;
const ONEDRIVE_CLIENT_SECRET = process.env.ONEDRIVE_CLIENT_SECRET;

const ONEDRIVE_REDIRECT_URI = process.env.ONEDRIVE_REDIRECT_URI; 
const TOKEN_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const SCOPES = 'Files.ReadWrite offline_access openid profile User.Read';



function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}


function makeTokenRequest(postData) {
    return new Promise((resolve, reject) => {
        const postBody = querystring.stringify(postData);
        const url = new URL(TOKEN_ENDPOINT);

        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postBody),
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsedData);
                    } else {
                        const error = new Error(parsedData.error_description || 'Failed to get token from Microsoft.');
                        error.statusCode = res.statusCode;
                        reject(error);
                    }
                } catch (e) {
                    reject(new Error('Failed to parse response from Microsoft.'));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(postBody);
        req.end();
    });
}


function validateTokenWithApi(accessToken) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'graph.microsoft.com',
            path: '/v1.0/me/drive', 
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` },
        };

        const req = https.request(options, (res) => {
            if (res.statusCode === 200) {
                resolve(true);
            } else {
                const error = new Error(`Graph API validation failed with status ${res.statusCode}`);
                error.statusCode = res.statusCode;
                reject(error);
            }
        });

        req.on('error', (e) => reject(e));
        req.end();
    });
}



async function handleLogin(req, res, appUser) {
    try {
        const { code } = parse(req.url, true).query;
        if (!code) {
            return sendJSON(res, 400, { success: false, message: 'Authorization code is missing from the request URL.' });
        }

        const tokenData = await makeTokenRequest({
            client_id: ONEDRIVE_CLIENT_ID,
            client_secret: ONEDRIVE_CLIENT_SECRET,
            scope: SCOPES,
            code: code,
            redirect_uri: ONEDRIVE_REDIRECT_URI,
            grant_type: 'authorization_code',
        });

        const { access_token, refresh_token } = tokenData;
        const query = `
            INSERT INTO cloud_tokens (user_id, provider, access_token, refresh_token)
            VALUES ($1, 'onedrive', $2, $3)
            ON CONFLICT (user_id, provider)
            DO UPDATE SET access_token = EXCLUDED.access_token, 
                          refresh_token = COALESCE(EXCLUDED.refresh_token, cloud_tokens.refresh_token);
        `;
        await db.query(query, [appUser.userId, access_token, refresh_token]);

        sendJSON(res, 200, { success: true, message: 'Successfully connected to OneDrive.' });
    } catch (error) {
        console.error('Error during OneDrive OAuth login:', error);
        sendJSON(res, 500, { success: false, message: 'An internal server error occurred during OneDrive authentication.' });
    }
}


async function checkLogged(req, res, appUser) {
    try {
        const tokenResult = await db.query(
            'SELECT access_token, refresh_token FROM cloud_tokens WHERE user_id = $1 AND provider = $2',
            [appUser.userId, 'onedrive']
        );

        if (tokenResult.rows.length === 0) {
            return sendJSON(res, 200, { authorized: false });
        }

        let { access_token, refresh_token } = tokenResult.rows[0];

        try {
            await validateTokenWithApi(access_token);
           
            return sendJSON(res, 200, { authorized: true });
        } catch (validationError) {
            if (validationError.statusCode !== 401) { 
                throw validationError;
            }

           
            if (!refresh_token) {
                await db.query('DELETE FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'onedrive']);
                return sendJSON(res, 200, { authorized: false, message: 'Connection expired. Please log in to OneDrive again.' });
            }

            console.log(`OneDrive token expired for user ${appUser.userId}. Refreshing...`);
            const refreshedTokens = await makeTokenRequest({
                client_id: ONEDRIVE_CLIENT_ID,
                client_secret: ONEDRIVE_CLIENT_SECRET,
                scope: SCOPES,
                refresh_token: refresh_token,
                grant_type: 'refresh_token',
            });
            
            await db.query(
                'UPDATE cloud_tokens SET access_token = $1, refresh_token = $2 WHERE user_id = $3 AND provider = $4',
                [refreshedTokens.access_token, refreshedTokens.refresh_token, appUser.userId, 'onedrive']
            );
            
            console.log(`Successfully refreshed OneDrive token for user ${appUser.userId}.`);
            return sendJSON(res, 200, { authorized: true });
        }
    } catch (error) {
        console.error('Error in OneDrive checkLogged:', error.message || error);
        
        await db.query('DELETE FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'onedrive']);
        sendJSON(res, 200, { authorized: false, message: 'Failed to connect to OneDrive. Please re-authenticate.' });
    }
}


async function handleLogout(req, res, appUser) {
    try {
        
        await db.query('DELETE FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'onedrive']);
        sendJSON(res, 200, { success: true, message: 'Successfully disconnected from OneDrive.' });
    } catch (error) {
        console.error('Error during OneDrive logout:', error);
        sendJSON(res, 500, { success: false, message: 'An internal error occurred during logout.' });
    }
}


function uploadFileToParent(accessToken, parentId, file) {
    
    const endpoint = `/v1.0/me/drive/items/${parentId}:/${encodeURIComponent(file.originalName)}:/content?@microsoft.graph.conflictBehavior=rename`;
    
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'graph.microsoft.com',
            path: endpoint,
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/octet-stream',
                'Content-Length': file.buffer.length,
            },
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200 || res.statusCode === 201) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`OneDrive upload failed with status ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.write(file.buffer);
        req.end();
    });
}


function createFolder(accessToken, parentId, folderName) {
    return new Promise((resolve, reject) => {
        const endpoint = `/v1.0/me/drive/items/${parentId}/children`;
        const folderData = {
            name: folderName,
            folder: {},
            "@microsoft.graph.conflictBehavior": "fail" 
        };
        const body = JSON.stringify(folderData);
        
        const req = https.request({
            hostname: 'graph.microsoft.com',
            path: endpoint,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 201) { 
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`OneDrive folder creation failed with status ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}


async function handleUpload(appUser, files) {
   
    const tokenResult = await db.query('SELECT access_token, refresh_token FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'onedrive']);
    if (tokenResult.rows.length === 0) throw new Error('Not connected to OneDrive.');
    
    let { access_token, refresh_token } = tokenResult.rows[0];

  
    try {
        await validateTokenWithApi(access_token);
    } catch (validationError) {
        if (validationError.statusCode !== 401 || !refresh_token) {
            await db.query('DELETE FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'onedrive']);
            throw new Error('OneDrive connection is invalid. Please log in again.');
        }
        console.log(`Refreshing expired OneDrive token for user ${appUser.userId} during upload.`);
        const refreshedTokens = await makeTokenRequest({ client_id: ONEDRIVE_CLIENT_ID, client_secret: ONEDRIVE_CLIENT_SECRET, scope: SCOPES, refresh_token, grant_type: 'refresh_token' });
        await db.query('UPDATE cloud_tokens SET access_token = $1, refresh_token = $2 WHERE user_id = $3 AND provider = $4', [refreshedTokens.access_token, refreshedTokens.refresh_token, appUser.userId, 'onedrive']);
        access_token = refreshedTokens.access_token;
    }

    const allCreatedItems = [];
    const folderCache = new Map(); 

    const getOrCreateFolder = async (path, parentId = 'root') => {
        if (folderCache.has(path)) return folderCache.get(path);
        
        const pathParts = path.split('/');
        let currentParentId = parentId;
        let builtPath = '';

        for (const folderName of pathParts) {
            if (!folderName) continue;
            builtPath += (builtPath ? '/' : '') + folderName;
            
            if (folderCache.has(builtPath)) {
                currentParentId = folderCache.get(builtPath);
                continue;
            }
            
            const newFolder = await createFolder(access_token, currentParentId, folderName);
            allCreatedItems.push({ 
                providerId: newFolder.id, 
                parentId: currentParentId === 'root' ? null : currentParentId, 
                type: 'folder', 
                name: newFolder.name, 
                size: 0 
            });
            folderCache.set(builtPath, newFolder.id);
            currentParentId = newFolder.id;
        }
        return currentParentId;
    };

   
    for (const file of files) {
        const relativePath = file.originalName.replace(/\\/g, '/');
        const pathParts = relativePath.split('/');
        const fileName = pathParts.pop();
        const folderPath = pathParts.join('/');

        let parentId = 'root';
        if (folderPath) {
            parentId = await getOrCreateFolder(folderPath, 'root');
        }

        const uploadedFile = await uploadFileToParent(access_token, parentId, { originalName: fileName, buffer: file.buffer });
        allCreatedItems.push({
            providerId: uploadedFile.id,
            parentId: parentId === 'root' ? null : parentId,
            type: 'file',
            name: uploadedFile.name,
            size: uploadedFile.size 
        });
    }

    return allCreatedItems;
}



async function getDownloadStream(appUser, fileId) {
    const tokenResult = await db.query('SELECT access_token, refresh_token FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'onedrive']);
    if (tokenResult.rows.length === 0) throw new Error('Not connected to OneDrive.');

    let { access_token, refresh_token } = tokenResult.rows[0];

    try {
        await validateTokenWithApi(access_token);
    } catch (validationError) {
        if (validationError.statusCode !== 401 || !refresh_token) {
            await db.query('DELETE FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'onedrive']);
            throw new Error('OneDrive connection is invalid.');
        }
        const refreshedTokens = await makeTokenRequest({ client_id: ONEDRIVE_CLIENT_ID, client_secret: ONEDRIVE_CLIENT_SECRET, scope: SCOPES, refresh_token, grant_type: 'refresh_token' });
        await db.query('UPDATE cloud_tokens SET access_token = $1, refresh_token = $2 WHERE user_id = $3 AND provider = $4', [refreshedTokens.access_token, refreshedTokens.refresh_token, appUser.userId, 'onedrive']);
        access_token = refreshedTokens.access_token;
    }
    
    const downloadUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`;
    const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${access_token}` },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OneDrive download failed with status ${response.status}: ${errorText}`);
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
        console.error(`OneDrive download failed for file ID ${fileId}:`, error);
        if (error.message.includes('invalid')) {
            await db.query('DELETE FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'onedrive']);
        }
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: error.message || 'Could not download file from OneDrive.' }));
        }
    }
}

async function handleDelete(appUser, itemId) {
    const tokenResult = await db.query('SELECT access_token, refresh_token FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'onedrive']);
    if (tokenResult.rows.length === 0) throw new Error('Not connected to OneDrive.');

    let { access_token, refresh_token } = tokenResult.rows[0];

    
    try {
        await validateTokenWithApi(access_token);
    } catch (validationError) {
        if (validationError.statusCode !== 401 || !refresh_token) {
            throw new Error('OneDrive connection is invalid.');
        }
        const refreshedTokens = await makeTokenRequest({ client_id: ONEDRIVE_CLIENT_ID, client_secret: ONEDRIVE_CLIENT_SECRET, scope: SCOPES, refresh_token, grant_type: 'refresh_token' });
        await db.query('UPDATE cloud_tokens SET access_token = $1, refresh_token = $2 WHERE user_id = $3 AND provider = $4', [refreshedTokens.access_token, refreshedTokens.refresh_token, appUser.userId, 'onedrive']);
        access_token = refreshedTokens.access_token;
    }

    const deleteUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
    const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${access_token}` },
    });

    
    if (!response.ok && response.status !== 204) {
        const errorText = await response.text();
        throw new Error(`OneDrive delete failed with status ${response.status}: ${errorText}`);
    }
}

async function getStorageInfo(appUser) {
    const tokenResult = await db.query(
        'SELECT access_token, refresh_token FROM cloud_tokens WHERE user_id = $1 AND provider = $2',
        [appUser.userId, 'onedrive']
    );

    if (tokenResult.rows.length === 0) {
        return null; 
    }
    let { access_token, refresh_token } = tokenResult.rows[0];

    try {
        await validateTokenWithApi(access_token);
    } catch (error) {
        if (error.statusCode !== 401 || !refresh_token) {
            console.error("OneDrive token is invalid and cannot be refreshed.", error);
            return null;
        }
        const refreshed = await makeTokenRequest({
            client_id: ONEDRIVE_CLIENT_ID, client_secret: ONEDRIVE_CLIENT_SECRET,
            scope: SCOPES, refresh_token: refresh_token, grant_type: 'refresh_token'
        });
        await db.query( 'UPDATE cloud_tokens SET access_token=$1, refresh_token=$2 WHERE user_id=$3 AND provider=$4', [refreshed.access_token, refreshed.refresh_token, appUser.userId, 'onedrive']);
        access_token = refreshed.access_token;
    }

    

    try {
        
        const driveInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });
        if (!driveInfoResponse.ok) {
            throw new Error('Failed to get OneDrive total space.');
        }
        const driveData = await driveInfoResponse.json();
        const totalSpace = driveData.quota?.total || 0;

        
        let calculatedUsedSpace = 0;
        let nextLink = `https://graph.microsoft.com/v1.0/me/drive/root/children?$select=size`;

       
        while (nextLink) {
            const childrenResponse = await fetch(nextLink, {
                headers: { 'Authorization': `Bearer ${access_token}` }
            });

            if (!childrenResponse.ok) {
                throw new Error('Failed to list OneDrive files to calculate size.');
            }
            const page = await childrenResponse.json();
            
            for (const item of page.value) {
                
                calculatedUsedSpace += item.size || 0;
            }

            
            nextLink = page['@odata.nextLink'];
        }

        
        return {
            used: calculatedUsedSpace,
            total: totalSpace
        };

    } catch (error) {
        console.error("Error calculating OneDrive storage info manually:", error);
        return null;
    }
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