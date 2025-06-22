const db = require('../database/db');
const googleHandler = require('./../cloud/google');
const dropboxHandler = require('./../cloud/dropbox');
const onedriveHandler = require('./../cloud/onedrive');

const providerHandlers = {
    google: googleHandler,
    dropbox: dropboxHandler,
    onedrive: onedriveHandler
};

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}


async function handleDeleteRequest(req, res, appUser) {
    const urlParts = req.url.split('/');
    const provider = urlParts[3];
    const itemId = decodeURIComponent(urlParts[4]);

    if (!provider || !itemId) {
        return sendJSON(res, 400, { success: false, message: "Provider and item ID are required." });
    }

    try {
        const handler = providerHandlers[provider];
        if (!handler || !handler.handleDelete) {
            return sendJSON(res, 400, { success: false, message: `Provider ${provider} does not support delete.` });
        }

        
        await handler.handleDelete(appUser, itemId);
        console.log(`Successfully processed delete request for item ${itemId} on ${provider} cloud.`);

       
        const deleteQuery = `
            WITH RECURSIVE items_to_delete AS (
                SELECT item_id FROM storage WHERE item_id = $1 AND provider = $2 AND user_id = $3
                UNION ALL
                SELECT s.item_id FROM storage s
                INNER JOIN items_to_delete itd ON s.parent_provider_id = itd.item_id
                WHERE s.provider = $2 AND s.user_id = $3
            )
            DELETE FROM storage 
            WHERE item_id IN (SELECT item_id FROM items_to_delete) AND provider = $2 AND user_id = $3;
        `;
        
        const { rowCount } = await db.query(deleteQuery, [itemId, provider, appUser.userId]);
        console.log(`Successfully deleted ${rowCount} item(s) from local database.`);

        sendJSON(res, 200, { success: true, message: 'Item deleted successfully.' });

    } catch (error) {
        
        console.error(`Delete failed for item ${itemId} on provider ${provider}:`, error);
        sendJSON(res, 500, { success: false, message: error.message || 'An error occurred during deletion.' });
    }
}

module.exports = { handleDeleteRequest };