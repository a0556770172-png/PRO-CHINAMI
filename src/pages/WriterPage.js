import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { slugify } from '../lib/utils';

export default function WriterPage() {
  const { user, profile, isWriter, isAdmin, canPost } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const [categories, setCategories] = useState([]);
  const [myPosts, setMyPosts] = useState([]);
  const [form, setForm] = useState({
    title: '', content: '', excerpt: '', cover_image: '',
    category_id: '', tags: '', status: isAdmin || isWriter ? 'published' : 'pending'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('write');

  useEffect(() => {
    if (!user || !canPost) { navigate('/'); return; }
    loadData();
  }, [user, canPost]);

  useEffect(() => {
    if (editId) loadPost(editId);
  }, [editId]);

  async function loadData() {
    const { data: cats } = await supabase.from('categories').select('*').eq('is_hidden', false).order('sort_order');
    setCategories(cats || []);
    const { data: posts } = await supabase
      .from('posts')
      .select('*, categories(name,icon)')
      .eq('author_id', user.id)
      .order('created_at', { ascending: false });
    setMyPosts(posts || []);
  }

  async function loadPost(id) {
    const { data } = await supabase.from('posts').select('*').eq('id', id).single();
    if (data) {
      setForm({
        title: data.title, content: data.content, excerpt: data.excerpt || '',
        cover_image: data.cover_image || '', category_id: data.category_id || '',
        tags: (data.tags || []).join(', '), status: data.status
      });
      setActiveTab('write');
    }
  }

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) { setError('נא למלא כותרת ותוכן'); return; }
    setLoading(true); setError(''); setSuccess('');

    const postData = {
      title: form.title.trim(),
      content: form.content,
      excerpt: form.excerpt.trim() || form.content.replace(/<[^>]+>/g,'').substring(0, 200),
      cover_image: form.cover_image.trim() || null,
      category_id: form.category_id || null,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      status: form.status,
      author_id: user.id,
      published_at: form.status === 'published' ? new Date().toISOString() : null,
    };

    if (editId) {
      const { error } = await supabase.from('posts').update(postData).eq('id', editId);
      if (error) setError('שגיאה בעדכון: ' + error.message);
      else { setSuccess('הפוסט עודכן בהצלחה!'); await loadData(); }
    } else {
      postData.slug = slugify(form.title);
      const { error } = await supabase.from('posts').insert(postData);
      if (error) setError('שגיאה בשמירה: ' + error.message);
      else {
        setSuccess(form.status === 'published' ? 'הפוסט פורסם בהצלחה!' : 'הפוסט נשמר ומחכה לאישור');
        setForm({ title:'', content:'', excerpt:'', cover_image:'', category_id:'', tags:'', status: isAdmin||isWriter?'published':'pending' });
        await loadData();
      }
    }
    setLoading(false);
  }

  async function handleDeletePost(id) {
    if (!window.confirm('למחוק?')) return;
    await supabase.from('posts').delete().eq('id', id);
    setMyPosts(prev => prev.filter(p => p.id !== id));
  }

  if (!user || !canPost) return null;

  return (
    <main className="page-content">
      <div className="container">
        <h1 style={{ marginBottom:'0.5rem' }}>✏️ {isWriter || isAdmin ? 'ניהול תוכן' : 'הצעת פוסט'}</h1>
        <p style={{ color:'var(--text-muted)', marginBottom:'2rem', fontSize:'0.9rem' }}>
          {profile?.role === 'level3' ? 'הפוסטים שלך יועברו לאישור כתב לפני פרסום' : 'כתב ופרסם תוכן לאתר'}
        </p>

        <div className="admin-tabs">
          {['write', 'myposts'].map(t => (
            <button key={t} className={`admin-tab ${activeTab === t ? 'active' : ''}`}
              onClick={() => setActiveTab(t)}>
              {t === 'write' ? (editId ? '✏️ עריכה' : '📝 כתיבה חדשה') : `📋 הפוסטים שלי (${myPosts.length})`}
            </button>
          ))}
        </div>

        {activeTab === 'write' && (
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'1.2rem', maxWidth:760 }}>
            <div className="form-group">
              <label className="form-label">כותרת *</label>
              <input name="title" className="form-input" placeholder="כותרת הפוסט"
                value={form.title} onChange={handleChange} style={{ fontSize:'1.1rem' }} />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
              <div className="form-group">
                <label className="form-label">קטגוריה</label>
                <select name="category_id" className="form-input" value={form.category_id} onChange={handleChange}>
                  <option value="">— בחר קטגוריה —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">סטטוס</label>
                <select name="status" className="form-input" value={form.status} onChange={handleChange}
                  disabled={profile?.role === 'level3'}>
                  {(isWriter || isAdmin) && <option value="published">✅ מפורסם</option>}
                  <option value="draft">📝 טיוטה</option>
                  {profile?.role === 'level3' && <option value="pending">⏳ ממתין לאישור</option>}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">תוכן הפוסט *</label>
              <textarea name="content" className="form-input" placeholder="כתוב כאן את תוכן הפוסט... (HTML נתמך)"
                value={form.content} onChange={handleChange} rows={12} />
              <span className="form-hint">ניתן להשתמש ב-HTML בסיסי: &lt;h2&gt;, &lt;p&gt;, &lt;strong&gt;, &lt;ul&gt;, &lt;li&gt;</span>
            </div>

            <div className="form-group">
              <label className="form-label">תקציר (אופציונלי)</label>
              <textarea name="excerpt" className="form-input" placeholder="תיאור קצר שיוצג בכרטיס הפוסט"
                value={form.excerpt} onChange={handleChange} rows={2} />
            </div>

            <div className="form-group">
              <label className="form-label">תמונת שער (URL)</label>
              <input name="cover_image" className="form-input" placeholder="https://..."
                value={form.cover_image} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label className="form-label">תגיות (מופרדות בפסיק)</label>
              <input name="tags" className="form-input" placeholder="חדשות, ישראל, טכנולוגיה"
                value={form.tags} onChange={handleChange} />
            </div>

            {error && <div className="alert alert-error">⚠️ {error}</div>}
            {success && <div className="alert alert-success">✅ {success}</div>}

            <div style={{ display:'flex', gap:'0.75rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <><div className="spinner" style={{ width:14, height:14 }}></div> שומר...</>
                  : editId ? '💾 עדכן פוסט' : '🚀 פרסם פוסט'}
              </button>
              {editId && (
                <button type="button" className="btn btn-ghost"
                  onClick={() => { navigate('/writer'); window.location.reload(); }}>
                  ← פוסט חדש
                </button>
              )}
            </div>
          </form>
        )}

        {activeTab === 'myposts' && (
          <div>
            {myPosts.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">📝</span>
                <h3>לא פרסמת פוסטים עדיין</h3>
                <button className="btn btn-primary" onClick={() => setActiveTab('write')}>כתוב פוסט ראשון</button>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>כותרת</th>
                    <th>קטגוריה</th>
                    <th>סטטוס</th>
                    <th>צפיות</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {myPosts.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight:600, color:'var(--text-primary)' }}>{p.title}</td>
                      <td>{p.categories?.icon} {p.categories?.name || '—'}</td>
                      <td>
                        <span className={`badge ${p.status==='published'?'badge-green':p.status==='draft'?'':'badge-accent'}`}>
                          {p.status==='published'?'✅ מפורסם':p.status==='draft'?'📝 טיוטה':'⏳ ממתין'}
                        </span>
                      </td>
                      <td>👁 {p.views_count}</td>
                      <td>
                        <div style={{ display:'flex', gap:'0.4rem' }}>
                          <button className="btn btn-secondary btn-sm"
                            onClick={() => { navigate(`/writer?edit=${p.id}`); setActiveTab('write'); }}>
                            ✏️
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeletePost(p.id)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
