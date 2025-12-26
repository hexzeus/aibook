import { useState, useEffect } from 'react';
import { X, Save, BookOpen } from 'lucide-react';
import type { Book } from '../lib/api';

interface EditBookModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { title?: string; subtitle?: string; description?: string }) => void;
  isSaving: boolean;
}

export default function EditBookModal({ book, isOpen, onClose, onSave, isSaving }: EditBookModalProps) {
  const [title, setTitle] = useState(book.title);
  const [subtitle, setSubtitle] = useState(book.subtitle || '');
  const [description, setDescription] = useState(book.description);

  useEffect(() => {
    if (isOpen) {
      setTitle(book.title);
      setSubtitle(book.subtitle || '');
      setDescription(book.description);
    }
  }, [isOpen, book]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title: title !== book.title ? title : undefined,
      subtitle: subtitle !== book.subtitle ? subtitle : undefined,
      description: description !== book.description ? description : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative card max-w-2xl w-full animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-brand-500 to-accent-purple p-2 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-display font-bold">Edit Book Details</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
              placeholder="Enter book title..."
              required
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Subtitle <span className="text-gray-500 text-xs">(Optional)</span>
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="input-field"
              placeholder="Enter book subtitle..."
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field min-h-32 resize-none"
              placeholder="Enter book description..."
              required
              maxLength={2000}
            />
            <div className="text-xs text-gray-400 mt-1">
              {description.length}/2000 characters
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button
              type="submit"
              disabled={isSaving || !title.trim() || !description.trim()}
              className="btn-primary flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
