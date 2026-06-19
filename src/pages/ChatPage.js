import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { timeAgo, getRoleBadge } from '../lib/utils';

// =============================================
// הגדרות
// =============================================
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/gif': 'image', 'image/webp': 'image',
  'video/mp4': 'video', 'video/webm': 'video', 'video/quicktime': 'video',
  'audio/mpeg': 'audio', 'audio/ogg': 'audio', 'audio/wav': 'audio', 'audio/mp4': 'audio',
  'application/zip': 'zip', 'application/x-zip-compressed': 'zip',
};

function fileTypeIcon(type) {
  if (type === 'image') return '🖼️';
  if (type === 'video') return '🎬';
  if (type === 'audio') return '🎵';
  if (type === 'zip')   return '🗜️';
  return '📎';
}

// =============================================
// דף ראשי של הצ'אטים — שיחות + כל המשתמשים
// =============================================
export function ChatsListPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('users'); // 'chats' | 'users'
  const [chats, setChats] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [unread, setUnread] = useState({});
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState(null); // userId שנפתח כרגע
  const [search, setSearch] = useState('');

  const canUseChat = profile &&
    (profile.role === 'admin' || profile.role === 'writer' || (profile.received_likes_count || 0) >= 50);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    if (!canUseChat) return;
    loadAll();
  }, [user]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadChats(), loadUsers()]);
    setLoading(false);
  }

  async function loadChats() {
    const { data } = await supabase
      .from('chats')
      .select(`
        id, last_message_at,
        user_a_profile:profiles!chats_user_a_fkey(id, display_name, role, received_likes_count),
        user_b_profile:profiles!chats_user_b_fkey(id, display_name, role, received_likes_count)
      `)
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order('last_message_at', { ascending: false });

    setChats(data || []);

    const unreadMap = {};
    for (const chat of (data || [])) {
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', chat.id)
        .eq('is_read', false)
        .neq('sender_id', user.id);
      unreadMap[chat.id] = count || 0;
    }
    setUnread(unreadMap);
  }

  async function loadUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, role, received_likes_count, login_days_count')
      .neq('id', user.id)
      .eq('is_blocked', false)
      .order('role')
      .order('received_likes_count', { ascending: false });
    setAllUsers(data || []);
  }

  async function startChat(targetUserId) {
    setStartingChat(targetUserId);
    const { data: chatId, error } = await supabase.rpc('get_or_create_chat', {
      other_user_id: targetUserId,
    });
    setStartingChat(null);
    if (error || !chatId) { alert('שגיאה ביצירת הצ\'אט'); return; }
    navigate(`/chat/${chatId}`);
  }

  // בדוק אם יכול לשלוח לפי ההרשאות (client-side, הDB גם מגן)
  function canSendTo(target) {
    const myRole = profile.role;
    const myLikes = profile.received_likes_count || 0;
    const tRole = target.role;
    const tLikes = target.received_likes_count || 0;

    if (myRole === 'admin') return true;
    if (tRole === 'admin') return true;
    if (myRole === 'writer') return true;
    if (tRole === 'writer') return myLikes >= 50;
    if (myLikes >= 50 && tLikes >= 50) return true;
    return false;
  }

  if (!user) return null;

  if (!canUseChat) return (
    <main className="page-content">
      <div className="container" style={{ maxWidth: 600 }}>
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
          <h2>צ'אט פרטי</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.75rem' }}>
            כדי להשתמש בצ'אט הפרטי, עליך לצבור לפחות <strong>50 לייקים</strong> על תגובותיך,
            או להיות בעל תפקיד כתב / מנהל.
          </p>
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div>❤️ לייקים שקיבלת: <strong>{profile?.received_likes_count || 0}</strong> / 50</div>
          </div>
          <Link to="/" className="btn btn-primary" style={{ marginTop: '1.5rem' }}>חזרה לראשי</Link>
        </div>
      </div>
    </main>
  );

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);
  const filteredUsers = allUsers.filter(u =>
    u.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  // קבץ משתמשים לפי תפקיד לתצוגה נוחה
  const roleOrder = ['admin', 'writer', 'level3', 'level2', 'level1'];
  const grouped = roleOrder.reduce((acc, role) => {
    const group = filteredUsers.filter(u => u.role === role);
    if (group.length) acc[role] = group;
    return acc;
  }, {});

  const roleLabels = {
    admin: '👑 מנהלים',
    writer: '✍️ כתבים',
    level3: '💜 נאמני האתר',
    level2: '💙 מגיבים מורשים',
    level1: '⬜ משתמשים חדשים',
  };

  return (
    <main className="page-content">
      <div className="container" style={{ maxWidth: 700 }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1.25rem' }}>💬 צ'אט פרטי</h1>

        {/* טאבים */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '2px solid var(--border)', paddingBottom: '0' }}>
          {[
            { key: 'users', label: '👥 כל המשתמשים' },
            { key: 'chats', label: `🗨️ השיחות שלי${totalUnread > 0 ? ` (${totalUnread})` : ''}` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0.6rem 1.1rem', fontSize: '0.92rem', fontWeight: tab === t.key ? 700 : 400,
                color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: '-2px',
              }}
            >{t.label}</button>
          ))}
        </div>

        {loading ? (
          <div className="loading-page"><div className="spinner"></div></div>
        ) : tab === 'users' ? (
          <>
            {/* חיפוש */}
            <input
              className="form-input"
              placeholder="🔍 חיפוש משתמש..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ marginBottom: '1rem' }}
            />

            {Object.entries(grouped).map(([role, users]) => (
              <div key={role} style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {roleLabels[role]}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {users.map(u => {
                    const { label, color } = getRoleBadge(u.role);
                    const allowed = canSendTo(u);
                    const isLoading = startingChat === u.id;
                    return (
                      <div key={u.id} className="card" style={{
                        padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.85rem',
                        opacity: allowed ? 1 : 0.5,
                      }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: '50%', background: color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, color: '#fff', fontSize: '1rem', flexShrink: 0,
                        }}>
                          {(u.display_name || '?')[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.95rem' }}>{u.display_name}</strong>
                            <span className="badge" style={{ color, borderColor: color+'40', background: color+'15', fontSize: '0.68rem' }}>{label}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            ❤️ {u.received_likes_count || 0} לייקים · 🗓 {u.login_days_count || 0} ימים
                          </div>
                        </div>
                        {allowed ? (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => startChat(u.id)}
                            disabled={isLoading}
                            style={{ flexShrink: 0 }}
                          >
                            {isLoading
                              ? <div className="spinner" style={{ width: 13, height: 13 }} />
                              : '💬 שלח'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>🔒</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredUsers.length === 0 && (
              <div className="empty-state"><span className="empty-state-icon">🔍</span><p>לא נמצאו משתמשים</p></div>
            )}
          </>
        ) : (
          /* טאב שיחות */
          chats.length === 0 ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💬</div>
              <p style={{ color: 'var(--text-muted)' }}>אין שיחות עדיין. לחץ על "כל המשתמשים" כדי להתחיל.</p>
              <button className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }} onClick={() => setTab('users')}>👥 עבור למשתמשים</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {chats.map(chat => {
                const other = chat.user_a_profile?.id === user.id
                  ? chat.user_b_profile : chat.user_a_profile;
                const { label, color } = getRoleBadge(other?.role);
                const unreadCount = unread[chat.id] || 0;
                return (
                  <div key={chat.id} className="card"
                    onClick={() => navigate(`/chat/${chat.id}`)}
                    style={{ padding: '1rem 1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem',
                      borderRight: unreadCount > 0 ? '3px solid var(--accent)' : '3px solid transparent' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.2rem', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                      {(other?.display_name || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <strong>{other?.display_name}</strong>
                        <span className="badge" style={{ color, borderColor: color+'40', background: color+'15', fontSize: '0.7rem' }}>{label}</span>
                        {unreadCount > 0 && (
                          <span style={{ marginRight: 'auto', background: 'var(--accent)', color: '#fff',
                            borderRadius: '999px', padding: '0 6px', fontSize: '0.72rem', fontWeight: 700, lineHeight: '18px' }}>
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {timeAgo(chat.last_message_at)}
                      </div>
                    </div>
                    <span style={{ color: 'var(--text-muted)' }}>›</span>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </main>
  );
}

// =============================================
// דף שיחה בודדת — WhatsApp style
// =============================================
export default function ChatPage() {
  const { chatId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const channelRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const otherUserIdRef = useRef(null);

  const canUseChat = profile &&
    (profile.role === 'admin' || profile.role === 'writer' || (profile.received_likes_count || 0) >= 50);

  // ── טעינת היסטוריה ──────────────────────────────────────
  const loadChat = useCallback(async () => {
    if (!user || !chatId) return;
    const { data: chatData } = await supabase
      .from('chats')
      .select(`
        id, user_a, user_b,
        user_a_profile:profiles!chats_user_a_fkey(id, display_name, role, received_likes_count),
        user_b_profile:profiles!chats_user_b_fkey(id, display_name, role, received_likes_count)
      `)
      .eq('id', chatId)
      .single();

    if (!chatData) { navigate('/chats'); return; }
    if (chatData.user_a !== user.id && chatData.user_b !== user.id) { navigate('/chats'); return; }

    const other = chatData.user_a === user.id ? chatData.user_b_profile : chatData.user_a_profile;
    setOtherUser(other);
    otherUserIdRef.current = other.id;

    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    setMessages(msgs || []);

    // סמן כנקראו
    await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('chat_id', chatId)
      .neq('sender_id', user.id)
      .eq('is_read', false);
  }, [chatId, user, navigate]);

  // ── Realtime: הודעות + Presence (אונליין + הקלדה) ────────
  useEffect(() => {
    if (!user || !chatId) return;
    if (!canUseChat) { navigate('/chats'); return; }

    loadChat();

    const channel = supabase.channel(`chat_room:${chatId}`, {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    // הודעות חדשות מה-DB
    channel.on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'chat_messages',
      filter: `chat_id=eq.${chatId}`,
    }, async (payload) => {
      const msg = payload.new;
      // אם ההודעה שלנו — כבר הוספנו אותה optimistically, רק נעדכן את ה-id האמיתי
      setMessages(prev => {
        const tempIdx = prev.findIndex(m => m._temp && m.content === msg.content && m.sender_id === msg.sender_id);
        if (tempIdx !== -1) {
          const updated = [...prev];
          updated[tempIdx] = msg;
          return updated;
        }
        // הודעה של הצד השני
        return [...prev, msg];
      });
      if (msg.sender_id !== user.id) {
        await supabase.from('chat_messages').update({ is_read: true }).eq('id', msg.id);
        // עדכן ✓✓ בהודעות שלנו
        setMessages(prev => prev.map(m =>
          m.sender_id === user.id ? { ...m, is_read: true } : m
        ));
      }
    });

    // עדכון is_read של ההודעות שלנו (הצד השני קרא)
    channel.on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'chat_messages',
      filter: `chat_id=eq.${chatId}`,
    }, (payload) => {
      setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
    });

    // Presence — אונליין
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const others = Object.keys(state).filter(k => k !== user.id);
      setOtherOnline(others.length > 0);
    });

    // Broadcast — הקלדה
    channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload.userId !== user.id) {
        setOtherTyping(payload.isTyping);
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [chatId, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherTyping]);

  // ── שליחת אינדיקטור הקלדה ───────────────────────────────
  function handleTyping(e) {
    setText(e.target.value);
    if (!channelRef.current) return;
    channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: user.id, isTyping: true } });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId: user.id, isTyping: false } });
    }, 1500);
  }

  // ── שליחת הודעת טקסט — Optimistic ───────────────────────
  async function sendMessage(content = null, fileUrl = null, fileType = null, fileName = null) {
    if (!content?.trim() && !fileUrl) return;

    // עצור אינדיקטור הקלדה
    clearTimeout(typingTimeoutRef.current);
    channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId: user.id, isTyping: false } });

    // הוסף מיד ל-UI (optimistic)
    const tempMsg = {
      _temp: true,
      id: `temp_${Date.now()}`,
      chat_id: chatId,
      sender_id: user.id,
      content: content?.trim() || null,
      file_url: fileUrl,
      file_type: fileType,
      file_name: fileName,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setText('');

    const { error: err } = await supabase.from('chat_messages').insert({
      chat_id: chatId,
      sender_id: user.id,
      content: content?.trim() || null,
      file_url: fileUrl,
      file_type: fileType,
      file_name: fileName,
    });

    if (err) {
      setError('שגיאה בשליחה');
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
    } else {
      await supabase.from('chats').update({ last_message_at: new Date().toISOString() }).eq('id', chatId);
    }
  }

  // ── העלאת קובץ ──────────────────────────────────────────
  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { setError('הקובץ גדול מדי (מקסימום 50MB)'); return; }
    const detectedType = ALLOWED_TYPES[file.type];
    if (!detectedType) { setError('סוג קובץ לא נתמך. ניתן לשלוח: תמונות, וידאו, אודיו, ZIP'); return; }

    setUploading(true);
    setError('');
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { data, error: uploadError } = await supabase.storage
      .from('chat-files')
      .upload(path, file, { upsert: false });

    if (uploadError) { setError('שגיאה בהעלאת הקובץ: ' + uploadError.message); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(data.path);
    await sendMessage(null, urlData.publicUrl, detectedType, file.name);
    setUploading(false);
    e.target.value = '';
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(text); }
  }

  if (!user || !canUseChat) return null;

  const { label: otherLabel, color: otherColor } = otherUser ? getRoleBadge(otherUser.role) : { label: '', color: '#94a3b8' };

  return (
    <main className="page-content" style={{ height: 'calc(100vh - 130px)', display: 'flex', flexDirection: 'column', padding: 0 }}>
      <div style={{ maxWidth: 720, width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* ── Header ────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.75rem 1rem',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/chats')} style={{ padding: '0.4rem 0.6rem' }}>←</button>
          {otherUser && (
            <>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%', background: otherColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, color: '#fff', fontSize: '1.1rem',
                }}>
                  {(otherUser.display_name || '?')[0].toUpperCase()}
                </div>
                {/* נקודה ירוקה אונליין */}
                <span style={{
                  position: 'absolute', bottom: 1, left: 1,
                  width: 11, height: 11, borderRadius: '50%',
                  background: otherOnline ? '#22c55e' : '#94a3b8',
                  border: '2px solid var(--bg-card)',
                  transition: 'background 0.3s',
                }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.97rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {otherUser.display_name}
                  <span className="badge" style={{ color: otherColor, borderColor: otherColor+'40', background: otherColor+'15', fontSize: '0.68rem' }}>{otherLabel}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: otherTyping ? '#22c55e' : (otherOnline ? '#22c55e' : 'var(--text-muted)'), transition: 'color 0.2s' }}>
                  {otherTyping ? '✍️ מקליד...' : otherOnline ? '● מחובר' : '⚬ לא מחובר'}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── אזור הודעות ───────────────────────────────── */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '1rem',
          display: 'flex', flexDirection: 'column', gap: '0.35rem',
          background: 'var(--bg)',
        }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '4rem' }}>
              <div style={{ fontSize: '3rem' }}>💬</div>
              <p style={{ marginTop: '0.5rem' }}>התחל שיחה!</p>
            </div>
          )}

          {messages.map((msg, idx) => {
            const isMine = msg.sender_id === user.id;
            const isTemp = !!msg._temp;
            const prevMsg = messages[idx - 1];
            const showDateSep = !prevMsg || new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();

            // זמן בפורמט ווצאפ
            const timeStr = new Date(msg.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

            return (
              <React.Fragment key={msg.id}>
                {/* הפרדת תאריך */}
                {showDateSep && (
                  <div style={{ textAlign: 'center', margin: '0.75rem 0 0.25rem' }}>
                    <span style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: '999px', padding: '0.2rem 0.8rem',
                      fontSize: '0.72rem', color: 'var(--text-muted)',
                    }}>
                      {new Date(msg.created_at).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: '0.4rem' }}>
                  {/* אווטאר צד שני */}
                  {!isMine && (
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', background: otherColor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 800, color: '#fff', flexShrink: 0, marginBottom: 2,
                    }}>
                      {(otherUser?.display_name || '?')[0].toUpperCase()}
                    </div>
                  )}

                  {/* בלון ההודעה */}
                  <div style={{
                    maxWidth: '72%',
                    padding: '0.5rem 0.8rem 0.35rem',
                    borderRadius: isMine
                      ? '1.1rem 1.1rem 0.2rem 1.1rem'
                      : '1.1rem 1.1rem 1.1rem 0.2rem',
                    background: isMine ? '#dcf8c6' : 'var(--bg-card)',
                    color: '#111',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    opacity: isTemp ? 0.7 : 1,
                    transition: 'opacity 0.2s',
                    fontSize: '0.92rem', lineHeight: 1.45,
                    position: 'relative',
                  }}>
                    {/* קבצים */}
                    {msg.file_url && msg.file_type === 'image' && (
                      <img src={msg.file_url} alt={msg.file_name}
                        style={{ maxWidth: '100%', borderRadius: '0.6rem', display: 'block', marginBottom: msg.content ? '0.4rem' : '0.2rem' }} />
                    )}
                    {msg.file_url && msg.file_type === 'video' && (
                      <video src={msg.file_url} controls
                        style={{ maxWidth: '100%', borderRadius: '0.6rem', display: 'block', marginBottom: msg.content ? '0.4rem' : '0.2rem' }} />
                    )}
                    {msg.file_url && msg.file_type === 'audio' && (
                      <audio src={msg.file_url} controls style={{ width: '100%', marginBottom: msg.content ? '0.4rem' : '0.2rem' }} />
                    )}
                    {msg.file_url && (msg.file_type === 'zip' || msg.file_type === 'file') && (
                      <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#1d4ed8', marginBottom: msg.content ? '0.4rem' : '0.2rem' }}>
                        {fileTypeIcon(msg.file_type)} {msg.file_name || 'הורדת קובץ'}
                      </a>
                    )}

                    {/* טקסט */}
                    {msg.content && (
                      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</span>
                    )}

                    {/* שעה + סטטוס */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                      gap: '0.2rem', marginTop: '0.2rem',
                      fontSize: '0.68rem', color: '#888', whiteSpace: 'nowrap',
                    }}>
                      <span>{timeStr}</span>
                      {isMine && (
                        <span style={{ color: msg.is_read ? '#4fc3f7' : '#aaa', fontSize: '0.8rem' }}>
                          {isTemp ? '🕐' : msg.is_read ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {/* אינדיקטור הקלדה */}
          {otherTyping && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: otherColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 800, color: '#fff', flexShrink: 0,
              }}>
                {(otherUser?.display_name || '?')[0].toUpperCase()}
              </div>
              <div style={{
                padding: '0.55rem 0.9rem',
                borderRadius: '1.1rem 1.1rem 1.1rem 0.2rem',
                background: 'var(--bg-card)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#aaa',
                    display: 'inline-block',
                    animation: 'typingBounce 1.2s infinite',
                    animationDelay: `${i * 0.2}s`,
                  }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input bar ─────────────────────────────────── */}
        <div style={{
          padding: '0.6rem 0.75rem',
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          {error && <div style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '0.4rem' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }}
              accept="image/*,video/*,audio/*,.zip,application/zip"
              onChange={handleFileUpload} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="שלח קובץ"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '1.35rem', padding: '0.3rem', lineHeight: 1,
                opacity: uploading ? 0.5 : 1,
              }}
            >
              {uploading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : '📎'}
            </button>
            <textarea
              className="form-input"
              value={text}
              onChange={handleTyping}
              onKeyDown={handleKeyDown}
              placeholder="הודעה..."
              rows={1}
              style={{ flex: 1, resize: 'none', minHeight: 40, maxHeight: 130, borderRadius: '1.5rem', padding: '0.55rem 1rem' }}
            />
            <button
              onClick={() => sendMessage(text)}
              disabled={!text.trim()}
              style={{
                width: 42, height: 42, borderRadius: '50%',
                background: text.trim() ? '#25d366' : '#ccc',
                border: 'none', cursor: text.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.1rem', transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              ➤
            </button>
          </div>
        </div>

        {/* אנימציית נקודות הקלדה */}
        <style>{`
          @keyframes typingBounce {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
            30% { transform: translateY(-5px); opacity: 1; }
          }
        `}</style>
      </div>
    </main>
  );
}
