import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getRoleBadge } from '../lib/utils';

const UPGRADE_THRESHOLDS = {
  level1: { days: 5, minutes: 60, likes: 0, nextRole: 'level2', nextLabel: 'מגיב מורשה' },
  level2: { days: 20, minutes: 300, likes: 10, nextRole: 'level3', nextLabel: 'נאמן האתר' },
};

export default function ProfilePage() {
  const { user, profile, signOut, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  if (!user || !profile) { navigate('/auth'); return null; }

  const { label, color } = getRoleBadge(profile.role);
  const threshold = UPGRADE_THRESHOLDS[profile.role];

  async function handleSave() {
    setSaving(true);
    const { error } = await updateProfile({ display_name: displayName });
    setSaving(false);
    if (error) setMsg('שגיאה בשמירה');
    else { setMsg('נשמר בהצלחה!'); setEditing(false); }
  }

  return (
    <main className="page-content">
      <div className="container" style={{ maxWidth:700 }}>
        <div className="card" style={{ padding:'2rem', marginBottom:'1.5rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'1.2rem', marginBottom:'1.5rem' }}>
            <div style={{
              width:70, height:70, borderRadius:'50%',
              background: color, display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:'1.8rem', fontWeight:800, color:'#fff',
              flexShrink:0
            }}>
              {profile.display_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              {editing ? (
                <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                  <input className="form-input" value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    style={{ fontSize:'1.1rem', fontWeight:700, padding:'0.4rem 0.7rem' }} />
                  <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>שמור</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>ביטול</button>
                </div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
                  <h2 style={{ fontSize:'1.4rem' }}>{profile.display_name}</h2>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)} style={{ fontSize:'0.8rem' }}>✏️</button>
                </div>
              )}
              <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.3rem', alignItems:'center' }}>
                <span className="badge" style={{ color, borderColor: color+'40', background: color+'15' }}>
                  {label}
                </span>
                <span style={{ color:'var(--text-muted)', fontSize:'0.82rem' }}>{profile.email}</span>
              </div>
            </div>
          </div>

          {msg && <div className="alert alert-success" style={{ marginBottom:'1rem' }}>✅ {msg}</div>}

          {/* Stats */}
          <div className="stats-row" style={{ padding:'1.2rem 0', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)', marginBottom:'1.5rem' }}>
            <div className="stat-item">
              <span className="stat-value">🗓 {profile.login_days_count}</span>
              <span className="stat-label">ימי כניסה</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">⏱ {Math.floor((profile.total_active_minutes || 0) / 60)}:{String((profile.total_active_minutes || 0) % 60).padStart(2,'0')}</span>
              <span className="stat-label">שעות גלישה</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">❤️ {profile.received_likes_count}</span>
              <span className="stat-label">לייקים שקיבלת</span>
            </div>
          </div>

          {/* Upgrade progress */}
          {threshold && (
            <div>
              <div style={{ fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:'0.75rem', fontWeight:600 }}>
                📈 התקדמות לרמה הבאה: {threshold.nextLabel}
              </div>
              <ProgressItem
                label="ימי כניסה"
                current={profile.login_days_count}
                max={threshold.days}
              />
              <ProgressItem
                label="דקות גלישה"
                current={profile.total_active_minutes || 0}
                max={threshold.minutes}
              />
              {threshold.likes > 0 && (
                <ProgressItem
                  label="לייקים שקיבלת"
                  current={profile.received_likes_count || 0}
                  max={threshold.likes}
                />
              )}
            </div>
          )}

          {!threshold && (
            <div className="alert alert-success">🎉 הגעת לרמה המקסימלית! תודה על נאמנותך לאתר.</div>
          )}
        </div>

        <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
          <button className="btn btn-danger" onClick={async () => { await signOut(); navigate('/'); }}>
            🚪 יציאה מהחשבון
          </button>
        </div>
      </div>
    </main>
  );
}

function ProgressItem({ label, current, max }) {
  const pct = Math.min(100, Math.round((current / max) * 100));
  return (
    <div style={{ marginBottom:'0.75rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.82rem', color:'var(--text-muted)', marginBottom:'0.3rem' }}>
        <span>{label}</span>
        <span>{current} / {max}</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width:`${pct}%` }} />
      </div>
    </div>
  );
}
