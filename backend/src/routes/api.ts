import { Router } from 'express';
import { importController } from '../controllers/importController';
import { jobController } from '../controllers/jobController';

const router = Router();

// İçe aktarma rotaları
router.post('/import', importController.startImport);
router.get('/jobs/:id', jobController.getJobStatus);

export default router;
