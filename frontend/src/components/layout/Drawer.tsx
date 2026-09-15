import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Drawer({ isOpen, onClose, title, subtitle, children, footer }: DrawerProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
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
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed right-0 top-0 h-full w-full sm:w-drawer-width bg-surface z-50 shadow-drawer border-l border-outline-variant flex flex-col transition-transform duration-300 ease-in-out"
      >
        <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-bright shrink-0">
          <div>
            <h2 className="text-headline-sm text-on-surface">{title}</h2>
            {subtitle && (
              <p className="text-label-md text-on-surface-variant mt-0.5">{subtitle}</p>
            )}
          </div>
          <IconButton icon="close" aria-label="Close" onClick={onClose} />
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
