import { motion } from 'motion/react';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);

  // Supabase fires PASSWORD_RECOVERY when the user arrives via the reset link.
  // We wait for that event before allowing the form to be submitted.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    // If session already exists (token in hash already exchanged), mark ready too
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) { setError('Please enter a new password.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    setError('');
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent-tertiary/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <Link to="/" className="inline-flex items-center gap-2 mb-2 group">
            <motion.div whileHover={{ scale: 1.1, rotate: 10 }} className="text-4xl">⚡</motion.div>
            <span className="text-2xl font-bold bg-gradient-to-r from-primary via-accent-secondary to-accent-tertiary bg-clip-text text-transparent">
              EliteCode
            </span>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-8 shadow-xl"
        >
          {done ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Password updated!</h1>
              <p className="text-muted-foreground">Redirecting you to sign in…</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold mb-2">Set new password</h1>
                <p className="text-muted-foreground">Enter a new password for your account</p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-error/10 border border-error/20 text-error text-sm" role="alert" aria-live="polite">
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {error}
                </div>
              )}

              {!ready && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-warning/10 border border-warning/20 text-warning text-sm" role="status" aria-live="polite">
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  Verifying reset link… if this takes too long, request a new link.
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full h-11 pl-10 pr-12 rounded-lg bg-input border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirm" className="text-sm font-medium">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      id="confirm"
                      type={showPassword ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full h-11 pl-10 pr-4 rounded-lg bg-input border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  type="submit"
                  disabled={loading || !ready}
                  className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Updating…' : 'Update Password'}
                </motion.button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                <Link to="/login" className="text-primary hover:underline font-medium">Back to Sign In</Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
