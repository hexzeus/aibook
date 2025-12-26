import { useState } from 'react';
import { X, Download, FileText, Loader2, Sparkles } from 'lucide-react';

interface BulkExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (formats: string[]) => void;
  isExporting: boolean;
  bookTitle: string;
}

const FORMATS = [
  { id: 'epub', label: 'EPUB', description: 'E-reader compatible format', icon: '📖' },
  { id: 'pdf', label: 'PDF', description: 'Portable document format', icon: '📄' },
  { id: 'docx', label: 'DOCX', description: 'Microsoft Word format', icon: '📝' },
  { id: 'txt', label: 'TXT', description: 'Plain text format', icon: '📃' },
];

export default function BulkExportModal({
  isOpen,
  onClose,
  onExport,
  isExporting,
  bookTitle
}: BulkExportModalProps) {
  const [selectedFormats, setSelectedFormats] = useState<string[]>(['epub']);

  if (!isOpen) return null;

  const toggleFormat = (formatId: string) => {
    if (selectedFormats.includes(formatId)) {
      setSelectedFormats(selectedFormats.filter(f => f !== formatId));
    } else {
      setSelectedFormats([...selectedFormats, formatId]);
    }
  };

  const handleExport = () => {
    if (selectedFormats.length === 0) return;
    onExport(selectedFormats);
  };

  const creditCost = selectedFormats.length * 5; // 5 credits per format

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative card max-w-2xl w-full animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-brand-500 to-accent-purple p-2 rounded-xl">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold">Bulk Export</h2>
              <p className="text-sm text-gray-400">Export to multiple formats at once</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
            disabled={isExporting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-brand-400" />
            <h3 className="font-semibold">Select Export Formats</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FORMATS.map((format) => (
              <button
                key={format.id}
                onClick={() => toggleFormat(format.id)}
                disabled={isExporting}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  selectedFormats.includes(format.id)
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                } ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{format.icon}</span>
                  <div>
                    <div className="font-semibold">{format.label}</div>
                    <div className="text-xs text-gray-400">{format.description}</div>
                  </div>
                </div>
                {selectedFormats.includes(format.id) && (
                  <div className="flex items-center gap-1 text-xs text-brand-400 mt-2">
                    <Sparkles className="w-3 h-3" />
                    Selected
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-r from-brand-500/10 to-accent-purple/10 border border-brand-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Total Cost:</span>
            <span className="text-xl font-bold text-brand-400">{creditCost} credits</span>
          </div>
          <div className="text-xs text-gray-400">
            {selectedFormats.length} format{selectedFormats.length !== 1 ? 's' : ''} × 5 credits each
          </div>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-6">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-yellow-400 mt-0.5" />
            <div className="text-xs text-yellow-200">
              <strong>Premium Feature:</strong> Bulk export saves time by generating multiple
              formats in one go. Each format is professionally formatted and optimized.
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || selectedFormats.length === 0}
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
                Export {selectedFormats.length} Format{selectedFormats.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
