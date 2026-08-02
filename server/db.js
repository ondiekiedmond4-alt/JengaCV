const { Pool } = require('pg');

// Render's managed Postgres provides DATABASE_URL automatically when linked in render.yaml.
// SSL is required for Render Postgres connections from the web service.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});

module.exports = pool;
