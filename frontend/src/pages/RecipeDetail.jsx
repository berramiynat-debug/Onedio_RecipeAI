import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

/**
 * Tarif Detay ve Düzenleme Sayfası (FR-20, FR-21)
 */
export default function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Düzenleme durumu ve alanları
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [servings, setServings] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [steps, setSteps] = useState([]);

  useEffect(() => {
    loadRecipe();
  }, [id]);

  const loadRecipe = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRecipeDetail(id);
      if (data.error) {
        setError(data.error);
      } else {
        setRecipe(data);
        // Düzenleme formunu ilklendir
        setTitle(data.title || '');
        setServings(data.servings || '');
        setPrepTime(data.prep_time || '');
        setCookTime(data.cook_time || '');
        setIngredients(data.ingredients || []);
        setSteps(data.steps || []);
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

  const handleUpdate = async () => {
    if (!title.trim()) {
      setError('Tarif başlığı boş bırakılamaz.');
      return;
    }
    if (ingredients.length === 0) {
      setError('En az bir malzeme eklemelisiniz.');
      return;
    }
    if (steps.length === 0 || steps.every(s => !s.trim())) {
      setError('En az bir yapılış adımı eklemelisiniz.');
      return;
    }

    try {
      const payload = {
        title: title.trim(),
        servings: servings ? parseInt(servings, 10) : null,
        prep_time: prepTime ? parseInt(prepTime, 10) : null,
        cook_time: cookTime ? parseInt(cookTime, 10) : null,
        ingredients: ingredients.map(ing => ({
          amount: ing.amount ? parseFloat(ing.amount) : null,
          unit: ing.unit || null,
          name: ing.name
        })),
        steps: steps.filter(s => s.trim())
      };

      const res = await api.updateRecipe(id, payload);
      if (res.error) {
        setError(res.error);
      } else {
        setIsEditing(false);
        loadRecipe();
      }
    } catch {
      setError('Tarif güncellenirken bir hata oluştu.');
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

  if (error && !isEditing) {
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

  // --- DÜZENLEME MODU ARAYÜZÜ ---
  if (isEditing) {
    return (
      <div className="fade-in" style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-navy)', marginBottom: 'var(--space-4)' }}>
          Tarifi Düzenle
        </h1>

        {error && (
          <div className="error-banner" style={{ marginBottom: 'var(--space-4)' }}>
            <span>⚠️</span> <span>{error}</span>
          </div>
        )}

        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="input-group">
            <label className="input-label">Tarif Başlığı</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
            <div className="input-group">
              <label className="input-label">Porsiyon</label>
              <input className="input" type="number" value={servings} onChange={e => setServings(e.target.value)} placeholder="—" />
            </div>
            <div className="input-group">
              <label className="input-label">Hazırlık (dk)</label>
              <input className="input" type="number" value={prepTime} onChange={e => setPrepTime(e.target.value)} placeholder="—" />
            </div>
            <div className="input-group">
              <label className="input-label">Pişirme (dk)</label>
              <input className="input" type="number" value={cookTime} onChange={e => setCookTime(e.target.value)} placeholder="—" />
            </div>
          </div>
        </div>

        {/* Malzemeler */}
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h2 className="card-title">🥕 Malzemeler</h2>
            <button className="btn btn-sm btn-secondary" onClick={() => setIngredients([...ingredients, { amount: '', unit: '', name: '' }])}>+ Ekle</button>
          </div>
          {ingredients.map((ing, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', alignItems: 'center' }}>
              <input
                className="input"
                style={{ width: 80 }}
                placeholder="Miktar"
                value={ing.amount || ''}
                onChange={e => {
                  const copy = [...ingredients];
                  copy[idx] = { ...copy[idx], amount: e.target.value };
                  setIngredients(copy);
                }}
              />
              <input
                className="input"
                style={{ width: 110 }}
                placeholder="Birim"
                value={ing.unit || ''}
                onChange={e => {
                  const copy = [...ingredients];
                  copy[idx] = { ...copy[idx], unit: e.target.value };
                  setIngredients(copy);
                }}
              />
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="Malzeme adı"
                value={ing.name || ''}
                onChange={e => {
                  const copy = [...ingredients];
                  copy[idx] = { ...copy[idx], name: e.target.value };
                  setIngredients(copy);
                }}
              />
              <button className="btn btn-sm btn-danger" onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))}>✕</button>
            </div>
          ))}
        </div>

        {/* Adımlar */}
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h2 className="card-title">📝 Yapılış Adımları</h2>
            <button className="btn btn-sm btn-secondary" onClick={() => setSteps([...steps, ''])}>+ Ekle</button>
          </div>
          {steps.map((step, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 600, color: 'var(--color-orange)', minWidth: 24, paddingTop: 10 }}>{idx + 1}.</span>
              <textarea
                className="input"
                style={{ flex: 1, minHeight: 60 }}
                value={step}
                onChange={e => {
                  const copy = [...steps];
                  copy[idx] = e.target.value;
                  setSteps(copy);
                }}
              />
              <button className="btn btn-sm btn-danger" onClick={() => setSteps(steps.filter((_, i) => i !== idx))} style={{ marginTop: 4 }}>✕</button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <button className="btn btn-lg btn-secondary" onClick={() => { setIsEditing(false); loadRecipe(); }}>İptal</button>
          <button className="btn btn-lg btn-primary" onClick={handleUpdate}>Değişiklikleri Kaydet</button>
        </div>
      </div>
    );
  }

  // --- GÖRÜNTÜLEME MODU ARAYÜZÜ ---
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
          <button className="btn btn-sm btn-secondary" onClick={() => setIsEditing(true)}>
            ✏️ Düzenle
          </button>
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
