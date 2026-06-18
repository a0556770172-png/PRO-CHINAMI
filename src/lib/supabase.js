import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

export const ADMIN_EMAIL = process.env.REACT_APP_ADMIN_EMAIL;
export const ADMIN_CODE = process.env.REACT_APP_ADMIN_CODE;

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
