import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StickyNote, X, Loader2 } from 'lucide-react';
import { booksApi } from '../lib/api';
import { useToastStore } from '../store/toastStore';

interface PageNotesProps {
  bookId: string;
  pageId: string;
  pageNumber: number;
  initialNotes?: string;
}

export default function PageNotes({ bookId, pageId, pageNumber, initialNotes }: PageNotesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [note, setNote] = useState(initialNotes || '');
  const queryClient = useQueryClient();
  const toast = useToastStore();

  useEffect(() => {
    setNote(initialNotes || '');
  }, [initialNotes]);

  const updateNotesMutation = useMutation({
    mutationFn: (notes: string) => booksApi.updatePageNotes(bookId, pageId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      setIsOpen(false);
      toast.success('Notes saved successfully');
    },
    onError: () => {
      toast.error('Failed to save notes');
    },
  });

  const handleSave = () => {
    updateNotesMutation.mutate(note);
  };

  const handleClear = () => {
    setNote('');
    updateNotesMutation.mutate('');
  };

  const hasNote = (initialNotes && initialNotes.trim().length > 0) || false;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`p-2 rounded-lg transition-all border ${
          hasNote
            ? 'bg-yellow-500/10 border-yellow-500/30 hover:bg-yellow-500/20'
            : 'bg-white/5 border-white/10 hover:bg-white/10'
        }`}
        title={hasNote ? 'View note' : 'Add note'}
      >
        <StickyNote className={`w-4 h-4 ${hasNote ? 'text-yellow-400' : 'text-gray-400'}`} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-morphism rounded-2xl p-6 max-w-lg w-full border border-white/10 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <StickyNote className="w-6 h-6 text-yellow-400" />
                <h3 className="text-xl font-bold">Page {pageNumber} Notes</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-4">
              Add personal notes, reminders, or ideas for this page.
            </p>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Type your notes here..."
              className="input-field mb-4 min-h-48 resize-none"
              autoFocus
              disabled={updateNotesMutation.isPending}
            />

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={updateNotesMutation.isPending}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {updateNotesMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Note'
                )}
              </button>
              {hasNote && (
                <button
                  onClick={handleClear}
                  disabled={updateNotesMutation.isPending}
                  className="btn-secondary"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                disabled={updateNotesMutation.isPending}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
