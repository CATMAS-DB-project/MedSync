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
    <header className="fixed top-0 z-50 flex h-14 w-full items-center justify-between border-b border-outline-variant bg-surface/80 px-container-padding backdrop-blur-md md:left-sidebar-width md:w-[calc(100%-240px)]">
      {/* Left: menu + brand + branch */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-primary transition-colors hover:bg-surface-container-low active:opacity-80 md:hidden"
          aria-label="Open menu"
        >
          <Icon name="menu" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-teal-500 shadow-sm shadow-blue-500/20">
            <Icon name="clinical_notes" size={18} className="text-white" />
          </div>
          <h1 className="hidden text-headline-sm font-semibold tracking-tight text-primary sm:block">
            CATMS
          </h1>
        </div>

        <div className="hidden h-6 w-px bg-outline-variant sm:block" />

        <div
          className="hidden items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1.5 sm:flex"
          title="Your assigned branch"
        >
          <Icon name="location_on" size={16} className="text-outline" />
          <span className="text-body-sm font-medium text-on-surface">{currentUser.branchName}</span>
        </div>
      </div>

      {/* Right: status + avatar */}
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 lg:flex">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wide text-teal-700">
            Online
          </span>
        </div>

        <button
          type="button"
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-surface-container-low sm:pr-3"
          aria-label="Account menu"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-container text-label-md font-bold text-on-primary-container">
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
          <Icon name="expand_more" size={16} className="hidden text-outline sm:block" />
        </button>
      </div>
    </header>
  );
}
