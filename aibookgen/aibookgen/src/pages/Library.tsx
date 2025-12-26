import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Search, Filter, Trash2, Download, Eye, Clock, CheckCircle, Archive, ArchiveRestore } from 'lucide-react';
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

  const exportBookMutation = useMutation({
    mutationFn: booksApi.exportBook,
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
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold mb-2">My Library</h1>
          <p className="text-gray-400 text-lg">
            All your AI-generated books in one place
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search books..."
              className="input-field pl-12 w-full"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="input-field cursor-pointer bg-slate-900/90"
            >
              <option value="all" className="bg-slate-900 text-white">All Books</option>
              <option value="in-progress" className="bg-slate-900 text-white">In Progress</option>
              <option value="completed" className="bg-slate-900 text-white">Completed</option>
              <option value="archived" className="bg-slate-900 text-white">Archived</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <LibraryGridSkeleton />
        ) : filteredBooks.length === 0 ? (
          <div className="card text-center py-16">
            <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No books found</h3>
            <p className="text-gray-400">
              {searchQuery
                ? 'Try adjusting your search filters'
                : 'Create your first book to get started'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBooks.map((book) => (
              <div
                key={book.book_id}
                className="card group hover:shadow-glow hover:scale-[1.02] hover:-translate-y-1 cursor-pointer transition-all duration-300"
                onClick={() => {
                  if (book.is_completed) {
                    navigate(`/book/${book.book_id}`);
                  } else {
                    navigate(`/editor/${book.book_id}`);
                  }
                }}
              >
                <div className="aspect-[3/4] mb-4 rounded-lg overflow-hidden bg-gradient-to-br from-brand-500/20 to-accent-purple/20 flex items-center justify-center relative group/cover">
                  {book.cover_svg ? (
                    <img
                      src={book.cover_svg}
                      alt={book.title}
                      className="w-full h-full object-cover group-hover/cover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <BookOpen className="w-16 h-16 text-gray-600 group-hover/cover:scale-110 transition-transform duration-300" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover/cover:opacity-100 transition-opacity duration-300" />
                </div>

                <div className="mb-3">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold group-hover:text-brand-400 transition-colors line-clamp-2 flex-1">
                      {book.title}
                    </h3>
                    {book.is_completed ? (
                      <CheckCircle className="w-5 h-5 text-accent-green flex-shrink-0 ml-2" />
                    ) : (
                      <Clock className="w-5 h-5 text-brand-400 flex-shrink-0 ml-2" />
                    )}
                  </div>
                  <p className="text-sm text-gray-400 line-clamp-2">{book.description}</p>
                </div>

                <div className="flex items-center justify-between mb-4 text-sm">
                  <span className="text-gray-400">
                    {book.page_count || book.pages_generated || 0}/{book.target_pages} pages
                  </span>
                  {!book.is_completed && (
                    <span className="text-brand-400 font-semibold">
                      {book.completion_percentage}%
                    </span>
                  )}
                </div>

                {!book.is_completed && (
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-4 progress-bar">
                    <div
                      className="h-full bg-gradient-to-r from-brand-500 to-accent-purple transition-all duration-500"
                      style={{ width: `${book.completion_percentage}%` }}
                    />
                  </div>
                )}

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
                    className="flex-1 btn-secondary py-2 text-sm"
                  >
                    <Eye className="w-4 h-4 mr-2 inline" />
                    {book.is_completed ? 'View' : 'Continue'}
                  </button>

                  {book.is_completed && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        exportBookMutation.mutate(book.book_id);
                      }}
                      disabled={exportBookMutation.isPending}
                      className="p-2 hover:bg-brand-500/20 rounded-lg transition-all"
                      title="Export EPUB"
                    >
                      <Download className="w-4 h-4 text-brand-400" />
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
                        className="p-2 hover:bg-brand-500/20 rounded-lg transition-all"
                        title="Restore"
                      >
                        <ArchiveRestore className="w-4 h-4 text-brand-400" />
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
                        className="p-2 hover:bg-red-500/20 rounded-lg transition-all"
                        title="Delete Permanently"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
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
                      className="p-2 hover:bg-yellow-500/20 rounded-lg transition-all"
                      title="Archive"
                    >
                      <Archive className="w-4 h-4 text-yellow-400" />
                    </button>
                  )}
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
