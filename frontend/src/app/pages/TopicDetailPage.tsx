import { motion } from 'motion/react';
import { Navbar } from '../components/Navbar';
import { ArrowLeft, CheckCircle2, Circle, TrendingUp, Clock, Target, AlertCircle } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { difficultyClass } from '../lib/difficulty';

interface ProblemRow {
  id: number;
  slug: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'solved' | 'attempted' | 'unsolved';
  mastery: number;
}

interface TopicData {
  id: number;
  name: string;
  slug: string;
  overallMastery: number;
  problems: { easy: ProblemRow[]; medium: ProblemRow[]; hard: ProblemRow[] };
}

const getStatusIcon = (status: string) => {
  if (status === 'solved') return <CheckCircle2 className="w-5 h-5 text-success" />;
  if (status === 'attempted')
    return (
      <div className="w-5 h-5 rounded-full border-2 border-warning flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-warning" />
      </div>
    );
  return <Circle className="w-5 h-5 text-muted-foreground" />;
};

export default function TopicDetailPage() {
  const { topic: topicSlug } = useParams<{ topic: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [topicData, setTopicData] = useState<TopicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const loadData = useCallback(async () => {
    if (!topicSlug) return;
    setLoading(true);
    setFetchError('');
    try {
      // Fetch topic metadata
      const { data: topicRow, error: topicErr } = await supabase
        .from('topics')
        .select('id, name, display_name')
        .eq('name', topicSlug)
        .single();
      if (topicErr) throw topicErr;

      const topicId = topicRow.id as number;

      // Fetch problems for this topic
      const { data: ptData, error: ptErr } = await supabase
        .from('problem_topics')
        .select('problem_id, problems(id, slug, title, difficulty)')
        .eq('topic_id', topicId);
      if (ptErr) throw ptErr;

      const problemIds: number[] = [];
      const rawProblems: Array<{ id: number; slug: string; title: string; difficulty: 'easy' | 'medium' | 'hard' }> = [];
      (ptData || []).forEach((pt: any) => {
        if (pt.problems) {
          problemIds.push(pt.problems.id);
          rawProblems.push({
            id: pt.problems.id,
            slug: pt.problems.slug,
            title: pt.problems.title,
            difficulty: pt.problems.difficulty,
          });
        }
      });

      // User mastery per difficulty for this topic
      let masteryByDifficulty: Record<string, number> = {};
      if (user) {
        const { data: masteryData } = await supabase
          .from('user_mastery')
          .select('difficulty, p_learned')
          .eq('user_id', user.id)
          .eq('topic_id', topicId);
        (masteryData || []).forEach((m: any) => {
          masteryByDifficulty[m.difficulty] = m.p_learned as number;
        });
      }

      // User submissions for these problems
      let solvedSet = new Set<number>();
      let attemptedSet = new Set<number>();
      if (user && problemIds.length > 0) {
        const { data: subData } = await supabase
          .from('submissions')
          .select('problem_id, passed')
          .eq('user_id', user.id)
          .in('problem_id', problemIds);
        (subData || []).forEach((s: any) => {
          if (s.passed) {
            solvedSet.add(s.problem_id);
          } else if (!solvedSet.has(s.problem_id)) {
            attemptedSet.add(s.problem_id);
          }
        });
      }

      const mapped = rawProblems.map((p) => {
        const status: 'solved' | 'attempted' | 'unsolved' = solvedSet.has(p.id)
          ? 'solved'
          : attemptedSet.has(p.id)
          ? 'attempted'
          : 'unsolved';
        const mastery = Math.round((masteryByDifficulty[p.difficulty] || 0) * 100);
        return { ...p, status, mastery };
      });

      const grouped = {
        easy: mapped.filter((p) => p.difficulty === 'easy'),
        medium: mapped.filter((p) => p.difficulty === 'medium'),
        hard: mapped.filter((p) => p.difficulty === 'hard'),
      };

      // Overall mastery = avg across all difficulty mastery values present
      const masteryValues = Object.values(masteryByDifficulty);
      const overallMastery =
        masteryValues.length > 0
          ? Math.round((masteryValues.reduce((s, v) => s + v, 0) / masteryValues.length) * 100)
          : 0;

      setTopicData({
        id: topicId,
        name: (topicRow.display_name || topicRow.name) as string,
        slug: topicRow.name as string,
        overallMastery,
        problems: grouped,
      });
    } catch (e: any) {
      setFetchError(e.message || 'Failed to load topic');
    } finally {
      setLoading(false);
    }
  }, [topicSlug, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (fetchError || !topicData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Topic not found</h2>
          <p className="text-muted-foreground mb-4">{fetchError}</p>
          <button onClick={() => navigate('/progress')} className="text-primary hover:underline">
            ← Back to Progress
          </button>
        </div>
      </div>
    );
  }

  const allProblems = [
    ...topicData.problems.easy,
    ...topicData.problems.medium,
    ...topicData.problems.hard,
  ];

  const solvedCount = allProblems.filter((p) => p.status === 'solved').length;
  const attemptedCount = allProblems.filter((p) => p.status === 'attempted').length;
  const totalCount = allProblems.length;

  const weakestUnsolved = allProblems
    .filter((p) => p.status === 'unsolved' || p.status === 'attempted')
    .sort((a, b) => a.mastery - b.mastery)[0];

  // Approximated mastery trend (linear ramp from ~half to current)
  const m = topicData.overallMastery;
  const startM = Math.max(0, Math.round(m * 0.5));
  const trendData = [
    { day: '-6w', mastery: startM },
    { day: '-5w', mastery: Math.round(startM + (m - startM) * 0.15) },
    { day: '-4w', mastery: Math.round(startM + (m - startM) * 0.33) },
    { day: '-3w', mastery: Math.round(startM + (m - startM) * 0.52) },
    { day: '-2w', mastery: Math.round(startM + (m - startM) * 0.68) },
    { day: '-1w', mastery: Math.round(startM + (m - startM) * 0.85) },
    { day: 'Now', mastery: m },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="app" />

      <div className="pt-20 px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => navigate('/progress')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Progress
          </button>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-3">{topicData.name}</h1>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Mastery:</span>
                <span className="text-2xl font-mono font-bold text-primary">{topicData.overallMastery}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Progress:</span>
                <span className="font-semibold">{solvedCount}/{totalCount} solved</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Trend Chart */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold">Mastery Trend</h2>
                  {m > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="w-4 h-4 text-success" />
                      <span className="font-semibold text-success">{m}% overall</span>
                    </div>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} />
                    <YAxis stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="mastery"
                      stroke="var(--primary)"
                      strokeWidth={3}
                      dot={{ fill: 'var(--primary)', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Problems by Difficulty */}
              {(['easy', 'medium', 'hard'] as const).map((difficulty) => {
                const dProblems = topicData.problems[difficulty];
                if (dProblems.length === 0) return null;
                const dSolved = dProblems.filter((p) => p.status === 'solved').length;
                return (
                  <div key={difficulty} className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-border bg-muted/30">
                      <h3 className="text-base font-bold capitalize flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${difficultyClass(difficulty)}`}>
                          {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          {dSolved}/{dProblems.length} solved
                        </span>
                      </h3>
                    </div>
                    <div className="divide-y divide-border">
                      {dProblems.map((problem) => (
                        <Link
                          key={problem.id}
                          to={`/problems/${problem.slug}`}
                          className="flex items-center justify-between px-6 py-4 hover:bg-primary/5 transition-colors group"
                        >
                          <div className="flex items-center gap-4">
                            {getStatusIcon(problem.status)}
                            <span className="font-medium group-hover:text-primary transition-colors">
                              {problem.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-primary to-primary-light rounded-full"
                                style={{ width: `${problem.mastery}%` }}
                              />
                            </div>
                            <span className="text-sm font-mono font-semibold text-muted-foreground w-12 text-right">
                              {problem.mastery}%
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}

              {totalCount === 0 && (
                <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground">
                  No problems found for this topic yet.
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Recommended Next */}
              {weakestUnsolved && (
                <motion.div
                  whileHover={{ scale: 1.02, y: -2 }}
                  className="bg-gradient-to-br from-primary/10 via-accent-secondary/10 to-primary/5 border-2 border-primary/30 rounded-2xl p-6 shadow-lg"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
                      <Target className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="text-base font-bold">Recommended Next</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Build mastery by tackling your weakest area:
                  </p>
                  <div className="mb-4">
                    <div className="font-bold mb-1">{weakestUnsolved.title}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {weakestUnsolved.difficulty} · {weakestUnsolved.mastery}% mastery
                    </div>
                  </div>
                  <Link to={`/problems/${weakestUnsolved.slug}`}>
                    <motion.button
                      whileHover={{ scale: 1.05, boxShadow: 'var(--glow-primary)' }}
                      whileTap={{ scale: 0.95 }}
                      className="w-full px-6 py-3 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-lg"
                    >
                      Start Problem
                    </motion.button>
                  </Link>
                </motion.div>
              )}

              {/* Stats Summary */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-base font-bold mb-4">Topic Stats</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Problems</span>
                    <span className="font-mono font-bold text-lg">{totalCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Solved</span>
                    <span className="font-mono font-bold text-lg text-success">{solvedCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Attempted</span>
                    <span className="font-mono font-bold text-lg text-warning">{attemptedCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Not Started</span>
                    <span className="font-mono font-bold text-lg text-muted-foreground">
                      {totalCount - solvedCount - attemptedCount}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
