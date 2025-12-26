import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/ToastContainer';
import LoadingScreen from './components/LoadingScreen';
import OfflineIndicator from './components/OfflineIndicator';
import WhatsNewModal from './components/WhatsNewModal';
import SessionTimeoutWarning from './components/SessionTimeoutWarning';

// Eager load critical pages
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';

// Lazy load other pages for code splitting
const Editor = lazy(() => import('./pages/Editor'));
const Library = lazy(() => import('./pages/Library'));
const Credits = lazy(() => import('./pages/Credits'));
const Affiliate = lazy(() => import('./pages/Affiliate'));
const Settings = lazy(() => import('./pages/Settings'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const BookView = lazy(() => import('./pages/BookView'));
const NotFound = lazy(() => import('./pages/NotFound'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const FAQ = lazy(() => import('./pages/FAQ'));
const ExportHistory = lazy(() => import('./pages/ExportHistory'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 3, // Retry failed requests 3 times
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      staleTime: 30000,
      refetchOnReconnect: true, // Refetch when internet connection is restored
    },
    mutations: {
      retry: 2, // Retry failed mutations 2 times
      retryDelay: 1000, // 1 second delay between retries
    },
  },
});

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" />;
}

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Simulate initial app loading (check auth, load config, etc.)
    const timer = setTimeout(() => {
      setIsInitializing(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  if (isInitializing) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/editor/:bookId"
            element={
              <PrivateRoute>
                <Editor />
              </PrivateRoute>
            }
          />
          <Route
            path="/book/:bookId"
            element={
              <PrivateRoute>
                <BookView />
              </PrivateRoute>
            }
          />
          <Route
            path="/library"
            element={
              <PrivateRoute>
                <Library />
              </PrivateRoute>
            }
          />
          <Route
            path="/credits"
            element={
              <PrivateRoute>
                <Credits />
              </PrivateRoute>
            }
          />
          <Route
            path="/affiliate"
            element={
              <PrivateRoute>
                <Affiliate />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <PrivateRoute>
                <Settings />
              </PrivateRoute>
            }
          />
          <Route
            path="/subscriptions"
            element={
              <PrivateRoute>
                <Subscriptions />
              </PrivateRoute>
            }
          />
          <Route
            path="/exports"
            element={
              <PrivateRoute>
                <ExportHistory />
              </PrivateRoute>
            }
          />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        <ToastContainer />
        <OfflineIndicator />
        <WhatsNewModal />
        <SessionTimeoutWarning />
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
