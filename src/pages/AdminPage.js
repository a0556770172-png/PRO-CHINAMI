import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, ADMIN_CODE, ADMIN_EMAIL, ROLE_LABELS } from '../lib/supabase';
import { formatDate, getRoleBadge } from '../lib/utils';

const SUPER_ADMIN_EMAIL = ADMIN_EMAIL.toLowerCase();

export default function AdminPage() {
  const { user, profile, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [codeVerified, setCodeVerified] = useState(false);
  const [codeError, setCodeError] = useState('');

  const isSuperAdmin = user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL;

  const defaultTabs = ['categories', 'users', 'posts', 'pending'];
  const superTabs = [...defaultTabs, 'admins', 'site-control', 'impersonate'];
  const [activeTab, setActiveTab] = useState('categories');

  // Category state
  const [categories, setCategories] = useState([]);
  const [catForm, setCatForm] = useState({ name: '', slug: '', description: '', icon: '📰' });
  const [catMsg, setCatMsg] = useState('');

  // Users state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Posts state
  const [allPosts, setAllPosts] = useState([]);

  // Site control state
  const [siteSettings, setSiteSettings] = useState({ is_disabled: false, disabled_message: 'האתר מושבת זמנית לתחזוקה. נחזור בקרוב!' });
  const [siteMsg, setSiteMsg] = useState('');

  // Impersonate state
  const [impersonateUserId, setImpersonateUserId] = useState('');
  const [impersonateData, setImpersonateData] = useState(null);
  const [impersonateLoading, setImpersonateLoading] = useState(false);

  // Private messages (read-only oversight) state
  const [chatList, setChatList] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatMsgLoading, setChatMsgLoading] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [adminNoteMsg, setAdminNoteMsg] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) { navigate('/'); return; }
  }, [user, isAdmin, loading]);

  function verifyCode(e) {
    e.preventDefault();
    if (code === ADMIN_CODE) { setCodeVerified(true); loadAll(); }
    else { setCodeError('קוד אבטחה שגוי'); }
  }

  async function loadAll() {
    loadCategories();
    loadUsers();
    loadPosts();
    if (isSuperAdmin) { loadSiteSettings(); loadChatList(); }
  }

  async function loadCategories() {
    const { data } = await supabase.from('categories').select('*').order('sort_order');
    setCategories(data || []);
  }

  async function loadUsers() {
    setUsersLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers(data || []);
    setUsersLoading(false);
  }

  async function loadPosts() {
    const { data } = await supabase
      .from('posts').select('*, profiles(display_name), categories(name,icon)')
      .order('created_at', { ascending: false });
    setAllPosts(data || []);
  }

  async function loadSiteSettings() {
    const { data } = await supabase.from('site_settings').select('*');
    if (data && data.length > 0) {
      const settings = {};
      data.forEach(row => { settings[row.key] = row.value; });
      setSiteSettings({
        is_disabled: settings['is_disabled'] === 'true',
        disabled_message: settings['disabled_message'] || 'האתר מושבת זמנית לתחזוקה. נחזור בקרוב!'
      });
    }
  }

  // ---- CATEGORIES ----
  async function handleAddCategory(e) {
    e.preventDefault();
    if (!catForm.name || !catForm.slug) { setCatMsg('שם ו-slug חובה'); return; }
    const { error } = await supabase.from('categories').insert({
      name: catForm.name, slug: catForm.slug.toLowerCase().replace(/\s+/g, '-'),
      description: catForm.description, icon: catForm.icon,
      sort_order: categories.length + 1
    });
    if (error) setCatMsg('שגיאה: ' + error.message);
    else { setCatMsg('קטגוריה נוספה!'); setCatForm({ name: '', slug: '', description: '', icon: '📰' }); loadCategories(); }
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

  // ---- SUPER ADMIN: SITE CONTROL ----
  async function saveSetting(key, value) {
    await supabase.from('site_settings').upsert({ key, value: String(value) }, { onConflict: 'key' });
  }

  async function toggleSiteDisabled() {
    const newVal = !siteSettings.is_disabled;
    await saveSetting('is_disabled', newVal);
    await saveSetting('disabled_message', siteSettings.disabled_message);
    setSiteSettings(s => ({ ...s, is_disabled: newVal }));
    setSiteMsg(newVal ? '🔴 האתר הושבת בהצלחה' : '🟢 האתר הופעל בהצלחה');
    setTimeout(() => setSiteMsg(''), 3000);
  }

  async function saveDisabledMessage() {
    await saveSetting('disabled_message', siteSettings.disabled_message);
    setSiteMsg('✅ הודעה נשמרה');
    setTimeout(() => setSiteMsg(''), 2000);
  }

  // ---- SUPER ADMIN: ADMINS MANAGEMENT ----
  const adminUsers = users.filter(u => u.role === 'admin');

  async function blockAdmin(userId, currentBlocked) {
    // מניעת חסימה עצמית
    if (userId === user.id) { alert('אינך יכול לחסום את עצמך'); return; }
    await supabase.from('profiles').update({ is_blocked: !currentBlocked }).eq('id', userId);
    loadUsers();
  }

  async function grantAdmin(userId) {
    await supabase.from('profiles').update({ role: 'admin' }).eq('id', userId);
    loadUsers();
  }

  async function revokeAdmin(userId) {
    if (userId === user.id) { alert('אינך יכול להסיר את עצמך ממנהלים'); return; }
    if (!window.confirm('להסיר את הרשאות המנהל ממשתמש זה?')) return;
    await supabase.from('profiles').update({ role: 'level3' }).eq('id', userId);
    loadUsers();
  }

  // ---- SUPER ADMIN: IMPERSONATE ----
  async function loadUserData(uid) {
    if (!uid) return;
    setImpersonateLoading(true);
    setImpersonateData(null);
    const [{ data: prof }, { data: posts }, { data: comments }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('posts').select('*, categories(name,icon)').eq('author_id', uid).order('created_at', { ascending: false }),
      supabase.from('comments').select('*, posts(title)').eq('author_id', uid).order('created_at', { ascending: false }).limit(20)
    ]);
    setImpersonateData({ profile: prof, posts: posts || [], comments: comments || [] });
    setImpersonateLoading(false);
  }

  // ---- SUPER ADMIN: PRIVATE MESSAGES (read-only oversight) ----
  async function loadChatList() {
    const { data } = await supabase
      .from('chats')
      .select(`id, last_message_at,
        user_a_profile:profiles!chats_user_a_fkey(id, display_name, email),
        user_b_profile:profiles!chats_user_b_fkey(id, display_name, email)`)
      .order('last_message_at', { ascending: false });
    setChatList(data || []);
  }

  async function loadChatMessages(chatId) {
    setSelectedChatId(chatId);
    setAdminNoteMsg('');
    if (!chatId) { setChatMessages([]); return; }
    setChatMsgLoading(true);
    const { data } = await supabase
      .from('chat_messages')
      .select('*, sender:profiles!chat_messages_sender_id_fkey(display_name)')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    setChatMessages(data || []);
    setChatMsgLoading(false);
  }

  // הודעת מנהל גלויה וחתומה — לא בשם משתמש, מופיעה לשני הצדדים בשיחה
  async function sendAdminNote() {
    if (!adminNote.trim() || !selectedChatId) return;
    const { error } = await supabase.from('chat_messages').insert({
      chat_id: selectedChatId,
      sender_id: user.id,
      content: `⚠️ הודעת מנהל האתר: ${adminNote.trim()}`,
      is_read: false,
    });
    if (error) { setAdminNoteMsg('שגיאה: ' + error.message); return; }
    setAdminNote('');
    setAdminNoteMsg('✅ ההודעה נשלחה בשם המנהל וגלויה לשני הצדדים');
    loadChatMessages(selectedChatId);
  }

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;
  if (!user || !isAdmin) return null;

  // ---- CODE VERIFICATION SCREEN ----
  if (!codeVerified) {
    return (
      <div className="auth-page">
        <div className="auth-box">
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{isSuperAdmin ? '👑' : '🔐'}</div>
            <h2 style={{ marginBottom: '0.25rem' }}>פאנל ניהול</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {isSuperAdmin ? 'כניסת מנהל ראשי — הזן קוד אבטחה' : 'הזן קוד אבטחה לגישה'}
            </p>
          </div>
          <form onSubmit={verifyCode} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">קוד אבטחה</label>
              <input type="password" className="form-input" placeholder="הזן קוד"
                value={code} onChange={e => setCode(e.target.value)}
                style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.2rem' }} />
            </div>
            {codeError && <div className="alert alert-error">⚠️ {codeError}</div>}
            <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center' }}>
              {isSuperAdmin ? '👑 כניסת מנהל ראשי' : '🔑 כניסה לניהול'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const tabs = isSuperAdmin ? superTabs : defaultTabs;

  return (
    <main className="page-content">
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ marginBottom: '0.25rem' }}>
              {isSuperAdmin ? '👑 פאנל מנהל ראשי' : '⚙️ פאנל ניהול'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {isSuperAdmin ? 'שליטה מלאה ומורחבת על האתר' : 'שליטה מלאה על האתר'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {isSuperAdmin && siteSettings.is_disabled && (
              <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', borderRadius: 'var(--radius-sm)', padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#ef4444', fontWeight: 600 }}>
                🔴 האתר מושבת כעת
              </div>
            )}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              👥 {users.length} משתמשים | 📝 {allPosts.length} פוסטים
            </div>
            <button className="btn btn-secondary btn-sm" onClick={runAutoUpgrade}>⚡ שדרוג אוטומטי</button>
          </div>
        </div>

        <div className="admin-tabs" style={{ flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button key={t} className={`admin-tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
              {t === 'categories' ? `📂 קטגוריות (${categories.length})`
                : t === 'users' ? `👥 משתמשים (${users.length})`
                : t === 'posts' ? `📝 פוסטים (${allPosts.length})`
                : t === 'pending' ? `⏳ ממתינים (${allPosts.filter(p => p.status === 'pending').length})`
                : t === 'admins' ? `🛡 ניהול מנהלים (${adminUsers.length})`
                : t === 'site-control' ? `🔧 שליטת אתר`
                : `🕵️ צפייה כמשתמש`}
            </button>
          ))}
        </div>

        {/* ---- CATEGORIES TAB ---- */}
        {activeTab === 'categories' && (
          <div>
            <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>➕ הוסף קטגוריה חדשה</h3>
              <form onSubmit={handleAddCategory} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '0.75rem', alignItems: 'end' }}>
                <div className="form-group">
                  <label className="form-label">שם</label>
                  <input className="form-input" placeholder="חדשות" value={catForm.name}
                    onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Slug</label>
                  <input className="form-input" placeholder="news" value={catForm.slug}
                    onChange={e => setCatForm(f => ({ ...f, slug: e.target.value.replace(/\s+/g, '-') }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">אייקון</label>
                  <input className="form-input" placeholder="📰" value={catForm.icon}
                    onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))} style={{ textAlign: 'center', fontSize: '1.3rem' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">תיאור</label>
                  <input className="form-input" placeholder="תיאור קצר" value={catForm.description}
                    onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <button type="submit" className="btn btn-primary">הוסף</button>
              </form>
              {catMsg && <div className="alert alert-success" style={{ marginTop: '0.75rem' }}>✅ {catMsg}</div>}
            </div>
            <table className="data-table">
              <thead><tr><th>אייקון</th><th>שם</th><th>Slug</th><th>תיאור</th><th>סטטוס</th><th>פעולות</th></tr></thead>
              <tbody>
                {categories.map(cat => (
                  <tr key={cat.id}>
                    <td style={{ fontSize: '1.5rem', textAlign: 'center' }}>{cat.icon}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cat.name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{cat.slug}</td>
                    <td>{cat.description || '—'}</td>
                    <td><span className={`badge ${cat.is_hidden ? 'badge-accent' : 'badge-green'}`}>{cat.is_hidden ? '🙈 מוסתר' : '👁 פעיל'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => toggleCategoryHidden(cat)}>{cat.is_hidden ? 'הצג' : 'הסתר'}</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteCategory(cat.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ---- USERS TAB ---- */}
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
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.display_name}</td>
                        <td style={{ fontSize: '0.8rem' }}>{u.email}</td>
                        <td><span className="badge" style={{ color, borderColor: color + '40', background: color + '15' }}>{label}</span></td>
                        <td>🗓 {u.login_days_count}</td>
                        <td>❤️ {u.received_likes_count}</td>
                        <td>{u.is_blocked ? <span className="badge badge-accent">חסום</span> : '—'}</td>
                        <td>
                          <select value={u.role} onChange={e => changeUserRole(u.id, e.target.value)}
                            className="form-input" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', width: 130 }}>
                            {Object.entries(ROLE_LABELS).map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button className={`btn btn-sm ${u.is_blocked ? 'btn-secondary' : 'btn-danger'}`}
                            onClick={() => toggleUserBlock(u.id, u.is_blocked)}>
                            {u.is_blocked ? '🔓 שחרר' : '🔒 חסום'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* ---- SUPER ADMIN: צפייה בטאצים (משולב כאן, לא כטאב נפרד) ---- */}
            {isSuperAdmin && (
              <div className="card" style={{ padding: '1.5rem', marginTop: '2rem' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>📨 טאצים — צפייה והגבה</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  לבדיקת עמידה בחוקי האתר בלבד. בחר שיחה לצפייה בתוכן.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                  <select className="form-input" style={{ flex: 1, minWidth: 260 }}
                    value={selectedChatId}
                    onChange={e => loadChatMessages(e.target.value)}>
                    <option value="">-- בחר שיחה ({chatList.length} שיחות) --</option>
                    {chatList.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.user_a_profile?.display_name} ↔ {c.user_b_profile?.display_name}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn-secondary btn-sm" onClick={loadChatList}>🔄 רענן רשימה</button>
                </div>

                {chatMsgLoading && <div className="loading-page"><div className="spinner"></div></div>}

                {!chatMsgLoading && selectedChatId && (
                  chatMessages.length === 0
                    ? <p style={{ color: 'var(--text-muted)' }}>אין הודעות בשיחה זו</p>
                    : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: 400, overflowY: 'auto', marginBottom: '1.5rem' }}>
                        {chatMessages.map(m => (
                          <div key={m.id} style={{
                            background: m.content?.startsWith('⚠️ הודעת מנהל') ? 'rgba(239,68,68,0.1)' : 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-sm)', padding: '0.6rem 1rem',
                            border: `1px solid ${m.content?.startsWith('⚠️ הודעת מנהל') ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`
                          }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                              <strong>{m.sender?.display_name || '—'}</strong> · {new Date(m.created_at).toLocaleString('he-IL')}
                            </div>
                            <div style={{ color: 'var(--text-primary)' }}>{m.content}</div>
                          </div>
                        ))}
                      </div>
                    )
                )}

                {selectedChatId && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      שלח הודעת מנהל גלויה (חתומה, נראית לשני הצדדים)
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <input className="form-input" style={{ flex: 1 }}
                        placeholder="תוכן ההודעה..."
                        value={adminNote}
                        onChange={e => setAdminNote(e.target.value)} />
                      <button className="btn btn-primary" onClick={sendAdminNote} disabled={!adminNote.trim()}>
                        📨 שלח
                      </button>
                    </div>
                    {adminNoteMsg && <div className="alert alert-success" style={{ marginTop: '0.75rem' }}>{adminNoteMsg}</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---- POSTS TAB ---- */}
        {activeTab === 'posts' && (
          <PostsTable posts={allPosts} onStatusChange={changePostStatus} onDelete={deletePost} />
        )}

        {/* ---- PENDING TAB ---- */}
        {activeTab === 'pending' && (
          <PostsTable posts={allPosts.filter(p => p.status === 'pending')} onStatusChange={changePostStatus} onDelete={deletePost} isPending />
        )}

        {/* ======================================== */}
        {/* ---- SUPER ADMIN TABS BELOW ---- */}
        {/* ======================================== */}

        {/* ---- ADMINS TAB (super admin only) ---- */}
        {activeTab === 'admins' && isSuperAdmin && (
          <div>
            <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem', borderColor: 'rgba(239,68,68,0.3)' }}>
              <h3 style={{ marginBottom: '1rem', color: '#ef4444' }}>🛡 ניהול מנהלים</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                כמנהל ראשי, באפשרותך לחסום מנהלים אחרים, להוסיף מנהלים חדשים, או לבטל הרשאות מנהל.
              </p>

              {/* רשימת מנהלים קיימים */}
              <h4 style={{ marginBottom: '1rem' }}>מנהלים פעילים ({adminUsers.length})</h4>
              <table className="data-table" style={{ marginBottom: '2rem' }}>
                <thead><tr><th>שם</th><th>מייל</th><th>סטטוס</th><th>פעולות</th></tr></thead>
                <tbody>
                  {adminUsers.map(u => (
                    <tr key={u.id} style={{ opacity: u.is_blocked ? 0.5 : 1 }}>
                      <td style={{ fontWeight: 600 }}>
                        {u.display_name}
                        {u.email?.toLowerCase() === SUPER_ADMIN_EMAIL && (
                          <span style={{ marginRight: '0.5rem', fontSize: '0.75rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '0.1rem 0.4rem', borderRadius: 4 }}>מנהל ראשי</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{u.email}</td>
                      <td>
                        {u.is_blocked
                          ? <span className="badge badge-accent">🔒 חסום</span>
                          : <span className="badge badge-green">✅ פעיל</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {u.email?.toLowerCase() !== SUPER_ADMIN_EMAIL && (
                            <>
                              <button className={`btn btn-sm ${u.is_blocked ? 'btn-secondary' : 'btn-danger'}`}
                                onClick={() => blockAdmin(u.id, u.is_blocked)}>
                                {u.is_blocked ? '🔓 בטל חסימה' : '🔒 חסום'}
                              </button>
                              <button className="btn btn-sm btn-secondary"
                                onClick={() => revokeAdmin(u.id)}>
                                ❌ הסר מנהל
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* הוספת מנהל חדש */}
              <h4 style={{ marginBottom: '1rem' }}>➕ הוסף מנהל חדש</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                בחר משתמש קיים ושנה את דרגתו למנהל:
              </p>
              <table className="data-table">
                <thead><tr><th>שם</th><th>מייל</th><th>דרגה</th><th>הוסף כמנהל</th></tr></thead>
                <tbody>
                  {users.filter(u => u.role !== 'admin').map(u => {
                    const { label, color } = getRoleBadge(u.role);
                    return (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 600 }}>{u.display_name}</td>
                        <td style={{ fontSize: '0.85rem' }}>{u.email}</td>
                        <td><span className="badge" style={{ color, borderColor: color + '40', background: color + '15' }}>{label}</span></td>
                        <td>
                          <button className="btn btn-sm btn-primary" onClick={() => { if (window.confirm(`להפוך את ${u.display_name} למנהל?`)) grantAdmin(u.id); }}>
                            👑 מנה כמנהל
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---- SITE CONTROL TAB (super admin only) ---- */}
        {activeTab === 'site-control' && isSuperAdmin && (
          <div>
            <div className="card" style={{ padding: '2rem', marginBottom: '2rem', borderColor: siteSettings.is_disabled ? 'rgba(239,68,68,0.4)' : 'var(--border)' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>🔧 שליטה על זמינות האתר</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                השבתת האתר תציג למשתמשים דף "האתר מושבת". כניסה לניהול תהיה אפשרית רק דרך קוד.
              </p>

              {/* מצב נוכחי */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.5rem', background: siteSettings.is_disabled ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', borderRadius: 'var(--radius)', marginBottom: '2rem', border: `1px solid ${siteSettings.is_disabled ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
                <div style={{ fontSize: '3rem' }}>{siteSettings.is_disabled ? '🔴' : '🟢'}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: siteSettings.is_disabled ? '#ef4444' : '#10b981' }}>
                    {siteSettings.is_disabled ? 'האתר מושבת כעת' : 'האתר פעיל כעת'}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    {siteSettings.is_disabled ? 'משתמשים רואים דף השבתה' : 'כל המשתמשים יכולים לגשת לאתר'}
                  </div>
                </div>
                <button
                  className={`btn btn-sm ${siteSettings.is_disabled ? 'btn-primary' : 'btn-danger'}`}
                  style={{ marginRight: 'auto' }}
                  onClick={toggleSiteDisabled}>
                  {siteSettings.is_disabled ? '🟢 הפעל את האתר' : '🔴 השבת את האתר'}
                </button>
              </div>

              {/* הודעת השבתה */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>הודעה שתוצג למשתמשים בזמן השבתה</label>
                <textarea
                  className="form-input"
                  value={siteSettings.disabled_message}
                  onChange={e => setSiteSettings(s => ({ ...s, disabled_message: e.target.value }))}
                  rows={3}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="האתר מושבת זמנית לתחזוקה. נחזור בקרוב!" />
              </div>
              <button className="btn btn-secondary" onClick={saveDisabledMessage}>💾 שמור הודעה</button>
              {siteMsg && <div className="alert alert-success" style={{ marginTop: '1rem' }}>{siteMsg}</div>}

              {/* תצוגה מקדימה של דף ההשבתה */}
              <div style={{ marginTop: '2rem' }}>
                <h4 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>תצוגה מקדימה של דף ההשבתה:</h4>
                <div style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius)', padding: '3rem 2rem', textAlign: 'center', background: 'var(--bg-secondary)' }}>
                  <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔧</div>
                  <h2 style={{ marginBottom: '1rem' }}>האתר מושבת זמנית</h2>
                  <p style={{ color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto' }}>{siteSettings.disabled_message}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '1.5rem' }}>
                    👑 <em>מנהל? <a href="/admin" style={{ color: 'var(--accent)' }}>כנס דרך פאנל הניהול</a></em>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---- IMPERSONATE TAB (super admin only) ---- */}
        {activeTab === 'impersonate' && isSuperAdmin && (
          <div>
            <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>🕵️ צפייה כמשתמש</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                בחר משתמש כדי לצפות בפרופיל שלו, הפוסטים שלו והתגובות שלו — לבדיקת תקינות בלבד.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <select
                  className="form-input"
                  style={{ flex: 1, minWidth: 220 }}
                  value={impersonateUserId}
                  onChange={e => setImpersonateUserId(e.target.value)}>
                  <option value="">-- בחר משתמש --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.display_name} ({u.email})</option>
                  ))}
                </select>
                <button className="btn btn-primary" onClick={() => loadUserData(impersonateUserId)} disabled={!impersonateUserId}>
                  🔍 טען נתונים
                </button>
              </div>

              {impersonateLoading && <div className="loading-page"><div className="spinner"></div></div>}

              {impersonateData && !impersonateLoading && (
                <div>
                  {/* פרופיל */}
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid var(--border)' }}>
                    <h4 style={{ marginBottom: '1rem', color: 'var(--accent)' }}>👤 פרופיל משתמש</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '1rem' }}>
                      {[
                        ['שם', impersonateData.profile?.display_name],
                        ['מייל', impersonateData.profile?.email],
                        ['דרגה', ROLE_LABELS[impersonateData.profile?.role] || impersonateData.profile?.role],
                        ['ימי כניסה', impersonateData.profile?.login_days_count],
                        ['דקות פעילות', impersonateData.profile?.total_active_minutes],
                        ['לייקים שקיבל', impersonateData.profile?.received_likes_count],
                        ['חסום', impersonateData.profile?.is_blocked ? '🔒 כן' : '✅ לא'],
                        ['נרשם', impersonateData.profile?.created_at ? new Date(impersonateData.profile.created_at).toLocaleDateString('he-IL') : '—'],
                      ].map(([k, v]) => (
                        <div key={k} style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '0.75rem 1rem' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{k}</div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v ?? '—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* פוסטים */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ marginBottom: '1rem' }}>📝 פוסטים ({impersonateData.posts.length})</h4>
                    {impersonateData.posts.length === 0
                      ? <p style={{ color: 'var(--text-muted)' }}>אין פוסטים</p>
                      : (
                        <table className="data-table">
                          <thead><tr><th>כותרת</th><th>קטגוריה</th><th>סטטוס</th><th>צפיות</th><th>תאריך</th></tr></thead>
                          <tbody>
                            {impersonateData.posts.map(p => (
                              <tr key={p.id}>
                                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.title}</td>
                                <td>{p.categories?.icon} {p.categories?.name || '—'}</td>
                                <td><span className={`badge ${p.status === 'published' ? 'badge-green' : 'badge-accent'}`}>{p.status}</span></td>
                                <td>👁 {p.views_count}</td>
                                <td style={{ fontSize: '0.8rem' }}>{new Date(p.created_at).toLocaleDateString('he-IL')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                  </div>

                  {/* תגובות */}
                  <div>
                    <h4 style={{ marginBottom: '1rem' }}>💬 תגובות אחרונות ({impersonateData.comments.length})</h4>
                    {impersonateData.comments.length === 0
                      ? <p style={{ color: 'var(--text-muted)' }}>אין תגובות</p>
                      : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {impersonateData.comments.map(c => (
                            <div key={c.id} style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', border: '1px solid var(--border)' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                                בפוסט: <strong>{c.posts?.title || '—'}</strong> · {new Date(c.created_at).toLocaleDateString('he-IL')}
                              </div>
                              <div style={{ color: 'var(--text-primary)' }}>{c.content}</div>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
          </div>
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
            <td style={{ fontWeight: 600, color: 'var(--text-primary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</td>
            <td style={{ fontSize: '0.85rem' }}>{p.profiles?.display_name || '—'}</td>
            <td>{p.categories?.icon} {p.categories?.name || '—'}</td>
            <td>
              <span className={`badge ${p.status === 'published' ? 'badge-green' : p.status === 'pending' ? 'badge-accent' : ''}`}>
                {p.status === 'published' ? '✅ פורסם' : p.status === 'pending' ? '⏳ ממתין' : '📝 טיוטה'}
              </span>
            </td>
            <td>👁 {p.views_count}</td>
            <td>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {p.status !== 'published' && (
                  <button className="btn btn-sm badge-green" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}
                    onClick={() => onStatusChange(p.id, 'published')}>✅ פרסם</button>
                )}
                {p.status === 'published' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => onStatusChange(p.id, 'draft')}>↩ טיוטה</button>
                )}
                <button className="btn btn-danger btn-sm" onClick={() => onDelete(p.id)}>🗑</button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
