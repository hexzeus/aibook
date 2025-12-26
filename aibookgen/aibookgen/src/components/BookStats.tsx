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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div key={index} className="card hover:scale-105 transition-transform">
            <div className={`${stat.bg} w-10 h-10 rounded-xl flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div className="text-xs text-gray-400 mb-1">{stat.label}</div>
            <div className="text-lg font-bold">{stat.value}</div>
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
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-400">Reading Progress</h3>
        <span className="text-sm font-bold text-brand-400">{percentage}%</span>
      </div>
      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-accent-purple transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-xs text-gray-500">
        Page {currentPage} of {totalPages}
      </div>
    </div>
  );
}
