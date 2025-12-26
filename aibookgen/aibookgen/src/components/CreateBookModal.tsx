import { useState } from 'react';
import { X, BookOpen, FileText, Sparkles } from 'lucide-react';

interface CreateBookModalProps {
  onClose: () => void;
  onSubmit: (data: { description: string; target_pages: number; book_type: string }) => void;
  loading: boolean;
}

const bookTypes = [
  { id: 'fiction', label: 'Fiction', icon: '📖', description: 'Novels, short stories, creative writing' },
  { id: 'non-fiction', label: 'Non-Fiction', icon: '📚', description: 'Educational, how-to, informational' },
  { id: 'kids', label: 'Children\'s Book', icon: '🎨', description: 'Stories for young readers' },
  { id: 'educational', label: 'Educational', icon: '🎓', description: 'Textbooks, learning materials' },
];

export default function CreateBookModal({ onClose, onSubmit, loading }: CreateBookModalProps) {
  const [description, setDescription] = useState('');
  const [targetPages, setTargetPages] = useState(25);
  const [bookType, setBookType] = useState('fiction');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ description, target_pages: targetPages, book_type: bookType });
  };

  const estimatedCredits = 2 + targetPages;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto overscroll-contain">
      <div className="glass-morphism rounded-2xl max-w-2xl w-full p-4 sm:p-6 md:p-8 animate-slide-up my-auto max-h-[90vh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-500/20 rounded-xl">
              <BookOpen className="w-6 h-6 text-brand-400" />
            </div>
            <h2 className="text-2xl font-display font-bold">Create New Book</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-3 text-gray-300">
              Book Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {bookTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setBookType(type.id)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    bookType === type.id
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-white/10 hover:border-white/20 bg-white/5'
                  }`}
                >
                  <div className="text-2xl mb-2">{type.icon}</div>
                  <div className="font-semibold mb-1">{type.label}</div>
                  <div className="text-xs text-gray-400">{type.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
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
            <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
              <span>Be specific for better results</span>
              <span>{description.length}/1000</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Target Pages: {targetPages}
            </label>
            <input
              type="range"
              min="5"
              max="100"
              value={targetPages}
              onChange={(e) => setTargetPages(Number(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>5 pages</span>
              <span>100 pages</span>
            </div>
          </div>

          <div className="glass-morphism rounded-xl p-4 bg-brand-500/5">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold mb-1">Credit Cost Estimate</div>
                <div className="text-sm text-gray-400">
                  • 2 credits for book structure + first page<br />
                  • 1 credit per additional page ({targetPages - 1} pages)<br />
                  • 2 credits for AI cover generation
                </div>
                <div className="mt-3 pt-3 border-t border-white/10 font-semibold text-brand-400">
                  Total: ~{estimatedCredits + 2} credits
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
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
                  <FileText className="w-5 h-5" />
                  Create Book
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
