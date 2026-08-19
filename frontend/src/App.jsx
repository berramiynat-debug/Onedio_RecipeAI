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
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
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

  const isAuthRoute = location.pathname === '/login' || location.pathname === '/register';

  if (!user && !isAuthRoute) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <NavLink to="/" className="app-header__logo" onClick={(e) => handleNavClick(e, '/')}>
          <img src="/logo.png" alt="Oneyiyo Logo" />
          <span className="app-header__title">Oneyi<span>yo</span></span>
        </NavLink>
        
        {user && (
          <nav className="app-header__nav" style={{ alignItems: 'center' }}>
            <NavLink
              to="/"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={(e) => handleNavClick(e, '/')}
            >
              🍳 Tarif Ekle
            </NavLink>
            <NavLink
              to="/collection"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={(e) => handleNavClick(e, '/collection')}
            >
              📚 Koleksiyonum
            </NavLink>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1rem', paddingLeft: '1rem', borderLeft: '1px solid var(--color-border-light)' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                👤 {user.username || user.email}
              </span>
              <button onClick={handleLogout} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.75rem' }}>
                Çıkış Yap
              </button>
            </div>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="app-main">
        {!user && isAuthRoute ? (
          <Routes>
            <Route path="/login" element={<Login setAuth={setUser} />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        ) : reviewData ? (
          <ReviewEdit
            jobData={reviewData}
            jobId={reviewJobId}
            onSaved={handleRecipeSaved}
            onCancel={() => {
              setReviewData(null);
              setReviewJobId(null);
            }}
          />
        ) : (
          <Routes>
            <Route path="/" element={<Dashboard onRecipeReady={handleRecipeReady} />} />
            <Route path="/collection" element={<Collection />} />
            <Route path="/recipes/:id" element={<RecipeDetail />} />
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
