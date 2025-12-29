import type { ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, CreditCard, Home, LogOut, Settings, TrendingUp, Users, Download, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useRateLimitStore } from '../store/rateLimitStore';
import { useQuery } from '@tanstack/react-query';
import { creditsApi } from '../lib/api';
import Footer from './Footer';
import RateLimitBanner from './RateLimitBanner';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthStore();
  const { isRateLimited, resetTime, clearRateLimit } = useRateLimitStore();
  const { data: credits } = useQuery({
    queryKey: ['credits'],
    queryFn: creditsApi.getCredits,
    refetchInterval: 30000,
  });

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const navItems = [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: BookOpen, label: 'Library', path: '/library' },
    { icon: Download, label: 'Exports', path: '/exports' },
    { icon: CreditCard, label: 'Credits', path: '/credits' },
    { icon: Users, label: 'Affiliate', path: '/affiliate' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-surface-0">
      {/* Premium Navigation */}
      <nav className="bg-surface-1/95 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="page-container">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl blur-md opacity-50 group-hover:opacity-75 transition-opacity" />
                <div className="relative bg-gradient-to-br from-brand-500 to-brand-600 p-2.5 rounded-xl group-hover:scale-105 transition-transform">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="hidden sm:block">
                <span className="font-display font-bold text-xl gradient-text">
                  Inkwell AI
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                      isActive
                        ? 'bg-brand-500/10 text-brand-400 shadow-inner-glow'
                        : 'hover:bg-surface-2 text-text-tertiary hover:text-text-primary'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
              {/* Credits Display */}
              <div className="hidden sm:flex items-center gap-2 bg-surface-2 border border-brand-500/20 px-4 py-2 rounded-xl hover:border-brand-500/40 transition-all">
                <div className="p-1 bg-brand-500/10 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-brand-400" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-brand-400 text-sm leading-none">
                    {credits?.credits.remaining.toLocaleString() || 0}
                  </span>
                  <span className="text-text-muted text-xs leading-none mt-0.5">credits</span>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="bg-surface-2 hover:bg-red-500/10 p-2.5 rounded-xl transition-all group border border-white/5 hover:border-red-500/30"
                title="Logout"
              >
                <LogOut className="w-4 h-4 text-text-tertiary group-hover:text-red-400 transition-colors" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden bg-surface-1/98 backdrop-blur-xl border-t border-white/5 fixed bottom-0 left-0 right-0 z-50 safe-area-inset-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[64px] ${
                  isActive
                    ? 'text-brand-400 bg-brand-500/10'
                    : 'text-text-tertiary active:bg-surface-2'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 pb-20 md:pb-8">
        {isRateLimited && resetTime && (
          <div className="page-container pt-4">
            <RateLimitBanner resetTime={resetTime} onDismiss={clearRateLimit} />
          </div>
        )}
        <div className="animate-fade-in">
          {children}
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
