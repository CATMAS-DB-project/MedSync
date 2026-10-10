import { NavLink, useNavigate } from 'react-router-dom';
import { getGroupedNavForRole } from '../../constants/navigation';
import { Icon } from '../ui/Icon';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../constants/routes';
import type { CurrentUser } from '../../types';

export interface SidebarProps {
  currentUser: CurrentUser;
  onNavigate?: () => void;
}

export function Sidebar({ currentUser, onNavigate }: SidebarProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const groups = getGroupedNavForRole(currentUser.role);

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  return (
    <aside
      aria-label="Main navigation"
      className="flex h-full w-full flex-col bg-surface-container-lowest md:shadow-card"
    >
      {/* Brand */}
      <div className="flex h-topbar-height shrink-0 items-center gap-3 px-5">
        {/* TODO: replace with logo image */}
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-bold text-on-primary shadow-sm"
        >
          M
        </span>
        <span className="truncate text-headline-sm font-bold tracking-tight text-on-surface">
          Medsync
        </span>
      </div>

      {/* Nav */}
      <nav className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4 pt-2">
        {groups.map((group, groupIndex) => (
          <div key={group.label ?? `group-${groupIndex}`} className="flex flex-col gap-1">
            {group.label && (
              <p className="px-3 pb-1 text-label-sm uppercase tracking-wider text-on-surface-variant/70">
                {group.label}
              </p>
            )}
            {group.items.map((item, index) => {
              const isFirstOverall = groupIndex === 0 && index === 0;
              return (
                <NavLink
                  key={item.path}
                  to={item.comingSoon ? '#' : item.path}
                  end={isFirstOverall}
                  onClick={(event) => {
                    if (item.comingSoon) {
                      event.preventDefault();
                      return;
                    }
                    onNavigate?.();
                  }}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-body-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest',
                      isActive
                        ? 'bg-primary-container text-on-primary-container font-semibold'
                        : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
                      item.comingSoon && 'cursor-not-allowed opacity-50',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon name={item.icon} filled={isActive} size={20} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.comingSoon && (
                        <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-on-surface-variant">
                          Soon
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Branch card */}
      <div className="shrink-0 border-t border-outline-variant p-3">
        <div className="flex items-center gap-3 rounded-xl bg-surface-container-low p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary-container text-on-secondary-container">
            <Icon name="location_on" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-label-sm uppercase tracking-wider text-on-surface-variant/70">Branch</p>
            <p className="truncate text-body-sm font-medium text-on-surface">
              {currentUser.branchName}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-body-sm font-medium text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2"
        >
          <Icon name="logout" size={20} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}