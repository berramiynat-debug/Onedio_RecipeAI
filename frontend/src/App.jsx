import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import './index.css';
import Dashboard from './pages/Dashboard';
import ReviewEdit from './pages/ReviewEdit';
import Collection from './pages/Collection';
import RecipeDetail from './pages/RecipeDetail';

function AppContent() {
  const [reviewData, setReviewData] = useState(null);
  const [reviewJobId, setReviewJobId] = useState(null);
  const navigate = useNavigate();

  const handleRecipeReady = (jobData, jobId) => {
    setReviewData(jobData);
    setReviewJobId(jobId);
  };

  const handleRecipeSaved = (recipeId) => {
    setReviewData(null);
    setReviewJobId(null);
    navigate(`/recipes/${recipeId}`);
  };

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <NavLink to="/" className="app-header__logo">
          <img src="/logo.png" alt="Oneyiyo Logo" />
          <span className="app-header__title">Oneyi<span>yo</span></span>
        </NavLink>
        <nav className="app-header__nav">
          <NavLink
            to="/"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            🍳 Tarif Ekle
          </NavLink>
          <NavLink
            to="/collection"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            📚 Koleksiyonum
          </NavLink>
        </nav>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {reviewData ? (
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
