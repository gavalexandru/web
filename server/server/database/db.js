const { Pool } = require('pg');
require('dotenv').config({ path: __dirname + '/../../.env' });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.connect((err, client) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  console.log('Successfully connected to the PostgreSQL database!');
  client.release(); 
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};