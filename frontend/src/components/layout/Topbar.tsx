import { useEffect, useState } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { DropdownMenu } from '../ui/DropdownMenu';
import { formatFullName } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../constants/routes';
import type { CurrentUser } from '../../types';

export interface TopbarProps {
  currentUser: CurrentUser;
  onMenuClick?: () => void;
  titleSlot?: React.ReactNode;
}

const PAGE_TITLES: { pattern: string; title: string }[] = [
  { pattern: ROUTES.DASHBOARD, title: 'Dashboard' },
  { pattern: ROUTES.RECEPTION_HOME, title: 'Home' },
  { pattern: ROUTES.DOCTOR_HOME, title: 'Home' },
  { pattern: ROUTES.QA_HOME, title: 'Home' },
  { pattern: ROUTES.APPOINTMENTS, title: 'Appointments' },
  { pattern: ROUTES.APPOINTMENT_BOOKING, title: 'Book Appointment' },
  { pattern: ROUTES.PATIENTS, title: 'Patients' },
  { pattern: ROUTES.STAFF, title: 'Staff' },
  { pattern: ROUTES.BILLING, title: 'Billing' },
  { pattern: ROUTES.CONSULTATION, title: 'Consultation' },
  { pattern: ROUTES.WALK_IN, title: 'Walk-in' },
  { pattern: ROUTES.REPORTS, title: 'Reports' },
];

function usePageTitle(): string {
  const { pathname } = useLocation();
  for (const entry of PAGE_TITLES) {
    if (matchPath({ path: entry.pattern, end: entry.pattern === ROUTES.DASHBOARD }, pathname)) {
      return entry.title;
    }
  }
  return 'Medsync';
}

export function Topbar({ currentUser, onMenuClick, titleSlot }: TopbarProps) {
  const fullName = formatFullName(currentUser.firstName, currentUser.lastName);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const title = usePageTitle();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [title]);

  const handleSignOut = async () => {
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  return (
    <header
      className={cn(
        'fixed right-0 top-0 z-40 flex h-topbar-height items-center justify-between gap-3',
        'bg-surface-container-lowest px-4 sm:px-6 md:shadow-card',
        'left-0 md:left-sidebar-width',
      )}
    >
      {/* Left */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <IconButton
          icon="menu"
          size="md"
          aria-label="Open navigation"
          onClick={onMenuClick}
          className="md:hidden"
        />
        {titleSlot ?? (
          <h1 className="truncate text-headline-sm font-semibold text-on-surface">{title}</h1>
        )}
      </div>

      {/* Right */}
      <div className="flex shrink-0 items-center gap-2">
        <DropdownMenu
          ariaLabel="Account menu"
          align="right"
          menuClassName="min-w-[240px]"
          trigger={
            <span
              className={cn(
                'flex items-center gap-2 rounded-xl p-1 pr-2 transition-colors',
                'hover:bg-surface-container-low',
              )}
            >
              <Avatar name={fullName} size="sm" />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block max-w-[10rem] truncate text-body-sm font-medium text-on-surface">
                  {fullName}
                </span>
                <span className="block text-label-sm uppercase tracking-wider text-on-surface-variant">
                  {currentUser.role}
                </span>
              </span>
              <Icon name="expand_more" size={18} className="hidden text-on-surface-variant sm:block" />
            </span>
          }
          items={[
            {
              id: 'signout',
              label: 'Sign out',
              icon: 'logout',
              danger: true,
              onSelect: handleSignOut,
            },
          ]}
        />

        {/* Hidden full details menu — DropdownMenu above shows actions; keep the details out of the trigger */}
        <span className="sr-only" aria-hidden="true">
          <Badge tone="primary">{currentUser.role}</Badge>
        </span>
      </div>

      {/* Avoid unused-var warning when isMenuOpen never changes — kept for future extension */}
      <span className="hidden">{isMenuOpen ? '' : ''}</span>
    </header>
  );
}