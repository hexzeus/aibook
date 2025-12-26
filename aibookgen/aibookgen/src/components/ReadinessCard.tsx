import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { booksApi, Book } from '../lib/api';
import { CheckCircle2, XCircle, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import ValidationResults from './ValidationResults';

interface ReadinessCardProps {
  bookId: string;
  bookTitle?: string;
  bookData?: Book;
  validateEpub?: boolean;
}

export default function ReadinessCard({ bookId, bookTitle, bookData, validateEpub = true }: ReadinessCardProps) {
  const [showValidation, setShowValidation] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['readiness', bookId, validateEpub],
    queryFn: () => booksApi.checkReadiness(bookId, validateEpub),
    staleTime: 30000, // 30 seconds
  });

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-red-500/20">
        <div className="text-center py-8">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400">Failed to check readiness</p>
          <button
            onClick={() => refetch()}
            className="mt-4 text-sm text-purple-400 hover:text-purple-300"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const readiness = data;
  const score = readiness?.score || 0;

  // Determine score color
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 90) return 'from-green-500 to-emerald-500';
    if (score >= 70) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-pink-500';
  };

  return (
    <>
      <div className="card hover:bg-white/[0.03] transition-all cursor-pointer" onClick={() => setShowValidation(true)}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-lg">Marketplace Readiness</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                refetch();
              }}
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
            >
              Refresh
            </button>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </div>

      {/* Overall Score */}
      <div className="flex items-center justify-center mb-8">
        <div className="relative w-32 h-32">
          {/* Background Circle */}
          <svg className="w-32 h-32 transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-white/10"
            />
            {/* Progress Circle */}
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="url(#score-gradient)"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 56}`}
              strokeDashoffset={`${2 * Math.PI * 56 * (1 - score / 100)}`}
              className="transition-all duration-1000 ease-out"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="score-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" className={score >= 90 ? 'text-green-500' : score >= 70 ? 'text-yellow-500' : 'text-red-500'} stopColor="currentColor" />
                <stop offset="100%" className={score >= 90 ? 'text-emerald-500' : score >= 70 ? 'text-orange-500' : 'text-pink-500'} stopColor="currentColor" />
              </linearGradient>
            </defs>
          </svg>
          {/* Score Text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className={`text-3xl font-bold ${getScoreColor(score)}`}>
                {score}
              </div>
              <div className="text-xs text-gray-400">/ 100</div>
            </div>
          </div>
        </div>
      </div>

      {/* Marketplace Status */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Amazon KDP</span>
          </div>
          {readiness?.ready_for_kdp ? (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          ) : (
            <XCircle className="w-5 h-5 text-red-400" />
          )}
        </div>

        <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Apple Books</span>
          </div>
          {readiness?.ready_for_apple ? (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          ) : (
            <XCircle className="w-5 h-5 text-red-400" />
          )}
        </div>

        <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Google Play Books</span>
          </div>
          {readiness?.ready_for_google ? (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          ) : (
            <XCircle className="w-5 h-5 text-red-400" />
          )}
        </div>
      </div>

      {/* Recommendations */}
      {readiness?.recommendations && readiness.recommendations.length > 0 && (
        <div className="border-t border-white/10 pt-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            What to Fix
          </h4>
          <div className="space-y-2">
            {readiness.recommendations.slice(0, 3).map((rec: string, index: number) => (
              <div
                key={index}
                className="text-xs text-gray-400 pl-6 relative before:content-['•'] before:absolute before:left-2"
              >
                {rec}
              </div>
            ))}
            {readiness.recommendations.length > 3 && (
              <div className="text-xs text-purple-400 pl-6">
                +{readiness.recommendations.length - 3} more...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress Indicator */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
          <span>Checks Passed</span>
          <span>
            {readiness?.passed_checks || 0} / {readiness?.total_checks || 0}
          </span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${getScoreGradient(score)} transition-all duration-1000 ease-out`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Click to view details hint */}
      <div className="mt-4 text-center">
        <div className="text-xs text-gray-500">
          Click card to view detailed report
        </div>
      </div>
    </div>

    {/* Validation Modal */}
    {showValidation && bookTitle && (
      <ValidationResults
        bookId={bookId}
        bookTitle={bookTitle}
        bookData={bookData}
        onClose={() => setShowValidation(false)}
      />
    )}
    </>
  );
}
