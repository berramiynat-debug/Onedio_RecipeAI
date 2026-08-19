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
export default function Dashboard({ onRecipeReady }) {
  const [url, setUrl] = useState('');
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [subStatus, setSubStatus] = useState(null);
  const [error, setError] = useState(null);
  const [errorClass, setErrorClass] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pollRef = useRef(null);

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

  const handleRetry = () => {
    setError(null);
    setErrorClass(null);
    setJobId(null);
    setJobStatus(null);
    setSubStatus(null);
    setUrl('');
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
            Sosyal medyadaki <span className="highlight">tarifleri</span> topla
          </h1>
          <p className="hero-subtitle">
            Instagram, TikTok veya YouTube'dan bir yemek tarifi linki yapıştır.
            Yapay zeka tarifi çıkarsın, sen düzenle ve koleksiyonuna kaydet.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="url-input-container">
              <input
                className="input"
                type="text"
                placeholder="https://www.instagram.com/reel/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isSubmitting}
                id="url-input"
              />
              <button
                className="btn btn-primary"
                type="submit"
                disabled={!url.trim() || isSubmitting}
                id="import-button"
              >
                {isSubmitting ? '⏳ Gönderiliyor...' : '🍳 Tarifi Çıkar'}
              </button>
            </div>
          </form>

          {error && (
            <div className="error-banner" style={{ maxWidth: 640, margin: '1rem auto 0' }}>
              <span>⚠️</span>
              <span style={{ marginRight: 'var(--space-4)' }}>{error}</span>
              <button className="btn btn-sm btn-secondary" onClick={handleRetry} style={{ marginLeft: 'auto' }}>
                {errorClass === 'system_error' ? '🔄 Tekrar Dene' : '✕ Temizle'}
              </button>
            </div>
          )}
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
