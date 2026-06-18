import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AuthPage() {
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ email:'', password:'', displayName:'' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) { navigate('/'); return null; }

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.email || !form.password) { setError('נא למלא את כל השדות'); return; }
    setLoading(true);

    if (mode === 'login') {
      const { error } = await signIn(form.email.toLowerCase().trim(), form.password);
      if (error) setError('שגיאה בהתחברות: ' + (error.message === 'Invalid login credentials' ? 'פרטים שגויים' : error.message));
      else navigate('/');
    } else {
      if (!form.displayName.trim()) { setError('נא להזין שם תצוגה'); setLoading(false); return; }
      const { error } = await signUp(form.email, form.password, form.displayName);
      if (error) setError('שגיאה בהרשמה: ' + error.message);
      else setSuccess('נרשמת בהצלחה! בדוק את המייל לאימות ואז התחבר.');
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
          <Link to="/" style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', marginBottom:'1.5rem' }}>
            <div style={{ width:40, height:40, background:'var(--accent)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem' }}>⚔</div>
            <span style={{ fontFamily:'var(--font-display)', fontSize:'1.4rem', fontWeight:900 }}>חוד <span style={{ color:'var(--accent)' }}>החנית</span></span>
          </Link>
          <h1 className="auth-title">{mode === 'login' ? 'ברוך הבא' : 'הצטרף אלינו'}</h1>
          <p className="auth-subtitle">
            {mode === 'login' ? 'התחבר לחשבונך' : 'צור חשבון חינמי'}
          </p>
        </div>

        <div style={{ display:'flex', gap:'0', marginBottom:'2rem', background:'var(--bg-secondary)', borderRadius:'var(--radius-sm)', padding:'4px' }}>
          {['login','register'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setSuccess(''); }}
              className="btn" style={{ flex:1, justifyContent:'center',
                background: mode === m ? 'var(--bg-card)' : 'transparent',
                color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                border: mode === m ? '1px solid var(--border)' : '1px solid transparent',
              }}>
              {m === 'login' ? 'כניסה' : 'הרשמה'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">שם תצוגה</label>
              <input name="displayName" type="text" className="form-input"
                placeholder="איך תרצה להיקרא?" value={form.displayName} onChange={handleChange} />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">כתובת מייל</label>
            <input name="email" type="email" className="form-input"
              placeholder="your@email.com" value={form.email} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">סיסמה</label>
            <input name="password" type="password" className="form-input"
              placeholder="לפחות 6 תווים" value={form.password} onChange={handleChange} />
          </div>

          {error && <div className="alert alert-error">⚠️ {error}</div>}
          {success && <div className="alert alert-success">✅ {success}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}
            style={{ justifyContent:'center', marginTop:'0.5rem', padding:'0.75rem' }}>
            {loading ? <><div className="spinner" style={{ width:16, height:16 }}></div> מעבד...</>
              : mode === 'login' ? '🔑 כניסה' : '📝 הרשמה'}
          </button>
        </form>
      </div>
    </div>
  );
}
