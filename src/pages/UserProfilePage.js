import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getRoleBadge, formatDate } from '../lib/utils';

export default function UserProfilePage() {
  const { userId } = useParams();
  const { user, profile: myProfile } = useAuth();
  const navigate = useNavigate();
  const [targetProfile, setTargetProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [canChatResult, setCanChatResult] = useState(null);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  async function loadProfile() {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!data) { navigate('/'); return; }
    setTargetProfile(data);

    // טען פוסטים של המשתמש
    const { data: userPosts } = await supabase
      .from('posts')
      .select('id, title, slug, published_at, views_count')
      .eq('author_id', userId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(5);
    setPosts(userPosts || []);

    // בדוק הרשאת צ'אט אם מחובר
    if (user && data.id !== user.id) {
      const { data: canChat } = await supabase.rpc('can_chat', {
        sender_id: user.id,
        receiver_id: data.id,
      });
      setCanChatResult(canChat);
    }
    setLoading(false);
  }

  async function startChat() {
    if (!user) { navigate('/auth'); return; }
    setChatLoading(true);
    const { data: chatId, error } = await supabase.rpc('get_or_create_chat', {
      other_user_id: targetProfile.id,
    });
    setChatLoading(false);
    if (error || !chatId) {
      alert('שגיאה ביצירת הצ\'אט: ' + (error?.message || 'נסה שנית'));
      return;
    }
    navigate(`/chat/${chatId}`);
  }

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;
  if (!targetProfile) return null;

  const { label, color } = getRoleBadge(targetProfile.role);
  const isOwnProfile = user?.id === targetProfile.id;

  // בדיקה אם המשתמש הנוכחי כשיר בכלל לצ'אט
  const myRole = myProfile?.role;
  const myLikes = myProfile?.received_likes_count || 0;
  const iCanChat = myRole === 'admin' || myRole === 'writer' || myLikes >= 50;

  return (
    <main className="page-content">
      <div className="container" style={{ maxWidth: 680 }}>
        {/* כרטיס פרופיל */}
        <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', marginBottom: '1.5rem' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: color, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '2rem', fontWeight: 800, color: '#fff', flexShrink: 0
            }}>
              {(targetProfile.display_name || '?')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.4rem' }}>{targetProfile.display_name}</h2>
                <span className="badge" style={{ color, borderColor: color+'40', background: color+'15' }}>{label}</span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem', marginTop: '0.3rem' }}>
                חבר מאז {formatDate(targetProfile.created_at)}
              </div>
            </div>

            {/* כפתורי פעולה */}
            {isOwnProfile ? (
              <Link to="/profile" className="btn btn-secondary btn-sm">✏️ הפרופיל שלי</Link>
            ) : user ? (
              <div>
                {canChatResult === true ? (
                  <button className="btn btn-primary btn-sm" onClick={startChat} disabled={chatLoading}>
                    {chatLoading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> פותח...</> : '💬 שלח הודעה'}
                  </button>
                ) : canChatResult === false ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: 140 }}>
                    🔒 לא ניתן לשלוח הודעה
                    {iCanChat && <div style={{ fontSize: '0.72rem', marginTop: '0.2rem' }}>המשתמש אינו עומד בתנאי הצ'אט</div>}
                  </div>
                ) : !iCanChat ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: 160 }}>
                    🔒 צ'אט דורש 50 לייקים או תפקיד כתב
                  </div>
                ) : null}
              </div>
            ) : (
              <Link to="/auth" className="btn btn-secondary btn-sm">התחבר לשליחת הודעה</Link>
            )}
          </div>

          {/* סטטיסטיקות */}
          <div className="stats-row" style={{ padding: '1rem 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
            <div className="stat-item">
              <span className="stat-value">🗓 {targetProfile.login_days_count}</span>
              <span className="stat-label">ימי כניסה</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">❤️ {targetProfile.received_likes_count}</span>
              <span className="stat-label">לייקים</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">📝 {posts.length}</span>
              <span className="stat-label">פוסטים</span>
            </div>
          </div>
        </div>

        {/* פוסטים אחרונים */}
        {posts.length > 0 && (
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-muted)' }}>📝 פוסטים אחרונים</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {posts.map(p => (
                <Link key={p.id} to={`/post/${p.slug}`}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none' }}>
                  <span style={{ fontWeight: 600 }}>{p.title}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>👁 {p.views_count}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
