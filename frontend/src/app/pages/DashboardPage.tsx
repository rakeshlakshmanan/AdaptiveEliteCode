import { motion } from 'motion/react';
import { Navbar } from '../components/Navbar';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Flame,
  Target,
  BarChart3,
  Clock,
  AlertCircle,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import { Link } from 'react-router';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { difficultyClass, difficultyTextClass } from '../lib/difficulty';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

const REASON_LABELS: Record<string, string> = {
  weak_topic:       'Targets a topic where your mastery is low',
  reinforcement:    'Reinforces a topic you already know well',
  company_priority: 'Matched to your target companies and current skill level',
  zpd_match:        'Well-matched to your current skill level',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface TopicMastery {
  name: string;
  avgMastery: number;
}

interface RecentItem {
  id: number;
  problemName: string;
  difficulty: 'easy' | 'medium' | 'hard';
  passed: boolean;
  timeAgoStr: string;
  problemSlug: string;
}

interface Recommendation {
  title: string;
  slug: string;
  difficulty: string;
  topics: string[];
  reason: string;
}

interface DashboardData {
  streak: number;
  longestStreak: number;
  avgTimeSeconds: number;
  problemsSolved: number;
  overallMastery: number;
  topicMasteries: TopicMastery[];
  recentActivity: RecentItem[];
  recommendation: Recommendation | null;
  interviewTimeline: string | null;
  targetCompanies: string[];

}
const TIMELINE_LABEL: Record<string, string> = {
  under_2_weeks: '< 2 weeks',
  '1_to_3_months': '1–3 months',
  '3_plus_months': '3+ months',
  exploring: 'Just exploring',
};

export default function DashboardPage() {
  const { user, profile, session } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  // Keep a stable ref to profile so loadData doesn't need profile in its deps
  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Refresh recommendations before loading dashboard data
      if (BACKEND_URL && session?.access_token) {
        await fetch(`${BACKEND_URL}/recommendations/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        });
      }
      // Run parallel fetches
      const [streakRes, submissionsRes, masteryRes, topicsRes, recentRes, recRes, avgTimeRes] =
        await Promise.all([
          supabase.from('streaks').select('current_streak, longest_streak').eq('user_id', user.id).single(),
          supabase
            .from('submissions')
            .select('problem_id, passed')
            .eq('user_id', user.id),
          supabase
            .from('user_mastery')
            .select('topic_id, difficulty, p_learned')
            .eq('user_id', user.id),
          supabase.from('topics').select('id, name, display_name').order('tier'),
          supabase
            .from('submissions')
            .select('id, passed, created_at, problems(title, difficulty, slug)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('recommendations')
            .select(
              'reason, problems(title, slug, difficulty, problem_topics(topics(name, display_name)))'
            )
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1),
          supabase.from('submissions').select('time_spent_seconds').eq('user_id', user.id).eq('passed', true).gt('time_spent_seconds', 0),
        ]);

      const streak = (streakRes.data as any)?.current_streak || 0;
      const longestStreak = (streakRes.data as any)?.longest_streak || 0;
      const times = ((avgTimeRes.data || []) as any[]).map((r) => r.time_spent_seconds as number);
      const avgTimeSeconds = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

      // Distinct solved problems
      const subs = (submissionsRes.data || []) as any[];
      const solvedIds = new Set(
        subs.filter((s) => s.passed).map((s) => s.problem_id)
      );
      const problemsSolved = solvedIds.size;

      // Per-topic avg mastery
      const topicList = (topicsRes.data || []) as any[];
      const masteryRows = (masteryRes.data || []) as any[];
      const masteryByTopic: Record<number, number[]> = {};
      masteryRows.forEach((m) => {
        if (!masteryByTopic[m.topic_id]) masteryByTopic[m.topic_id] = [];
        masteryByTopic[m.topic_id].push(m.p_learned as number);
      });

      const topicMasteries: TopicMastery[] = topicList.map((t) => {
        const vals = masteryByTopic[t.id] || [0];
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        return { name: t.display_name || t.name, avgMastery: Math.round(avg * 100) };
      });

      const overallMastery =
        topicMasteries.length > 0
          ? Math.round(
            topicMasteries.reduce((a, b) => a + b.avgMastery, 0) / topicMasteries.length
          )
          : 0;

      // Recent activity
      const recentActivity: RecentItem[] = ((recentRes.data || []) as any[]).map((s) => ({
        id: s.id,
        problemName: s.problems?.title || 'Unknown',
        difficulty: s.problems?.difficulty || 'easy',
        passed: s.passed === true,
        timeAgoStr: timeAgo(s.created_at),
        problemSlug: s.problems?.slug || '',
      }));

      // Recommendation
      let recommendation: Recommendation | null = null;
      const recData = (recRes.data || []) as any[];
      if (recData.length > 0) {
        const r = recData[0];
        const p = r.problems;
        const topics: string[] = (p?.problem_topics || []).map(
          (pt: any) => pt.topics?.display_name || pt.topics?.name
        ).filter(Boolean);
        recommendation = {
          title: p?.title || '',
          slug: p?.slug || '',
          difficulty: p?.difficulty || 'medium',
          topics,
          reason: r.reason || 'Based on your mastery profile',
        };
      }

      setData({
        streak,
        longestStreak,
        avgTimeSeconds,
        problemsSolved,
        overallMastery,
        topicMasteries,
        recentActivity,
        recommendation,
        interviewTimeline: profileRef.current?.interview_timeline || null,
        targetCompanies: profileRef.current?.target_companies || [],
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]); // stable: only re-run when user ID changes, not on token refresh

  useEffect(() => {
    loadData();
  }, [loadData]);

  const radarTopics = [...(data?.topicMasteries || [])]
    .sort((a, b) => b.avgMastery - a.avgMastery)
    .slice(0, 12);
  const topicLabels = radarTopics.map((t) => t.name);
  const topicValues = radarTopics.map((t) => t.avgMastery);

  const radarData = {
    labels: topicLabels,
    datasets: [
      {
        label: 'Mastery',
        data: topicValues,
        backgroundColor: 'rgba(255, 107, 53, 0.2)',
        borderColor: 'rgb(255, 107, 53)',
        borderWidth: 2,
        pointBackgroundColor: 'rgb(255, 107, 53)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(255, 107, 53)',
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
        },
        grid: { color: 'rgba(163, 163, 163, 0.2)' },
        angleLines: { color: 'rgba(163, 163, 163, 0.2)' },
        pointLabels: {
          color: 'rgb(163, 163, 163)',
          font: { size: 10, weight: 600 as unknown as 'bold' },
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        borderColor: 'rgb(255, 107, 53)',
        borderWidth: 1,
        callbacks: { label: (ctx: any) => `Mastery: ${ctx.parsed.r}%` },
      },
    },
  };

  const focusAreas = (data?.topicMasteries || [])
    .filter((t) => t.avgMastery < 50)
    .sort((a, b) => a.avgMastery - b.avgMastery)
    .slice(0, 3);

  const stats = [
    {
      icon: Flame,
      label: 'Streak',
      value: String(data?.streak || 0),
      unit: 'days',
      gradient: 'from-orange-500 to-red-500',
    },
    {
      icon: CheckCircle2,
      label: 'Solved',
      value: String(data?.problemsSolved || 0),
      unit: '',
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      icon: BarChart3,
      label: 'Mastery',
      value: String(data?.overallMastery || 0),
      unit: '%',
      gradient: 'from-primary to-accent-secondary',
    },
    {
      icon: Clock,
      label: 'Avg Time',
      value: (() => { const s = data?.avgTimeSeconds || 0; if (!s) return '—'; const m = Math.floor(s / 60); const sec = s % 60; return m > 0 ? `${m}m ${sec}s` : `${sec}s`; })(),
      unit: '',
      gradient: 'from-blue-500 to-cyan-500',
    },
  ];

  const displayName = profile?.display_name?.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="app" />

      <div className="pt-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Welcome back, {displayName}! 👋</h1>
            <p className="text-muted-foreground">Let's continue your coding journey</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Recommended Problem */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative bg-card rounded-2xl p-8 shadow-2xl overflow-hidden border-gradient-animated"
                  style={{
                    boxShadow:
                      '0 0 0 1px rgba(255, 107, 53, 0.3), 0 8px 32px rgba(255, 107, 53, 0.2)',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent-secondary/5 opacity-50" />

                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Sparkles className="w-6 h-6 text-primary" />
                      </div>
                      <h2 className="text-2xl font-bold">Recommended for you</h2>
                    </div>

                    {data?.recommendation ? (
                      <>
                        <h3 className="text-3xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                          {data.recommendation.title}
                        </h3>

                        <div className="flex items-center gap-3 mb-6">
                          <span
                            className={`px-4 py-2 rounded-lg text-sm font-semibold ${difficultyClass(data.recommendation.difficulty)}`}
                          >
                            {data.recommendation.difficulty.charAt(0).toUpperCase() +
                              data.recommendation.difficulty.slice(1)}
                          </span>
                          {data.recommendation.topics.slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary/15 text-primary border border-primary/30"
                            >
                              {t}
                            </span>
                          ))}
                        </div>

                        <div className="p-5 rounded-xl bg-gradient-to-r from-info/10 to-info/5 border-2 border-info/30 mb-6">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-info/20 flex-shrink-0">
                              <Target className="w-5 h-5 text-info" />
                            </div>
                            <div>
                              <div className="font-bold text-base mb-1 text-info">
                                Why this problem?
                              </div>
                              <p className="text-base font-medium text-foreground">
                                {REASON_LABELS[data.recommendation.reason] ?? data.recommendation.reason}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <Link
                            to={`/problems/${data.recommendation.slug}`}
                            className="flex items-center gap-3 px-8 py-4 rounded-xl gradient-primary text-white font-bold text-lg shadow-2xl relative overflow-hidden group"
                          >
                            <span className="relative z-10">Start Problem</span>
                            <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                          </Link>
                          <Link
                            to="/problems"
                            className="text-base text-muted-foreground hover:text-primary transition-colors font-medium"
                          >
                            Browse all →
                          </Link>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xl text-muted-foreground mb-6">
                          Solve your first problem to get personalized recommendations!
                        </p>
                        <Link to="/problems" className="flex items-center gap-3 px-8 py-4 rounded-xl gradient-primary text-white font-bold text-lg shadow-2xl">
                          <span>Browse Problems</span>
                          <ArrowRight className="w-5 h-5" aria-hidden="true" />
                        </Link>
                      </>
                    )}
                  </div>
                </motion.div>

                {/* Recent Activity */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-card border border-border rounded-2xl p-6"
                >
                  <h2 className="text-lg font-bold mb-4">Recent Activity</h2>

                  {data?.recentActivity.length ? (
                    <div className="space-y-3">
                      {data.recentActivity.map((activity, index) => (
                        <motion.div
                          key={activity.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + index * 0.05 }}
                          className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/30 transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            {activity.passed ? (
                              <CheckCircle2 className="w-5 h-5 text-success" />
                            ) : (
                              <XCircle className="w-5 h-5 text-error" />
                            )}
                            <div>
                              <Link
                                to={`/problems/${activity.problemSlug}`}
                                className="font-semibold group-hover:text-primary transition-colors"
                              >
                                {activity.problemName}
                              </Link>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className={`capitalize ${difficultyTextClass(activity.difficulty)}`}>
                                  {activity.difficulty}
                                </span>
                                <span>•</span>
                                <span>{activity.timeAgoStr}</span>
                              </div>
                            </div>
                          </div>

                          <div
                            className={`font-semibold text-sm ${activity.passed ? 'text-success' : 'text-muted-foreground'
                              }`}
                          >
                            {activity.passed ? (
                              <span className="flex items-center gap-1">
                                Passed <TrendingUp className="w-4 h-4" />
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                Attempted <TrendingDown className="w-4 h-4" />
                              </span>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No activity yet — solve your first problem!
                    </p>
                  )}
                </motion.div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Skill Radar Chart */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-card border border-border rounded-2xl p-6"
                >
                  <h2 className="text-lg font-bold mb-4">Skill Overview</h2>

                  {topicLabels.length > 2 ? (
                    <div className="h-80 mb-4">
                      <Radar data={radarData} options={radarOptions} />
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                      Solve problems to build your skill radar
                    </div>
                  )}

                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">
                      {data?.overallMastery || 0}%
                    </div>
                    <div className="text-sm text-muted-foreground">overall mastery</div>
                  </div>
                </motion.div>

                {/* Stat Cards */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="grid grid-cols-2 gap-3"
                >
                  {stats.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + index * 0.05 }}
                        whileHover={{ scale: 1.05, y: -5 }}
                        className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-all"
                        role="article"
                        aria-label={`${stat.label}: ${stat.value}${stat.unit}`}
                      >
                        <div
                          className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center mb-3`}
                        >
                          <Icon className="w-5 h-5 text-white" aria-hidden="true" />
                        </div>
                        <div className="text-2xl font-bold mb-1">
                          {stat.value}
                          <span className="text-sm text-muted-foreground ml-1">{stat.unit}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{stat.label}</div>
                      </motion.div>
                    );
                  })}
                </motion.div>

                {/* Focus Areas */}
                {focusAreas.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-card border border-border rounded-2xl p-6"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <AlertCircle className="w-5 h-5 text-error" />
                      <h2 className="text-lg font-bold">Focus Areas</h2>
                    </div>

                    <div className="space-y-4">
                      {focusAreas.map((area, index) => (
                          <motion.div
                            key={area.name}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 + index * 0.05 }}
                            aria-label={`${area.name}: ${area.avgMastery}% mastery`}
                          >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold">{area.name}</span>
                            <span
                              className={`text-sm font-bold ${area.avgMastery < 30 ? 'text-error' : 'text-warning'
                                }`}
                            >
                              {area.avgMastery}%
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={area.avgMastery} aria-valuemin={0} aria-valuemax={100} aria-label={`${area.name} mastery progress`}>
                            <div
                              className={`h-full rounded-full ${area.avgMastery < 30 ? 'bg-error' : 'bg-warning'
                                }`}
                              style={{ width: `${area.avgMastery}%` }}
                            />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Interview Timeline */}
                {data?.interviewTimeline && data.interviewTimeline !== 'exploring' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-gradient-to-br from-primary/10 to-accent-secondary/10 border-2 border-primary/30 rounded-2xl p-6"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-5 h-5 text-primary" />
                      <h3 className="font-bold">Interview Timeline</h3>
                    </div>
                    <div className="text-3xl font-bold text-primary mb-1">
                      {TIMELINE_LABEL[data.interviewTimeline] || data.interviewTimeline}
                    </div>
                    {data.targetCompanies.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        targeting {data.targetCompanies.slice(0, 2).join(', ')}
                      </div>
                    )}
                    <Link to="/problems" className="block w-full mt-4 px-4 py-2 rounded-lg border-2 border-primary/30 hover:bg-primary/10 transition-colors text-sm font-semibold text-center">
                      Prepare Now
                    </Link>
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
