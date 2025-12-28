import { FileText, Clock, CheckCircle2, BookOpen } from 'lucide-react';

interface BookStatsProps {
  totalWords: number;
  readingTime: string;
  pageCount: number;
  completionDate?: string;
}

export default function BookStats({ totalWords, readingTime, pageCount, completionDate }: BookStatsProps) {
  const stats = [
    {
      icon: FileText,
      label: 'Total Words',
      value: totalWords.toLocaleString(),
      color: 'text-brand-400',
      bg: 'bg-brand-500/10',
    },
    {
      icon: BookOpen,
      label: 'Pages',
      value: pageCount.toString(),
      color: 'text-accent-purple',
      bg: 'bg-accent-purple/10',
    },
    {
      icon: Clock,
      label: 'Reading Time',
      value: readingTime,
      color: 'text-accent-pink',
      bg: 'bg-accent-pink/10',
    },
    ...(completionDate
      ? [
          {
            icon: CheckCircle2,
            label: 'Completed',
            value: new Date(completionDate).toLocaleDateString(),
            color: 'text-accent-green',
            bg: 'bg-accent-green/10',
          },
        ]
      : []),
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div key={index} className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-transparent rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative bg-surface-1 border border-white/10 rounded-2xl p-4 hover:border-brand-500/30 transition-all duration-300">
              <div className={`${stat.bg} w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${stat.color}`} />
              </div>
              <div className="text-xs text-text-muted mb-1 uppercase tracking-wide font-medium">{stat.label}</div>
              <div className="text-lg sm:text-xl font-display font-bold text-text-primary">{stat.value}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ReadingProgressProps {
  currentPage: number;
  totalPages: number;
}

export function ReadingProgress({ currentPage, totalPages }: ReadingProgressProps) {
  const percentage = Math.round((currentPage / totalPages) * 100);

  return (
    <div className="group relative">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-transparent rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative bg-surface-1 border border-white/10 rounded-2xl p-5 sm:p-6 hover:border-brand-500/30 transition-all">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-secondary">Reading Progress</h3>
          <span className="px-2.5 py-1 bg-brand-500/10 border border-brand-500/20 rounded-lg text-sm font-bold text-brand-400">{percentage}%</span>
        </div>
        <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full transition-all duration-500 shadow-glow"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="text-xs text-text-tertiary">
          Page {currentPage} of {totalPages}
        </div>
      </div>
    </div>
  );
}
