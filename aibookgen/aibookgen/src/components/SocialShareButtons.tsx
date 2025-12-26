import { Facebook, Twitter, Linkedin, MessageCircle } from 'lucide-react';

interface SocialShareButtonsProps {
  url: string;
  title?: string;
  description?: string;
}

export default function SocialShareButtons({ url, title = 'AI Book Generator', description = 'Create amazing AI-generated books with ease' }: SocialShareButtonsProps) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);

  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
  };

  const handleShare = (platform: keyof typeof shareLinks) => {
    const width = 600;
    const height = 500;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    window.open(
      shareLinks[platform],
      `share-${platform}`,
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,menubar=no`
    );
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-400 font-medium">Share on:</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleShare('twitter')}
          className="p-2.5 rounded-lg bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 text-[#1DA1F2] transition-all hover:scale-110"
          title="Share on Twitter"
        >
          <Twitter className="w-5 h-5" fill="currentColor" />
        </button>

        <button
          onClick={() => handleShare('facebook')}
          className="p-2.5 rounded-lg bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] transition-all hover:scale-110"
          title="Share on Facebook"
        >
          <Facebook className="w-5 h-5" fill="currentColor" />
        </button>

        <button
          onClick={() => handleShare('linkedin')}
          className="p-2.5 rounded-lg bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 text-[#0A66C2] transition-all hover:scale-110"
          title="Share on LinkedIn"
        >
          <Linkedin className="w-5 h-5" fill="currentColor" />
        </button>

        <button
          onClick={() => handleShare('whatsapp')}
          className="p-2.5 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] transition-all hover:scale-110"
          title="Share on WhatsApp"
        >
          <MessageCircle className="w-5 h-5" fill="currentColor" />
        </button>
      </div>
    </div>
  );
}
