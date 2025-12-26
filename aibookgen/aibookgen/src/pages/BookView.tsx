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
      <div className="page-container max-w-5xl">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/library')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Library
            </button>
            <QuickActionsMenu actions={quickActions} />
          </div>

          <div className="flex flex-col md:flex-row gap-8">
            {book.cover_svg && (
              <div className="w-full md:w-64 flex-shrink-0">
                <img
                  src={book.cover_svg}
                  alt={book.title}
                  className="w-full rounded-2xl shadow-2xl mb-3"
                />
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
                      Regenerate Cover (2 credits)
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="flex-1">
              <h1 className="text-4xl font-display font-bold mb-2">{book.title}</h1>
              {book.subtitle && (
                <p className="text-xl text-gray-400 mb-4">{book.subtitle}</p>
              )}
              <p className="text-gray-400 mb-6">{book.description}</p>

              <div className="flex items-center gap-4 mb-6 text-sm text-gray-400">
                <span>{pages.length} {pages.length === 1 ? 'section' : 'sections'}</span>
                <span>•</span>
                {book.epub_page_count && (
                  <>
                    <span>~{book.epub_page_count} EPUB pages</span>
                    <span>•</span>
                  </>
                )}
                <span>{pages.reduce((sum, page) => sum + countWords(page.content), 0).toLocaleString()} words</span>
                <span>•</span>
                <span>{book.book_type}</span>
                <span>•</span>
                <span>Completed</span>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setShowValidationResults(true)}
                  className="btn-primary flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  <Rocket className="w-5 h-5" />
                  Publish
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
                  className="btn-secondary flex items-center gap-2"
                >
                  <Edit className="w-5 h-5" />
                  Edit
                </button>
                <button
                  onClick={() => setShowReorderModal(true)}
                  disabled={pages.length < 2}
                  className="btn-secondary flex items-center gap-2"
                  title={pages.length < 2 ? 'Need at least 2 pages to reorder' : 'Reorder pages'}
                >
                  <GripVertical className="w-5 h-5" />
                  Reorder
                </button>
                <button
                  onClick={() => setShowShareModal(true)}
                  className="btn-secondary flex items-center gap-2"
                  title="Share this book"
                >
                  <Share2 className="w-5 h-5" />
                  Share
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <BookStats
              totalWords={pages.reduce((sum, page) => sum + countWords(page.content), 0)}
              readingTime={estimateReadingTime(pages.reduce((sum, page) => sum + countWords(page.content), 0))}
              pageCount={pages.length}
              completionDate={book.completed_at}
            />
          </div>
          <ReadinessCard bookId={book.book_id} bookTitle={book.title} bookData={book} />
        </div>

        <div className="card">
          <h2 className="text-2xl font-display font-bold mb-6 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-brand-400" />
            Preview
          </h2>

          <div className="space-y-8 max-h-[600px] overflow-y-auto pr-4 scrollbar-hide">
            {pages.map((page) => (
              <div key={page.page_id} className="pb-8 border-b border-white/10 last:border-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-brand-400 font-semibold">
                    Page {page.page_number}
                  </div>
                  <div className="text-sm text-gray-500">{page.section}</div>
                </div>
                <div className="prose prose-invert prose-lg max-w-none">
                  <div className="whitespace-pre-wrap font-serif text-base leading-relaxed">
                    {page.content}
                  </div>
                </div>
              </div>
            ))}
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
