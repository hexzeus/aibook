import { useState } from 'react';
import { X, Mail, Gift } from 'lucide-react';
import { userApi } from '../lib/api';
import { useMutation } from '@tanstack/react-query';
import { useToastStore } from '../store/toastStore';

interface EmailCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EmailCaptureModal({ isOpen, onClose }: EmailCaptureModalProps) {
  const [email, setEmail] = useState('');
  const toast = useToastStore();

  const updateEmailMutation = useMutation({
    mutationFn: (email: string) => userApi.updateEmail(email),
    onSuccess: () => {
      toast.success('Email saved! You\'ll receive important updates and tips.');
      onClose();
      localStorage.setItem('email_captured', 'true');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      updateEmailMutation.mutate(email);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('email_captured', 'skipped');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={handleSkip}
      />
      <div className="relative card max-w-md w-full animate-scale-in">
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-brand-500 to-accent-purple rounded-full flex items-center justify-center">
            <Gift className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-display font-bold mb-2">
            Stay Updated!
          </h2>
          <p className="text-gray-400">
            Get exclusive tips, book generation best practices, and be the first to know about new features.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address..."
              className="input-field pl-12 w-full"
              required
            />
          </div>

          <button
            type="submit"
            disabled={updateEmailMutation.isPending || !email.trim()}
            className="btn-primary w-full"
          >
            {updateEmailMutation.isPending ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Mail className="w-5 h-5 mr-2" />
                Save Email
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSkip}
            className="w-full text-sm text-gray-400 hover:text-white transition-colors"
          >
            Maybe later
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="flex items-start gap-3 text-xs text-gray-500">
            <div className="text-brand-400 mt-0.5">✓</div>
            <div>We respect your privacy. No spam, unsubscribe anytime.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
