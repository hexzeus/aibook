import { useState, useEffect } from 'react';
import { X, Sparkles, CheckCircle } from 'lucide-react';

interface Update {
  version: string;
  date: string;
  features: string[];
}

const updates: Update[] = [
  {
    version: '1.3.0',
    date: '2025-12-28',
    features: [
      'Translate entire books into 15 languages (5 credits)',
      'Single page translation (1 credit)',
      'High-quality AI translations with Claude Sonnet 4',
      'Automatic illustration and cover copying in translations',
      'Premium redesign with Pinterest-style book grids',
      'Distraction-free editor with polished modals',
      'Enhanced mobile experience and iOS PWA support',
    ],
  },
  {
    version: '1.2.0',
    date: '2025-12-26',
    features: [
      'Page notes and annotations with database persistence',
      'Apply Writing Style premium feature (2 credits)',
      'Generate AI illustrations for pages (3 credits)',
      'Page duplication with intelligent ordering',
      'Page reordering with up/down controls',
      'Offline detection with auto-reconnect',
      'Request retry logic with exponential backoff',
    ],
  },
  {
    version: '1.1.0',
    date: '2025-12-25',
    features: [
      'Export history tracking with download counts',
      'Book archiving and restoration',
      'Book duplication feature',
      'Notification preferences (5 categories)',
      'Social sharing buttons for affiliate links',
      'Interactive onboarding flow for new users',
      'Keyboard shortcuts (Ctrl+N, Ctrl+K, etc.)',
    ],
  },
  {
    version: '1.0.0',
    date: '2025-12-20',
    features: [
      'AI-powered book generation (Claude & GPT-4)',
      'Multi-format export (EPUB, PDF, DOCX)',
      'Credit system with package purchases',
      'Affiliate program with 30% commission',
      'Subscription plans (Starter, Pro, Premium)',
      'Real-time page editing and generation',
      'Professional book covers with AI',
    ],
  },
];

export default function WhatsNewModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if user has seen the latest update
    const lastSeenVersion = localStorage.getItem('lastSeenVersion');
    const latestVersion = updates[0].version;

    if (lastSeenVersion !== latestVersion) {
      // Show modal after 2 seconds
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('lastSeenVersion', updates[0].version);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-morphism rounded-2xl p-6 max-w-2xl w-full border border-white/10 animate-scale-in max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-brand-400" />
            <div>
              <h2 className="text-2xl font-bold">What's New</h2>
              <p className="text-sm text-gray-400">Recent updates and improvements</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {updates.map((update, index) => (
            <div
              key={update.version}
              className={`pb-6 ${index !== updates.length - 1 ? 'border-b border-white/10' : ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-brand-400">
                  Version {update.version}
                </h3>
                <span className="text-sm text-gray-400">{update.date}</span>
              </div>
              <ul className="space-y-2">
                {update.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleClose}
            className="btn-primary flex-1"
          >
            Got it!
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('lastSeenVersion');
              setIsOpen(false);
            }}
            className="btn-secondary text-sm"
          >
            Show again
          </button>
        </div>
      </div>
    </div>
  );
}
