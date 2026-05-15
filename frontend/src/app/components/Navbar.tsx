import { Link, useLocation } from 'react-router';
import { LayoutDashboard, BookOpen, TrendingUp, Settings, Menu, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  variant?: 'landing' | 'app';
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function Navbar({ variant = 'app' }: NavbarProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { profile, user } = useAuth();

  const appLinks = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/problems', label: 'Problems', icon: BookOpen },
    { path: '/progress', label: 'Progress', icon: TrendingUp },
  ];

  if (variant === 'landing') {
    return (
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 group" aria-label="EliteCode Home">
              <motion.div 
                whileHover={{ scale: 1.05, rotate: 5 }}
                className="text-3xl"
                aria-hidden="true"
              >
                ⚡
              </motion.div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary via-accent-secondary to-accent-tertiary bg-clip-text text-transparent">
                EliteCode
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link to="/login">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
                >
                  Sign In
                </motion.button>
              </Link>
              <Link to="/signup">
                <motion.button
                  whileHover={{ scale: 1.02, boxShadow: 'var(--glow-primary)' }}
                  whileTap={{ scale: 0.98 }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg gradient-primary text-primary-foreground shadow-lg"
                >
                  Get Started
                </motion.button>
              </Link>
            </div>
          </div>
        </div>
      </motion.nav>
    );
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="flex items-center gap-2 group" aria-label="EliteCode Dashboard">
              <motion.div 
                whileHover={{ scale: 1.1, rotate: 10 }}
                className="text-2xl"
                aria-hidden="true"
              >
                ⚡
              </motion.div>
              <span className="text-lg font-bold bg-gradient-to-r from-primary via-accent-secondary to-accent-tertiary bg-clip-text text-transparent">
                EliteCode
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {appLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;
                return (
                  <Link key={link.path} to={link.path}>
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {link.label}
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
          </button>

          {/* Desktop user menu */}
          <div className="hidden md:flex items-center gap-3">
            {/* XP and Level */}
            {profile && (
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-3 px-4 py-2 rounded-lg bg-muted/50 border border-border"
              >
                <div className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-primary">
                    {(profile.xp || 0).toLocaleString()} XP
                  </span>
                </div>
                <div className="w-px h-4 bg-border" />
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-primary">
                    Lvl {profile.level || 1}
                  </span>
                </div>
              </motion.div>
            )}
            
            <Link to="/settings">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                aria-label="Settings"
              >
                <Settings className="w-5 h-5" aria-hidden="true" />
              </motion.button>
            </Link>

            <ThemeToggle />
            
            <Link to="/profile" aria-label="View profile">
              <motion.div
                whileHover={{ scale: 1.05, boxShadow: 'var(--glow-primary)' }}
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-sm cursor-pointer shadow-lg overflow-hidden"
              >
                {(profile?.avatar_url || user?.user_metadata?.avatar_url) ? (
                  <img
                    src={profile?.avatar_url || user?.user_metadata?.avatar_url}
                    alt={`${profile?.display_name || 'User'} profile`}
                    className="w-10 h-10 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  getInitials(profile?.display_name || user?.user_metadata?.full_name)
                )}
              </motion.div>
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border bg-card"
          >
            <div className="px-4 py-4 space-y-2">
              {appLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;
                return (
                  <Link key={link.path} to={link.path} onClick={() => setMobileMenuOpen(false)}>
                    <div
                      className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {link.label}
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}