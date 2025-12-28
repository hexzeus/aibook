import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
  isOpen: boolean;
}

export default function ConfirmModal({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'warning',
  isOpen,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      bg: 'from-red-500/20 to-red-500/10 border-red-500/30',
      iconColor: 'text-red-400',
      buttonBg: 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600',
    },
    warning: {
      bg: 'from-accent-orange/20 to-accent-orange/10 border-accent-orange/30',
      iconColor: 'text-accent-orange',
      buttonBg: 'bg-gradient-to-r from-accent-orange to-accent-pink hover:from-accent-orange/90 hover:to-accent-pink/90',
    },
    info: {
      bg: 'from-brand-500/20 to-brand-500/10 border-brand-500/30',
      iconColor: 'text-brand-400',
      buttonBg: 'bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fade-in">
      {/* Premium Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onCancel}
      />

      {/* Premium Modal */}
      <div className="relative max-w-md w-full">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-accent-purple/20 rounded-2xl blur-2xl opacity-60" />
        <div className="relative bg-surface-1 border border-white/10 rounded-2xl p-6 shadow-premium-lg animate-scale-in">
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-1.5 hover:bg-surface-2 rounded-lg transition-all group"
          >
            <X className="w-5 h-5 text-text-tertiary group-hover:text-text-primary" />
          </button>

          <div className={`relative bg-gradient-to-br from-surface-2 to-surface-1 border-2 rounded-xl p-4 mb-6 ${styles.bg}`}>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-surface-1/50 rounded-lg">
                <AlertTriangle className={`w-6 h-6 flex-shrink-0 ${styles.iconColor}`} />
              </div>
              <div className="flex-1">
                <h2 className="font-display font-bold text-lg sm:text-xl mb-2 text-text-primary">{title}</h2>
                <p className="text-text-secondary text-sm leading-relaxed">{message}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 btn-secondary"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onCancel();
              }}
              className={`flex-1 font-semibold px-6 py-3 rounded-xl transition-all duration-200 shadow-glow hover:shadow-glow-lg hover:scale-[1.02] ${styles.buttonBg} text-white`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
