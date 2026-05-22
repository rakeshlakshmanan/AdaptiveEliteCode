import { motion, AnimatePresence } from 'motion/react';
import { Navbar } from '../components/Navbar';
import {
  Calendar,
  Trophy,
  TrendingUp,
  Target,
  Code2,
  CheckCircle2,
  Clock,
  Flame,
  Edit2,
  Lock,
  Sparkles,
  ArrowUp,
  X,
  Save,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Stats {
  streak: number;
  longestStreak: number;
  problemsSolved: number;
  overallMastery: number;
  memberSince: string;
}

interface MilestoneRow {
  id: number;
  title: string;
  icon: string;
  threshold: number;
  earned: boolean;
  earned_at: string | null;
}

interface WeeklyData {
  thisWeek: { problems: number; mastery: number };
  lastWeek: { problems: number; mastery: number };
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

const MILESTONE_ICONS: Record<string, any> = {
  CheckCircle2,
  Flame,
  Target,
  Code2,
  Trophy,
  Sparkles,
};

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  const [stats, setStats] = useState<Stats | null>(null);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
  const [progressChart, setProgressChart] = useState<{ week: string; mastery: number }[]>([]);
  const [heatmapCells, setHeatmapCells] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const since26w = new Date();
      since26w.setDate(since26w.getDate() - 181);

      const [streakRes, subsRes, masteryRes, milestonesRes, snapshotsRes, heatSubsRes] = await Promise.all([
        supabase.from('streaks').select('current_streak, longest_streak').eq('user_id', user.id).single(),
        supabase.from('submissions').select('problem_id, passed, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('user_mastery').select('topic_id, p_learned').eq('user_id', user.id),
        supabase.from('milestones').select('id, name, icon, threshold').order('sort_order'),
        supabase.from('mastery_snapshots').select('snapshot_date, overall_mastery').eq('user_id', user.id).order('snapshot_date', { ascending: true }).limit(5),
        supabase.from('submissions').select('created_at').eq('user_id', user.id).gte('created_at', since26w.toISOString()),
      ]);

      // user_milestones may not exist yet — fetch separately
      const userMilestonesRes = await supabase
        .from('user_milestones')
        .select('milestone_id, earned_at')
        .eq('user_id', user.id)
        .then((r) => r, () => ({ data: [] as any[] }));

      const streak = (streakRes.data as any)?.current_streak || 0;
      const longestStreak = (streakRes.data as any)?.longest_streak || 0;
      const subs = (subsRes.data || []) as any[];

      const solvedIds = new Set(
        subs.filter((s) => s.passed).map((s) => s.problem_id)
      );
      const problemsSolved = solvedIds.size;

      // Overall mastery
      const masteryRows = (masteryRes.data || []) as any[];
      const overallMastery =
        masteryRows.length > 0
          ? Math.round(
              (masteryRows.reduce((a, m) => a + (m.p_learned as number), 0) / masteryRows.length) *
                100
            )
          : 0;

      const memberSince = profileRef.current?.created_at ? formatDate(profileRef.current.created_at) : 'Recently';

      setStats({ streak, longestStreak, problemsSolved, overallMastery, memberSince });

      // Milestones
      const allMilestones = ((milestonesRes.data || []) as any[]).slice(0, 8);
      const earnedMap = new Map(
        ((userMilestonesRes.data || []) as any[]).map((um) => [
          um.milestone_id as number,
          um.earned_at as string,
        ])
      );
      const mapped: MilestoneRow[] = allMilestones.map((m) => ({
        id: m.id,
        title: m.name,
        icon: m.icon || '🏆',
        threshold: m.threshold,
        earned: earnedMap.has(m.id),
        earned_at: earnedMap.get(m.id) || null,
      }));
      setMilestones(mapped);

      // Weekly data: count subs this week vs last week
      const now = new Date();
      const startOfThisWeek = new Date(now);
      startOfThisWeek.setDate(now.getDate() - now.getDay());
      startOfThisWeek.setHours(0, 0, 0, 0);
      const startOfLastWeek = new Date(startOfThisWeek);
      startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

      const thisWeekSubs = subs.filter(
        (s) => new Date(s.created_at) >= startOfThisWeek
      );
      const lastWeekSubs = subs.filter(
        (s) =>
          new Date(s.created_at) >= startOfLastWeek &&
          new Date(s.created_at) < startOfThisWeek
      );

      setWeeklyData({
        thisWeek: { problems: thisWeekSubs.length, mastery: 0 },
        lastWeek: { problems: lastWeekSubs.length, mastery: 0 },
      });

      // 5-week trend from real snapshots
      const snaps = ((snapshotsRes.data || []) as any[]);
      const points = snaps.map((s, i) => ({ week: `W${i + 1}`, mastery: Math.round(s.overall_mastery) }));
      setProgressChart(points);

      // Heatmap from real submissions
      const countMap: Record<string, number> = {};
      ((heatSubsRes.data || []) as any[]).forEach((s) => {
        const key = new Date(s.created_at).toISOString().slice(0, 10);
        countMap[key] = (countMap[key] || 0) + 1;
      });
      const start = new Date(); start.setDate(start.getDate() - 181);
      const cells = Array.from({ length: 182 }, (_, i) => {
        const d = new Date(start); d.setDate(start.getDate() + i);
        return countMap[d.toISOString().slice(0, 10)] || 0;
      });
      setHeatmapCells(cells);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  function openEdit() {
    setEditName(profile?.display_name || '');
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!user) return;
    setEditSaving(true);
    await supabase.from('profiles').update({ display_name: editName }).eq('id', user.id);
    setEditSaving(false);
    setEditOpen(false);
    loadData();
    refreshProfile();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar variant="app" />
        <div className="pt-16 flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const initials = getInitials(profile?.display_name);

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="app" />

      <div className="pt-20 px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl p-8"
          >
            <div className="flex flex-col md:flex-row items-start gap-6">
              {/* Avatar */}
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary via-accent-secondary to-primary-light flex items-center justify-center text-white text-4xl font-bold shadow-lg overflow-hidden">
                {(profile?.avatar_url || user?.user_metadata?.avatar_url) ? (
                  <img
                    src={profile?.avatar_url || user?.user_metadata?.avatar_url}
                    alt="avatar"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  initials
                )}
              </div>

              <div className="flex-1 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">
                      {profile?.display_name || 'Unknown User'}
                    </h1>
                    <p className="text-base text-muted-foreground mb-1">{user?.email}</p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={openEdit}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-border hover:bg-muted transition-colors font-medium"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Profile
                  </motion.button>
                </div>

                {stats?.memberSince && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    Member since {stats.memberSince}
                  </div>
                )}

                {/* Stats Row */}
                <div className="flex flex-wrap gap-6 pt-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10 border border-primary/30">
                      <Flame className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold font-mono">{stats?.streak || 0}</div>
                      <div className="text-xs text-muted-foreground">Day Streak</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-warning/10 border border-warning/30">
                      <Trophy className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold font-mono">{stats?.longestStreak || 0}</div>
                      <div className="text-xs text-muted-foreground">Best Streak</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-success/10 border border-success/30">
                      <CheckCircle2 className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold font-mono">
                        {stats?.problemsSolved || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Problems Solved</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-info/10 border border-info/30">
                      <TrendingUp className="w-5 h-5 text-info" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold font-mono">
                        {stats?.overallMastery || 0}%
                      </div>
                      <div className="text-xs text-muted-foreground">Overall Mastery</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-warning/10 border border-warning/30">
                      <Clock className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold font-mono">
                        {profile?.level || 1}
                      </div>
                      <div className="text-xs text-muted-foreground">Level</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Milestones */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card border border-border rounded-2xl p-6"
            >
              <h2 className="text-2xl font-bold mb-6">Milestones</h2>

              {milestones.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Milestones not set up yet
                </p>
              ) : (
                <div className="space-y-4">
                  {milestones.map((milestone) => {
                    const Icon = MILESTONE_ICONS[milestone.icon] || Trophy;
                    return (
                      <div
                        key={milestone.id}
                        className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                          milestone.earned
                            ? 'bg-primary/5 border-primary/30'
                            : 'bg-muted/30 border-border opacity-60'
                        }`}
                      >
                        <div
                          className={`p-3 rounded-xl ${
                            milestone.earned
                              ? 'bg-primary/20 border-2 border-primary/40'
                              : 'bg-muted border-2 border-border'
                          }`}
                        >
                          {milestone.earned ? (
                            <Icon className="w-6 h-6 text-primary" />
                          ) : (
                            <Lock className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1">
                          <div className="font-bold text-base mb-1">{milestone.title}</div>
                          {milestone.earned ? (
                            <div className="text-xs text-muted-foreground">
                              Earned{' '}
                              {milestone.earned_at
                                ? new Date(milestone.earned_at).toLocaleDateString()
                                : ''}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              Goal: {milestone.threshold}
                            </div>
                          )}
                        </div>

                        {milestone.earned && <CheckCircle2 className="w-5 h-5 text-success" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Weekly Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-card border border-border rounded-2xl p-6"
            >
              <h2 className="text-2xl font-bold mb-6">Weekly Summary</h2>

              <div className="mb-6 p-5 rounded-xl bg-primary/5 border-2 border-primary/30">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold">This Week</h3>
                  {(weeklyData?.thisWeek.problems || 0) >=
                    (weeklyData?.lastWeek.problems || 0) && (
                    <div className="flex items-center gap-1 text-success text-sm font-semibold">
                      <ArrowUp className="w-4 h-4" />
                      Improving
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-3xl font-bold font-mono text-primary">
                      {weeklyData?.thisWeek.problems || 0}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Submissions</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold font-mono text-primary">
                      {stats?.overallMastery || 0}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Mastery</div>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-muted/30 border border-border mb-6">
                <h3 className="text-sm font-bold mb-3 text-muted-foreground">Last Week</h3>
                <div>
                  <div className="text-2xl font-bold font-mono">
                    {weeklyData?.lastWeek.problems || 0}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Submissions</div>
                </div>
              </div>

              {/* Mastery Trend */}
              {progressChart.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wide">
                    5-Week Trend
                  </h3>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={progressChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="week"
                        stroke="var(--muted-foreground)"
                        style={{ fontSize: '11px' }}
                      />
                      <YAxis
                        stroke="var(--muted-foreground)"
                        style={{ fontSize: '11px' }}
                        domain={[0, 100]}
                      />
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
              )}

              {/* Activity Heatmap */}
              {heatmapCells.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wide">
                    Activity (26 weeks)
                  </h3>
                  <div className="grid grid-rows-7 grid-flow-col gap-1">
                    {heatmapCells.map((count, i) => (
                      <div
                        key={i}
                        title={`${count} submission${count !== 1 ? 's' : ''}`}
                        className="w-3 h-3 rounded-sm"
                        style={{
                          backgroundColor:
                            count === 0 ? 'var(--muted)' :
                            count === 1 ? 'rgba(34,197,94,0.25)' :
                            count <= 3 ? 'rgba(34,197,94,0.5)' :
                            count <= 5 ? 'rgba(34,197,94,0.75)' :
                            'rgb(34,197,94)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
      {/* Edit Profile Modal */}
      <AnimatePresence>
        {editOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                transition={{ type: 'spring', duration: 0.35 }}
                className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl pointer-events-auto p-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Edit Profile</h2>
                  <button onClick={() => setEditOpen(false)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Display Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                      className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Email</label>
                    <input
                      type="email"
                      disabled
                      value={user?.email || ''}
                      className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-muted-foreground cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground">Change email in Account settings</p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <motion.button
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    onClick={saveEdit}
                    disabled={editSaving}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl gradient-primary text-primary-foreground font-semibold disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {editSaving ? 'Saving...' : 'Save'}
                  </motion.button>
                  <button
                    onClick={() => setEditOpen(false)}
                    className="px-6 py-3 rounded-xl border-2 border-border hover:bg-muted transition-colors font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
