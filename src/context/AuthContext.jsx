import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../config/supabase';

const AuthContext = createContext(null);
const FIRST_ADMIN_EMAIL = 'administracion@mygreencode.es';
const isPasswordSetupCallback = () => {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return params.get('mode') === 'invite'
    || hashParams.get('type') === 'invite'
    || hashParams.get('type') === 'recovery';
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(isPasswordSetupCallback);

  const loadProfile = async user => {
    if (!user) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
    if (error) throw error;
    setProfile(data);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      try {
        await loadProfile(data.session?.user);
      } finally {
        setLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && isPasswordSetupCallback())) {
        setRecoveryMode(true);
      }
      setSession(nextSession);
      setLoading(true);
      setTimeout(() => loadProfile(nextSession?.user).finally(() => setLoading(false)), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const hasPermission = permission =>
    profile?.active === true &&
    (profile.role === 'superadmin' || profile.permissions?.[permission] === true);

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    profile,
    loading,
    recoveryMode,
    firstAdminEmail: FIRST_ADMIN_EMAIL,
    hasPermission,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    resetPassword: email => supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`
    }),
    updatePassword: async password => {
      const result = await supabase.auth.updateUser({ password });
      if (!result.error) {
        window.history.replaceState({}, document.title, '/login');
        setRecoveryMode(false);
      }
      return result;
    },
    signOut: () => supabase.auth.signOut(),
    refreshProfile: () => loadProfile(session?.user)
  }), [session, profile, loading, recoveryMode]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
