import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Search, Filter, Trash2, Download, Eye, Clock, CheckCircle, Archive, ArchiveRestore, Copy } from 'lucide-react';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import { LibraryGridSkeleton } from '../components/Skeleton';
import { booksApi } from '../lib/api';
import { useConfirm } from '../hooks/useConfirm';
import { useToastStore } from '../store/toastStore';

export default function Library() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm();
  const toast = useToastStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in-progress' | 'completed' | 'archived'>('all');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: allBooks, isLoading: isLoadingAll } = useQuery({
    queryKey: ['books', 'all'],
    queryFn: () => booksApi.getBooks(200, 0),
    enabled: filterStatus === 'all',
  });

  const { data: inProgressData, isLoading: isLoadingInProgress } = useQuery({
    queryKey: ['books', 'in-progress'],
    queryFn: booksApi.getInProgressBooks,
    enabled: filterStatus === 'in-progress',
  });

  const { data: completedData, isLoading: isLoadingCompleted } = useQuery({
    queryKey: ['books', 'completed'],
    queryFn: booksApi.getCompletedBooks,
    enabled: filterStatus === 'completed',
  });

  const { data: archivedData, isLoading: isLoadingArchived } = useQuery({
    queryKey: ['books', 'archived'],
    queryFn: booksApi.getArchivedBooks,
    enabled: filterStatus === 'archived',
  });

  const deleteBookMutation = useMutation({
    mutationFn: booksApi.deleteBook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast.success('Book deleted permanently');
    },
  });

  const archiveBookMutation = useMutation({
    mutationFn: booksApi.archiveBook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast.success('Book archived successfully');
    },
  });

  const restoreBookMutation = useMutation({
    mutationFn: booksApi.restoreBook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast.success('Book restored successfully');
    },
  });

  const duplicateBookMutation = useMutation({
    mutationFn: booksApi.duplicateBook,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast.success('Book duplicated successfully');
      // Navigate to the new duplicate book in editor
      if (data.book_id) {
        navigate(`/editor/${data.book_id}`);
      }
    },
  });

  const exportBookMutation = useMutation({
    mutationFn: (bookId: string) => booksApi.exportBook(bookId, 'epub'),
    onSuccess: (blob, bookId) => {
      const book = filteredBooks?.find(b => b.book_id === bookId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${book?.title || 'book'}.epub`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      toast.success('Book exported successfully!');
    },
  });

  const isLoading =
    (filterStatus === 'all' && isLoadingAll) ||
    (filterStatus === 'in-progress' && isLoadingInProgress) ||
    (filterStatus === 'completed' && isLoadingCompleted) ||
    (filterStatus === 'archived' && isLoadingArchived);

  const books =
    filterStatus === 'in-progress' ? (inProgressData?.books || []) :
    filterStatus === 'completed' ? (completedData?.books || []) :
    filterStatus === 'archived' ? (archivedData?.books || []) :
    (allBooks?.books || []);

  const filteredBooks = books
    .filter((book) => {
      const matchesSearch = book.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        book.description.toLowerCase().includes(debouncedSearch.toLowerCase());
      return matchesSearch;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <Layout>
      <div className="page-container">
        {/* Premium Header */}
        <div className="mb-8 sm:mb-10">
          <h1 className="text-hero font-display font-bold gradient-text mb-3">
            My Library
          </h1>
          <p className="text-text-secondary text-base sm:text-lg">
            All your AI-generated books in one place
          </p>
        </div>

        {/* Premium Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8">
          <div className="flex-1 relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-brand-500/20 to-transparent rounded-xl blur-md opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-text-muted group-focus-within:text-brand-400 transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search books..."
              className="relative input-field pl-11 sm:pl-12 w-full"
            />
          </div>

          <div className="relative">
            <div className="flex items-center gap-2 bg-surface-1 border border-white/10 rounded-xl p-3 hover:border-brand-500/30 transition-all">
              <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-brand-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="bg-transparent text-text-primary text-sm sm:text-base font-medium cursor-pointer focus:outline-none pr-2"
              >
                <option value="all" className="bg-surface-1 text-text-primary">All Books</option>
                <option value="in-progress" className="bg-surface-1 text-text-primary">In Progress</option>
                <option value="completed" className="bg-surface-1 text-text-primary">Completed</option>
                <option value="archived" className="bg-surface-1 text-text-primary">Archived</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <LibraryGridSkeleton />
        ) : filteredBooks.length === 0 ? (
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative bg-surface-1 border border-white/10 rounded-2xl p-12 sm:p-16 text-center hover:border-brand-500/30 transition-all">
              <div className="w-20 h-20 mx-auto mb-6 bg-surface-2 rounded-2xl flex items-center justify-center">
                <BookOpen className="w-10 h-10 text-text-muted" />
              </div>
              <h3 className="text-xl sm:text-2xl font-display font-bold mb-3">No books found</h3>
              <p className="text-text-secondary max-w-md mx-auto">
                {searchQuery
                  ? 'Try adjusting your search filters'
                  : 'Create your first book to get started'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredBooks.map((book) => (
              <div
                key={book.book_id}
                className="group relative cursor-pointer"
                onClick={() => {
                  if (book.is_completed) {
                    navigate(`/book/${book.book_id}`);
                  } else {
                    navigate(`/editor/${book.book_id}`);
                  }
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative bg-surface-1 border border-white/10 rounded-2xl p-4 sm:p-5 hover:border-brand-500/40 transition-all duration-300">
                  {/* Book Cover */}
                  <div className="aspect-[3/4] mb-4 rounded-xl overflow-hidden bg-gradient-to-br from-brand-500/20 to-accent-purple/20 flex items-center justify-center relative group/cover">
                    {book.cover_svg ? (
                      <img
                        src={book.cover_svg}
                        alt={book.title}
                        className="w-full h-full object-cover group-hover/cover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <BookOpen className="w-12 h-12 sm:w-16 sm:h-16 text-text-muted/50 group-hover/cover:scale-110 transition-transform duration-300" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/cover:opacity-100 transition-opacity duration-300" />
                  </div>

                  {/* Book Info */}
                  <div className="mb-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-display font-semibold text-sm sm:text-base group-hover:text-brand-400 transition-colors line-clamp-2 flex-1">
                        {book.title}
                      </h3>
                      {book.is_completed ? (
                        <div className="flex-shrink-0 p-1 bg-accent-sage/10 rounded-lg">
                          <CheckCircle className="w-4 h-4 text-accent-sage" />
                        </div>
                      ) : (
                        <div className="flex-shrink-0 p-1 bg-brand-500/10 rounded-lg">
                          <Clock className="w-4 h-4 text-brand-400" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-text-tertiary line-clamp-2">{book.description}</p>
                  </div>

                  {/* Progress Section */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs sm:text-sm mb-2">
                      <span className="text-text-secondary">
                        {book.page_count || book.pages_generated || 0}/{book.target_pages} pages
                      </span>
                      {!book.is_completed && (
                        <span className="px-2 py-0.5 bg-brand-500/10 text-brand-400 font-semibold rounded-lg">
                          {book.completion_percentage}%
                        </span>
                      )}
                    </div>

                    {!book.is_completed && (
                      <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full transition-all duration-500 shadow-glow"
                          style={{ width: `${book.completion_percentage}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-white/10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (book.is_completed) {
                          navigate(`/book/${book.book_id}`);
                        } else {
                          navigate(`/editor/${book.book_id}`);
                        }
                      }}
                      className="flex-1 bg-surface-2 hover:bg-surface-3 text-text-primary font-semibold py-2 px-3 rounded-lg transition-all text-xs sm:text-sm flex items-center justify-center gap-2"
                    >
                      <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {book.is_completed ? 'View' : 'Continue'}
                    </button>

                    {book.is_completed && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          exportBookMutation.mutate(book.book_id);
                        }}
                        disabled={exportBookMutation.isPending}
                        className="p-2 hover:bg-brand-500/10 rounded-lg transition-all border border-brand-500/20 hover:border-brand-500/40"
                        title="Export EPUB"
                      >
                        <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-400" />
                      </button>
                    )}

                    {filterStatus !== 'archived' && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const confirmed = await confirm({
                            title: 'Duplicate Book',
                            message: `Create a copy of "${book.title}"? All pages will be duplicated.`,
                            confirmText: 'Duplicate',
                            cancelText: 'Cancel',
                          });
                          if (confirmed) {
                            duplicateBookMutation.mutate(book.book_id);
                          }
                        }}
                        disabled={duplicateBookMutation.isPending}
                        className="p-2 hover:bg-accent-cyan/10 rounded-lg transition-all border border-accent-cyan/20 hover:border-accent-cyan/40"
                        title="Duplicate Book"
                      >
                        <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent-cyan" />
                      </button>
                    )}

                    {filterStatus === 'archived' ? (
                      <>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const confirmed = await confirm({
                              title: 'Restore Book',
                              message: `Restore "${book.title}" to your library?`,
                              confirmText: 'Restore',
                              cancelText: 'Cancel',
                            });
                            if (confirmed) {
                              restoreBookMutation.mutate(book.book_id);
                            }
                          }}
                          className="p-2 hover:bg-brand-500/10 rounded-lg transition-all border border-brand-500/20 hover:border-brand-500/40"
                          title="Restore"
                        >
                          <ArchiveRestore className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-400" />
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const confirmed = await confirm({
                              title: 'Delete Permanently',
                              message: `Permanently delete "${book.title}"? This cannot be undone.`,
                              confirmText: 'Delete Forever',
                              cancelText: 'Cancel',
                              variant: 'danger',
                            });
                            if (confirmed) {
                              deleteBookMutation.mutate(book.book_id);
                            }
                          }}
                          className="p-2 hover:bg-red-500/10 rounded-lg transition-all border border-red-500/20 hover:border-red-500/40"
                          title="Delete Permanently"
                        >
                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const confirmed = await confirm({
                            title: 'Archive Book',
                            message: `Archive "${book.title}"? You can restore it later from the Archived section.`,
                            confirmText: 'Archive',
                            cancelText: 'Cancel',
                          });
                          if (confirmed) {
                            archiveBookMutation.mutate(book.book_id);
                          }
                        }}
                        className="p-2 hover:bg-accent-amber/10 rounded-lg transition-all border border-accent-amber/20 hover:border-accent-amber/40"
                        title="Archive"
                      >
                        <Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent-amber" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        variant={options.variant}
        isOpen={isOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </Layout>
  );
}
