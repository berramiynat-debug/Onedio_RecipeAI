import express from 'express';
import cors from 'cors';
import { config } from './config';
import { initDb } from './database/init';
import apiRouter from './routes/api';

const app = express();

app.use(cors());
app.use(express.json());

// API rotalarını ekle
app.use('/api', apiRouter);

// Sağlık kontrolü (Health check) rotası
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Backend server is running.'
  });
});

async function startServer() {
  try {
    // Veritabanı ve tabloları kur/kontrol et
    await initDb();
    
    app.listen(config.port, () => {
      console.log(`Server successfully started on port ${config.port}`);
    });
  } catch (error) {
    console.error('Failed to initialize application database:', error);
    process.exit(1);
  }
}

startServer();
export default app;
