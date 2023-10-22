const Pool = require("pg").Pool;
require("dotenv").config();

// const connectionString = process.env.CONNECTION_STRING;
const pool = new Pool({
  // connectionString,
  host: process.env.HOST,
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: process.env.PASSWORD,
});

module.exports = pool;
