import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, ADMIN_CODE, ROLE_LABELS } from '../lib/supabase';
import { formatDate, getRoleBadge } from '../lib/utils';

export default function AdminPage() {
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [codeVerified, setCodeVerified] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [activeTab, setActiveTab] = useState('categories');

  // Category state
  const [categories, setCategories] = useState([]);
  const [catForm, setCatForm] = useState({ name:'', slug:'', description:'', icon:'📰' });
  const [catMsg, setCatMsg] = useState('');

  // Users state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Posts state
  const [allPosts, setAllPosts] = useState([]);

  useEffect(() => {
    if (!user || !isAdmin) { navigate('/'); return; }
  }, [user, isAdmin]);

  function verifyCode(e) {
    e.preventDefault();
    if (code === ADMIN_CODE) { setCodeVerified(true); loadAll(); }
    else { setCodeError('קוד אבטחה שגוי'); }
  }

  async function loadAll() {
    loadCategories();
    loadUsers();
    loadPosts();
  }

  async function loadCategories() {
    const { data } = await supabase.from('categories').select('*').order('sort_order');
    setCategories(data || []);
  }

  async function loadUsers() {
    setUsersLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending:false });
    setUsers(data || []);
    setUsersLoading(false);
  }

  async function loadPosts() {
    const { data } = await supabase
      .from('posts').select('*, profiles(display_name), categories(name,icon)')
      .order('created_at', { ascending:false });
    setAllPosts(data || []);
  }

  // ---- CATEGORIES ----
  async function handleAddCategory(e) {
    e.preventDefault();
    if (!catForm.name || !catForm.slug) { setCatMsg('שם ו-slug חובה'); return; }
    const { error } = await supabase.from('categories').insert({
      name: catForm.name, slug: catForm.slug.toLowerCase().replace(/\s+/g,'-'),
      description: catForm.description, icon: catForm.icon,
      sort_order: categories.length + 1
    });
    if (error) setCatMsg('שגיאה: ' + error.message);
    else { setCatMsg('קטגוריה נוספה!'); setCatForm({ name:'',slug:'',description:'',icon:'📰' }); loadCategories(); }
  }

  async function toggleCategoryHidden(cat) {
    await supabase.from('categories').update({ is_hidden: !cat.is_hidden }).eq('id', cat.id);
    loadCategories();
  }

  async function deleteCategory(id) {
    if (!window.confirm('למחוק קטגוריה זו? הפוסטים יישארו ללא קטגוריה')) return;
    await supabase.from('categories').delete().eq('id', id);
    loadCategories();
  }

  // ---- USERS ----
  async function changeUserRole(userId, newRole) {
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    loadUsers();
  }

  async function toggleUserBlock(userId, currentBlocked) {
    await supabase.from('profiles').update({ is_blocked: !currentBlocked }).eq('id', userId);
    loadUsers();
  }

  // ---- POSTS ----
  async function changePostStatus(postId, status) {
    const upd = { status };
    if (status === 'published') upd.published_at = new Date().toISOString();
    await supabase.from('posts').update(upd).eq('id', postId);
    loadPosts();
  }

  async function deletePost(id) {
    if (!window.confirm('למחוק פוסט?')) return;
    await supabase.from('posts').delete().eq('id', id);
    loadPosts();
  }

  async function runAutoUpgrade() {
    const { data } = await supabase.rpc('auto_upgrade_users');
    alert(data || 'הושלם');
    loadUsers();
  }

  if (!user || !isAdmin) return null;

  // Code verification screen
  if (!codeVerified) {
    return (
      <div className="auth-page">
        <div className="auth-box">
          <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
            <div style={{ fontSize:'3rem', marginBottom:'0.5rem' }}>🔐</div>
            <h2 style={{ marginBottom:'0.25rem' }}>פאנל ניהול</h2>
            <p style={{ color:'var(--text-muted)', fontSize:'0.9rem' }}>הזן קוד אבטחה לגישה</p>
          </div>
          <form onSubmit={verifyCode} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            <div className="form-group">
              <label className="form-label">קוד אבטחה</label>
              <input type="password" className="form-input" placeholder="הזן קוד"
                value={code} onChange={e => setCode(e.target.value)}
                style={{ textAlign:'center', letterSpacing:'0.3em', fontSize:'1.2rem' }} />
            </div>
            {codeError && <div className="alert alert-error">⚠️ {codeError}</div>}
            <button type="submit" className="btn btn-primary" style={{ justifyContent:'center' }}>
              🔑 כניסה לניהול
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <main className="page-content">
      <div className="container">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'2rem', flexWrap:'wrap', gap:'1rem' }}>
          <div>
            <h1 style={{ marginBottom:'0.25rem' }}>⚙️ פאנל ניהול</h1>
            <p style={{ color:'var(--text-muted)', fontSize:'0.9rem' }}>שליטה מלאה על האתר</p>
          </div>
          <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0.5rem 1rem', fontSize:'0.85rem', color:'var(--text-muted)' }}>
              👥 {users.length} משתמשים | 📝 {allPosts.length} פוסטים
            </div>
            <button className="btn btn-secondary btn-sm" onClick={runAutoUpgrade}>⚡ הרץ שדרוג אוטומטי</button>
          </div>
        </div>

        <div className="admin-tabs">
          {['categories','users','posts','pending'].map(t => (
            <button key={t} className={`admin-tab ${activeTab===t?'active':''}`} onClick={()=>setActiveTab(t)}>
              {t==='categories'?`📂 קטגוריות (${categories.length})`
               :t==='users'?`👥 משתמשים (${users.length})`
               :t==='posts'?`📝 כל הפוסטים (${allPosts.length})`
               :`⏳ ממתינים (${allPosts.filter(p=>p.status==='pending').length})`}
            </button>
          ))}
        </div>

        {/* CATEGORIES TAB */}
        {activeTab === 'categories' && (
          <div>
            {/* Add form */}
            <div className="card" style={{ padding:'1.5rem', marginBottom:'2rem' }}>
              <h3 style={{ marginBottom:'1rem' }}>➕ הוסף קטגוריה חדשה</h3>
              <form onSubmit={handleAddCategory} style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'0.75rem', alignItems:'end' }}>
                <div className="form-group">
                  <label className="form-label">שם</label>
                  <input className="form-input" placeholder="חדשות" value={catForm.name}
                    onChange={e=>setCatForm(f=>({...f,name:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Slug</label>
                  <input className="form-input" placeholder="news" value={catForm.slug}
                    onChange={e=>setCatForm(f=>({...f,slug:e.target.value.replace(/\s+/g,'-')}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">אייקון</label>
                  <input className="form-input" placeholder="📰" value={catForm.icon}
                    onChange={e=>setCatForm(f=>({...f,icon:e.target.value}))} style={{ textAlign:'center', fontSize:'1.3rem' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">תיאור</label>
                  <input className="form-input" placeholder="תיאור קצר" value={catForm.description}
                    onChange={e=>setCatForm(f=>({...f,description:e.target.value}))} />
                </div>
                <button type="submit" className="btn btn-primary">הוסף</button>
              </form>
              {catMsg && <div className="alert alert-success" style={{ marginTop:'0.75rem' }}>✅ {catMsg}</div>}
            </div>

            <table className="data-table">
              <thead><tr><th>אייקון</th><th>שם</th><th>Slug</th><th>תיאור</th><th>סטטוס</th><th>פעולות</th></tr></thead>
              <tbody>
                {categories.map(cat => (
                  <tr key={cat.id}>
                    <td style={{ fontSize:'1.5rem', textAlign:'center' }}>{cat.icon}</td>
                    <td style={{ fontWeight:600, color:'var(--text-primary)' }}>{cat.name}</td>
                    <td style={{ fontFamily:'monospace', fontSize:'0.82rem' }}>{cat.slug}</td>
                    <td>{cat.description || '—'}</td>
                    <td>
                      <span className={`badge ${cat.is_hidden?'badge-accent':'badge-green'}`}>
                        {cat.is_hidden?'🙈 מוסתר':'👁 פעיל'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:'0.4rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={()=>toggleCategoryHidden(cat)}>
                          {cat.is_hidden?'הצג':'הסתר'}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={()=>deleteCategory(cat.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div>
            {usersLoading ? <div className="loading-page"><div className="spinner"></div></div> : (
              <table className="data-table">
                <thead><tr><th>שם</th><th>מייל</th><th>דרגה</th><th>ימי כניסה</th><th>לייקים</th><th>חסום?</th><th>שנה דרגה</th><th>פעולות</th></tr></thead>
                <tbody>
                  {users.map(u => {
                    const { label, color } = getRoleBadge(u.role);
                    return (
                      <tr key={u.id} style={{ opacity: u.is_blocked ? 0.5 : 1 }}>
                        <td style={{ fontWeight:600, color:'var(--text-primary)' }}>{u.display_name}</td>
                        <td style={{ fontSize:'0.8rem' }}>{u.email}</td>
                        <td><span className="badge" style={{ color, borderColor:color+'40', background:color+'15' }}>{label}</span></td>
                        <td>🗓 {u.login_days_count}</td>
                        <td>❤️ {u.received_likes_count}</td>
                        <td>{u.is_blocked ? <span className="badge badge-accent">חסום</span> : '—'}</td>
                        <td>
                          <select value={u.role} onChange={e=>changeUserRole(u.id,e.target.value)}
                            className="form-input" style={{ padding:'0.25rem 0.5rem', fontSize:'0.8rem', width:130 }}>
                            {Object.entries(ROLE_LABELS).map(([v,l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button className={`btn btn-sm ${u.is_blocked?'btn-secondary':'btn-danger'}`}
                            onClick={()=>toggleUserBlock(u.id,u.is_blocked)}>
                            {u.is_blocked?'🔓 שחרר':'🔒 חסום'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* POSTS TAB */}
        {activeTab === 'posts' && (
          <PostsTable posts={allPosts} onStatusChange={changePostStatus} onDelete={deletePost} />
        )}

        {/* PENDING TAB */}
        {activeTab === 'pending' && (
          <PostsTable
            posts={allPosts.filter(p=>p.status==='pending')}
            onStatusChange={changePostStatus}
            onDelete={deletePost}
            isPending
          />
        )}
      </div>
    </main>
  );
}

function PostsTable({ posts, onStatusChange, onDelete, isPending }) {
  if (posts.length === 0) return (
    <div className="empty-state">
      <span className="empty-state-icon">📝</span>
      <h3>{isPending ? 'אין פוסטים הממתינים לאישור' : 'אין פוסטים'}</h3>
    </div>
  );
  return (
    <table className="data-table">
      <thead>
        <tr><th>כותרת</th><th>כתב</th><th>קטגוריה</th><th>סטטוס</th><th>צפיות</th><th>פעולות</th></tr>
      </thead>
      <tbody>
        {posts.map(p => (
          <tr key={p.id}>
            <td style={{ fontWeight:600, color:'var(--text-primary)', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.title}</td>
            <td style={{ fontSize:'0.85rem' }}>{p.profiles?.display_name || '—'}</td>
            <td>{p.categories?.icon} {p.categories?.name || '—'}</td>
            <td>
              <span className={`badge ${p.status==='published'?'badge-green':p.status==='pending'?'badge-accent':''}`}>
                {p.status==='published'?'✅ פורסם':p.status==='pending'?'⏳ ממתין':'📝 טיוטה'}
              </span>
            </td>
            <td>👁 {p.views_count}</td>
            <td>
              <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' }}>
                {p.status !== 'published' && (
                  <button className="btn btn-sm badge-green" style={{ background:'rgba(16,185,129,0.1)', color:'#10b981', border:'1px solid rgba(16,185,129,0.2)' }}
                    onClick={()=>onStatusChange(p.id,'published')}>✅ פרסם</button>
                )}
                {p.status === 'published' && (
                  <button className="btn btn-secondary btn-sm" onClick={()=>onStatusChange(p.id,'draft')}>↩ טיוטה</button>
                )}
                <button className="btn btn-danger btn-sm" onClick={()=>onDelete(p.id)}>🗑</button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
