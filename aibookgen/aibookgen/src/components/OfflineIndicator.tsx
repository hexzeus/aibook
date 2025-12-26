import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
      <div className="glass-morphism rounded-full px-6 py-3 border border-red-500/30 bg-red-500/10 flex items-center gap-3 shadow-glow">
        <WifiOff className="w-5 h-5 text-red-400 animate-pulse" />
        <span className="text-sm font-semibold text-red-400">
          No internet connection
        </span>
      </div>
    </div>
  );
}
