import { motion, AnimatePresence } from 'motion/react';
import { Check, ArrowRight, TrendingUp, Sparkles, X } from 'lucide-react';
import { useEffect } from 'react';
import confetti from 'canvas-confetti';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  problemTitle: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  testCasesPassed: number;
  totalTestCases: number;
  runtime: string;
  xpGained?: number;
  masteryBefore: number;
  masteryAfter: number;
  masteryGain: number;
  problemsToUnlock?: number;
  unlockedDifficulty?: string;
  nextProblem?: {
    title: string;
    difficulty: 'easy' | 'medium' | 'hard';
    topic: string;
  };
  onNextProblem?: () => void;
  onViewSolution?: () => void;
  onBackToDashboard?: () => void;
}

export function SuccessModal({
  isOpen,
  onClose,
  problemTitle,
  difficulty,
  topic,
  testCasesPassed,
  totalTestCases,
  runtime,
  xpGained,
  masteryBefore,
  masteryAfter,
  masteryGain,
  problemsToUnlock,
  unlockedDifficulty,
  nextProblem,
  onNextProblem,
  onViewSolution,
  onBackToDashboard,
}: SuccessModalProps) {
  useEffect(() => {
    if (isOpen) {
      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#22C55E', '#34D399', '#10B981', '#059669'],
      });
    }
  }, [isOpen]);

  const difficultyColors = {
    easy: 'text-success',
    medium: 'text-warning',
    hard: 'text-error',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl pointer-events-auto overflow-hidden"
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="text-center pt-12 pb-6 px-8">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 20 }}
                  className="w-24 h-24 mx-auto mb-6 rounded-full bg-success/20 flex items-center justify-center"
                >
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 15 }}
                    className="w-20 h-20 rounded-full bg-success flex items-center justify-center shadow-lg"
                  >
                    <motion.div
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: 0.6, duration: 0.5, ease: 'easeOut' }}
                    >
                      <Check className="w-12 h-12 text-white" strokeWidth={3} />
                    </motion.div>
                  </motion.div>
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-3xl font-bold mb-2"
                >
                  Problem Solved!
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-base text-muted-foreground"
                >
                  All {testCasesPassed} test cases passed · {runtime}
                </motion.p>
              </div>

              {/* Content */}
              <div className="px-8 pb-8 space-y-6">
                {/* XP Reward */}
                {xpGained !== undefined && xpGained > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.45, type: 'spring', stiffness: 300, damping: 20 }}
                    className="flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-primary/10 border border-primary/20"
                  >
                    <Sparkles className="w-6 h-6 text-primary" />
                    <span className="text-2xl font-bold text-primary">+{xpGained} XP</span>
                  </motion.div>
                )}

                {/* Mastery Progress */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="p-6 rounded-2xl bg-muted/50 border border-border"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{topic}</span>
                      <span className="text-muted-foreground">—</span>
                      <span className={`capitalize font-medium ${difficultyColors[difficulty]}`}>
                        {difficulty}
                      </span>
                    </div>
                    <TrendingUp className="w-5 h-5 text-success" />
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2 mb-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Your {topic} mastery improved
                    </div>
                    <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                      {/* Old mastery (dimmer) */}
                      <div 
                        className="absolute inset-y-0 left-0 bg-success/30 rounded-full"
                        style={{ width: `${masteryBefore}%` }}
                      />
                      {/* New gain (brighter) */}
                      <motion.div
                        initial={{ width: `${masteryBefore}%` }}
                        animate={{ width: `${masteryAfter}%` }}
                        transition={{ delay: 0.7, duration: 1.2, ease: 'easeOut' }}
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-success to-success-light rounded-full shadow-md"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-sm text-muted-foreground">{masteryBefore}%</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-base font-bold text-foreground">{masteryAfter}%</span>
                    </div>
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 1.8, type: 'spring', stiffness: 300 }}
                      className="px-3 py-1.5 rounded-lg bg-success/20 border border-success/30"
                    >
                      <span className="font-bold text-success text-sm">+{masteryGain}%</span>
                    </motion.div>
                  </div>

                  {problemsToUnlock && (
                    <p className="text-xs text-muted-foreground mt-3">
                      {problemsToUnlock} more problem{problemsToUnlock > 1 ? 's' : ''} to unlock {unlockedDifficulty || 'Medium'}
                    </p>
                  )}
                </motion.div>

                {/* Unlocked Banner */}
                {unlockedDifficulty && !problemsToUnlock && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.7 }}
                    className="p-4 rounded-xl bg-info/10 border border-info/30 flex items-center gap-3"
                  >
                    <Sparkles className="w-5 h-5 text-info" />
                    <span className="font-semibold text-info">
                      {unlockedDifficulty} {topic} problems unlocked!
                    </span>
                  </motion.div>
                )}

                {/* Next Problem */}
                {nextProblem && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="p-6 rounded-2xl bg-muted/30 border border-border"
                  >
                    <p className="text-sm text-muted-foreground mb-3">Up next:</p>
                    <h3 className="font-bold text-lg mb-3">{nextProblem.title}</h3>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          nextProblem.difficulty === 'easy'
                            ? 'bg-easy-bg text-easy border border-easy-border'
                            : nextProblem.difficulty === 'medium'
                            ? 'bg-medium-bg text-warning border border-medium-border'
                            : 'bg-hard-bg text-error border border-hard-border'
                        }`}
                      >
                        {nextProblem.difficulty.charAt(0).toUpperCase() + nextProblem.difficulty.slice(1)}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                        {nextProblem.topic}
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Action Buttons */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  className="space-y-3"
                >
                  <div className="flex gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02, boxShadow: 'var(--glow-primary)' }}
                      whileTap={{ scale: 0.98 }}
                      onClick={onNextProblem}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-lg"
                    >
                      Next Problem
                      <ArrowRight className="w-5 h-5" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={onViewSolution}
                      className="flex-1 px-6 py-3.5 rounded-xl border-2 border-border hover:bg-muted transition-colors font-semibold"
                    >
                      View Solution
                    </motion.button>
                  </div>

                  <button
                    onClick={onBackToDashboard}
                    className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                  >
                    Back to Dashboard
                  </button>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}