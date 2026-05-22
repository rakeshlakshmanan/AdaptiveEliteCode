import { motion } from 'motion/react';
import { Navbar } from '../components/Navbar';
import {
  Clock,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Minus,
  ArrowRight,
  Flame,
} from 'lucide-react';
import { Radar, Line } from 'react-chartjs-2';
import { Link } from 'react-router';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
} from 'chart.js';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../context/AuthContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadialLinearScale,
  Filler,
  Tooltip,
  Legend
);

interface TopicProgress {
  id: number;
  name: string;
  slug: string;
  easy: number;
  medium: number;
  hard: number;
  easySolved: number;
  easyTotal: number;
  mediumSolved: number;
  mediumTotal: number;
  hardSolved: number;
  hardTotal: number;
  trend: 'up' | 'down' | 'stable';
}

function getTrendIcon(trend: string) {
  if (trend === 'up') return <ArrowUp className="w-4 h-4 text-success" />;
  if (trend === 'down') return <ArrowDown className="w-4 h-4 text-error" />;
  return <Minus className="w-4 h-4 text-warning" />;
}

function getMasteryTier(mastery: number): string {
  if (mastery >= 80) return 'Advanced';
  if (mastery >= 50) return 'Intermediate';
  return 'Beginner';
}

function buildHeatmap(subs: { created_at: string }[]): number[] {
  const countMap: Record<string, number> = {};
  subs.forEach((s) => {
    const key = new Date(s.created_at).toISOString().slice(0, 10);
    countMap[key] = (countMap[key] || 0) + 1;
  });
  const cells: number[] = [];
  const start = new Date();
  start.setDate(start.getDate() - 181);
  for (let i = 0; i < 182; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(countMap[d.toISOString().slice(0, 10)] || 0);
  }
  return cells;
}

function heatColor(count: number): string {
  if (count === 0) return 'var(--muted)';
  if (count === 1) return 'rgba(34,197,94,0.25)';
  if (count <= 3) return 'rgba(34,197,94,0.5)';
  if (count <= 5) return 'rgba(34,197,94,0.75)';
  return 'rgb(34,197,94)';
}

function formatAvgTime(seconds: number): string {
  if (seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function ProgressPage() {
  const { user } = useAuth();

  const [topics, setTopics] = useState<TopicProgress[]>([]);
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [problemsSolved, setProblemsSolved] = useState(0);
  const [overallMastery, setOverallMastery] = useState(0);
  const [avgTimeSeconds, setAvgTimeSeconds] = useState(0);
  const [heatmapCells, setHeatmapCells] = useState<number[]>([]);
  const [snapshotData, setSnapshotData] = useState<{ date: string; mastery: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const since26w = new Date();
      since26w.setDate(since26w.getDate() - 181);

      const [streakRes, topicsRes, masteryRes, subsRes, problemTopicsRes, heatSubs, avgTimeRes, snapshotsRes] = await Promise.all([
        supabase.from('streaks').select('current_streak, longest_streak').eq('user_id', user.id).single(),
        supabase.from('topics').select('id, name, display_name').order('tier'),
        supabase.from('user_mastery').select('topic_id, difficulty, p_learned').eq('user_id', user.id),
        supabase.from('submissions').select('problem_id, passed').eq('user_id', user.id),
        supabase.from('problem_topics').select('problem_id, topic_id, problems(difficulty)'),
        supabase.from('submissions').select('created_at').eq('user_id', user.id).gte('created_at', since26w.toISOString()),
        supabase.from('submissions').select('time_spent_seconds').eq('user_id', user.id).eq('passed', true).gt('time_spent_seconds', 0),
        supabase.from('mastery_snapshots').select('snapshot_date, overall_mastery').eq('user_id', user.id).order('snapshot_date', { ascending: true }).limit(30),
      ]);

      setStreak((streakRes.data as any)?.current_streak || 0);
      setLongestStreak((streakRes.data as any)?.longest_streak || 0);

      const subs = (subsRes.data || []) as any[];
      const solvedIds = new Set(
        subs.filter((s) => s.passed).map((s) => s.problem_id)
      );
      setProblemsSolved(solvedIds.size);

      const masteryRows = (masteryRes.data || []) as any[];
      const topicList = (topicsRes.data || []) as any[];
      const ptRows = (problemTopicsRes.data || []) as any[];

      // Build mastery map: topic_id → { easy, medium, hard }
      const masteryMap: Record<number, Record<string, number>> = {};
      masteryRows.forEach((m) => {
        if (!masteryMap[m.topic_id]) masteryMap[m.topic_id] = {};
        masteryMap[m.topic_id][m.difficulty] = m.p_learned as number;
      });

      // Build solved/total counts: topic_id → difficulty → { solved, total }
      const countMap: Record<number, Record<string, { solved: number; total: number }>> = {};
      ptRows.forEach((pt: any) => {
        const diff: string = pt.problems?.difficulty || 'easy';
        if (!countMap[pt.topic_id]) countMap[pt.topic_id] = {};
        if (!countMap[pt.topic_id][diff])
          countMap[pt.topic_id][diff] = { solved: 0, total: 0 };
        countMap[pt.topic_id][diff].total++;
        if (solvedIds.has(pt.problem_id)) {
          countMap[pt.topic_id][diff].solved++;
        }
      });

      let totalMastery = 0;
      const mapped: TopicProgress[] = topicList.map((t) => {
        const m = masteryMap[t.id] || {};
        const easy = Math.round((m['easy'] || 0) * 100);
        const medium = Math.round((m['medium'] || 0) * 100);
        const hard = Math.round((m['hard'] || 0) * 100);
        const avgMastery = (easy + medium + hard) / 3;
        totalMastery += avgMastery;

        const c = countMap[t.id] || {};
        return {
          id: t.id,
          name: t.display_name || t.name,
          slug: t.name,
          easy,
          medium,
          hard,
          easySolved: c['easy']?.solved || 0,
          easyTotal: c['easy']?.total || 0,
          mediumSolved: c['medium']?.solved || 0,
          mediumTotal: c['medium']?.total || 0,
          hardSolved: c['hard']?.solved || 0,
          hardTotal: c['hard']?.total || 0,
          trend: avgMastery > 60 ? 'up' : avgMastery < 20 ? 'down' : 'stable',
        };
      });

      setTopics(mapped);
      const computedMastery = mapped.length > 0 ? Math.round(totalMastery / mapped.length) : 0;
      setOverallMastery(computedMastery);

      // Heatmap
      setHeatmapCells(buildHeatmap((heatSubs.data || []) as any[]));

      // Avg solve time
      const times = ((avgTimeRes.data || []) as any[]).map((r) => r.time_spent_seconds as number).filter(Boolean);
      setAvgTimeSeconds(times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0);

      // 30-day mastery snapshots
      const snaps = ((snapshotsRes.data || []) as any[]).map((r) => ({
        date: new Date(r.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        mastery: Math.round(r.overall_mastery),
      }));
      setSnapshotData(snaps.length > 0 ? snaps : [{ date: 'Now', mastery: computedMastery }]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const radarData = {
    labels: topics.map((t) => t.name),
    datasets: [
      {
        label: 'Mastery',
        data: topics.map((t) => Math.round((t.easy + t.medium + t.hard) / 3)),
        backgroundColor: 'rgba(255, 107, 53, 0.2)',
        borderColor: 'rgb(255, 107, 53)',
        borderWidth: 3,
        pointBackgroundColor: 'rgb(255, 107, 53)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(255, 107, 53)',
        pointHoverRadius: 7,
      },
    ],
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: {
          stepSize: 20,
          color: 'rgba(163, 163, 163, 0.8)',
          backdropColor: 'transparent',
          font: { size: 11 },
        },
        grid: { color: 'rgba(163, 163, 163, 0.2)' },
        angleLines: { color: 'rgba(163, 163, 163, 0.2)' },
        pointLabels: {
          color: 'rgb(163, 163, 163)',
          font: { size: 13, weight: 600 as unknown as 'bold' },
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        borderColor: 'rgb(255, 107, 53)',
        borderWidth: 2,
        callbacks: { label: (ctx: any) => `Mastery: ${ctx.parsed.r}%` },
      },
    },
  };

  const masteryOverTime = {
    labels: snapshotData.map((s) => s.date),
    datasets: [
      {
        label: 'Mastery %',
        data: snapshotData.map((s) => s.mastery),
        borderColor: 'rgb(255, 107, 53)',
        backgroundColor: 'rgba(255, 107, 53, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: 'rgb(255, 107, 53)',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
      },
    ],
  };

  const masteryOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        borderColor: 'rgb(255, 107, 53)',
        borderWidth: 2,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(163, 163, 163, 0.1)' },
        ticks: { color: 'rgba(163, 163, 163, 0.8)', maxTicksLimit: 10 },
      },
      y: {
        grid: { color: 'rgba(163, 163, 163, 0.1)' },
        ticks: {
          color: 'rgba(163, 163, 163, 0.8)',
          callback: (value: any) => value + '%',
        },
        min: 0,
        max: 100,
      },
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="app" />

      <div className="pt-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Your Progress</h1>
            <p className="text-muted-foreground">
              Track your coding journey and skill development
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Radar + Stats */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="lg:col-span-2 bg-card border border-border rounded-2xl p-8"
                >
                  {topics.length > 2 ? (
                    <div className="h-96 mb-6">
                      <Radar data={radarData} options={radarOptions} />
                    </div>
                  ) : (
                    <div className="h-96 flex items-center justify-center text-muted-foreground">
                      Solve problems to build your skill radar
                    </div>
                  )}

                  <div className="text-center space-y-3">
                    <div className="text-5xl font-bold text-primary">{overallMastery}%</div>
                    <div className="text-lg text-muted-foreground font-medium">
                      Overall Mastery
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-2 border-orange-500/20 rounded-2xl p-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mb-4">
                      <Flame className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-4xl font-bold mb-1">{streak} days</div>
                    <div className="text-muted-foreground font-medium">Current Streak</div>
                  </div>

                  <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-2 border-success/20 rounded-2xl p-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-4xl font-bold mb-1">{problemsSolved}</div>
                    <div className="text-muted-foreground font-medium">Problems Solved</div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-2 border-blue-500/20 rounded-2xl p-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-4xl font-bold mb-1">{formatAvgTime(avgTimeSeconds)}</div>
                    <div className="text-muted-foreground font-medium">Avg Solve Time</div>
                  </div>
                </motion.div>
              </div>

              {/* Topic Breakdown */}
              {topics.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold mb-6">Topic Breakdown</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {topics.map((topic, index) => {
                      const avgMastery = Math.round((topic.easy + topic.medium + topic.hard) / 3);
                      return (
                        <Link key={topic.id} to={`/topic/${topic.slug}`}>
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.04 }}
                            whileHover={{ scale: 1.02, y: -4 }}
                            className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <h3 className="text-lg font-bold">{topic.name}</h3>
                                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                                  {getMasteryTier(avgMastery)}
                                </span>
                                {getTrendIcon(topic.trend)}
                              </div>
                            </div>

                            <div className="space-y-3 mb-4">
                              {[
                                { label: 'Easy', value: topic.easy, color: 'success' },
                                { label: 'Medium', value: topic.medium, color: 'warning' },
                                { label: 'Hard', value: topic.hard, color: 'error' },
                              ].map(({ label, value, color }) => (
                                <div key={label}>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span
                                      className={`text-sm font-semibold text-${color}`}
                                    >
                                      {label}
                                    </span>
                                    <span
                                      className={`text-sm font-bold text-${color}`}
                                    >
                                      {value}%
                                    </span>
                                  </div>
                                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={`h-full bg-${color} rounded-full transition-all`}
                                      style={{ width: `${value}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-border">
                              <p className="text-xs text-muted-foreground">
                                <span className="text-success font-semibold">
                                  {topic.easySolved}/{topic.easyTotal} Easy
                                </span>
                                {' · '}
                                <span className="text-warning font-semibold">
                                  {topic.mediumSolved}/{topic.mediumTotal} Medium
                                </span>
                                {' · '}
                                <span className="text-error font-semibold">
                                  {topic.hardSolved}/{topic.hardTotal} Hard
                                </span>
                              </p>
                              <motion.button
                                whileHover={{ x: 4 }}
                                className="flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-light transition-colors"
                              >
                                Practice
                                <ArrowRight className="w-4 h-4" />
                              </motion.button>
                            </div>
                          </motion.div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-2xl p-6"
                >
                  <h3 className="text-lg font-bold mb-6">Mastery Over Time</h3>
                  <div className="h-64">
                    <Line data={masteryOverTime} options={masteryOptions} />
                  </div>
                </motion.div>

                {/* Activity Heatmap — static visual, real data in Phase 5 */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-2xl p-6"
                >
                  <h3 className="text-lg font-bold mb-6">Activity</h3>
                  <div className="space-y-2">
                    <div className="grid grid-rows-7 grid-flow-col gap-1.5">
                      {heatmapCells.map((count, i) => (
                        <div
                          key={i}
                          title={`${count} submission${count !== 1 ? 's' : ''}`}
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: heatColor(count) }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-4">
                      <span className="text-xs text-muted-foreground">Less</span>
                      <div className="flex gap-1">
                        <div className="w-4 h-4 rounded bg-muted" />
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)' }}
                        />
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: 'rgba(34, 197, 94, 0.4)' }}
                        />
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: 'rgba(34, 197, 94, 0.7)' }}
                        />
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: 'rgb(34, 197, 94)' }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">More</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
