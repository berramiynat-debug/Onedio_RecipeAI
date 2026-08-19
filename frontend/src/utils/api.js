const API_BASE = 'http://localhost:5000/api';

export const api = {
  /** POST /api/import — Link gönder, job başlat */
  async startImport(url) {
    const res = await fetch(`${API_BASE}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    return res.json();
  },

  /** GET /api/jobs/:id — Job durumunu sorgula (polling) */
  async getJobStatus(jobId) {
    const res = await fetch(`${API_BASE}/jobs/${jobId}`);
    return res.json();
  },

  /** POST /api/recipes — Onaylanan tarifi kaydet */
  async saveRecipe(data) {
    const res = await fetch(`${API_BASE}/recipes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  /** GET /api/recipes — Kullanıcının koleksiyonunu listele */
  async listRecipes(sortBy = 'created_at', order = 'desc', search = '') {
    const params = new URLSearchParams({ sortBy, order });
    if (search) params.append('search', search);
    const res = await fetch(`${API_BASE}/recipes?${params}`);
    return res.json();
  },

  /** GET /api/recipes/:id — Tek tarif detayı */
  async getRecipeDetail(id) {
    const res = await fetch(`${API_BASE}/recipes/${id}`);
    return res.json();
  },

  /** PUT /api/recipes/:id — Tarif güncelle */
  async updateRecipe(id, data) {
    const res = await fetch(`${API_BASE}/recipes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  /** DELETE /api/recipes/:id — Tarif sil */
  async deleteRecipe(id) {
    const res = await fetch(`${API_BASE}/recipes/${id}`, { method: 'DELETE' });
    return res.json();
  },
};
