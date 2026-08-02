const pgp = require('pg-promise')(); // <-- Note the extra () at the end here!
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const pg_user = process.env.PG_USERNAME;
const pg_pwd = process.env.PG_PWD;
const pg_host = process.env.PG_HOST;
const pg_port = process.env.PG_PORT;
const pg_db = process.env.PG_DB;

const conn_str = `postgres://${pg_user}:${pg_pwd}@${pg_host}:${pg_port}/${pg_db}`;

console.log(conn_str);

const db = pgp(conn_str); // <-- Now pgp is properly initialized as a function!

db.one('SELECT * FROM users')
  .then((data) => {
    console.log('DATA:', data);
  })
  .catch((error) => {
    console.log('ERROR:', error);
  });