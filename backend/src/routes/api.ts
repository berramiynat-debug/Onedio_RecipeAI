import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { importController } from '../controllers/importController';
import { jobController } from '../controllers/jobController';
import { recipeController } from '../controllers/recipeController';
import { authController } from '../controllers/authController';
import { authenticateToken } from '../middlewares/authMiddleware';
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

// 1. İçe Aktarma ve Durum Sorgulama Rotaları
router.post('/import', authenticateToken, importLimiter, importController.startImport);
router.get('/jobs/:id', authenticateToken, jobController.getJobStatus);

// 2. Yemek Tarifi Yönetimi Rotaları (Koleksiyon)
router.post('/recipes', authenticateToken, recipeController.saveRecipe);
router.get('/recipes', authenticateToken, recipeController.listRecipes);
router.get('/recipes/:id', authenticateToken, recipeController.getRecipeDetail);
router.put('/recipes/:id', authenticateToken, recipeController.updateRecipe);
router.delete('/recipes/:id', authenticateToken, recipeController.deleteRecipe);

export default router;
