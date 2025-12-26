import { BookOpen } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-dark via-dark-lighter to-dark">
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <div className="relative">
          {/* Animated rings */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-brand-500 to-accent-purple opacity-20 blur-xl animate-pulse" />
          <div className="absolute -inset-4 rounded-full border-2 border-brand-500/30 animate-spin-slow" />
          <div className="absolute -inset-8 rounded-full border-2 border-accent-purple/20 animate-spin-slower" />

          {/* Logo */}
          <div className="relative bg-gradient-to-br from-brand-500 to-accent-purple p-6 rounded-2xl shadow-glow">
            <BookOpen className="w-12 h-12 text-white animate-pulse" />
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-display font-bold mb-2 gradient-text">
            AI Book Generator
          </h1>
          <p className="text-gray-400 animate-pulse">Loading your creative workspace...</p>
        </div>

        {/* Loading bar */}
        <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-brand-500 to-accent-purple animate-loading-bar" />
        </div>
      </div>
    </div>
  );
}
