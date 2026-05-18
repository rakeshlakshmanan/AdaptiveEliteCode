import { motion } from 'motion/react';
import { Inbox, Filter, TrendingUp, Sparkles } from 'lucide-react';
import { Link } from 'react-router';

// Dashboard - No Activity
export function EmptyActivity() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-12 px-6"
    >
      <div className="w-20 h-20 rounded-2xl bg-muted/50 border border-border flex items-center justify-center mb-6">
        <Inbox className="w-10 h-10 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-bold mb-2">No activity yet</h3>
      <p className="text-sm text-muted-foreground text-center max-w-xs mb-6">
        Complete your first problem to see activity here. Start building your coding streak!
      </p>
      <Link to="/problems">
        <motion.button
          whileHover={{ scale: 1.05, boxShadow: 'var(--glow-primary)' }}
          whileTap={{ scale: 0.95 }}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-lg"
        >
          <Sparkles className="w-4 h-4" />
          Browse Problems
        </motion.button>
      </Link>
    </motion.div>
  );
}

// Problem List - No Results
export function EmptyProblems() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 px-6"
    >
      <div className="w-20 h-20 rounded-2xl bg-muted/50 border border-border flex items-center justify-center mb-6">
        <Filter className="w-10 h-10 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-bold mb-2">No problems match your filters</h3>
      <p className="text-sm text-muted-foreground text-center max-w-xs">
        Try broadening your search or adjusting your filters to see more results.
      </p>
    </motion.div>
  );
}

// Progress Page - New User
export function EmptyProgress() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute inset-0 flex flex-col items-center justify-center"
    >
      <div className="w-20 h-20 rounded-2xl bg-primary/10 border-2 border-primary/30 flex items-center justify-center mb-6">
        <TrendingUp className="w-10 h-10 text-primary" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-bold mb-2">Start your journey</h3>
      <p className="text-sm text-muted-foreground text-center max-w-xs mb-6">
        Complete problems to build your skill radar and track your progress over time.
      </p>
      <Link to="/problems">
        <motion.button
          whileHover={{ scale: 1.05, boxShadow: 'var(--glow-primary)' }}
          whileTap={{ scale: 0.95 }}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-lg"
        >
          <Sparkles className="w-4 h-4" />
          Start Practicing
        </motion.button>
      </Link>
    </motion.div>
  );
}
