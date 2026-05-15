import { motion, AnimatePresence } from 'motion/react';
import { SuccessModal } from '../components/SuccessModal';
import { FailureModal } from '../components/FailureModal';
import { CodeEditor } from '../components/CodeEditor';
import {
  ArrowLeft,
  Clock,
  RotateCcw,
  Settings,
  CheckCircle2,
  XCircle,
  Sparkles,
  ChevronDown,
  Lightbulb,
  Zap,
  AlertCircle,
  History,
  Info,
  Terminal,
} from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router';
import { useState, useEffect, useRef } from 'react';

const SESSION_KEY = 'elitecode_session';
const EDITOR_SETTINGS_KEY = 'elitecode_editor_settings';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import * as Collapsible from '@radix-ui/react-collapsible';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { difficultyClass } from '../lib/difficulty';

interface Example {
  input: string;
  output: string;
  explanation?: string;
}

interface SubmissionRecord {
  id: string;
  passed: boolean;
  language: string;
  code: string;
  execution_time_ms: number | null;
  test_results: any[];
  created_at: string;
}

interface ProblemData {
  id: number;
  slug: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topics: string[];
  topicIds: number[];
  companies: string[];
  acceptanceRate: number;
  description: string;
  simplifiedDescription: string;   // always a plain resolved string — never the raw JSONB
  _rawSimplifiedDesc: Record<string, string> | null; // parsed JSONB stored separately
  examples: Example[];
  constraints: string[];
  hints: string[];
  starterCode: Record<string, string>;
  xpReward: number;
}

const DEFAULT_STARTER: Record<string, string> = {
  python: '# Write your solution here\nclass Solution:\n    pass\n',
  javascript: '// Write your solution here\nvar solution = function() {\n\n};\n',
  java: '// Write your solution here\nclass Solution {\n\n}\n',
  cpp: '// Write your solution here\nclass Solution {\n\n};\n',
  go: '// Write your solution here\nfunc solution() {\n\n}\n',
};

export default function ProblemSolvePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, session } = useAuth();

  const [problem, setProblem] = useState<ProblemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const sessionRestoredRef = useRef(false);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'testcases' | 'results' | 'history'>('testcases');
  const [timer, setTimer] = useState(0);
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');
  const [testResults, setTestResults] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSimplified, setIsSimplified] = useState(false);
  const [hintUsed, setHintUsed] = useState(false); // true once any hint is revealed — passed to BKT
  const [submissionResult, setSubmissionResult] = useState<{
    masteryBefore: number;
    masteryAfter: number;
    masteryGain: number;
    xpGained: number;
    testsPassed: number;
    testsTotal: number;
    executionTime: number;
  } | null>(null);
  const [runError, setRunError] = useState('');
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [nextProblem, setNextProblem] = useState<{ title: string; slug: string; difficulty: 'easy' | 'medium' | 'hard'; topic: string } | null>(null);
  const [restoredFrom, setRestoredFrom] = useState<'draft' | 'accepted' | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [submissionsLoaded, setSubmissionsLoaded] = useState(false);
  const [viewingSubmissionBanner, setViewingSubmissionBanner] = useState<string | null>(null);

  const [editorSettings, setEditorSettings] = useState<{ fontSize: number; tabSize: number }>(() => {
    try { return { fontSize: 14, tabSize: 4, ...JSON.parse(localStorage.getItem(EDITOR_SETTINGS_KEY) || '{}') }; }
    catch { return { fontSize: 14, tabSize: 4 }; }
  });
  const [showEditorSettings, setShowEditorSettings] = useState(false);

  function updateEditorSettings(patch: Partial<{ fontSize: number; tabSize: number }>) {
    setEditorSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }

  // Load problem from Supabase
  useEffect(() => {
    if (!slug) return;
    async function load() {
      setLoading(true);
      setFetchError('');
      try {
        const { data, error } = await supabase
          .from('problems')
          .select(
            'id, slug, title, difficulty, company_frequency, description, simplified_description, test_cases, hints, starter_code, problem_topics(topic_id, topics(id, name, display_name))'
          )
          .eq('slug', slug)
          .single();

        if (error) throw error;

        const { data: statsRow } = await supabase
          .from('problem_stats')
          .select('acceptance_rate')
          .eq('problem_id', (data as any).id)
          .maybeSingle();

        const pts: any[] = (data as any).problem_topics || [];
        const topicNames: string[] = pts.map((pt) => pt.topics?.display_name || pt.topics?.name).filter(Boolean);
        const topicIds: number[] = pts.map((pt) => pt.topic_id).filter(Boolean);

        const freq = ((data as any).company_frequency || {}) as Record<string, number>;
        const companies = Object.entries(freq)
          .sort(([, a], [, b]) => b - a)
          .map(([c]) => c.charAt(0).toUpperCase() + c.slice(1));

        const starterCode = ((data as any).starter_code || {}) as Record<string, string>;

        const mapped: ProblemData = {
          id: (data as any).id,
          slug: (data as any).slug,
          title: (data as any).title,
          difficulty: (data as any).difficulty,
          topics: topicNames,
          topicIds,
          companies,
          acceptanceRate: Math.round((statsRow as any)?.acceptance_rate ?? 0),
          description: (data as any).description || '',
          simplifiedDescription: '', // resolved by the useEffect below once user+problem are ready
          _rawSimplifiedDesc: (() => {
            const rawVal = (data as any).simplified_description;
            if (!rawVal) return null;
            if (typeof rawVal === 'object') return rawVal as Record<string, string>;
            if (typeof rawVal === 'string') {
              try { return JSON.parse(rawVal) as Record<string, string>; } catch { return null; }
            }
            return null;
          })(),
          // test_cases JSONB: [{input, expected}] — map to Example shape
          examples: ((data as any).test_cases || []).map((tc: any) => ({
            input: tc.input ?? '',
            output: tc.expected ?? tc.output ?? '',
            explanation: tc.explanation,
          })) as Example[],
          constraints: [],
          hints: ((data as any).hints || []) as string[],
          starterCode,
          xpReward: 0,
        };


        setProblem(mapped);

        // Restore saved session or use starter code
        sessionRestoredRef.current = false;
        const savedRaw = localStorage.getItem(SESSION_KEY);
        if (savedRaw) {
          try {
            const saved = JSON.parse(savedRaw);
            if (saved.slug === slug && saved.code) {
              setLanguage(saved.language || 'python');
              setCode(saved.code);
              setTimer(saved.timer_seconds || 0);
              sessionRestoredRef.current = true;
              setRestoredFrom('draft');
            }
          } catch { }
        }

        // If no local draft, try to load last accepted submission
        if (!sessionRestoredRef.current && user) {
          const { data: lastAccepted } = await supabase
            .from('submissions')
            .select('code, language')
            .eq('user_id', user.id)
            .eq('problem_id', (data as any).id)
            .eq('passed', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastAccepted?.code) {
            setLanguage(lastAccepted.language || 'python');
            setCode(lastAccepted.code);
            sessionRestoredRef.current = true;
            setRestoredFrom('accepted');
            setTimeout(() => setRestoredFrom(null), 3000);
          }
        }

        if (!sessionRestoredRef.current) {
          setCode(starterCode['python'] || DEFAULT_STARTER['python']);
        }
      } catch (e: any) {
        setFetchError(e.message || 'Failed to load problem');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Adaptive description resolver ──────────────────────────────────────────
  // Runs whenever problem or user changes. Picks the right level key from the
  // pre-parsed JSONB (_rawSimplifiedDesc) based on BKT mastery. Writes only a
  // plain string into simplifiedDescription — never the raw dict.
  useEffect(() => {
    if (!problem || !user || !problem._rawSimplifiedDesc) return;
    const descObj = problem._rawSimplifiedDesc;
    const topicIds = problem.topicIds;
    if (topicIds.length === 0) return;

    async function resolveDescription() {
      const { data: masteryRows } = await supabase
        .from('user_mastery')
        .select('p_learned, attempts')
        .eq('user_id', user!.id)
        .in('topic_id', topicIds);

      const rows = (masteryRows || []) as { p_learned: number; attempts: number }[];
      const totalAttempts = rows.reduce((s, r) => s + (r.attempts || 0), 0);
      const avgMastery = rows.length
        ? rows.reduce((s, r) => s + r.p_learned, 0) / rows.length
        : 0;

      let descLevel = 'beginner'; // default for the Simplify toggle

      if (totalAttempts > 0 && avgMastery < 0.30) {
        descLevel = 'beginner';
        setIsSimplified(true);           // auto-show for struggling users
      } else if (totalAttempts > 0 && avgMastery < 0.60) {
        descLevel = 'intermediate';
        setIsSimplified(true);           // auto-show for progressing users
      }
      // first visit or mastery >= 0.60: isSimplified stays false (standard description shown)

      // Extract ONLY a plain string — never the full dict
      const resolved: string =
        (descObj as Record<string, string>)[descLevel] ||
        (descObj as Record<string, string>)['beginner'] ||
        (Object.values(descObj as Record<string, string>).find(v => typeof v === 'string') ?? '');

      setProblem(prev =>
        prev ? { ...prev, simplifiedDescription: resolved } : prev
      );
    }

    resolveDescription();
  }, [problem?.id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // ───────────────────────────────────────────────────────────────────────────

  // ── Adaptive description resolver ──────────────────────────────────────────
  // useEffect(() => {
  //   if (!problem?.id || !user?.id || !problem._rawSimplifiedDesc) return;

  //   const descObj = problem._rawSimplifiedDesc;
  //   const topicIds = problem.topicIds || [];
  //   if (topicIds.length === 0) return;

  //   async function resolveDescription() {
  //     try {
  //       const { data: masteryRows, error } = await supabase
  //         .from('user_mastery')
  //         .select('p_learned, attempts')
  //         .eq('user_id', user.id)
  //         .in('topic_id', topicIds);

  //       if (error) throw error;

  //       const rows = (masteryRows || []);
  //       const totalAttempts = rows.reduce((s, r) => s + (r.attempts || 0), 0);
  //       const avgMastery = rows.length
  //         ? rows.reduce((s, r) => s + r.p_learned, 0) / rows.length
  //         : 0;

  //       let descLevel = 'beginner';

  //       // Logic based on your P(L) specs
  //       if (totalAttempts > 0) {
  //         if (avgMastery < 0.30) {
  //           descLevel = 'beginner';
  //           setIsSimplified(true);
  //         } else if (avgMastery < 0.60) {
  //           descLevel = 'intermediate';
  //           setIsSimplified(true);
  //         } else {
  //           // Mastery >= 0.60: Use advanced/standard, don't auto-toggle
  //           descLevel = 'advanced';
  //         }
  //       }

  //       // Safely extract the string
  //       const resolved = descObj[descLevel] || descObj['beginner'] || "";

  //       // UPDATE: Use a functional update to ensure we don't trigger unnecessary re-runs
  //       setProblem(prev => {
  //         if (!prev || prev.simplifiedDescription === resolved) return prev;
  //         return { ...prev, simplifiedDescription: resolved };
  //       });

  //     } catch (err) {
  //       console.error("Error resolving adaptive description:", err);
  //     }
  //   }

  //   resolveDescription();
  // }, [problem?.id, user?.id]); // Removed problem._rawSimplifiedDesc to prevent loops

  // Explicit language change: reset to starter code for the new language
  function handleLanguageChange(newLang: string) {
    setLanguage(newLang);
    if (problem) {
      setCode(problem.starterCode[newLang] || DEFAULT_STARTER[newLang] || '');
    }
  }

  async function loadSubmissions() {
    if (!problem || !user || submissionsLoaded) return;
    const { data } = await supabase
      .from('submissions')
      .select('id, passed, language, code, execution_time_ms, test_results, created_at')
      .eq('user_id', user.id)
      .eq('problem_id', problem.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setSubmissions((data as SubmissionRecord[]) || []);
    setSubmissionsLoaded(true);
  }

  function viewPastSubmission(sub: SubmissionRecord) {
    setLanguage(sub.language || 'python');
    setCode(sub.code);
    const timeAgo = formatTimeAgo(sub.created_at);
    setViewingSubmissionBanner(`Viewing ${sub.passed ? 'accepted' : 'failed'} submission from ${timeAgo}`);
    setActiveTab('testcases');
    setTimeout(() => setViewingSubmissionBanner(null), 4000);
  }

  function formatTimeAgo(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  // Save session to localStorage when code or language changes
  useEffect(() => {
    if (!problem || !slug) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      slug,
      title: problem.title,
      language,
      code,
      timer_seconds: timer,
      savedAt: new Date().toISOString(),
    }));
  }, [code, language]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save final timer on page unload
  useEffect(() => {
    const handleUnload = () => {
      if (!problem || !slug) return;
      const existing = localStorage.getItem(SESSION_KEY);
      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          if (parsed.slug === slug) {
            localStorage.setItem(SESSION_KEY, JSON.stringify({ ...parsed, timer_seconds: timer }));
          }
        } catch { }
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [problem, slug, timer]);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setTimer((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  async function callBackend() {
    if (!problem || !session?.access_token) return null;
    const res = await fetch(`${BACKEND_URL}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        code,
        language,
        problem_id: problem.id,
        run_only: false,
        time_spent_seconds: timer,
        hint_used: hintUsed,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${res.status}`);
    }
    return res.json();
  }

  const handleSubmit = async () => {
    if (!BACKEND_URL) {
      setShowSuccessModal(true);
      return;
    }
    setIsSubmitting(true);
    setRunError('');
    try {
      const data = await callBackend();
      const passedCount = data.results.filter((r: any) => r.passed).length;

      setTestResults({
        passed: passedCount,
        total: data.results.length,
        runtime: data.execution_time_ms ? `${data.execution_time_ms}ms` : '—',
        tests: data.results.map((r: any) => ({
          input: r.input,
          expected: r.expected,
          actual: r.actual || '',
          stderr: r.stderr || '',
          passed: r.passed,
          status: r.status,
        })),
      });

      if (data.passed) {
        setSubmissionResult({
          masteryBefore: data.mastery_before,
          masteryAfter: data.mastery_after,
          masteryGain: data.mastery_gain,
          xpGained: data.xp_gained,
          testsPassed: passedCount,
          testsTotal: data.results.length,
          executionTime: data.execution_time_ms,
        });
        // Fetch BKT-recommended next problem
        if (user) {
          const { data: recData } = await supabase
            .from('recommendations')
            .select('reason, problems(id, title, slug, difficulty, problem_topics(topics(name, display_name)))')
            .eq('user_id', user.id)
            .limit(1)
            .single();
          if (recData?.problems) {
            const p = recData.problems as any;
            const topicName = (p.problem_topics || [])[0]?.topics?.display_name
              || (p.problem_topics || [])[0]?.topics?.name || '';
            setNextProblem({ title: p.title, slug: p.slug, difficulty: p.difficulty, topic: topicName });
          } else {
            setNextProblem(null);
          }
        }
        setShowSuccessModal(true);
        // Reload submissions history after a successful submit
        setSubmissionsLoaded(false);
      } else {
        setActiveTab('results');
        setShowFailureModal(true);
        setSubmissionsLoaded(false);
      }
    } catch (e: any) {
      setRunError(e.message || 'Failed to submit');
      setActiveTab('results');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitSuccess = () => {
    localStorage.removeItem(SESSION_KEY);
    setShowSuccessModal(false);
  };

  /**
   * Last-resort safety: never render the raw JSONB dict.
   * If val is a stringified JSON object, parse it and return only the
   * beginner-level string (or first string value found).
   */
  function safeSimplified(val: string): string {
    if (!val) return '';
    const trimmed = val.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        return (
          (typeof parsed.beginner === 'string' ? parsed.beginner : '') ||
          (typeof parsed.intermediate === 'string' ? parsed.intermediate : '') ||
          (typeof parsed.advanced === 'string' ? parsed.advanced : '') ||
          (Object.values(parsed).find(v => typeof v === 'string') as string ?? val)
        );
      } catch { return val; }
    }
    return val;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (fetchError || !problem) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Problem not found</h2>
          <p className="text-muted-foreground mb-6">{fetchError || 'This problem does not exist.'}</p>
          <Link to="/problems" className="text-primary hover:underline">
            ← Back to Problems
          </Link>
        </div>
      </div>
    );
  }


  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Top Nav */}
      <div className="h-12 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
        <Link
          to="/problems"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Problems</span>
        </Link>

        <span className="text-sm font-medium truncate max-w-xs px-4">{problem.title}</span>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 border border-border">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="font-mono text-xs font-semibold">{formatTime(timer)}</span>
        </div>
      </div>

      {/* Split Panes */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* Left — Problem Description */}
          <Panel defaultSize={40} minSize={30}>
            <div className="h-full overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* Tags */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${difficultyClass(problem.difficulty)}`}>
                  {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
                </span>
                {problem.acceptanceRate > 0 && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-muted border border-border text-muted-foreground">
                    {problem.acceptanceRate}% accepted
                  </span>
                )}
                {problem.topics.map((topic) => (
                  <span
                    key={topic}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20"
                  >
                    {topic}
                  </span>
                ))}
              </div>

              {/* Description with optional Simplify toggle */}
              <div className="space-y-3">
                {problem.simplifiedDescription && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => setIsSimplified(!isSimplified)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium transition-all ${isSimplified
                        ? 'border-accent-secondary bg-accent-secondary/10 text-accent-secondary'
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                        }`}
                    >
                      <Zap className="w-3 h-3" />
                      {isSimplified ? 'Standard' : 'Simplify'}
                    </button>
                  </div>
                )}

                <AnimatePresence mode="wait">
                  <motion.div
                    key={isSimplified ? 'simplified' : 'standard'}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className={`rounded-xl p-5 ${isSimplified
                      ? 'bg-accent-secondary/5 border-2 border-accent-secondary/30'
                      : 'bg-muted/20 border border-border'
                      }`}
                  >
                    {isSimplified && (
                      <div className="flex items-start gap-3 mb-4 p-3 rounded-lg bg-accent-secondary/10 border border-accent-secondary/20">
                        <Zap className="w-5 h-5 text-accent-secondary flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <div className="font-semibold text-accent-secondary mb-1">
                            Adapted to your level
                          </div>
                          <div className="text-muted-foreground">
                            We've simplified the language and added helpful context based on your
                            current mastery.
                          </div>
                        </div>
                      </div>
                    )}
                    <p className="text-foreground whitespace-pre-line leading-relaxed">
                      {isSimplified ? safeSimplified(problem.simplifiedDescription) : problem.description}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Examples */}
              {problem.examples.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-bold text-lg">Examples</h3>
                  {problem.examples.map((example, index) => (
                    <div
                      key={index}
                      className="bg-muted/50 rounded-xl p-4 space-y-3 border border-border"
                    >
                      <div className="font-semibold text-sm text-primary">
                        Example {index + 1}:
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-semibold text-foreground text-xs uppercase tracking-wide text-muted-foreground">Input</span>
                          <pre className="mt-1 font-mono text-xs bg-background px-3 py-2 rounded-lg border border-border text-foreground whitespace-pre-wrap break-all">
                            {example.input}
                          </pre>
                        </div>
                        <div>
                          <span className="font-semibold text-foreground text-xs uppercase tracking-wide text-muted-foreground">Output</span>
                          <pre className="mt-1 font-mono text-xs bg-background px-3 py-2 rounded-lg border border-border text-foreground whitespace-pre-wrap break-all">
                            {example.output}
                          </pre>
                        </div>
                        {example.explanation && (
                          <div className="text-xs text-muted-foreground leading-relaxed">
                            <span className="font-semibold text-foreground">Explanation: </span>
                            {example.explanation}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Constraints */}
              {problem.constraints.length > 0 && (
                <div className="bg-muted/30 rounded-xl p-4 border border-border">
                  <h3 className="font-bold text-sm mb-3">Constraints</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {problem.constraints.map((constraint, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <code className="font-mono">{constraint}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Hints */}
              {problem.hints.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-lg">Hints</h3>
                  {problem.hints.map((hint, index) => (
                    <Collapsible.Root
                      key={index}
                      onOpenChange={(open) => { if (open) setHintUsed(true); }}
                    >
                      <Collapsible.Trigger className="w-full group">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-warning/5 border border-warning/20 hover:bg-warning/10 transition-colors">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <Lightbulb className="w-4 h-4 text-warning" />
                            <span>Hint {index + 1}</span>
                          </div>
                          <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                        </div>
                      </Collapsible.Trigger>
                      <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-slideUp data-[state=open]:animate-slideDown">
                        <div className="p-4 text-sm text-muted-foreground bg-muted/20 rounded-b-xl border-x border-b border-warning/20 -mt-1">
                          {hint}
                        </div>
                      </Collapsible.Content>
                    </Collapsible.Root>
                  ))}
                </div>
              )}

              {/* Companies */}
              {problem.companies.length > 0 && (
                <div className="pt-4 border-t border-border">
                  <div className="text-sm text-muted-foreground mb-2">Asked at:</div>
                  <div className="flex flex-wrap gap-2">
                    {problem.companies.map((company) => (
                      <span
                        key={company}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted border border-border"
                      >
                        {company}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Panel>

          {/* Resize Handle */}
          <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors" />

          {/* Right — Code Editor */}
          <Panel defaultSize={60} minSize={40}>
            <div className="h-full flex flex-col">
              {/* Editor Header */}
              <div className="h-12 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
                <label htmlFor="language-select" className="sr-only">Select programming language</label>
                <select
                  id="language-select"
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-muted border border-border text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                  <option value="go">Go</option>
                </select>

                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setCode(problem.starterCode[language] || DEFAULT_STARTER[language] || '')}
                    title="Reset to starter code"
                    aria-label="Reset to starter code"
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  </motion.button>
                  <div className="relative">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowEditorSettings((v) => !v)}
                      title="Editor settings"
                      aria-label="Editor settings"
                      className={`p-2 rounded-lg hover:bg-muted transition-colors ${showEditorSettings ? 'bg-muted' : ''}`}
                    >
                      <Settings className="w-4 h-4" aria-hidden="true" />
                    </motion.button>
                    <AnimatePresence>
                      {showEditorSettings && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowEditorSettings(false)} />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 top-full mt-2 z-50 w-56 bg-card border border-border rounded-xl shadow-xl p-4 space-y-4"
                          >
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground mb-2">Font Size</div>
                              <div className="flex gap-2">
                                {[12, 14, 16, 18].map((size) => (
                                  <button
                                    key={size}
                                    onClick={() => updateEditorSettings({ fontSize: size })}
                                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${editorSettings.fontSize === size
                                      ? 'bg-primary text-primary-foreground border-primary'
                                      : 'border-border hover:bg-muted'
                                      }`}
                                  >
                                    {size}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground mb-2">Tab Size</div>
                              <div className="flex gap-2">
                                {[2, 4].map((size) => (
                                  <button
                                    key={size}
                                    onClick={() => updateEditorSettings({ tabSize: size })}
                                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${editorSettings.tabSize === size
                                      ? 'bg-primary text-primary-foreground border-primary'
                                      : 'border-border hover:bg-muted'
                                      }`}
                                  >
                                    {size} spaces
                                  </button>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Restored-from / viewing-past banners */}
              <AnimatePresence>
                {viewingSubmissionBanner && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 px-4 py-2 bg-warning/10 border-b border-warning/30 text-sm text-warning"
                  >
                    <Info className="w-4 h-4 shrink-0" />
                    {viewingSubmissionBanner}
                  </motion.div>
                )}
                {!viewingSubmissionBanner && restoredFrom === 'accepted' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 px-4 py-2 bg-success/10 border-b border-success/30 text-sm text-success"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Loaded your last accepted solution
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Code Editor */}
              <div className="flex-1 overflow-hidden">
                <CodeEditor
                  value={code}
                  onChange={(value) => { setCode(value); setRestoredFrom(null); }}
                  language={language}
                  fontSize={editorSettings.fontSize}
                  tabSize={editorSettings.tabSize}
                />
              </div>

              {/* Bottom Panel */}
              <div className="border-t border-border bg-card shrink-0">
                <div className="flex items-center justify-between px-4 border-b border-border">
                  <div className="flex items-center gap-4">
                    {(['testcases', 'results', 'history'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => { setActiveTab(tab); if (tab === 'history') loadSubmissions(); }}
                        className={`py-2.5 px-1 text-sm font-medium transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === tab
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                          }`}
                      >
                        {tab === 'testcases' ? 'Test Cases' : tab === 'history' ? <><History className="w-3.5 h-3.5" />History</> : 'Results'}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {runError && (
                      <span className="text-xs text-error truncate max-w-[160px]">{runError}</span>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {isSubmitting ? 'Submitting…' : 'Submit'}
                    </motion.button>
                  </div>
                </div>

                <div className="p-4 max-h-72 overflow-y-auto">
                  {/* Testcases Tab */}
                  {activeTab === 'testcases' && (
                    <div className="space-y-2">
                      {problem.examples.map((example, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-lg bg-muted/30 border border-border"
                        >
                          <div className="font-semibold text-xs text-muted-foreground mb-1.5">
                            Case {i + 1}
                          </div>
                          <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all">{example.input}</pre>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Results Tab */}
                  {activeTab === 'results' && (
                    <div className="space-y-4">
                      {testResults ? (
                        <>
                          <div className="flex items-center justify-between">
                            <div
                              className={`flex items-center gap-2 font-semibold ${testResults.passed === testResults.total
                                ? 'text-success'
                                : 'text-error'
                                }`}
                            >
                              {testResults.passed === testResults.total ? (
                                <CheckCircle2 className="w-5 h-5" />
                              ) : (
                                <XCircle className="w-5 h-5" />
                              )}
                              <span>
                                {testResults.passed}/{testResults.total} Test Cases Passed
                              </span>
                            </div>
                            {testResults.runtime !== '—' && (
                              <div className="text-sm text-muted-foreground">
                                Runtime: {testResults.runtime}
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            {testResults.tests.map((test: any, index: number) => {
                              const isCompileErr = test.status === 'Compilation Error';
                              const isRuntimeErr = test.status === 'Runtime Error';
                              const isTLE = test.status === 'Time Limit Exceeded';
                              const hasError = (isCompileErr || isRuntimeErr || isTLE) && test.stderr;
                              return (
                                <div
                                  key={index}
                                  className={`p-3 rounded-lg border ${test.passed
                                    ? 'bg-success/5 border-success/20'
                                    : 'bg-error/5 border-error/20'
                                    }`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-sm">
                                        Test Case {index + 1}
                                      </span>
                                      {!test.passed && test.status && test.status !== 'Accepted' && (
                                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-error/20 text-error">
                                          {test.status}
                                        </span>
                                      )}
                                    </div>
                                    {test.passed ? (
                                      <CheckCircle2 className="w-4 h-4 text-success" />
                                    ) : (
                                      <XCircle className="w-4 h-4 text-error" />
                                    )}
                                  </div>
                                  {hasError ? (
                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-1.5 text-xs font-semibold text-error">
                                        <Terminal className="w-3.5 h-3.5" />
                                        {isCompileErr ? 'Compilation Error' : isTLE ? 'Time Limit Exceeded' : 'Runtime Error'}
                                      </div>
                                      <pre className="text-xs font-mono bg-background/80 rounded p-2 overflow-x-auto whitespace-pre-wrap text-error/90 border border-error/20 max-h-32 overflow-y-auto">
                                        {test.stderr}
                                      </pre>
                                    </div>
                                  ) : (
                                    <div className="text-xs space-y-1 text-muted-foreground font-mono">
                                      <div>Input: {test.input}</div>
                                      <div>Expected: {test.expected}</div>
                                      <div className={test.passed ? 'text-success' : 'text-error'}>
                                        Output: {test.actual || '(no output)'}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>Run your code to see results</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* History Tab */}
                  {activeTab === 'history' && (
                    <div className="space-y-2">
                      {!submissionsLoaded ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : submissions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No submissions yet for this problem
                        </div>
                      ) : (
                        submissions.map((sub) => {
                          const passedCount = Array.isArray(sub.test_results)
                            ? sub.test_results.filter((r: any) => r.passed).length
                            : 0;
                          const totalCount = Array.isArray(sub.test_results) ? sub.test_results.length : 0;
                          return (
                            <div
                              key={sub.id}
                              className={`flex items-center justify-between p-3 rounded-lg border ${sub.passed
                                ? 'bg-success/5 border-success/20'
                                : 'bg-error/5 border-error/20'
                                }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {sub.passed ? (
                                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-error shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <div className={`text-sm font-semibold ${sub.passed ? 'text-success' : 'text-error'}`}>
                                    {sub.passed ? 'Accepted' : `Failed (${passedCount}/${totalCount})`}
                                  </div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                                    <span className="capitalize">{sub.language}</span>
                                    {sub.execution_time_ms != null && (
                                      <span>{sub.execution_time_ms}ms</span>
                                    )}
                                    <span>{formatTimeAgo(sub.created_at)}</span>
                                  </div>
                                </div>
                              </div>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => viewPastSubmission(sub)}
                                className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors shrink-0 ml-2"
                              >
                                View
                              </motion.button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={handleSubmitSuccess}
        problemTitle={problem.title}
        difficulty={problem.difficulty}
        topic={problem.topics.slice(0, 3).join(' & ') || ''}
        testCasesPassed={submissionResult?.testsPassed ?? problem.examples.length}
        totalTestCases={submissionResult?.testsTotal ?? problem.examples.length}
        runtime={submissionResult?.executionTime ? `${submissionResult.executionTime}ms` : '—'}
        xpGained={submissionResult?.xpGained}
        masteryBefore={submissionResult?.masteryBefore ?? 0}
        masteryAfter={submissionResult?.masteryAfter ?? 0}
        masteryGain={submissionResult?.masteryGain ?? 0}
        nextProblem={nextProblem}
        onNextProblem={() => { handleSubmitSuccess(); nextProblem ? navigate(`/problems/${nextProblem.slug}`) : navigate('/problems'); }}
        onViewSolution={() => { }}
        onBackToDashboard={() => { handleSubmitSuccess(); navigate('/dashboard'); }}
      />

      {/* Failure Modal */}
      <FailureModal
        isOpen={showFailureModal}
        onClose={() => setShowFailureModal(false)}
        problemTitle={problem.title}
        difficulty={problem.difficulty}
        topic={problem.topics[0] || ''}
        testCasesPassed={testResults?.passed ?? 0}
        totalTestCases={testResults?.total ?? 0}
        onTryAgain={() => setShowFailureModal(false)}
        onViewHints={() => { setShowFailureModal(false); }}
      />
    </div>
  );
}
