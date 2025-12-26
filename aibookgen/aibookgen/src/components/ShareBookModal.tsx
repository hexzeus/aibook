import { useState } from 'react';
import { X, Share2, Copy, Check, Mail, Facebook, Twitter, Linkedin } from 'lucide-react';
import { copyToClipboard, shareContent } from '../utils/clipboard';

interface ShareBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookTitle: string;
  bookId: string;
}

export default function ShareBookModal({ isOpen, onClose, bookTitle, bookId }: ShareBookModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate shareable URL (would be actual public URL in production)
  const shareUrl = `${window.location.origin}/book/${bookId}`;
  const shareText = `Check out "${bookTitle}" - created with AI Book Generator!`;

  const handleCopyLink = async () => {
    const success = await copyToClipboard(shareUrl, 'Link copied!');
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    await shareContent({
      title: bookTitle,
      text: shareText,
      url: shareUrl,
    });
  };

  const shareOptions = [
    {
      name: 'Email',
      icon: Mail,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      action: () => window.open(`mailto:?subject=${encodeURIComponent(bookTitle)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`),
    },
    {
      name: 'Twitter',
      icon: Twitter,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10',
      action: () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`),
    },
    {
      name: 'Facebook',
      icon: Facebook,
      color: 'text-blue-500',
      bg: 'bg-blue-600/10',
      action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`),
    },
    {
      name: 'LinkedIn',
      icon: Linkedin,
      color: 'text-blue-600',
      bg: 'bg-blue-700/10',
      action: () => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`),
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative card max-w-lg w-full animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-brand-500 to-accent-purple p-2 rounded-xl">
              <Share2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold">Share Book</h2>
              <p className="text-sm text-gray-400">"{bookTitle}"</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Copy Link Section */}
        <div className="mb-6">
          <label className="text-sm text-gray-400 mb-2 block">Share Link</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="input-field flex-1 text-sm"
              onClick={(e) => e.currentTarget.select()}
            />
            <button
              onClick={handleCopyLink}
              className="btn-primary flex items-center gap-2 whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Native Share Button (mobile-friendly) */}
        {typeof navigator !== 'undefined' && typeof navigator.share !== 'undefined' && (
          <button
            onClick={handleNativeShare}
            className="w-full btn-secondary flex items-center justify-center gap-2 mb-6"
          >
            <Share2 className="w-5 h-5" />
            Share via...
          </button>
        )}

        {/* Social Share Options */}
        <div className="mb-6">
          <label className="text-sm text-gray-400 mb-3 block">Share On</label>
          <div className="grid grid-cols-2 gap-3">
            {shareOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.name}
                  onClick={option.action}
                  className={`${option.bg} border border-white/10 rounded-xl p-4 flex items-center gap-3 hover:bg-white/10 transition-all`}
                >
                  <Icon className={`w-5 h-5 ${option.color}`} />
                  <span className="font-semibold">{option.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
          <p className="text-xs text-yellow-200">
            <strong>Note:</strong> Sharing creates a public link to your book. Anyone with the link will be able to view it.
          </p>
        </div>
      </div>
    </div>
  );
}
