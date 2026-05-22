import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, ArrowLeft, Check, Sparkles, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../context/AuthContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

// ─── Value maps: UI label → DB / API snake_case ───────────────────────────
const BACKGROUND_MAP: Record<string, string> = {
  'CS Student':      'cs_undergrad',
  'Bootcamp':        'bootcamp',
  'Self-Taught':     'self_taught',
  'Career Switcher': 'career_switch',
};

const PRIOR_EXP_MAP: Record<string, string> = {
  'none':    'none',
  'under50': 'under_50',
  '50-200':  '50_to_200',
  '200+':    'over_200',
};

const TIMELINE_MAP: Record<string, string> = {
  'urgent':    'under_2_weeks',
  'short':     '1_to_3_months',
  'medium':    '3_plus_months',
  'exploring': 'exploring',
};

// Maps company group labels → individual company slugs used in problem_topics
const COMPANY_MAP: Record<string, string[]> = {
  'FAANG':    ['google', 'meta', 'amazon', 'apple', 'netflix'],
  'Big Tech': ['microsoft', 'google', 'amazon', 'apple', 'meta'],
  'Startups': ['startup'],
  'Fintech':  ['stripe', 'paypal', 'square'],
  'General':  [],
};

// ─── Static option arrays (display only) ─────────────────────────────────
const experienceLevels = [
  { value: 'beginner',     label: 'Beginner',     emoji: '🌱', desc: 'Just getting started' },
  { value: 'intermediate', label: 'Intermediate', emoji: '📈', desc: 'Some experience' },
  { value: 'advanced',     label: 'Advanced',     emoji: '⚡', desc: 'Seasoned coder' },
];

const backgrounds = ['CS Student', 'Bootcamp', 'Self-Taught', 'Career Switcher'];

const priorExperience = [
  { value: 'none',    label: 'None' },
  { value: 'under50', label: '<50' },
  { value: '50-200',  label: '50–200' },
  { value: '200+',    label: '200+' },
];

const targetCompanies = ['FAANG', 'Big Tech', 'Startups', 'Fintech', 'General'];

const timelines = [
  { value: 'urgent',    label: 'Under 2 weeks', emoji: '🔥', desc: 'Interview soon!' },
  { value: 'short',     label: '1–3 months',    emoji: '📅', desc: 'Active job search' },
  { value: 'medium',    label: '3+ months',     emoji: '⏳', desc: 'Building skills' },
  { value: 'exploring', label: 'Exploring',     emoji: '🧭', desc: 'No rush' },
];

const languages = [
  { value: 'python',     label: 'Python',     color: 'from-blue-500 to-yellow-500' },
  { value: 'java',       label: 'Java',       color: 'from-red-500 to-orange-500' },
  { value: 'cpp',        label: 'C++',        color: 'from-blue-600 to-purple-600' },
  { value: 'javascript', label: 'JavaScript', color: 'from-yellow-400 to-yellow-600' },
  { value: 'go',         label: 'Go',         color: 'from-cyan-500 to-blue-500' },
];

const commitments = [
  { value: 'casual',  label: 'Casual',  range: '3–5/week',  desc: 'Light practice' },
  { value: 'steady',  label: 'Steady',  range: '5–10/week', desc: 'Regular progress' },
  { value: 'intense', label: 'Intense', range: '10+/week',  desc: 'Maximum growth' },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, profile, loading, refreshProfile } = useAuth();

  // Already onboarded → skip to dashboard
  useEffect(() => {
    if (!loading && profile?.onboarding_completed) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, profile, navigate]);

  const [step, setStep]           = useState(1);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  // Step 1
  const [experience, setExperience] = useState('');
  const [background, setBackground] = useState('');
  const [problems, setProblems]     = useState('');

  // Step 2
  const [companies, setCompanies] = useState<string[]>([]);
  const [timeline, setTimeline]   = useState('');

  // Step 3
  const [language, setLanguage]     = useState('');
  const [commitment, setCommitment] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium'>('easy');

  // ─── helpers ─────────────────────────────────────────────────────────
  function resolveCompanySlugs(groups: string[]): string[] {
    const slugSet = new Set<string>();
    groups.forEach(g => COMPANY_MAP[g]?.forEach(s => slugSet.add(s)));
    return [...slugSet];
  }

  const canProceed = () => {
    if (step === 1) return experience && background && problems;
    if (step === 2) return companies.length > 0 && timeline;
    if (step === 3) return language && commitment;
    return false;
  };

  // ─── save to Supabase ─────────────────────────────────────────────────
  async function saveOnboarding() {
    if (!user) return;
    setSaving(true);
    setError('');

    const stereotypeKey = `${experience}_${BACKGROUND_MAP[background]}`;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        experience_level:    experience,
        background:          BACKGROUND_MAP[background],
        prior_platform_exp:  PRIOR_EXP_MAP[problems],
        target_companies:    resolveCompanySlugs(companies),
        interview_timeline:  TIMELINE_MAP[timeline],
        preferred_language:  language,
        weekly_commitment:   commitment,
        starting_difficulty: difficulty,
        stereotype_key:      stereotypeKey,
        onboarding_completed: true,
      })
      .eq('id', user.id);

    setSaving(false);

    if (updateError) {
      setError('Failed to save your preferences. Please try again.');
      return;
    }

    // Initialize BKT priors based on declared experience (best-effort)
    if (BACKEND_URL) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        fetch(`${BACKEND_URL}/onboarding/init-priors`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            experience_level: experience,
            prior_platform_exp: PRIOR_EXP_MAP[problems],
            background: BACKGROUND_MAP[background] ?? '',
          }),
        }).catch(() => {}); // fire-and-forget
      }
    }

    // Refresh profile in context so ProtectedRoute sees onboarding_completed = true
    await refreshProfile();

    // Fire confetti then navigate
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#FF6B35', '#F7931E', '#FF8C42', '#FFB366', '#FF9E4E'],
    });
    setTimeout(() => navigate('/dashboard'), 1000);
  }

  async function handleSkip() {
    if (!user) { navigate('/dashboard'); return; }
    await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', user.id);
    await refreshProfile();
    navigate('/dashboard');
  }

  function handleNext() {
    if (step < 3) {
      setStep(step + 1);
    } else {
      saveOnboarding();
    }
  }

  const toggleCompany = (company: string) =>
    setCompanies(prev =>
      prev.includes(company) ? prev.filter(c => c !== company) : [...prev, company]
    );

  // ─── render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/40 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent-secondary/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-3xl relative z-10">
        {/* Progress Bar */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold">Getting Started</span>
            </div>
            <span className="text-sm font-medium text-primary">{step}/3</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(step / 3) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full gradient-primary"
            />
          </div>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card border border-border rounded-3xl p-8 md:p-12 shadow-2xl"
        >
          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 p-3 mb-6 rounded-lg bg-error/10 border border-error/20 text-error text-sm" role="alert" aria-live="polite">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* ── STEP 1 ── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-3xl md:text-4xl font-bold">Tell us about yourself</h2>
                  <p className="text-muted-foreground">Help us personalise your learning path</p>
                </div>

                {/* Experience */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Your Experience</label>
                  <div className="grid md:grid-cols-3 gap-4">
                    {experienceLevels.map((lvl) => (
                      <motion.button
                        key={lvl.value}
                        whileHover={{ scale: 1.03, y: -4 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setExperience(lvl.value)}
                        className={`relative p-8 rounded-2xl border-2 transition-all duration-200 ${
                          experience === lvl.value
                            ? 'border-primary bg-primary/10 shadow-xl scale-105'
                            : 'border-border/50 bg-card hover:border-primary/40 hover:bg-primary/5 shadow-sm'
                        }`}
                      >
                        <div className="text-4xl mb-3">{lvl.emoji}</div>
                        <div className="font-bold text-lg mb-1">{lvl.label}</div>
                        <div className="text-sm text-muted-foreground">{lvl.desc}</div>
                        {experience === lvl.value && (
                          <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg"
                          >
                            <Check className="w-6 h-6 text-white" strokeWidth={3} />
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Background */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Background</label>
                  <div className="flex flex-wrap gap-3">
                    {backgrounds.map((bg) => (
                      <motion.button
                        key={bg}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setBackground(bg)}
                        className={`px-6 py-3 rounded-full border-2 font-medium transition-all ${
                          background === bg
                            ? 'border-primary bg-primary text-primary-foreground shadow-lg'
                            : 'border-border hover:border-primary/50 hover:bg-muted'
                        }`}
                      >
                        {bg}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Prior Experience */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Problems Solved Before</label>
                  <div className="p-1.5 bg-muted rounded-xl inline-flex gap-1 w-full">
                    {priorExperience.map((exp) => (
                      <button
                        key={exp.value}
                        onClick={() => setProblems(exp.value)}
                        className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all ${
                          problems === exp.value
                            ? 'bg-card shadow-md text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {exp.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-3xl md:text-4xl font-bold">What are you preparing for?</h2>
                  <p className="text-muted-foreground">We'll tailor problems to your goals</p>
                </div>

                {/* Target Companies */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Target Companies</label>
                  <div className="flex flex-wrap gap-3">
                    {targetCompanies.map((company) => {
                      const isSelected = companies.includes(company);
                      return (
                        <motion.button
                          key={company}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => toggleCompany(company)}
                          className={`px-6 py-3 rounded-full border-2 font-medium transition-all ${
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground shadow-lg'
                              : 'border-border hover:border-primary/50 hover:bg-muted'
                          }`}
                        >
                          {company}
                          {isSelected && <Check className="w-4 h-4 inline ml-2" />}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Timeline</label>
                  <div className="grid md:grid-cols-2 gap-4">
                    {timelines.map((t) => (
                      <motion.button
                        key={t.value}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setTimeline(t.value)}
                        className={`relative p-6 rounded-2xl border-2 text-left transition-all ${
                          timeline === t.value
                            ? 'border-primary bg-primary/10 shadow-lg'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        <div className="text-3xl mb-3">{t.emoji}</div>
                        <div className="font-bold text-lg mb-1">{t.label}</div>
                        <div className="text-sm text-muted-foreground">{t.desc}</div>
                        {timeline === t.value && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary flex items-center justify-center"
                          >
                            <Check className="w-5 h-5 text-white" />
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3 ── */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-3xl md:text-4xl font-bold">Set your pace</h2>
                  <p className="text-muted-foreground">Choose your preferred language and commitment</p>
                </div>

                {/* Language */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Preferred Language</label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {languages.map((lang) => (
                      <motion.button
                        key={lang.value}
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setLanguage(lang.value)}
                        className={`relative p-4 rounded-xl border-2 font-bold transition-all ${
                          language === lang.value
                            ? 'border-primary shadow-lg'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        <div className={`w-full h-1.5 rounded-full mb-3 bg-gradient-to-r ${lang.color}`} />
                        {lang.label}
                        {language === lang.value && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center"
                          >
                            <Check className="w-4 h-4 text-white" />
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Commitment */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Weekly Commitment</label>
                  <div className="grid md:grid-cols-3 gap-4">
                    {commitments.map((com) => (
                      <motion.button
                        key={com.value}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setCommitment(com.value)}
                        className={`relative p-6 rounded-2xl border-2 transition-all ${
                          commitment === com.value
                            ? 'border-primary bg-primary/10 shadow-lg'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        <div className="font-bold text-xl mb-1">{com.label}</div>
                        <div className="text-lg text-primary mb-2">{com.range}</div>
                        <div className="text-sm text-muted-foreground">{com.desc}</div>
                        {commitment === com.value && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary flex items-center justify-center"
                          >
                            <Check className="w-5 h-5 text-white" />
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Starting Difficulty */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Starting Difficulty</label>
                  <div className="p-1.5 bg-muted rounded-xl inline-flex gap-1">
                    <button
                      onClick={() => setDifficulty('easy')}
                      className={`px-8 py-3 rounded-lg font-semibold transition-all ${
                        difficulty === 'easy'
                          ? 'bg-success text-white shadow-md'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Easy
                    </button>
                    <button
                      onClick={() => setDifficulty('medium')}
                      className={`px-8 py-3 rounded-lg font-semibold transition-all ${
                        difficulty === 'medium'
                          ? 'bg-warning text-white shadow-md'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Medium
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center gap-4 mt-10 pt-6 border-t border-border">
            {step > 1 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setStep(s => s - 1)}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-border hover:bg-muted transition-colors font-medium disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: canProceed() && !saving ? 1.02 : 1, boxShadow: canProceed() ? 'var(--glow-primary)' : 'none' }}
              whileTap={{ scale: canProceed() && !saving ? 0.98 : 1 }}
              onClick={handleNext}
              disabled={!canProceed() || saving}
              className={`flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-lg ${
                canProceed() && !saving
                  ? 'gradient-primary text-primary-foreground cursor-pointer'
                  : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
              }`}
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Saving...
                </>
              ) : step === 3 ? (
                <><Sparkles className="w-5 h-5" />Start Practicing<Sparkles className="w-5 h-5" /></>
              ) : (
                <>Continue<ArrowRight className="w-5 h-5" /></>
              )}
            </motion.button>
          </div>
        </motion.div>

        {/* Skip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-6"
        >
          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now →
          </button>
        </motion.div>
      </div>
    </div>
  );
}
