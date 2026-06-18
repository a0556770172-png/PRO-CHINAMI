import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nepdwxbtaxtocafnpqli.supabase.co';
const supabaseAnonKey = 'sb_publishable_kfLbUjPgcRXGnscbUenmGg_474wlIIw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

export const ADMIN_EMAIL = 'E0556770172@gmail.com';
export const ADMIN_CODE = 'A331870956';
export const ROLE_LABELS = {
  level1: 'משתמש חדש',
  level2: 'מגיב מורשה',
  level3: 'נאמן האתר',
  writer: 'כתב',
  admin: 'מנהל'
};

export const ROLE_COLORS = {
  level1: '#94a3b8',
  level2: '#3b82f6',
  level3: '#8b5cf6',
  writer: '#10b981',
  admin: '#ef4444'
};
