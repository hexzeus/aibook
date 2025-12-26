import type { ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, CreditCard, Home, LogOut, Settings, TrendingUp, Users, Download } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useQuery } from '@tanstack/react-query';
import { creditsApi } from '../lib/api';
import Footer from './Footer';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthStore();
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
    <div className="min-h-screen flex flex-col">
      <nav className="glass-morphism border-b border-white/10 sticky top-0 z-50">
        <div className="page-container">
          <div className="flex items-center justify-between h-16">
            <Link to="/dashboard" className="flex items-center gap-3 group">
              <div className="bg-gradient-to-br from-brand-500 to-accent-purple p-2 rounded-xl group-hover:shadow-glow transition-all">
                <BookOpen className="w-6 h-6" />
              </div>
              <span className="font-display font-bold text-xl gradient-text">
                AI Book Gen
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      isActive
                        ? 'bg-brand-500/20 text-brand-400'
                        : 'hover:bg-white/5 text-gray-300 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 glass-morphism px-4 py-2 rounded-xl">
                <TrendingUp className="w-4 h-4 text-brand-400" />
                <span className="font-semibold text-brand-400">
                  {credits?.credits.remaining.toLocaleString() || 0}
                </span>
                <span className="text-gray-400 text-sm">credits</span>
              </div>
              <button
                onClick={handleLogout}
                className="glass-morphism hover:bg-red-500/10 p-2 rounded-lg transition-all group"
              >
                <LogOut className="w-5 h-5 text-gray-400 group-hover:text-red-400" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="md:hidden glass-morphism border-t border-white/10 fixed bottom-0 left-0 right-0 z-50">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all ${
                  isActive ? 'text-brand-400' : 'text-gray-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <main className="flex-1 pb-24 md:pb-8">{children}</main>

      <Footer />
    </div>
  );
}
