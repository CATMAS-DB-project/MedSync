import { NavLink, useNavigate } from 'react-router-dom';
import { SIDEBAR_NAV_ITEMS, filterNavItemsByRole } from '../../constants/navigation';
import { Icon } from '../ui/Icon';
import { getInitials, formatFullName } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../constants/routes';
import type { CurrentUser } from '../../types';

export interface SidebarProps {
  currentUser: CurrentUser;
}

export function Sidebar({ currentUser }: SidebarProps) {
  const fullName = formatFullName(currentUser.firstName, currentUser.lastName);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const navItems = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, currentUser.role);

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-full w-sidebar-width flex-col overflow-hidden border-r border-outline-variant bg-surface md:flex">
      {/* User card */}
      <div className="mx-3 mb-5 mt-5 flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 shadow-sm">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container font-label-md font-bold text-on-primary-container ring-1 ring-primary/10">
          {getInitials(fullName)}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-body-md font-semibold text-on-surface">{fullName}</h3>
          <p className="truncate text-label-md text-on-surface-variant">
            {currentUser.branchName}
          </p>
          <span className="mt-1 inline-flex max-w-full rounded-full bg-secondary-container px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-on-secondary-container">
            {currentUser.role}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav aria-label="Main navigation" className="relative flex flex-1 flex-col gap-1 overflow-y-auto px-3">
        <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-outline">
          Workspace
        </p>

        {navItems.map((item, index) => (
          <NavLink
            key={item.path}
            to={item.comingSoon ? '#' : item.path}
            end={index === 0}
            onClick={(event) => item.comingSoon && event.preventDefault()}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-label-md font-medium transition-all duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                isActive
                  ? 'bg-primary-container/80 font-semibold text-on-primary-container shadow-sm ring-1 ring-primary/10'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
                item.comingSoon && 'cursor-not-allowed opacity-50',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-primary to-secondary"
                  />
                )}
                <span className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                  isActive
                    ? 'bg-surface-container-lowest/70 text-primary'
                    : 'text-outline group-hover:bg-surface-container-lowest group-hover:text-primary',
                )}>
                  <Icon name={item.icon} filled={isActive} size={19} />
                </span>
                <span className="truncate">{item.label}</span>
                {item.comingSoon && (
                  <span className="ml-auto rounded-full bg-surface-container-high px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-outline">
                    Soon
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="relative mx-3 mt-3 border-t border-outline-variant px-0 pt-3">
        <button
          type="button"
          onClick={handleLogout}
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-label-md font-medium text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg text-outline transition-colors group-hover:bg-surface-container-lowest group-hover:text-error">
            <Icon name="logout" size={19} />
          </span>
          <span>Log Out</span>
        </button>
        <p className="px-3 pb-3 pt-2 text-[10px] text-outline">Secure clinical workspace</p>
      </div>
    </aside>
  );
}
