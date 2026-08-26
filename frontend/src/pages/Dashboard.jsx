import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '../utils/api';

const POLL_INTERVAL = 2000; // 2 saniyede bir sorgula

const STEPS = [
  { key: 'fetching', label: 'İçerik alınıyor...' },
  { key: 'extracting', label: 'Tarif çıkarılıyor...' },
  { key: 'translating', label: 'Türkçe hazırlanıyor...' },
];

/**
 * Ana Sayfa — Link yapıştırma ve asenkron işleme durumu
 */
export default function Dashboard({ onRecipeReady, user }) {
  const [url, setUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [showTextFallback, setShowTextFallback] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [subStatus, setSubStatus] = useState(null);
  const [error, setError] = useState(null);
  const [errorClass, setErrorClass] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pollRef = useRef(null);
  const fileInputRef = useRef(null);

  // Polling mekanizması (FR-24)
  const startPolling = useCallback((id) => {
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.getJobStatus(id);
        setJobStatus(data.status);
        setSubStatus(data.sub_status);

        if (data.status === 'ready_for_review') {
          clearInterval(pollRef.current);
          onRecipeReady(data, id);
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current);
          setError(data.error_message || 'İşlem sırasında bir hata oluştu.');
          setErrorClass(data.error_class || 'system_error');
          setJobId(null);
          if (data.error_class === 'inaccessible') {
            setShowTextFallback(true);
          }
        } else if (data.status !== 'queued' && data.status !== 'processing') {
          // Tanımsız durum → jenerik "işleniyor" (FR-25)
          setSubStatus(null);
        }
      } catch (err) {
        // Ağ hatası durumunda polling devam eder
      }
    }, POLL_INTERVAL);
  }, [onRecipeReady]);

  // Component unmount'ta polling temizle
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setErrorClass(null);
    setIsSubmitting(true);

    // İzin verilen sosyal medya alan adları (FR-1)
    const allowedHosts = [
      'youtube.com', 'youtu.be',
      'instagram.com', 'tiktok.com',
      'yemek.com', 'nefisyemektarifleri.com',
      'lezzet.com.tr'
    ];

    try {
      // 1. URL biçim kontrolü
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch {
        setError('Lütfen geçerli bir link yapıştırın.');
        setErrorClass('invalid_input');
        setIsSubmitting(false);
        return;
      }

      // 2. Sunucuya gitmeden alan adı kontrolü (FR-1)
      const hostname = parsedUrl.hostname.toLowerCase();
      const isAllowed = allowedHosts.some(domain => 
        hostname === domain || hostname.endsWith('.' + domain)
      );

      if (!isAllowed) {
        setError('Bu site şu anda desteklenmiyor. Lütfen YouTube, Instagram, TikTok veya desteklenen yemek blogu linklerini kullanın.');
        setErrorClass('invalid_input');
        setIsSubmitting(false);
        return;
      }

      const result = await api.startImport(url);

      if (result.error_class) {
        setError(result.message);
        setErrorClass(result.error_class);
        setIsSubmitting(false);
        return;
      }

      // Mükerrer tarif bulunduysa (FR-4)
      if (result.status === 'completed' && result.recipeId) {
        window.location.href = `/recipes/${result.recipeId}`;
        return;
      }

      // Polling başlat
      setJobId(result.jobId);
      setJobStatus('queued');
      startPolling(result.jobId);
    } catch (err) {
      setError('Sunucuya bağlanılamadı. Lütfen backend\'in çalıştığından emin olun.');
      setErrorClass('system_error');
    }
    setIsSubmitting(false);
  };

  const handleTextSubmit = async (e) => {
    e.preventDefault();
    if (!rawText.trim()) return;
    setError(null);
    setErrorClass(null);
    setIsSubmitting(true);

    try {
      const result = await api.startImport(rawText, 'text');

      if (result.error_class) {
        setError(result.message);
        setErrorClass(result.error_class);
        setIsSubmitting(false);
        return;
      }

      setJobId(result.jobId);
      setJobStatus('queued');
      startPolling(result.jobId);
    } catch (err) {
      setError('Sunucuya bağlanılamadı. Lütfen backend\'in çalıştığından emin olun.');
      setErrorClass('system_error');
    }
    setIsSubmitting(false);
  };

  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Lütfen geçerli bir görsel dosyası seçin.');
      setErrorClass('invalid_input');
      return;
    }

    setError(null);
    setErrorClass(null);
    setIsSubmitting(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Str = event.target?.result;
      if (typeof base64Str !== 'string') {
        setError('Görsel okunurken bir hata oluştu.');
        setErrorClass('system_error');
        setIsSubmitting(false);
        return;
      }

      const commaIdx = base64Str.indexOf(',');
      const base64Data = base64Str.substring(commaIdx + 1);
      const mimeType = file.type;

      try {
        const result = await api.startImport({ base64: base64Data, mimeType }, 'image');

        if (result.error_class) {
          setError(result.message);
          setErrorClass(result.error_class);
          setIsSubmitting(false);
          return;
        }

        setJobId(result.jobId);
        setJobStatus('queued');
        startPolling(result.jobId);
      } catch (err) {
        setError('Sunucuya bağlanılamadı. Lütfen backend\'in çalıştığından emin olun.');
        setErrorClass('system_error');
        setIsSubmitting(false);
      }
    };
    reader.onerror = () => {
      setError('Dosya okunurken hata oluştu.');
      setErrorClass('system_error');
      setIsSubmitting(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRetry = () => {
    setError(null);
    setErrorClass(null);
    setJobId(null);
    setJobStatus(null);
    setSubStatus(null);
    setUrl('');
    setRawText('');
    setShowTextFallback(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Active step index hesaplama
  const getActiveStepIndex = () => {
    if (!subStatus) return -1;
    return STEPS.findIndex(s => s.key === subStatus);
  };

  return (
    <div className="fade-in">
      {/* Hero Section */}
      {!jobId && (
        <div className="hero-section slide-up">
          <h1 className="hero-title">
            {user ? (
              <>Bugün ne yiyelim, <span className="highlight">{user.username || user.email.split('@')[0]}</span>?</>
            ) : (
              <>Sosyal medyadaki <span className="highlight">tarifleri</span> topla</>
            )}
          </h1>
          <p className="hero-subtitle">
            Instagram, TikTok ve YouTube'daki yemek videolarını anında düzenlenebilir Türkçe tariflere dönüştür.
          </p>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {showTextFallback ? (
            <form onSubmit={handleTextSubmit} style={{ maxWidth: 600, margin: '1rem auto' }} className="slide-up">
              <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'left', background: 'rgba(255, 255, 255, 0.95)', border: '1px solid var(--color-orange-light)', borderRadius: 'var(--border-radius-lg)', boxShadow: 'var(--shadow-md)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-navy)', marginBottom: 'var(--space-1)' }}>
                  📝 Tarif Açıklamasını Yapıştırın veya Fotoğraf Yükleyin
                </h3>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                  Instagram güvenlik duvarı veya erişim engeli nedeniyle bu gönderiyi doğrudan okuyamadık. Gönderinin açıklama metnini yapıştırabilir veya ekran görüntüsünü (SS) yükleyebilirsiniz!
                </p>

                <div 
                  onClick={triggerFileSelect} 
                  style={{ border: '2px dashed var(--color-orange-light)', borderRadius: 'var(--border-radius-md)', padding: 'var(--space-4)', textAlign: 'center', marginBottom: 'var(--space-4)', background: 'rgba(255, 107, 107, 0.03)', cursor: 'pointer', transition: 'border-color 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-orange)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-orange-light)'}
                >
                  <span style={{ fontSize: 'var(--font-size-2xl)' }}>📸</span>
                  <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-navy)' }}>
                    Ekran görüntüsü (SS) yüklemek için tıklayın
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    (Instagram/TikTok gönderisinin açıklama görüntüsü)
                  </p>
                </div>

                <textarea
                  className="input"
                  style={{ minHeight: '150px', resize: 'vertical', width: '100%', marginBottom: 'var(--space-4)', padding: 'var(--space-3)', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-navy-light)' }}
                  placeholder="Gönderi altındaki yemek tarifi yazılarını buraya yapıştırın..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  disabled={isSubmitting}
                />
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={!rawText.trim() || isSubmitting}
                    style={{ flex: 1 }}
                  >
                    {isSubmitting ? '⏳ Tarif Çıkarılıyor...' : <>Tarifi Çıkar <span style={{ marginLeft: '4px' }}>✨</span></>}
                  </button>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={handleRetry}
                    disabled={isSubmitting}
                  >
                    Vazgeç
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit}>
                <div className="url-input-container">
                  <span className="url-input-icon">🔗</span>
                  <input
                    className="input"
                    type="text"
                    placeholder="Instagram, TikTok veya YouTube linkini yapıştır"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isSubmitting}
                    id="url-input"
                  />
                  <button
                    type="button"
                    onClick={triggerFileSelect}
                    title="Ekran Görüntüsü Yükle (SS)"
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 'var(--font-size-lg)',
                      cursor: 'pointer',
                      padding: '0 var(--space-2)',
                      display: 'flex',
                      alignItems: 'center',
                      color: 'var(--color-navy)',
                      transition: 'transform 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    ➕
                  </button>
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={!url.trim() || isSubmitting}
                    id="import-button"
                  >
                    {isSubmitting ? '⏳ Gönderiliyor...' : <>Tarifi Çıkar <span style={{ marginLeft: '4px' }}>✨</span></>}
                  </button>
                </div>
              </form>
              <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-4)', justifyContent: 'center' }}>
                <button 
                  type="button" 
                  onClick={() => setShowTextFallback(true)} 
                  style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-navy)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                >
                  Metin olarak yapıştır
                </button>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>|</span>
                <button 
                  type="button" 
                  onClick={triggerFileSelect} 
                  style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-navy)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                >
                  Ekran Görüntüsü yükle
                </button>
              </div>
            </>
          )}

          {/* Platform Badges (Screenshot 1) */}
          <div className="platform-badges">
            <span className="badge-item ig">
              <span className="badge-icon">📸</span> Instagram
            </span>
            <span className="badge-item tt">
              <span className="badge-icon">🎵</span> TikTok
            </span>
            <span className="badge-item yt">
              <span className="badge-icon">🎥</span> YouTube
            </span>
          </div>

          {/* Privacy Note (Screenshot 1) */}
          <p className="privacy-note">
            🔒 Tariflerin yalnızca sana görünür.
          </p>

          {error && (
            <div className="error-banner" style={{ maxWidth: 640, margin: '1rem auto 2rem' }}>
              <span>⚠️</span>
              <span style={{ marginRight: 'var(--space-4)' }}>{error}</span>
              <button className="btn btn-sm btn-secondary" onClick={handleRetry} style={{ marginLeft: 'auto' }}>
                {errorClass === 'system_error' ? '🔄 Tekrar Dene' : '✕ Temizle'}
              </button>
            </div>
          )}

          {/* 3 Adımda Çalışır Bilgilendirme Kartları (Screenshot 1) */}
          <div className="how-it-works">
            <h3 className="how-it-works-title">3 adımda çalışır</h3>
            <div className="steps-grid">
              <div className="step-card">
                <div className="step-number">1</div>
                <div className="step-icon-bg">🔗</div>
                <h4>Linki yapıştır</h4>
                <p>Instagram, TikTok veya YouTube linkini gir.</p>
              </div>
              <div className="step-card">
                <div className="step-number">2</div>
                <div className="step-icon-bg">📋</div>
                <h4>Kontrol et</h4>
                <p>Algılanan içerikleri düzenle ve eksikleri tamamla.</p>
              </div>
              <div className="step-card">
                <div className="step-number">3</div>
                <div className="step-icon-bg">🍲</div>
                <h4>Tarifine ekle</h4>
                <p>Tarifini kaydet, not ekle ve dilediğin gibi kullan.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Stepper */}
      {jobId && (
        <div className="slide-up" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-navy)', marginBottom: 'var(--space-2)' }}>
            Tarifin hazırlanıyor...
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
            Bu işlem birkaç saniye sürebilir. Lütfen bekle.
          </p>

          <div className="progress-container">
            {STEPS.map((step, index) => {
              const activeIdx = getActiveStepIndex();
              let state = 'pending';
              if (index < activeIdx) state = 'done';
              else if (index === activeIdx) state = 'active';

              return (
                <div key={step.key} className={`progress-step ${state}`}>
                  <div className="progress-step__icon">
                    {state === 'done' ? '✓' : index + 1}
                  </div>
                  <span className="progress-step__label">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
