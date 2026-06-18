import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { PostCard } from './HomePage';

export default function CategoryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [category, setCategory] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 9;

  useEffect(() => {
    loadCategory();
  }, [slug]);

  async function loadCategory() {
    setLoading(true);
    const { data: cat } = await supabase
      .from('categories').select('*').eq('slug', slug).single();
    if (!cat) { navigate('/'); return; }
    setCategory(cat);

    const { data: ps } = await supabase
      .from('posts')
      .select('*, profiles(display_name), categories(name,slug,icon)')
      .eq('status', 'published')
      .eq('category_id', cat.id)
      .order('published_at', { ascending: false })
      .range(0, PAGE_SIZE - 1);
    setPosts(ps || []);
    setLoading(false);
  }

  async function loadMore() {
    const nextPage = page + 1;
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(display_name), categories(name,slug,icon)')
      .eq('status', 'published')
      .eq('category_id', category.id)
      .order('published_at', { ascending: false })
      .range(nextPage * PAGE_SIZE, (nextPage + 1) * PAGE_SIZE - 1);
    if (data?.length) { setPosts(prev => [...prev, ...data]); setPage(nextPage); }
  }

  if (loading) return (
    <div className="loading-page"><div className="spinner"></div><span>טוען...</span></div>
  );

  return (
    <main className="page-content">
      <div className="container">
        <div style={{ marginBottom:'2rem' }}>
          <div style={{ fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:'0.75rem' }}>
            <Link to="/" style={{ color:'var(--text-muted)' }}>ראשי</Link> › {category?.name}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <span style={{ fontSize:'2.5rem' }}>{category?.icon}</span>
            <div>
              <h1 style={{ marginBottom:'0.25rem' }}>{category?.name}</h1>
              {category?.description && <p style={{ color:'var(--text-muted)', fontSize:'0.95rem' }}>{category.description}</p>}
            </div>
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">{category?.icon || '📰'}</span>
            <h3>אין פוסטים עדיין בקטגוריה זו</h3>
          </div>
        ) : (
          <>
            <div className="posts-grid">
              {posts.map(post => <PostCard key={post.id} post={post} />)}
            </div>
            {posts.length % PAGE_SIZE === 0 && (
              <div style={{ textAlign:'center', marginTop:'2rem' }}>
                <button className="btn btn-secondary" onClick={loadMore}>טען עוד פוסטים</button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
