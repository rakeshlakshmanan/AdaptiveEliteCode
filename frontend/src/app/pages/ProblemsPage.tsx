import { motion } from 'motion/react';
import { Navbar } from '../components/Navbar';
import { difficultyClass } from '../lib/difficulty';
import { Dropdown } from '../components/Dropdown';
import { IncompleteSessionBanner } from '../components/IncompleteSessionBanner';
import { EmptyProblems } from '../components/EmptyStates';
import {
  Search,
  Sparkles,
  AlertCircle as AlertIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../context/AuthContext';

type DifficultyFilter = 'all' | 'easy' | 'medium' | 'hard';
type StatusFilter = 'all' | 'solved' | 'unsolved' | 'attempted';

interface Problem {
  id: number;
  slug: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topics: string[];
  topicSlugs: string[];
  companies: string[];
  mastery: number;
  acceptanceRate: number;
  status: 'solved' | 'unsolved' | 'attempted';
}

interface TopicOption {
  value: string;
  label: string;
}

const COMPANY_OPTIONS = [
  { value: 'all', label: 'All Companies' },
  { value: 'google', label: 'Google' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'microsoft', label: 'Microsoft' },
  { value: 'meta', label: 'Meta' },
  { value: 'apple', label: 'Apple' },
  { value: 'netflix', label: 'Netflix' },
];

const SESSION_KEY = 'elitecode_session';

function timeAgo(savedAt: string): string {
  const diff = Date.now() - new Date(savedAt).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

export default function ProblemsPage() {
  const { user } = useAuth();

  const [problems, setProblems] = useState<Problem[]>([]);
  const [topicOptions, setTopicOptions] = useState<TopicOption[]>([
    { value: 'all', label: 'All Topics' },
  ]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [savedSession, setSavedSession] = useState<{ slug: string; title: string; timeAgo: string } | null>(null);

  // Check localStorage for an incomplete session
  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      if (s.slug && s.title) {
        setSavedSession({ slug: s.slug, title: s.title, timeAgo: timeAgo(s.savedAt || '') });
      }
    } catch {}
  }, []);

  const handleDiscardSession = () => {
    localStorage.removeItem(SESSION_KEY);
    setSavedSession(null);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState('all');
  const [difficultyFilters, setDifficultyFilters] = useState<Set<DifficultyFilter>>(
    new Set(['all'])
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [recommendedOnly, setRecommendedOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const loadData = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      // Topics for dropdown
      const { data: topicsData } = await supabase
        .from('topics')
        .select('name, display_name')
        .order('tier');
      if (topicsData) {
        setTopicOptions([
          { value: 'all', label: 'All Topics' },
          ...topicsData.map((t) => ({ value: t.name, label: t.display_name || t.name })),
        ]);
      }

      // Problems with nested topics
      const { data: problemsData, error: pErr } = await supabase
        .from('problems')
        .select(
          'id, slug, title, difficulty, company_frequency, problem_topics(topic_id, topics(id, name, display_name))'
        )
        .order('id');
      if (pErr) throw pErr;

      // User submissions (to determine solved/attempted status)
      let subMap: Record<number, 'solved' | 'attempted'> = {};
      if (user) {
        const { data: subData } = await supabase
          .from('submissions')
          .select('problem_id, passed')
          .eq('user_id', user.id);
        (subData || []).forEach((s) => {
          const pid = s.problem_id as number;
          if (s.passed) {
            subMap[pid] = 'solved';
          } else if (!subMap[pid]) {
            subMap[pid] = 'attempted';
          }
        });
      }

      // Acceptance rates from problem_stats view
      let acceptanceMap: Record<number, number> = {};
      const { data: statsData } = await supabase.from('problem_stats').select('problem_id, acceptance_rate');
      (statsData || []).forEach((s: any) => { acceptanceMap[s.problem_id] = s.acceptance_rate || 0; });

      // User mastery per topic+difficulty
      let masteryMap: Record<string, number> = {};
      if (user) {
        const { data: masteryData } = await supabase
          .from('user_mastery')
          .select('topic_id, difficulty, p_learned')
          .eq('user_id', user.id);
        (masteryData || []).forEach((m) => {
          masteryMap[`${m.topic_id}_${m.difficulty}`] = m.p_learned as number;
        });
      }

      const mapped: Problem[] = (problemsData || []).map((p: any) => {
        const pts: any[] = p.problem_topics || [];
        const primary = pts[0];
        const topicNames: string[] = pts.map((pt) => pt.topics?.display_name || pt.topics?.name).filter(Boolean);
        const topicSlugs: string[] = pts.map((pt) => pt.topics?.name).filter(Boolean);

        const masteryKey = primary ? `${primary.topic_id}_${p.difficulty}` : '';
        const mastery = masteryKey
          ? Math.round((masteryMap[masteryKey] || 0) * 100)
          : 0;

        const freq = (p.company_frequency || {}) as Record<string, number>;
        const companies = Object.entries(freq)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([c]) => c.charAt(0).toUpperCase() + c.slice(1));

        return {
          id: p.id,
          slug: p.slug,
          title: p.title,
          difficulty: p.difficulty as 'easy' | 'medium' | 'hard',
          topics: topicNames,
          topicSlugs,
          companies,
          mastery,
          acceptanceRate: acceptanceMap[p.id as number] || 0,
          status: subMap[p.id as number] || 'unsolved',
        };
      });

      setProblems(mapped);
    } catch (e: any) {
      setFetchError(e.message || 'Failed to load problems');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleDifficulty = (difficulty: DifficultyFilter) => {
    const next = new Set(difficultyFilters);
    if (difficulty === 'all') {
      next.clear();
      next.add('all');
    } else {
      next.delete('all');
      if (next.has(difficulty)) {
        next.delete(difficulty);
      } else {
        next.add(difficulty);
      }
      if (next.size === 0) next.add('all');
    }
    setDifficultyFilters(next);
    setCurrentPage(1);
  };

  const filteredProblems = problems.filter((p) => {
    if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase()))
      return false;
    if (!difficultyFilters.has('all') && !difficultyFilters.has(p.difficulty))
      return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (topicFilter !== 'all' && !p.topicSlugs.includes(topicFilter)) return false;
    if (
      companyFilter !== 'all' &&
      !p.companies.some((c) => c.toLowerCase() === companyFilter)
    )
      return false;
    if (recommendedOnly && p.status === 'solved') return false;
    return true;
  });

  const totalPages = Math.ceil(filteredProblems.length / itemsPerPage);
  const paginatedProblems = filteredProblems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="app" />

      {/* Header */}
      <div className="pt-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2">Problems</h1>
              <p className="text-base text-muted-foreground">
                Solve problems to build your skills and ace your interviews
              </p>
            </div>
            {!loading && (
              <div className="text-sm text-muted-foreground">
                {filteredProblems.length} problem{filteredProblems.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {savedSession && (
            <IncompleteSessionBanner
              problemSlug={savedSession.slug}
              problemTitle={savedSession.title}
              timeAgo={savedSession.timeAgo}
              onDiscard={handleDiscardSession}
            />
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-16 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Dropdown
              className="w-44"
              options={topicOptions}
              value={topicFilter}
              onChange={(v) => { setTopicFilter(v); setCurrentPage(1); }}
            />

            <div className="flex items-center gap-2 p-1 bg-muted rounded-xl">
              {(['all', 'easy', 'medium', 'hard'] as DifficultyFilter[]).map((diff) => (
                <motion.button
                  key={diff}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleDifficulty(diff)}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all capitalize ${
                    difficultyFilters.has(diff)
                      ? diff === 'all'
                        ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                        : difficultyClass(diff) + ' shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {diff}
                </motion.button>
              ))}
            </div>

            <Dropdown
              className="w-40"
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'solved', label: 'Solved' },
                { value: 'unsolved', label: 'Unsolved' },
                { value: 'attempted', label: 'Attempted' },
              ]}
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v as StatusFilter); setCurrentPage(1); }}
            />

            <Dropdown
              className="w-40"
              options={COMPANY_OPTIONS}
              value={companyFilter}
              onChange={(v) => { setCompanyFilter(v); setCurrentPage(1); }}
            />

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setRecommendedOnly(!recommendedOnly); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-medium transition-all ${
                recommendedOnly
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Recommended
            </motion.button>

            <div className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-input border border-border focus-within:border-primary/50 transition-all">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search problems..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="bg-transparent outline-none w-48"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-6 px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : fetchError ? (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-error/10 border border-error/20 text-error">
              <AlertIcon className="w-5 h-5 shrink-0" />
              {fetchError}
            </div>
          ) : filteredProblems.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
              <EmptyProblems />
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full" role="table" aria-label="Problems list">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground w-16">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Title
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground w-24">
                        Difficulty
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Topics
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Companies
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground w-32">
                        Mastery
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground w-20">
                        Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedProblems.map((problem) => (
                      <motion.tr
                        key={problem.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-border hover:bg-primary/5 transition-colors cursor-pointer group"
                      >
                        {/* Status */}
                        <td className="px-4 py-3">
                          {problem.status === 'solved' ? (
                            <CheckCircle2 className="w-5 h-5 text-success" aria-label="Solved" role="status" />
                          ) : problem.status === 'attempted' ? (
                            <div className="w-5 h-5 rounded-full border-2 border-warning flex items-center justify-center" aria-label="Attempted" role="status">
                              <div className="w-2 h-2 rounded-full bg-warning" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-border group-hover:border-primary/50 transition-colors" aria-label="Unsolved" role="status" />
                          )}
                        </td>

                        {/* Title */}
                        <td className="px-4 py-3">
                          <Link
                            to={`/problems/${problem.slug}`}
                            className="font-medium hover:text-primary transition-colors flex items-center gap-2"
                          >
                            <span>{problem.title}</span>
                          </Link>
                        </td>

                        {/* Difficulty */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold ${difficultyClass(problem.difficulty)}`}
                          >
                            {problem.difficulty.charAt(0).toUpperCase() +
                              problem.difficulty.slice(1)}
                          </span>
                        </td>

                        {/* Topics */}
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 flex-wrap">
                            {problem.topics.slice(0, 2).map((topic, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary"
                              >
                                {topic}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Companies */}
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 flex-wrap">
                            {problem.companies.slice(0, 2).map((company, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground"
                              >
                                {company}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Mastery */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-primary to-primary-light rounded-full"
                                style={{ width: `${problem.mastery}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-muted-foreground w-10">
                              {problem.mastery}%
                            </span>
                          </div>
                        </td>

                        {/* Acceptance Rate */}
                        <td className="px-4 py-3">
                          <span className="text-sm text-muted-foreground">
                            {problem.acceptanceRate}%
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                      {Math.min(currentPage * itemsPerPage, filteredProblems.length)} of{' '}
                      {filteredProblems.length} problems
                    </p>

                    <div className="flex items-center gap-2" role="navigation" aria-label="Pagination">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                      </motion.button>

                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = i + 1;
                        return (
                          <motion.button
                            key={pageNum}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-10 h-10 rounded-lg font-semibold transition-all ${
                              currentPage === pageNum
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'border border-border hover:bg-muted'
                            }`}
                            aria-label={`Go to page ${pageNum}`}
                            aria-current={currentPage === pageNum ? 'page' : undefined}
                          >
                            {pageNum}
                          </motion.button>
                        );
                      })}

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Next page"
                      >
                        <ChevronRight className="w-4 h-4" aria-hidden="true" />
                      </motion.button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
