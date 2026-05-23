import { motion } from 'motion/react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Link } from 'react-router';

export default function ErrorPage() {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-warning/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 text-center max-w-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <motion.div
            animate={{ 
              rotate: [0, 5, -5, 5, 0],
              scale: [1, 1.05, 1]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              repeatDelay: 1
            }}
            className="w-32 h-32 mx-auto mb-8 rounded-3xl bg-warning/10 border-2 border-warning/30 flex items-center justify-center"
          >
            <AlertTriangle className="w-16 h-16 text-warning" strokeWidth={1.5} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <h2 className="text-3xl font-bold mb-4">Something went wrong</h2>
            <p className="text-base text-muted-foreground leading-relaxed mb-8">
              We're on it. Try refreshing the page, or come back in a minute. 
              If the problem persists, we'll have it fixed soon.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: 'var(--glow-primary)' }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRefresh}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-lg"
              >
                <RefreshCw className="w-5 h-5" />
                Refresh Page
              </motion.button>

              <Link to="/dashboard">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border-2 border-border hover:bg-muted transition-colors font-semibold w-full sm:w-auto"
                >
                  <Home className="w-5 h-5" />
                  Go to Dashboard
                </motion.button>
              </Link>
            </div>

            <div className="pt-6">
              <p className="text-xs text-muted-foreground">
                Error code: 500 · If this keeps happening, contact support
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
