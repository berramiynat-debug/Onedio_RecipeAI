import mysql from 'mysql2/promise';
import { config } from '../config';

// MySQL bağlantı havuzu (connection pool) oluştur
const isSslNeeded = process.env.DB_SSL === 'true' || config.db.host.includes('aivencloud.com') || config.db.port === 24523 || process.env.NODE_ENV === 'production';

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  ssl: isSslNeeded ? { rejectUnauthorized: false } : undefined,
});

export default pool;
