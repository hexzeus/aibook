import { useState, useEffect } from 'react';
import { X, Languages, Zap, Globe, Book, FileText, Sparkles } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { translationApi } from '../lib/api';
import { useToastStore } from '../store/toastStore';
import TranslationProgressModal from './TranslationProgressModal';

interface TranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: string;
  currentPageNumber?: number;
  mode: 'page' | 'book';
  currentLanguage?: string; // Current language code (e.g., 'en', 'zh', 'es')
}

const LANGUAGE_FLAGS: Record<string, string> = {
  en: '🇺🇸',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  it: '🇮🇹',
  pt: '🇵🇹',
  ru: '🇷🇺',
  ja: '🇯🇵',
  ko: '🇰🇷',
  zh: '🇨🇳',
  ar: '🇸🇦',
  hi: '🇮🇳',
  nl: '🇳🇱',
  pl: '🇵🇱',
  sv: '🇸🇪',
  tr: '🇹🇷'
};

export default function TranslationModal({ isOpen, onClose, bookId, currentPageNumber, mode, currentLanguage = 'en' }: TranslationModalProps) {
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();
  const toast = useToastStore();

  const { data: languagesData } = useQuery({
    queryKey: ['translation-languages'],
    queryFn: translationApi.getSupportedLanguages,
    enabled: isOpen,
  });

  const translatePageMutation = useMutation({
    mutationFn: ({ language }: { language: string }) =>
      translationApi.translatePage(bookId, currentPageNumber!, language),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      toast.success(`Page ${currentPageNumber} translated successfully!`);
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Translation failed');
    },
  });

  const translateBookMutation = useMutation({
    mutationFn: ({ language }: { language: string }) =>
      translationApi.translateBook(bookId, language),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
      toast.success('Book translated successfully!');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Translation failed');
    },
  });

  const languages = languagesData?.languages || {};
  const filteredLanguages = Object.entries(languages).filter(([code, name]) =>
    name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTranslate = () => {
    if (!selectedLanguage) return;

    if (mode === 'page') {
      translatePageMutation.mutate({ language: selectedLanguage });
    } else {
      translateBookMutation.mutate({ language: selectedLanguage });
    }
  };

  const isTranslating = translatePageMutation.isPending || translateBookMutation.isPending;
  const creditCost = mode === 'page' ? 1 : 5;

  if (!isOpen) return null;

  // Show progress modal when translating
  if (isTranslating && selectedLanguage) {
    const targetLangName = languages[selectedLanguage] || selectedLanguage;
    const sourceLangName = languages[currentLanguage] || 'English';
    return (
      <TranslationProgressModal
        isOpen={isTranslating}
        sourceLanguage={currentLanguage}
        targetLanguage={selectedLanguage}
        sourceFlag={LANGUAGE_FLAGS[currentLanguage] || '🌐'}
        targetFlag={LANGUAGE_FLAGS[selectedLanguage] || '🌐'}
        sourceLangName={sourceLangName}
        targetLangName={targetLangName}
        mode={mode}
        pageNumber={currentPageNumber}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-1 rounded-2xl border border-white/10 max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-premium-lg">
        {/* Header */}
        <div className="relative p-6 border-b border-white/10">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/10 to-accent-purple/10" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-accent-cyan/20 rounded-xl">
                <Languages className="w-6 h-6 text-accent-cyan" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-primary">
                  {mode === 'page' ? 'Translate Page' : 'Translate Book'}
                </h2>
                <p className="text-sm text-text-secondary">
                  {mode === 'page'
                    ? `Translate page ${currentPageNumber} to another language`
                    : 'Translate all pages to another language'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              disabled={isTranslating}
            >
              <X className="w-5 h-5 text-text-tertiary" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Credit Cost Badge */}
          <div className="mb-6 p-4 bg-gradient-to-r from-accent-amber/10 to-accent-orange/10 border border-accent-amber/20 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-accent-amber" />
                <span className="text-sm font-semibold text-text-primary">Credit Cost</span>
              </div>
              <div className="flex items-center gap-2">
                {mode === 'page' ? (
                  <FileText className="w-4 h-4 text-text-tertiary" />
                ) : (
                  <Book className="w-4 h-4 text-text-tertiary" />
                )}
                <span className="text-lg font-bold text-accent-amber">{creditCost} credit{creditCost > 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search languages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-11"
              />
            </div>
          </div>

          {/* Language Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filteredLanguages.map(([code, name]) => (
              <button
                key={code}
                onClick={() => setSelectedLanguage(code)}
                className={`p-3 rounded-xl border transition-all ${
                  selectedLanguage === code
                    ? 'border-accent-cyan bg-accent-cyan/20 shadow-glow'
                    : 'border-white/10 bg-surface-2 hover:border-accent-cyan/50 hover:bg-accent-cyan/10'
                }`}
                disabled={isTranslating}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{LANGUAGE_FLAGS[code] || '🌐'}</span>
                  <span className={`text-sm font-medium ${
                    selectedLanguage === code ? 'text-accent-cyan' : 'text-text-secondary'
                  }`}>
                    {name}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {filteredLanguages.length === 0 && (
            <div className="text-center py-8 text-text-tertiary">
              <Globe className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No languages found</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-surface-2">
          <div className="flex items-center justify-between gap-4">
            <div className="text-xs text-text-tertiary">
              {mode === 'page'
                ? 'Translation will replace the current page content'
                : 'Translation will replace all page content in this book'
              }
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="btn-secondary"
                disabled={isTranslating}
              >
                Cancel
              </button>
              <button
                onClick={handleTranslate}
                disabled={!selectedLanguage || isTranslating}
                className="btn-primary flex items-center gap-2 min-w-[140px] justify-center"
              >
                {isTranslating ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Translating...</span>
                  </>
                ) : (
                  <>
                    <Languages className="w-4 h-4" />
                    <span>Translate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
