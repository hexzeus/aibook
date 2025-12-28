import { useQuery } from '@tanstack/react-query';
import { CreditCard, Zap, TrendingUp, ShoppingCart, Check, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import Layout from '../components/Layout';
import { creditsApi } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuthStore } from '../store/authStore';

export default function Credits() {
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [creditsAdded, setCreditsAdded] = useState(0);
  const { licenseKey } = useAuthStore();

  const { data: stats, refetch } = useQuery({
    queryKey: ['credits'],
    queryFn: creditsApi.getCredits,
  });

  const { data: packagesData } = useQuery({
    queryKey: ['credit-packages'],
    queryFn: creditsApi.getPackages,
  });

  const packages = packagesData?.packages || [];

  // WebSocket connection for real-time credit notifications
  const { isConnected } = useWebSocket({
    license_key: licenseKey || '',
    onMessage: (message) => {
      console.log('[Credits] WebSocket message:', message);

      // Handle credits_added notification
      if (message.type === 'credits_added') {
        setCreditsAdded(message.credits_added);
        setShowSuccessToast(true);

        // Refetch credit stats to update UI
        refetch();

        // Hide toast after 5 seconds
        setTimeout(() => setShowSuccessToast(false), 5000);
      }
    },
    onConnect: () => {
      console.log('[Credits] WebSocket connected');
    },
    onDisconnect: () => {
      console.log('[Credits] WebSocket disconnected');
    }
  });

  return (
    <Layout>
      <div className="page-container">
        {/* Success Toast Notification */}
        {showSuccessToast && (
          <div className="fixed top-4 right-4 z-50 animate-fade-in">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-accent-green/30 to-brand-500/30 rounded-2xl blur-xl" />
              <div className="relative bg-surface-1 border-2 border-accent-green/50 rounded-2xl p-4 shadow-premium-lg min-w-[300px]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent-green/20 rounded-xl">
                    <CheckCircle2 className="w-6 h-6 text-accent-green" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-text-primary mb-1">Credits Added!</div>
                    <div className="text-sm text-text-secondary">
                      +{creditsAdded.toLocaleString()} credits successfully added to your account
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSuccessToast(false)}
                    className="text-text-tertiary hover:text-text-primary transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold mb-2">Credits</h1>
          <p className="text-gray-400 text-lg">
            Manage your credits and purchase more
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="card group hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-brand-500/20 rounded-xl">
                <TrendingUp className="w-6 h-6 text-brand-400" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">
              {stats?.credits.remaining.toLocaleString() || 0}
            </div>
            <div className="text-sm text-gray-400">Credits Remaining</div>
          </div>

          <div className="card group hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-accent-purple/20 rounded-xl">
                <CreditCard className="w-6 h-6 text-accent-purple" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">
              {stats?.credits.total.toLocaleString() || 0}
            </div>
            <div className="text-sm text-gray-400">Total Credits</div>
          </div>

          <div className="card group hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-accent-pink/20 rounded-xl">
                <Zap className="w-6 h-6 text-accent-pink" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">
              {stats?.credits.used.toLocaleString() || 0}
            </div>
            <div className="text-sm text-gray-400">Credits Used</div>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-display font-bold mb-6">Purchase Credits</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`card relative ${
                  pkg.is_featured
                    ? 'border-2 border-brand-500 shadow-glow'
                    : ''
                }`}
              >
                {pkg.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-accent-orange to-accent-pink text-white text-xs font-bold px-4 py-1 rounded-full">
                    {pkg.badge}
                  </div>
                )}

                <div className="text-center mb-6">
                  <div className="text-3xl font-bold mb-2">
                    {pkg.credits.toLocaleString()}
                  </div>
                  <div className="text-gray-400 text-sm">Credits</div>
                </div>

                <div className="text-center mb-6">
                  <div className="text-4xl font-bold gradient-text mb-1">
                    {pkg.price}
                  </div>
                  {pkg.savings_percent > 0 && (
                    <div className="text-sm text-accent-green">
                      Save {pkg.savings_percent}%
                    </div>
                  )}
                </div>

                <a
                  href={pkg.purchase_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`btn-primary w-full text-center ${
                    pkg.is_featured ? 'shadow-glow-lg' : ''
                  }`}
                >
                  <ShoppingCart className="w-5 h-5 mr-2 inline" />
                  Purchase
                </a>
              </div>
            ))}
          </div>
        </div>

        <div className="card bg-gradient-to-r from-brand-500/10 to-accent-purple/10 border-brand-500/20">
          <h3 className="text-xl font-bold mb-4">Credit Usage Guide</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Create New Book</div>
                <div className="text-sm text-gray-400">2 credits (structure + first page)</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Generate Page</div>
                <div className="text-sm text-gray-400">1 credit per page</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Complete Book & Generate Cover</div>
                <div className="text-sm text-gray-400">2 credits (AI-generated cover)</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Export to EPUB</div>
                <div className="text-sm text-gray-400">1 credit (professional format)</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-accent-green flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Edit Pages</div>
                <div className="text-sm text-gray-400">Free - unlimited edits</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
