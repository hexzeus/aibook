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
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold mb-2 flex items-center gap-3">
            <span>Welcome back!</span>
            <Sparkles className="w-8 h-8 text-brand-400 animate-pulse" />
          </h1>
          <p className="text-gray-400 text-lg">
            Create, manage, and export your AI-powered books
          </p>
        </div>

        {isLoadingStats ? (
          <DashboardStatsSkeleton />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6 md:mb-8">
            <div className="card group hover:scale-105 transition-transform">
            <div className="flex items-center gap-2 mb-2 md:mb-3">
              <div className="p-1.5 sm:p-2 bg-brand-500/20 rounded-lg">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-brand-400" />
              </div>
              <span className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide hidden sm:block">Credits</span>
            </div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold mb-0.5 sm:mb-1">
              {stats?.credits.remaining.toLocaleString() || 0}
            </div>
            <div className="text-[10px] sm:text-xs md:text-sm text-gray-400">
              of {stats?.credits.total.toLocaleString() || 0}
            </div>
          </div>

          <div className="card group hover:scale-105 transition-transform">
            <div className="flex items-center gap-2 mb-2 md:mb-3">
              <div className="p-1.5 sm:p-2 bg-accent-purple/20 rounded-lg">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-accent-purple" />
              </div>
              <span className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide hidden sm:block">Books</span>
            </div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold mb-0.5 sm:mb-1">
              {stats?.usage.books_created || 0}
            </div>
            <div className="text-[10px] sm:text-xs md:text-sm text-gray-400">Created</div>
          </div>

          <div className="card group hover:scale-105 transition-transform">
            <div className="flex items-center gap-2 mb-2 md:mb-3">
              <div className="p-1.5 sm:p-2 bg-accent-pink/20 rounded-lg">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-accent-pink" />
              </div>
              <span className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide hidden sm:block">Pages</span>
            </div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold mb-0.5 sm:mb-1">
              {stats?.usage.pages_generated || 0}
            </div>
            <div className="text-[10px] sm:text-xs md:text-sm text-gray-400">Generated</div>
          </div>

          <div className="card group hover:scale-105 transition-transform">
            <div className="flex items-center gap-2 mb-2 md:mb-3">
              <div className="p-1.5 sm:p-2 bg-accent-green/20 rounded-lg">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-accent-green" />
              </div>
              <span className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide hidden sm:block">Exports</span>
            </div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold mb-0.5 sm:mb-1">
              {stats?.usage.exports || 0}
            </div>
            <div className="text-[10px] sm:text-xs md:text-sm text-gray-400">Downloads</div>
          </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-display font-bold flex items-center gap-2">
                <Clock className="w-6 h-6 text-brand-400" />
                In Progress
              </h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                <BookPlus className="w-5 h-5" />
                New Book
              </button>
            </div>

            <div className="space-y-4">
              {isLoadingInProgress ? (
                <>
                  <BookCardSkeleton />
                  <BookCardSkeleton />
                </>
              ) : inProgressBooks?.books.length === 0 ? (
                <div className="card text-center py-12">
                  <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">No books in progress</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <BookPlus className="w-5 h-5" />
                    Create Your First Book
                  </button>
                </div>
              ) : (
                inProgressBooks?.books.map((book) => (
                  <div
                    key={book.book_id}
                    onClick={() => navigate(`/editor/${book.book_id}`)}
                    className="card cursor-pointer group hover:shadow-glow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1 group-hover:text-brand-400 transition-colors">
                          {book.title}
                        </h3>
                        <p className="text-sm text-gray-400 line-clamp-2">
                          {book.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-400">
                          {book.pages_generated}/{book.target_pages} pages
                        </span>
                        <span className="text-brand-400 font-semibold">
                          {book.completion_percentage}%
                        </span>
                      </div>
                      <div className="w-32 h-2 bg-white/5 rounded-full overflow-hidden progress-bar">
                        <div
                          className="h-full bg-gradient-to-r from-brand-500 to-accent-purple transition-all duration-500"
                          style={{ width: `${book.completion_percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-display font-bold mb-6 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-accent-green" />
              Completed
            </h2>

            <div className="space-y-4">
              {isLoadingCompleted ? (
                <>
                  <BookCardSkeleton />
                  <BookCardSkeleton />
                </>
              ) : completedBooks?.books.length === 0 ? (
                <div className="card text-center py-12">
                  <CheckCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No completed books yet</p>
                </div>
              ) : (
                completedBooks?.books.map((book) => (
                  <div
                    key={book.book_id}
                    onClick={() => navigate(`/book/${book.book_id}`)}
                    className="card cursor-pointer group hover:shadow-glow flex items-center gap-4"
                  >
                    {book.cover_svg && (
                      <img
                        src={book.cover_svg}
                        alt={book.title}
                        className="w-16 h-20 object-cover rounded-lg shadow-lg"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1 group-hover:text-brand-400 transition-colors">
                        {book.title}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {book.page_count || book.pages_generated || 0} pages
                      </p>
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
