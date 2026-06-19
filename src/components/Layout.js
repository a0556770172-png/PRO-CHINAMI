import React, { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, ROLE_COLORS } from '../lib/supabase';

export default function Layout() {
  const { user, profile, signOut, isAdmin, isWriter } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [categories, setCategories] = useState([]);
  const [unreadChats, setUnreadChats] = useState(0);

  useEffect(() => {
    supabase.from('categories').select('*').eq('is_hidden', false).order('sort_order')
      .then(({ data }) => setCategories(data || []));
  }, []);

  // בדוק הודעות שלא נקראו
  useEffect(() => {
    if (!user) { setUnreadChats(0); return; }
    checkUnread();

    const interval = setInterval(checkUnread, 30000); // כל 30 שניות
    return () => clearInterval(interval);
  }, [user]);

  async function checkUnread() {
    if (!user) return;
    // קבל את כל השיחות של המשתמש
    const { data: chats } = await supabase
      .from('chats')
      .select('id')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

    if (!chats?.length) { setUnreadChats(0); return; }

    const chatIds = chats.map(c => c.id);
    const { count } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .in('chat_id', chatIds)
      .eq('is_read', false)
      .neq('sender_id', user.id);

    setUnreadChats(count || 0);
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const canUseChat = profile &&
    (profile.role === 'admin' || profile.role === 'writer' || (profile.received_likes_count || 0) >= 50);

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
                {canUseChat && (
                  <Link to="/chats" className="btn btn-ghost btn-sm" style={{ position: 'relative' }}>
                    💬
                    {unreadChats > 0 && (
                      <span style={{
                        position: 'absolute', top: -4, left: -4,
                        background: 'var(--accent)', color: '#fff',
                        borderRadius: '999px', padding: '0 5px',
                        fontSize: '0.65rem', fontWeight: 700, lineHeight: '16px',
                        minWidth: 16, textAlign: 'center'
                      }}>{unreadChats > 9 ? '9+' : unreadChats}</span>
                    )}
                  </Link>
                )}
                <Link to="/profile" className="btn btn-ghost btn-sm" style={{ gap: '0.4rem' }}>
                  <span style={{ color: ROLE_COLORS[profile?.role] }}>●</span>
                  {profile?.display_name || 'פרופיל'}
                </Link>
                <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>יציאה</button>
              </>
            ) : (
              <Link to="/auth" className="btn btn-primary btn-sm">כניסה / הרשמה</Link>
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
