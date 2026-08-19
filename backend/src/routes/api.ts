import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { importController } from '../controllers/importController';
import { jobController } from '../controllers/jobController';
import { recipeController } from '../controllers/recipeController';
import { config } from '../config';

const router = Router();

const importLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimitMax,
  message: { error: 'Too many requests, please try again later.' }
});

// 1. İçe Aktarma ve Durum Sorgulama Rotaları
router.post('/import', importLimiter, importController.startImport);
router.get('/jobs/:id', jobController.getJobStatus);

// 2. Yemek Tarifi Yönetimi Rotaları (Koleksiyon)
router.post('/recipes', recipeController.saveRecipe);
router.get('/recipes', recipeController.listRecipes);
router.get('/recipes/:id', recipeController.getRecipeDetail);
router.put('/recipes/:id', recipeController.updateRecipe);
router.delete('/recipes/:id', recipeController.deleteRecipe);

export default router;
