import { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface RateLimitBannerProps {
  resetTime?: Date;
  onDismiss?: () => void;
}

export default function RateLimitBanner({ resetTime, onDismiss }: RateLimitBannerProps) {
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    if (!resetTime) return;

    const updateTimeRemaining = () => {
      const now = new Date();
      const diff = resetTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('Rate limit reset');
        if (onDismiss) {
          setTimeout(onDismiss, 2000);
        }
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [resetTime, onDismiss]);

  if (!resetTime) return null;

  return (
    <div className="mb-6 bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-2xl p-4 animate-slide-down">
      <div className="flex items-start gap-3">
        <div className="bg-orange-500/20 p-2 rounded-lg flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-orange-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-1 text-orange-300">Rate Limit Reached</h3>
          <p className="text-sm text-gray-300 mb-3">
            You've reached the request limit for this time window. Please wait before making more requests.
          </p>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-orange-400" />
            <span className="text-orange-300 font-semibold">
              Resets in: {timeRemaining}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
