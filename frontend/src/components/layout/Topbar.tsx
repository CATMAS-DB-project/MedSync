import { Icon } from '../ui/Icon';
import { getInitials, formatFullName } from '../../utils/formatters';
import type { CurrentUser } from '../../types';

export interface TopbarProps {
  currentUser: CurrentUser;
  onMenuClick?: () => void;
}

export function Topbar({ currentUser, onMenuClick }: TopbarProps) {
  const fullName = formatFullName(currentUser.firstName, currentUser.lastName);

  return (
    <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between overflow-hidden border-b border-outline-variant/80 bg-surface/90 px-container-padding shadow-sm backdrop-blur-xl md:left-sidebar-width md:w-[calc(100%-240px)]">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-secondary to-primary/20" />
      {/* Left: menu + brand + branch */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-primary transition-colors hover:bg-primary-container/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:opacity-80 md:hidden"
          aria-label="Open menu"
        >
          <Icon name="menu" />
        </button>

        <div className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white shadow-md shadow-primary/20">
            <Icon name="clinical_notes" size={19} />
          </span>
          <h1 className="text-headline-sm font-bold tracking-tight text-primary">CATMS</h1>
        </div>

        <div className="hidden h-7 w-px bg-outline-variant sm:block" />

        <div
          className="hidden min-w-0 max-w-[min(40vw,20rem)] items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 shadow-sm sm:flex"
          title="Your assigned branch"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary-container text-secondary">
            <Icon name="location_on" size={16} />
          </span>
          <span className="truncate text-body-sm font-medium text-on-surface">{currentUser.branchName}</span>
        </div>
      </div>

      {/* Right: status + avatar */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <div className="hidden items-center gap-2 rounded-full border border-secondary/15 bg-secondary-container/60 px-3 py-1.5 lg:flex">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-secondary" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-on-secondary-container">
            Online
          </span>
        </div>

        <button
          type="button"
          className="flex items-center gap-2 rounded-xl border border-transparent py-1 pl-1 pr-1.5 transition-colors hover:border-outline-variant hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:pr-2.5"
          aria-label="Account menu"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-container text-label-md font-bold text-on-primary-container ring-1 ring-primary/10">
            {getInitials(fullName)}
          </div>
          <div className="hidden text-left leading-tight sm:block">
            <p className="max-w-[10rem] truncate text-body-sm font-medium text-on-surface">
              {fullName}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-outline">
              {currentUser.role}
            </p>
          </div>
          <Icon name="expand_more" size={18} className="hidden text-outline sm:block" />
        </button>
      </div>
    </header>
  );
}
