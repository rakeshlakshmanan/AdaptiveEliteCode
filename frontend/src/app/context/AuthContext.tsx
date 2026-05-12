import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  xp: number;
  level: number;
  preferred_language: string;
  experience_level: string | null;
  background: string | null;
  prior_platform_exp: string | null;
  interview_timeline: string | null;
  target_companies: string[];
  stereotype_key: string | null;
  email_notifications: boolean | null;
  created_at: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, display_name, avatar_url, onboarding_completed, xp, level, preferred_language, experience_level, background, prior_platform_exp, interview_timeline, target_companies, stereotype_key, email_notifications, created_at'
    )
    .eq('id', userId)
    .single();

  if (error) {
    console.error('fetchProfile error:', error.message);
    return null;
  }
  return data as Profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Track the user ID we have a valid profile loaded for.
  // Avoids redundant fetches across auth events for the same user.
  const profileLoadedForRef = useRef<string | null>(null);

  // Stable user reference — only changes when the user ID changes,
  // NOT on every TOKEN_REFRESHED (which only rotates the access token).
  // This prevents every page's useCallback([user?.id]) from firing on refresh.
  const user = useMemo<User | null>(
    () => session?.user ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.user?.id]
  );

  const loadProfile = useCallback(async (
    userId: string,
    force = false,
    userMeta?: Record<string, unknown>,
  ) => {
    if (!force && profileLoadedForRef.current === userId) return;
    const p = await fetchProfile(userId);

    // Backfill avatar_url from OAuth provider metadata (e.g. Google) if the
    // profiles row doesn't have it yet.
    if (p && !p.avatar_url && userMeta?.avatar_url) {
      const url = userMeta.avatar_url as string;
      p.avatar_url = url;
      supabase.from('profiles').update({ avatar_url: url }).eq('id', userId).then();
    }

    setProfile(p);
    if (p) profileLoadedForRef.current = userId;
  }, []);

  useEffect(() => {
    let mounted = true;

    // Step 1: Read the current session from storage immediately (synchronous).
    // This unblocks the UI without waiting for a network round-trip.
    supabase.auth.getSession().then(({ data: { session: initial } }) => {
      if (!mounted) return;
      setSession(initial);
      if (initial?.user) {
        // Kick off profile load; setLoading(false) after it completes.
        loadProfile(initial.user.id, false, initial.user.user_metadata).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    // Step 2: Listen for auth changes (MUST be synchronous — Supabase requirement).
    // Heavy async work (profile fetch) is triggered as a side-effect, not awaited here.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;

        setSession(newSession);

        if (!newSession?.user) {
          // Signed out — clear everything
          setProfile(null);
          profileLoadedForRef.current = null;
          setLoading(false);
          return;
        }

        const uid = newSession.user.id;

        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          // Force-refresh the profile on explicit sign-in / profile update
          loadProfile(uid, true, newSession.user.user_metadata).finally(() => {
            if (mounted) setLoading(false);
          });
        } else if (event === 'TOKEN_REFRESHED') {
          // Token rotated — session is updated above; profile is unchanged.
          // Only fetch if we somehow don't have a profile yet (edge case recovery).
          if (profileLoadedForRef.current !== uid) {
            loadProfile(uid).finally(() => {
              if (mounted) setLoading(false);
            });
          }
          // Otherwise: no state changes needed, no re-renders triggered.
        }
        // INITIAL_SESSION is handled by getSession() above — ignore it here
        // to avoid a double-fetch on startup.
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    const { data: { session: current } } = await supabase.auth.getSession();
    if (!current?.user) return;
    await loadProfile(current.user.id, true);
  }, [loadProfile]);

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    profileLoadedForRef.current = null;
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
