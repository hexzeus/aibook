import { useState, useEffect } from 'react';
import { X, Plus, Trash2, GripVertical, Save, Sparkles, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';

interface ChapterOutlineEditorProps {
  onClose: () => void;
  onSave: (structure: BookStructure) => void;
  currentStructure: BookStructure;
  loading?: boolean;
}

export interface BookStructure {
  title: string;
  subtitle?: string;
  target_pages: number;
  outline: PageOutline[];
  themes?: string[];
  tone?: string;
  target_audience?: string;
  unique_angle?: string;
}

interface PageOutline {
  page_number: number;
  section: string;
  content_brief: string;
  chapter_number?: number;
  scene_notes?: string;
  pacing?: 'slow' | 'medium' | 'fast';
  emotional_beat?: string;
}

export default function ChapterOutlineEditor({ onClose, onSave, currentStructure, loading }: ChapterOutlineEditorProps) {
  const [structure, setStructure] = useState<BookStructure>(currentStructure);
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set([1]));
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Group pages by chapter
  const getChapters = () => {
    const chapters: { [key: number]: PageOutline[] } = {};

    structure.outline.forEach(page => {
      const chapterNum = page.chapter_number || 1;
      if (!chapters[chapterNum]) {
        chapters[chapterNum] = [];
      }
      chapters[chapterNum].push(page);
    });

    return Object.entries(chapters).map(([num, pages]) => ({
      number: parseInt(num),
      pages
    })).sort((a, b) => a.number - b.number);
  };

  const chapters = getChapters();

  const toggleChapter = (chapterNum: number) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(chapterNum)) {
      newExpanded.delete(chapterNum);
    } else {
      newExpanded.add(chapterNum);
    }
    setExpandedChapters(newExpanded);
  };

  const updatePage = (pageIndex: number, field: keyof PageOutline, value: any) => {
    const newOutline = [...structure.outline];
    newOutline[pageIndex] = {
      ...newOutline[pageIndex],
      [field]: value
    };
    setStructure({ ...structure, outline: newOutline });
  };

  const addPage = (afterIndex: number) => {
    const newOutline = [...structure.outline];
    const newPage: PageOutline = {
      page_number: afterIndex + 2,
      section: `Page ${afterIndex + 2}`,
      content_brief: 'New page content',
      chapter_number: newOutline[afterIndex]?.chapter_number || 1,
      pacing: 'medium'
    };

    // Insert after the specified index
    newOutline.splice(afterIndex + 1, 0, newPage);

    // Renumber all subsequent pages
    for (let i = afterIndex + 2; i < newOutline.length; i++) {
      newOutline[i].page_number = i + 1;
    }

    setStructure({ ...structure, outline: newOutline, target_pages: newOutline.length });
  };

  const deletePage = (pageIndex: number) => {
    if (structure.outline.length <= 1) {
      alert('Cannot delete the only page');
      return;
    }

    const newOutline = structure.outline.filter((_, i) => i !== pageIndex);

    // Renumber all pages
    newOutline.forEach((page, i) => {
      page.page_number = i + 1;
    });

    setStructure({ ...structure, outline: newOutline, target_pages: newOutline.length });
  };

  const addChapter = () => {
    const maxChapter = Math.max(...structure.outline.map(p => p.chapter_number || 1), 0);
    const newChapter = maxChapter + 1;
    const lastPageNum = structure.outline.length;

    const newPage: PageOutline = {
      page_number: lastPageNum + 1,
      section: `Chapter ${newChapter}`,
      content_brief: 'New chapter content',
      chapter_number: newChapter,
      pacing: 'medium'
    };

    setStructure({
      ...structure,
      outline: [...structure.outline, newPage],
      target_pages: lastPageNum + 1
    });

    // Expand the new chapter
    setExpandedChapters(new Set([...expandedChapters, newChapter]));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === index) return;

    const newOutline = [...structure.outline];
    const draggedItem = newOutline[draggedIndex];

    // Remove from old position
    newOutline.splice(draggedIndex, 1);

    // Insert at new position
    newOutline.splice(index, 0, draggedItem);

    // Renumber all pages
    newOutline.forEach((page, i) => {
      page.page_number = i + 1;
    });

    setStructure({ ...structure, outline: newOutline });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = () => {
    onSave(structure);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto overscroll-contain">
      <div className="glass-morphism rounded-2xl max-w-6xl w-full p-4 sm:p-6 md:p-8 animate-slide-up my-auto max-h-[90vh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-500/20 rounded-xl">
              <BookOpen className="w-6 h-6 text-brand-400" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold">Chapter Outline Editor</h2>
              <p className="text-sm text-gray-400 mt-1">Organize your book into chapters and scenes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Book Metadata */}
        <div className="glass-morphism rounded-xl p-4 mb-6 bg-white/5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Book Title</label>
              <input
                type="text"
                value={structure.title}
                onChange={(e) => setStructure({ ...structure, title: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Total Pages</label>
              <div className="input-field bg-white/5">
                {structure.outline.length}
              </div>
            </div>
          </div>
        </div>

        {/* Chapter List */}
        <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
          {chapters.map(chapter => (
            <div key={chapter.number} className="glass-morphism rounded-xl p-4 bg-white/5">
              <button
                onClick={() => toggleChapter(chapter.number)}
                className="w-full flex items-center justify-between mb-3 hover:bg-white/5 p-2 rounded-lg transition-all"
              >
                <div className="flex items-center gap-2">
                  {expandedChapters.has(chapter.number) ? (
                    <ChevronDown className="w-5 h-5 text-brand-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="font-semibold text-lg">Chapter {chapter.number}</span>
                  <span className="text-sm text-gray-400">({chapter.pages.length} pages)</span>
                </div>
              </button>

              {expandedChapters.has(chapter.number) && (
                <div className="space-y-2">
                  {chapter.pages.map((page, localIndex) => {
                    const globalIndex = structure.outline.findIndex(p => p === page);
                    return (
                      <div
                        key={globalIndex}
                        draggable
                        onDragStart={() => handleDragStart(globalIndex)}
                        onDragOver={(e) => handleDragOver(e, globalIndex)}
                        onDragEnd={handleDragEnd}
                        className={`p-3 rounded-lg border-2 transition-all cursor-move ${
                          draggedIndex === globalIndex
                            ? 'border-brand-500 bg-brand-500/10 opacity-50'
                            : 'border-white/10 bg-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <GripVertical className="w-5 h-5 text-gray-500 flex-shrink-0 mt-1" />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-400">Page {page.page_number}</span>
                              <input
                                type="text"
                                value={page.section}
                                onChange={(e) => updatePage(globalIndex, 'section', e.target.value)}
                                className="input-field text-sm flex-1"
                                placeholder="Section name..."
                              />
                            </div>

                            <textarea
                              value={page.content_brief}
                              onChange={(e) => updatePage(globalIndex, 'content_brief', e.target.value)}
                              className="input-field text-sm min-h-16 resize-none"
                              placeholder="What happens on this page..."
                            />

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Pacing</label>
                                <select
                                  value={page.pacing || 'medium'}
                                  onChange={(e) => updatePage(globalIndex, 'pacing', e.target.value)}
                                  className="input-field text-sm"
                                >
                                  <option value="slow">Slow</option>
                                  <option value="medium">Medium</option>
                                  <option value="fast">Fast</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Emotional Beat</label>
                                <input
                                  type="text"
                                  value={page.emotional_beat || ''}
                                  onChange={(e) => updatePage(globalIndex, 'emotional_beat', e.target.value)}
                                  className="input-field text-sm"
                                  placeholder="e.g., suspense, joy..."
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => addPage(globalIndex)}
                              className="p-1 hover:bg-green-500/20 rounded text-green-400"
                              title="Add page after this"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deletePage(globalIndex)}
                              className="p-1 hover:bg-red-500/20 rounded text-red-400"
                              title="Delete this page"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Chapter Button */}
        <button
          onClick={addChapter}
          className="btn-secondary w-full mb-6 flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add New Chapter
        </button>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Save className="w-5 h-5" />
                Save Structure
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
