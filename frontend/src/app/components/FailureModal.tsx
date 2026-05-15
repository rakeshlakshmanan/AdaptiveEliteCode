import { motion, AnimatePresence } from 'motion/react';
import { Lightbulb, ArrowRight, X, Target } from 'lucide-react';

interface FailureModalProps {
  isOpen: boolean;
  onClose: () => void;
  problemTitle: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  testCasesPassed: number;
  totalTestCases: number;
  onTryAgain?: () => void;
  onViewHints?: () => void;
  onViewSolution?: () => void;
}

export function FailureModal({
  isOpen,
  onClose,
  problemTitle,
  difficulty,
  topic,
  testCasesPassed,
  totalTestCases,
  onTryAgain,
  onViewHints,
  onViewSolution,
}: FailureModalProps) {
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
                  className="w-24 h-24 mx-auto mb-6 rounded-full bg-warning/20 flex items-center justify-center"
                >
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 15 }}
                    className="w-20 h-20 rounded-full bg-warning flex items-center justify-center shadow-lg"
                  >
                    <Lightbulb className="w-12 h-12 text-white" strokeWidth={2.5} />
                  </motion.div>
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-3xl font-bold mb-2"
                >
                  Almost There!
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-base text-muted-foreground"
                >
                  {testCasesPassed} of {totalTestCases} test cases passed
                </motion.p>
              </div>

              {/* Content */}
              <div className="px-8 pb-8 space-y-6">
                {/* Supportive Message */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="p-6 rounded-2xl bg-warning/10 border-2 border-warning/30"
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-warning/20 flex-shrink-0">
                      <Target className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                      <div className="font-bold text-base mb-1 text-warning">Don't worry, we've got you</div>
                      <p className="text-sm text-foreground leading-relaxed">
                        We're adjusting your recommendations to strengthen your {topic} skills. 
                        This is all part of the learning process!
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    The system will recommend similar problems at a comfortable difficulty to help you build mastery.
                  </div>
                </motion.div>

                {/* Tips */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="space-y-3"
                >
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Next Steps
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>Try refining your approach with the hint system</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>Review the problem constraints carefully</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>Check the expected output format</span>
                    </div>
                  </div>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="space-y-3"
                >
                  <motion.button
                    whileHover={{ scale: 1.02, boxShadow: 'var(--glow-primary)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onTryAgain}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-lg"
                  >
                    Try Again
                    <ArrowRight className="w-5 h-5" />
                  </motion.button>

                  <div className="grid grid-cols-2 gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={onViewHints}
                      className="px-4 py-2.5 rounded-xl border-2 border-warning/30 bg-warning/10 hover:bg-warning/20 transition-colors font-medium text-warning"
                    >
                      View Hints
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={onViewSolution}
                      className="px-4 py-2.5 rounded-xl border-2 border-border hover:bg-muted transition-colors font-medium"
                    >
                      See Solution
                    </motion.button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
