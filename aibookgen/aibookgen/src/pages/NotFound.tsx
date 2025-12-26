import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <h1 className="text-9xl font-display font-bold gradient-text mb-4">404</h1>
          <h2 className="text-3xl font-display font-bold mb-3">Page Not Found</h2>
          <p className="text-gray-400 text-lg">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary flex items-center gap-2"
          >
            <Home className="w-5 h-5" />
            Go to Dashboard
          </button>
        </div>

        <div className="mt-12 p-6 card bg-gradient-to-r from-brand-500/10 to-accent-purple/10 border-brand-500/20">
          <p className="text-sm text-gray-400">
            Need help? Check out our{' '}
            <a href="/dashboard" className="text-brand-400 hover:text-brand-300 transition-colors">
              Dashboard
            </a>{' '}
            or{' '}
            <a href="/library" className="text-brand-400 hover:text-brand-300 transition-colors">
              Library
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
