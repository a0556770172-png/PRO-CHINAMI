import { ROLE_LABELS, ROLE_COLORS } from './supabase';

export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('he-IL', { year:'numeric', month:'long', day:'numeric' });
  } catch { return dateStr; }
}

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'לפני רגע';
  if (diff < 3600) return `לפני ${Math.floor(diff/60)} דקות`;
  if (diff < 86400) return `לפני ${Math.floor(diff/3600)} שעות`;
  if (diff < 604800) return `לפני ${Math.floor(diff/86400)} ימים`;
  return formatDate(dateStr);
}

export function slugify(text) {
  return text
    .toString()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0590-\u05FF-]/g, '')
    .replace(/--+/g, '-')
    .trim()
    + '-' + Math.random().toString(36).substr(2, 6);
}

export function getRoleBadge(role) {
  return { label: ROLE_LABELS[role] || role, color: ROLE_COLORS[role] || '#94a3b8' };
}

export const EMOJIS = [
  { emoji: '👍', label: 'לייק' },
  { emoji: '❤️', label: 'אהבה' },
  { emoji: '😂', label: 'מצחיק' },
  { emoji: '😮', label: 'מפתיע' },
  { emoji: '👏', label: 'כל הכבוד' },
  { emoji: '🔥', label: 'חם' },
];
