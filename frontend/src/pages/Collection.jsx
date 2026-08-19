import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

/**
 * Koleksiyon Sayfası — Kayıtlı tariflerin listesi (FR-19)
 */
export default function Collection() {
  const [recipes, setRecipes] = useState([]);
  const [sortBy, setSortBy] = useState('created_at');
  const [order, setOrder] = useState('desc');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadRecipes();
  }, [sortBy, order, search]);

  const loadRecipes = async () => {
    setLoading(true);
    try {
      const data = await api.listRecipes(sortBy, order, search);
      setRecipes(Array.isArray(data) ? data : []);
    } catch (err) {
      setRecipes([]);
    }
    setLoading(false);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
          🍽️ Tarif Koleksiyonum
        </h1>

        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <input
            className="input"
            placeholder="🔍 Ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 200 }}
            id="search-input"
          />
          <select
            className="input"
            value={`${sortBy}-${order}`}
            onChange={e => {
              const [s, o] = e.target.value.split('-');
              setSortBy(s);
              setOrder(o);
            }}
            id="sort-select"
          >
            <option value="created_at-desc">En yeni</option>
            <option value="created_at-asc">En eski</option>
            <option value="title-asc">A-Z</option>
            <option value="title-desc">Z-A</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="empty-state__icon">⏳</div>
          <p>Yükleniyor...</p>
        </div>
      ) : recipes.length === 0 ? (
        <div className="empty-state slide-up">
          <div className="empty-state__icon">📭</div>
          <h3 className="empty-state__title">
            {search ? 'Aramanızla eşleşen tarif bulunamadı' : 'Henüz tarif eklemediniz'}
          </h3>
          <p style={{ marginBottom: 'var(--space-6)' }}>
            {search ? 'Farklı bir arama deneyin.' : 'Ana sayfadan bir link yapıştırarak ilk tarifinizi ekleyin!'}
          </p>
          {!search && (
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              🍳 İlk Tarifimi Ekle
            </button>
          )}
        </div>
      ) : (
        <div className="recipe-grid">
          {recipes.map((r) => (
            <div
              key={r.id}
              className="recipe-card slide-up"
              onClick={() => navigate(`/recipes/${r.id}`)}
              id={`recipe-card-${r.id}`}
            >
              <span className="recipe-card__platform">{r.platform}</span>
              <h3 className="recipe-card__title" style={{ marginTop: 'var(--space-3)' }}>{r.title}</h3>
              <div className="recipe-card__meta">
                <span>👨‍🍳 {r.author || 'Bilinmeyen'}</span>
                <span>•</span>
                <span>📅 {formatDate(r.created_at)}</span>
              </div>
              <div className="recipe-card__meta">
                {r.servings && <span>🍽️ {r.servings} kişilik</span>}
                {r.prep_time && <span>⏱️ {r.prep_time} dk hazırlık</span>}
                {r.cook_time && <span>🔥 {r.cook_time} dk pişirme</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
