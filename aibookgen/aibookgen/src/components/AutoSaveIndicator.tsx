import { useEffect, useState } from 'react';
import { Check, Cloud, CloudOff, Loader2 } from 'lucide-react';

export type SaveStatus = 'saved' | 'saving' | 'error' | 'idle';

interface AutoSaveIndicatorProps {
  status: SaveStatus;
  lastSaved?: Date;
}

export default function AutoSaveIndicator({ status, lastSaved }: AutoSaveIndicatorProps) {
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    if (!lastSaved) return;

    const updateTimeAgo = () => {
      const seconds = Math.floor((Date.now() - lastSaved.getTime()) / 1000);

      if (seconds < 5) {
        setTimeAgo('just now');
      } else if (seconds < 60) {
        setTimeAgo(`${seconds}s ago`);
      } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        setTimeAgo(`${minutes}m ago`);
      } else {
        const hours = Math.floor(seconds / 3600);
        setTimeAgo(`${hours}h ago`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 1000);

    return () => clearInterval(interval);
  }, [lastSaved]);

  const getStatusConfig = () => {
    switch (status) {
      case 'saving':
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          text: 'Saving...',
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/30',
        };
      case 'saved':
        return {
          icon: <Check className="w-4 h-4" />,
          text: `Saved ${timeAgo}`,
          color: 'text-green-400',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30',
        };
      case 'error':
        return {
          icon: <CloudOff className="w-4 h-4" />,
          text: 'Save failed',
          color: 'text-red-400',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
        };
      default:
        return {
          icon: <Cloud className="w-4 h-4" />,
          text: 'Auto-save enabled',
          color: 'text-gray-400',
          bgColor: 'bg-white/5',
          borderColor: 'border-white/10',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bgColor} ${config.borderColor} transition-all`}
    >
      <span className={config.color}>{config.icon}</span>
      <span className={`text-sm ${config.color}`}>{config.text}</span>
    </div>
  );
}
