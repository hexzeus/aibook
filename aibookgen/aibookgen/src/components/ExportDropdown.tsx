import { useState } from 'react';
import { Download, Loader2, Check, Sparkles } from 'lucide-react';

interface ExportDropdownProps {
  bookId: string;
  bookTitle: string;
  isExporting: boolean;
  onExport: (format: 'epub' | 'pdf' | 'docx') => void;
  onBulkExport?: () => void;
}

export default function ExportDropdown({
  bookId,
  bookTitle,
  isExporting,
  onExport,
  onBulkExport
}: ExportDropdownProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'epub' | 'pdf' | 'docx'>('epub');

  const formats = [
    { value: 'epub' as const, label: 'EPUB', desc: 'E-reader format', emoji: '📖' },
    { value: 'pdf' as const, label: 'PDF', desc: 'Universal format', emoji: '📄' },
    { value: 'docx' as const, label: 'DOCX', desc: 'Editable document', emoji: '📝' },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setShowOptions(!showOptions)}
        disabled={isExporting}
        className="btn-primary flex items-center gap-2"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            Export Book
          </>
        )}
      </button>

      {showOptions && !isExporting && (
        <div className="absolute top-full right-0 mt-2 w-56 glass-morphism rounded-xl p-2 shadow-glow border border-white/10 z-50 animate-scale-in">
          <div className="text-xs text-gray-400 px-3 py-2 font-semibold uppercase tracking-wider">
            Quick Export
          </div>
          {formats.map((format) => (
            <button
              key={format.value}
              onClick={() => {
                setSelectedFormat(format.value);
                onExport(format.value);
                setShowOptions(false);
              }}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center justify-between ${
                selectedFormat === format.value
                  ? 'bg-brand-500/20 text-brand-400'
                  : 'hover:bg-white/5 text-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{format.emoji}</span>
                <div>
                  <div className="font-medium">{format.label}</div>
                  <div className="text-xs text-gray-500">{format.desc}</div>
                </div>
              </div>
              {selectedFormat === format.value && (
                <Check className="w-4 h-4 text-brand-400" />
              )}
            </button>
          ))}

          {onBulkExport && (
            <>
              <div className="border-t border-white/10 my-2"></div>
              <button
                onClick={() => {
                  setShowOptions(false);
                  onBulkExport();
                }}
                className="w-full text-left px-3 py-2.5 rounded-lg transition-all hover:bg-gradient-to-r hover:from-brand-500/20 hover:to-accent-purple/20 text-gray-300"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-brand-400" />
                  <div>
                    <div className="font-medium text-brand-400">Bulk Export</div>
                    <div className="text-xs text-gray-500">All formats at once</div>
                  </div>
                </div>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
