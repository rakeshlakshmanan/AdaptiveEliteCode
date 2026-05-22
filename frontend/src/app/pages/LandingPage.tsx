import { motion } from 'motion/react';
import { Navbar } from '../components/Navbar';
import { ArrowRight, Sparkles, TrendingUp, Target, Zap, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users — handles Google OAuth callback and email confirmation
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (profile?.onboarding_completed) {
      navigate('/dashboard', { replace: true });
    } else {
      // profile may be null briefly after first login — still send to onboarding
      navigate('/onboarding', { replace: true });
    }
  }, [user, profile, loading, navigate]);
  const features = [
    {
      icon: Target,
      title: 'Adaptive Learning',
      description: 'AI-powered system identifies your weak spots and creates a personalized study plan.',
    },
    {
      icon: TrendingUp,
      title: 'Track Progress',
      description: 'Visualize your improvement with detailed analytics and performance metrics.',
    },
    {
      icon: Zap,
      title: 'Real Interview Prep',
      description: 'Practice with problems from actual FAANG interviews and coding assessments.',
    },
  ];

  const stats = [
    { value: '50K+', label: 'Engineers Prepared' },
    { value: '2,000+', label: 'Practice Problems' },
    { value: '95%', label: 'Success Rate' },
  ];

  // Show spinner while auth resolves — avoids flash of landing page for logged-in users
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="landing" />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">AI-Powered Interview Preparation</span>
            </motion.div>

            {/* Headline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="space-y-4"
            >
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
                Master coding interviews with{' '}
                <span className="bg-gradient-to-r from-primary to-primary-hover bg-clip-text text-transparent">
                  adaptive learning
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
                EliteCode analyzes your performance in real-time and builds a personalized roadmap to land your dream job at top tech companies.
              </p>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link to="/signup">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full sm:w-auto px-8 py-4 rounded-lg bg-primary text-primary-foreground font-semibold text-base hover:bg-primary-hover transition-colors flex items-center gap-2 shadow-lg shadow-primary/20"
                >
                  Start Learning for Free
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </Link>
              <Link to="/problems">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full sm:w-auto px-8 py-4 rounded-lg border border-border font-semibold text-base hover:bg-accent transition-colors"
                >
                  Browse Problems
                </motion.button>
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="grid grid-cols-3 gap-8 pt-12 max-w-2xl mx-auto"
            >
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold">{stat.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-center space-y-4 mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold">Why EliteCode?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our platform adapts to your learning style and focuses on areas that need the most improvement.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -4 }}
                  className="p-8 rounded-xl bg-card border border-border hover:shadow-lg transition-all"
                >
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-center space-y-4 mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold">How It Works</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Get started in minutes and see results in days.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '1', title: 'Sign Up', description: 'Create your free account in seconds' },
              { step: '2', title: 'Take Assessment', description: 'We evaluate your current skill level' },
              { step: '3', title: 'Get Your Roadmap', description: 'Receive a personalized study plan' },
              { step: '4', title: 'Land Offers', description: 'Ace interviews at top companies' },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground font-bold text-2xl flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <p className="text-sm text-muted-foreground">Trusted by engineers at</p>
            <div className="flex flex-wrap items-center justify-center gap-12">
              {['Google', 'Meta', 'Amazon', 'Apple', 'Microsoft', 'Netflix'].map((company) => (
                <div key={company} className="text-2xl font-bold text-muted-foreground/60">
                  {company}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="p-12 rounded-2xl bg-gradient-to-br from-primary to-primary-hover text-primary-foreground text-center space-y-6"
          >
            <h2 className="text-3xl sm:text-4xl font-bold">Ready to ace your next interview?</h2>
            <p className="text-lg opacity-90 max-w-2xl mx-auto">
              Join thousands of engineers who've landed their dream jobs with EliteCode.
            </p>
            <Link to="/signup">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-4 rounded-lg bg-white text-primary font-semibold text-base hover:bg-white/90 transition-colors inline-flex items-center gap-2"
              >
                Get Started for Free
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
          <p>© 2026 EliteCode. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
