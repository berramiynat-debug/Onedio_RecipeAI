import mysql from 'mysql2/promise';
import { config } from '../config';

export async function initDb() {
  // İlk önce veritabanı olmadan bağlanıp veritabanını oluşturalım
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    charset: 'utf8mb4',
  });

  console.log(`Checking/Creating database: ${config.db.database}...`);
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.database}\`;`);
  await connection.end();

  // Şimdi havuzumuz üzerinden tablolara bağlanıp oluşturalım
  const pool = (await import('./db')).default;

  console.log('Creating tables if they do not exist...');

  // 1. Users Tablosu (Demo oturumu için)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 2. Import Jobs (Asenkron İş Takip) Tablosu
  await pool.query(`
    CREATE TABLE IF NOT EXISTS import_jobs (
      id VARCHAR(36) PRIMARY KEY,
      user_id INT NOT NULL,
      canonical_url VARCHAR(2083) NOT NULL,
      status ENUM('queued', 'processing', 'ready_for_review', 'completed', 'failed') NOT NULL DEFAULT 'queued',
      sub_status ENUM('fetching', 'extracting', 'translating') NULL,
      error_class ENUM('invalid_input', 'inaccessible', 'no_recipe', 'system_error') NULL,
      error_message TEXT NULL,
      recipe_data JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 3. Recipes (Yemek Tarifleri) Tablosu
  await pool.query(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      servings INT NULL,
      prep_time INT NULL,
      cook_time INT NULL,
      platform VARCHAR(50) NOT NULL,
      author VARCHAR(100) NULL,
      original_url VARCHAR(2083) NOT NULL,
      confidence_map JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 4. Ingredients (Yemek Malzemeleri) Tablosu
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      recipe_id INT NOT NULL,
      amount DECIMAL(10,2) NULL,
      unit VARCHAR(50) NULL,
      name VARCHAR(255) NOT NULL,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 5. Preparation Steps (Yapılış Adımları) Tablosu
  await pool.query(`
    CREATE TABLE IF NOT EXISTS preparation_steps (
      id INT AUTO_INCREMENT PRIMARY KEY,
      recipe_id INT NOT NULL,
      step_order INT NOT NULL,
      instruction TEXT NOT NULL,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Varsayılan stajyer kullanıcısını yerleştirme (Bölüm 5.2 - User: Basit oturum)
  const [rows]: any = await pool.query('SELECT * FROM users WHERE id = 1');
  if (rows.length === 0) {
    console.log('Seeding default demo user (ID: 1, email: stajyer@onedio.com)...');
    await pool.query("INSERT INTO users (id, email) VALUES (1, 'stajyer@onedio.com')");
  }

  console.log('Database tables initialized successfully.');
}
