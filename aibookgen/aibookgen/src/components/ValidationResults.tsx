import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { booksApi, Book } from '../lib/api';
import { CheckCircle2, XCircle, AlertTriangle, Info, Loader2, RefreshCw, X } from 'lucide-react';
import PublishWizard from './PublishWizard';

interface ValidationResultsProps {
  bookId: string;
  bookTitle?: string;
  bookData?: Book;
  onClose?: () => void;
}

interface Check {
  passed: boolean | null;
  label: string;
  details: string[];
  required?: boolean;
  score?: number;
}

export default function ValidationResults({ bookId, bookTitle, bookData, onClose }: ValidationResultsProps) {
  const [showPublishWizard, setShowPublishWizard] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['readiness-detailed', bookId],
    queryFn: () => booksApi.checkReadiness(bookId, true), // Validate EPUB
    staleTime: 0, // Always fresh
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-[#1a1625] rounded-2xl p-8 max-w-2xl w-full border border-white/10">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-purple-400 mx-auto mb-4" />
              <p className="text-gray-400">Validating your book...</p>
              <p className="text-xs text-gray-500 mt-2">This may take a few moments</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-[#1a1625] rounded-2xl p-8 max-w-2xl w-full border border-red-500/20">
          <div className="text-center">
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Validation Failed</h3>
            <p className="text-gray-400 mb-6">Unable to validate your book</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => refetch()}
                className="px-6 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors"
              >
                Try Again
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const readiness = data;
  const checks = readiness?.checks || {};
  const score = readiness?.score || 0;

  const getCheckIcon = (check: Check) => {
    if (check.passed === true) return <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />;
    if (check.passed === false) return <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />;
    return <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />;
  };

  const allPassed = readiness?.ready_for_kdp && readiness?.ready_for_apple && readiness?.ready_for_google;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1625] rounded-2xl max-w-3xl w-full border border-white/10 max-h-[90vh] flex flex-col my-auto shadow-2xl">
        {/* Sticky Header */}
        <div className="flex items-start justify-between p-8 pb-6 border-b border-white/10 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold mb-2">Validation Results</h2>
            <p className="text-gray-400 text-sm">
              {allPassed
                ? 'Your book is ready to publish!'
                : 'Review the items below to prepare your book for publishing'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh validation"
            >
              <RefreshCw className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-8 pt-6">

        {/* Score Banner */}
        <div
          className={`p-6 rounded-xl mb-6 ${
            score >= 90
              ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30'
              : score >= 70
              ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30'
              : 'bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400 mb-1">Overall Score</div>
              <div
                className={`text-4xl font-bold ${
                  score >= 90 ? 'text-green-400' : score >= 70 ? 'text-yellow-400' : 'text-red-400'
                }`}
              >
                {score}
                <span className="text-xl text-gray-400">/100</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400 mb-1">Passed Checks</div>
              <div className="text-2xl font-semibold">
                {readiness?.passed_checks || 0} / {readiness?.total_checks || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Marketplace Readiness */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Marketplace Compatibility</h3>
          <div className="grid grid-cols-3 gap-3">
            <div
              className={`p-4 rounded-lg border ${
                readiness?.ready_for_kdp
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              <div className="text-center">
                {readiness?.ready_for_kdp ? (
                  <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-2" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                )}
                <div className="text-sm font-medium">Amazon KDP</div>
              </div>
            </div>
            <div
              className={`p-4 rounded-lg border ${
                readiness?.ready_for_apple
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              <div className="text-center">
                {readiness?.ready_for_apple ? (
                  <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-2" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                )}
                <div className="text-sm font-medium">Apple Books</div>
              </div>
            </div>
            <div
              className={`p-4 rounded-lg border ${
                readiness?.ready_for_google
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              <div className="text-center">
                {readiness?.ready_for_google ? (
                  <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-2" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                )}
                <div className="text-sm font-medium">Google Play</div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Checks */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Detailed Checks</h3>
          <div className="space-y-3">
            {Object.entries(checks).map(([checkId, check]: [string, any]) => (
              <div
                key={checkId}
                className={`p-4 rounded-lg border ${
                  check.passed === true
                    ? 'bg-white/5 border-white/10'
                    : check.passed === false
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-yellow-500/10 border-yellow-500/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  {getCheckIcon(check)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{check.label}</span>
                      {!check.required && (
                        <span className="text-xs px-2 py-0.5 bg-white/10 rounded-full text-gray-400">
                          Optional
                        </span>
                      )}
                      {check.score !== undefined && (
                        <span className="text-xs px-2 py-0.5 bg-purple-500/20 rounded-full text-purple-300">
                          Score: {check.score}/100
                        </span>
                      )}
                    </div>
                    {check.details && check.details.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {check.details.map((detail: string, idx: number) => (
                          <div key={idx} className="flex items-start gap-2 text-sm text-gray-400">
                            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{detail}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        {readiness?.recommendations && readiness.recommendations.length > 0 && (
          <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-purple-400" />
              Next Steps
            </h3>
            <div className="space-y-2">
              {readiness.recommendations.map((rec: string, index: number) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-purple-400 font-bold">{index + 1}.</span>
                  <span className="text-gray-300">{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>

        {/* Sticky Footer Actions */}
        <div className="flex gap-3 justify-end p-8 pt-6 border-t border-white/10 flex-shrink-0 bg-[#1a1625]">
          {onClose && (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              Close
            </button>
          )}
          {allPassed && (
            <button
              onClick={() => setShowPublishWizard(true)}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg transition-all font-semibold"
            >
              Continue to Publish
            </button>
          )}
        </div>
      </div>

      {showPublishWizard && bookTitle && (
        <PublishWizard
          bookId={bookId}
          bookTitle={bookTitle}
          bookData={bookData}
          onClose={() => {
            setShowPublishWizard(false);
            if (onClose) onClose();
          }}
        />
      )}
    </div>
  );
}
