import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

/**
 * Tarif Detay Sayfası (FR-20, FR-21)
 */
export default function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    loadRecipe();
  }, [id]);

  const loadRecipe = async () => {
    setLoading(true);
    try {
      const data = await api.getRecipeDetail(id);
      if (data.error) {
        setError(data.error);
      } else {
        setRecipe(data);
      }
    } catch {
      setError('Tarif yüklenirken bir hata oluştu.');
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    try {
      await api.deleteRecipe(id);
      navigate('/collection');
    } catch {
      setError('Tarif silinirken hata oluştu.');
    }
  };

  if (loading) {
    return (
      <div className="empty-state fade-in">
        <div className="empty-state__icon">⏳</div>
        <p>Tarif yükleniyor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state fade-in">
        <div className="empty-state__icon">😟</div>
        <h3 className="empty-state__title">{error}</h3>
        <button className="btn btn-primary" onClick={() => navigate('/collection')} style={{ marginTop: 'var(--space-4)' }}>
          Koleksiyona Dön
        </button>
      </div>
    );
  }

  const confidenceMap = typeof recipe.confidence_map === 'string' 
    ? JSON.parse(recipe.confidence_map) 
    : recipe.confidence_map;

  return (
    <div className="fade-in" style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Başlık ve Aksiyonlar */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-6)', gap: 'var(--space-4)' }}>
        <div>
          <button className="btn btn-sm btn-secondary" onClick={() => navigate('/collection')} style={{ marginBottom: 'var(--space-3)' }}>
            ← Koleksiyona Dön
          </button>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-navy)', lineHeight: 1.2 }}>
            {recipe.title}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
          <button className="btn btn-sm btn-danger" onClick={() => setShowDeleteConfirm(true)} id="delete-recipe-button">
            🗑️ Sil
          </button>
        </div>
      </div>

      {/* Silme Onayı */}
      {showDeleteConfirm && (
        <div className="card" style={{ marginBottom: 'var(--space-4)', background: 'var(--color-error-bg)', border: '1px solid #FECACA' }}>
          <p style={{ fontWeight: 600, marginBottom: 'var(--space-3)' }}>Bu tarifi kalıcı olarak silmek istediğinizden emin misiniz?</p>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className="btn btn-sm btn-danger" onClick={handleDelete}>Evet, Sil</button>
            <button className="btn btn-sm btn-secondary" onClick={() => setShowDeleteConfirm(false)}>İptal</button>
          </div>
        </div>
      )}

      {/* Meta Bilgiler */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
          {recipe.servings && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-orange)' }}>{recipe.servings}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Kişilik</div>
            </div>
          )}
          {recipe.prep_time && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-orange)' }}>{recipe.prep_time}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>dk Hazırlık</div>
            </div>
          )}
          {recipe.cook_time && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-orange)' }}>{recipe.cook_time}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>dk Pişirme</div>
            </div>
          )}
        </div>
      </div>

      {/* Malzemeler */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <h2 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>🥕 Malzemeler</h2>
        <ul style={{ listStyle: 'none' }}>
          {recipe.ingredients?.map((ing, i) => (
            <li key={i} style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border-light)', display: 'flex', gap: 'var(--space-2)' }}>
              <span style={{ color: 'var(--color-orange)', fontWeight: 600, minWidth: 80 }}>
                {ing.amount ? `${ing.amount} ${ing.unit || ''}` : ''}
              </span>
              <span>{ing.name}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Yapılış Adımları */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <h2 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>📝 Yapılış</h2>
        <ol style={{ paddingLeft: 0, listStyle: 'none' }}>
          {recipe.steps?.map((step, i) => (
            <li key={i} style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border-light)', display: 'flex', gap: 'var(--space-3)' }}>
              <span style={{
                width: 28, height: 28, borderRadius: 'var(--radius-full)',
                background: 'linear-gradient(135deg, var(--color-orange), var(--color-orange-hover))',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'var(--font-size-xs)', fontWeight: 700, flexShrink: 0
              }}>
                {i + 1}
              </span>
              <span style={{ paddingTop: 3 }}>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Kaynak Atfı (FR-20) */}
      <div className="card" style={{ background: 'var(--color-bg-secondary)' }}>
        <h3 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>📌 Kaynak</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <span className="recipe-card__platform">{recipe.platform}</span>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            👨‍🍳 {recipe.author || 'Bilinmeyen Üretici'}
          </span>
          <a
            href={recipe.original_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-secondary"
            id="view-original-link"
          >
            🔗 Orijinali Görüntüle
          </a>
        </div>
      </div>
    </div>
  );
}
