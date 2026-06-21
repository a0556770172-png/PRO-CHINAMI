import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, ADMIN_EMAIL } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [siteDisabled, setSiteDisabled] = useState(false);
  const [disabledMessage, setDisabledMessage] = useState('האתר מושבת זמנית לתחזוקה. נחזור בקרוב!');

  // טעינת הגדרות האתר (פעיל/מושבת)
  const loadSiteSettings = async () => {
    try {
      const { data } = await supabase.from('site_settings').select('*');
      if (data) {
        const settings = {};
        data.forEach(row => { settings[row.key] = row.value; });
        setSiteDisabled(settings['is_disabled'] === 'true');
        if (settings['disabled_message']) setDisabledMessage(settings['disabled_message']);
      }
    } catch (err) {
      // טבלה לא קיימת עדיין — מתעלמים
    }
  };

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && data) {
        if (data.is_blocked) {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          alert('החשבון שלך חסום. פנה למנהל האתר.');
          return;
        }
        setProfile(data);
        await supabase.rpc('record_user_activity', { p_user_id: userId, p_active_minutes: 1 });
        await supabase.rpc('auto_upgrade_users');
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
    }
  };

  useEffect(() => {
    loadSiteSettings();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    // האזנה לשינויים בהגדרות האתר בזמן אמת
    const settingsChannel = supabase
      .channel('site_settings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, () => {
        loadSiteSettings();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(settingsChannel);
    };
  }, []);

  const signUp = async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } }
    });
    return { data, error };
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { data, error };

    const { data: profileData } = await supabase
      .from('profiles')
      .select('is_blocked')
      .eq('id', data.user.id)
      .single();

    if (profileData?.is_blocked) {
      await supabase.auth.signOut();
      return { data: null, error: { message: 'החשבון שלך חסום. פנה למנהל האתר.' } };
    }

    return { data, error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (updates) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    if (!error) setProfile(data);
    return { data, error };
  };

  const isAdmin = profile?.role === 'admin';
  const isWriter = profile?.role === 'writer' || isAdmin;
  const canComment = ['level2', 'level3', 'writer', 'admin'].includes(profile?.role);
  const canPost = ['writer', 'admin', 'level3'].includes(profile?.role);
  // מנהל ראשי — רק מהמייל הייעודי
  const isSuperAdmin = isAdmin && user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signUp, signIn, signOut, updateProfile,
      isAdmin, isWriter, canComment, canPost, isSuperAdmin,
      siteDisabled, disabledMessage,
      fetchProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}
