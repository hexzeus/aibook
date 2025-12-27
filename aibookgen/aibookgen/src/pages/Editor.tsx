import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Sparkles,
  Save,
  Download,
  ChevronLeft,
  ChevronRight,
  Check,
  Edit3,
  Loader2,
  Trash2,
  Copy,
  Image,
  Palette,
  Undo2,
  Redo2,
  BookOpen,
  AlertCircle,
} from 'lucide-react';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import EditBookModal from '../components/EditBookModal';
import PageNotes from '../components/PageNotes';
import BulkExportModal from '../components/BulkExportModal';
import AutoSaveIndicator, { SaveStatus } from '../components/AutoSaveIndicator';
import { booksApi, premiumApi } from '../lib/api';
import { useBookStore } from '../store/bookStore';
import { useConfirm } from '../hooks/useConfirm';
import { useToastStore } from '../store/toastStore';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { triggerConfetti } from '../utils/confetti';
import { countWords, formatWordCount, estimateReadingTime } from '../utils/textUtils';

export default function Editor() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { generatingPage, setGeneratingPage, completingBook, setCompletingBook } = useBookStore();
  const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm();
  const toast = useToastStore();

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const undoRedo = useUndoRedo('');
  const [userGuidance, setUserGuidance] = useState('');
  const [isEditBookModalOpen, setIsEditBookModalOpen] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'epub' | 'pdf' | 'docx'>('epub');
  const [showIllustrationModal, setShowIllustrationModal] = useState(false);
  const [illustrationPrompt, setIllustrationPrompt] = useState('');
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [stylePrompt, setStylePrompt] = useState("");
  const [showBulkExportModal, setShowBulkExportModal] = useState(false);
  const [showAutoGenerateModal, setShowAutoGenerateModal] = useState(false);
  const [autoGenWithIllustrations, setAutoGenWithIllustrations] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date>();

  const { data, isLoading } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => booksApi.getBook(bookId!),
    enabled: !!bookId,
  });

  const book = data?.book;
  const pages = book?.pages || [];
  const currentPage = pages[currentPageIndex];

  useEffect(() => {
    if (currentPage && !editMode) {
      undoRedo.reset(currentPage.content);
    }
  }, [currentPage, editMode]);

  // Auto-save functionality with debounce
  useEffect(() => {
    if (!editMode || !currentPage) return;

    // Don't auto-save if content hasn't changed
    if (undoRedo.value === currentPage.content) return;

    setSaveStatus('idle');

    const timer = setTimeout(() => {
      setSaveStatus('saving');
      updatePageMutation.mutate(
        {
          book_id: bookId!,
          page_number: currentPage.page_number,
          content: undoRedo.value,
        },
        {
          onSuccess: () => {
            setSaveStatus('saved');
            setLastSaved(new Date());
          },
          onError: () => {
            setSaveStatus('error');
          },
        }
      );
    }, 2000); // Auto-save after 2 seconds of no typing

    return () => clearTimeout(timer);
  }, [undoRedo.value, editMode, currentPage, bookId]);

  const generatePageMutation = useMutation({
    mutationFn: (data: { book_id: string; page_number: number; user_input?: string }) =>
      booksApi.generatePage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      setUserGuidance('');
      setGeneratingPage(false);
      setCurrentPageIndex(pages.length);
      toast.success('Page generated successfully!');
    },
    onError: () => {
      setGeneratingPage(false);
    },
  });

  const updatePageMutation = useMutation({
    mutationFn: (data: { book_id: string; page_number: number; content: string }) =>
      booksApi.updatePage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      setEditMode(false);
      toast.success('Page updated successfully!');
    },
  });

  const updateBookMutation = useMutation({
    mutationFn: (data: { title?: string; subtitle?: string; description?: string }) =>
      booksApi.updateBook(bookId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      setIsEditBookModalOpen(false);
      toast.success('Book details updated successfully!');
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: ({ pageId }: { pageId: string }) => booksApi.deletePage(bookId!, pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      // Adjust current page index if needed
      if (currentPageIndex >= pages.length - 1 && currentPageIndex > 0) {
        setCurrentPageIndex(currentPageIndex - 1);
      }
      toast.success('Page deleted successfully!');
    },
  });

  const duplicatePageMutation = useMutation({
    mutationFn: ({ pageId }: { pageId: string }) => booksApi.duplicatePage(bookId!, pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      // Move to the duplicated page (which is right after current)
      setCurrentPageIndex(currentPageIndex + 1);
      toast.success('Page duplicated successfully!');
    },
  });

  const generateIllustrationMutation = useMutation({
    mutationFn: ({ pageNumber, prompt }: { pageNumber: number; prompt: string }) =>
      premiumApi.generateIllustration(bookId!, pageNumber, prompt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      setShowIllustrationModal(false);
      setIllustrationPrompt('');
      toast.success('Illustration generated successfully! (3 credits used)');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to generate illustration');
    },
  });

  const deleteIllustrationMutation = useMutation({
    mutationFn: (pageNumber: number) =>
      premiumApi.deleteIllustration(bookId!, pageNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      toast.success('Illustration deleted successfully!');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to delete illustration');
    },
  });

  const applyStyleMutation = useMutation({
    mutationFn: ({ pageNumber, style }: { pageNumber: number; style: string }) =>
      premiumApi.applyStyle(bookId!, style, [pageNumber]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["book", bookId] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      setShowStyleModal(false);
      setStylePrompt("");
      toast.success("Writing style applied successfully! (2 credits used)");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || "Failed to apply style");
    },
  });

  const autoGenerateBookMutation = useMutation({
    mutationFn: ({ bookId, withIllustrations }: { bookId: string; withIllustrations: boolean }) =>
      booksApi.autoGenerateBook(bookId, withIllustrations),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      setAutoGenerating(false);
      setShowAutoGenerateModal(false);
      toast.success(
        `Auto-generated ${data.pages_generated} pages${
          data.illustrations_generated > 0 ? ` with ${data.illustrations_generated} illustrations` : ''
        } and completed book!`
      );
      // Trigger confetti celebration
      triggerConfetti(4000);
      // Navigate to book view to show the completed book
      setTimeout(() => {
        navigate(`/book/${bookId}`);
      }, 1500);
    },
    onError: (error: any) => {
      setAutoGenerating(false);
      toast.error(error?.response?.data?.detail || 'Auto-generation failed');
    },
  });

  const completeBookMutation = useMutation({
    mutationFn: (bookId: string) => booksApi.completeBook(bookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      setCompletingBook(false);
      toast.success('Book completed! Cover generated successfully.');
      // Trigger confetti celebration
      triggerConfetti(4000);
      // Navigate to book view to show the cover immediately
      setTimeout(() => {
        navigate(`/book/${bookId}`);
      }, 1500); // Short delay to let confetti start before navigation
    },
    onError: () => {
      setCompletingBook(false);
    },
  });

  const exportBookMutation = useMutation({
    mutationFn: (bookId: string) => booksApi.exportBook(bookId),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extensions = { epub: '.epub', pdf: '.pdf', docx: '.docx' };
      a.download = `${book?.title}${extensions[selectedFormat]}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      setShowExportOptions(false);
      toast.success(`Book exported as ${selectedFormat.toUpperCase()} successfully!`);
    },
  });

  const bulkExportMutation = useMutation({
    mutationFn: (formats: string[]) => premiumApi.bulkExport(bookId!, formats),
    onSuccess: (blob: Blob) => {
      // Create download link for ZIP file
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
      toast.error(error?.response?.data?.detail || 'Failed to export books');
    },
  });

  const deleteBookMutation = useMutation({
    mutationFn: booksApi.deleteBook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast.success('Book deleted successfully');
      navigate('/library');
    },
  });

  const handleDeleteBook = async () => {
    if (!book) return;
    const confirmed = await confirm({
      title: 'Delete Book',
      message: `Are you sure you want to delete "${book.title}"? This action cannot be undone and all pages will be permanently deleted.`,
      confirmText: 'Delete Book',
      cancelText: 'Keep Book',
      variant: 'danger',
    });

    if (confirmed) {
      deleteBookMutation.mutate(book.book_id);
    }
  };

  const handleDeletePage = async () => {
    if (!currentPage || !book) return;

    // Don't allow deleting the title page
    if (currentPage.is_title_page) {
      toast.error('Cannot delete the title page');
      return;
    }

    const confirmed = await confirm({
      title: 'Delete Page',
      message: `Are you sure you want to delete page ${currentPage.page_number}? This action cannot be undone.`,
      confirmText: 'Delete Page',
      cancelText: 'Keep Page',
      variant: 'danger',
    });

    if (confirmed) {
      deletePageMutation.mutate({ pageId: currentPage.page_id });
    }
  };

  const handleDuplicatePage = async () => {
    if (!currentPage || !book) return;

    // Don't allow duplicating the title page
    if (currentPage.is_title_page) {
      toast.error('Cannot duplicate the title page');
      return;
    }

    const confirmed = await confirm({
      title: 'Duplicate Page',
      message: `Duplicate page ${currentPage.page_number}? A copy will be inserted right after this page.`,
      confirmText: 'Duplicate',
      cancelText: 'Cancel',
      variant: 'info',
    });

    if (confirmed) {
      duplicatePageMutation.mutate({ pageId: currentPage.page_id });
    }
  };

  const handleGenerateNext = () => {
    if (!book) return;
    setGeneratingPage(true);
    generatePageMutation.mutate({
      book_id: book.book_id,
      page_number: pages.length + 1,
      user_input: userGuidance.trim() || undefined,
    });
  };

  const handleSaveEdit = () => {
    if (!book || !currentPage) return;
    updatePageMutation.mutate({
      book_id: book.book_id,
      page_number: currentPage.page_number,
      content: undoRedo.value,
    });
  };

  const handleCompleteBook = () => {
    if (!book) return;
    setCompletingBook(true);
    completeBookMutation.mutate(book.book_id);
  };

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

  const isComplete = book.is_completed || pages.length >= book.target_pages;
  const canGenerateNext = !isComplete && !generatingPage;

  return (
    <Layout>
      <div className="page-container max-w-6xl">
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-display font-bold">{book.title}</h1>
                <button
                  onClick={() => setIsEditBookModalOpen(true)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all"
                  title="Edit book details"
                >
                  <Edit3 className="w-5 h-5 text-gray-400 hover:text-white" />
                </button>
              </div>
              {book.subtitle && (
                <p className="text-gray-400 text-lg mb-2">{book.subtitle}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>{pages.length}/{book.target_pages} pages</span>
                <span>•</span>
                <span>{book.completion_percentage}% complete</span>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {isComplete && !book.is_completed && (
                <button
                  onClick={handleCompleteBook}
                  disabled={completingBook}
                  className="btn-primary flex items-center gap-2 text-sm sm:text-base"
                >
                  {completingBook ? (
                    <>
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                      <span className="hidden sm:inline">Generating Cover...</span>
                      <span className="sm:hidden">Cover...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline">Complete Book</span>
                      <span className="sm:hidden">Complete</span>
                    </>
                  )}
                </button>
              )}

              {book.is_completed && (
                <div className="relative">
                  <button
                    onClick={() => setShowExportOptions(!showExportOptions)}
                    disabled={exportBookMutation.isPending}
                    className="btn-primary flex items-center gap-2 text-sm sm:text-base"
                  >
                    {exportBookMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                        <span className="hidden sm:inline">Exporting...</span>
                        <span className="sm:hidden">Export...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="hidden sm:inline">Export Book</span>
                        <span className="sm:hidden">Export</span>
                      </>
                    )}
                  </button>

                  {showExportOptions && !exportBookMutation.isPending && (
                    <div className="absolute top-full right-0 mt-2 w-48 glass-morphism rounded-xl p-2 shadow-glow border border-white/10 z-10 animate-scale-in">
                      <div className="text-xs text-gray-400 px-3 py-2 font-semibold">Quick Export</div>
                      {[
                        { value: 'epub' as const, label: 'EPUB', desc: 'E-reader format' },
                        { value: 'pdf' as const, label: 'PDF', desc: 'Universal format' },
                        { value: 'docx' as const, label: 'DOCX', desc: 'Editable document' },
                      ].map((format) => (
                        <button
                          key={format.value}
                          onClick={() => {
                            setSelectedFormat(format.value);
                            exportBookMutation.mutate(book.book_id);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center justify-between ${
                            selectedFormat === format.value
                              ? 'bg-brand-500/20 text-brand-400'
                              : 'hover:bg-white/5 text-gray-300'
                          }`}
                        >
                          <div>
                            <div className="font-medium">{format.label}</div>
                            <div className="text-xs text-gray-500">{format.desc}</div>
                          </div>
                          {selectedFormat === format.value && (
                            <Check className="w-4 h-4 text-brand-400" />
                          )}
                        </button>
                      ))}
                      <div className="border-t border-white/10 my-2"></div>
                      <button
                        onClick={() => {
                          setShowExportOptions(false);
                          setShowBulkExportModal(true);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg transition-all hover:bg-gradient-to-r hover:from-brand-500/20 hover:to-accent-purple/20 text-gray-300"
                      >
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-brand-400" />
                          <div>
                            <div className="font-medium text-brand-400">Bulk Export</div>
                            <div className="text-xs text-gray-500">Multiple formats</div>
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleDeleteBook}
                disabled={deleteBookMutation.isPending}
                className="p-2 sm:p-3 hover:bg-red-500/20 rounded-lg transition-all border border-red-500/20"
                title="Delete Book"
              >
                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
              </button>
            </div>
          </div>

          <div className="mt-4 w-full h-2 bg-white/5 rounded-full overflow-hidden progress-bar">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-accent-purple transition-all duration-500 progress-bar-glow"
              style={{ width: `${book.completion_percentage}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
            {currentPage && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                      disabled={currentPageIndex === 0}
                      className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-30 transition-all"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="font-semibold">
                      Page {currentPage.page_number} of {pages.length}
                    </span>
                    <button
                      onClick={() => setCurrentPageIndex(Math.min(pages.length - 1, currentPageIndex + 1))}
                      disabled={currentPageIndex === pages.length - 1}
                      className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-30 transition-all"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (editMode) {
                          undoRedo.reset(currentPage.content);
                        }
                        setEditMode(!editMode);
                      }}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <Edit3 className="w-4 h-4" />
                      {editMode ? 'Cancel' : 'Edit'}
                    </button>
                    <PageNotes
                      bookId={book.book_id}
                      pageId={currentPage.page_id}
                      pageNumber={currentPage.page_number}
                    />
                    {!currentPage.is_title_page && (
                      <>
                        <button
                          onClick={handleDuplicatePage}
                          disabled={duplicatePageMutation.isPending}
                          className="p-2 hover:bg-brand-500/20 rounded-lg transition-all border border-brand-500/20"
                          title="Duplicate Page"
                        >
                          <Copy className="w-4 h-4 text-brand-400" />
                        </button>
                        <button
                          onClick={handleDeletePage}
                          disabled={deletePageMutation.isPending}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-all border border-red-500/20"
                          title="Delete Page"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-brand-400 font-semibold">
                    {currentPage.section}
                  </span>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{formatWordCount(countWords(currentPage.content))}</span>
                    <span>•</span>
                    <span>{estimateReadingTime(countWords(currentPage.content))}</span>
                  </div>
                </div>

                {editMode ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <AutoSaveIndicator status={saveStatus} lastSaved={lastSaved} />
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={undoRedo.undo}
                            disabled={!undoRedo.canUndo}
                            className="p-1.5 hover:bg-white/10 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Undo (Ctrl+Z)"
                          >
                            <Undo2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={undoRedo.redo}
                            disabled={!undoRedo.canRedo}
                            className="p-1.5 hover:bg-white/10 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Redo (Ctrl+Y)"
                          >
                            <Redo2 className="w-4 h-4" />
                          </button>
                        </div>
                        <span className="text-xs text-gray-400">
                          {countWords(undoRedo.value)} words
                        </span>
                      </div>
                    </div>
                    <textarea
                      value={undoRedo.value}
                      onChange={(e) => undoRedo.set(e.target.value)}
                      onKeyDown={(e) => {
                        // Handle Ctrl+Z (undo) and Ctrl+Y (redo)
                        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                          e.preventDefault();
                          undoRedo.undo();
                        } else if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
                          e.preventDefault();
                          undoRedo.redo();
                        }
                      }}
                      className="input-field min-h-96 font-serif text-base leading-relaxed resize-none"
                    />
                    <button
                      onClick={handleSaveEdit}
                      disabled={updatePageMutation.isPending}
                      className="btn-primary flex items-center gap-2"
                    >
                      {updatePageMutation.isPending ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-5 h-5" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="prose prose-invert prose-lg max-w-none">
                    {currentPage.illustration_url && (
                      <div className="mb-6">
                        <div className="rounded-lg overflow-hidden border border-white/10 mb-2">
                          <img
                            src={currentPage.illustration_url}
                            alt={`Illustration for page ${currentPage.page_number}`}
                            className="w-full h-auto"
                          />
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setShowIllustrationModal(true)}
                            className="btn-secondary flex items-center gap-2 text-xs px-3 py-1.5"
                            title="Generate new illustration (replaces current)"
                          >
                            <Sparkles className="w-3 h-3" />
                            Regenerate
                            <span className="text-xs text-brand-400">(3 credits)</span>
                          </button>
                          <button
                            onClick={async () => {
                              if (await confirm({
                                title: 'Delete Illustration?',
                                message: 'Are you sure you want to delete this illustration? You can generate a new one afterwards.',
                                confirmText: 'Delete',
                                variant: 'danger'
                              })) {
                                deleteIllustrationMutation.mutate(currentPage.page_number);
                              }
                            }}
                            disabled={deleteIllustrationMutation.isPending}
                            className="flex items-center gap-2 text-xs px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition-colors"
                            title="Delete illustration"
                          >
                            {deleteIllustrationMutation.isPending ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap font-serif text-base leading-relaxed">
                      {currentPage.content}
                    </div>
                  </div>
                )}

                {!editMode && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <button
                      onClick={() => setShowIllustrationModal(true)}
                      className="btn-secondary flex items-center gap-2 text-sm"
                    >
                      <Image className="w-4 h-4" />
                      Generate Illustration
                      <span className="text-xs text-brand-400">(3 credits)</span>
                    <button
                      onClick={() => setShowStyleModal(true)}
                      className="btn-secondary flex items-center gap-2 text-sm"
                    >
                      <Palette className="w-4 h-4" />
                      Apply Style
                      <span className="text-xs text-brand-400">(2 credits)</span>
                    </button>
                    </button>
                  </div>
                )}
              </div>
            )}

            {canGenerateNext && (
              <div className="card bg-gradient-to-r from-brand-500/10 to-accent-purple/10 border-brand-500/20">
                <div className="flex items-start gap-4">
                  <Sparkles className="w-6 h-6 text-brand-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">Generate Next Page</h3>
                    <textarea
                      value={userGuidance}
                      onChange={(e) => setUserGuidance(e.target.value)}
                      placeholder="Optional: Guide the AI with specific instructions for the next page..."
                      className="input-field mb-4 min-h-24 resize-none"
                    />
                    <button
                      onClick={handleGenerateNext}
                      disabled={generatingPage}
                      className="btn-primary"
                    >
                      {generatingPage ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          Generating Page {pages.length + 1}...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 mr-2" />
                          Generate Page {pages.length + 1}
                        </>
                      )}
                    </button>

                    {/* Auto-Generate Book Button */}
                    <button
                      onClick={() => setShowAutoGenerateModal(true)}
                      className="btn-secondary mt-3 w-full text-sm"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Auto-Generate Entire Book
                    </button>
                  </div>
                </div>
              </div>
            )}

            {generatingPage && (
              <div className="card bg-brand-500/5 border-brand-500/20">
                <div className="flex items-center gap-3 mb-4">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
                  <div className="flex-1">
                    <div className="font-semibold mb-1">AI is writing page {pages.length + 1}...</div>
                    <div className="text-sm text-gray-400">Analyzing context and generating content</div>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-brand-500 via-accent-purple to-brand-500 animate-loading-bar" />
                </div>
                <div className="mt-3 text-xs text-gray-500 text-center">
                  This typically takes 20-40 seconds • 1 credit will be consumed
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6 order-1 lg:order-2">
            <div className="card">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-brand-400" />
                Table of Contents
              </h3>
              <div className="space-y-1 max-h-96 overflow-y-auto scrollbar-hide">
                {(() => {
                  // Group pages by section with page ranges
                  const sections: { title: string; startPage: number; endPage: number; pageCount: number; isVirtual?: boolean }[] = [];
                  const sectionMap = new Map<string, { pages: number[]; startIdx: number }>();

                  // Add virtual title page and copyright page (always in EPUB export)
                  sections.push({
                    title: book?.title || 'Title Page',
                    startPage: 0,
                    endPage: 0,
                    pageCount: 1,
                    isVirtual: true
                  });
                  sections.push({
                    title: 'Copyright Page',
                    startPage: 0,
                    endPage: 0,
                    pageCount: 1,
                    isVirtual: true
                  });

                  pages.forEach((page, idx) => {
                    if (page.section) {
                      if (!sectionMap.has(page.section)) {
                        sectionMap.set(page.section, { pages: [], startIdx: idx });
                      }
                      sectionMap.get(page.section)!.pages.push(page.page_number);
                    }
                  });

                  // Convert to sorted array
                  sectionMap.forEach((data, title) => {
                    const sortedPages = data.pages.sort((a, b) => a - b);
                    sections.push({
                      title,
                      startPage: sortedPages[0],
                      endPage: sortedPages[sortedPages.length - 1],
                      pageCount: sortedPages.length,
                    });
                  });

                  // Sort by start page (virtual pages first with startPage 0)
                  sections.sort((a, b) => {
                    if (a.isVirtual && !b.isVirtual) return -1;
                    if (!a.isVirtual && b.isVirtual) return 1;
                    return a.startPage - b.startPage;
                  });

                  return sections.map((section, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === sections.length - 1;

                    return (
                      <div
                        key={section.title}
                        className="group relative"
                      >
                        {/* Tree line */}
                        <div className="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-brand-500/30 to-brand-500/10" />

                        {/* Clickable section */}
                        <div
                          className={`relative pl-8 pr-3 py-2.5 rounded-lg transition-all flex items-center gap-3 ${
                            section.isVirtual
                              ? 'opacity-60 cursor-default'
                              : 'hover:bg-white/5 cursor-pointer'
                          }`}
                          onClick={() => {
                            if (section.isVirtual) return; // Can't navigate to virtual pages
                            const sectionPages = pages.filter(p => p.section === section.title);
                            if (sectionPages.length > 0) {
                              const index = pages.indexOf(sectionPages[0]);
                              setCurrentPageIndex(index);
                            }
                          }}
                        >
                          {/* Tree branch */}
                          <div className="absolute left-3 top-1/2 w-4 h-px bg-brand-500/30" />

                          {/* Icon */}
                          <div className="flex-shrink-0">
                            {section.title.toLowerCase().includes('title') || section.title.toLowerCase().includes('cover') ? (
                              <span className="text-base">📄</span>
                            ) : section.title.toLowerCase().includes('copyright') ? (
                              <span className="text-base">©️</span>
                            ) : section.title.toLowerCase().includes('table of contents') || section.title.toLowerCase().includes('toc') ? (
                              <span className="text-base">📑</span>
                            ) : section.title.toLowerCase().includes('introduction') || section.title.toLowerCase().includes('preface') ? (
                              <span className="text-base">📖</span>
                            ) : section.title.toLowerCase().includes('conclusion') || section.title.toLowerCase().includes('epilogue') ? (
                              <span className="text-base">🏁</span>
                            ) : section.title.toLowerCase().includes('appendix') ? (
                              <span className="text-base">📋</span>
                            ) : (
                              <span className="text-base">📘</span>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-white truncate group-hover:text-brand-400 transition-colors">
                              {section.title}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                              {section.isVirtual ? (
                                <span className="italic">Included in export</span>
                              ) : section.pageCount === 1 ? (
                                <span>Page {section.startPage}</span>
                              ) : (
                                <span>Pages {section.startPage}-{section.endPage}</span>
                              )}
                              <span>•</span>
                              <span className="text-brand-400">{section.pageCount} {section.pageCount === 1 ? 'page' : 'pages'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
                {pages.length === 0 && (
                  <div className="text-sm text-gray-500 text-center py-8">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                    <p>No pages yet</p>
                    <p className="text-xs mt-1">Generate pages to see your book's structure</p>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <h3 className="font-semibold mb-4">Pages</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-hide">
                {pages.map((page, idx) => (
                  <button
                    key={page.page_id}
                    onClick={() => setCurrentPageIndex(idx)}
                    className={`w-full p-3 rounded-lg text-left transition-all ${
                      currentPageIndex === idx
                        ? 'bg-brand-500/20 border-2 border-brand-500'
                        : 'bg-white/5 hover:bg-white/10 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">Page {page.page_number}</span>
                      {page.is_title_page && (
                        <span className="text-xs bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded">
                          Title
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 truncate">{page.section}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
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

      <EditBookModal
        book={book}
        isOpen={isEditBookModalOpen}
        onClose={() => setIsEditBookModalOpen(false)}
        onSave={(data) => updateBookMutation.mutate(data)}
        isSaving={updateBookMutation.isPending}
      />

      {showIllustrationModal && currentPage && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-morphism rounded-2xl p-6 max-w-md w-full border border-white/10 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <Image className="w-6 h-6 text-brand-400" />
              <h3 className="text-xl font-bold">Generate Illustration</h3>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Create an AI-generated illustration for page {currentPage.page_number}. This feature costs 3 credits.
            </p>
            <textarea
              value={illustrationPrompt}
              onChange={(e) => setIllustrationPrompt(e.target.value)}
              placeholder="Describe the illustration you want to generate... (e.g., 'A mystical forest at sunset with glowing fireflies')"
              className="input-field mb-4 min-h-32 resize-none"
              autoFocus
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (illustrationPrompt.trim()) {
                    generateIllustrationMutation.mutate({
                      pageNumber: currentPage.page_number,
                      prompt: illustrationPrompt,
                    });
                  } else {
                    toast.error('Please enter an illustration description');
                  }
                }}
                disabled={generateIllustrationMutation.isPending || !illustrationPrompt.trim()}
                className="btn-primary flex items-center gap-2 flex-1"
              >
                {generateIllustrationMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate (3 credits)
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowIllustrationModal(false);
                  setIllustrationPrompt('');
                }}
                disabled={generateIllustrationMutation.isPending}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showStyleModal && currentPage && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-morphism rounded-2xl p-6 max-w-md w-full border border-white/10 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <Palette className="w-6 h-6 text-purple-400" />
              <h3 className="text-xl font-bold">Apply Writing Style</h3>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Transform page {currentPage.page_number} with a custom writing style. This feature costs 2 credits.
            </p>
            <textarea
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              placeholder="Describe the writing style... (e.g., 'Write in the style of Ernest Hemingway - short, direct sentences')" 
              className="input-field mb-4 min-h-32 resize-none"
              autoFocus
              disabled={applyStyleMutation.isPending}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (stylePrompt.trim()) {
                    applyStyleMutation.mutate({
                      pageNumber: currentPage.page_number,
                      style: stylePrompt,
                    });
                  } else {
                    toast.error('Please enter a style description');
                  }
                }}
                disabled={applyStyleMutation.isPending || !stylePrompt.trim()}
                className="btn-primary flex items-center gap-2 flex-1"
              >
                {applyStyleMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Apply Style (2 credits)
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowStyleModal(false);
                  setStylePrompt('');
                }}
                disabled={applyStyleMutation.isPending}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <BulkExportModal
        isOpen={showBulkExportModal}
        onClose={() => setShowBulkExportModal(false)}
        onExport={(formats) => bulkExportMutation.mutate(formats)}
        isExporting={bulkExportMutation.isPending}
        bookTitle={book?.title || ''}
      />

      {/* Auto-Generate Book Modal */}
      {showAutoGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-white/10 rounded-lg max-w-lg w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Auto-Generate Entire Book</h2>

            <div className="space-y-4 mb-6">
              <p className="text-gray-300">
                Automatically generate all remaining pages and optionally illustrations, then complete the book with a cover.
              </p>

              {book && (
                <div className="card bg-white/5">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Remaining pages:</span>
                      <span className="text-white font-semibold">{book.target_pages - pages.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Page credits:</span>
                      <span className="text-white">{book.target_pages - pages.length} credits</span>
                    </div>
                    {autoGenWithIllustrations && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Illustration credits:</span>
                        <span className="text-white">{(book.target_pages - pages.length) * 3} credits</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-400">Cover generation:</span>
                      <span className="text-white">2 credits</span>
                    </div>
                    <div className="border-t border-white/10 pt-2 mt-2">
                      <div className="flex justify-between font-semibold">
                        <span className="text-brand-400">Total credits:</span>
                        <span className="text-brand-400">
                          {book.target_pages - pages.length +
                           (autoGenWithIllustrations ? (book.target_pages - pages.length) * 3 : 0) +
                           2} credits
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={autoGenWithIllustrations}
                  onChange={(e) => setAutoGenWithIllustrations(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-white/20 bg-white/5 text-brand-500 focus:ring-2 focus:ring-brand-500"
                />
                <div className="flex-1">
                  <div className="font-medium group-hover:text-brand-400 transition-colors">
                    Generate illustrations for each page
                  </div>
                  <div className="text-sm text-gray-400">
                    +3 credits per page • AI will create visual scenes matching page content
                  </div>
                </div>
              </label>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-200">
                    <strong>Note:</strong> This will take several minutes to complete. You can close this page and come back later - the generation will continue in the background.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAutoGenerateModal(false);
                  setAutoGenWithIllustrations(false);
                }}
                disabled={autoGenerating}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setAutoGenerating(true);
                  autoGenerateBookMutation.mutate({
                    bookId: bookId!,
                    withIllustrations: autoGenWithIllustrations,
                  });
                }}
                disabled={autoGenerating}
                className="btn-primary flex-1"
              >
                {autoGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Start Auto-Generation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
