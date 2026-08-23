import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function Profile({ user, setUser }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Form durumları
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getProfile();
      if (data.error) {
        setError(data.error);
      } else {
        setProfile(data);
        setUsername(data.username || '');
      }
    } catch (err) {
      setError(err.message || 'Profil bilgileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validasyonlar
    if (!username.trim() || username.trim().length < 3) {
      setError('Kullanıcı adı en az 3 karakter olmalıdır.');
      return;
    }

    const usernameRegex = /^[a-zA-Z0-9çğışöüÇĞİŞÖÜ\s_-]{3,50}$/u;
    if (!usernameRegex.test(username.trim())) {
      setError('Kullanıcı adı yalnızca harf, rakam, boşluk ve alt çizgi içerebilir.');
      return;
    }

    // Şifre güncelleniyorsa validasyonlar
    if (password) {
      if (password.length < 6) {
        setError('Yeni şifre en az 6 karakter olmalıdır.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Şifreler uyuşmuyor.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = { username: username.trim() };
      if (password) {
        payload.password = password;
      }

      const res = await api.updateProfile(payload);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(res.message || 'Profil başarıyla güncellendi.');
        // Token'ı güncelle ve App state'ini güncelle
        if (res.token) {
          localStorage.setItem('token', res.token);
        }
        if (res.user) {
          setUser(res.user);
        }
        // Şifre alanlarını temizle
        setPassword('');
        setConfirmPassword('');
        // Güncel profil nesnesini tekrar yükle
        loadProfile();
      }
    } catch (err) {
      setError(err.message || 'Profil güncellenirken bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const formatRegisterDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="empty-state fade-in">
        <div className="empty-state__icon">⏳</div>
        <p>Profil bilgileri yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ maxWidth: '640px', margin: '2rem auto' }}>
      <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-navy)', marginBottom: 'var(--space-6)' }}>
        ⚙️ Hesap Ayarlarım
      </h1>

      {success && (
        <div className="success-banner" style={{ 
          background: 'var(--color-success-bg)', 
          border: '1px solid #BBF7D0', 
          borderRadius: 'var(--radius-md)', 
          padding: 'var(--space-4)', 
          color: 'var(--color-success)', 
          marginBottom: 'var(--space-4)',
          fontSize: 'var(--font-size-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>✓</span>
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="error-banner" style={{ marginBottom: 'var(--space-4)' }}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        
        {/* Hesap Bilgileri Kartı (Salt-Okunur) */}
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-lg)' }}>
            👤 Hesap Bilgileri
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-light)', paddingBottom: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>E-posta Adresi</span>
              <span style={{ color: 'var(--color-navy)', fontWeight: 600 }}>{profile?.email}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-light)', paddingBottom: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Kayıt Tarihi</span>
              <span style={{ color: 'var(--color-navy)', fontWeight: 600 }}>{formatRegisterDate(profile?.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Profil Düzenleme Kartı */}
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-lg)' }}>
            ✏️ Bilgileri Güncelle
          </h2>
          
          <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            
            {/* Kullanıcı Adı */}
            <div className="input-group">
              <label className="input-label" htmlFor="username">Kullanıcı Adı (Rumuz)</label>
              <input
                id="username"
                type="text"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Rumuzunuzu yazın"
              />
            </div>

            <hr style={{ border: 'none', borderBottom: '1px solid var(--color-border-light)', margin: 'var(--space-2) 0' }} />
            
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-navy-light)' }}>
              🔑 Şifre Değiştir (İsteğe Bağlı)
            </h3>
            
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '-0.5rem' }}>
              Şifrenizi değiştirmek istemiyorsanız bu alanları boş bırakabilirsiniz.
            </p>

            {/* Yeni Şifre */}
            <div className="input-group">
              <label className="input-label" htmlFor="password">Yeni Şifre</label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="En az 6 karakter"
              />
            </div>

            {/* Yeni Şifre (Tekrar) */}
            <div className="input-group">
              <label className="input-label" htmlFor="confirmPassword">Yeni Şifre (Tekrar)</label>
              <input
                id="confirmPassword"
                type="password"
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Yeni şifrenizi tekrar yazın"
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary btn-lg btn-mobile-full" 
              disabled={saving} 
              style={{ marginTop: 'var(--space-4)' }}
            >
              {saving ? '⏳ Güncelleniyor...' : '✓ Bilgileri Güncelle'}
            </button>

          </form>
        </div>

      </div>
    </div>
  );
}
