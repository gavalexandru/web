const user = require('../user/user');
const cloudRequestHandler = require('../cloud/cloud');
const uploadHandler = require('../operations/upload');
const { getCloudFiles, getStorageDetails } = require('./../operations/storage'); 
const downloadHandler = require('./../operations/download');
const deleteHandler = require('./../operations/delete'); 
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseCookies(request) {
    const list = {};
    const cookieHeader = request.headers?.cookie;
    if (!cookieHeader) return list;

    cookieHeader.split(`;`).forEach(function(cookie) {
        let [ name, ...rest] = cookie.split(`=`);
        name = name?.trim();
        if (!name) return;
        const value = rest.join(`=`).trim();
        if (!value) return;
        list[name] = decodeURIComponent(value);
    });

    return list;
}

async function requestHandler(req, res) {
  const { method, url } = req;
  const cookies = parseCookies(req);
          
  if (url === '/api/register' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
        try {
            const { email, password } = JSON.parse(body);

            if (!email || !password) {
                return sendJSON(res, 400, { success: false, message: 'Email and password are required.' });
            }

            const newUser = await user.register(email, password);
            sendJSON(res, 201, { success: true, message: 'User registered successfully!', user: newUser });

        } 
		catch (error) {
            if (error.statusCode === 409) {
                sendJSON(res, 409, { success: false, message: error.message });
            } 
			else if (error instanceof SyntaxError) {
                sendJSON(res, 400, { success: false, message: 'Invalid JSON payload.' });
            } 
			else {
                sendJSON(res, 500, { success: false, message: 'An internal server error occurred.' });
            }
        }
    });
  }            
  else if (url === '/api/login' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
        try {
            const { email, password } = JSON.parse(body);
            if (!email || !password) {
                return sendJSON(res, 400, { success: false, message: 'Email and password are required.' });
            }

            const token = await user.login(email, password);

            res.setHeader('Set-Cookie', `access_token=${token}; HttpOnly; Max-Age=3600; Path=/`);
            sendJSON(res, 200, { success: true, message: 'Login successful.' });

        } 
		catch (error) {
            const statusCode = error.statusCode || 500;
            const message = error.statusCode === 401 ? 'Invalid credentials.' : 'An internal server error occurred.';
            sendJSON(res, statusCode, { success: false, message });
        }
    });
   }             
    else if (url === '/api/logged' && method === 'POST') {
      try {
          const token = cookies.access_token;
          const userData = await user.checkAuth(token); 
          
          sendJSON(res, 200, { authorized: true, user: userData });

      } 
	  catch (error) {
          
          sendJSON(res, 401, { authorized: false, message: 'You are not logged in.' });
      }

  } 
  else if (url === '/api/logout' && method === 'POST') {
      try {
          const token = cookies.access_token;
          
          await user.logout(token);
          
         
          res.setHeader('Set-Cookie', `access_token=; HttpOnly; Max-Age=0; Path=/`);

         
          sendJSON(res, 200, { success: true, message: 'Logged out successfully.' });

      } 
	  catch (error) {
          
          console.error("Error during logout:", error);
          sendJSON(res, 500, { success: false, message: 'An internal error occurred during logout.' });
      }
  } 
  else if (url.startsWith('/api/google/') || url.startsWith('/api/onedrive') || url.startsWith('/api/dropbox')) {
    try {
        
        const token = cookies.access_token;
        const appUser = await user.checkAuth(token); 
        
        
        return cloudRequestHandler(req, res, appUser);

    } 
	catch (error) {
        
        sendJSON(res, 401, { authorized: false, message: 'You must be logged in to manage cloud accounts.' });
    }
  }
    else if (url.startsWith('/api/upload')  && method === 'POST') {
    try {
        const token = cookies.access_token;
       
        const appUser = await user.checkAuth(token); 
        
        
        return uploadHandler.handleUpload(req, res, appUser);

    } 
	catch (error) {
        
        sendJSON(res, 401, { authorized: false, message: 'You must be logged in to upload files.' });
    }
  }
  else if (url.startsWith('/api/cloud-files') && req.method === 'GET') {
        try {
        const token = cookies.access_token;
        
        const appUser = await user.checkAuth(token); 
        
        
        return getCloudFiles(req, res, appUser);

    } 
	catch (error) {
        
        sendJSON(res, 401, { authorized: false, message: 'You must be logged in to see your files.' });
     }
    }
	else if(url.startsWith('/api/download') && req.method === 'GET'){
		try {
        const token = cookies.access_token;
        
        const appUser = await user.checkAuth(token); 
        
       
        return downloadHandler.handleDownloadRequest(req, res, appUser);

		}
	catch (error) {
      
        sendJSON(res, 401, { authorized: false, message: 'You must be logged in to download your files.' });
     }
	}
	else if (url.startsWith('/api/delete/') && req.method === 'DELETE') {
        try {
            const token = cookies.access_token;
            const appUser = await user.checkAuth(token);
            return deleteHandler.handleDeleteRequest(req, res, appUser);
        } 
		catch (error) {
            sendJSON(res, 401, { success: false, message: 'You must be logged in to delete items.' });
        }
    }
	else if (url === '/api/storage-details' && method === 'GET') {
        try {
            const token = cookies.access_token;
            const appUser = await user.checkAuth(token);
            return getStorageDetails(req, res, appUser); 
        } 
		catch (error) {
            sendJSON(res, 401, { authorized: false, message: 'You must be logged in to see storage details.' });
        }
    }
  else {
    sendJSON(res, 404, { success: false, message: 'API endpoint not found.' });
  }
}

module.exports = requestHandler;