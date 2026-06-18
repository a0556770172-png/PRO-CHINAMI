import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatDate, getRoleBadge } from '../lib/utils';

export default function HomePage() {
  const [featuredPost, setFeaturedPost] = useState(null);
  const [categories, setCategories] = useState([]);
  const [postsByCategory, setPostsByCategory] = useState({});
  const [topCommenters, setTopCommenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    // Load categories
    const { data: cats } = await supabase
      .from('categories')
      .select('*')
      .eq('is_hidden', false)
      .order('sort_order');

    if (!cats) { setLoading(false); return; }
    setCategories(cats);

    // Load latest published post for hero
    const { data: hero } = await supabase
      .from('posts')
      .select('*, profiles(display_name), categories(name,slug,icon)')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1)
      .single();
    setFeaturedPost(hero);

    // Load 3 posts per category
    const byCategory = {};
    for (const cat of cats) {
      const { data: posts } = await supabase
        .from('posts')
        .select('*, profiles(display_name), categories(name,slug,icon)')
        .eq('status', 'published')
        .eq('category_id', cat.id)
        .order('published_at', { ascending: false })
        .limit(3);
      byCategory[cat.id] = posts || [];
    }
    setPostsByCategory(byCategory);

    // Top commenters by received likes
    const { data: top } = await supabase
      .from('profiles')
      .select('id, display_name, role, received_likes_count, login_days_count')
      .not('role', 'in', '(admin)')
      .order('received_likes_count', { ascending: false })
      .limit(5);
    setTopCommenters(top || []);

    setLoading(false);
  }

  if (loading) return (
    <div className="loading-page">
      <div className="spinner"></div>
      <span>טוען תוכן...</span>
    </div>
  );

  return (
    <main className="page-content">
      <div className="container">
        {/* Hero Post */}
        {featuredPost && (
          <div className="section">
            <div className="hero-post" onClick={() => navigate(`/post/${featuredPost.slug}`)}>
              {featuredPost.cover_image
                ? <img src={featuredPost.cover_image} alt={featuredPost.title} />
                : <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg, #1a0a0a, #0a0a1a)' }} />
              }
              <div className="hero-overlay" />
              <div className="hero-content">
                <div style={{ display:'flex', gap:'0.6rem', alignItems:'center', marginBottom:'0.8rem' }}>
                  {featuredPost.categories && (
                    <span className="badge badge-accent">
                      {featuredPost.categories.icon} {featuredPost.categories.name}
                    </span>
                  )}
                  <span style={{ color:'rgba(255,255,255,0.6)', fontSize:'0.82rem' }}>
                    🔥 מומלץ
                  </span>
                </div>
                <h1 className="hero-title">{featuredPost.title}</h1>
                <div style={{ marginTop:'0.8rem', color:'rgba(255,255,255,0.6)', fontSize:'0.85rem', display:'flex', gap:'1rem' }}>
                  <span>✍️ {featuredPost.profiles?.display_name}</span>
                  <span>📅 {formatDate(featuredPost.published_at)}</span>
                  <span>👁 {featuredPost.views_count} צפיות</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="page-with-sidebar">
          <div>
            {/* Posts by category */}
            {categories.map(cat => {
              const posts = postsByCategory[cat.id] || [];
              if (posts.length === 0) return null;
              return (
                <div key={cat.id} className="section">
                  <div className="section-header">
                    <h2 className="section-title">
                      {cat.icon} {cat.name}
                    </h2>
                    <Link to={`/category/${cat.slug}`} className="btn btn-ghost btn-sm">
                      כל הפוסטים ←
                    </Link>
                  </div>
                  <div className="posts-grid">
                    {posts.map(post => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                </div>
              );
            })}

            {categories.length === 0 && (
              <div className="empty-state">
                <span className="empty-state-icon">📰</span>
                <h3>אין תוכן עדיין</h3>
                <p>המנהל טרם הוסיף קטגוריות ופוסטים</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside>
            <div className="sidebar-widget">
              <div className="sidebar-widget-title">🏆 מגיבים מובילים השבוע</div>
              {topCommenters.length === 0 && (
                <p style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>אין נתונים עדיין</p>
              )}
              {topCommenters.map((u, i) => (
                <div key={u.id} style={{
                  display:'flex', alignItems:'center', gap:'0.6rem',
                  padding:'0.6rem 0',
                  borderBottom: i < topCommenters.length - 1 ? '1px solid var(--border)' : 'none'
                }}>
                  <span style={{ fontSize:'1.1rem', width:'24px', textAlign:'center', fontWeight:'800', color:'var(--text-muted)' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`}
                  </span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'0.9rem', fontWeight:'600' }}>{u.display_name}</div>
                    <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                      {getRoleBadgeText(u.role)} • ❤️ {u.received_likes_count}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="sidebar-widget">
              <div className="sidebar-widget-title">📊 הרמות באתר</div>
              {[
                { label:'משתמש חדש', req:'הרשמה', color:'#94a3b8', icon:'🌱' },
                { label:'מגיב מורשה', req:'5 כניסות + שעה גלישה', color:'#3b82f6', icon:'💬' },
                { label:'נאמן האתר', req:'20 כניסות + 10 לייקים', color:'#8b5cf6', icon:'⭐' },
                { label:'כתב', req:'על ידי מנהל', color:'#10b981', icon:'✍️' },
              ].map(r => (
                <div key={r.label} style={{ display:'flex', gap:'0.6rem', alignItems:'center', padding:'0.5rem 0', borderBottom:'1px solid var(--border)' }}>
                  <span>{r.icon}</span>
                  <div>
                    <div style={{ fontSize:'0.85rem', fontWeight:'600', color: r.color }}>{r.label}</div>
                    <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{r.req}</div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function getRoleBadgeText(role) {
  const map = { level1:'משתמש חדש', level2:'מגיב מורשה', level3:'נאמן האתר', writer:'כתב', admin:'מנהל' };
  return map[role] || role;
}

export function PostCard({ post }) {
  const navigate = useNavigate();
  return (
    <div className="card post-card" onClick={() => navigate(`/post/${post.slug}`)} style={{ cursor:'pointer' }}>
      <div className="post-card-cover">
        {post.cover_image
          ? <img src={post.cover_image} alt={post.title} />
          : <div className="post-card-cover-placeholder">{post.categories?.icon || '📰'}</div>
        }
      </div>
      <div className="post-card-body">
        <div className="post-card-meta">
          {post.categories && <span className="badge">{post.categories.icon} {post.categories.name}</span>}
          <span>📅 {formatDate(post.published_at || post.created_at)}</span>
        </div>
        <h3 className="post-card-title">{post.title}</h3>
        {post.excerpt && <p className="post-card-excerpt">{post.excerpt}</p>}
        <div className="post-card-footer">
          <span style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>
            ✍️ {post.profiles?.display_name || 'אנונימי'}
          </span>
          <div style={{ display:'flex', gap:'0.8rem', fontSize:'0.8rem', color:'var(--text-muted)' }}>
            <span>👁 {post.views_count}</span>
            <span>❤️ {post.likes_count}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
