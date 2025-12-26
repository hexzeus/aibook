import { BookOpen } from 'lucide-react';

interface BookCoverProps {
  coverUrl?: string;
  title: string;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

export default function BookCover({ coverUrl, title, className = '', size = 'medium' }: BookCoverProps) {
  const sizeClasses = {
    small: 'w-16 h-20',
    medium: 'w-24 h-32',
    large: 'w-32 h-40',
  };

  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt={title}
        className={`${sizeClasses[size]} object-cover rounded-lg shadow-lg ${className}`}
        loading="lazy"
        onError={(e) => {
          // Fallback if image fails to load
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const fallback = target.nextElementSibling as HTMLElement;
          if (fallback) fallback.style.display = 'flex';
        }}
      />
    );
  }

  // Fallback placeholder
  return (
    <div
      className={`${sizeClasses[size]} rounded-lg shadow-lg bg-gradient-to-br from-brand-500/20 via-accent-purple/20 to-accent-pink/20 flex flex-col items-center justify-center p-4 ${className}`}
    >
      <BookOpen className="w-8 h-8 text-brand-400 mb-2" />
      <div className="text-xs text-center text-gray-400 line-clamp-2 font-medium">
        {title}
      </div>
    </div>
  );
}
