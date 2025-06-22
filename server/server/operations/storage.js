const db = require('../database/db');
const google = require('../cloud/google');
const onedrive = require('../cloud/onedrive');
const dropbox = require('../cloud/dropbox');

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}


async function getFolderSize(provider, folderId, userId) {
    
    const sizeQuery = `
        WITH RECURSIVE folder_contents AS (
            -- Anchor Member: Select the starting folder itself to begin the traversal
            SELECT item_id, item_type
            FROM storage
            WHERE item_id = $1 AND user_id = $2 AND provider = $3

            UNION ALL

            -- Recursive Member: Join with storage again to find items in sub-folders
            SELECT s.item_id, s.item_type
            FROM storage s
            INNER JOIN folder_contents fc ON s.parent_provider_id = fc.item_id
        )
        -- Finally, sum the sizes of all items that are FILES in the entire tree.
        SELECT SUM(item_size) as total_size
        FROM storage
        WHERE item_type = 'file' AND item_id IN (SELECT item_id FROM folder_contents);
    `;

    try {
        const { rows } = await db.query(sizeQuery, [folderId, userId, provider]);
     
        return parseInt(rows[0].total_size, 10) || 0;
    } catch (error) {
        console.error(`Error calculating size for folder ${folderId}:`, error);
        return 0; 
    }
}


async function getCloudFiles(req, res, appUser) {
    try {
       
        const query = `
            SELECT 
                provider, item_id, parent_provider_id, item_type, item_name, item_size 
            FROM storage 
            WHERE user_id = $1 AND parent_provider_id IS NULL
            ORDER BY item_type DESC, item_name ASC; 
        `;
        const { rows: topLevelItems } = await db.query(query, [appUser.userId]);

        
        const itemsWithSizePromises = topLevelItems.map(async (item) => {
            if (item.item_type === 'folder') {
               
                const totalSize = await getFolderSize(item.provider, item.item_id, appUser.userId);
                return {
                    provider: item.provider,
                    file_id: item.item_id,
                    file_name: item.item_name,
                    file_size: totalSize, 
                    item_type: item.item_type,
                    parent_id: item.parent_provider_id
                };
            } else {
               
                return {
                    provider: item.provider,
                    file_id: item.item_id,
                    file_name: item.item_name,
                    file_size: item.item_size,
                    item_type: item.item_type,
                    parent_id: item.parent_provider_id
                };
            }
        });

       
        const itemsForFrontend = await Promise.all(itemsWithSizePromises);
        
        sendJSON(res, 200, itemsForFrontend);

    } catch (error) {
        console.error('Error fetching cloud files from database:', error);
        sendJSON(res, 500, { message: 'Failed to retrieve cloud files.' });
    }
}

async function getStorageDetails(req, res, appUser) {
    try {
        
        const countQuery = `
            SELECT provider, COUNT(*) as "fileCount"
            FROM storage
            WHERE user_id = $1
            GROUP BY provider;`
        ;
        const { rows: counts } = await db.query(countQuery, [appUser.userId]);

        const results = {
            google: { fileCount: 0 },
            onedrive: { fileCount: 0 },
            dropbox: { fileCount: 0 }
        };

        counts.forEach(row => {
            if (results[row.provider]) {
                results[row.provider].fileCount = parseInt(row.fileCount, 10);
            }
        });

      
        const [googleInfo, onedriveInfo, dropboxInfo] = await Promise.allSettled([
            google.getStorageInfo(appUser),
            onedrive.getStorageInfo(appUser),
            dropbox.getStorageInfo(appUser)
        ]);

     
        if (googleInfo.status === 'fulfilled') {
            results.google = { ...results.google, ...googleInfo.value };
        }
        if (onedriveInfo.status === 'fulfilled') {
            results.onedrive = { ...results.onedrive, ...onedriveInfo.value };
        }
        if (dropboxInfo.status === 'fulfilled') {
            results.dropbox = { ...results.dropbox, ...dropboxInfo.value };
        }

        sendJSON(res, 200, results);

    } catch (error) {
        console.error('Error fetching storage details:', error);
        sendJSON(res, 500, { success: false, message: 'Failed to retrieve storage details.' });
    }
}



module.exports = { getCloudFiles, getStorageDetails };