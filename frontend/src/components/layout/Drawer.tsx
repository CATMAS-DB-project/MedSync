import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Drawer({ isOpen, onClose, title, subtitle, children, footer }: DrawerProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const trapRef = useRef<((event: KeyboardEvent) => void) | null>(null);
  const titleId = useRef(makeId('drawer-title'));

  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    const handleFocus = () => {
      const panel = dialogRef.current;
      if (!panel) return;

      const focusables = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) {
        panel.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (document.activeElement && !panel.contains(document.activeElement)) {
        first.focus();
      }

      const trap = (event: KeyboardEvent) => {
        if (event.key !== 'Tab' || !panel.contains(document.activeElement)) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };

      trapRef.current = trap;
      document.addEventListener('keydown', trap);
    };

    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => handleFocus(), 0);

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
      window.clearTimeout(focusTimer);
      if (trapRef.current) {
        document.removeEventListener('keydown', trapRef.current);
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-[#111c2c]/40 z-50 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId.current}
        className="fixed right-0 top-0 h-full w-full sm:w-drawer-width bg-surface z-50 shadow-drawer border-l border-outline-variant flex flex-col transition-transform duration-300 ease-in-out focus-visible:outline-none"
        tabIndex={-1}
      >
        <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-bright shrink-0">
          <div>
            <h2 id={titleId.current} className="text-headline-sm text-on-surface">{title}</h2>
            {subtitle && (
              <p className="text-label-md text-on-surface-variant mt-0.5">{subtitle}</p>
            )}
          </div>
          <IconButton icon="close" aria-label="Close drawer" onClick={onClose} />
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 bg-background">
          {children}
        </div>

        {footer && (
          <div className="px-6 py-4 border-t border-outline-variant bg-surface-bright shrink-0 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </aside>
    </>,
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
    <section className="flex flex-col gap-4">
      <h3 className="text-body-sm font-medium text-primary uppercase tracking-wider border-b border-outline-variant pb-2 flex items-center gap-2">
        {icon && <Icon name={icon} size={18} />}
        {title}
      </h3>
      {children}
    </section>
  );
}
