import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/api';

/**
 * Zorunlu düzenlenebilir önizleme ekranı (FR-15 — FR-18)
 */
export default function ReviewEdit({ jobData, jobId, user, onSaved, onCancel }) {
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const recipe = typeof jobData.recipe_data === 'string' 
    ? JSON.parse(jobData.recipe_data) 
    : jobData.recipe_data;

  const handleCancel = () => {
    if (edited) {
      const confirmCancel = window.confirm("Değişiklikleri kaydetmeden çıkmak istediğinizden emin misiniz?");
      if (!confirmCancel) return;
    }
    window.onbeforeunload = null;
    onCancel();
  };

  const [title, setTitle] = useState(recipe?.title || '');
  const [servings, setServings] = useState(recipe?.servings || '');
  const [prepTime, setPrepTime] = useState(recipe?.prep_time || '');
  const [cookTime, setCookTime] = useState(recipe?.cook_time || '');
  const [ingredients, setIngredients] = useState(
    recipe?.ingredients?.map((ing, i) => ({
      ...ing,
      id: i,
      amount: ing.amount ? parseFloat(ing.amount).toString() : ''
    })) || []
  );
  const [steps, setSteps] = useState(recipe?.steps || []);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [edited, setEdited] = useState(false);
  const [confidenceMap, setConfidenceMap] = useState(recipe?.confidence_map || {});

  // Sayfa kapatılırken uyarı (FR-18)
  if (typeof window !== 'undefined' && edited) {
    window.onbeforeunload = () => true;
  }

  const markEdited = (field) => {
    setEdited(true);
    if (field && confidenceMap[field] && confidenceMap[field] !== 'high') {
      setConfidenceMap(prev => ({ ...prev, [field]: 'high' }));
    }
  };

  // --- Malzeme İşlemleri ---
  const updateIngredient = (index, field, value) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
    markEdited('ingredients');
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { id: Date.now(), amount: '', unit: '', name: '' }]);
    markEdited('ingredients');
  };

  const removeIngredient = (index) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
    markEdited('ingredients');
  };

  // --- Adım İşlemleri ---
  const updateStep = (index, value) => {
    const updated = [...steps];
    updated[index] = value;
    setSteps(updated);
    markEdited('steps');
  };

  const addStep = () => {
    setSteps([...steps, '']);
    markEdited('steps');
  };

  const removeStep = (index) => {
    setSteps(steps.filter((_, i) => i !== index));
    markEdited('steps');
  };

  const moveStep = (from, to) => {
    if (to < 0 || to >= steps.length) return;
    const updated = [...steps];
    const [item] = updated.splice(from, 1);
    updated.splice(to, 0, item);
    setSteps(updated);
    markEdited('steps');
  };

  // --- Kaydetme ---
  const handleSave = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (!title.trim()) {
      setError('Tarif başlığı boş bırakılamaz.');
      return;
    }
    if (ingredients.length === 0) {
      setError('En az bir malzeme eklemelisiniz.');
      return;
    }
    if (steps.length === 0 || steps.every(s => !s.trim())) {
      setError('En az bir adım eklemelisiniz.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        jobId,
        title: title.trim(),
        servings: servings ? parseInt(servings, 10) : null,
        prep_time: prepTime ? parseInt(prepTime, 10) : null,
        cook_time: cookTime ? parseInt(cookTime, 10) : null,
        ingredients: ingredients.map(ing => ({
          amount: ing.amount ? parseFloat(ing.amount) : null,
          unit: ing.unit || null,
          name: ing.name,
        })),
        steps: steps.filter(s => s.trim()),
      };

      const result = await api.saveRecipe(payload);

      if (result.error) {
        setError(result.error);
        setIsSaving(false);
        return;
      }

      window.onbeforeunload = null;
      onSaved(result.recipeId);
    } catch (err) {
      setError('Kaydedilirken bir hata oluştu.');
      setIsSaving(false);
    }
  };

  const getConfidenceBadge = (field) => {
    const level = confidenceMap[field];
    if (!level || level === 'high') return null;
    return (
      <span className={`badge badge-${level}`} title={level === 'low' ? 'Kontrol et — yapay zekanın emin olamadığı alan' : 'Eksik — kaynakta bulunamadı'}>
        {level === 'low' ? '⚠️ Kontrol et' : '❓ Eksik'}
      </span>
    );
  };

  return (
    <div className="fade-in" style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Ziyaretçi Giriş/Kayıt Modal Popup */}
      {showAuthModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card fade-in" style={{ maxWidth: '440px', width: '90%', padding: '2rem', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>👨‍🍳</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-navy)', marginBottom: '0.75rem' }}>
              Koleksiyonuna Kaydet
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Yapay zekanın çıkardığı tarifleri kendi özel tarif koleksiyonunda saklamak ve istediğin zaman erişmek için ücretsiz hesap oluştur veya giriş yap.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                className="btn btn-primary btn-lg"
                onClick={() => { window.onbeforeunload = null; navigate('/login'); }}
              >
                Giriş Yap
              </button>
              <button 
                className="btn btn-secondary btn-lg"
                onClick={() => { window.onbeforeunload = null; navigate('/register'); }}
              >
                Ücretsiz Kayıt Ol
              </button>
              <button 
                onClick={() => setShowAuthModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: '0.875rem', cursor: 'pointer', marginTop: '0.5rem' }}
              >
                Vazgeç (Tarifi İncelemeye Devam Et)
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
            Tarifi Düzenle ve Onayla
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Yapay zekanın çıkardığı tarifi kontrol et, düzenle ve koleksiyonuna kaydet.
          </p>
        </div>
      </div>

      {/* Kaynak Atfı (FR-16 — düzenlenemez) */}
      <div className="card" style={{ marginBottom: 'var(--space-6)', background: 'var(--color-bg-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
          <span className="recipe-card__platform">{recipe?.platform || 'web'}</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>Kaynak: {recipe?.author || 'Bilinmeyen'}</span>
        </div>
      </div>

      {error && (
        <div className="error-banner" style={{ marginBottom: 'var(--space-4)' }}>
          <span>⚠️</span> <span>{error}</span>
        </div>
      )}

      {/* Başlık */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="input-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <label className="input-label">Tarif Başlığı</label>
            {getConfidenceBadge('title')}
          </div>
          <input className="input" value={title} onChange={e => { setTitle(e.target.value); markEdited('title'); }} id="review-title" />
        </div>

        <div className="recipe-meta-grid" style={{ marginTop: 'var(--space-4)' }}>
          <div className="input-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <label className="input-label">Porsiyon</label>
              {getConfidenceBadge('servings')}
            </div>
            <input className="input" type="number" value={servings} onChange={e => { setServings(e.target.value); markEdited('servings'); }} placeholder="—" id="review-servings" />
          </div>
          <div className="input-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <label className="input-label">Hazırlık (dk)</label>
              {getConfidenceBadge('prep_time')}
            </div>
            <input className="input" type="number" value={prepTime} onChange={e => { setPrepTime(e.target.value); markEdited('prep_time'); }} placeholder="—" id="review-prep-time" />
          </div>
          <div className="input-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <label className="input-label">Pişirme (dk)</label>
              {getConfidenceBadge('cook_time')}
            </div>
            <input className="input" type="number" value={cookTime} onChange={e => { setCookTime(e.target.value); markEdited('cook_time'); }} placeholder="—" id="review-cook-time" />
          </div>
        </div>
      </div>

      {/* Malzemeler (FR-15: miktar, birim, isim ayrı input) */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <h3 className="card-title">🥕 Malzemeler</h3>
            {getConfidenceBadge('ingredients')}
          </div>
          <button className="btn btn-sm btn-secondary" onClick={addIngredient}>+ Ekle</button>
        </div>

        {ingredients.map((ing, index) => (
          <div key={ing.id ?? index} className="ingredient-row">
            <input
              className="input ingredient-row__amount"
              placeholder="Miktar"
              value={ing.amount || ''}
              onChange={e => updateIngredient(index, 'amount', e.target.value)}
            />
            <input
              className="input ingredient-row__unit"
              placeholder="Birim"
              value={ing.unit || ''}
              onChange={e => updateIngredient(index, 'unit', e.target.value)}
            />
            <input
              className="input ingredient-row__name"
              placeholder="Malzeme adı"
              value={ing.name || ''}
              onChange={e => updateIngredient(index, 'name', e.target.value)}
            />
            <button className="btn btn-sm btn-danger ingredient-row__delete" onClick={() => removeIngredient(index)} title="Sil">✕</button>
          </div>
        ))}
      </div>

      {/* Adımlar (FR-15: sıralanabilir, eklenebilir, silinebilir) */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <h3 className="card-title">📝 Yapılış Adımları</h3>
            {getConfidenceBadge('steps')}
          </div>
          <button className="btn btn-sm btn-secondary" onClick={addStep}>+ Ekle</button>
        </div>

        {steps.map((step, index) => (
          <div key={index} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button className="btn btn-sm btn-secondary" onClick={() => moveStep(index, index - 1)} disabled={index === 0} title="Yukarı">↑</button>
              <button className="btn btn-sm btn-secondary" onClick={() => moveStep(index, index + 1)} disabled={index === steps.length - 1} title="Aşağı">↓</button>
            </div>
            <span style={{ fontWeight: 600, color: 'var(--color-orange)', minWidth: 24, paddingTop: 10 }}>{index + 1}.</span>
            <textarea
              className="input"
              style={{ flex: 1, minHeight: 60 }}
              value={step}
              onChange={e => updateStep(index, e.target.value)}
            />
            <button className="btn btn-sm btn-danger" onClick={() => removeStep(index)} title="Sil" style={{ marginTop: 4 }}>✕</button>
          </div>
        ))}
      </div>

      {/* Butonlar */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
        <button className="btn btn-lg btn-secondary" onClick={handleCancel} disabled={isSaving} id="cancel-recipe-button">
          ✕ İptal Et
        </button>
        <button className="btn btn-lg btn-primary" onClick={handleSave} disabled={isSaving} id="save-recipe-button">
          {isSaving ? '⏳ Kaydediliyor...' : '✅ Onayla ve Kaydet'}
        </button>
      </div>
    </div>
  );
}
