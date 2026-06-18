import React, { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, ROLE_LABELS, ROLE_COLORS } from '../lib/supabase';

export default function Layout() {
  const { user, profile, signOut, isAdmin, isWriter } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [categories, setCategories] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    supabase.from('categories').select('*').eq('is_hidden', false).order('sort_order')
      .then(({ data }) => setCategories(data || []));
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <>
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="logo">
            <div className="logo-icon">⚔</div>
            חוד <span>החנית</span>
          </Link>

          <nav className="header-nav">
            <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>🏠 ראשי</Link>
            {categories.map(cat => (
              <Link
                key={cat.id}
                to={`/category/${cat.slug}`}
                className={`nav-link ${location.pathname === `/category/${cat.slug}` ? 'active' : ''}`}
              >
                {cat.icon} {cat.name}
              </Link>
            ))}
          </nav>

          <div className="header-actions">
            {user ? (
              <>
                {(isWriter || isAdmin) && (
                  <Link to="/writer" className="btn btn-secondary btn-sm">✏️ כתיבה</Link>
                )}
                {isAdmin && (
                  <Link to="/admin" className="btn btn-danger btn-sm">⚙️ ניהול</Link>
                )}
                <Link to="/profile" className="btn btn-ghost btn-sm" style={{ gap: '0.4rem' }}>
                  <span style={{ color: ROLE_COLORS[profile?.role] }}>●</span>
                  {profile?.display_name || 'פרופיל'}
                </Link>
                <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>יציאה</button>
              </>
            ) : (
              <>
                <Link to="/auth" className="btn btn-primary btn-sm">כניסה / הרשמה</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <Outlet />
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '2rem 0',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.85rem',
        marginTop: '2rem'
      }}>
        <div className="container">
          <p style={{ marginBottom: '0.5rem' }}>
            <strong style={{ color: 'var(--accent)' }}>⚔ חוד החנית</strong> — תוכן מעניין וכשר
          </p>
          <p>© {new Date().getFullYear()} כל הזכויות שמורות</p>
        </div>
      </footer>
    </>
  );
}
