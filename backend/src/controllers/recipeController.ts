import { Request, Response } from 'express';
import { z } from 'zod';
import pool from '../database/db';
import { jobRepo } from '../database/repos';

// Sabit stajyer kullanıcı ID'si silindi

export const recipeController = {
  /**
   * POST /api/recipes
   * Onaylanan taslak tarifi veritabanına kalıcı olarak kaydeder (Transaction kullanır)
   */
  async saveRecipe(req: Request, res: Response): Promise<void> {
    const connection = await pool.getConnection();
    try {
    const saveRecipeSchema = z.object({
      jobId: z.string(),
      title: z.string().min(1),
      servings: z.number().nullable().optional(),
      prep_time: z.number().nullable().optional(),
      cook_time: z.number().nullable().optional(),
      ingredients: z.array(z.object({
        amount: z.number().nullable().optional(),
        unit: z.string().nullable().optional(),
        name: z.string().min(1)
      })).min(1),
      steps: z.array(z.string().min(1)).min(1)
    });

    const validationResult = saveRecipeSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({ error: 'Eksik veya geçersiz parametre gönderildi.', details: validationResult.error.errors });
      return;
    }

    const { jobId, title, servings, prep_time, cook_time, ingredients, steps } = validationResult.data;

      // 1. İlgili asenkron işi (job) kontrol et
      const job = await jobRepo.getJob(jobId);
      if (!job) {
        res.status(404).json({ error: 'Belirtilen içe aktarma işi bulunamadı.' });
        return;
      }

      if (job.status !== 'ready_for_review') {
        res.status(400).json({ error: 'Bu iş henüz onaylama aşamasına gelmemiş veya zaten tamamlanmış.' });
        return;
      }

      // Job verisinden platform ve yazar bilgilerini çekelim (Güvenilir metadata)
      const parsedRecipeData = typeof job.recipe_data === 'string' ? JSON.parse(job.recipe_data) : job.recipe_data;
      const platform = parsedRecipeData?.platform || 'blog';
      const author = parsedRecipeData?.author || 'Bilinmeyen Üretici';
      const originalUrl = job.canonical_url;
      const confidenceMap = JSON.stringify(parsedRecipeData?.confidence_map || {});

      // 2. İşlemleri Transaction ile başlat (Güvenli yazma)
      await connection.beginTransaction();

      const userId = (req as any).user.id;
      // a. Recipes tablosuna ekle
      const [recipeResult]: any = await connection.query(
        `INSERT INTO recipes (user_id, title, servings, prep_time, cook_time, platform, author, original_url, confidence_map) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, title, servings || null, prep_time || null, cook_time || null, platform, author, originalUrl, confidenceMap]
      );
      
      const recipeId = recipeResult.insertId;

      // b. Ingredients tablosuna topluca ekle
      for (const ing of ingredients) {
        await connection.query(
          `INSERT INTO ingredients (recipe_id, amount, unit, name) 
           VALUES (?, ?, ?, ?)`,
          [recipeId, ing.amount || null, ing.unit || null, ing.name]
        );
      }

      // c. Preparation Steps tablosuna ekle
      for (let i = 0; i < steps.length; i++) {
        await connection.query(
          `INSERT INTO preparation_steps (recipe_id, step_order, instruction) 
           VALUES (?, ?, ?)`,
          [recipeId, i + 1, steps[i]]
        );
      }

      // d. Import Job durumunu completed yap
      await connection.query(
        `UPDATE import_jobs SET status = 'completed', updated_at = NOW() WHERE id = ?`,
        [jobId]
      );

      // 3. Değişiklikleri kaydet ve kilidi kaldır
      await connection.commit();

      res.status(201).json({
        recipeId,
        message: 'Tarif başarıyla koleksiyonunuza eklendi.'
      });

    } catch (error: any) {
      await connection.rollback();
      console.error('Save recipe transaction failed:', error);
      res.status(500).json({ error: 'Tarif kaydedilirken veritabanı hatası oluştu.' });
    } finally {
      connection.release();
    }
  },

  /**
   * GET /api/recipes
   * Kullanıcının kayıtlı tariflerini listeler (Arama, sıralama desteğiyle - FR-19)
   */
  async listRecipes(req: Request, res: Response): Promise<void> {
    try {
      const sortBy = req.query.sortBy === 'title' ? 'title' : 'created_at';
      const order = req.query.order === 'asc' ? 'ASC' : 'DESC';
      const search = req.query.search ? `%${req.query.search}%` : null;

      const userId = (req as any).user.id;
      let query = `SELECT * FROM recipes WHERE user_id = ?`;
      const queryParams: any[] = [userId];

      if (search) {
        query += ` AND (title LIKE ? OR author LIKE ?)`;
        queryParams.push(search, search);
      }

      query += ` ORDER BY ${sortBy} ${order}`;

      const [rows] = await pool.query(query, queryParams);
      res.json(rows);
    } catch (error: any) {
      console.error('List recipes error:', error);
      res.status(500).json({ error: 'Tarifler listelenirken veritabanı hatası oluştu.' });
    }
  },

  /**
   * GET /api/recipes/:id
   * Tek bir tarifin detaylarını malzemeleri ve adımlarıyla birlikte çeker (FR-20)
   */
  async getRecipeDetail(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Geçersiz tarif ID.' });
        return;
      }

      const userId = (req as any).user.id;
      // 1. Tarifi çek
      const [recipes]: any = await pool.query(
        'SELECT * FROM recipes WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (recipes.length === 0) {
        res.status(404).json({ error: 'Tarif bulunamadı.' });
        return;
      }

      const recipe = recipes[0];

      // 2. Malzemeleri çek
      const [ingredients]: any = await pool.query(
        'SELECT id, amount, unit, name FROM ingredients WHERE recipe_id = ?',
        [id]
      );

      // 3. Adımları sıralı çek
      const [steps]: any = await pool.query(
        'SELECT id, step_order, instruction FROM preparation_steps WHERE recipe_id = ? ORDER BY step_order ASC',
        [id]
      );

      res.json({
        ...recipe,
        ingredients,
        steps: steps.map((s: any) => s.instruction)
      });

    } catch (error: any) {
      console.error('Get recipe detail error:', error);
      res.status(500).json({ error: 'Tarif detayları getirilirken veritabanı hatası oluştu.' });
    }
  },

  /**
   * PUT /api/recipes/:id
   * Mevcut bir tarifi günceller (FR-21)
   */
  async updateRecipe(req: Request, res: Response): Promise<void> {
    const connection = await pool.getConnection();
    try {
      const id = parseInt(req.params.id as string, 10);
      const { title, servings, prep_time, cook_time, ingredients, steps } = req.body;

      if (isNaN(id) || !title || !ingredients || !steps) {
        res.status(400).json({ error: 'Eksik veya geçersiz parametre gönderildi.' });
        return;
      }

      const userId = (req as any).user.id;
      // Tarifin varlığını ve kullanıcıya aitliğini denetle
      const [existing]: any = await pool.query(
        'SELECT id FROM recipes WHERE id = ? AND user_id = ?',
        [id, userId]
      );
      if (existing.length === 0) {
        res.status(404).json({ error: 'Güncellenecek tarif bulunamadı.' });
        return;
      }

      await connection.beginTransaction();

      // a. Recipe başlığını ve sürelerini güncelle
      await connection.query(
        `UPDATE recipes 
         SET title = ?, servings = ?, prep_time = ?, cook_time = ? 
         WHERE id = ? AND user_id = ?`,
        [title, servings || null, prep_time || null, cook_time || null, id, userId]
      );

      // b. Eski malzemeleri sil ve yenileri ekle
      await connection.query('DELETE FROM ingredients WHERE recipe_id = ?', [id]);
      for (const ing of ingredients) {
        await connection.query(
          `INSERT INTO ingredients (recipe_id, amount, unit, name) 
           VALUES (?, ?, ?, ?)`,
          [id, ing.amount || null, ing.unit || null, ing.name]
        );
      }

      // c. Eski adımları sil ve yenileri ekle
      await connection.query('DELETE FROM preparation_steps WHERE recipe_id = ?', [id]);
      for (let i = 0; i < steps.length; i++) {
        await connection.query(
          `INSERT INTO preparation_steps (recipe_id, step_order, instruction) 
           VALUES (?, ?, ?)`,
          [id, i + 1, steps[i]]
        );
      }

      await connection.commit();
      res.json({ message: 'Tarif başarıyla güncellendi.' });

    } catch (error: any) {
      await connection.rollback();
      console.error('Update recipe error:', error);
      res.status(500).json({ error: 'Tarif güncellenirken veritabanı hatası oluştu.' });
    } finally {
      connection.release();
    }
  },

  /**
   * DELETE /api/recipes/:id
   * Bir tarifi siler (FR-21)
   */
  async deleteRecipe(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Geçersiz tarif ID.' });
        return;
      }

      const userId = (req as any).user.id;
      // Silme işlemi ON DELETE CASCADE sayesinde bağlı malzemeleri ve adımları otomatik siler!
      const [result]: any = await pool.query(
        'DELETE FROM recipes WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (result.affectedRows === 0) {
        res.status(404).json({ error: 'Silinecek tarif bulunamadı.' });
        return;
      }

      res.json({ message: 'Tarif başarıyla silindi.' });
    } catch (error: any) {
      console.error('Delete recipe error:', error);
      res.status(500).json({ error: 'Tarif silinirken veritabanı hatası oluştu.' });
    }
  }
};
