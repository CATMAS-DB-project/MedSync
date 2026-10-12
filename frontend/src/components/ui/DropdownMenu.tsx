import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';
import { Icon } from './Icon';

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface DropdownMenuProps {
  trigger: ReactNode;
  items: DropdownMenuItem[];
  align?: 'left' | 'right';
  ariaLabel?: string;
  className?: string;
  menuClassName?: string;
}

export function DropdownMenu({
  trigger,
  items,
  align = 'right',
  ariaLabel = 'Open menu',
  className,
  menuClassName,
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useLayoutEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const panelWidth = panelRef.current?.offsetWidth ?? 200;
      const panelHeight = panelRef.current?.offsetHeight ?? 160;

      let top = rect.bottom + 6;
      if (top + panelHeight > window.innerHeight - 8 && rect.top - panelHeight - 6 > 8) {
        top = rect.top - panelHeight - 6;
      }

      let left = align === 'right' ? rect.right - panelWidth : rect.left;
      left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));

      setCoords({ top, left });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, align, items.length]);

  useEffect(() => {
    if (!isOpen) return;

    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const firstEnabled = items.findIndex((i) => !i.disabled);
      setActiveIndex(firstEnabled);
    } else {
      setActiveIndex(-1);
    }
  }, [isOpen, items]);

  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    const nodes = panelRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    nodes?.[activeIndex]?.focus();
  }, [isOpen, activeIndex]);

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      let next = activeIndex;
      for (let i = 0; i < items.length; i += 1) {
        next = (next + direction + items.length) % items.length;
        if (!items[next].disabled) break;
      }
      setActiveIndex(next);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(items.findIndex((i) => !i.disabled));
    } else if (event.key === 'End') {
      event.preventDefault();
      const reversed = [...items].reverse().findIndex((i) => !i.disabled);
      setActiveIndex(items.length - 1 - reversed);
    }
  };

  return (
    <div ref={containerRef} className={cn('relative inline-flex', className)}>
      <div
        role="presentation"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((v) => !v);
        }}
        className="inline-flex items-center rounded-xl"
      >
        {trigger}
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            id={menuId}
            role="menu"
            aria-label={ariaLabel}
            onKeyDown={handleMenuKeyDown}
            onClick={(event) => event.stopPropagation()}
            style={
              coords
                ? { top: `${coords.top}px`, left: `${coords.left}px` }
                : { top: '-9999px', left: '-9999px' }
            }
            className={cn(
              'fixed z-[90] min-w-[190px] overflow-hidden rounded-xl bg-surface-container-lowest p-1 shadow-popover',
              'border border-outline-variant animate-scale-in',
              menuClassName,
            )}
          >
            {items.map((item) => (
              <button
                key={item.id}
                role="menuitem"
                type="button"
                tabIndex={-1}
                disabled={item.disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  setIsOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-body-sm font-medium transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
                  item.danger
                    ? 'text-error hover:bg-error-container focus:bg-error-container'
                    : 'text-on-surface hover:bg-surface-container-high focus:bg-surface-container-high',
                  item.disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                {item.icon && <Icon name={item.icon} size={18} />}
                <span className="flex-1 truncate">{item.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}