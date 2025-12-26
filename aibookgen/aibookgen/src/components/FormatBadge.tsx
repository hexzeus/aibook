import { FileText } from 'lucide-react';

interface FormatBadgeProps {
  format: string;
  size?: 'sm' | 'md' | 'lg';
}

const FORMAT_COLORS: Record<string, { bg: string; text: string; border: string; emoji: string }> = {
  epub: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    emoji: '📖',
  },
  pdf: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
    emoji: '📄',
  },
  docx: {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    border: 'border-indigo-500/30',
    emoji: '📝',
  },
  txt: {
    bg: 'bg-gray-500/10',
    text: 'text-gray-400',
    border: 'border-gray-500/30',
    emoji: '📃',
  },
  mobi: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    emoji: '📚',
  },
};

export default function FormatBadge({ format, size = 'md' }: FormatBadgeProps) {
  const formatLower = format.toLowerCase();
  const colors = FORMAT_COLORS[formatLower] || FORMAT_COLORS.txt;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${colors.bg} ${colors.text} border ${colors.border} rounded-lg font-semibold ${sizeClasses[size]} transition-all hover:scale-105`}
    >
      <span>{colors.emoji}</span>
      <span className="uppercase">{format}</span>
    </span>
  );
}

interface FormatBadgeGroupProps {
  formats: string[];
  maxVisible?: number;
}

export function FormatBadgeGroup({ formats, maxVisible = 3 }: FormatBadgeGroupProps) {
  const visible = formats.slice(0, maxVisible);
  const remaining = formats.length - maxVisible;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {visible.map((format) => (
        <FormatBadge key={format} format={format} size="sm" />
      ))}
      {remaining > 0 && (
        <span className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-lg border border-white/10">
          +{remaining} more
        </span>
      )}
    </div>
  );
}
