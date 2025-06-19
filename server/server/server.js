const http = require('http');
const fs = require('fs');
const path = require('path');
const apiRequestHandler = require('./routes/routes');

require('dotenv').config({ path: __dirname + '/../.env' });
const PORT = process.env.PORT;

const server = http.createServer((req, res) => {
  console.log(`Request received: ${req.method} ${req.url}`);

  if (req.url.startsWith('/api/')) {
    return apiRequestHandler(req, res);
  }

  let fileToServe;

  switch (req.url) {
    case '/':
    case '/login':
      fileToServe = 'login.html';
      break;
    case '/signup':
      fileToServe = 'signup.html';
      break;
    case '/dashboard':
      fileToServe = 'dashboard.html';
      break;
    default:
   
      fileToServe = req.url;
      break;
  }

  let filePath = path.join(__dirname, '..', 'public', fileToServe);


  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    
    if (error) {
     
      if (error.code !== 'ENOENT') {
        console.error('Server error reading file:', error);
        res.writeHead(500);
        res.end('Server Error: ' + error.code);
      } 
	  else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
      }
      return; 
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content, 'utf-8');
   });
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('Serving files from the "public" directory.');
});