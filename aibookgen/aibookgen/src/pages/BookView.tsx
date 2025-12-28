import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, Edit, GripVertical, Loader2, BookOpen, Share2, Rocket } from 'lucide-react';
import Layout from '../components/Layout';
import PageReorderModal from '../components/PageReorderModal';
import ShareBookModal from '../components/ShareBookModal';
import ConfirmModal from '../components/ConfirmModal';
import BookStats from '../components/BookStats';
import QuickActionsMenu, { createBookActions } from '../components/QuickActionsMenu';
import ExportDropdown from '../components/ExportDropdown';
import BulkExportModal from '../components/BulkExportModal';
import ReadinessCard from '../components/ReadinessCard';
import ValidationResults from '../components/ValidationResults';
import { booksApi, premiumApi } from '../lib/api';
import { useToastStore } from '../store/toastStore';
import { useConfirm } from '../hooks/useConfirm';
import { countWords, estimateReadingTime } from '../utils/textUtils';
import { printBook, downloadBookHTML } from '../utils/print';

export default function BookView() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToastStore();
  const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm();
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showBulkExportModal, setShowBulkExportModal] = useState(false);
  const [showValidationResults, setShowValidationResults] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'epub' | 'pdf' | 'docx'>('epub');

  const { data, isLoading } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => booksApi.getBook(bookId!),
    enabled: !!bookId,
  });

  const exportBookMutation = useMutation({
    mutationFn: (format: 'epub' | 'pdf' | 'docx') => booksApi.exportBook(bookId!, format),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension = selectedFormat === 'docx' ? 'rtf' : selectedFormat;
      a.download = `${book?.title.replace(/\s+/g, '_')}.${extension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      toast.success(`Book exported as ${selectedFormat.toUpperCase()} successfully!`);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Export failed');
    },
  });

  const bulkExportMutation = useMutation({
    mutationFn: (formats: string[]) => premiumApi.bulkExport(bookId!, formats),
    onSuccess: (blob: Blob) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${book?.title.replace(/\s+/g, '_')}_bulk_export.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      queryClient.invalidateQueries({ queryKey: ['credits'] });
      setShowBulkExportModal(false);
      toast.success('Bulk export completed! Check your downloads folder.');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Bulk export failed');
    },
  });

  const reorderPagesMutation = useMutation({
    mutationFn: (pageOrder: string[]) => booksApi.reorderPages(bookId!, pageOrder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      setShowReorderModal(false);
      toast.success('Pages reordered successfully!');
    },
    onError: () => {
      toast.error('Failed to reorder pages');
    },
  });

  const book = data?.book;
  const pages = book?.pages || [];

  const deleteBookMutation = useMutation({
    mutationFn: booksApi.deleteBook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast.success('Book deleted successfully');
      navigate('/library');
    },
  });

  const archiveBookMutation = useMutation({
    mutationFn: booksApi.archiveBook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast.success('Book archived successfully');
      navigate('/library');
    },
  });

  const regenerateCoverMutation = useMutation({
    mutationFn: (bookId: string) => booksApi.regenerateCover(bookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      toast.success('Cover regenerated successfully! (2 credits used)');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to regenerate cover');
    },
  });

  const duplicateBookMutation = useMutation({
    mutationFn: booksApi.duplicateBook,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast.success('Book duplicated successfully!');
      navigate(`/book/${data.book.book_id}`);
    },
  });

  const handleDeleteBook = async () => {
    if (!book) return;
    const confirmed = await confirm({
      title: 'Delete Book',
      message: `Are you sure you want to delete "${book.title}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (confirmed) {
      deleteBookMutation.mutate(book.book_id);
    }
  };

  const handleArchiveBook = async () => {
    if (!book) return;
    const confirmed = await confirm({
      title: 'Archive Book',
      message: `Archive "${book.title}"? You can restore it later from the Library.`,
      confirmText: 'Archive',
      cancelText: 'Cancel',
      variant: 'info',
    });
    if (confirmed) {
      archiveBookMutation.mutate(book.book_id);
    }
  };

  const quickActions = book
    ? [
        createBookActions.print(() => printBook(book.title, book.subtitle, pages)),
        createBookActions.downloadHTML(() => downloadBookHTML(book.title, book.subtitle, pages)),
        createBookActions.duplicate(() => duplicateBookMutation.mutate(book.book_id)),
        createBookActions.archive(handleArchiveBook),
        createBookActions.delete(handleDeleteBook),
      ]
    : [];

  if (isLoading) {
    return (
      <Layout>
        <div className="page-container flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
        </div>
      </Layout>
    );
  }

  if (!book) {
    return (
      <Layout>
        <div className="page-container">
          <div className="card text-center py-12">
            <p className="text-gray-400">Book not found</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-container max-w-6xl">
        {/* Premium Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/library')}
            className="group flex items-center gap-2 text-text-tertiary hover:text-brand-400 transition-all mb-6"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Library</span>
          </button>

          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* Premium Book Cover */}
            {book.cover_svg && (
              <div className="w-full lg:w-72 flex-shrink-0">
                <div className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-500/30 to-accent-purple/30 rounded-2xl blur-2xl opacity-50 group-hover:opacity-75 transition-opacity duration-500" />
                  <img
                    src={book.cover_svg}
                    alt={book.title}
                    className="relative w-full rounded-2xl shadow-premium-lg border border-white/10 mb-4 group-hover:scale-[1.02] transition-transform duration-300"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (await confirm({
                      title: 'Regenerate Cover?',
                      message: 'This will create a new AI-generated cover design and costs 2 credits.',
                      confirmText: 'Regenerate',
                      variant: 'info'
                    })) {
                      regenerateCoverMutation.mutate(book.book_id);
                    }
                  }}
                  disabled={regenerateCoverMutation.isPending}
                  className="w-full btn-secondary flex items-center justify-center gap-2 text-sm"
                >
                  {regenerateCoverMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <Edit className="w-4 h-4" />
                      Regenerate Cover
                      <span className="text-xs text-brand-400">(2)</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Premium Book Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <h1 className="text-h1 font-display font-bold gradient-text mb-3">{book.title}</h1>
                  {book.subtitle && (
                    <p className="text-lg sm:text-xl text-text-secondary mb-4">{book.subtitle}</p>
                  )}
                </div>
                <QuickActionsMenu actions={quickActions} />
              </div>

              <p className="text-text-secondary mb-6 leading-relaxed">{book.description}</p>

              {/* Premium Metadata */}
              <div className="flex items-center gap-2 sm:gap-3 mb-8 text-xs sm:text-sm flex-wrap">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/10 border border-brand-500/20 rounded-lg">
                  <BookOpen className="w-3.5 h-3.5 text-brand-400" />
                  <span className="text-brand-400 font-semibold">{pages.length} sections</span>
                </div>
                {book.epub_page_count && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 border border-white/10 rounded-lg">
                    <span className="text-text-secondary">~{book.epub_page_count} EPUB pages</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 border border-white/10 rounded-lg">
                  <span className="text-text-secondary">{pages.reduce((sum, page) => sum + countWords(page.content), 0).toLocaleString()} words</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-sage/10 border border-accent-sage/20 rounded-lg">
                  <span className="text-accent-sage font-semibold">Completed</span>
                </div>
              </div>

              {/* Premium Action Buttons */}
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <button
                  onClick={() => setShowValidationResults(true)}
                  className="btn-primary flex items-center gap-2 text-sm sm:text-base"
                >
                  <Rocket className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Publish</span>
                  <span className="sm:hidden">Publish</span>
                </button>
                <ExportDropdown
                  bookId={book.book_id}
                  bookTitle={book.title}
                  isExporting={exportBookMutation.isPending}
                  onExport={(format) => {
                    setSelectedFormat(format);
                    exportBookMutation.mutate(format);
                  }}
                  onBulkExport={() => setShowBulkExportModal(true)}
                />
                <button
                  onClick={() => navigate(`/editor/${book.book_id}`)}
                  className="btn-secondary flex items-center gap-2 text-sm sm:text-base"
                >
                  <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Edit</span>
                  <span className="sm:hidden">Edit</span>
                </button>
                <button
                  onClick={() => setShowReorderModal(true)}
                  disabled={pages.length < 2}
                  className="btn-secondary flex items-center gap-2 text-sm sm:text-base disabled:opacity-30"
                  title={pages.length < 2 ? 'Need at least 2 pages to reorder' : 'Reorder pages'}
                >
                  <GripVertical className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Reorder</span>
                </button>
                <button
                  onClick={() => setShowShareModal(true)}
                  className="btn-secondary flex items-center gap-2 text-sm sm:text-base"
                  title="Share this book"
                >
                  <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Share</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Premium Stats & Readiness Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-8">
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative">
              <BookStats
                totalWords={pages.reduce((sum, page) => sum + countWords(page.content), 0)}
                readingTime={estimateReadingTime(pages.reduce((sum, page) => sum + countWords(page.content), 0))}
                pageCount={pages.length}
                completionDate={book.completed_at}
              />
            </div>
          </div>
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-purple/10 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative">
              <ReadinessCard bookId={book.book_id} bookTitle={book.title} bookData={book} />
            </div>
          </div>
        </div>

        {/* Premium Preview Section */}
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative bg-surface-1 border border-white/10 rounded-2xl p-5 sm:p-6 lg:p-8 hover:border-brand-500/30 transition-all">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-brand-500/10 rounded-xl">
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-brand-400" />
              </div>
              <h2 className="text-h2 font-display font-bold">Preview</h2>
            </div>

            <div className="space-y-6 sm:space-y-8 max-h-[600px] overflow-y-auto pr-2 sm:pr-4 scrollbar-hide">
              {pages.map((page) => (
                <div key={page.page_id} className="group/page pb-6 sm:pb-8 border-b border-white/5 last:border-0">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-500/10 border border-brand-500/20 rounded-lg">
                      <span className="text-xs sm:text-sm text-brand-400 font-semibold">
                        Page {page.page_number}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm text-text-tertiary px-3 py-1.5 bg-surface-2 rounded-lg">
                      {page.section}
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap font-serif text-sm sm:text-base leading-relaxed text-text-secondary group-hover/page:text-text-primary transition-colors">
                    {page.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showReorderModal && (
        <PageReorderModal
          isOpen={showReorderModal}
          pages={pages}
          onClose={() => setShowReorderModal(false)}
          onReorder={(pageOrder) => reorderPagesMutation.mutate(pageOrder)}
          isSaving={reorderPagesMutation.isPending}
        />
      )}

      <ShareBookModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        bookTitle={book?.title || ''}
        bookId={bookId || ''}
      />

      <BulkExportModal
        isOpen={showBulkExportModal}
        onClose={() => setShowBulkExportModal(false)}
        onExport={(formats) => bulkExportMutation.mutate(formats)}
        isExporting={bulkExportMutation.isPending}
        bookTitle={book?.title || ''}
      />

      {showValidationResults && (
        <ValidationResults
          bookId={bookId!}
          bookTitle={book?.title}
          bookData={book}
          onClose={() => setShowValidationResults(false)}
        />
      )}

      {isOpen && (
        <ConfirmModal
          isOpen={isOpen}
          title={options.title}
          message={options.message}
          confirmText={options.confirmText}
          cancelText={options.cancelText}
          variant={options.variant}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </Layout>
  );
}
