import { motion } from 'motion/react';
import { Clock, ArrowRight, X } from 'lucide-react';
import { Link } from 'react-router';

interface IncompleteSessionBannerProps {
  problemSlug: string;
  problemTitle: string;
  timeAgo: string;
  onDiscard: () => void;
}

export function IncompleteSessionBanner({ problemSlug, problemTitle, timeAgo, onDiscard }: IncompleteSessionBannerProps) {
  if (!problemTitle || !problemSlug) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className="bg-gradient-to-r from-primary/10 via-accent-secondary/10 to-primary/10 border-2 border-primary/30 rounded-2xl p-5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/20 border border-primary/30">
            <Clock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold text-primary uppercase tracking-wide mb-1">
              Continue where you left off
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">{problemTitle}</span>
              <span className="text-sm text-muted-foreground">· started {timeAgo}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to={`/problems/${problemSlug}`}>
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: 'var(--glow-primary)' }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-lg"
            >
              Resume
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </Link>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onDiscard}
            title="Discard session"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
