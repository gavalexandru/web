const googleHandler = require('./google');
const onedriveHandler = require('./onedrive'); 
const dropboxHandler = require('./dropbox');
const { parse } = require('url');

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}


async function cloudRequestHandler(req, res, appUser) {
    const { pathname } = parse(req.url);

 
    if (pathname.startsWith('/api/google/')) {
        switch (pathname) {
            case '/api/google/login':
                return googleHandler.handleLogin(req, res, appUser);
            
            case '/api/google/logged':
                return googleHandler.checkLogged(req, res, appUser);
            
            case '/api/google/logout':
                return googleHandler.handleLogout(req, res, appUser);
        }
    }
	else if (pathname.startsWith('/api/onedrive/')) {
        switch (pathname) {
            case '/api/onedrive/login':
                return onedriveHandler.handleLogin(req, res, appUser);
            
            case '/api/onedrive/logged':
                return onedriveHandler.checkLogged(req, res, appUser);
            
            case '/api/onedrive/logout':
                return onedriveHandler.handleLogout(req, res, appUser);
        }
    }
	else if (pathname.startsWith('/api/dropbox/')) {
         switch (pathname) {
            case '/api/dropbox/login':
                return dropboxHandler.handleLogin(req, res, appUser);
            
            case '/api/dropbox/logged':
                return dropboxHandler.checkLogged(req, res, appUser);
            
            case '/api/dropbox/logout':
                return dropboxHandler.handleLogout(req, res, appUser);
        }
    }

    
  

    sendJSON(res, 404, { success: false, message: 'Cloud API endpoint not found.' });
}

module.exports = cloudRequestHandler;