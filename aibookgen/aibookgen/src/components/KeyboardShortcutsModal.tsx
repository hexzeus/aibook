import { X, Keyboard } from 'lucide-react';

interface ShortcutGroup {
  category: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
  }>;
}

const shortcutGroups: ShortcutGroup[] = [
  {
    category: 'General',
    shortcuts: [
      { keys: ['Ctrl', 'N'], description: 'Create new book' },
      { keys: ['Ctrl', 'K'], description: 'Search books' },
      { keys: ['?'], description: 'Show this help' },
      { keys: ['Esc'], description: 'Close modal' },
    ],
  },
  {
    category: 'Editor',
    shortcuts: [
      { keys: ['Ctrl', 'S'], description: 'Save page edits' },
      { keys: ['←'], description: 'Previous page' },
      { keys: ['→'], description: 'Next page' },
      { keys: ['E'], description: 'Edit current page' },
    ],
  },
  {
    category: 'Navigation',
    shortcuts: [
      { keys: ['G', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'L'], description: 'Go to Library' },
      { keys: ['G', 'C'], description: 'Go to Credits' },
      { keys: ['G', 'S'], description: 'Go to Settings' },
    ],
  },
];

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative card max-w-2xl w-full animate-scale-in max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6 sticky top-0 bg-inherit pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-brand-500 to-accent-purple p-2 rounded-xl">
              <Keyboard className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-display font-bold">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {shortcutGroups.map((group) => (
            <div key={group.category}>
              <h3 className="text-lg font-semibold mb-3 text-brand-400">{group.category}</h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
                  >
                    <span className="text-gray-300">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <span key={keyIdx} className="flex items-center gap-1">
                          <kbd className="px-2 py-1 text-xs font-semibold bg-slate-800 border border-white/20 rounded shadow-sm min-w-[2rem] text-center">
                            {key}
                          </kbd>
                          {keyIdx < shortcut.keys.length - 1 && (
                            <span className="text-gray-500 text-xs">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-white/10 text-sm text-gray-400 text-center">
          Press <kbd className="px-2 py-1 bg-slate-800 border border-white/20 rounded">?</kbd> anytime to view shortcuts
        </div>
      </div>
    </div>
  );
}
