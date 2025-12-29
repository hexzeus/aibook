import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Cpu, Save, Bell } from 'lucide-react';
import Layout from '../components/Layout';
import { creditsApi, userApi } from '../lib/api';
import { useToastStore } from '../store/toastStore';

export default function Settings() {
  const queryClient = useQueryClient();
  const toast = useToastStore();
  const [email, setEmail] = useState('');
  const [notifications, setNotifications] = useState({
    bookComplete: true,
    pageGenerated: false,
    creditLow: true,
    weeklyDigest: false,
    affiliateEarnings: true,
  });

  const { data: stats } = useQuery({
    queryKey: ['credits'],
    queryFn: creditsApi.getCredits,
  });

  const updateEmailMutation = useMutation({
    mutationFn: (email: string) => userApi.updateEmail(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      setEmail('');
      toast.success('Email updated successfully!');
    },
  });

  const updateModelMutation = useMutation({
    mutationFn: (model: 'claude' | 'openai') => userApi.updatePreferredModel(model),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      toast.success(`AI model changed to ${variables === 'claude' ? 'Claude (Anthropic)' : 'GPT-4 (OpenAI)'}`);
    },
  });

  const currentModel = stats?.preferred_model || 'claude';

  // Load notification preferences from database
  const { data: savedPreferences } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: userApi.getNotificationPreferences,
  });

  useEffect(() => {
    if (savedPreferences) {
      setNotifications(savedPreferences);
    }
  }, [savedPreferences]);

  const updateNotificationsMutation = useMutation({
    mutationFn: (preferences: Record<string, boolean>) =>
      userApi.updateNotificationPreferences(preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast.success('Notification preferences updated');
    },
  });

  const handleNotificationToggle = (key: keyof typeof notifications) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    updateNotificationsMutation.mutate(updated);
  };

  return (
    <Layout>
      <div className="page-container max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold mb-2">Settings</h1>
          <p className="text-gray-400 text-lg">
            Manage your account preferences
          </p>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Mail className="w-6 h-6 text-brand-400" />
              Email Address
            </h3>
            <p className="text-gray-400 mb-4 text-sm">
              Update your email for important notifications and updates
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateEmailMutation.mutate(email);
              }}
              className="flex items-center gap-3"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter new email address"
                className="input-field flex-1"
                required
              />
              <button
                type="submit"
                disabled={updateEmailMutation.isPending || !email.trim()}
                className="btn-primary flex items-center gap-2"
              >
                <Save className="w-5 h-5" />
                {updateEmailMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </form>
          </div>

          <div className="card">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Cpu className="w-6 h-6 text-brand-400" />
              AI Model Preference
            </h3>
            <p className="text-gray-400 mb-6 text-sm">
              Choose which AI model to use for book generation
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => updateModelMutation.mutate('claude')}
                disabled={updateModelMutation.isPending}
                className={`p-6 rounded-xl border-2 transition-all text-left ${
                  currentModel === 'claude'
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-white/10 hover:border-white/20 bg-white/5'
                }`}
              >
                <div className="font-bold text-lg mb-2">Claude (Anthropic)</div>
                <div className="text-sm text-gray-400 mb-3">
                  Advanced reasoning and creative writing. Best for fiction and complex narratives.
                </div>
                <div className="text-xs text-brand-400">
                  {currentModel === 'claude' && '✓ Currently selected'}
                </div>
              </button>

              <button
                onClick={() => updateModelMutation.mutate('openai')}
                disabled={updateModelMutation.isPending}
                className={`p-6 rounded-xl border-2 transition-all text-left ${
                  currentModel === 'openai'
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-white/10 hover:border-white/20 bg-white/5'
                }`}
              >
                <div className="font-bold text-lg mb-2">GPT-4 (OpenAI)</div>
                <div className="text-sm text-gray-400 mb-3">
                  Versatile and fast. Great for educational content and non-fiction.
                </div>
                <div className="text-xs text-brand-400">
                  {currentModel === 'openai' && '✓ Currently selected'}
                </div>
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Bell className="w-6 h-6 text-brand-400" />
              Notification Preferences
            </h3>
            <p className="text-gray-400 mb-6 text-sm">
              Choose which email notifications you'd like to receive
            </p>
            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer">
                <div>
                  <div className="font-semibold mb-1">Book Completion</div>
                  <div className="text-sm text-gray-400">
                    Notify me when a book generation is complete
                  </div>
                </div>
                <button
                  onClick={() => handleNotificationToggle('bookComplete')}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    notifications.bookComplete ? 'bg-brand-500' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                      notifications.bookComplete ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </button>
              </label>

              <label className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer">
                <div>
                  <div className="font-semibold mb-1">Page Generated</div>
                  <div className="text-sm text-gray-400">
                    Notify me each time a new page is generated
                  </div>
                </div>
                <button
                  onClick={() => handleNotificationToggle('pageGenerated')}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    notifications.pageGenerated ? 'bg-brand-500' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                      notifications.pageGenerated ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </button>
              </label>

              <label className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer">
                <div>
                  <div className="font-semibold mb-1">Low Credits Warning</div>
                  <div className="text-sm text-gray-400">
                    Alert me when credits are running low (below 100)
                  </div>
                </div>
                <button
                  onClick={() => handleNotificationToggle('creditLow')}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    notifications.creditLow ? 'bg-brand-500' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                      notifications.creditLow ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </button>
              </label>

              <label className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer">
                <div>
                  <div className="font-semibold mb-1">Weekly Digest</div>
                  <div className="text-sm text-gray-400">
                    Send me a weekly summary of my activity
                  </div>
                </div>
                <button
                  onClick={() => handleNotificationToggle('weeklyDigest')}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    notifications.weeklyDigest ? 'bg-brand-500' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                      notifications.weeklyDigest ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </button>
              </label>

              <label className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer">
                <div>
                  <div className="font-semibold mb-1">Affiliate Earnings</div>
                  <div className="text-sm text-gray-400">
                    Notify me when I earn affiliate commissions
                  </div>
                </div>
                <button
                  onClick={() => handleNotificationToggle('affiliateEarnings')}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    notifications.affiliateEarnings ? 'bg-brand-500' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                      notifications.affiliateEarnings ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </button>
              </label>
            </div>
          </div>

          <div className="card bg-gradient-to-r from-brand-500/10 to-accent-purple/10 border-brand-500/20">
            <h3 className="text-xl font-bold mb-4">Account Information</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Total Credits</span>
                <span className="font-semibold">{stats?.credits.total.toLocaleString() || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Credits Used</span>
                <span className="font-semibold">{stats?.credits.used.toLocaleString() || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Credits Remaining</span>
                <span className="font-semibold text-brand-400">
                  {stats?.credits.remaining.toLocaleString() || 0}
                </span>
              </div>
              <div className="pt-3 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Books Created</span>
                  <span className="font-semibold">{stats?.usage.books_created || 0}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Pages Generated</span>
                <span className="font-semibold">{stats?.usage.pages_generated || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Exports</span>
                <span className="font-semibold">{stats?.usage.exports || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
