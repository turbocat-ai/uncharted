const pgp = require('pg-promise')
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

pg_user = process.env.PG_USERNAME
pg_pwd = process.env.PG_PWD
pg_host = process.env.PG_HOST
pg_port = process.env.PG_PORT
pg_db = process.env.PG_DB

conn_str = `postgres://${pg_user}:${pg_pwd}@${pg_host}:${pg_port}/${pg_db}`

console.log(conn_str)

const db = pgp(conn_str);

db.one('SELECT * FROM users')
  .then((data) => {
    console.log('DATA:', data.value);
  })
  .catch((error) => {
    console.log('ERROR:', error);
  });