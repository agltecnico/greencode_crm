import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
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
  const inactiveSignOutStarted = useRef(false);
  const currentUserIdRef = useRef(null);

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
      currentUserIdRef.current = data.session?.user?.id || null;
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

      const nextUserId = nextSession?.user?.id || null;
      const userChanged = currentUserIdRef.current !== nextUserId;
      currentUserIdRef.current = nextUserId;
      setSession(nextSession);

      // Supabase refreshes the token when a background tab becomes active again.
      // Keep that refresh invisible instead of replacing the whole application
      // with ProtectedRoute's loading screen.
      if (event === 'TOKEN_REFRESHED' && !userChanged) return;

      if (userChanged) setLoading(true);
      setTimeout(() => loadProfile(nextSession?.user).finally(() => {
        if (userChanged) setLoading(false);
      }), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      inactiveSignOutStarted.current = false;
      return undefined;
    }

    const handleProfile = async nextProfile => {
      if (!nextProfile) return;
      setProfile(nextProfile);
      if (nextProfile.active !== false || inactiveSignOutStarted.current) return;

      inactiveSignOutStarted.current = true;
      await supabase.auth.signOut({ scope: 'local' });
      await Swal.fire(
        'Acceso desactivado',
        'Tu usuario ha sido desactivado por un administrador.',
        'warning'
      );
    };

    const checkCurrentProfile = async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error) await handleProfile(data);
    };

    const channel = supabase
      .channel(`user-profile-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${userId}`
        },
        payload => handleProfile(payload.new)
      )
      .subscribe();

    const intervalId = window.setInterval(checkCurrentProfile, 30000);
    const handleFocus = () => checkCurrentProfile();
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

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
