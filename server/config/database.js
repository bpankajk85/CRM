import mysql from 'mysql2/promise';
import { logger } from './logger.js';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'email_platform',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  charset: 'utf8mb4',
  timezone: '+00:00'
};

let pool = null;

// Create pool with error handling
try {
  pool = mysql.createPool(dbConfig);
  logger.info('Database pool created successfully');
} catch (error) {
  logger.error('Failed to create database pool:', error);
}

export { pool };

export async function testConnection() {
  if (!pool) {
    logger.error('Database pool not initialized');
    return false;
  }

  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    logger.info('Database connection test successful');
    return true;
  } catch (error) {
    logger.error('Database connection test failed:', error);
    logger.error('Database config:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database,
      // Don't log password
    });
    return false;
  }
}

export async function query(sql, params = []) {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }

  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    logger.error('Database query error:', error);
    logger.error('Query:', sql);
    logger.error('Params:', params);
    throw error;
  }
}

// Test connection on module load (non-blocking)
setTimeout(() => {
  testConnection().catch(error => {
    logger.warn('Initial database connection test failed:', error.message);
  });
}, 2000);