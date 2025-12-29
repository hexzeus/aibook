import { useEffect, useState } from 'react';
import { ArrowRight, Sparkles, Globe } from 'lucide-react';

interface TranslationProgressModalProps {
  isOpen: boolean;
  sourceLanguage: string;
  targetLanguage: string;
  sourceFlag: string;
  targetFlag: string;
  sourceLangName: string;
  targetLangName: string;
  mode: 'page' | 'book';
  pageNumber?: number;
}

const PROGRESS_MESSAGES = [
  'Analyzing linguistic patterns...',
  'Preserving literary tone...',
  'Adapting cultural nuances...',
  'Maintaining emotional depth...',
  'Crafting natural expressions...',
  'Polishing translation quality...',
  'Finalizing linguistic precision...',
];

export default function TranslationProgressModal({
  isOpen,
  sourceFlag,
  targetFlag,
  sourceLangName,
  targetLangName,
  mode,
  pageNumber,
}: TranslationProgressModalProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setCurrentMessageIndex(0);
      setProgress(0);
      return;
    }

    // Cycle through messages every 2 seconds
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % PROGRESS_MESSAGES.length);
    }, 2000);

    // Smooth progress animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 3;
      });
    }, 300);

    return () => {
      clearInterval(messageInterval);
      clearInterval(progressInterval);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[60] p-4">
      <div className="relative max-w-2xl w-full">
        {/* Animated Background Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-accent-cyan/20 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-accent-purple/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        </div>

        {/* Main Content */}
        <div className="relative bg-gradient-to-br from-surface-1 to-surface-2 rounded-3xl border border-white/10 overflow-hidden shadow-premium-lg">
          {/* Header Glow */}
          <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-accent-cyan/10 via-accent-purple/10 to-transparent pointer-events-none" />

          <div className="relative p-8 sm:p-12">
            {/* Title */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent-cyan/10 border border-accent-cyan/30 rounded-full mb-4">
                <Globe className="w-4 h-4 text-accent-cyan animate-spin-slow" />
                <span className="text-sm font-semibold text-accent-cyan">
                  {mode === 'page' ? `Translating Page ${pageNumber}` : 'Translating Book'}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-text-primary mb-2">
                AI Translation in Progress
              </h2>
              <p className="text-text-tertiary text-sm sm:text-base">
                Claude AI is carefully translating your content
              </p>
            </div>

            {/* Flag Animation */}
            <div className="flex items-center justify-center gap-6 sm:gap-8 mb-8">
              {/* Source Flag */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/30 to-accent-purple/30 rounded-2xl blur-xl animate-pulse-slow" />
                <div className="relative bg-surface-2 border border-white/20 rounded-2xl p-6 sm:p-8 hover:scale-105 transition-transform">
                  <div className="text-6xl sm:text-7xl mb-3 filter drop-shadow-glow">
                    {sourceFlag}
                  </div>
                  <div className="text-center text-sm font-semibold text-text-secondary">
                    {sourceLangName}
                  </div>
                </div>
              </div>

              {/* Arrow Animation */}
              <div className="relative flex flex-col items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-accent-cyan rounded-full animate-ping" />
                  <div className="w-2 h-2 bg-accent-purple rounded-full animate-ping" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-accent-emerald rounded-full animate-ping" style={{ animationDelay: '0.4s' }} />
                </div>
                <div className="relative">
                  <ArrowRight className="w-8 h-8 sm:w-10 sm:h-10 text-gradient-to-r from-accent-cyan to-accent-purple animate-pulse" />
                  <Sparkles className="absolute -top-2 -right-2 w-4 h-4 text-accent-amber animate-spin-slow" />
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-accent-emerald rounded-full animate-ping" style={{ animationDelay: '0.6s' }} />
                  <div className="w-2 h-2 bg-accent-purple rounded-full animate-ping" style={{ animationDelay: '0.8s' }} />
                  <div className="w-2 h-2 bg-accent-cyan rounded-full animate-ping" style={{ animationDelay: '1s' }} />
                </div>
              </div>

              {/* Target Flag */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-accent-emerald/30 to-accent-amber/30 rounded-2xl blur-xl animate-pulse-slow" style={{ animationDelay: '0.5s' }} />
                <div className="relative bg-surface-2 border border-white/20 rounded-2xl p-6 sm:p-8 hover:scale-105 transition-transform">
                  <div className="text-6xl sm:text-7xl mb-3 filter drop-shadow-glow">
                    {targetFlag}
                  </div>
                  <div className="text-center text-sm font-semibold text-text-secondary">
                    {targetLangName}
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Messages */}
            <div className="mb-6 min-h-[28px]">
              <div className="text-center">
                <p className="text-accent-cyan font-medium text-sm sm:text-base animate-fade-in">
                  {PROGRESS_MESSAGES[currentMessageIndex]}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative">
              <div className="h-3 bg-surface-3 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-accent-cyan via-accent-purple to-accent-emerald rounded-full transition-all duration-500 relative overflow-hidden"
                  style={{ width: `${progress}%` }}
                >
                  {/* Shimmer Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                </div>
              </div>
              <div className="mt-2 text-center">
                <span className="text-xs text-text-muted font-mono">
                  {Math.round(progress)}% Complete
                </span>
              </div>
            </div>

            {/* Fun Fact */}
            <div className="mt-8 p-4 bg-surface-2 border border-white/10 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-brand-500/10 rounded-lg flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-brand-400" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-brand-400 mb-1">Did you know?</div>
                  <div className="text-xs text-text-tertiary leading-relaxed">
                    Our AI preserves the emotional tone and literary quality of your content while adapting it naturally to the target language.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Particles */}
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-accent-cyan/50 rounded-full animate-float-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${10 + Math.random() * 5}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
