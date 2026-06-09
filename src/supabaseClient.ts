import { createClient } from '@supabase/supabase-js';

// הכתובת החדשה שסיפקת
const supabaseUrl = 'https://xibjmtdbhdwpzqmffohm.supabase.co';
// המפתח שסיפקת
const supabaseAnonKey = 'sb_publishable_7MDKG89k9gDyolyMXPMQHw_kZJNZ4l2';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);