import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Loader2, Link2, Sparkles } from 'lucide-react';

export const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('נרשמת בהצלחה! בדוק את תיבת המייל שלך לאישור החשבון.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'התרחשה שגיאה בתהליך האימות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-800 p-4" dir="rtl">
      {/* רקע עיצובי */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-md w-full space-y-6">
        {/* לוגו */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="bg-blue-600 p-3 rounded-2xl shadow-xl shadow-blue-600/30">
              <Link2 size={32} className="text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white">שיתוף קישורי פרו</h1>
          <p className="text-blue-300 text-sm">מערכת שיתוף קישורים מאובטחת</p>
        </div>

        {/* כרטיס */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6 text-center">
            {mode === 'login' ? '👋 ברוך הבא' : '✨ הצטרף אלינו'}
          </h2>

          {error && (
            <div className="bg-red-500/20 border border-red-400/30 text-red-200 p-3 rounded-xl text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-1.5">כתובת אימייל</label>
              <input
                type="email"
                placeholder="name@example.com"
                className="w-full p-3 bg-white/10 border border-white/20 text-white placeholder-blue-300/50 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition text-left"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-1.5">סיסמה</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full p-3 bg-white/10 border border-white/20 text-white placeholder-blue-300/50 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition text-left"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50"
            >
              {loading
                ? <Loader2 className="animate-spin h-5 w-5" />
                : (<><Sparkles size={16} />{mode === 'login' ? 'התחברות' : 'הרשמה'}</>)
              }
            </button>
          </form>

          <div className="text-center mt-5">
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
              className="text-sm text-blue-300 hover:text-white transition"
            >
              {mode === 'login' ? 'אין לך חשבון? הירשם כאן' : 'כבר יש לך חשבון? התחבר כאן'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
