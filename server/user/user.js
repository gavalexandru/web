const db = require('../database/db');
const bcrypt = require('bcrypt');
const saltRounds = 10; 
const jwt = require('./jwt'); 

async function register(email, password) {
  try {
    
    const existingUser = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
     
      const error = new Error('An account with this email already exists.');
      error.statusCode = 409; 
      throw error;
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await db.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING user_id, email',
      [email, hashedPassword]
    );

    return newUser.rows[0];
    
  } 
  catch (error) {
    console.error('Error in user registration:', error.message);
    throw error;
  }
}

async function login(email, password) {
  try {
    
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user) {
      
      const error = new Error('Invalid credentials.');
      error.statusCode = 401; 
      throw error;
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      
      const error = new Error('Invalid credentials.');
      error.statusCode = 401; 
      throw error;
    }

    const payload = { userId: user.user_id, email: user.email };
    const token = jwt.generateToken(payload);
    
    return token;
  } 
  catch (error) {
  
    throw error;
  }
}

async function checkAuth(token) {
    if (!token) {
        const error = new Error('Not authorized, no token.');
        error.statusCode = 401;
        throw error;
    }

    try {
        
        const result = await db.query('SELECT id FROM revoked_tokens WHERE token = $1', [token]);
        if (result.rows.length > 0) {
            
            const error = new Error('Token has been revoked (user logged out).');
            error.statusCode = 401;
            throw error;
        }

      
        const decodedUser = jwt.verifyToken(token);
        return decodedUser;

    } 
	catch (error) {
        
        if (!error.statusCode) {
            error.statusCode = 401;
        }
        throw error;
    }
}

async function logout(token) {
    if (!token) {
        const error = new Error('No token provided for logout.');
        error.statusCode = 400; 
        throw error;
    }

    try {
        
        const decoded = jwt.verifyToken(token);
        const { userId } = decoded;

        await db.query(
            'INSERT INTO revoked_tokens (token, user_id) VALUES ($1, $2) ON CONFLICT (token) DO NOTHING',
            [token, userId]
        );

    } 
	catch (error) {
        
        console.warn("Attempted to log out with an invalid token. This is generally safe.", error.message);
    }
}


module.exports = { register, login, checkAuth, logout }; 