import pgPromise from 'pg-promise';

import path from 'path';
import dotenv from 'dotenv';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const pgp = pgPromise();

const pg_user = process.env.PG_USERNAME;
const pg_pwd = process.env.PG_PWD;
const pg_host = process.env.PG_HOST;
const pg_port = process.env.PG_PORT || '5432';
const pg_db = process.env.PG_DB;

const conn_str = `postgres://${pg_user}:${pg_pwd}@${pg_host}:${pg_port}/${pg_db}`;

const db = pgp(conn_str);

export default db;