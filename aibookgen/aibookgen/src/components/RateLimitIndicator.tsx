import { AlertTriangle, Clock } from 'lucide-react';

interface RateLimitIndicatorProps {
  requestsRemaining: number;
  resetTime?: Date;
  maxRequests?: number;
}

export default function RateLimitIndicator({
  requestsRemaining,
  resetTime,
  maxRequests = 100,
}: RateLimitIndicatorProps) {
  const percentage = (requestsRemaining / maxRequests) * 100;
  const isLow = percentage < 20;
  const isVeryLow = percentage < 10;

  if (percentage > 50) return null; // Don't show if plenty of requests remaining

  const getTimeUntilReset = () => {
    if (!resetTime) return '';
    const now = new Date();
    const diff = resetTime.getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return 'soon';
  };

  return (
    <div
      className={`fixed bottom-4 left-4 z-50 card max-w-sm animate-slide-in ${
        isVeryLow ? 'border-red-500/50' : isLow ? 'border-yellow-500/50' : 'border-brand-500/30'
      }`}
    >
      <div className="flex items-start gap-3">
        {isVeryLow ? (
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        ) : (
          <Clock className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <div className="font-semibold mb-1">
            {isVeryLow ? 'Rate Limit Almost Reached' : 'Rate Limit Warning'}
          </div>
          <div className="text-sm text-gray-400 mb-3">
            {requestsRemaining} of {maxRequests} requests remaining
            {resetTime && ` • Resets in ${getTimeUntilReset()}`}
          </div>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                isVeryLow
                  ? 'bg-gradient-to-r from-red-600 to-red-500'
                  : isLow
                  ? 'bg-gradient-to-r from-yellow-600 to-yellow-500'
                  : 'bg-gradient-to-r from-brand-500 to-accent-purple'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
