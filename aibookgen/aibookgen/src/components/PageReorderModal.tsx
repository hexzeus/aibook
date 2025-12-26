import { useState } from 'react';
import { X, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import type { Page } from '../lib/api';

interface PageReorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  pages: Page[];
  onReorder: (newOrder: string[]) => void;
  isSaving: boolean;
}

export default function PageReorderModal({ isOpen, onClose, pages, onReorder, isSaving }: PageReorderModalProps) {
  const [orderedPages, setOrderedPages] = useState(pages);

  if (!isOpen) return null;

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...orderedPages];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setOrderedPages(newOrder);
  };

  const moveDown = (index: number) => {
    if (index === orderedPages.length - 1) return;
    const newOrder = [...orderedPages];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setOrderedPages(newOrder);
  };

  const handleSave = () => {
    const pageOrder = orderedPages.map(p => p.page_id);
    onReorder(pageOrder);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative card max-w-3xl w-full animate-scale-in max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6 sticky top-0 bg-inherit pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-brand-500 to-accent-purple p-2 rounded-xl">
              <GripVertical className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-display font-bold">Reorder Pages</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 mb-6">
          {orderedPages.map((page, index) => (
            <div
              key={page.page_id}
              className="flex items-center gap-3 p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
            >
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => moveUp(index)}
                  disabled={index === 0 || isSaving}
                  className="p-1 hover:bg-brand-500/20 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveDown(index)}
                  disabled={index === orderedPages.length - 1 || isSaving}
                  className="p-1 hover:bg-brand-500/20 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1">
                <div className="font-semibold mb-1">
                  Page {index + 1} {page.is_title_page && '(Title Page)'}
                </div>
                <div className="text-sm text-gray-400 line-clamp-2">
                  {page.section || 'No section'}
                </div>
              </div>

              <div className="text-gray-500 font-mono text-sm">
                #{index + 1}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary"
          >
            {isSaving ? 'Saving...' : 'Save Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
