import { useState } from 'react';
import { X, BookOpen, FileText, Sparkles, Globe } from 'lucide-react';

interface CreateBookModalProps {
  onClose: () => void;
  onSubmit: (data: { description: string; target_pages: number; book_type: string; target_language?: string }) => void;
  loading: boolean;
}

const bookTypes = [
  { id: 'fiction', label: 'Fiction', icon: '📖', description: 'Novels, short stories, creative writing' },
  { id: 'non-fiction', label: 'Non-Fiction', icon: '📚', description: 'Educational, how-to, informational' },
  { id: 'kids', label: 'Children\'s Book', icon: '🎨', description: 'Stories for young readers' },
  { id: 'educational', label: 'Educational', icon: '🎓', description: 'Textbooks, learning materials' },
];

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱' },
  { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
];

export default function CreateBookModal({ onClose, onSubmit, loading }: CreateBookModalProps) {
  const [description, setDescription] = useState('');
  const [targetPages, setTargetPages] = useState(25);
  const [bookType, setBookType] = useState('fiction');
  const [targetLanguage, setTargetLanguage] = useState('en');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      description,
      target_pages: targetPages,
      book_type: bookType,
      target_language: targetLanguage !== 'en' ? targetLanguage : undefined
    });
  };

  // Credit cost: 2 for structure/first page + 1 per additional page (illustrations optional later)
  const estimatedCredits = 2 + targetPages;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto overscroll-contain animate-fade-in">
      <div className="relative max-w-2xl w-full my-auto">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-accent-purple/20 rounded-2xl blur-2xl opacity-60" />
        <div className="relative bg-surface-1 border border-white/10 rounded-2xl p-5 sm:p-6 lg:p-8 animate-scale-in max-h-[90vh] overflow-y-auto overscroll-contain shadow-premium-lg">
          {/* Premium Header */}
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-brand-500 rounded-xl blur-md opacity-50" />
                <div className="relative p-2.5 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl">
                  <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-bold gradient-text">Create New Book</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-2 rounded-xl transition-all group"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6 text-text-tertiary group-hover:text-text-primary" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            {/* Premium Book Type Selection */}
            <div>
              <label className="block text-sm font-semibold mb-3 text-text-secondary">
                Book Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                {bookTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setBookType(type.id)}
                    className={`group relative p-4 rounded-xl border-2 transition-all text-left ${
                      bookType === type.id
                        ? 'border-brand-500/60 bg-brand-500/10'
                        : 'border-white/10 hover:border-brand-500/30 bg-surface-2'
                    }`}
                  >
                    {bookType === type.id && (
                      <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-transparent rounded-xl blur-md" />
                    )}
                    <div className="relative">
                      <div className="text-2xl mb-2">{type.icon}</div>
                      <div className={`font-semibold mb-1 ${bookType === type.id ? 'text-brand-400' : 'text-text-primary'}`}>
                        {type.label}
                      </div>
                      <div className="text-xs text-text-tertiary">{type.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Premium Description Field */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-text-secondary">
                What's your book about?
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your book idea in detail. Include themes, plot, characters, or main topics..."
                className="input-field min-h-32 resize-none"
                required
                minLength={10}
                maxLength={1000}
              />
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-text-muted">Be specific for better results</span>
                <span className={`font-medium ${description.length > 900 ? 'text-accent-amber' : 'text-text-tertiary'}`}>
                  {description.length}/1000
                </span>
              </div>
            </div>

            {/* Language Selection */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold mb-3 text-text-secondary">
                <Globe className="w-4 h-4 text-brand-400" />
                Language
              </label>
              <div className="relative">
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="input-field appearance-none cursor-pointer pr-10"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <Globe className="w-4 h-4 text-text-tertiary" />
                </div>
              </div>
              <div className="mt-2 text-xs text-text-muted">
                {targetLanguage === 'en' ? (
                  'Generate your book in English'
                ) : (
                  <>Generate your book directly in {LANGUAGES.find(l => l.code === targetLanguage)?.name}</>
                )}
              </div>
            </div>

            {/* Premium Range Slider */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-text-secondary">
                  Target Pages
                </label>
                <span className="px-3 py-1 bg-brand-500/10 border border-brand-500/20 rounded-lg text-brand-400 font-bold text-sm">
                  {targetPages}
                </span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={targetPages}
                  onChange={(e) => setTargetPages(Number(e.target.value))}
                  className="w-full h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-brand-500"
                  style={{
                    background: `linear-gradient(to right, rgb(245, 158, 11) 0%, rgb(245, 158, 11) ${((targetPages - 5) / 95) * 100}%, rgb(28, 28, 31) ${((targetPages - 5) / 95) * 100}%, rgb(28, 28, 31) 100%)`
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-text-muted mt-2">
                <span>5 pages</span>
                <span>100 pages</span>
              </div>
            </div>

            {/* Premium Cost Card */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-accent-purple/20 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative bg-gradient-to-br from-surface-2 to-surface-1 border border-brand-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-brand-500/10 rounded-lg">
                    <Sparkles className="w-5 h-5 text-brand-400 flex-shrink-0" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold mb-2 text-text-primary">Initial Setup Cost</div>
                    <div className="text-sm text-text-secondary space-y-1">
                      <div>• 1 credit for book structure (title, outline, themes)</div>
                      <div>• Then auto-generate all pages: 1 credit/page</div>
                      <div>• Add illustrations later: 3 credits each (optional)</div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                      <span className="font-semibold text-text-secondary">Total now:</span>
                      <span className="text-lg font-bold text-brand-400">1 credit</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Premium Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !description.trim() || description.length < 10}
                className="btn-primary flex-1"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Create Book
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
