import { motion } from 'motion/react';
import { FileQuestion, Home } from 'lucide-react';
import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-secondary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
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
              rotate: [0, -10, 10, -10, 0],
              scale: [1, 1.05, 1]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              repeatDelay: 1
            }}
            className="w-32 h-32 mx-auto mb-8 rounded-3xl bg-primary/10 border-2 border-primary/30 flex items-center justify-center"
          >
            <FileQuestion className="w-16 h-16 text-primary" strokeWidth={1.5} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <h1 className="text-6xl font-bold text-primary mb-2">404</h1>
            <h2 className="text-3xl font-bold mb-4">Lost in the code</h2>
            <p className="text-base text-muted-foreground leading-relaxed mb-8">
              This page doesn't exist. Maybe the URL changed, or maybe it never existed. 
              Either way, there's nothing here.
            </p>

            <Link to="/dashboard">
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: 'var(--glow-primary)' }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-lg"
              >
                <Home className="w-5 h-5" />
                Back to Dashboard
              </motion.button>
            </Link>

            <div className="pt-6">
              <Link 
                to="/problems"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Or browse all problems →
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
