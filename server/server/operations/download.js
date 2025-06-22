const archiver = require('archiver');
const db = require('../database/db');


const googleHandler = require('./../cloud/google');
const dropboxHandler = require('./../cloud/dropbox');
const onedriveHandler = require('./../cloud/onedrive');

const providerHandlers = {
    google: googleHandler,
    dropbox: dropboxHandler,
    onedrive: onedriveHandler
};


async function getFilesInFolder(provider, rootFolderId, userId) {
    const query = `
        WITH RECURSIVE folder_tree AS (
            -- Anchor member: Select the root folder itself
            SELECT 
                item_id, 
                item_type, 
                item_name, 
                '' AS relative_path
            FROM storage
            WHERE provider = $1 AND item_id = $2 AND user_id = $3
            
            UNION ALL
            
            -- Recursive member: Select children of items already in the tree
            SELECT 
                s.item_id, 
                s.item_type, 
                s.item_name,
                -- Append the child's name to the parent's relative path
                CASE 
                    WHEN ft.relative_path = '' THEN s.item_name
                    ELSE ft.relative_path || '/' || s.item_name
                END
            FROM storage s
            JOIN folder_tree ft ON s.parent_provider_id = ft.item_id
            WHERE s.provider = $1 AND s.user_id = $3
        )
        -- Select only the files from the final tree
        SELECT item_id, relative_path FROM folder_tree WHERE item_type = 'file';
    `;
    const result = await db.query(query, [provider, rootFolderId, userId]);
    return result.rows;
}


async function handleDownloadRequest(req, res, appUser) {
    
    const urlParts = req.url.split('/');
    const provider = urlParts[3];
    const itemId = decodeURIComponent(urlParts[4]);

    if (!provider || !itemId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ message: "Provider and item ID are required." }));
    }

    try {
        const itemResult = await db.query(
            'SELECT * FROM storage WHERE provider = $1 AND item_id = $2 AND user_id = $3',
            [provider, itemId, appUser.userId]
        );

        if (itemResult.rows.length === 0) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ message: "Item not found or you don't have permission." }));
        }

        const rootItem = itemResult.rows[0];
        const handler = providerHandlers[provider];

        if (!handler) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ message: `Unsupported provider: ${provider}` }));
        }

       
        if (rootItem.item_type === 'file') {
            console.log(`Initiating single file download for ${rootItem.item_name}`);
            return handler.handleDownload(appUser, rootItem.item_id, rootItem.item_name, rootItem.item_size, res);
        }

       
        if (rootItem.item_type === 'folder') {
            console.log(`Initiating folder download for ${rootItem.item_name}. Zipping...`);
            
            const filesToZip = await getFilesInFolder(provider, rootItem.item_id, appUser.userId);

            if (filesToZip.length === 0) {
                res.writeHead(404, {'Content-Type': 'application/json'});
                return res.end(JSON.stringify({ message: "The folder is empty or contains no files."}));
            }
            
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${rootItem.item_name}.zip"`);
            
            const archive = archiver('zip', { zlib: { level: 9 } });
            archive.pipe(res);
            
            archive.on('warning', (err) => { if (err.code === 'ENOENT') { console.warn(err); } else { throw err; }});
            archive.on('error', (err) => { throw err; });
            res.on('close', () => console.log(`Archive stream closed. Total bytes: ${archive.pointer()}`));

            for (const file of filesToZip) {
                const fileStream = await handler.getDownloadStream(appUser, file.item_id);
                archive.append(fileStream, { name: file.relative_path });
            }
            
            await archive.finalize();
        }

    } catch (error) {
        console.error("Download failed:", error);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: "An error occurred during download.", error: error.message }));
        }
    }
}

module.exports = { handleDownloadRequest };