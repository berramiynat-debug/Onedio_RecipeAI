import { Request, Response } from 'express';
import { jobRepo } from '../database/repos';

export const jobController = {
  /**
   * GET /api/jobs/:id
   * Asenkron işin (job) durumunu sorgulamak için polling endpoint'i (FR-24)
   */
  async getJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;

      if (!id) {
        res.status(400).json({ error: 'Job ID gereklidir.' });
        return;
      }

      const job = await jobRepo.getJob(id);

      if (!job) {
        res.status(404).json({ error: 'Belirtilen iş bulunamadı.' });
        return;
      }

      // Client'a durum bilgilerini dön (FR-23, FR-24)
      res.json({
        id: job.id,
        status: job.status,
        sub_status: job.sub_status,
        error_class: job.error_class,
        error_message: job.error_message,
        recipe_data: job.recipe_data
      });
    } catch (error: any) {
      console.error('Get job status endpoint error:', error);
      res.status(500).json({ error: 'İş durumu sorgulanırken sunucu hatası oluştu.' });
    }
  }
};
