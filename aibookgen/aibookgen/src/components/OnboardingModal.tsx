import { useState } from 'react';
import { X, BookOpen, Sparkles, Download, TrendingUp, ChevronRight, ChevronLeft, Check } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const onboardingSteps = [
  {
    icon: BookOpen,
    title: 'Welcome to Chaptera!',
    description: 'Transform your ideas into published books with the power of AI. Let\'s get you started with a quick tour.',
    image: '📚',
  },
  {
    icon: Sparkles,
    title: 'Create Your First Book',
    description: 'Click "Create Book" on the dashboard, describe your book idea, and let AI generate a complete structure and content for you.',
    image: '✨',
  },
  {
    icon: TrendingUp,
    title: 'Credits System',
    description: 'You start with 1000 free credits. Creating a book costs 50 credits, each page costs 5 credits, and exports cost 1 credit.',
    image: '💎',
  },
  {
    icon: Download,
    title: 'Export Your Books',
    description: 'Once your book is complete, export it as EPUB, PDF, or DOCX format. Perfect for publishing or sharing!',
    image: '📥',
  },
];

export default function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const step = onboardingSteps[currentStep];
  const Icon = step.icon;
  const isLastStep = currentStep === onboardingSteps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onClose();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={handleSkip}
      />
      <div className="relative card max-w-2xl w-full animate-scale-in">
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-8">
          <div className="text-6xl mb-4">{step.image}</div>
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="bg-gradient-to-br from-brand-500 to-accent-purple p-3 rounded-xl">
              <Icon className="w-8 h-8" />
            </div>
          </div>
          <h2 className="text-3xl font-display font-bold mb-3">{step.title}</h2>
          <p className="text-gray-300 text-lg max-w-lg mx-auto">
            {step.description}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {onboardingSteps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentStep
                  ? 'w-8 bg-brand-400'
                  : index < currentStep
                  ? 'w-2 bg-accent-green'
                  : 'w-2 bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={handleSkip}
            className="text-gray-400 hover:text-white transition-colors"
          >
            Skip tour
          </button>

          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="btn-secondary flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
            )}
            <button
              onClick={handleNext}
              className="btn-primary flex items-center gap-2"
            >
              {isLastStep ? (
                <>
                  <Check className="w-4 h-4" />
                  Get Started
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
