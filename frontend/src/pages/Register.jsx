import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/api';

export default function Register({ setAuth }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api.register(username, email, password);
      if (data && data.token) {
        localStorage.setItem('token', data.token);
        if (setAuth) {
          setAuth(data.user);
        }
        navigate('/');
      } else {
        navigate('/login');
      }
    } catch (err) {
      setError(err.message || 'Kayıt olunamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card fade-in" style={{ maxWidth: '400px', margin: '4rem auto' }}>
      <div className="card-header">
        <h2 className="card-title">Kayıt Ol</h2>
      </div>
      
      {error && (
        <div className="error-banner" style={{ marginBottom: '1rem' }}>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="input-group">
          <label className="input-label" htmlFor="username">Kullanıcı Adı</label>
          <input
            id="username"
            type="text"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            placeholder="ör: ahmet123"
          />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="email">E-posta</label>
          <input
            id="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="ör: ahmet@example.com"
          />
        </div>
        
        <div className="input-group">
          <label className="input-label" htmlFor="password">Şifre (En az 6 karakter)</label>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ marginTop: '1rem' }}>
          {loading ? 'Kayıt olunuyor...' : 'Kayıt Ol'}
        </button>
      </form>
      <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
        Zaten hesabınız var mı? <Link to="/login">Giriş Yap</Link>
      </div>
    </div>
  );
}
