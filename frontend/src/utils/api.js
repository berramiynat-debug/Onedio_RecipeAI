const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// Merkezi yetkilendirme kontrolü yapan istek yardımcısı (401 / 403 / Geçersiz token durumlarında otomatik çıkış yapar)
const request = async (url, options = {}) => {
  let res;
  try {
    res = await fetch(url, options);
  } catch (netErr) {
    throw new Error(`Sunucuya bağlanılamadı. Lütfen sunucunun (Render) çalışır durumda olduğunu kontrol edin. (İstek: ${url})`);
  }
  
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('token');
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Oturum süreniz doldu, lütfen tekrar giriş yapın.');
  }

  if (!res.ok) {
    let errorMsg = `Sunucu hatası (Kod: ${res.status})`;
    try {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await res.json();
        errorMsg = errorData.error || errorMsg;
      } else {
        errorMsg = `Sunucu güncel değil veya yönlendirme hatası oluştu (Kod: ${res.status}). Lütfen sunucunun (Render) başarıyla derlendiğinden ve 'Clear Cache and Deploy' yapıldığından emin olun.`;
      }
    } catch (e) {
      // ignore
    }
    throw new Error(`${errorMsg} (İstek: ${url})`);
  }
  
  return res;
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

  /** POST /api/import — Link, ham metin veya görsel gönder, job başlat */
  async startImport(payload, mode = 'url') {
    let body = {};
    if (mode === 'text') {
      body = { rawText: payload };
    } else if (mode === 'image') {
      body = { image: payload.base64, mimeType: payload.mimeType };
    } else {
      body = { url: payload };
    }
    const res = await request(`${API_BASE}/import`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return res.json();
  },

  /** GET /api/jobs/:id — Job durumunu sorgula (polling) */
  async getJobStatus(jobId) {
    const res = await request(`${API_BASE}/jobs/${jobId}`, { headers: getHeaders() });
    return res.json();
  },

  /** POST /api/recipes — Onaylanan tarifi kaydet */
  async saveRecipe(data) {
    const res = await request(`${API_BASE}/recipes`, {
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
    const res = await request(`${API_BASE}/recipes?${params}`, { headers: getHeaders() });
    return res.json();
  },

  /** GET /api/recipes/:id — Tek tarif detayı */
  async getRecipeDetail(id) {
    const res = await request(`${API_BASE}/recipes/${id}`, { headers: getHeaders() });
    return res.json();
  },

  /** PUT /api/recipes/:id — Tarif güncelle */
  async updateRecipe(id, data) {
    const res = await request(`${API_BASE}/recipes/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  /** DELETE /api/recipes/:id — Tarif sil */
  async deleteRecipe(id) {
    const res = await request(`${API_BASE}/recipes/${id}`, { 
      method: 'DELETE',
      headers: getHeaders()
    });
    return res.json();
  },

  /** GET /api/auth/me — Profil detaylarını getir */
  async getProfile() {
    const res = await request(`${API_BASE}/auth/me`, { headers: getHeaders() });
    return res.json();
  },

  /** PUT /api/auth/profile — Profil (kullanıcı adı/şifre) güncelle */
  async updateProfile(data) {
    const res = await request(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
};
