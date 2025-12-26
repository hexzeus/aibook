import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  onClose: (id: string) => void;
}

export default function Toast({ id, type, message, duration = 5000, onClose }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
  };

  const colors = {
    success: 'from-accent-green/20 to-accent-green/10 border-accent-green/30 text-accent-green',
    error: 'from-red-500/20 to-red-500/10 border-red-500/30 text-red-400',
    warning: 'from-accent-orange/20 to-accent-orange/10 border-accent-orange/30 text-accent-orange',
    info: 'from-brand-500/20 to-brand-500/10 border-brand-500/30 text-brand-400',
  };

  const Icon = icons[type];

  return (
    <div
      className={`glass-morphism border-2 rounded-xl p-4 shadow-2xl mb-3 animate-slide-in flex items-start gap-3 max-w-md bg-gradient-to-r ${colors[type]}`}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p className="flex-1 text-white text-sm font-medium leading-relaxed">{message}</p>
      <button
        onClick={() => onClose(id)}
        className="flex-shrink-0 hover:bg-white/10 rounded-lg p-1 transition-colors"
      >
        <X className="w-4 h-4 text-gray-400" />
      </button>
    </div>
  );
}
