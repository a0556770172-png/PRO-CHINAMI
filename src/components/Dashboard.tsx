import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
  Loader2, Link2, LogOut, ShieldCheck, BarChart2,
  AlertTriangle, MessageSquare, Send, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';
import { AdminDashboard } from './AdminDashboard';
import { MessagePopup } from './MessagePopup';

interface DashboardProps {
  user: any;
  siteDown: boolean;
  setSiteDown: (v: boolean) => void;
  siteDownMessage: string;
  setSiteDownMessage: (v: string) => void;
}

export const Dashboard = ({ user, siteDown, setSiteDown, siteDownMessage, setSiteDownMessage }: DashboardProps) => {
  const [links, setLinks] = useState<any[]>([]);
  const [newLink, setNewLink] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [notes, setNotes] = useState('');
  const [useCount, setUseCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'links' | 'admin'>('links');
  const [feedbackText, setFeedbackText] = useState('');
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [stats, setStats] = useState({ totalLinks: 0, totalUses: 0, totalViews: 0, totalFeedback: 0 });
  const [reportingLink, setReportingLink] = useState<string | null>(null);
  const [userReports, setUserReports] = useState<string[]>([]);

  const isAdmin = (email: string) => email?.toLowerCase() === 'e0556770172@gmail.com';
  const adminUser = isAdmin(user?.email);

  const fetchLinks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('links')
        .select('*')
        .eq('is_blocked', false)
        .gt('uses_remaining', 0)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLinks(data || []);
    } catch (error) {
      console.error('שגיאה בטעינת קישורים:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    const { count: linkCount } = await supabase.from('links').select('*', { count: 'exact', head: true });
    const { data: linksData } = await supabase.from('links').select('total_uses');
    const totalUses = linksData?.reduce((s: number, l: any) => s + (l.total_uses || 0), 0) || 0;
    const { count: feedbackCount } = await supabase.from('feedback').select('*', { count: 'exact', head: true });
    const { count: requestCount } = await supabase.from('link_requests').select('*', { count: 'exact', head: true });
    setStats({
      totalLinks: linkCount || 0,
      totalUses: totalUses,
      totalViews: requestCount || 0,
      totalFeedback: feedbackCount || 0,
    });
  }, []);

  const fetchUserReports = useCallback(async () => {
    const { data } = await supabase
      .from('link_reports')
      .select('link_id')
      .eq('user_id', user.id);
    setUserReports(data?.map((r: any) => r.link_id) || []);
  }, [user.id]);

  useEffect(() => {
    fetchLinks();
    fetchStats();
    fetchUserReports();
  }, [fetchLinks, fetchStats, fetchUserReports]);

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLink.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('links').insert([{
      url: newLink,
      creator_name: creatorName,
      notes,
      uses_remaining: useCount,
      total_uses: useCount,
      creator_id: user?.id,
      is_blocked: false,
    }]);
    if (error) {
      alert('שגיאה בהוספת הקישור: ' + error.message);
    } else {
      setNewLink(''); setCreatorName(''); setNotes('');
      await fetchLinks();
      await fetchStats();
    }
    setSubmitting(false);
  };

  const handleRequestLink = async (link: any) => {
    const userId = user?.id;
    if (!userId) { alert('עליך להיות מחובר כדי לפתוח קישורים.'); return; }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    try {
      const { count, error: countError } = await supabase
        .from('link_requests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', twentyFourHoursAgo);

      if (countError) { alert('שגיאה בבדיקת המכסות.'); return; }
      if (count !== null && count >= 3) { alert('הגעת למכסה היומית שלך (3 קישורים ל-24 שעות). נסה שוב מחר.'); return; }

      const { error: insertError } = await supabase.from('link_requests').insert([{
        user_id: userId,
        link_id: link.id,
      }]);
      if (insertError) { alert('לא ניתן לתעד את הבקשה. הקישור לא נפתח.'); return; }

      window.open(link.url, '_blank');

      const nextCount = link.uses_remaining - 1;
      if (nextCount <= 0) {
        await supabase.from('links').delete().eq('id', link.id);
      } else {
        await supabase.from('links').update({ uses_remaining: nextCount }).eq('id', link.id);
      }
      await fetchLinks();
      await fetchStats();
    } catch (err) {
      console.error('שגיאה כללית:', err);
      alert('אירעה שגיאה בלתי צפויה.');
    }
  };

  const handleReportLink = async (link: any) => {
    const userId = user?.id;
    if (!userId) return;

    // בדיקה שלא כבר דווח על הקישור
    if (userReports.includes(link.id)) {
      alert('כבר דיווחת על קישור זה.');
      return;
    }

    // ספירת דיווחים של המשתמש
    const { count } = await supabase
      .from('link_reports')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (count !== null && count >= 3) {
      // חסימת המשתמש
      await supabase.from('blocked_users').insert([{ user_id: userId, reason: 'יותר מ-3 דיווחים שגויים' }]);
      await supabase.auth.signOut();
      alert('חשבונך נחסם עקב מספר דיווחים חריג.');
      return;
    }

    // תיעוד הדיווח
    await supabase.from('link_reports').insert([{ user_id: userId, link_id: link.id }]);
    setUserReports(prev => [...prev, link.id]);

    // עדכון מונה הקישור בחזרה
    await supabase.from('links').update({ uses_remaining: link.uses_remaining + 1 }).eq('id', link.id);
    setReportingLink(null);
    await fetchLinks();
    alert('הדיווח נקלט. תודה! השימוש הוחזר לקישור.');
  };

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    setSendingFeedback(true);
    await supabase.from('feedback').insert([{
      user_id: String(user.id),
      username: user.email || user.id,
      content: feedbackText,
      type: 'comment',
    }]);
    setSendingFeedback(false);
    setFeedbackText('');
    setFeedbackSent(true);
    setTimeout(() => setFeedbackSent(false), 3000);
  };

  const handleLogout = async () => await supabase.auth.signOut();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900" dir="rtl">
      {/* הודעות מנהל */}
      <MessagePopup userId={user.id} />

      {/* הדר */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl">
              <Link2 size={20} className="text-white" />
            </div>
            <span className="font-bold text-white text-lg hidden sm:block">שיתוף קישורי פרו</span>
          </div>

          <nav className="flex gap-1">
            <button
              onClick={() => setActiveTab('links')}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition ${activeTab === 'links' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
              🔗 קישורים
            </button>
            {adminUser && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-4 py-2 rounded-xl font-bold text-sm transition flex items-center gap-1.5 ${activeTab === 'admin' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
              >
                <ShieldCheck size={16} /> ניהול
              </button>
            )}
          </nav>

          <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 transition flex items-center gap-2 text-sm">
            <LogOut size={18} />
            <span className="hidden sm:block">התנתק</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {activeTab === 'links' ? (
          <>
            {/* סטטיסטיקה */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'קישורים זמינים', value: stats.totalLinks, icon: '🔗', color: 'from-blue-600 to-blue-700' },
                { label: 'סה״כ שימושים', value: stats.totalUses, icon: '📊', color: 'from-emerald-600 to-emerald-700' },
                { label: 'צפיות/בקשות', value: stats.totalViews, icon: '👁️', color: 'from-violet-600 to-violet-700' },
                { label: 'תגובות', value: stats.totalFeedback, icon: '💬', color: 'from-amber-600 to-amber-700' },
              ].map(stat => (
                <div key={stat.label} className={`bg-gradient-to-br ${stat.color} rounded-2xl p-4 shadow-lg`}>
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-white/70 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* טופס הוספת קישור */}
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Link2 className="text-blue-400" size={20} /> שתף קישור חדש
              </h2>
              <form onSubmit={handleAddLink} className="space-y-3">
                <input
                  className="w-full p-3 bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                  placeholder="הכנס את הקישור כאן..."
                  value={newLink}
                  onChange={e => setNewLink(e.target.value)}
                  required
                  dir="ltr"
                />
                <div className="flex gap-2 flex-wrap">
                  <input
                    className="flex-1 min-w-32 p-3 bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder="שם המפרסם (אופציונלי)..."
                    value={creatorName}
                    onChange={e => setCreatorName(e.target.value)}
                  />
                  <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3">
                    <span className="text-sm text-slate-300">שימושים:</span>
                    <input
                      type="number" min="1" max="100"
                      className="w-14 p-2 bg-transparent text-white outline-none text-center font-bold"
                      value={useCount}
                      onChange={e => setUseCount(Number(e.target.value))}
                    />
                  </div>
                </div>
                <input
                  className="w-full p-3 bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                  placeholder="הערות לגבי הקישור..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
                <button
                  disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition shadow-lg shadow-blue-600/30 disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : '🚀 פרסם קישור'}
                </button>
              </form>
            </div>

            {/* רשימת קישורים */}
            <div className="space-y-3">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <BarChart2 size={20} className="text-blue-400" /> קישורים פעילים
                <button onClick={fetchLinks} className="mr-auto text-slate-400 hover:text-white transition">
                  <RefreshCw size={16} />
                </button>
              </h3>

              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-400" size={36} /></div>
              ) : links.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-4xl mb-3">🔍</p>
                  <p>אין קישורים פעילים כרגע.</p>
                </div>
              ) : (
                links.map((link) => (
                  <div key={link.id} className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 hover:border-blue-500/40 transition group">
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-lg">{link.creator_name || 'אנונימי'}</p>
                        {link.notes && <p className="text-sm text-slate-400 mt-1 line-clamp-2">{link.notes}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                        <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-bold">
                          {link.uses_remaining} שימושים נותרו
                        </span>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => handleRequestLink(link)}
                            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-sm font-bold transition shadow-md"
                          >
                            🔓 בקש קישור
                          </button>
                          <button
                            onClick={() => setReportingLink(reportingLink === link.id ? null : link.id)}
                            className={`px-3 py-2 rounded-xl text-sm transition border ${userReports.includes(link.id) ? 'bg-orange-500/20 border-orange-500/30 text-orange-300 cursor-not-allowed' : 'border-white/10 text-slate-400 hover:text-orange-400 hover:border-orange-400/30'}`}
                            disabled={userReports.includes(link.id)}
                            title="דווח על קישור לא תקין"
                          >
                            <AlertTriangle size={16} />
                          </button>
                        </div>
                        {/* אזור דיווח */}
                        {reportingLink === link.id && !userReports.includes(link.id) && (
                          <div className="mt-1 w-full bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 text-sm text-orange-200">
                            <p className="mb-2">האם הקישור לא עבד לך? לחץ לאישור הדיווח.</p>
                            <p className="text-xs text-orange-300/70 mb-3">⚠️ מעל 3 דיווחים שגויים יגרמו לחסימת החשבון.</p>
                            <button
                              onClick={() => handleReportLink(link)}
                              className="w-full bg-orange-600 hover:bg-orange-500 text-white py-1.5 rounded-lg font-bold text-xs transition"
                            >
                              ✅ אישור – קישור לא עבד
                            </button>
                          </div>
                        )}
                        {userReports.includes(link.id) && (
                          <span className="text-xs text-orange-300">✓ דווח</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* תגובות ומשוב */}
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <MessageSquare size={18} className="text-blue-400" /> הערות, תגובות ובאגים
              </h3>
              <form onSubmit={handleSendFeedback} className="space-y-3">
                <textarea
                  className="w-full p-3 bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition resize-none h-24"
                  placeholder="כתוב הערה, הצעה לשיפור, או דיווח על באג..."
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                />
                <button
                  disabled={sendingFeedback || !feedbackText.trim()}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl font-bold text-sm transition disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {feedbackSent
                    ? '✅ נשלח! תודה'
                    : sendingFeedback
                    ? <Loader2 className="animate-spin" size={16} />
                    : <><Send size={14} /> שלח תגובה</>
                  }
                </button>
              </form>
            </div>
          </>
        ) : (
          <AdminDashboard
            user={user}
            siteDown={siteDown}
            setSiteDown={setSiteDown}
            siteDownMessage={siteDownMessage}
            setSiteDownMessage={setSiteDownMessage}
          />
        )}
      </main>
    </div>
  );
};
