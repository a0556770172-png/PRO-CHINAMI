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
// דף ראשי של הצ'אטים — רשימת שיחות
// =============================================
export function ChatsListPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState({});

  const canUseChat = profile &&
    (profile.role === 'admin' || profile.role === 'writer' || (profile.received_likes_count || 0) >= 50);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    if (!canUseChat) return;
    loadChats();
  }, [user]);

  async function loadChats() {
    setLoading(true);
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

    // ספור הודעות שלא נקראו
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
    setLoading(false);
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

  return (
    <main className="page-content">
      <div className="container" style={{ maxWidth: 680 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem' }}>💬 הצ'אטים שלי</h1>
        </div>

        {loading ? (
          <div className="loading-page"><div className="spinner"></div></div>
        ) : chats.length === 0 ? (
          <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
            <p style={{ color: 'var(--text-muted)' }}>אין שיחות עדיין. עבור לפרופיל של משתמש אחר ולחץ "שלח הודעה".</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {chats.map(chat => {
              const other = chat.user_a_profile?.id === user.id
                ? chat.user_b_profile : chat.user_a_profile;
              const { label, color } = getRoleBadge(other?.role);
              const unreadCount = unread[chat.id] || 0;
              return (
                <div
                  key={chat.id}
                  className="card"
                  onClick={() => navigate(`/chat/${chat.id}`)}
                  style={{ padding: '1rem 1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem',
                    borderLeft: unreadCount > 0 ? '3px solid var(--accent)' : '3px solid transparent' }}
                >
                  <div style={{ width: 46, height: 46, borderRadius: '50%', background: color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.3rem', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {(other?.display_name || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong>{other?.display_name}</strong>
                      <span className="badge" style={{ color, borderColor: color+'40', background: color+'15', fontSize: '0.7rem' }}>{label}</span>
                      {unreadCount > 0 && (
                        <span style={{ marginRight: 'auto', background: 'var(--accent)', color: '#fff',
                          borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: 700 }}>
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {timeAgo(chat.last_message_at)}
                    </div>
                  </div>
                  <span style={{ color: 'var(--text-muted)' }}>›</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

// =============================================
// דף שיחה בודדת
// =============================================
export default function ChatPage() {
  const { chatId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  const canUseChat = profile &&
    (profile.role === 'admin' || profile.role === 'writer' || (profile.received_likes_count || 0) >= 50);

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

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    if (!canUseChat) { navigate('/chats'); return; }
    loadChat();

    // Real-time subscription
    const channel = supabase
      .channel(`chat:${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `chat_id=eq.${chatId}`
      }, async (payload) => {
        setMessages(prev => [...prev, payload.new]);
        if (payload.new.sender_id !== user.id) {
          await supabase.from('chat_messages').update({ is_read: true }).eq('id', payload.new.id);
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [chatId, user, canUseChat, loadChat, navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(content = null, fileUrl = null, fileType = null, fileName = null) {
    if (!content?.trim() && !fileUrl) return;
    setSending(true);
    setError('');
    const { error: err } = await supabase.from('chat_messages').insert({
      chat_id: chatId,
      sender_id: user.id,
      content: content?.trim() || null,
      file_url: fileUrl,
      file_type: fileType,
      file_name: fileName,
    });
    if (err) { setError('שגיאה בשליחה'); }
    else {
      setText('');
      // עדכן last_message_at
      await supabase.from('chats').update({ last_message_at: new Date().toISOString() }).eq('id', chatId);
    }
    setSending(false);
  }

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
    <main className="page-content" style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
      <div className="container" style={{ maxWidth: 720, flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 0', borderBottom: '1px solid var(--border)', marginBottom: '0.5rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/chats')}>← חזרה</button>
          {otherUser && (
            <>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: otherColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, color: '#fff', fontSize: '1rem' }}>
                {(otherUser.display_name || '?')[0].toUpperCase()}
              </div>
              <div>
                <strong>{otherUser.display_name}</strong>
                <span className="badge" style={{ color: otherColor, borderColor: otherColor+'40', background: otherColor+'15', fontSize: '0.7rem', marginRight: '0.4rem' }}>{otherLabel}</span>
              </div>
            </>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '3rem' }}>
              <div style={{ fontSize: '2.5rem' }}>💬</div>
              <p>התחל שיחה!</p>
            </div>
          )}
          {messages.map(msg => {
            const isMine = msg.sender_id === user.id;
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-start' : 'flex-end' }}>
                <div style={{
                  maxWidth: '70%', padding: '0.6rem 0.9rem',
                  borderRadius: isMine ? '1rem 1rem 1rem 0.2rem' : '1rem 1rem 0.2rem 1rem',
                  background: isMine ? 'var(--bg-card)' : 'var(--accent)',
                  color: isMine ? 'var(--text-primary)' : '#fff',
                  border: isMine ? '1px solid var(--border)' : 'none',
                  fontSize: '0.9rem', lineHeight: 1.4,
                }}>
                  {/* קובץ */}
                  {msg.file_url && msg.file_type === 'image' && (
                    <img src={msg.file_url} alt={msg.file_name} style={{ maxWidth: '100%', borderRadius: '0.5rem', marginBottom: msg.content ? '0.4rem' : 0 }} />
                  )}
                  {msg.file_url && msg.file_type === 'video' && (
                    <video src={msg.file_url} controls style={{ maxWidth: '100%', borderRadius: '0.5rem', marginBottom: msg.content ? '0.4rem' : 0 }} />
                  )}
                  {msg.file_url && msg.file_type === 'audio' && (
                    <audio src={msg.file_url} controls style={{ width: '100%', marginBottom: msg.content ? '0.4rem' : 0 }} />
                  )}
                  {msg.file_url && (msg.file_type === 'zip' || msg.file_type === 'file') && (
                    <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: isMine ? 'var(--accent)' : '#fff', textDecoration: 'underline', marginBottom: msg.content ? '0.4rem' : 0 }}>
                      {fileTypeIcon(msg.file_type)} {msg.file_name || 'הורדת קובץ'}
                    </a>
                  )}
                  {/* טקסט */}
                  {msg.content && <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</span>}
                  <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '0.3rem', textAlign: 'left' }}>
                    {timeAgo(msg.created_at)}
                    {isMine && <span style={{ marginRight: '0.3rem' }}>{msg.is_read ? ' ✓✓' : ' ✓'}</span>}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {error && <div className="alert alert-error" style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>{error}</div>}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*,video/*,audio/*,.zip,application/zip"
            onChange={handleFileUpload}
          />
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || sending}
            title="שלח קובץ (תמונה / וידאו / אודיו / ZIP)"
            style={{ padding: '0.5rem 0.7rem', fontSize: '1.2rem' }}
          >
            {uploading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : '📎'}
          </button>
          <textarea
            className="form-input"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="כתוב הודעה... (Enter לשליחה)"
            rows={1}
            style={{ flex: 1, resize: 'none', minHeight: 40, maxHeight: 120 }}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={() => sendMessage(text)}
            disabled={sending || (!text.trim())}
            style={{ padding: '0.5rem 0.9rem' }}
          >
            {sending ? <div className="spinner" style={{ width: 14, height: 14 }} /> : '➤'}
          </button>
        </div>
      </div>
    </main>
  );
}
