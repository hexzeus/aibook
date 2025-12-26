import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Printer, FileText, Copy, Archive, Trash2, Download } from 'lucide-react';

interface QuickAction {
  label: string;
  icon: typeof Printer;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface QuickActionsMenuProps {
  actions: QuickAction[];
}

export default function QuickActionsMenu({ actions }: QuickActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-white/10 rounded-lg transition-all"
        title="More actions"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 glass-morphism rounded-xl border border-white/10 shadow-glow z-50 animate-scale-in">
          <div className="py-2">
            {actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={index}
                  onClick={() => {
                    action.onClick();
                    setIsOpen(false);
                  }}
                  disabled={action.disabled}
                  className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-left ${
                    action.variant === 'danger'
                      ? 'hover:bg-red-500/20 text-red-400'
                      : 'hover:bg-white/10 text-gray-300'
                  } ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Export common action configurations
export const createBookActions = {
  print: (onClick: () => void) => ({
    label: 'Print Book',
    icon: Printer,
    onClick,
  }),
  downloadHTML: (onClick: () => void) => ({
    label: 'Download as HTML',
    icon: FileText,
    onClick,
  }),
  duplicate: (onClick: () => void) => ({
    label: 'Duplicate Book',
    icon: Copy,
    onClick,
  }),
  archive: (onClick: () => void) => ({
    label: 'Archive Book',
    icon: Archive,
    onClick,
  }),
  delete: (onClick: () => void) => ({
    label: 'Delete Book',
    icon: Trash2,
    onClick,
    variant: 'danger' as const,
  }),
  export: (onClick: () => void) => ({
    label: 'Export Book',
    icon: Download,
    onClick,
  }),
};
