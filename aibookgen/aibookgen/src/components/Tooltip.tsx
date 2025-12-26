import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export default function Tooltip({ content, children, position = 'top', delay = 500 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const tooltipOffset = 8;

        let top = 0;
        let left = 0;

        switch (position) {
          case 'top':
            top = rect.top - tooltipOffset;
            left = rect.left + rect.width / 2;
            break;
          case 'bottom':
            top = rect.bottom + tooltipOffset;
            left = rect.left + rect.width / 2;
            break;
          case 'left':
            top = rect.top + rect.height / 2;
            left = rect.left - tooltipOffset;
            break;
          case 'right':
            top = rect.top + rect.height / 2;
            left = rect.right + tooltipOffset;
            break;
        }

        setCoords({ top, left });
        setIsVisible(true);
      }
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const child = React.cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: showTooltip,
    onMouseLeave: hideTooltip,
    onFocus: showTooltip,
    onBlur: hideTooltip,
  });

  return (
    <>
      {child}
      {isVisible &&
        createPortal(
          <div
            className="fixed z-[9999] px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg shadow-lg border border-white/10 pointer-events-none animate-fade-in"
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform:
                position === 'top'
                  ? 'translate(-50%, -100%)'
                  : position === 'bottom'
                  ? 'translate(-50%, 0%)'
                  : position === 'left'
                  ? 'translate(-100%, -50%)'
                  : 'translate(0%, -50%)',
            }}
          >
            {content}
            <div
              className="absolute w-2 h-2 bg-gray-900 border border-white/10 transform rotate-45"
              style={{
                [position === 'top' ? 'bottom' : position === 'bottom' ? 'top' : position === 'left' ? 'right' : 'left']:
                  '-4px',
                ...(position === 'top' || position === 'bottom'
                  ? { left: '50%', transform: 'translateX(-50%) rotate(45deg)' }
                  : { top: '50%', transform: 'translateY(-50%) rotate(45deg)' }),
              }}
            />
          </div>,
          document.body
        )}
    </>
  );
}
