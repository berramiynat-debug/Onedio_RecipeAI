import pool from './db';

export interface DbJob {
  id: string;
  user_id: number | null;
  canonical_url: string;
  status: 'queued' | 'processing' | 'ready_for_review' | 'completed' | 'failed';
  sub_status: 'fetching' | 'extracting' | 'translating' | null;
  error_class: 'invalid_input' | 'inaccessible' | 'no_recipe' | 'system_error' | null;
  error_message: string | null;
  recipe_data: any | null;
  created_at: Date;
  updated_at: Date;
}

export const jobRepo = {
  /**
   * Yeni bir asenkron iş (job) oluşturur
   */
  async createJob(id: string, userId: number | null, canonicalUrl: string): Promise<void> {
    await pool.query(
      `INSERT INTO import_jobs (id, user_id, canonical_url, status) 
       VALUES (?, ?, ?, 'queued')`,
      [id, userId, canonicalUrl]
    );
  },

  /**
   * Asenkron işin durumunu günceller (FR-23)
   */
  async updateJobStatus(
    id: string,
    status: DbJob['status'],
    subStatus: DbJob['sub_status'] = null,
    errorClass: DbJob['error_class'] = null,
    errorMessage: string | null = null,
    recipeData: any = null
  ): Promise<void> {
    const recipeDataString = recipeData ? JSON.stringify(recipeData) : null;
    await pool.query(
      `UPDATE import_jobs 
       SET status = ?, sub_status = ?, error_class = ?, error_message = ?, recipe_data = ?, updated_at = NOW() 
       WHERE id = ?`,
      [status, subStatus, errorClass, errorMessage, recipeDataString, id]
    );
  },

  /**
   * Job ID ile iş detaylarını çeker
   */
  async getJob(id: string): Promise<DbJob | null> {
    const [rows]: any = await pool.query(
      'SELECT * FROM import_jobs WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? (rows[0] as DbJob) : null;
  },

  /**
   * Kullanıcının daha önce aynı linkten tarif ekleyip eklemediğini kontrol eder (FR-4)
   */
  async getRecipeByUrl(userId: number, canonicalUrl: string): Promise<any | null> {
    const [rows]: any = await pool.query(
      'SELECT * FROM recipes WHERE user_id = ? AND original_url = ?',
      [userId, canonicalUrl]
    );
    return rows.length > 0 ? rows[0] : null;
  }
};
