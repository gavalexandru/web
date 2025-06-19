const jwt = require('jsonwebtoken');
require('dotenv').config({ path: __dirname + '/../../.env' });

const secret = process.env.JWT_SECRET;
const expiration = '1h'; 

function generateToken(payload) {
  return jwt.sign({ data: payload }, secret, { expiresIn: expiration });
}

function verifyToken(token) {
  try {
    const { data } = jwt.verify(token, secret);
    return data;
  } 
  catch (err) {
    console.error('Invalid token:', err.message);
	
    throw new Error('Invalid or expired token.');
  }
}

module.exports = { generateToken, verifyToken };

    