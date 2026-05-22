import { motion } from 'motion/react';
import { Navbar } from '../components/Navbar';
import {
  User,
  Target,
  Sliders,
  Brain,
  CreditCard,
  Bell,
  Shield,
  LogOut,
  Trash2,
  Save,
  ChevronRight,
  RotateCcw,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { ThemeToggle } from '../components/ThemeToggle';
import { Dropdown } from '../components/Dropdown';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router';

type SettingsTab = 'profile' | 'interview-prep' | 'preferences' | 'your-model' | 'account';

const EXP_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};
const BG_LABEL: Record<string, string> = {
  cs_undergrad: 'CS Student',
  bootcamp: 'Bootcamp',
  self_taught: 'Self-Taught',
  career_switch: 'Career Switcher',
};
const PRIOR_LABEL: Record<string, string> = {
  none: '0 problems',
  under_50: '<50 problems',
  '50_to_200': '50–200 problems',
  over_200: '200+ problems',
};

interface TopicMastery {
  name: string;
  avgMastery: number;
}

export default function SettingsPage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<SettingsTab>('your-model');
  const [emailNotifications, setEmailNotifications] = useState(profile?.email_notifications ?? true);
  const [language, setLanguage] = useState(profile?.preferred_language || 'python');
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [interviewTimeline, setInterviewTimeline] = useState(profile?.interview_timeline || '');
  const [targetCompanies, setTargetCompanies] = useState<string[]>(profile?.target_companies || []);
  const [interviewSaving, setInterviewSaving] = useState(false);
  const [interviewSaved, setInterviewSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Preferences save state
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);

  // Profile save state
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Your Model data
  const [topicMasteries, setTopicMasteries] = useState<TopicMastery[]>([]);
  const [masteryLoading, setMasteryLoading] = useState(false);

  // Sync state if profile loads late
  useEffect(() => {
    if (profile) {
      setLanguage(profile.preferred_language || 'python');
      setDisplayName(profile.display_name || '');
      setEmailNotifications(profile.email_notifications ?? true);
      setInterviewTimeline(profile.interview_timeline || '');
      setTargetCompanies(profile.target_companies || []);
    }
  }, [profile]);

  const loadMastery = useCallback(async () => {
    if (!user) return;
    setMasteryLoading(true);
    try {
      const [masteryRes, topicsRes] = await Promise.all([
        supabase
          .from('user_mastery')
          .select('topic_id, p_learned')
          .eq('user_id', user.id),
        supabase.from('topics').select('id, name, display_name').order('tier'),
      ]);

      const masteryRows = (masteryRes.data || []) as any[];
      const topicList = (topicsRes.data || []) as any[];

      const byTopic: Record<number, number[]> = {};
      masteryRows.forEach((m) => {
        if (!byTopic[m.topic_id]) byTopic[m.topic_id] = [];
        byTopic[m.topic_id].push(m.p_learned as number);
      });

      const masteries: TopicMastery[] = topicList.map((t) => {
        const vals = byTopic[t.id] || [0];
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        return { name: t.display_name || t.name, avgMastery: Math.round(avg * 100) };
      });

      setTopicMasteries(masteries);
    } finally {
      setMasteryLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === 'your-model') loadMastery();
  }, [activeTab, loadMastery]);

  async function savePreferences() {
    if (!user) return;
    setPrefSaving(true);
    await supabase
      .from('profiles')
      .update({ preferred_language: language, email_notifications: emailNotifications })
      .eq('id', user.id);
    setPrefSaving(false);
    setPrefSaved(true);
    setTimeout(() => setPrefSaved(false), 2000);
  }

  async function saveProfile() {
    if (!user) return;
    setProfileSaving(true);
    await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', user.id);
    setProfileSaving(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  async function handleResetTopic(topicName: string) {
    if (!user) return;
    const { data: topic } = await supabase
      .from('topics')
      .select('id')
      .eq('name', topicName)
      .single();
    if (!topic) return;
    await supabase
      .from('user_mastery')
      .update({ p_learned: 0.1 })
      .eq('user_id', user.id)
      .eq('topic_id', (topic as any).id);
    loadMastery();
  }

  async function saveInterview() {
    if (!user) return;
    setInterviewSaving(true);
    await supabase.from('profiles').update({ interview_timeline: interviewTimeline, target_companies: targetCompanies }).eq('id', user.id);
    setInterviewSaving(false);
    setInterviewSaved(true);
    setTimeout(() => setInterviewSaved(false), 2000);
  }

  async function handleDeleteAccount() {
    if (!user) return;
    await supabase.from('profiles').delete().eq('id', user.id);
    await signOut();
    navigate('/', { replace: true });
  }

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  const strongAreas = topicMasteries.filter((t) => t.avgMastery >= 60).slice(0, 5);
  const focusAreas = topicMasteries.filter((t) => t.avgMastery < 40).slice(0, 5);

  const sidebarItems = [
    { id: 'profile' as SettingsTab, label: 'Profile', icon: User },
    { id: 'interview-prep' as SettingsTab, label: 'Interview Prep', icon: Target },
    { id: 'preferences' as SettingsTab, label: 'Preferences', icon: Sliders },
    { id: 'your-model' as SettingsTab, label: 'Your Model', icon: Brain },
    { id: 'account' as SettingsTab, label: 'Account', icon: CreditCard },
  ];

  const stereotypeParts = [
    profile?.experience_level ? EXP_LABEL[profile.experience_level] : null,
    profile?.background ? BG_LABEL[profile.background] : null,
    profile?.prior_platform_exp ? PRIOR_LABEL[profile.prior_platform_exp] : null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="app" />

      <div className="pt-16 flex">
        {/* Left Sidebar */}
        <motion.aside
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="w-64 border-r border-border min-h-screen bg-card/30 backdrop-blur-sm sticky top-16"
        >
          <div className="p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-4">
              Settings
            </h2>
            <nav className="space-y-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <motion.button
                    key={item.id}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-lg'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                    {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </motion.button>
                );
              })}
            </nav>
          </div>
        </motion.aside>

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-4xl mx-auto">
            {/* Your Model */}
            {activeTab === 'your-model' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div>
                  <h1 className="text-3xl font-bold mb-2">
                    What EliteCode knows about you
                  </h1>
                  <p className="text-muted-foreground">
                    This updates automatically as you practice. You can reset any topic to
                    start fresh.
                  </p>
                </div>

                {/* Profile Summary */}
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  className="p-6 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        {stereotypeParts.length > 0 ? (
                          stereotypeParts.map((part, i) => (
                            <span key={i} className="font-semibold">
                              {i > 0 && (
                                <span className="text-muted-foreground mx-1">·</span>
                              )}
                              {part}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted-foreground">
                            Complete onboarding to see your profile
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">Your learning profile</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Your initial skill estimates were set based on your declared experience. They update automatically each time you solve a problem.
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ x: 4 }}
                      onClick={() => setActiveTab('preferences')}
                      className="flex items-center gap-2 text-primary hover:text-primary-light transition-colors font-medium"
                    >
                      Edit in Preferences
                      <ChevronRight className="w-4 h-4" />
                    </motion.button>
                  </div>
                </motion.div>

                {masteryLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Strong Areas */}
                    {strongAreas.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="p-6 rounded-2xl border-2 border-success/30 bg-success/5"
                      >
                        <div className="flex items-center gap-2 mb-4">
                          <TrendingUp className="w-5 h-5 text-success" />
                          <h2 className="text-xl font-bold text-success">Strong areas</h2>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {strongAreas.map((area) => (
                            <motion.div
                              key={area.name}
                              whileHover={{ scale: 1.05, y: -2 }}
                              className="px-5 py-3 rounded-full bg-success/20 border border-success/30 backdrop-blur-sm"
                            >
                              <span className="font-semibold text-success">{area.name}</span>
                              <span className="ml-2 text-sm font-bold text-success">
                                {area.avgMastery}%
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Focus Areas */}
                    {focusAreas.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="p-6 rounded-2xl border-2 border-error/30 bg-error/5"
                      >
                        <div className="flex items-center gap-2 mb-4">
                          <AlertCircle className="w-5 h-5 text-error" />
                          <h2 className="text-xl font-bold text-error">Focus areas</h2>
                        </div>
                        <div className="space-y-3">
                          {focusAreas.map((area) => (
                            <motion.div
                              key={area.name}
                              whileHover={{ x: 4 }}
                              className="flex items-center justify-between p-4 rounded-xl bg-error/10 border border-error/20 hover:border-error/40 transition-all"
                            >
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-error">{area.name}</span>
                                  <span className="text-sm font-bold text-error/70">
                                    {area.avgMastery}%
                                  </span>
                                </div>
                                <div className="w-32 h-2 bg-error/10 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-error rounded-full"
                                    style={{ width: `${area.avgMastery}%` }}
                                  />
                                </div>
                              </div>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleResetTopic(area.name)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-error/30 hover:bg-error/20 transition-colors text-error font-medium text-sm"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Reset
                              </motion.button>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {strongAreas.length === 0 && focusAreas.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        Solve problems to build your model
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div>
                  <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
                  <p className="text-muted-foreground">
                    Manage your public profile and personal information
                  </p>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Display Name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={saveProfile}
                    disabled={profileSaving}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-lg disabled:opacity-50"
                  >
                    {profileSaved ? (
                      <>
                        <CheckCircle2 className="w-5 h-5" /> Saved!
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        {profileSaving ? 'Saving...' : 'Save Profile'}
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Preferences Tab */}
            {activeTab === 'preferences' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div>
                  <h1 className="text-3xl font-bold mb-2">Preferences</h1>
                  <p className="text-muted-foreground">Customize your EliteCode experience</p>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-border">
                    <div>
                      <h3 className="font-semibold mb-1">Theme</h3>
                      <p className="text-sm text-muted-foreground">Choose your visual preference</p>
                    </div>
                    <ThemeToggle />
                  </div>

                  <div className="flex items-center justify-between pb-4 border-b border-border">
                    <div>
                      <h3 className="font-semibold mb-1">Preferred Language</h3>
                      <p className="text-sm text-muted-foreground">Default coding language</p>
                    </div>
                    <Dropdown
                      className="w-48"
                      options={[
                        { value: 'python', label: 'Python' },
                        { value: 'java', label: 'Java' },
                        { value: 'cpp', label: 'C++' },
                        { value: 'javascript', label: 'JavaScript' },
                        { value: 'go', label: 'Go' },
                      ]}
                      value={language}
                      onChange={setLanguage}
                    />
                  </div>
                </div>

                {/* Notifications */}
                <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Bell className="w-5 h-5 text-primary" />
                    Notifications
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Email Notifications</div>
                        <div className="text-sm text-muted-foreground">
                          Receive emails about your progress
                        </div>
                      </div>
                      <button
                        onClick={() => setEmailNotifications(!emailNotifications)}
                        className={`relative w-14 h-7 rounded-full transition-colors ${
                          emailNotifications ? 'bg-primary' : 'bg-muted'
                        }`}
                      >
                        <motion.div
                          animate={{ x: emailNotifications ? 28 : 2 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-md"
                        />
                      </button>
                    </div>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={savePreferences}
                  disabled={prefSaving}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-lg disabled:opacity-50"
                >
                  {prefSaved ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" /> Saved!
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      {prefSaving ? 'Saving...' : 'Save Preferences'}
                    </>
                  )}
                </motion.button>
              </motion.div>
            )}

            {/* Account Tab */}
            {activeTab === 'account' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div>
                  <h1 className="text-3xl font-bold mb-2">Account Settings</h1>
                  <p className="text-muted-foreground">Manage your account security and data</p>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Email Address</label>
                    <input
                      type="email"
                      disabled
                      value={user?.email || ''}
                      className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-muted-foreground cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email is managed through your auth provider
                    </p>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-error/5 border-2 border-error/30 rounded-2xl p-6 space-y-4">
                  <h3 className="font-bold text-error flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Danger Zone
                  </h3>
                  <div className="space-y-3">
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={handleSignOut}
                      className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-error/30 hover:bg-error/10 transition-colors"
                    >
                      <div className="text-left">
                        <div className="font-semibold">Sign Out</div>
                        <div className="text-sm text-muted-foreground">
                          Sign out from all devices
                        </div>
                      </div>
                      <LogOut className="w-5 h-5 text-error" />
                    </motion.button>
                    {!deleteConfirm ? (
                      <motion.button
                        whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                        onClick={() => setDeleteConfirm(true)}
                        className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-error/30 hover:bg-error/10 transition-colors"
                      >
                        <div className="text-left">
                          <div className="font-semibold text-error">Delete Account</div>
                          <div className="text-sm text-muted-foreground">Permanently delete your account and all data</div>
                        </div>
                        <Trash2 className="w-5 h-5 text-error" />
                      </motion.button>
                    ) : (
                      <div className="p-4 rounded-xl border-2 border-error bg-error/10 space-y-3">
                        <p className="font-semibold text-error">Are you sure? This cannot be undone.</p>
                        <div className="flex gap-3">
                          <motion.button
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={handleDeleteAccount}
                            className="flex-1 py-2 rounded-lg bg-error text-white font-semibold"
                          >
                            Yes, delete everything
                          </motion.button>
                          <button
                            onClick={() => setDeleteConfirm(false)}
                            className="flex-1 py-2 rounded-lg border-2 border-border hover:bg-muted transition-colors font-semibold"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Interview Prep Tab */}
            {activeTab === 'interview-prep' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div>
                  <h1 className="text-3xl font-bold mb-2">Interview Prep</h1>
                  <p className="text-muted-foreground">Configure your interview preparation goals</p>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Interview Timeline</label>
                    <Dropdown
                      className="w-full"
                      options={[
                        { value: '', label: 'Not set' },
                        { value: 'under_2_weeks', label: 'Under 2 weeks' },
                        { value: '1_to_3_months', label: '1–3 months' },
                        { value: '3_plus_months', label: '3+ months' },
                        { value: 'exploring', label: 'Just exploring' },
                      ]}
                      value={interviewTimeline}
                      onChange={setInterviewTimeline}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-semibold">Target Companies</label>
                    <div className="flex flex-wrap gap-2">
                      {['Google', 'Amazon', 'Microsoft', 'Meta', 'Apple', 'Netflix', 'Stripe', 'Uber', 'Airbnb', 'LinkedIn'].map((co) => {
                        const val = co.toLowerCase();
                        const active = targetCompanies.includes(val);
                        return (
                          <motion.button
                            key={co}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setTargetCompanies(active ? targetCompanies.filter(c => c !== val) : [...targetCompanies, val])}
                            className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${active ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}
                          >
                            {co}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  onClick={saveInterview}
                  disabled={interviewSaving}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-lg disabled:opacity-50"
                >
                  {interviewSaved ? <><CheckCircle2 className="w-5 h-5" /> Saved!</> : <><Save className="w-5 h-5" />{interviewSaving ? 'Saving...' : 'Save'}</>}
                </motion.button>
              </motion.div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
