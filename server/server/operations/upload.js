const fs = require('fs');
const path = require('path');
const url = require('url'); 
const db = require('../database/db');

const googleHandler = require('./../cloud/google');
const onedriveHandler = require('./../cloud/onedrive');  
const dropboxHandler = require('./../cloud/dropbox');

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}


const baseUploadDir = path.join(__dirname, 'files');
if (!fs.existsSync(baseUploadDir)) {
    fs.mkdirSync(baseUploadDir, { recursive: true });
}


function parseMultipart(bodyBuffer, boundary) {
    const files = [];
    const boundaryBuffer = Buffer.from(boundary);
    let lastBoundaryIndex = bodyBuffer.indexOf(boundaryBuffer, 0);

    while (lastBoundaryIndex !== -1) {
        const nextBoundaryIndex = bodyBuffer.indexOf(boundaryBuffer, lastBoundaryIndex + boundary.length);
        if (nextBoundaryIndex === -1) break;

        const partBuffer = bodyBuffer.subarray(lastBoundaryIndex + boundary.length, nextBoundaryIndex);
        
        const headerEndIndex = partBuffer.indexOf('\r\n\r\n');
        if (headerEndIndex !== -1) {
            const headers = partBuffer.subarray(2, headerEndIndex).toString();
            const filenameMatch = headers.match(/filename="(.+?)"/);

            if (filenameMatch && filenameMatch[1]) {
                const contentBuffer = partBuffer.subarray(headerEndIndex + 4);
               
                const fileBuffer = contentBuffer.subarray(0, contentBuffer.length - 2);
                files.push({ originalName: filenameMatch[1], buffer: fileBuffer });
            }
        }
        lastBoundaryIndex = nextBoundaryIndex;
    }
    return files;
}



async function handleUpload(req, res, appUser) {
    
    const { query } = url.parse(req.url, true);
    const provider = query.provider;

    if (!provider) {
        return sendJSON(res, 400, { success: false, message: 'Upload provider not specified. Please select a cloud service.' });
    }

    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.startsWith('multipart/form-data')) {
        return sendJSON(res, 400, { success: false, message: 'Content-Type must be multipart/form-data.' });
    }
    
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) {
        return sendJSON(res, 400, { success: false, message: 'Invalid multipart/form-data: boundary not found.' });
    }
    const boundary = '--' + boundaryMatch[1];

    const bodyChunks = [];
    req.on('data', chunk => bodyChunks.push(chunk));
    req.on('error', (err) => {
        console.error('Request error during file upload:', err);
        sendJSON(res, 500, { success: false, message: 'A request error occurred.' });
    });

    req.on('end', async () => {
        try {
            const bodyBuffer = Buffer.concat(bodyChunks);
            const parsedFiles = parseMultipart(bodyBuffer, boundary);

            if (parsedFiles.length === 0) {
                return sendJSON(res, 400, { success: false, message: 'No files found in the request payload.' });
            }

                  let uploadedItems = []; 
            
            
            switch (provider) {
                case 'google':
                     uploadedItems = await googleHandler.handleUpload(appUser, parsedFiles);     
                    break;
                case 'onedrive':
                    uploadedItems = await onedriveHandler.handleUpload(appUser, parsedFiles);
                    break;
                case 'dropbox':
                    uploadedItems = await dropboxHandler.handleUpload(appUser, parsedFiles); 
                    break;
                default:
                    return sendJSON(res, 400, { success: false, message: `Unsupported provider: ${provider}` });
            }
			
			if (uploadedItems && uploadedItems.length > 0) {
                
                const storageQuery = `
                    INSERT INTO storage (user_id, provider, item_id, parent_provider_id, item_type, item_name, item_size)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (provider, item_id) DO UPDATE SET
                        item_name = EXCLUDED.item_name,
                        item_size = EXCLUDED.item_size,
                        parent_provider_id = EXCLUDED.parent_provider_id;
                `;

                const dbPromises = uploadedItems.map(item => {
                    const params = [
                        appUser.userId,
                        provider,
                        item.providerId,
                        item.parentId,      
                        item.type,          
                        item.name,          
                        item.size           
                    ];
                    return db.query(storageQuery, params);
                });

                await Promise.all(dbPromises);
                console.log(`Stored metadata for ${uploadedItems.length} item(s) in the database.`);
            }
			
			
            console.log(`User ${appUser.userId} successfully uploaded ${uploadedItems.length} item(s) to ${provider}.`);
            
            sendJSON(res, 201, {
                success: true,
                message: `Items uploaded to ${provider} successfully!`,
                uploadedFiles: uploadedItems, 
            });

        } catch (error) {
            console.error(`Error processing file upload for provider "${provider}":`, error);
            sendJSON(res, 500, { success: false, message: error.message || 'An internal server error occurred during processing.' });
        }
    });
}

module.exports = { handleUpload };
