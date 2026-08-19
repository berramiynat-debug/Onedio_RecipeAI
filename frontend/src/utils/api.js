const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  /** POST /api/auth/login — Kullanıcı girişi */
  async login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return data;
  },

  /** POST /api/auth/register — Kullanıcı kaydı */
  async register(username, email, password) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    return data;
  },

  /** POST /api/import — Link gönder, job başlat */
  async startImport(url) {
    const res = await fetch(`${API_BASE}/import`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ url }),
    });
    return res.json();
  },

  /** GET /api/jobs/:id — Job durumunu sorgula (polling) */
  async getJobStatus(jobId) {
    const res = await fetch(`${API_BASE}/jobs/${jobId}`, { headers: getHeaders() });
    return res.json();
  },

  /** POST /api/recipes — Onaylanan tarifi kaydet */
  async saveRecipe(data) {
    const res = await fetch(`${API_BASE}/recipes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  /** GET /api/recipes — Kullanıcının koleksiyonunu listele */
  async listRecipes(sortBy = 'created_at', order = 'desc', search = '') {
    const params = new URLSearchParams({ sortBy, order });
    if (search) params.append('search', search);
    const res = await fetch(`${API_BASE}/recipes?${params}`, { headers: getHeaders() });
    return res.json();
  },

  /** GET /api/recipes/:id — Tek tarif detayı */
  async getRecipeDetail(id) {
    const res = await fetch(`${API_BASE}/recipes/${id}`, { headers: getHeaders() });
    return res.json();
  },

  /** PUT /api/recipes/:id — Tarif güncelle */
  async updateRecipe(id, data) {
    const res = await fetch(`${API_BASE}/recipes/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  /** DELETE /api/recipes/:id — Tarif sil */
  async deleteRecipe(id) {
    const res = await fetch(`${API_BASE}/recipes/${id}`, { 
      method: 'DELETE',
      headers: getHeaders()
    });
    return res.json();
  },
};
