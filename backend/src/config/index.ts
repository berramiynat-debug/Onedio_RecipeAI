import dotenv from 'dotenv';
import path from 'path';

// .env dosyasını yükle
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  port: process.env.PORT || 5000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'onedio_recipes',
  },
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  // İzin verilen sosyal medya alan adları
  domainAllowlist: [
    'instagram.com',
    'www.instagram.com',
    'tiktok.com',
    'www.tiktok.com',
    'vm.tiktok.com',
    'youtube.com',
    'www.youtube.com',
    'youtu.be'
  ],
  // Timeout süreleri (milisaniye cinsinden)
  jobTimeoutMs: 60000, // 60 saniye
};
