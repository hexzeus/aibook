import { useState, useEffect } from 'react';
import { X, Sparkles, Wand2, BookOpen, FileText } from 'lucide-react';

interface StyleConfigModalProps {
  onClose: () => void;
  onApply: (styleProfile: StyleProfile) => void;
  currentProfile?: StyleProfile | null;
  loading?: boolean;
}

export interface StyleProfile {
  author_preset?: string;
  tone?: string;
  vocabulary_level?: string;
  sentence_style?: string;
  sample_text?: string;
  analyzed_patterns?: any;
  characteristics?: string;
}

interface AuthorPreset {
  name: string;
  tone: string;
  vocabulary_level: string;
  sentence_style: string;
  characteristics: string;
}

const AUTHOR_PRESETS: Record<string, AuthorPreset> = {
  stephen_king: {
    name: 'Stephen King',
    tone: 'conversational, suspenseful, direct',
    vocabulary_level: 'accessible',
    sentence_style: 'varied, punchy dialogue, immersive descriptions',
    characteristics: 'Strong character voice, builds tension gradually, colloquial language, present-tense urgency'
  },
  hemingway: {
    name: 'Ernest Hemingway',
    tone: 'sparse, direct, understated',
    vocabulary_level: 'simple',
    sentence_style: 'short, declarative, minimal adjectives',
    characteristics: 'Iceberg theory, show don\'t tell, masculine prose, minimal description'
  },
  jk_rowling: {
    name: 'J.K. Rowling',
    tone: 'whimsical, adventurous, heartfelt',
    vocabulary_level: 'accessible, rich',
    sentence_style: 'flowing, descriptive, dialogue-driven',
    characteristics: 'World-building through details, character-driven plots, emotional depth, accessible magic systems'
  },
  malcolm_gladwell: {
    name: 'Malcolm Gladwell',
    tone: 'curious, analytical, storytelling',
    vocabulary_level: 'sophisticated accessible',
    sentence_style: 'narrative-driven, research-backed',
    characteristics: 'Counterintuitive insights, story + data fusion, conversational expertise, "aha" moments'
  },
  jane_austen: {
    name: 'Jane Austen',
    tone: 'witty, satirical, romantic',
    vocabulary_level: 'refined, period-appropriate',
    sentence_style: 'elegant, balanced, ironic',
    characteristics: 'Social commentary through character, ironic narrator, dialogue reveals personality, emotional restraint'
  },
  neil_gaiman: {
    name: 'Neil Gaiman',
    tone: 'mythic, dark, enchanting',
    vocabulary_level: 'lyrical, accessible',
    sentence_style: 'poetic, varied rhythm',
    characteristics: 'Mythology meets modern, fairy-tale darkness, layered symbolism, beautiful prose'
  },
  nora_roberts: {
    name: 'Nora Roberts',
    tone: 'romantic, dramatic, engaging',
    vocabulary_level: 'accessible, emotional',
    sentence_style: 'fast-paced, dialogue-heavy',
    characteristics: 'Strong female leads, romantic tension, page-turning plots, emotional authenticity'
  },
  james_patterson: {
    name: 'James Patterson',
    tone: 'fast-paced, thriller-oriented',
    vocabulary_level: 'simple, direct',
    sentence_style: 'ultra-short chapters, cliffhangers',
    characteristics: 'Relentless pacing, short punchy sentences, constant action, "just one more chapter" hooks'
  }
};

const TONE_OPTIONS = [
  'formal', 'casual', 'conversational', 'academic', 'poetic',
  'humorous', 'serious', 'playful', 'dramatic', 'inspirational'
];

const VOCABULARY_LEVELS = [
  { id: 'grade_6_8', label: 'Grade 6-8 (Accessible)', description: 'Simple, clear language' },
  { id: 'grade_9_12', label: 'Grade 9-12 (Standard)', description: 'General audience' },
  { id: 'college', label: 'College Level', description: 'Sophisticated vocabulary' },
  { id: 'academic', label: 'Academic/Expert', description: 'Technical terminology' }
];

const SENTENCE_STYLES = [
  { id: 'short_punchy', label: 'Short & Punchy', description: 'Brief, impactful sentences' },
  { id: 'medium_balanced', label: 'Medium & Balanced', description: 'Varied, natural rhythm' },
  { id: 'long_flowing', label: 'Long & Flowing', description: 'Literary, complex structures' },
  { id: 'varied_dynamic', label: 'Varied & Dynamic', description: 'Mix of all lengths' }
];

export default function StyleConfigModal({ onClose, onApply, currentProfile, loading }: StyleConfigModalProps) {
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(currentProfile?.author_preset || null);
  const [customTone, setCustomTone] = useState(currentProfile?.tone || '');
  const [customVocabulary, setCustomVocabulary] = useState(currentProfile?.vocabulary_level || 'grade_9_12');
  const [customSentenceStyle, setCustomSentenceStyle] = useState(currentProfile?.sentence_style || 'medium_balanced');
  const [sampleText, setSampleText] = useState(currentProfile?.sample_text || '');
  const [analyzing, setAnalyzing] = useState(false);

  const handleApply = () => {
    let profile: StyleProfile;

    if (activeTab === 'presets' && selectedPreset) {
      const preset = AUTHOR_PRESETS[selectedPreset];
      profile = {
        author_preset: selectedPreset,
        tone: preset.tone,
        vocabulary_level: preset.vocabulary_level,
        sentence_style: preset.sentence_style,
        characteristics: preset.characteristics
      };
    } else {
      profile = {
        tone: customTone,
        vocabulary_level: customVocabulary,
        sentence_style: customSentenceStyle,
        sample_text: sampleText || undefined
      };
    }

    onApply(profile);
  };

  const handleAnalyzeSample = async () => {
    if (!sampleText || sampleText.length < 100) {
      alert('Please provide at least 100 characters of sample text');
      return;
    }

    setAnalyzing(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://aibook-9rbb.onrender.com';
      const response = await fetch(`${API_BASE_URL}/api/style/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('license_key')}`
        },
        body: JSON.stringify({ sample_text: sampleText })
      });

      if (!response.ok) throw new Error('Analysis failed');

      const data = await response.json();
      const analysis = data.analysis;

      // Update custom fields with analyzed values
      setCustomTone(analysis.tone || customTone);
      setCustomVocabulary(analysis.vocabulary_level || customVocabulary);
      setCustomSentenceStyle(analysis.sentence_style || customSentenceStyle);
    } catch (error) {
      console.error('Style analysis error:', error);
      alert('Failed to analyze style. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const isValid = () => {
    if (activeTab === 'presets') {
      return selectedPreset !== null;
    } else {
      return customTone.trim().length > 0;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto overscroll-contain">
      <div className="glass-morphism rounded-2xl max-w-4xl w-full p-4 sm:p-6 md:p-8 animate-slide-up my-auto max-h-[90vh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-500/20 rounded-xl">
              <Wand2 className="w-6 h-6 text-brand-400" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold">Configure Writing Style</h2>
              <p className="text-sm text-gray-400 mt-1">Choose a famous author's style or create your own</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-2 mb-6 p-1 bg-white/5 rounded-lg">
          <button
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-2 px-4 rounded-md transition-all ${
              activeTab === 'presets'
                ? 'bg-brand-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <BookOpen className="w-4 h-4" />
              Famous Authors
            </div>
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 py-2 px-4 rounded-md transition-all ${
              activeTab === 'custom'
                ? 'bg-brand-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              Custom Style
            </div>
          </button>
        </div>

        {/* Presets Tab */}
        {activeTab === 'presets' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Select a famous author's writing style to emulate in your book
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
              {Object.entries(AUTHOR_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => setSelectedPreset(key)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    selectedPreset === key
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-white/10 hover:border-white/20 bg-white/5'
                  }`}
                >
                  <div className="font-semibold mb-2 text-lg">{preset.name}</div>
                  <div className="text-xs text-gray-400 mb-2">
                    <strong>Tone:</strong> {preset.tone}
                  </div>
                  <div className="text-xs text-gray-400 mb-2">
                    <strong>Style:</strong> {preset.sentence_style}
                  </div>
                  <div className="text-xs text-gray-300 italic">
                    {preset.characteristics}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom Tab */}
        {activeTab === 'custom' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Tone
              </label>
              <div className="flex flex-wrap gap-2">
                {TONE_OPTIONS.map((tone) => (
                  <button
                    key={tone}
                    onClick={() => setCustomTone(tone)}
                    className={`px-3 py-1 rounded-full text-sm transition-all ${
                      customTone === tone
                        ? 'bg-brand-500 text-white'
                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={customTone}
                onChange={(e) => setCustomTone(e.target.value)}
                placeholder="Or type custom tone..."
                className="input-field mt-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-3 text-gray-300">
                Vocabulary Level
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {VOCABULARY_LEVELS.map((level) => (
                  <button
                    key={level.id}
                    onClick={() => setCustomVocabulary(level.id)}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      customVocabulary === level.id
                        ? 'border-brand-500 bg-brand-500/10'
                        : 'border-white/10 hover:border-white/20 bg-white/5'
                    }`}
                  >
                    <div className="font-semibold mb-1">{level.label}</div>
                    <div className="text-xs text-gray-400">{level.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-3 text-gray-300">
                Sentence Style
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SENTENCE_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setCustomSentenceStyle(style.id)}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      customSentenceStyle === style.id
                        ? 'border-brand-500 bg-brand-500/10'
                        : 'border-white/10 hover:border-white/20 bg-white/5'
                    }`}
                  >
                    <div className="font-semibold mb-1">{style.label}</div>
                    <div className="text-xs text-gray-400">{style.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Sample Text (Optional)
              </label>
              <p className="text-xs text-gray-400 mb-2">
                Paste a sample of writing you want to emulate. Our AI will analyze it.
              </p>
              <textarea
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value)}
                placeholder="Paste sample text here (minimum 100 characters)..."
                className="input-field min-h-32 resize-none font-mono text-sm"
                maxLength={3000}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">{sampleText.length}/3000 characters</span>
                <button
                  onClick={handleAnalyzeSample}
                  disabled={analyzing || sampleText.length < 100}
                  className="btn-secondary text-sm py-1 px-3 disabled:opacity-50"
                >
                  {analyzing ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Analyze Style
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!isValid() || loading}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Applying...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <FileText className="w-5 h-5" />
                Apply Style
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
