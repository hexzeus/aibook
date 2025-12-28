import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookPlus, BookOpen, Zap, TrendingUp, Clock, CheckCircle, Sparkles } from 'lucide-react';
import Layout from '../components/Layout';
import { booksApi, creditsApi } from '../lib/api';
import CreateBookModal from '../components/CreateBookModal';
import EmailCaptureModal from '../components/EmailCaptureModal';
import KeyboardShortcutsModal from '../components/KeyboardShortcutsModal';
import OnboardingModal from '../components/OnboardingModal';
import ResumeGenerationBanner from '../components/ResumeGenerationBanner';
import LowCreditWarning from '../components/LowCreditWarning';
import { DashboardStatsSkeleton, BookCardSkeleton } from '../components/Skeleton';
import { useToastStore } from '../store/toastStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToastStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dismissedResumeBook, setDismissedResumeBook] = useState<string | null>(null);
  const [dismissedLowCredit, setDismissedLowCredit] = useState(false);

  useKeyboardShortcuts([
    { key: 'n', ctrl: true, action: () => setShowCreateModal(true), description: 'Create new book' },
    { key: 'k', ctrl: true, action: () => navigate('/library'), description: 'Search books' },
    { key: '?', shift: true, action: () => setShowShortcuts(true), description: 'Show shortcuts' },
  ]);

  // Show onboarding for first-time users
  useEffect(() => {
    const onboardingCompleted = localStorage.getItem('onboarding_completed');
    if (!onboardingCompleted) {
      setShowOnboarding(true);
    }
  }, []);

  // Show email capture modal for new users after 5 seconds
  useEffect(() => {
    const emailCaptured = localStorage.getItem('email_captured');
    if (!emailCaptured) {
      const timer = setTimeout(() => {
        setShowEmailCapture(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleOnboardingClose = () => {
    localStorage.setItem('onboarding_completed', 'true');
    setShowOnboarding(false);
  };

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['credits'],
    queryFn: creditsApi.getCredits,
  });

  const { data: inProgressBooks, isLoading: isLoadingInProgress } = useQuery({
    queryKey: ['books', 'in-progress'],
    queryFn: booksApi.getInProgressBooks,
  });

  const { data: completedBooks, isLoading: isLoadingCompleted } = useQuery({
    queryKey: ['books', 'completed'],
    queryFn: booksApi.getCompletedBooks,
  });

  const createBookMutation = useMutation({
    mutationFn: booksApi.createBook,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      setShowCreateModal(false);
      toast.success('Book created successfully! Starting page generation...');
      navigate(`/editor/${data.book.book_id}`);
    },
  });

  return (
    <Layout>
      <div className="page-container page-enter">
        {/* Premium Header */}
        <div className="mb-8 sm:mb-10">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-hero font-display font-bold gradient-text">
              Welcome back
            </h1>
            <div className="relative">
              <div className="absolute inset-0 bg-brand-500 rounded-full blur-lg opacity-50 animate-pulse" />
              <Sparkles className="relative w-6 h-6 sm:w-8 sm:h-8 text-brand-400" />
            </div>
          </div>
          <p className="text-text-secondary text-base sm:text-lg max-w-2xl">
            Your creative workspace for AI-powered books
          </p>
        </div>

        {!isLoadingInProgress && inProgressBooks && inProgressBooks.books.length > 0 && (
          <>
            {inProgressBooks.books
              .filter(book =>
                !book.is_completed &&
                book.pages_generated < book.target_pages &&
                book.book_id !== dismissedResumeBook
              )
              .slice(0, 1)
              .map(book => (
                <ResumeGenerationBanner
                  key={book.book_id}
                  bookId={book.book_id}
                  bookTitle={book.title}
                  currentPages={book.pages_generated}
                  targetPages={book.target_pages}
                  onResume={() => navigate(`/editor/${book.book_id}`)}
                  onDismiss={() => setDismissedResumeBook(book.book_id)}
                />
              ))
            }
          </>
        )}

        {!dismissedLowCredit && stats && (
          <LowCreditWarning
            remainingCredits={stats.credits.remaining}
            onDismiss={() => setDismissedLowCredit(true)}
          />
        )}

        {/* Premium Stats Grid */}
        {isLoadingStats ? (
          <DashboardStatsSkeleton />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-8 sm:mb-10">
            {/* Credits Stat */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-brand-600/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative bg-surface-1 border border-brand-500/20 rounded-2xl p-4 sm:p-6 hover:border-brand-500/40 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl shadow-glow">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <span className="text-xs text-text-muted uppercase tracking-wider font-medium hidden sm:block">
                    Credits
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl sm:text-3xl font-display font-bold text-brand-400">
                    {stats?.credits.remaining.toLocaleString() || 0}
                  </div>
                  <div className="text-xs sm:text-sm text-text-tertiary">
                    of {stats?.credits.total.toLocaleString() || 0} available
                  </div>
                </div>
              </div>
            </div>

            {/* Books Stat */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-accent-purple/20 to-accent-purple/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative bg-surface-1 border border-white/10 rounded-2xl p-4 sm:p-6 hover:border-accent-purple/40 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-accent-purple/20 rounded-xl">
                    <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-accent-purple" />
                  </div>
                  <span className="text-xs text-text-muted uppercase tracking-wider font-medium hidden sm:block">
                    Books
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl sm:text-3xl font-display font-bold text-text-primary">
                    {stats?.usage.books_created || 0}
                  </div>
                  <div className="text-xs sm:text-sm text-text-tertiary">
                    Total created
                  </div>
                </div>
              </div>
            </div>

            {/* Pages Stat */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-accent-rose/20 to-accent-rose/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative bg-surface-1 border border-white/10 rounded-2xl p-4 sm:p-6 hover:border-accent-rose/40 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-accent-rose/20 rounded-xl">
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-accent-rose" />
                  </div>
                  <span className="text-xs text-text-muted uppercase tracking-wider font-medium hidden sm:block">
                    Pages
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl sm:text-3xl font-display font-bold text-text-primary">
                    {stats?.usage.pages_generated || 0}
                  </div>
                  <div className="text-xs sm:text-sm text-text-tertiary">
                    AI generated
                  </div>
                </div>
              </div>
            </div>

            {/* Exports Stat */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-accent-sage/20 to-accent-emerald/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative bg-surface-1 border border-white/10 rounded-2xl p-4 sm:p-6 hover:border-accent-sage/40 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-accent-sage/20 rounded-xl">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-accent-sage" />
                  </div>
                  <span className="text-xs text-text-muted uppercase tracking-wider font-medium hidden sm:block">
                    Exports
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl sm:text-3xl font-display font-bold text-text-primary">
                    {stats?.usage.exports || 0}
                  </div>
                  <div className="text-xs sm:text-sm text-text-tertiary">
                    Downloads
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Books Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* In Progress Books */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-h2 font-display font-bold flex items-center gap-3">
                <div className="p-2 bg-brand-500/10 rounded-xl">
                  <Clock className="w-5 h-5 text-brand-400" />
                </div>
                <span>In Progress</span>
              </h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary flex items-center gap-2 text-sm sm:text-base"
              >
                <BookPlus className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">New Book</span>
                <span className="sm:hidden">New</span>
              </button>
            </div>

            <div className="space-y-4">
              {isLoadingInProgress ? (
                <>
                  <BookCardSkeleton />
                  <BookCardSkeleton />
                </>
              ) : inProgressBooks?.books.length === 0 ? (
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative bg-surface-1 border border-white/10 rounded-2xl p-8 sm:p-12 text-center hover:border-brand-500/30 transition-all">
                    <div className="w-16 h-16 mx-auto mb-4 bg-surface-2 rounded-2xl flex items-center justify-center">
                      <BookOpen className="w-8 h-8 text-text-muted" />
                    </div>
                    <p className="text-text-secondary mb-6 text-sm sm:text-base">
                      No books in progress
                    </p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="btn-primary inline-flex items-center gap-2"
                    >
                      <BookPlus className="w-5 h-5" />
                      Create Your First Book
                    </button>
                  </div>
                </div>
              ) : (
                inProgressBooks?.books.map((book) => (
                  <div
                    key={book.book_id}
                    onClick={() => navigate(`/editor/${book.book_id}`)}
                    className="group relative cursor-pointer"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative bg-surface-1 border border-white/10 rounded-2xl p-5 sm:p-6 hover:border-brand-500/40 transition-all duration-300">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display font-semibold text-base sm:text-lg mb-2 group-hover:text-brand-400 transition-colors truncate">
                            {book.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-text-tertiary line-clamp-2">
                            {book.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 text-xs sm:text-sm">
                          <span className="text-text-secondary">
                            {book.pages_generated}/{book.target_pages} pages
                          </span>
                          <span className="px-2 py-1 bg-brand-500/10 text-brand-400 font-semibold rounded-lg">
                            {book.completion_percentage}%
                          </span>
                        </div>
                        <div className="w-24 sm:w-32 h-2 bg-surface-2 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full transition-all duration-500 shadow-glow"
                            style={{ width: `${book.completion_percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Completed Books */}
          <div>
            <h2 className="text-h2 font-display font-bold mb-6 flex items-center gap-3">
              <div className="p-2 bg-accent-sage/10 rounded-xl">
                <CheckCircle className="w-5 h-5 text-accent-sage" />
              </div>
              <span>Completed</span>
            </h2>

            <div className="space-y-4">
              {isLoadingCompleted ? (
                <>
                  <BookCardSkeleton />
                  <BookCardSkeleton />
                </>
              ) : completedBooks?.books.length === 0 ? (
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-accent-sage/10 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative bg-surface-1 border border-white/10 rounded-2xl p-8 sm:p-12 text-center hover:border-accent-sage/30 transition-all">
                    <div className="w-16 h-16 mx-auto mb-4 bg-surface-2 rounded-2xl flex items-center justify-center">
                      <CheckCircle className="w-8 h-8 text-text-muted" />
                    </div>
                    <p className="text-text-secondary text-sm sm:text-base">
                      No completed books yet
                    </p>
                  </div>
                </div>
              ) : (
                completedBooks?.books.map((book) => (
                  <div
                    key={book.book_id}
                    onClick={() => navigate(`/book/${book.book_id}`)}
                    className="group relative cursor-pointer"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-accent-sage/20 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative bg-surface-1 border border-white/10 rounded-2xl p-4 sm:p-5 hover:border-accent-sage/40 transition-all duration-300 flex items-center gap-4">
                      {book.cover_svg && (
                        <div className="relative flex-shrink-0">
                          <div className="absolute inset-0 bg-brand-500 rounded-lg blur-md opacity-20 group-hover:opacity-40 transition-opacity" />
                          <img
                            src={book.cover_svg}
                            alt={book.title}
                            className="relative w-12 h-16 sm:w-16 sm:h-20 object-cover rounded-lg shadow-premium"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-semibold text-sm sm:text-base mb-1 group-hover:text-brand-400 transition-colors truncate">
                          {book.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm text-text-tertiary">
                            {book.page_count || book.pages_generated || 0} pages
                          </span>
                          <span className="w-1 h-1 bg-text-muted rounded-full" />
                          <span className="text-xs text-accent-sage">Complete</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateBookModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={(data) => createBookMutation.mutate(data)}
          loading={createBookMutation.isPending}
        />
      )}

      <OnboardingModal
        isOpen={showOnboarding}
        onClose={handleOnboardingClose}
      />

      <EmailCaptureModal
        isOpen={showEmailCapture}
        onClose={() => setShowEmailCapture(false)}
      />

      <KeyboardShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </Layout>
  );
}
