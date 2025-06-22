const { google } = require('googleapis');
const db = require('../database/db');
const { parse } = require('url');
const { Readable } = require('stream'); 
require('dotenv').config({ path: __dirname + '/../../../.env' });


const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);


function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}


function bufferToStream(buffer) {
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    return stream;
}



async function handleLogin(req, res, appUser) {
    try {
        
        const queryObject = parse(req.url, true).query;
        const { code } = queryObject;

        if (!code) {
            return sendJSON(res, 400, { success: false, message: 'Authorization code is missing from the request URL.' });
        }

        const { tokens } = await oauth2Client.getToken(code);
        const { access_token, refresh_token } = tokens;

        if (!access_token) {
             return sendJSON(res, 500, { success: false, message: 'Failed to retrieve access token from Google.' });
        }

        const query = `
            INSERT INTO cloud_tokens (user_id, provider, access_token, refresh_token)
            VALUES ($1, 'google', $2, $3)
            ON CONFLICT (user_id, provider)
            DO UPDATE SET access_token = EXCLUDED.access_token, 
                          refresh_token = COALESCE(EXCLUDED.refresh_token, cloud_tokens.refresh_token);
        `;
        await db.query(query, [appUser.userId, access_token, refresh_token]);

        sendJSON(res, 200, { success: true, message: 'Successfully connected to Google Drive.' });
    } 
	catch (error) {
        console.error('Error during Google OAuth login:', error);
        sendJSON(res, 500, { success: false, message: 'An internal server error occurred during Google authentication.' });
    }
}


async function checkLogged(req, res, appUser) {
    try {
        const tokenResult = await db.query(
            'SELECT access_token, refresh_token FROM cloud_tokens WHERE user_id = $1 AND provider = $2',
            [appUser.userId, 'google']
        );

        if (tokenResult.rows.length === 0) {
            return sendJSON(res, 200, { authorized: false });
        }

        const { access_token, refresh_token } = tokenResult.rows[0];
        
        if (!refresh_token) {
             await db.query('DELETE FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'google']);
             return sendJSON(res, 200, { authorized: false, message: 'Connection expired. Please log in to Google again.' });
        }

        oauth2Client.setCredentials({ access_token, refresh_token });
        
        let newAccessToken = null;
        oauth2Client.on('tokens', (tokens) => {
            if (tokens.access_token) {
                console.log('Google token was refreshed for user:', appUser.userId);
                newAccessToken = tokens.access_token;
            }
        });

        try {
            const drive = google.drive({ version: 'v3', auth: oauth2Client });
            await drive.about.get({ fields: 'user' });
        } catch (apiError) {
            console.error(`Failed to use/refresh Google token for user ${appUser.userId}:`, apiError.message);
            await db.query('DELETE FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'google']);
            return sendJSON(res, 200, { authorized: false, message: 'Failed to connect to Google. Please re-authenticate.' });
        }

        if (newAccessToken) {
            await db.query(
                'UPDATE cloud_tokens SET access_token = $1 WHERE user_id = $2 AND provider = $3',
                [newAccessToken, appUser.userId, 'google']
            );
        }

        sendJSON(res, 200, { authorized: true });
    } catch (error) {
        console.error('Error in Google checkLogged:', error);
        sendJSON(res, 500, { authorized: false, message: 'An internal server error occurred.' });
    }
}


async function handleLogout(req, res, appUser) {
    try {
        const tokenResult = await db.query(
            'SELECT access_token FROM cloud_tokens WHERE user_id = $1 AND provider = $2',
            [appUser.userId, 'google']
        );

        if (tokenResult.rows.length > 0) {
            const { access_token } = tokenResult.rows[0];
            try {
                await oauth2Client.revokeToken(access_token);
            } catch(revokeError) {
                console.warn(`Could not revoke Google token (it may have already been invalid):`, revokeError.message);
            }
            await db.query('DELETE FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'google']);
        }

        sendJSON(res, 200, { success: true, message: 'Successfully disconnected from Google Drive.' });
    } catch (error) {
        console.error('Error during Google logout:', error);
        sendJSON(res, 500, { success: false, message: 'An internal error occurred during logout.' });
    }
}


async function handleUpload(appUser, files) {
    const tokenResult = await db.query(
        'SELECT access_token, refresh_token FROM cloud_tokens WHERE user_id = $1 AND provider = $2',
        [appUser.userId, 'google']
    );

    if (tokenResult.rows.length === 0) {
        throw new Error('Not connected to Google Drive. Please log in first.');
    }
    const { access_token, refresh_token } = tokenResult.rows[0];

    if (!refresh_token) {
        await db.query('DELETE FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'google']);
        throw new Error('Google Drive connection expired. Please log in again.');
    }

    oauth2Client.setCredentials({ access_token, refresh_token });

    let newAccessToken = null;
    oauth2Client.on('tokens', (tokens) => {
        if (tokens.access_token) {
            console.log('Google token was refreshed during upload for user:', appUser.userId);
            newAccessToken = tokens.access_token;
        }
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const allCreatedItems = [];
    const folderCache = new Map(); 

    const getOrCreateFolder = async (path, parentId = 'root') => {
        if (folderCache.has(path)) {
            return folderCache.get(path);
        }

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

            const fileMetadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [currentParentId]
            };

            const response = await drive.files.create({
                resource: fileMetadata,
                fields: 'id, name'
            });

            const newFolderId = response.data.id;
            console.log(`Created folder '${folderName}' with ID: ${newFolderId}`);
            
            allCreatedItems.push({
                providerId: newFolderId,
                parentId: currentParentId === 'root' ? null : currentParentId,
                type: 'folder',
                name: response.data.name,
                size: 0
            });
            
            folderCache.set(builtPath, newFolderId);
            currentParentId = newFolderId;
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

        const fileMetadata = { name: fileName, parents: [parentId] };
        const media = { body: bufferToStream(file.buffer) };
        
        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name, size',
        });
        
        allCreatedItems.push({
            providerId: response.data.id,
            parentId: parentId === 'root' ? null : parentId,
            type: 'file',
            name: response.data.name,
            size: file.buffer.length
        });
    }

    if (newAccessToken) {
        await db.query('UPDATE cloud_tokens SET access_token = $1 WHERE user_id = $2 AND provider = $3', [newAccessToken, appUser.userId, 'google']);
    }

    return allCreatedItems;
}


async function getDownloadStream(appUser, fileId) {
    const tokenResult = await db.query(
        'SELECT access_token, refresh_token FROM cloud_tokens WHERE user_id = $1 AND provider = $2',
        [appUser.userId, 'google']
    );

    if (tokenResult.rows.length === 0) {
        throw new Error('User is not connected to Google Drive.');
    }
    
    oauth2Client.setCredentials(tokenResult.rows[0]);
     oauth2Client.on('tokens', (tokens) => {
        if (tokens.access_token) {
           db.query('UPDATE cloud_tokens SET access_token = $1 WHERE user_id = $2 AND provider = $3', [tokens.access_token, appUser.userId, 'google']);
        }
    });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const response = await drive.files.get(
        { fileId: fileId, alt: 'media' },
        { responseType: 'stream' }
    );
    
    return response.data; 
}


async function handleDownload(appUser, fileId, originalFileName, fileSize, res) {
    try {
        res.setHeader('Content-Disposition', `attachment; filename="${originalFileName}"`);
        if(fileSize) res.setHeader('Content-Length', fileSize);

        const downloadStream = await getDownloadStream(appUser, fileId);

        downloadStream
            .on('end', () => {
                console.log(`Successfully streamed ${originalFileName} from Google Drive.`);
            })
            .on('error', err => {
                console.error(`Error streaming file from Google Drive:`, err);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Failed to stream file from Google Drive.' }));
                }
            })
            .pipe(res);

    } catch (error) {
        console.error(`Google Drive download preparation failed for file ID ${fileId}:`, error);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: error.message || 'Could not download file from Google Drive.' }));
        }
    }
}

async function handleDelete(appUser, fileId) {
    const tokenResult = await db.query('SELECT access_token, refresh_token FROM cloud_tokens WHERE user_id = $1 AND provider = $2', [appUser.userId, 'google']);
    if (tokenResult.rows.length === 0) throw new Error('Not connected to Google Drive.');
    
    oauth2Client.setCredentials(tokenResult.rows[0]);
   
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    try {
        await drive.files.delete({ fileId: fileId });
    } catch (error) {
       
        throw new Error(error.errors ? error.errors[0].message : 'Failed to delete from Google Drive.');
    }
}

async function getStorageInfo(appUser) {
    const tokenResult = await db.query(
        'SELECT access_token, refresh_token FROM cloud_tokens WHERE user_id = $1 AND provider = $2',
        [appUser.userId, 'google']
    );
    if (tokenResult.rows.length === 0) {
        throw new Error('Not connected to Google');
    }

    oauth2Client.setCredentials(tokenResult.rows[0]);
    oauth2Client.on('tokens', (tokens) => {
        if (tokens.access_token) {
           db.query('UPDATE cloud_tokens SET access_token = $1 WHERE user_id = $2 AND provider = $3', [tokens.access_token, appUser.userId, 'google']);
        }
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const response = await drive.about.get({ fields: 'storageQuota' });

    const { limit, usage } = response.data.storageQuota;
    return {
        used: parseInt(usage, 10),
        total: parseInt(limit, 10)
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