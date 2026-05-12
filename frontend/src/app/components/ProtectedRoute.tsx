import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}

export function ProtectedRoute({ children, requireOnboarding = true }: ProtectedRouteProps) {
  const { user, profile, loading, refreshProfile } = useAuth();
  const location = useLocation();

  // Retry counter — if profile is null after auth resolves, attempt one re-fetch
  // before giving up. This handles the edge case where getSession() resolves but
  // fetchProfile failed transiently (network blip, cold DB connection, etc.).
  const retried = useRef(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!loading && user && !profile && !retried.current && !retrying) {
      retried.current = true;
      setRetrying(true);
      refreshProfile().finally(() => setRetrying(false));
    }
    if (!user) {
      // Reset retry state on sign-out so the next login gets a fresh attempt
      retried.current = false;
    }
  }, [loading, user, profile, retrying, refreshProfile]);

  // Still initializing auth
  if (loading || retrying) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Profile fetch failed even after retry — likely a DB/RLS issue.
  // Show an error instead of an infinite loop.
  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 text-center px-4">
          <div className="text-4xl">⚠️</div>
          <div>
            <p className="font-semibold text-lg mb-1">Failed to load your profile</p>
            <p className="text-sm text-muted-foreground">
              There was a problem reaching the server. Please check your connection and try again.
            </p>
          </div>
          <button
            onClick={() => {
              retried.current = false;
              window.location.reload();
            }}
            className="px-6 py-2 rounded-lg gradient-primary text-white font-semibold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Onboarding route: already completed → skip to dashboard
  if (!requireOnboarding && profile.onboarding_completed) {
    return <Navigate to="/dashboard" replace />;
  }

  // App routes: onboarding not done → send there
  if (requireOnboarding && !profile.onboarding_completed) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
