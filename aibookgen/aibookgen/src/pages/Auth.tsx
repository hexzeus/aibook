import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Key, Sparkles, Zap } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../lib/api';

export default function Auth() {
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-purple/10 rounded-full blur-3xl animate-pulse-slow delay-1000" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-brand-500 to-accent-purple rounded-2xl mb-4 shadow-glow">
            <BookOpen className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-display font-bold mb-2 gradient-text">
            AI Book Generator
          </h1>
          <p className="text-gray-400 text-lg">
            Create professional ebooks with AI in minutes
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                License Key
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="Enter your license key"
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

          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-center text-sm text-gray-400 mb-4">
              Don't have a license key?
            </p>
            <a
              href="https://gumroad.com/aibook"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full block text-center"
            >
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" />
                Get License Key
              </span>
            </a>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="glass-morphism rounded-xl p-4">
            <div className="text-2xl font-bold text-brand-400 mb-1">2M+</div>
            <div className="text-xs text-gray-400">Books Created</div>
          </div>
          <div className="glass-morphism rounded-xl p-4">
            <div className="text-2xl font-bold text-accent-purple mb-1">50K+</div>
            <div className="text-xs text-gray-400">Active Users</div>
          </div>
          <div className="glass-morphism rounded-xl p-4">
            <div className="text-2xl font-bold text-accent-pink mb-1">4.9★</div>
            <div className="text-xs text-gray-400">User Rating</div>
          </div>
        </div>
      </div>
    </div>
  );
}
