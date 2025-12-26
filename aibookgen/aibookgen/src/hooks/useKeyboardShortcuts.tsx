import { useEffect } from 'react';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      shortcuts.forEach((shortcut) => {
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          e.preventDefault();
          shortcut.action();
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}

export const COMMON_SHORTCUTS = {
  NEW_BOOK: { key: 'n', ctrl: true, description: 'Create new book' },
  SAVE: { key: 's', ctrl: true, description: 'Save current changes' },
  SEARCH: { key: 'k', ctrl: true, description: 'Search books' },
  HELP: { key: '?', shift: true, description: 'Show keyboard shortcuts' },
  CLOSE: { key: 'Escape', description: 'Close modal/dialog' },
  NEXT_PAGE: { key: 'ArrowRight', description: 'Next page' },
  PREV_PAGE: { key: 'ArrowLeft', description: 'Previous page' },
};
