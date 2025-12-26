import { Play, X } from 'lucide-react';

interface ResumeGenerationBannerProps {
  bookId: string;
  bookTitle: string;
  currentPages: number;
  targetPages: number;
  onResume: () => void;
  onDismiss: () => void;
}

export default function ResumeGenerationBanner({
  bookId,
  bookTitle,
  currentPages,
  targetPages,
  onResume,
  onDismiss,
}: ResumeGenerationBannerProps) {
  const pagesRemaining = targetPages - currentPages;
  const percentComplete = Math.round((currentPages / targetPages) * 100);

  return (
    <div className="mb-6 bg-gradient-to-r from-brand-500/20 to-accent-purple/20 border border-brand-500/30 rounded-2xl p-4 animate-slide-down">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Play className="w-5 h-5 text-brand-400" />
            <h3 className="font-semibold text-lg">Resume Generation</h3>
          </div>
          <p className="text-sm text-gray-300 mb-3">
            "<strong>{bookTitle}</strong>" is incomplete with {currentPages}/{targetPages} pages ({percentComplete}% done).
            You have {pagesRemaining} page{pagesRemaining !== 1 ? 's' : ''} remaining.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onResume}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Play className="w-4 h-4" />
              Continue Generating
            </button>
            <button
              onClick={onDismiss}
              className="btn-secondary text-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 hover:bg-white/10 rounded transition-all"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="mt-4 w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-accent-purple transition-all duration-500"
          style={{ width: `${percentComplete}%` }}
        />
      </div>
    </div>
  );
}
