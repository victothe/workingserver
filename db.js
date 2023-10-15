const Pool = require("pg").Pool;
require("dotenv").config();

const connectionString = process.env.CONNECTION_STRING;
const pool = new Pool({
  connectionString,
});

module.exports = pool;
