import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Key, Sparkles, Zap, Check, Crown, Building2, Rocket, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../lib/api';

// All tiers include the same features - only credit amount differs
const allFeatures = [
  'AI book generation with Claude & GPT-4',
  'Export to EPUB, PDF & DOCX',
  'Translate books to 16 languages',
  'AI illustration generation',
  'Professional writing style presets',
  'Character builder & management',
  'Publishing wizard for marketplaces',
  '30% affiliate commission program'
];

const pricingTiers = [
  {
    name: 'Starter',
    price: '$49',
    credits: '1,000',
    icon: Sparkles,
    color: 'brand',
    features: allFeatures,
    url: 'https://blazestudiox.gumroad.com/l/aibook-starter-1k',
    popular: false
  },
  {
    name: 'Pro',
    price: '$129',
    credits: '3,000',
    icon: Crown,
    color: 'accent-purple',
    features: allFeatures,
    url: 'https://blazestudiox.gumroad.com/l/aibook-pro-3k',
    popular: true
  },
  {
    name: 'Business',
    price: '$279',
    credits: '7,000',
    icon: Building2,
    color: 'accent-cyan',
    features: allFeatures,
    url: 'https://blazestudiox.gumroad.com/l/aibook-business-7k',
    popular: false
  },
  {
    name: 'Enterprise',
    price: '$599',
    credits: '17,000',
    icon: Rocket,
    color: 'accent-emerald',
    features: allFeatures,
    url: 'https://blazestudiox.gumroad.com/l/aibook-enterprise-17k',
    popular: false
  }
];

export default function Auth() {
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPricing, setShowPricing] = useState(false);
  const navigate = useNavigate();
  const { setLicenseKey: storeLicenseKey } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authApi.validateLicense(licenseKey.trim());
      storeLicenseKey(licenseKey.trim());
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid license key');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-purple/10 rounded-full blur-3xl animate-pulse-slow delay-1000" />
      </div>

      <div className="w-full max-w-7xl relative py-8">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-brand-500 to-brand-600 rounded-2xl mb-4 shadow-glow">
            <BookOpen className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold mb-3 gradient-text">
            Chaptera
          </h1>
          <p className="text-text-secondary text-lg sm:text-xl max-w-2xl mx-auto">
            Transform ideas into published books with the power of AI
          </p>
        </div>

        {/* License Key Input - TOP PRIORITY */}
        <div className="max-w-md mx-auto mb-8">
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative bg-surface-1 border border-brand-500/30 rounded-2xl p-6">
              <h3 className="text-center text-lg font-semibold text-text-primary mb-4">
                Enter Your License Key
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
                    <input
                      type="text"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value)}
                      placeholder="Paste your license key here"
                      className="input-field pl-12"
                      required
                    />
                  </div>
                  {error && (
                    <p className="mt-2 text-sm text-red-400">{error}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !licenseKey.trim()}
                  className="btn-primary w-full"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Validating...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Zap className="w-5 h-5" />
                      Access Dashboard
                    </span>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Toggle Pricing Button */}
        <div className="text-center mb-8">
          <button
            onClick={() => setShowPricing(!showPricing)}
            className="group inline-flex items-center gap-2 text-text-secondary hover:text-brand-400 transition-all"
          >
            <span className="text-sm font-medium">
              {showPricing ? 'Hide' : "Don't have a license?"} View Pricing Plans
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showPricing ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Pricing Grid - Collapsible */}
        {showPricing && (
          <div className="animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12">
              {pricingTiers.map((tier) => {
                const Icon = tier.icon;
                return (
                  <div key={tier.name} className="group relative">
                    {tier.popular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                        <span className="px-3 py-1 bg-gradient-to-r from-brand-500 to-brand-600 text-white text-xs font-bold rounded-full shadow-glow">
                          MOST POPULAR
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-accent-purple/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className={`relative h-full bg-surface-1 border ${tier.popular ? 'border-brand-500/50' : 'border-white/10'} rounded-2xl p-6 hover:border-brand-500/40 transition-all`}>
                      {/* Icon & Title */}
                      <div className="mb-6">
                        <div className="w-12 h-12 bg-brand-500/10 rounded-xl flex items-center justify-center mb-4">
                          <Icon className="w-6 h-6 text-brand-400" />
                        </div>
                        <h3 className="text-xl font-display font-bold text-text-primary mb-2">{tier.name}</h3>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-display font-bold text-brand-400">{tier.price}</span>
                          <span className="text-text-muted text-sm">one-time</span>
                        </div>
                      </div>

                      {/* Credits Badge */}
                      <div className="mb-6 px-3 py-2 bg-brand-500/10 border border-brand-500/20 rounded-lg text-center">
                        <div className="text-sm text-text-tertiary">Includes</div>
                        <div className="text-lg font-bold text-brand-400">{tier.credits} credits</div>
                      </div>

                      {/* Features */}
                      <ul className="space-y-3 mb-6">
                        {tier.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-accent-sage flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-text-secondary">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      {/* CTA Button */}
                      <a
                        href={tier.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block w-full text-center ${tier.popular ? 'btn-primary' : 'btn-secondary'}`}
                      >
                        Get Started
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mt-12 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-transparent rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative bg-surface-1 border border-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-display font-bold text-brand-400 mb-1">2M+</div>
              <div className="text-xs text-text-muted">Books Created</div>
            </div>
          </div>
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-purple/10 to-transparent rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative bg-surface-1 border border-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-display font-bold text-accent-purple mb-1">50K+</div>
              <div className="text-xs text-text-muted">Active Users</div>
            </div>
          </div>
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-emerald/10 to-transparent rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative bg-surface-1 border border-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-display font-bold text-accent-emerald mb-1">4.9★</div>
              <div className="text-xs text-text-muted">User Rating</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
