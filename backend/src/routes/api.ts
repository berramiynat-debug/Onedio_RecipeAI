import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { importController } from '../controllers/importController';
import { jobController } from '../controllers/jobController';
import { recipeController } from '../controllers/recipeController';
import { authController } from '../controllers/authController';
import { authenticateToken, optionalAuthenticateToken } from '../middlewares/authMiddleware';
import { config } from '../config';

const router = Router();

const importLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimitMax,
  message: { error: 'Too many requests, please try again later.' }
});

// 0. Auth Rotaları
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

// 1. İçe Aktarma ve Durum Sorgulama Rotaları (Herkes Link Gönderebilir ve Görebilir)
router.post('/import', optionalAuthenticateToken, importLimiter, importController.startImport);
router.get('/jobs/:id', optionalAuthenticateToken, jobController.getJobStatus);

// 2. Yemek Tarifi Yönetimi Rotaları (Koleksiyon)
router.post('/recipes', authenticateToken, recipeController.saveRecipe);
router.get('/recipes', authenticateToken, recipeController.listRecipes);
router.get('/recipes/:id', authenticateToken, recipeController.getRecipeDetail);
router.put('/recipes/:id', authenticateToken, recipeController.updateRecipe);
router.delete('/recipes/:id', authenticateToken, recipeController.deleteRecipe);

import { scrapeUrl } from '../services/scraperService';

router.get('/debug-scrape', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url parameter is required' });
  try {
    const data = await scrapeUrl(url as string);
    res.json({
      title: data.title,
      author: data.author,
      platform: data.platform,
      originalUrl: data.originalUrl,
      contentLength: data.content.length,
      contentPreview: data.content.substring(0, 1000)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
