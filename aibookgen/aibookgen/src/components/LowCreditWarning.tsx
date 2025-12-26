import { AlertTriangle, CreditCard, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LowCreditWarningProps {
  remainingCredits: number;
  onDismiss: () => void;
}

export default function LowCreditWarning({ remainingCredits, onDismiss }: LowCreditWarningProps) {
  const navigate = useNavigate();

  // Only show if credits are below 100
  if (remainingCredits >= 100) return null;

  const severity = remainingCredits < 20 ? 'critical' : 'warning';
  const colors = severity === 'critical'
    ? {
        bg: 'from-red-500/20 to-orange-500/20',
        border: 'border-red-500/30',
        icon: 'bg-red-500/20',
        iconColor: 'text-red-400',
        text: 'text-red-300'
      }
    : {
        bg: 'from-yellow-500/20 to-orange-500/20',
        border: 'border-yellow-500/30',
        icon: 'bg-yellow-500/20',
        iconColor: 'text-yellow-400',
        text: 'text-yellow-300'
      };

  return (
    <div className={`mb-6 bg-gradient-to-r ${colors.bg} border ${colors.border} rounded-2xl p-4 animate-slide-down`}>
      <div className="flex items-start gap-3">
        <div className={`${colors.icon} p-2 rounded-lg flex-shrink-0`}>
          <AlertTriangle className={`w-5 h-5 ${colors.iconColor}`} />
        </div>
        <div className="flex-1">
          <h3 className={`font-semibold text-lg mb-1 ${colors.text}`}>
            {severity === 'critical' ? 'Critical: Almost Out of Credits' : 'Low Credit Warning'}
          </h3>
          <p className="text-sm text-gray-300 mb-3">
            You have <strong>{remainingCredits} credits</strong> remaining.
            {severity === 'critical'
              ? ' Purchase more credits now to continue creating books.'
              : ' Consider purchasing more credits to avoid interruptions.'
            }
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/credits')}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <CreditCard className="w-4 h-4" />
              Buy Credits
            </button>
            <button
              onClick={onDismiss}
              className="btn-secondary text-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 hover:bg-white/10 rounded transition-all"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
