import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { cn } from '../../utils/cn';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerVariant?: 'default' | 'accent';
  children: ReactNode;
  footer?: ReactNode;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  headerVariant = 'default',
  children,
  footer,
}: DrawerProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (focusables[0] ?? panel).focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(focusTimer);
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div
        className="absolute inset-0 bg-[#0F1E3D]/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'absolute right-0 top-0 flex h-full w-full flex-col bg-surface-container-lowest shadow-drawer animate-slide-in-right',
          'sm:w-drawer-width sm:rounded-l-3xl',
        )}
      >
        <header
          className={cn(
            'flex shrink-0 items-start justify-between gap-3 border-b border-outline-variant px-5 py-4',
            headerVariant === 'accent' && 'bg-primary-container/40',
          )}
        >
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-headline-sm text-on-surface">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 truncate text-label-md text-on-surface-variant">{subtitle}</p>
            )}
          </div>
          <IconButton
            icon="close"
            size="sm"
            aria-label="Close drawer"
            onClick={onClose}
          />
        </header>

        <div className="flex-1 overflow-y-auto bg-background px-5 py-5">
          <div className="flex flex-col gap-6">{children}</div>
        </div>

        {footer && (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-outline-variant bg-surface-container-lowest px-5 py-4">
            {footer}
          </footer>
        )}
      </aside>
    </div>,
    document.body,
  );
}

export interface DrawerSectionProps {
  title: string;
  icon?: string;
  children: ReactNode;
}

export function DrawerSection({ title, icon, children }: DrawerSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-label-sm uppercase tracking-wider text-on-surface-variant">
        {icon && <Icon name={icon} size={16} />}
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}