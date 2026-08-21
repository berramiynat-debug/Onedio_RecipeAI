import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate, Navigate, useLocation } from 'react-router-dom';
import './index.css';
import Dashboard from './pages/Dashboard';
import ReviewEdit from './pages/ReviewEdit';
import Collection from './pages/Collection';
import RecipeDetail from './pages/RecipeDetail';
import Login from './pages/Login';
import Register from './pages/Register';

function AppContent() {
  const [reviewData, setReviewData] = useState(null);
  const [reviewJobId, setReviewJobId] = useState(null);
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Basic auth restore logic
    const token = localStorage.getItem('token');
    if (token) {
      // Decode token to get user info, or just trust token and make API call.
      // Here we do a simple decode since JWT is base64
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const payload = JSON.parse(jsonPayload);
        
        // Token süresi dolmuş mu kontrol et (exp claims)
        const currentTime = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < currentTime) {
          localStorage.removeItem('token');
          setUser(null);
        } else {
          setUser(payload);
        }
      } catch(e) {
        localStorage.removeItem('token');
      }
    }
    setLoadingAuth(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login');
  };

  const handleNavClick = (e, path) => {
    if (reviewData) {
      e.preventDefault();
      const confirmLeave = window.confirm("Kaydedilmemiş tarif düzenleme değişiklikleriniz var. Çıkmak istediğinizden emin misiniz?");
      if (confirmLeave) {
        setReviewData(null);
        setReviewJobId(null);
        navigate(path);
      }
    }
  };

  const handleRecipeReady = (jobData, jobId) => {
    setReviewData(jobData);
    setReviewJobId(jobId);
  };

  const handleRecipeSaved = (recipeId) => {
    setReviewData(null);
    setReviewJobId(null);
    navigate(`/recipes/${recipeId}`);
  };

  if (loadingAuth) return <div style={{padding: '2rem', textAlign: 'center'}}>Yükleniyor...</div>;

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <NavLink to="/" className="app-header__logo" onClick={(e) => handleNavClick(e, '/')}>
          <img src="/logo.png" alt="Oneyiyo Logo" />
          <span className="app-header__title">Oneyi<span>yo</span></span>
        </NavLink>
        
        <nav className="app-header__nav" style={{ alignItems: 'center' }}>
          <NavLink
            to="/"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={(e) => handleNavClick(e, '/')}
          >
            🍳 Tarif Çıkar
          </NavLink>
          
          <NavLink
            to="/collection"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={(e) => handleNavClick(e, '/collection')}
          >
            📚 Koleksiyonum
          </NavLink>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1rem', paddingLeft: '1rem', borderLeft: '1px solid var(--color-border-light)' }}>
            {user ? (
              <>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                  👤 {user.username || user.email}
                </span>
                <button onClick={handleLogout} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.75rem' }}>
                  Çıkış Yap
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.75rem' }}>
                  Giriş Yap
                </NavLink>
                <NavLink to="/register" className="btn btn-primary btn-sm" style={{ padding: '0.25rem 0.75rem' }}>
                  Kayıt Ol
                </NavLink>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {reviewData ? (
          <ReviewEdit
            jobData={reviewData}
            jobId={reviewJobId}
            user={user}
            onSaved={handleRecipeSaved}
            onCancel={() => {
              setReviewData(null);
              setReviewJobId(null);
            }}
          />
        ) : (
          <Routes>
            <Route path="/" element={<Dashboard onRecipeReady={handleRecipeReady} />} />
            <Route path="/login" element={<Login setAuth={setUser} />} />
            <Route path="/register" element={<Register />} />
            <Route path="/collection" element={user ? <Collection /> : <Navigate to="/login" replace />} />
            <Route path="/recipes/:id" element={user ? <RecipeDetail /> : <Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
