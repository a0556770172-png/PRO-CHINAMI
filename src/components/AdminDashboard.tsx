import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
  Users, Link2, MessageSquare, BarChart2, Shield,
  Lock, Unlock, Trash2, Send, Edit2, Check, X,
  RefreshCw, Loader2, UserPlus, Settings, Power
} from 'lucide-react';

interface AdminDashboardProps {
  user: any;
  siteDown: boolean;
  setSiteDown: (v: boolean) => void;
  siteDownMessage: string;
  setSiteDownMessage: (v: string) => void;
}

type AdminTab = 'users' | 'links' | 'feedback' | 'messages' | 'stats' | 'settings';

export const AdminDashboard = ({ user, siteDown, setSiteDown, siteDownMessage, setSiteDownMessage }: AdminDashboardProps) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [loading, setLoading] = useState(false);

  const [usersData, setUsersData] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [linkRequests, setLinkRequests] = useState<any[]>([]);
  const [blockedList, setBlockedList] = useState<string[]>([]);

  const [editingLink, setEditingLink] = useState<string | null>(null);
  const [editLinkData, setEditLinkData] = useState<any>({});
  const [msgTarget, setMsgTarget] = useState('');
  const [msgContent, setMsgContent] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminEmails, setAdminEmails] = useState<string[]>(['e0556770172@gmail.com']);
  const [newSiteDownMsg, setNewSiteDownMsg] = useState(siteDownMessage);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // קישורים
      const { data: linksData } = await supabase
        .from('links').select('*').order('created_at', { ascending: false });
      setLinks(linksData || []);

      // משובים - כולם
      const { data: feedData } = await supabase
        .from('feedback').select('*').order('created_at', { ascending: false });
      setFeedback(feedData || []);

      // הודעות
      const { data: msgData } = await supabase
        .from('messages').select('*').order('created_at', { ascending: false });
      setMessages(msgData || []);

      // בקשות קישורים
      const { data: reqData } = await supabase
        .from('link_requests').select('*').order('created_at', { ascending: false }).limit(500);
      setLinkRequests(reqData || []);

      // משתמשים חסומים
      const { data: blockedData } = await supabase
        .from('blocked_users').select('user_id');
      setBlockedList(blockedData?.map((b: any) => b.user_id) || []);

      // סטטיסטיקה
      const { count: totalReqs } = await supabase
        .from('link_requests').select('*', { count: 'exact', head: true });
      const { count: blockedCount } = await supabase
        .from('blocked_users').select('*', { count: 'exact', head: true });
      const { count: feedCount } = await supabase
        .from('feedback').select('*', { count: 'exact', head: true });
      const totalLinks = linksData?.length || 0;
      const totalRemaining = linksData?.reduce((s: number, l: any) => s + (l.uses_remaining || 0), 0) || 0;
      const blockedLinks = linksData?.filter((l: any) => l.is_blocked)?.length || 0;
      setStats({ totalReqs: totalReqs || 0, blockedCount: blockedCount || 0, feedCount: feedCount || 0, totalLinks, totalRemaining, blockedLinks });

      // מנהלים
      const { data: adminData } = await supabase
        .from('site_settings').select('value').eq('key', 'admin_emails').single();
      if (adminData?.value) {
        try { setAdminEmails(JSON.parse(adminData.value)); } catch (_) {}
      }

      // בניית רשימת משתמשים ייחודיים מ-link_requests
      // מזהים ייחודיים
      const userMap: Record<string, any> = {};
      (reqData || []).forEach((req: any) => {
        if (!userMap[req.user_id]) {
          userMap[req.user_id] = {
            id: req.user_id,
            email: '',
            requests: [],
          };
        }
        userMap[req.user_id].requests.push(req);
      });

      // שליפת מיילים מטבלת auth דרך RPC (אם קיים) או מ-feedback
      // נשתמש ב-feedback לקישור בין user_id למייל
      const feedUsers: Record<string, string> = {};
      (feedData || []).forEach((f: any) => {
        if (f.user_id && f.username) feedUsers[f.user_id] = f.username;
      });

      // עדכון מיילים בmap
      Object.keys(userMap).forEach(uid => {
        userMap[uid].email = feedUsers[uid] || feedUsers[uid.toLowerCase()] || uid.substring(0, 8) + '...';
      });

      setUsersData(Object.values(userMap));

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const toggleBlockLink = async (link: any) => {
    await supabase.from('links').update({ is_blocked: !link.is_blocked }).eq('id', link.id);
    await loadAll();
  };

  const deleteLink = async (id: string) => {
    if (!confirm('למחוק קישור זה?')) return;
    await supabase.from('links').delete().eq('id', id);
    await loadAll();
  };

  const saveLinkEdit = async () => {
    await supabase.from('links').update({
      creator_name: editLinkData.creator_name,
      notes: editLinkData.notes,
    }).eq('id', editingLink);
    setEditingLink(null);
    await loadAll();
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgTarget || !msgContent.trim()) return;
    setSendingMsg(true);
    await supabase.from('messages').insert([{
      sender_id: user.id,
      receiver_id: msgTarget,
      content: msgContent,
      type: 'admin_to_user',
      is_read: false,
    }]);
    setSendingMsg(false);
    setMsgContent('');
    alert('הודעה נשלחה!');
  };

  const blockUser = async (userId: string) => {
    if (!confirm('לחסום משתמש זה?')) return;
    await supabase.from('blocked_users').upsert([{ user_id: userId, reason: 'חסום על ידי מנהל' }]);
    setBlockedList(prev => [...prev, userId]);
    alert('המשתמש נחסם.');
  };

  const unblockUser = async (userId: string) => {
    await supabase.from('blocked_users').delete().eq('user_id', userId);
    setBlockedList(prev => prev.filter(id => id !== userId));
    alert('המשתמש שוחרר.');
  };

  const toggleSiteDown = async () => {
    const newVal = !siteDown;
    await supabase.from('site_settings').upsert([{ key: 'site_down', value: String(newVal) }]);
    setSiteDown(newVal);
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    await supabase.from('site_settings').upsert([{ key: 'site_down_message', value: newSiteDownMsg }]);
    setSiteDownMessage(newSiteDownMsg);
    await supabase.from('site_settings').upsert([{ key: 'admin_emails', value: JSON.stringify(adminEmails) }]);
    setSavingSettings(false);
    alert('ההגדרות נשמרו!');
  };

  const addAdminEmail = () => {
    if (newAdminEmail && !adminEmails.includes(newAdminEmail)) {
      setAdminEmails(prev => [...prev, newAdminEmail]);
      setNewAdminEmail('');
    }
  };

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'users', label: 'משתמשים', icon: <Users size={15} />, badge: usersData.length },
    { id: 'links', label: 'קישורים', icon: <Link2 size={15} />, badge: links.length },
    { id: 'feedback', label: 'תגובות', icon: <MessageSquare size={15} />, badge: feedback.length },
    { id: 'messages', label: 'הודעות', icon: <Send size={15} />, badge: messages.filter(m => !m.is_read).length || undefined },
    { id: 'stats', label: 'סטטיסטיקה', icon: <BarChart2 size={15} /> },
    { id: 'settings', label: 'הגדרות', icon: <Settings size={15} /> },
  ];

  return (
    <div className="space-y-4" dir="rtl">
      {/* כותרת */}
      <div className="bg-gradient-to-r from-red-900/40 to-red-800/20 border border-red-500/30 rounded-2xl p-5 flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="text-red-400" size={24} /> פאנל ניהול
          </h2>
          <p className="text-red-300/70 text-sm mt-0.5">{user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSiteDown}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition ${siteDown ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}
          >
            <Power size={16} />
            {siteDown ? '✅ הפעל אתר' : '⛔ כבה אתר'}
          </button>
          <button onClick={loadAll} className="text-slate-400 hover:text-white transition p-2 hover:bg-white/10 rounded-xl">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {siteDown && (
        <div className="bg-red-500/20 border border-red-400/40 rounded-xl p-3 text-red-200 text-sm text-center font-bold">
          ⚠️ האתר כרגע מושבת – מוצג מסך חסימה לכל המשתמשים
        </div>
      )}

      {/* טאבים */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition ${activeTab === tab.id ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
          >
            {tab.icon} {tab.label}
            {tab.badge ? (
              <span className="absolute -top-1.5 -left-1.5 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-400" size={32} /></div>
      )}

      {/* ===== משתמשים ===== */}
      {activeTab === 'users' && !loading && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-white flex items-center gap-2"><Users size={18} className="text-blue-400" /> משתמשים ({usersData.length})</h3>

          {/* שליחת הודעה */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h4 className="text-sm font-bold text-slate-300 mb-3">📨 שלח הודעה למשתמש</h4>
            <form onSubmit={sendMessage} className="flex flex-col gap-2">
              <input
                className="w-full p-2.5 bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl text-sm outline-none focus:border-blue-400"
                placeholder="הדבק כאן את ה-ID של המשתמש..."
                value={msgTarget}
                onChange={e => setMsgTarget(e.target.value)}
                dir="ltr"
              />
              <div className="flex gap-2">
                <input
                  className="flex-1 p-2.5 bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl text-sm outline-none focus:border-blue-400"
                  placeholder="תוכן ההודעה..."
                  value={msgContent}
                  onChange={e => setMsgContent(e.target.value)}
                />
                <button disabled={sendingMsg} className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-xl text-sm font-bold disabled:opacity-50 transition">
                  {sendingMsg ? <Loader2 size={14} className="animate-spin" /> : 'שלח'}
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {usersData.length === 0 ? (
              <p className="text-slate-400 text-center py-6">אין נתוני משתמשים עדיין.</p>
            ) : usersData.map(u => {
              const blocked = blockedList.includes(u.id);
              return (
                <div key={u.id} className={`border rounded-xl p-4 ${blocked ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10'}`}>
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div className="min-w-0">
                      {/* מייל אם ידוע, אחרת ID */}
                      <p className="text-white font-bold text-sm">
                        {u.email !== u.id.substring(0, 8) + '...' ? u.email : '(לא ידוע)'}
                      </p>
                      <p className="text-slate-400 text-xs font-mono mt-0.5 select-all">{u.id}</p>
                      <p className="text-slate-500 text-xs mt-1">
                        בקשות: {u.requests.length} &nbsp;|&nbsp;
                        {u.requests[0] ? 'אחרון: ' + new Date(u.requests[0].created_at).toLocaleString('he-IL') : ''}
                      </p>
                      {blocked && <span className="text-xs text-red-400 font-bold">🔒 חסום</span>}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => { setMsgTarget(u.id); }}
                        className="bg-blue-600/20 border border-blue-500/30 text-blue-300 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-600/40 transition"
                      >
                        📨 הודעה
                      </button>
                      {blocked ? (
                        <button
                          onClick={() => unblockUser(u.id)}
                          className="bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-600/40 transition"
                        >
                          <Unlock size={12} className="inline ml-1" />שחרר
                        </button>
                      ) : (
                        <button
                          onClick={() => blockUser(u.id)}
                          className="bg-red-600/20 border border-red-500/30 text-red-300 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-600/40 transition"
                        >
                          <Lock size={12} className="inline ml-1" />חסום
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== קישורים ===== */}
      {activeTab === 'links' && !loading && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Link2 size={18} className="text-blue-400" /> ניהול קישורים ({links.length})</h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'סה״כ', value: stats.totalLinks, color: 'blue' },
              { label: 'שימושים נותרו', value: stats.totalRemaining, color: 'emerald' },
              { label: 'חסומים', value: stats.blockedLinks, color: 'red' },
            ].map(s => (
              <div key={s.label} className={`bg-${s.color}-500/10 border border-${s.color}-500/30 rounded-xl p-3 text-center`}>
                <div className="text-xl font-bold text-white">{s.value ?? 0}</div>
                <div className="text-xs text-slate-400">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {links.map(link => (
              <div key={link.id} className={`border rounded-xl p-4 ${link.is_blocked ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10'}`}>
                {editingLink === link.id ? (
                  <div className="space-y-2">
                    <input className="w-full p-2 bg-white/10 border border-white/20 text-white rounded-lg text-sm outline-none focus:border-blue-400"
                      value={editLinkData.creator_name || ''} onChange={e => setEditLinkData({ ...editLinkData, creator_name: e.target.value })} placeholder="שם מפרסם" />
                    <input className="w-full p-2 bg-white/10 border border-white/20 text-white rounded-lg text-sm outline-none focus:border-blue-400"
                      value={editLinkData.notes || ''} onChange={e => setEditLinkData({ ...editLinkData, notes: e.target.value })} placeholder="הערות" />
                    <div className="flex gap-2">
                      <button onClick={saveLinkEdit} className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold"><Check size={14} /></button>
                      <button onClick={() => setEditingLink(null)} className="bg-slate-600 text-white px-3 py-1 rounded-lg text-xs font-bold"><X size={14} /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white text-sm">{link.creator_name || 'אנונימי'}</p>
                      {link.notes && <p className="text-xs text-slate-400 mt-0.5">{link.notes}</p>}
                      <p className="text-xs text-slate-500 mt-1 font-mono truncate max-w-xs">{link.url}</p>
                      <div className="flex gap-3 mt-1">
                        <span className="text-xs text-blue-300">שימושים: {link.uses_remaining}</span>
                        {link.is_blocked && <span className="text-xs text-red-400 font-bold">🔒 חסום</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => { setEditingLink(link.id); setEditLinkData({ creator_name: link.creator_name, notes: link.notes }); }}
                        className="bg-blue-600/20 border border-blue-500/30 text-blue-300 px-2 py-1.5 rounded-lg text-xs hover:bg-blue-600/40 transition">
                        <Edit2 size={12} />
                      </button>
                      <button onClick={() => toggleBlockLink(link)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${link.is_blocked ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-300' : 'bg-red-600/20 border border-red-500/30 text-red-300'}`}>
                        {link.is_blocked ? <><Unlock size={12} className="inline ml-1" />שחרר</> : <><Lock size={12} className="inline ml-1" />חסום</>}
                      </button>
                      <button onClick={() => deleteLink(link.id)}
                        className="bg-slate-600/20 border border-slate-500/30 text-slate-300 px-2 py-1.5 rounded-lg text-xs hover:bg-red-600/20 hover:text-red-300 transition">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== תגובות ===== */}
      {activeTab === 'feedback' && !loading && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2"><MessageSquare size={18} className="text-blue-400" /> תגובות משתמשים ({feedback.length})</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {feedback.length === 0 ? (
              <p className="text-slate-400 text-center py-6">אין תגובות עדיין.</p>
            ) : feedback.map(f => (
              <div key={f.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex justify-between items-start gap-2 mb-2 flex-wrap">
                  <div>
                    <span className="text-sm font-bold text-white">{f.username || 'אנונימי'}</span>
                    <p className="text-xs text-slate-400 font-mono">{f.user_id}</p>
                  </div>
                  <span className="text-xs text-slate-500">{new Date(f.created_at).toLocaleString('he-IL')}</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">{f.content}</p>
                <span className="text-xs text-blue-400 mt-1 inline-block">{f.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== הודעות ===== */}
      {activeTab === 'messages' && !loading && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-white flex items-center gap-2"><Send size={18} className="text-blue-400" /> הודעות</h3>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h4 className="text-sm font-bold text-slate-300 mb-3">שלח הודעה למשתמש</h4>
            <form onSubmit={sendMessage} className="space-y-2">
              <input className="w-full p-2.5 bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl text-sm outline-none focus:border-blue-400"
                placeholder="ID של המשתמש..." value={msgTarget} onChange={e => setMsgTarget(e.target.value)} dir="ltr" />
              <div className="flex gap-2">
                <input className="flex-1 p-2.5 bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl text-sm outline-none focus:border-blue-400"
                  placeholder="תוכן ההודעה..." value={msgContent} onChange={e => setMsgContent(e.target.value)} />
                <button disabled={sendingMsg} className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-xl text-sm font-bold disabled:opacity-50 transition">
                  {sendingMsg ? <Loader2 size={14} className="animate-spin" /> : 'שלח'}
                </button>
              </div>
            </form>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {messages.length === 0 ? <p className="text-slate-400 text-center py-6">אין הודעות.</p>
              : messages.map(m => (
                <div key={m.id} className={`border rounded-xl p-3 ${m.type === 'user_to_admin' ? 'bg-violet-500/10 border-violet-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
                  <div className="flex justify-between items-center mb-1 flex-wrap gap-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.type === 'user_to_admin' ? 'bg-violet-500/20 text-violet-300' : 'bg-blue-500/20 text-blue-300'}`}>
                      {m.type === 'user_to_admin' ? '👤 ממשתמש' : '🛡️ ממנהל'}
                    </span>
                    <span className="text-xs text-slate-500">{new Date(m.created_at).toLocaleString('he-IL')}</span>
                  </div>
                  <p className="text-sm text-slate-200">{m.content}</p>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    {m.type === 'user_to_admin' ? `מ: ${m.sender_id}` : `אל: ${m.receiver_id}`}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ===== סטטיסטיקה ===== */}
      {activeTab === 'stats' && !loading && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2"><BarChart2 size={18} className="text-blue-400" /> סטטיסטיקה מלאה</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'סה״כ קישורים', value: stats.totalLinks, icon: '🔗' },
              { label: 'שימושים נותרו', value: stats.totalRemaining, icon: '✅' },
              { label: 'קישורים חסומים', value: stats.blockedLinks, icon: '🔒' },
              { label: 'סה״כ בקשות', value: stats.totalReqs, icon: '📊' },
              { label: 'משתמשים חסומים', value: stats.blockedCount, icon: '⛔' },
              { label: 'תגובות', value: stats.feedCount, icon: '💬' },
              { label: 'משתמשים פעילים', value: usersData.length, icon: '👥' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                <div className="text-3xl mb-2">{s.icon}</div>
                <div className="text-2xl font-bold text-white">{s.value ?? 0}</div>
                <div className="text-xs text-slate-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== הגדרות ===== */}
      {activeTab === 'settings' && !loading && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-5">
          <h3 className="font-bold text-white flex items-center gap-2"><Settings size={18} className="text-blue-400" /> הגדרות מערכת</h3>

          <div className="border border-white/10 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2"><Power size={14} /> כיבוי/הפעלת אתר</h4>
            <div className="flex items-center gap-4">
              <button onClick={toggleSiteDown}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition ${siteDown ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'} text-white`}>
                <Power size={16} />{siteDown ? '✅ הפעל אתר' : '⛔ כבה אתר'}
              </button>
              <span className={`text-sm font-bold ${siteDown ? 'text-red-400' : 'text-emerald-400'}`}>
                מצב: {siteDown ? 'מושבת' : 'פעיל'}
              </span>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">הודעת מסך החסימה:</label>
              <input className="w-full p-2.5 bg-white/10 border border-white/20 text-white rounded-xl text-sm outline-none focus:border-blue-400"
                value={newSiteDownMsg} onChange={e => setNewSiteDownMsg(e.target.value)} />
            </div>
          </div>

          <div className="border border-white/10 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2"><UserPlus size={14} /> מנהלי מערכת</h4>
            <div className="space-y-1">
              {adminEmails.map(email => (
                <div key={email} className="flex justify-between items-center bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                  <span className="text-sm text-white font-mono">{email}</span>
                  {email !== 'e0556770172@gmail.com' && (
                    <button onClick={() => setAdminEmails(prev => prev.filter(e => e !== email))} className="text-red-400 hover:text-red-300 text-xs">הסר</button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="flex-1 p-2.5 bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl text-sm outline-none focus:border-blue-400"
                placeholder="מייל מנהל חדש..." value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} dir="ltr" type="email" />
              <button onClick={addAdminEmail} className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-xl text-sm font-bold transition">הוסף</button>
            </div>
          </div>

          <button onClick={saveSettings} disabled={savingSettings}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold transition disabled:opacity-50 flex justify-center items-center gap-2">
            {savingSettings ? <Loader2 size={16} className="animate-spin" /> : '💾 שמור הגדרות'}
          </button>
        </div>
      )}
    </div>
  );
};
