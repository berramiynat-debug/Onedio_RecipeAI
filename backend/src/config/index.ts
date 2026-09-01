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
  jwtSecret: process.env.JWT_SECRET || 'oneyiyo-secret-key-2026',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  // İzin verilen sosyal medya alan adları
  domainAllowlist: process.env.ALLOWED_DOMAINS 
    ? process.env.ALLOWED_DOMAINS.split(',').map(d => d.trim())
    : [
    'instagram.com',
    'www.instagram.com',
    'tiktok.com',
    'www.tiktok.com',
    'vm.tiktok.com',
    'vt.tiktok.com',
    'youtube.com',
    'www.youtube.com',
    'youtu.be',
    'nefisyemektarifleri.com',
    'yemek.com',
    'lezzet.com.tr'
  ],
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '10', 10),
  maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH || '5242880', 10), // 5MB
  // Timeout süreleri (milisaniye cinsinden)
  jobTimeoutMs: 60000, // 60 saniye
  metaAppToken: process.env.META_APP_TOKEN || '',
  rapidapiApiKey: process.env.RAPIDAPI_API_KEY || '',
  apifyApiToken: process.env.APIFY_API_TOKEN || '',
};
