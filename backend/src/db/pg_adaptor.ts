const pgp = require('pg-promise')();
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pg_user = process.env.PG_USERNAME;
const pg_pwd = process.env.PG_PWD;
const pg_host = process.env.PG_HOST;
const pg_port = process.env.PG_PORT || '5432';
const pg_db = process.env.PG_DB;

const conn_str = `postgres://${pg_user}:${pg_pwd}@${pg_host}:${pg_port}/${pg_db}`;

const db = pgp(conn_str);

module.exports = { db };