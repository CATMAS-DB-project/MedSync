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

  const navItems = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, currentUser.role).filter(
    (item) =>
      item.label.toLowerCase() !== 'inventory' &&
      !item.path.toLowerCase().includes('inventory'),
  );

  return (
    <aside className="hidden md:flex flex-col py-4 bg-surface border-r border-outline-variant fixed left-0 top-0 h-full w-sidebar-width z-40">
      {/* User card */}
      <div className="mx-3 mb-6 flex items-center gap-3 rounded-xl bg-surface-container-low p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container font-label-md font-bold text-on-primary-container">
          {getInitials(fullName)}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-body-md font-semibold text-primary">{fullName}</h3>
          <p className="truncate text-label-md text-on-surface-variant">
            {currentUser.branchName}
          </p>
          <span className="text-[10px] uppercase tracking-wider text-outline">
            {currentUser.role}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-outline">
          Menu
        </p>

        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.comingSoon ? '#' : item.path}
            onClick={(event) => item.comingSoon && event.preventDefault()}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-lg py-2.5 pl-4 pr-3 text-label-md transition-colors duration-150 ease-in-out',
                isActive
                  ? 'bg-primary-container text-on-primary-container font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
                item.comingSoon && 'opacity-50 cursor-not-allowed',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary"
                  />
                )}
                <Icon name={item.icon} filled={isActive} />
                <span className="truncate">{item.label}</span>
                {item.comingSoon && (
                  <span className="ml-auto rounded-full bg-surface-container-high px-2 py-0.5 text-[9px] uppercase tracking-wide text-outline">
                    Soon
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="mt-2 border-t border-outline-variant px-2 pt-3">
        <button
          type="button"
          onClick={handleLogout}
          className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-label-md text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
        >
          <Icon name="logout" />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
}
