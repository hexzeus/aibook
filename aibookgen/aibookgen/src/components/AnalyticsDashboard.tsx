import { useState, useEffect } from 'react';
import { X, TrendingUp, BookOpen, Target, AlertCircle, CheckCircle, BarChart3, Lightbulb } from 'lucide-react';

interface AnalyticsDashboardProps {
  onClose: () => void;
  bookId: string;
  content: string; // Current page or full book content
}

interface ReadabilityData {
  readability: {
    flesch_reading_ease: {
      score: number;
      grade_level: string;
      difficulty: string;
      words: number;
      sentences: number;
      syllables: number;
    };
    gunning_fog_index: {
      score: number;
      grade_level: string;
      complex_words: number;
      complex_word_percentage: number;
    };
  };
  statistics: {
    total_words: number;
    total_sentences: number;
    total_paragraphs: number;
    total_characters: number;
    unique_words: number;
    vocabulary_richness: number;
    avg_word_length: number;
    avg_sentence_length: number;
    avg_paragraph_length: number;
  };
  recommendations: Array<{
    type: string;
    severity: 'high' | 'medium' | 'low' | 'none';
    message: string;
    target: string;
  }>;
}

export default function AnalyticsDashboard({ onClose, bookId, content }: AnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<ReadabilityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analyzeContent();
  }, [content]);

  const analyzeContent = async () => {
    if (!content || content.trim().length === 0) {
      setError('No content to analyze');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://aibook-9rbb.onrender.com';
      const response = await fetch(`${API_BASE_URL}/api/analytics/readability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('license_key')}`
        },
        body: JSON.stringify({ text: content })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze content');
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 80) return 'bg-green-500/20 border-green-500/50';
    if (score >= 60) return 'bg-blue-500/20 border-blue-500/50';
    if (score >= 40) return 'bg-yellow-500/20 border-yellow-500/50';
    return 'bg-red-500/20 border-red-500/50';
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'medium':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      case 'low':
        return <Lightbulb className="w-5 h-5 text-blue-400" />;
      case 'none':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto overscroll-contain">
      <div className="glass-morphism rounded-2xl max-w-5xl w-full p-4 sm:p-6 md:p-8 animate-slide-up my-auto max-h-[90vh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-500/20 rounded-xl">
              <BarChart3 className="w-6 h-6 text-brand-400" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold">Content Analytics</h2>
              <p className="text-sm text-gray-400 mt-1">Readability and writing quality insights</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mb-4" />
            <p className="text-gray-400">Analyzing your content...</p>
          </div>
        )}

        {error && (
          <div className="glass-morphism rounded-xl p-6 bg-red-500/10 border border-red-500/30">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-400" />
              <div>
                <h3 className="font-semibold text-red-400">Analysis Error</h3>
                <p className="text-sm text-gray-300 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && analytics && (
          <div className="space-y-6">
            {/* Readability Scores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Flesch Reading Ease */}
              <div className={`glass-morphism rounded-xl p-6 border-2 ${getScoreBgColor(analytics.readability.flesch_reading_ease.score)}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg">Flesch Reading Ease</h3>
                  <BookOpen className="w-5 h-5 text-gray-400" />
                </div>
                <div className={`text-5xl font-bold mb-2 ${getScoreColor(analytics.readability.flesch_reading_ease.score)}`}>
                  {analytics.readability.flesch_reading_ease.score}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-300">
                    Difficulty: <span className="font-semibold">{analytics.readability.flesch_reading_ease.difficulty}</span>
                  </p>
                  <p className="text-sm text-gray-300">
                    Grade Level: <span className="font-semibold">{analytics.readability.flesch_reading_ease.grade_level}</span>
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-2 text-xs text-gray-400">
                  <div>
                    <div className="font-semibold text-white">{analytics.readability.flesch_reading_ease.words}</div>
                    <div>Words</div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">{analytics.readability.flesch_reading_ease.sentences}</div>
                    <div>Sentences</div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">{analytics.readability.flesch_reading_ease.syllables}</div>
                    <div>Syllables</div>
                  </div>
                </div>
              </div>

              {/* Gunning Fog Index */}
              <div className="glass-morphism rounded-xl p-6 border-2 bg-purple-500/10 border-purple-500/30">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg">Gunning Fog Index</h3>
                  <Target className="w-5 h-5 text-gray-400" />
                </div>
                <div className="text-5xl font-bold mb-2 text-purple-400">
                  {analytics.readability.gunning_fog_index.score}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-300">
                    Grade Level: <span className="font-semibold">{analytics.readability.gunning_fog_index.grade_level}</span>
                  </p>
                  <p className="text-sm text-gray-300">
                    Complex Words: <span className="font-semibold">{analytics.readability.gunning_fog_index.complex_words}</span>
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Complexity</span>
                    <span className="font-semibold text-white">
                      {analytics.readability.gunning_fog_index.complex_word_percentage}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all"
                      style={{ width: `${Math.min(analytics.readability.gunning_fog_index.complex_word_percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Text Statistics */}
            <div className="glass-morphism rounded-xl p-6 bg-white/5">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-brand-400" />
                Text Statistics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="text-2xl font-bold text-brand-400">{analytics.statistics.total_words.toLocaleString()}</div>
                  <div className="text-xs text-gray-400 mt-1">Total Words</div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="text-2xl font-bold text-blue-400">{analytics.statistics.unique_words.toLocaleString()}</div>
                  <div className="text-xs text-gray-400 mt-1">Unique Words</div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="text-2xl font-bold text-purple-400">{analytics.statistics.total_sentences}</div>
                  <div className="text-xs text-gray-400 mt-1">Sentences</div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="text-2xl font-bold text-green-400">{analytics.statistics.total_paragraphs}</div>
                  <div className="text-xs text-gray-400 mt-1">Paragraphs</div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-400">{analytics.statistics.avg_word_length}</div>
                  <div className="text-xs text-gray-400 mt-1">Avg Word Length</div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="text-2xl font-bold text-orange-400">{analytics.statistics.avg_sentence_length}</div>
                  <div className="text-xs text-gray-400 mt-1">Avg Sentence Length</div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="text-2xl font-bold text-pink-400">{analytics.statistics.avg_paragraph_length}</div>
                  <div className="text-xs text-gray-400 mt-1">Avg Para Length</div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="text-2xl font-bold text-cyan-400">{(analytics.statistics.vocabulary_richness * 100).toFixed(1)}%</div>
                  <div className="text-xs text-gray-400 mt-1">Vocab Richness</div>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="glass-morphism rounded-xl p-6 bg-white/5">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-400" />
                Writing Recommendations
              </h3>
              <div className="space-y-3">
                {analytics.recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-2 ${
                      rec.severity === 'high'
                        ? 'bg-red-500/10 border-red-500/30'
                        : rec.severity === 'medium'
                        ? 'bg-yellow-500/10 border-yellow-500/30'
                        : rec.severity === 'low'
                        ? 'bg-blue-500/10 border-blue-500/30'
                        : 'bg-green-500/10 border-green-500/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {getSeverityIcon(rec.severity)}
                      <div className="flex-1">
                        <p className="font-medium text-white">{rec.message}</p>
                        <p className="text-sm text-gray-400 mt-1">{rec.target}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Readability Guide */}
            <div className="glass-morphism rounded-xl p-6 bg-gradient-to-br from-brand-500/10 to-purple-500/10 border border-brand-500/30">
              <h3 className="font-semibold text-lg mb-3">Score Interpretation Guide</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold text-brand-400 mb-2">Flesch Reading Ease</h4>
                  <ul className="space-y-1 text-gray-300">
                    <li>90-100: Very Easy (5th grade)</li>
                    <li>80-89: Easy (6th grade)</li>
                    <li>70-79: Fairly Easy (7th grade)</li>
                    <li>60-69: Standard (8th-9th grade)</li>
                    <li>50-59: Fairly Difficult (10th-12th)</li>
                    <li>30-49: Difficult (College)</li>
                    <li>0-29: Very Difficult (Graduate)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-purple-400 mb-2">Gunning Fog Index</h4>
                  <p className="text-gray-300">
                    Estimates the years of formal education needed to understand the text on first reading.
                    A score of 12 means 12th-grade level. Lower scores indicate more accessible text.
                  </p>
                  <p className="text-gray-400 text-xs mt-2">
                    Complex words are defined as having 3+ syllables.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={analyzeContent}
            disabled={loading}
            className="btn-secondary disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Refresh Analysis'}
          </button>
          <button
            onClick={onClose}
            className="btn-primary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
