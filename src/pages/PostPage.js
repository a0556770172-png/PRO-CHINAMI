import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, timeAgo, getRoleBadge, EMOJIS } from '../lib/utils';

// ===== זיהוי לינק יוטיוב וחילוץ ה-ID =====
function getYouTubeId(url) {
  if (!url) return null;
  const pattern = /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/v\/|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(pattern);
  return match ? match[1] : null;
}

// ===== לוגיקת ספירת צפיות חכמה =====
// משתמש מחובר  → בדיקה + שמירה ב-DB (post_views), חסין לרענון וטאבים חדשים
// אורח (לא מחובר) → sessionStorage בלבד (לא ניתן לזהות)
async function recordView(postId, userId) {
  if (userId) {
    // בדוק אם המשתמש כבר צפה — INSERT עם ON CONFLICT DO NOTHING מחזיר affected=0
    const { error } = await supabase
      .from('post_views')
      .insert({ post_id: postId, user_id: userId })
      .select();

    // אם error.code === '23505' → כבר צפה → לא מוסיפים
    if (!error) {
      // הכנסה הצליחה — משתמש חדש, עדכן מונה
      await supabase.rpc('increment_post_views', { post_id: postId });
    }
    // אם error (כולל duplicate) — לא עושים כלום
  } else {
    // אורח — sessionStorage
    const key = `viewed_post_${postId}`;
    if (!sessionStorage.getItem(key)) {
      await supabase.rpc('increment_post_views', { post_id: postId });
      sessionStorage.setItem(key, '1');
    }
  }
}

export default function PostPage() {
  const { slug } = useParams();
  const { user, profile, canComment, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [likes, setLikes] = useState([]);
  const [myLike, setMyLike] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadPost = useCallback(async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles(id,display_name,role), categories(name,slug,icon)')
      .eq('slug', slug)
      .single();
    if (error || !data) { navigate('/'); return; }
    setPost(data);

    // ===== ספירת צפייה חכמה =====
    await recordView(data.id, user?.id ?? null);

    // טען את הצפיות העדכניות אחרי הספירה
    const { data: freshPost } = await supabase
      .from('posts')
      .select('views_count')
      .eq('id', data.id)
      .single();
    if (freshPost) setPost(prev => ({ ...prev, views_count: freshPost.views_count }));

    // Load comments
    const { data: comms } = await supabase
      .from('comments')
      .select('*, profiles(display_name, role), comment_likes(id, user_id)')
      .eq('post_id', data.id)
      .order('created_at', { ascending: true });
    setComments(comms || []);

    // Load likes
    const { data: postLikes } = await supabase
      .from('post_likes')
      .select('*')
      .eq('post_id', data.id);
    setLikes(postLikes || []);
    if (user) {
      const mine = (postLikes || []).find(l => l.user_id === user.id);
      setMyLike(mine || null);
    }
    setLoading(false);
  }, [slug, user, navigate]);

  useEffect(() => { loadPost(); }, [loadPost]);

  async function handleLike(emoji) {
    if (!user) { navigate('/auth'); return; }
    if (myLike) {
      await supabase.from('post_likes').delete().eq('id', myLike.id);
      setMyLike(null);
      setLikes(prev => prev.filter(l => l.id !== myLike.id));
    } else {
      const { data } = await supabase.from('post_likes')
        .insert({ post_id: post.id, user_id: user.id, emoji })
        .select().single();
      if (data) { setMyLike(data); setLikes(prev => [...prev, data]); }
    }
  }

  async function handleCommentLike(commentId) {
    if (!user) { navigate('/auth'); return; }
    const existing = comments.find(c => c.id === commentId)
      ?.comment_likes?.find(l => l.user_id === user.id);
    if (existing) {
      await supabase.from('comment_likes').delete().eq('id', existing.id);
    } else {
      await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: user.id });
    }
    const { data: comms } = await supabase
      .from('comments')
      .select('*, profiles(display_name, role), comment_likes(id, user_id)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    setComments(comms || []);
  }

  async function handleDeleteComment(commentId) {
    if (!window.confirm('למחוק את התגובה?')) return;
    await supabase.from('comments').delete().eq('id', commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
  }

  async function handleSubmitComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmitting(true);
    setError('');
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: post.id, author_id: user.id, content: newComment.trim() })
      .select('*, profiles(display_name, role), comment_likes(id, user_id)')
      .single();
    if (error) {
      setError('שגיאה בשמירת התגובה. ודא שיש לך הרשאה.');
    } else {
      setComments(prev => [...prev, data]);
      setNewComment('');
    }
    setSubmitting(false);
  }

  async function handleDeletePost() {
    if (!window.confirm('למחוק את הפוסט לצמיתות?')) return;
    await supabase.from('posts').delete().eq('id', post.id);
    navigate('/');
  }

  if (loading) return (
    <div className="loading-page"><div className="spinner"></div><span>טוען פוסט...</span></div>
  );
  if (!post) return null;

  const emojiCounts = {};
  EMOJIS.forEach(e => { emojiCounts[e.emoji] = likes.filter(l => l.emoji === e.emoji).length; });

  return (
    <main className="page-content">
      <div className="container">
        <div className="page-with-sidebar">
          <article className="post-article">
            {/* Breadcrumb */}
            <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginBottom:'1.5rem', fontSize:'0.85rem', color:'var(--text-muted)' }}>
              <Link to="/" style={{ color:'var(--text-muted)' }}>ראשי</Link>
              <span>›</span>
              {post.categories && (
                <><Link to={`/category/${post.categories.slug}`} style={{ color:'var(--text-muted)' }}>
                  {post.categories.icon} {post.categories.name}
                </Link><span>›</span></>
              )}
              <span style={{ color:'var(--text-secondary)' }}>{post.title}</span>
            </div>

            {/* Post Header */}
            <header className="post-header">
              {post.categories && (
                <span className="badge badge-accent" style={{ marginBottom:'1rem', display:'inline-flex' }}>
                  {post.categories.icon} {post.categories.name}
                </span>
              )}
              <h1 style={{ marginBottom:'1rem' }}>{post.title}</h1>
              <div style={{ display:'flex', gap:'1.2rem', flexWrap:'wrap', color:'var(--text-muted)', fontSize:'0.88rem', marginBottom:'1rem' }}>
                <Link to={`/user/${post.profiles?.id}`} style={{ color:'var(--text-muted)', textDecoration:'none' }}>✍️ {post.profiles?.display_name || 'אנונימי'}</Link>
                <span>📅 {formatDate(post.published_at || post.created_at)}</span>
                <span>👁 {post.views_count} צפיות</span>
                <span>💬 {comments.length} תגובות</span>
              </div>
              {post.tags?.length > 0 && (
                <div className="tags-list">
                  {post.tags.map(tag => <span key={tag} className="tag">#{tag}</span>)}
                </div>
              )}
              {post.cover_image && (
                <img src={post.cover_image} alt={post.title}
                  style={{ width:'100%', borderRadius:'var(--radius)', marginTop:'1.5rem', objectFit:'cover', maxHeight:'420px' }} />
              )}

              {/* וידאו */}
              {post.video_url && (
                <div className="post-video-wrapper">
                  {getYouTubeId(post.video_url) ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${getYouTubeId(post.video_url)}`}
                      style={{ width: '100%', height: '100%', border: 'none' }}
                      allowFullScreen
                      title={post.title}
                    />
                  ) : (
                    <video
                      src={post.video_url}
                      controls
                      preload="metadata"
                      playsInline
                    />
                  )}
                </div>
              )}

              {/* אודיו */}
              {post.audio_url && (
                <div className="post-audio-wrapper">
                  <span style={{ fontSize:'1.4rem' }}>🎵</span>
                  <audio src={post.audio_url} controls preload="metadata" />
                </div>
              )}
            </header>

            {/* Post Body */}
            <div className="post-body" dangerouslySetInnerHTML={{ __html: post.content }} />

            {/* Admin actions */}
            {isAdmin && (
              <div style={{ display:'flex', gap:'0.5rem', margin:'1.5rem 0', padding:'1rem', background:'var(--bg-card)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' }}>
                <span style={{ fontSize:'0.82rem', color:'var(--text-muted)', marginLeft:'auto' }}>פעולות מנהל:</span>
                <Link to={`/writer?edit=${post.id}`} className="btn btn-secondary btn-sm">✏️ עריכה</Link>
                <button className="btn btn-danger btn-sm" onClick={handleDeletePost}>🗑 מחיקה</button>
              </div>
            )}

            {/* Interaction bar */}
            <div className="interaction-bar">
              <span style={{ fontSize:'0.82rem', color:'var(--text-muted)', alignSelf:'center', marginLeft:'0.5rem' }}>תגובות:</span>
              {EMOJIS.map(({ emoji, label }) => (
                <button
                  key={emoji}
                  className={`emoji-btn ${myLike?.emoji === emoji ? 'active' : ''}`}
                  onClick={() => handleLike(emoji)}
                  title={label}
                >
                  {emoji}
                  {emojiCounts[emoji] > 0 && <span className="count">{emojiCounts[emoji]}</span>}
                </button>
              ))}
            </div>

            {/* Comments Section */}
            <section className="comments-section">
              <h3 style={{ marginBottom:'1.5rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                💬 תגובות <span style={{ fontSize:'0.9rem', color:'var(--text-muted)', fontWeight:400 }}>({comments.length})</span>
              </h3>

              {user && canComment ? (
                <form onSubmit={handleSubmitComment} style={{ marginBottom:'2rem' }}>
                  <div className="form-group" style={{ marginBottom:'0.75rem' }}>
                    <textarea
                      className="form-input"
                      placeholder="כתוב את תגובתך כאן..."
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      rows={3}
                      maxLength={1000}
                    />
                  </div>
                  {error && <div className="alert alert-error" style={{ marginBottom:'0.5rem' }}>{error}</div>}
                  <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || !newComment.trim()}>
                    {submitting ? <><div className="spinner" style={{ width:14, height:14 }}></div> שולח...</> : '💬 פרסם תגובה'}
                  </button>
                </form>
              ) : user ? (
                <div className="alert alert-info" style={{ marginBottom:'2rem' }}>
                  🔒 כדי לכתוב תגובות, המשך לגלוש ולצבור ניסיון באתר! (נדרשות 5 כניסות + שעה גלישה)
                </div>
              ) : (
                <div className="alert alert-info" style={{ marginBottom:'2rem' }}>
                  <Link to="/auth" style={{ color:'#3b82f6', fontWeight:600 }}>התחבר</Link> כדי לכתוב תגובות
                </div>
              )}

              {comments.length === 0 ? (
                <div className="empty-state" style={{ padding:'2rem' }}>
                  <span className="empty-state-icon">💬</span>
                  <p>אין תגובות עדיין. היה הראשון!</p>
                </div>
              ) : (
                comments.map(comment => {
                  const { label, color } = getRoleBadge(comment.profiles?.role);
                  const myCommentLike = comment.comment_likes?.find(l => l.user_id === user?.id);
                  const canDelete = isAdmin || (user?.id === comment.author_id &&
                    (profile?.role === 'level3' || isAdmin));
                  return (
                    <div key={comment.id} className="comment-item">
                      <div className="comment-avatar" style={{ background: color }}>
                        {(comment.profiles?.display_name || 'א')[0]}
                      </div>
                      <div className="comment-body">
                        <div className="comment-meta">
                          <span className="comment-author">{comment.profiles?.display_name}</span>
                          <span className="badge" style={{ color, borderColor: color + '40', background: color + '15', fontSize:'0.7rem' }}>
                            {label}
                          </span>
                          <span>{timeAgo(comment.created_at)}</span>
                        </div>
                        <p className="comment-text">{comment.content}</p>
                        <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.5rem', alignItems:'center' }}>
                          <button
                            className={`emoji-btn ${myCommentLike ? 'active' : ''}`}
                            style={{ padding:'0.25rem 0.6rem', fontSize:'0.8rem' }}
                            onClick={() => handleCommentLike(comment.id)}
                          >
                            ❤️ <span className="count">{comment.comment_likes?.length || 0}</span>
                          </button>
                          {canDelete && (
                            <button className="btn btn-danger btn-sm" style={{ padding:'0.2rem 0.5rem', fontSize:'0.75rem' }}
                              onClick={() => handleDeleteComment(comment.id)}>
                              🗑
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          </article>

          {/* Sidebar */}
          <aside>
            <div className="sidebar-widget">
              <div className="sidebar-widget-title">📌 פרטי הפוסט</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem', fontSize:'0.85rem', color:'var(--text-secondary)' }}>
                <div>✍️ <strong>כתב:</strong> {post.profiles?.display_name}</div>
                <div>📅 <strong>פורסם:</strong> {formatDate(post.published_at || post.created_at)}</div>
                <div>👁 <strong>צפיות:</strong> {post.views_count}</div>
                <div>❤️ <strong>לייקים:</strong> {likes.length}</div>
                <div>💬 <strong>תגובות:</strong> {comments.length}</div>
              </div>
            </div>
            {post.tags?.length > 0 && (
              <div className="sidebar-widget">
                <div className="sidebar-widget-title">🏷️ תגיות</div>
                <div className="tags-list">
                  {post.tags.map(tag => <span key={tag} className="tag">#{tag}</span>)}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
