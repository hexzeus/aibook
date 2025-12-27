import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, CheckCircle2, AlertCircle, Loader2, ArrowRight, ArrowLeft, Rocket, Book, FileText, DollarSign, Globe } from 'lucide-react';
import { booksApi, Book as BookType } from '../lib/api';
import { useToastStore } from '../store/toastStore';
import { triggerConfetti } from '../utils/confetti';

interface PublishWizardProps {
  bookId: string;
  bookTitle: string;
  bookData?: BookType;
  onClose: () => void;
}

type WizardStep = 'validate' | 'metadata' | 'pricing' | 'marketplace' | 'publish';

interface MarketplaceConfig {
  amazon_kdp: boolean;
  apple_books: boolean;
  google_play: boolean;
  kobo: boolean;
}

export default function PublishWizard({ bookId, bookTitle, bookData, onClose }: PublishWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('validate');
  const [isPublishing, setIsPublishing] = useState(false);
  const toast = useToastStore();
  const queryClient = useQueryClient();

  // Metadata state - Initialize with book data and smart defaults
  const [metadata, setMetadata] = useState({
    title: bookData?.title || bookTitle,
    subtitle: bookData?.subtitle || '',
    author: 'Independent Author', // Default author name
    description: bookData?.description || '',
    categories: [] as string[],
    keywords: [] as string[],
  });

  // Update metadata when bookData changes
  useEffect(() => {
    if (bookData) {
      setMetadata(prev => ({
        ...prev,
        title: bookData.title || prev.title,
        subtitle: bookData.subtitle || prev.subtitle,
        description: bookData.description || prev.description,
      }));
    }
  }, [bookData]);

  // Pricing state
  const [pricing, setPricing] = useState({
    price: '2.99',
    currency: 'USD',
    territories: 'worldwide',
    rights: 'worldwide',
  });

  // Marketplace state
  const [marketplaces, setMarketplaces] = useState<MarketplaceConfig>({
    amazon_kdp: true,
    apple_books: false,
    google_play: false,
    kobo: false,
  });

  // Validation query
  const { data: validationData, isLoading: isValidating } = useQuery({
    queryKey: ['validation', bookId],
    queryFn: () => booksApi.checkReadiness(bookId, true),
    enabled: currentStep === 'validate',
  });

  const steps: Array<{ id: WizardStep; label: string; icon: any }> = [
    { id: 'validate', label: 'Validate', icon: CheckCircle2 },
    { id: 'metadata', label: 'Metadata', icon: FileText },
    { id: 'pricing', label: 'Pricing', icon: DollarSign },
    { id: 'marketplace', label: 'Marketplace', icon: Globe },
    { id: 'publish', label: 'Publish', icon: Rocket },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const canProceed = () => {
    switch (currentStep) {
      case 'validate':
        return validationData?.score >= 70;
      case 'metadata':
        return metadata.title && metadata.author && metadata.description;
      case 'pricing':
        return parseFloat(pricing.price) > 0;
      case 'marketplace':
        return Object.values(marketplaces).some((v) => v);
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1].id);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].id);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);

    try {
      // Export EPUB for all selected marketplaces
      const blob = await booksApi.exportBook(bookId, 'epub');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${metadata.title.replace(/[^a-z0-9]/gi, '_')}.epub`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setIsPublishing(false);
      toast.success('Book exported! Opening marketplace upload pages...');
      triggerConfetti();

      // Open marketplace upload pages based on selections
      const marketplaceUrls: Record<string, string> = {
        amazon_kdp: 'https://kdp.amazon.com/en_US/bookshelf',
        apple_books: 'https://books.apple.com/us/author/apple-books-for-authors/id1453047887',
        google_play: 'https://play.google.com/books/publish/',
      };

      // Open each selected marketplace in a new tab
      setTimeout(() => {
        Object.entries(marketplaces).forEach(([marketplace, selected]) => {
          if (selected && marketplaceUrls[marketplace as keyof typeof marketplaceUrls]) {
            window.open(marketplaceUrls[marketplace as keyof typeof marketplaceUrls], '_blank');
          }
        });

        queryClient.invalidateQueries({ queryKey: ['books'] });

        // Close wizard after 2 seconds
        setTimeout(() => {
          onClose();
        }, 2000);
      }, 1000);
    } catch (error) {
      setIsPublishing(false);
      toast.error('Failed to export book. Please try again.');
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'validate':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold mb-2">Validating Your Book</h3>
              <p className="text-gray-400">
                Checking marketplace compliance and readiness
              </p>
            </div>

            {isValidating ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-12 h-12 animate-spin text-purple-400" />
              </div>
            ) : (
              <>
                {/* Score Display */}
                <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-6">
                  <div className="text-center">
                    <div className="text-sm text-gray-400 mb-2">Readiness Score</div>
                    <div className={`text-5xl font-bold ${
                      validationData?.score >= 90 ? 'text-green-400' :
                      validationData?.score >= 70 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {validationData?.score || 0}
                      <span className="text-2xl text-gray-400">/100</span>
                    </div>
                  </div>
                </div>

                {/* Marketplace Status */}
                <div className="grid grid-cols-3 gap-3">
                  <div className={`p-4 rounded-lg border ${
                    validationData?.ready_for_kdp ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    <div className="text-center">
                      {validationData?.ready_for_kdp ? (
                        <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-2" />
                      ) : (
                        <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                      )}
                      <div className="text-sm font-medium">Amazon KDP</div>
                    </div>
                  </div>
                  <div className={`p-4 rounded-lg border ${
                    validationData?.ready_for_apple ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    <div className="text-center">
                      {validationData?.ready_for_apple ? (
                        <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-2" />
                      ) : (
                        <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                      )}
                      <div className="text-sm font-medium">Apple Books</div>
                    </div>
                  </div>
                  <div className={`p-4 rounded-lg border ${
                    validationData?.ready_for_google ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    <div className="text-center">
                      {validationData?.ready_for_google ? (
                        <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-2" />
                      ) : (
                        <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                      )}
                      <div className="text-sm font-medium">Google Play</div>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                {validationData?.recommendations && validationData.recommendations.length > 0 && (
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-purple-400" />
                      Recommendations
                    </h4>
                    <div className="space-y-2">
                      {validationData.recommendations.map((rec: string, index: number) => (
                        <div key={index} className="flex items-start gap-2 text-sm">
                          <span className="text-purple-400">•</span>
                          <span className="text-gray-300">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );

      case 'metadata':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold mb-2">Book Metadata</h3>
              <p className="text-gray-400">
                Provide details about your book for marketplaces
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={metadata.title}
                  onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500"
                  placeholder="Enter book title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Subtitle</label>
                <input
                  type="text"
                  value={metadata.subtitle}
                  onChange={(e) => setMetadata({ ...metadata, subtitle: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500"
                  placeholder="Optional subtitle"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Author <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={metadata.author}
                  onChange={(e) => setMetadata({ ...metadata, author: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500"
                  placeholder="Author name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={metadata.description}
                  onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500"
                  rows={4}
                  placeholder="Brief description of your book"
                />
                <div className="text-xs text-gray-500 mt-1">
                  {metadata.description.length} characters
                </div>
              </div>
            </div>
          </div>
        );

      case 'pricing':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold mb-2">Pricing & Rights</h3>
              <p className="text-gray-400">
                Set your book's price and distribution rights
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Price <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-3">
                  <input
                    type="number"
                    step="0.01"
                    min="0.99"
                    value={pricing.price}
                    onChange={(e) => setPricing({ ...pricing, price: e.target.value })}
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500"
                    placeholder="2.99"
                  />
                  <select
                    value={pricing.currency}
                    onChange={(e) => setPricing({ ...pricing, currency: e.target.value })}
                    className="w-24 px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Recommended: $2.99 - $9.99 for best sales
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Territories</label>
                <select
                  value={pricing.territories}
                  onChange={(e) => setPricing({ ...pricing, territories: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                >
                  <option value="worldwide">Worldwide</option>
                  <option value="us-only">United States Only</option>
                  <option value="eu-only">European Union Only</option>
                  <option value="custom">Custom Selection</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Publishing Rights</label>
                <select
                  value={pricing.rights}
                  onChange={(e) => setPricing({ ...pricing, rights: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                >
                  <option value="worldwide">I have worldwide rights</option>
                  <option value="regional">Regional rights only</option>
                  <option value="limited">Limited rights</option>
                </select>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="text-sm">
                  <div className="font-semibold mb-2">Estimated Royalties (Amazon KDP 70%)</div>
                  <div className="text-2xl font-bold text-blue-400">
                    ${(parseFloat(pricing.price) * 0.7).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">per sale</div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'marketplace':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold mb-2">Choose Marketplaces</h3>
              <p className="text-gray-400">
                Select where you want to publish your book
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={marketplaces.amazon_kdp}
                  onChange={(e) => setMarketplaces({ ...marketplaces, amazon_kdp: e.target.checked })}
                  className="w-5 h-5 rounded border-white/20"
                />
                <div className="flex-1">
                  <div className="font-semibold flex items-center gap-2">
                    Amazon Kindle Direct Publishing (KDP)
                    {validationData?.ready_for_kdp && (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Reach millions of Kindle readers worldwide
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={marketplaces.apple_books}
                  onChange={(e) => setMarketplaces({ ...marketplaces, apple_books: e.target.checked })}
                  className="w-5 h-5 rounded border-white/20"
                />
                <div className="flex-1">
                  <div className="font-semibold flex items-center gap-2">
                    Apple Books
                    {validationData?.ready_for_apple && (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Distribute to Apple Books on iOS and macOS
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={marketplaces.google_play}
                  onChange={(e) => setMarketplaces({ ...marketplaces, google_play: e.target.checked })}
                  className="w-5 h-5 rounded border-white/20"
                />
                <div className="flex-1">
                  <div className="font-semibold flex items-center gap-2">
                    Google Play Books
                    {validationData?.ready_for_google && (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Reach Android users through Google Play
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer transition-all opacity-50">
                <input
                  type="checkbox"
                  checked={marketplaces.kobo}
                  onChange={(e) => setMarketplaces({ ...marketplaces, kobo: e.target.checked })}
                  className="w-5 h-5 rounded border-white/20"
                  disabled
                />
                <div className="flex-1">
                  <div className="font-semibold">Kobo Writing Life</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Coming soon
                  </div>
                </div>
              </label>
            </div>
          </div>
        );

      case 'publish':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold mb-2">Ready to Publish!</h3>
              <p className="text-gray-400">
                Click "Publish Now" to download your EPUB and open marketplace upload pages
              </p>
            </div>

            {/* Summary */}
            <div className="space-y-4">
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="text-sm text-gray-400 mb-1">Book</div>
                <div className="font-semibold">{metadata.title}</div>
                {metadata.subtitle && (
                  <div className="text-sm text-gray-400">{metadata.subtitle}</div>
                )}
              </div>

              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="text-sm text-gray-400 mb-1">Author</div>
                <div className="font-semibold">{metadata.author}</div>
              </div>

              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="text-sm text-gray-400 mb-1">Price</div>
                <div className="font-semibold">
                  ${pricing.price} {pricing.currency}
                </div>
              </div>

              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="text-sm text-gray-400 mb-1">Publishing To</div>
                <div className="space-y-1 mt-2">
                  {marketplaces.amazon_kdp && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span className="text-sm">Amazon KDP</span>
                    </div>
                  )}
                  {marketplaces.apple_books && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span className="text-sm">Apple Books</span>
                    </div>
                  )}
                  {marketplaces.google_play && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span className="text-sm">Google Play Books</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Instructions */}
            {!isPublishing && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Book className="w-5 h-5 text-blue-400" />
                  What happens next:
                </h4>
                <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
                  <li>Your EPUB file will download automatically</li>
                  <li>Marketplace upload pages will open in new tabs</li>
                  <li>Upload your EPUB file to each marketplace</li>
                  <li>Fill in the metadata (title, author, price, description)</li>
                  <li>Submit for review (usually takes 24-72 hours)</li>
                </ol>
              </div>
            )}

            {isPublishing && (
              <div className="text-center py-8">
                <Loader2 className="w-12 h-12 animate-spin text-purple-400 mx-auto mb-4" />
                <p className="text-gray-400">Exporting your book...</p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a1625] rounded-2xl p-8 max-w-3xl w-full border border-white/10 my-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">Publish Your Book</h2>
            <p className="text-gray-400">{bookTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = index < currentStepIndex;

              return (
                <div key={step.id} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                        isActive
                          ? 'border-purple-500 bg-purple-500/20 text-purple-400'
                          : isCompleted
                          ? 'border-green-500 bg-green-500/20 text-green-400'
                          : 'border-white/20 bg-white/5 text-gray-500'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <div
                      className={`text-xs mt-2 font-medium ${
                        isActive ? 'text-purple-400' : isCompleted ? 'text-green-400' : 'text-gray-500'
                      }`}
                    >
                      {step.label}
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 ${
                        isCompleted ? 'bg-green-500' : 'bg-white/10'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="mb-8">{renderStepContent()}</div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStepIndex === 0}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {currentStep !== 'publish' ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold text-lg"
            >
              <Rocket className="w-5 h-5" />
              Publish Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
