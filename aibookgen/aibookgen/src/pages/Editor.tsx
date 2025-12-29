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
  Users,
  BarChart3,
} from 'lucide-react';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import EditBookModal from '../components/EditBookModal';
import PageNotes from '../components/PageNotes';
import BulkExportModal from '../components/BulkExportModal';
import AutoSaveIndicator, { SaveStatus } from '../components/AutoSaveIndicator';
import StyleConfigModal, { StyleProfile } from '../components/StyleConfigModal';
import ChapterOutlineEditor, { BookStructure } from '../components/ChapterOutlineEditor';
import CharacterBuilder from '../components/CharacterBuilder';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import { booksApi, premiumApi } from '../lib/api';
import { useBookStore } from '../store/bookStore';
import { useConfirm } from '../hooks/useConfirm';
import { useToastStore } from '../store/toastStore';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { triggerConfetti } from '../utils/confetti';
import { countWords, formatWordCount, estimateReadingTime } from '../utils/textUtils';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuthStore } from '../store/authStore';

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
  const [showStyleConfigModal, setShowStyleConfigModal] = useState(false);
  const [applyingStyle, setApplyingStyle] = useState(false);
  const [showOutlineEditor, setShowOutlineEditor] = useState(false);
  const [savingStructure, setSavingStructure] = useState(false);
  const [showCharacterBuilder, setShowCharacterBuilder] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Auto-generation progress tracking
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressData, setProgressData] = useState<{
    status: string;
    current_page: number;
    total_pages: number;
    message: string;
    percentage: number;
    with_illustrations: boolean;
    error?: string;
  } | null>(null);

  const { licenseKey } = useAuthStore();

  // WebSocket connection for real-time progress updates
  useWebSocket({
    license_key: licenseKey || '',
    onMessage: (message) => {
      console.log('[Editor] WebSocket message:', message);

      // Handle auto-generation progress notifications
      if (message.type === 'auto_gen_progress' && message.book_id === bookId) {
        // Show progress modal for any status (including in-progress from another device)
        setProgressData({
          status: message.status,
          current_page: message.current_page,
          total_pages: message.total_pages,
          message: message.message,
          percentage: message.percentage,
          with_illustrations: message.with_illustrations,
          error: message.error
        });
        setShowProgressModal(true);

        // Close modal on completion or error after a delay
        if (message.status === 'completed') {
          setTimeout(() => {
            setShowProgressModal(false);
            setProgressData(null);
            queryClient.invalidateQueries({ queryKey: ['book', bookId] });
            triggerConfetti();
          }, 3000);
        } else if (message.status === 'error') {
          setTimeout(() => {
            setShowProgressModal(false);
            setProgressData(null);
          }, 5000);
        }
      }
    },
    onConnect: () => {
      console.log('[Editor] WebSocket connected - listening for auto-generation progress');
      // WebSocket is now connected and will automatically receive any active auto-generation progress
      // for this book if it's being generated on another device
    }
  });

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
    mutationFn: ({ bookId, withIllustrations }: { bookId: string; withIllustrations: boolean }) => {
      // Close auto-generate modal and show progress modal immediately
      setShowAutoGenerateModal(false);
      setShowProgressModal(true);
      setProgressData({
        status: 'started',
        current_page: 0,
        total_pages: book?.target_pages || 0,
        message: 'Initializing auto-generation...',
        percentage: 0,
        with_illustrations: withIllustrations
      });
      return booksApi.autoGenerateBook(bookId, withIllustrations);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      setAutoGenerating(false);
      // Progress modal will be closed by WebSocket completion event
      // Navigate to book view to show the completed book after modal closes
      setTimeout(() => {
        navigate(`/book/${bookId}`);
      }, 4000);
    },
    onError: (error: any) => {
      setAutoGenerating(false);
      // Error will be shown via WebSocket or fallback toast
      if (!showProgressModal) {
        toast.error(error?.response?.data?.detail || 'Auto-generation failed');
      }
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

  const handleApplyStyleProfile = async (styleProfile: StyleProfile) => {
    if (!book) return;

    setApplyingStyle(true);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://aibook-9rbb.onrender.com';
      const response = await fetch(`${API_BASE_URL}/api/style/create-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('license_key')}`
        },
        body: JSON.stringify({
          book_id: book.book_id,
          ...styleProfile
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to apply style profile');
      }

      const data = await response.json();

      // Refresh book data to get updated style_profile
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });

      setShowStyleConfigModal(false);
      toast.success('Writing style applied successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to apply style profile');
    } finally {
      setApplyingStyle(false);
    }
  };

  const handleSaveStructure = async (structure: BookStructure) => {
    if (!book) return;

    setSavingStructure(true);

    try {
      const response = await fetch(`/api/books/${book.book_id}/structure`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('license_key')}`
        },
        body: JSON.stringify({ structure })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update structure');
      }

      // Refresh book data
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });

      setShowOutlineEditor(false);
      toast.success('Book structure updated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update structure');
    } finally {
      setSavingStructure(false);
    }
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
        {/* Premium Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="group flex items-center gap-2 text-text-tertiary hover:text-brand-400 transition-all mb-6"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Dashboard</span>
          </button>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 flex-wrap">
                <h1 className="text-h1 font-display font-bold gradient-text truncate">{book.title}</h1>
              </div>

              {/* Premium Book Configuration */}
              <div className="mb-6 relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative bg-surface-1 border border-white/10 rounded-2xl p-2.5 sm:p-3 md:p-4 lg:p-5 hover:border-brand-500/20 transition-all">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-2.5 sm:mb-3 md:mb-4">
                    <div className="p-1 sm:p-1.5 bg-brand-500/10 rounded-lg">
                      <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-brand-400" />
                    </div>
                    <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-text-primary">Book Configuration</span>
                    <span className="text-[9px] sm:text-[10px] md:text-xs text-text-muted ml-auto">Optional</span>
                  </div>

                  <div className="grid grid-cols-5 gap-1 sm:gap-1.5 md:gap-2 lg:gap-3">
                    <button
                      onClick={() => setIsEditBookModalOpen(true)}
                      className="group/btn relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-brand-500/0 group-hover/btn:bg-brand-500/10 transition-all duration-300 rounded-lg sm:rounded-xl" />
                      <div className="relative flex flex-col items-center gap-1 sm:gap-1.5 md:gap-2 p-1.5 sm:p-2 md:p-3 border border-white/5 rounded-lg sm:rounded-xl hover:border-brand-500/30 transition-all">
                        <div className="p-1 sm:p-1.5 md:p-2 bg-surface-2 rounded-md sm:rounded-lg group-hover/btn:bg-brand-500/20 transition-all">
                          <Edit3 className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-text-tertiary group-hover/btn:text-brand-400 transition-colors" />
                        </div>
                        <span className="text-[9px] sm:text-[10px] md:text-xs font-medium text-text-secondary group-hover/btn:text-brand-400 transition-colors text-center">Details</span>
                      </div>
                    </button>

                    <button
                      onClick={() => setShowStyleConfigModal(true)}
                      className="group/btn relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-accent-purple/0 group-hover/btn:bg-accent-purple/10 transition-all duration-300 rounded-lg sm:rounded-xl" />
                      <div className="relative flex flex-col items-center gap-1 sm:gap-1.5 md:gap-2 p-1.5 sm:p-2 md:p-3 border border-white/5 rounded-lg sm:rounded-xl hover:border-accent-purple/30 transition-all">
                        <div className="relative p-1 sm:p-1.5 md:p-2 bg-surface-2 rounded-md sm:rounded-lg group-hover/btn:bg-accent-purple/20 transition-all">
                          <Palette className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-text-tertiary group-hover/btn:text-accent-purple transition-colors" />
                          {book.style_profile && (
                            <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 flex h-2 w-2 sm:h-2.5 sm:w-2.5 md:h-3 md:w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-purple opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 md:h-3 md:w-3 bg-accent-purple"></span>
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] sm:text-[10px] md:text-xs font-medium text-text-secondary group-hover/btn:text-accent-purple transition-colors text-center">Style</span>
                      </div>
                    </button>

                    <button
                      onClick={() => setShowOutlineEditor(true)}
                      className="group/btn relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-accent-cyan/0 group-hover/btn:bg-accent-cyan/10 transition-all duration-300 rounded-lg sm:rounded-xl" />
                      <div className="relative flex flex-col items-center gap-1 sm:gap-1.5 md:gap-2 p-1.5 sm:p-2 md:p-3 border border-white/5 rounded-lg sm:rounded-xl hover:border-accent-cyan/30 transition-all">
                        <div className="p-1 sm:p-1.5 md:p-2 bg-surface-2 rounded-md sm:rounded-lg group-hover/btn:bg-accent-cyan/20 transition-all">
                          <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-text-tertiary group-hover/btn:text-accent-cyan transition-colors" />
                        </div>
                        <span className="text-[9px] sm:text-[10px] md:text-xs font-medium text-text-secondary group-hover/btn:text-accent-cyan transition-colors text-center">Outline</span>
                      </div>
                    </button>

                    <button
                      onClick={() => setShowCharacterBuilder(true)}
                      className="group/btn relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-accent-sage/0 group-hover/btn:bg-accent-sage/10 transition-all duration-300 rounded-lg sm:rounded-xl" />
                      <div className="relative flex flex-col items-center gap-1 sm:gap-1.5 md:gap-2 p-1.5 sm:p-2 md:p-3 border border-white/5 rounded-lg sm:rounded-xl hover:border-accent-sage/30 transition-all">
                        <div className="p-1 sm:p-1.5 md:p-2 bg-surface-2 rounded-md sm:rounded-lg group-hover/btn:bg-accent-sage/20 transition-all">
                          <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-text-tertiary group-hover/btn:text-accent-sage transition-colors" />
                        </div>
                        <span className="text-[9px] sm:text-[10px] md:text-xs font-medium text-text-secondary group-hover/btn:text-accent-sage transition-colors text-center">Characters</span>
                      </div>
                    </button>

                    <button
                      onClick={() => setShowAnalytics(true)}
                      className="group/btn relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-accent-amber/0 group-hover/btn:bg-accent-amber/10 transition-all duration-300 rounded-lg sm:rounded-xl" />
                      <div className="relative flex flex-col items-center gap-1 sm:gap-1.5 md:gap-2 p-1.5 sm:p-2 md:p-3 border border-white/5 rounded-lg sm:rounded-xl hover:border-accent-amber/30 transition-all">
                        <div className="p-1 sm:p-1.5 md:p-2 bg-surface-2 rounded-md sm:rounded-lg group-hover/btn:bg-accent-amber/20 transition-all">
                          <BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-text-tertiary group-hover/btn:text-accent-amber transition-colors" />
                        </div>
                        <span className="text-[9px] sm:text-[10px] md:text-xs font-medium text-text-secondary group-hover/btn:text-accent-amber transition-colors text-center">Analytics</span>
                      </div>
                    </button>
                  </div>

                  {/* Active Style Indicator */}
                  {book.style_profile && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <div className="flex items-center gap-2 px-3 py-2 bg-accent-purple/5 border border-accent-purple/20 rounded-lg">
                        <Palette className="w-3.5 h-3.5 text-accent-purple flex-shrink-0" />
                        <span className="text-xs text-text-tertiary">Active Style:</span>
                        <span className="text-xs font-semibold text-accent-purple">
                          {book.style_profile.author_preset
                            ? book.style_profile.author_preset.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                            : `${book.style_profile.tone || 'Custom'} Style`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {book.subtitle && (
                <p className="text-text-secondary text-base sm:text-lg mb-2">{book.subtitle}</p>
              )}
              <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
                <span className="flex items-center gap-1.5">
                  <span className="text-brand-400 font-semibold">{pages.length}</span>
                  <span className="text-text-tertiary">/</span>
                  <span className="text-text-secondary">{book.target_pages} pages</span>
                </span>
                <span className="w-1 h-1 bg-text-muted rounded-full" />
                <span className="px-2 py-1 bg-brand-500/10 text-brand-400 font-semibold rounded-lg">
                  {book.completion_percentage}% complete
                </span>
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

          {/* Premium Progress Bar */}
          <div className="mt-6 relative">
            <div className="flex items-center justify-between mb-2 text-xs">
              <span className="text-text-muted">Progress</span>
              <span className="text-brand-400 font-semibold">{book.completion_percentage}%</span>
            </div>
            <div className="relative h-2 bg-surface-2 rounded-full overflow-hidden">
              <div
                className="absolute inset-0 bg-gradient-to-r from-brand-500 to-brand-600 rounded-full transition-all duration-500 shadow-glow"
                style={{ width: `${book.completion_percentage}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
            {/* Premium Page Editor */}
            {currentPage && (
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative bg-surface-1 border border-white/10 rounded-2xl p-5 sm:p-6 hover:border-brand-500/30 transition-all">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <button
                        onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                        disabled={currentPageIndex === 0}
                        className="p-2 hover:bg-surface-2 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                      >
                        <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                      <div className="flex flex-col items-center">
                        <span className="font-display font-semibold text-sm sm:text-base">
                          Page {currentPage.page_number}
                        </span>
                        <span className="text-xs text-text-muted">of {pages.length}</span>
                      </div>
                      <button
                        onClick={() => setCurrentPageIndex(Math.min(pages.length - 1, currentPageIndex + 1))}
                        disabled={currentPageIndex === pages.length - 1}
                        className="p-2 hover:bg-surface-2 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                      >
                        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
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

                <div className="mb-5 flex items-center justify-between gap-4">
                  <div className="px-3 py-1.5 bg-brand-500/10 border border-brand-500/20 rounded-lg">
                    <span className="text-xs sm:text-sm text-brand-400 font-semibold">
                      {currentPage.section}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 text-xs">
                    <span className="text-text-secondary">{formatWordCount(countWords(currentPage.content))}</span>
                    <span className="w-1 h-1 bg-text-muted rounded-full" />
                    <span className="text-text-tertiary">{estimateReadingTime(countWords(currentPage.content))}</span>
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
                  <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 sm:gap-3">
                    <button
                      onClick={() => setShowIllustrationModal(true)}
                      className="btn-secondary flex items-center gap-2 text-sm"
                    >
                      <Image className="w-4 h-4" />
                      <span className="hidden sm:inline">Generate Illustration</span>
                      <span className="sm:hidden">Illustration</span>
                      <span className="text-xs text-brand-400">(3)</span>
                    </button>
                    <button
                      onClick={() => setShowStyleModal(true)}
                      className="btn-secondary flex items-center gap-2 text-sm"
                    >
                      <Palette className="w-4 h-4" />
                      <span className="hidden sm:inline">Apply Style</span>
                      <span className="sm:hidden">Style</span>
                      <span className="text-xs text-brand-400">(2)</span>
                    </button>
                  </div>
                )}
                </div>
              </div>
            )}

            {/* Premium Generate Next Page Card */}
            {canGenerateNext && (
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-accent-purple/20 rounded-2xl blur-xl opacity-50" />
                <div className="relative bg-gradient-to-br from-surface-1 to-surface-2 border border-brand-500/30 rounded-2xl p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-brand-500 rounded-xl blur-md opacity-50" />
                      <div className="relative p-2.5 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl">
                        <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-semibold text-base sm:text-lg mb-3 gradient-text">
                        Generate Next Page
                      </h3>
                      <textarea
                        value={userGuidance}
                        onChange={(e) => setUserGuidance(e.target.value)}
                        placeholder="Optional: Guide the AI with specific instructions for the next page..."
                        className="input-field mb-4 min-h-24 resize-none text-sm"
                      />
                      <div className="space-y-3">
                        <button
                          onClick={handleGenerateNext}
                          disabled={generatingPage}
                          className="btn-primary w-full"
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
                          className="btn-secondary w-full text-sm"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Auto-Generate Entire Book
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Premium AI Writing Indicator */}
            {generatingPage && (
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-accent-purple/20 rounded-2xl blur-xl opacity-75 animate-pulse" />
                <div className="relative bg-surface-1 border border-brand-500/30 rounded-2xl p-5 sm:p-6">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="relative flex-shrink-0">
                      <div className="absolute inset-0 bg-brand-500 rounded-full blur-md opacity-50 animate-pulse" />
                      <Loader2 className="relative w-6 h-6 sm:w-8 sm:h-8 animate-spin text-brand-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-semibold text-base sm:text-lg mb-1">
                        AI is writing page {pages.length + 1}...
                      </div>
                      <div className="text-xs sm:text-sm text-text-tertiary">
                        Analyzing context and generating content
                      </div>
                    </div>
                  </div>
                  <div className="relative h-2 bg-surface-2 rounded-full overflow-hidden mb-4">
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-500 via-accent-purple to-brand-500 rounded-full animate-loading-bar shadow-glow" />
                  </div>
                  <div className="text-xs text-text-muted text-center">
                    This typically takes 20-40 seconds • 1 credit will be consumed
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Premium Sidebar */}
          <div className="space-y-4 sm:space-y-6 order-1 lg:order-2">
            {/* Table of Contents */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative bg-surface-1 border border-white/10 rounded-2xl p-5 sm:p-6 hover:border-brand-500/30 transition-all">
                <h3 className="font-display font-semibold text-base sm:text-lg mb-5 flex items-center gap-3">
                  <div className="p-2 bg-brand-500/10 rounded-xl">
                    <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-brand-400" />
                  </div>
                  <span>Table of Contents</span>
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
                  <div className="text-sm text-text-muted text-center py-8">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 text-text-muted/50" />
                    <p>No pages yet</p>
                    <p className="text-xs mt-1">Generate pages to see your book's structure</p>
                  </div>
                )}
              </div>
              </div>
            </div>

            {/* Pages List */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-accent-purple/10 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative bg-surface-1 border border-white/10 rounded-2xl p-5 sm:p-6 hover:border-accent-purple/30 transition-all">
                <h3 className="font-display font-semibold text-base sm:text-lg mb-5 flex items-center gap-3">
                  <div className="p-2 bg-accent-purple/10 rounded-xl">
                    <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-accent-purple" />
                  </div>
                  <span>Pages</span>
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-hide">
                  {pages.map((page, idx) => (
                    <button
                      key={page.page_id}
                      onClick={() => setCurrentPageIndex(idx)}
                      className={`w-full p-3 rounded-xl text-left transition-all group/item ${
                        currentPageIndex === idx
                          ? 'bg-brand-500/10 border border-brand-500/40'
                          : 'bg-surface-2 hover:bg-surface-3 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-medium text-xs sm:text-sm ${
                          currentPageIndex === idx ? 'text-brand-400' : 'text-text-primary group-hover/item:text-brand-400'
                        }`}>
                          Page {page.page_number}
                        </span>
                        {page.is_title_page && (
                          <span className="text-xs bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded-lg">
                            Title
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-tertiary truncate">{page.section}</div>
                    </button>
                  ))}
                </div>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-accent-purple/20 rounded-2xl blur-2xl" />
            <div className="relative bg-surface-1 border-2 border-brand-500/30 rounded-2xl max-w-lg w-full p-8 shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl shadow-glow">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-bold gradient-text">Auto-Generate Entire Book</h2>
                  <p className="text-xs text-text-tertiary mt-1">AI-powered complete book generation</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <p className="text-text-secondary">
                  Automatically generate all remaining pages and optionally illustrations, then complete the book with a professional AI cover.
                </p>

                {/* Show selected writing style */}
                {book.style_profile && (
                  <div className="p-3 bg-accent-purple/10 border border-accent-purple/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-accent-purple flex-shrink-0" />
                      <span className="text-sm text-text-secondary">Writing Style:</span>
                      <span className="text-sm font-semibold text-accent-purple">
                        {book.style_profile.author_preset
                          ? book.style_profile.author_preset.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                          : `${book.style_profile.tone || 'Custom'} Style`}
                      </span>
                    </div>
                  </div>
                )}

              {book && (
                <div className="p-4 bg-gradient-to-br from-brand-500/10 to-accent-purple/10 border border-brand-500/20 rounded-xl">
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-text-tertiary">Remaining pages:</span>
                      <span className="text-text-primary font-bold text-lg">{book.target_pages - pages.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text-tertiary">Page credits:</span>
                      <span className="text-brand-400 font-semibold">{book.target_pages - pages.length} credits</span>
                    </div>
                    {autoGenWithIllustrations && (
                      <div className="flex justify-between items-center">
                        <span className="text-text-tertiary">Illustration credits:</span>
                        <span className="text-accent-purple font-semibold">{(book.target_pages - pages.length) * 3} credits</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-text-tertiary">Cover generation:</span>
                      <span className="text-accent-cyan font-semibold">2 credits</span>
                    </div>
                    <div className="border-t border-white/20 pt-2.5 mt-2.5">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-text-primary text-base">Total credits needed:</span>
                        <span className="text-brand-400 text-xl">
                          {book.target_pages - pages.length +
                           (autoGenWithIllustrations ? (book.target_pages - pages.length) * 3 : 0) +
                           2}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <label className="flex items-center gap-4 cursor-pointer group p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all">
                <input
                  type="checkbox"
                  checked={autoGenWithIllustrations}
                  onChange={(e) => setAutoGenWithIllustrations(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-brand-500 bg-surface-2 text-brand-500 focus:ring-2 focus:ring-brand-500 focus:ring-offset-0 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="font-semibold text-text-primary group-hover:text-brand-400 transition-colors">
                    Generate illustrations for each page
                  </div>
                  <div className="text-sm text-text-tertiary mt-1">
                    +3 credits per page • AI will create stunning visual scenes matching your content
                  </div>
                </div>
              </label>

              <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-200">
                    <strong className="text-amber-100">Note:</strong> This will take several minutes to complete. You can close this page and come back later - the generation will continue in the background.
                  </div>
                </div>
              </div>
            </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAutoGenerateModal(false);
                    setAutoGenWithIllustrations(false);
                  }}
                  disabled={autoGenerating}
                  className="btn-secondary flex-1 text-base py-3"
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
                  className="btn-primary flex-1 text-base py-3 shadow-glow"
                >
                  {autoGenerating ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating Book...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      Start Auto-Generation
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Progress Modal */}
      {showProgressModal && progressData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-accent-purple/20 rounded-2xl blur-2xl" />
            <div className="relative bg-surface-1 border-2 border-brand-500/30 rounded-2xl max-w-lg w-full p-8 shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-3 bg-gradient-to-br rounded-xl shadow-glow ${
                  progressData.status === 'error'
                    ? 'from-red-500 to-red-600'
                    : progressData.status === 'completed'
                    ? 'from-accent-green to-accent-green/80'
                    : 'from-brand-500 to-brand-600'
                }`}>
                  {progressData.status === 'error' ? (
                    <AlertCircle className="w-6 h-6 text-white" />
                  ) : progressData.status === 'completed' ? (
                    <Check className="w-6 h-6 text-white" />
                  ) : (
                    <Sparkles className="w-6 h-6 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-display font-bold gradient-text">
                    {progressData.status === 'error'
                      ? 'Generation Error'
                      : progressData.status === 'completed'
                      ? 'Book Complete!'
                      : 'Generating Your Book'}
                  </h2>
                  <p className="text-xs text-text-tertiary mt-1">
                    {progressData.status === 'completed'
                      ? 'Auto-generation finished successfully'
                      : progressData.status === 'error'
                      ? 'An error occurred during generation'
                      : 'AI is writing your book in real-time'}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2 text-sm">
                  <span className="text-text-secondary">Progress</span>
                  <span className="text-brand-400 font-bold">{progressData.percentage}%</span>
                </div>
                <div className="h-3 bg-surface-2 rounded-full overflow-hidden border border-white/10">
                  <div
                    className={`h-full transition-all duration-500 ${
                      progressData.status === 'error'
                        ? 'bg-gradient-to-r from-red-500 to-red-600'
                        : progressData.status === 'completed'
                        ? 'bg-gradient-to-r from-accent-green to-accent-green/80'
                        : 'bg-gradient-to-r from-brand-500 to-accent-purple'
                    }`}
                    style={{ width: `${progressData.percentage}%` }}
                  />
                </div>
              </div>

              {/* Status Message */}
              <div className="p-4 bg-gradient-to-br from-brand-500/10 to-accent-purple/10 border border-brand-500/20 rounded-xl mb-4">
                <div className="flex items-start gap-3">
                  {progressData.status === 'generating_page' ? (
                    <BookOpen className="w-5 h-5 text-brand-400 mt-0.5 flex-shrink-0" />
                  ) : progressData.status === 'generating_illustration' ? (
                    <Image className="w-5 h-5 text-accent-purple mt-0.5 flex-shrink-0" />
                  ) : progressData.status === 'generating_cover' ? (
                    <Palette className="w-5 h-5 text-accent-cyan mt-0.5 flex-shrink-0" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-brand-400 animate-spin mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-text-primary font-medium">{progressData.message}</p>
                    {progressData.status !== 'error' && progressData.status !== 'completed' && (
                      <p className="text-xs text-text-tertiary mt-1">
                        Page {progressData.current_page} of {progressData.total_pages}
                        {progressData.with_illustrations && ' (with illustrations)'}
                      </p>
                    )}
                    {progressData.error && (
                      <p className="text-xs text-red-400 mt-2 font-mono">{progressData.error}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Info Text */}
              {progressData.status !== 'error' && progressData.status !== 'completed' && (
                <div className="flex items-center gap-2 text-xs text-text-tertiary">
                  <Sparkles className="w-4 h-4" />
                  <p>You can safely close this window. Progress will continue in the background.</p>
                </div>
              )}

              {/* Close Button (only show on completion or error) */}
              {(progressData.status === 'completed' || progressData.status === 'error') && (
                <button
                  onClick={() => {
                    setShowProgressModal(false);
                    setProgressData(null);
                    if (progressData.status === 'completed') {
                      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
                    }
                  }}
                  className="btn-primary w-full mt-4"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showStyleConfigModal && (
        <StyleConfigModal
          onClose={() => setShowStyleConfigModal(false)}
          onApply={handleApplyStyleProfile}
          currentProfile={book?.style_profile || null}
          loading={applyingStyle}
        />
      )}

      {showOutlineEditor && book && book.structure && (
        <ChapterOutlineEditor
          onClose={() => setShowOutlineEditor(false)}
          onSave={handleSaveStructure}
          currentStructure={{
            title: book.structure.title,
            subtitle: book.structure.subtitle,
            target_pages: book.target_pages,
            outline: book.structure.sections?.map((s, i) => ({
              page_number: i + 1,
              section: s.title,
              content_brief: `Content for ${s.title}`,
              chapter_number: i + 1,
              pacing: 'medium' as const
            })) || [],
            themes: book.structure.themes,
            tone: book.structure.tone
          }}
          loading={savingStructure}
        />
      )}

      {showCharacterBuilder && (
        <CharacterBuilder
          onClose={() => setShowCharacterBuilder(false)}
          bookId={bookId!}
        />
      )}

      {showAnalytics && (
        <AnalyticsDashboard
          onClose={() => setShowAnalytics(false)}
          bookId={bookId!}
          content={currentPage?.content || ''}
        />
      )}
    </Layout>
  );
}
