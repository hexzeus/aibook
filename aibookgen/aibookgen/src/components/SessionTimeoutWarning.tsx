import { useState, useEffect } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
const WARNING_BEFORE_MS = 5 * 60 * 1000; // Show warning 5 minutes before timeout

export default function SessionTimeoutWarning() {
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const { isAuthenticated, logout } = useAuthStore();
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Reset activity timer on user interaction
  useEffect(() => {
    if (!isAuthenticated) return;

    const resetActivity = () => {
      setLastActivity(Date.now());
      setShowWarning(false);
    };

    // Track user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      window.addEventListener(event, resetActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetActivity);
      });
    };
  }, [isAuthenticated]);

  // Check session timeout
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivity;
      const remaining = SESSION_TIMEOUT_MS - timeSinceActivity;

      if (remaining <= 0) {
        // Session expired
        logout();
        setShowWarning(false);
      } else if (remaining <= WARNING_BEFORE_MS) {
        // Show warning
        setShowWarning(true);
        setTimeRemaining(Math.ceil(remaining / 1000)); // Convert to seconds
      } else {
        setShowWarning(false);
      }
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [isAuthenticated, lastActivity, logout]);

  const handleExtendSession = () => {
    setLastActivity(Date.now());
    setShowWarning(false);
  };

  if (!showWarning || !isAuthenticated) return null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className="glass-morphism rounded-2xl p-4 border border-yellow-500/30 bg-yellow-500/10 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="bg-yellow-500/20 p-2 rounded-lg">
            <Clock className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-yellow-400 mb-1">
              Session Expiring Soon
            </h4>
            <p className="text-sm text-gray-300 mb-3">
              Your session will expire in {minutes}:{seconds.toString().padStart(2, '0')}.
              Click below to continue working.
            </p>
            <button
              onClick={handleExtendSession}
              className="btn-primary flex items-center gap-2 w-full justify-center text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Continue Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
