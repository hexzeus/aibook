import { useState } from 'react';
import { X, Download, FileText, Book, Settings } from 'lucide-react';

interface ExportOptionsModalProps {
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  bookId: string;
  bookTitle: string;
  loading?: boolean;
}

export interface ExportOptions {
  book_id: string;
  book_size: string;
  margin_preset: string;
  font_family?: string;
  font_size?: number;
  include_toc: boolean;
  include_copyright: boolean;
}

const BOOK_SIZES = [
  { value: '6x9', label: '6" × 9"', desc: 'Most common trade paperback', recommended: true },
  { value: '5.5x8.5', label: '5.5" × 8.5"', desc: 'Digest size' },
  { value: '5x8', label: '5" × 8"', desc: 'Popular fiction' },
  { value: '5.25x8', label: '5.25" × 8"', desc: 'Standard fiction' },
  { value: '8.5x11', label: '8.5" × 11"', desc: 'Textbook/manual' },
  { value: 'a5', label: 'A5', desc: 'International standard (5.83" × 8.27")' }
];

const MARGIN_PRESETS = [
  { value: 'standard', label: 'Standard', desc: 'Balanced margins for most books', recommended: true },
  { value: 'generous', label: 'Generous', desc: 'Extra white space, premium feel' },
  { value: 'tight', label: 'Tight', desc: 'More content per page' }
];

const FONT_FAMILIES = [
  { value: 'Times', label: 'Times New Roman', desc: 'Classic serif, highly readable' },
  { value: 'Garamond', label: 'Garamond', desc: 'Elegant serif for literature' },
  { value: 'Georgia', label: 'Georgia', desc: 'Modern serif, web-friendly' },
  { value: 'Palatino', label: 'Palatino', desc: 'Renaissance-style serif' }
];

export default function ExportOptionsModal({
  onClose,
  onExport,
  bookId,
  bookTitle,
  loading
}: ExportOptionsModalProps) {
  const [bookSize, setBookSize] = useState('6x9');
  const [marginPreset, setMarginPreset] = useState('standard');
  const [fontFamily, setFontFamily] = useState('Times');
  const [fontSize, setFontSize] = useState(11);
  const [includeToc, setIncludeToc] = useState(true);
  const [includeCopyright, setIncludeCopyright] = useState(true);

  const handleExport = () => {
    onExport({
      book_id: bookId,
      book_size: bookSize,
      margin_preset: marginPreset,
      font_family: fontFamily,
      font_size: fontSize,
      include_toc: includeToc,
      include_copyright: includeCopyright
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto overscroll-contain">
      <div className="glass-morphism rounded-2xl max-w-4xl w-full p-4 sm:p-6 md:p-8 animate-slide-up my-auto max-h-[90vh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-500/20 rounded-xl">
              <Book className="w-6 h-6 text-brand-400" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold">Print-Ready PDF Export</h2>
              <p className="text-sm text-gray-400 mt-1">Configure professional print settings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Book Size */}
          <div className="glass-morphism rounded-xl p-6 bg-white/5">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-400" />
              Book Size
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {BOOK_SIZES.map(size => (
                <button
                  key={size.value}
                  onClick={() => setBookSize(size.value)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    bookSize === size.value
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-white/10 hover:border-white/20 bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{size.label}</span>
                    {size.recommended && (
                      <span className="text-xs bg-brand-500/20 text-brand-400 px-2 py-1 rounded-full">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">{size.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Margins */}
          <div className="glass-morphism rounded-xl p-6 bg-white/5">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-brand-400" />
              Margins
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {MARGIN_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => setMarginPreset(preset.value)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    marginPreset === preset.value
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-white/10 hover:border-white/20 bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{preset.label}</span>
                    {preset.recommended && (
                      <span className="text-xs bg-brand-500/20 text-brand-400 px-2 py-1 rounded-full">
                        ⭐
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">{preset.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Typography */}
          <div className="glass-morphism rounded-xl p-6 bg-white/5">
            <h3 className="text-lg font-semibold mb-4">Typography</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Font Family
                </label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="input-field"
                >
                  {FONT_FAMILIES.map(font => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {FONT_FAMILIES.find(f => f.value === fontFamily)?.desc}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Font Size: {fontSize}pt
                </label>
                <input
                  type="range"
                  min="9"
                  max="14"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>9pt (Small)</span>
                  <span>14pt (Large)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Options */}
          <div className="glass-morphism rounded-xl p-6 bg-white/5">
            <h3 className="text-lg font-semibold mb-4">Additional Options</h3>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={includeToc}
                  onChange={(e) => setIncludeToc(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-white/20 bg-white/5 checked:bg-brand-500 checked:border-brand-500 transition-all"
                />
                <div className="flex-1">
                  <div className="font-medium group-hover:text-brand-400 transition-colors">
                    Include Table of Contents
                  </div>
                  <div className="text-xs text-gray-400">
                    Automatically generated from chapter headings
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={includeCopyright}
                  onChange={(e) => setIncludeCopyright(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-white/20 bg-white/5 checked:bg-brand-500 checked:border-brand-500 transition-all"
                />
                <div className="flex-1">
                  <div className="font-medium group-hover:text-brand-400 transition-colors">
                    Include Copyright Page
                  </div>
                  <div className="text-xs text-gray-400">
                    Standard copyright notice and legal text
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Preview Info */}
          <div className="glass-morphism rounded-xl p-4 bg-brand-500/5 border border-brand-500/20">
            <div className="flex items-start gap-3">
              <Book className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <div className="font-semibold mb-1 text-brand-400">Export Summary</div>
                <div className="text-gray-300 space-y-1">
                  <div>• Book: <strong>{bookTitle}</strong></div>
                  <div>• Size: <strong>{BOOK_SIZES.find(s => s.value === bookSize)?.label}</strong></div>
                  <div>• Margins: <strong>{MARGIN_PRESETS.find(m => m.value === marginPreset)?.label}</strong></div>
                  <div>• Font: <strong>{fontFamily} {fontSize}pt</strong></div>
                  <div className="pt-2 border-t border-white/10 mt-2 text-brand-400 font-semibold">
                    Cost: 1 credit
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={loading}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating PDF...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Download className="w-5 h-5" />
                  Export Print PDF
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
