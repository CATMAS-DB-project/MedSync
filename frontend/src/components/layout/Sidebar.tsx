import { NavLink } from 'react-router-dom';
import { SIDEBAR_NAV_ITEMS } from '../../constants/navigation';
import { Icon } from '../ui/Icon';
import { getInitials } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import type { CurrentUser } from '../../types';

export interface SidebarProps {
  currentUser: CurrentUser;
}

export function Sidebar({ currentUser }: SidebarProps) {
  return (
    <aside className="hidden md:flex flex-col py-4 gap-2 bg-surface border-r border-outline-variant fixed left-0 top-0 h-full w-sidebar-width z-40">
      <div className="flex items-center gap-3 px-4 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-label-md font-bold">
          {getInitials(currentUser.name)}
        </div>
        <div>
          <h3 className="text-body-md font-semibold text-primary">{currentUser.name}</h3>
          <p className="text-label-md text-on-surface-variant">{currentUser.branch}</p>
          <span className="text-[10px] uppercase tracking-wider text-outline">
            {currentUser.role}
          </span>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-2 overflow-y-auto">
        {SIDEBAR_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.comingSoon ? '#' : item.path}
            onClick={(event) => item.comingSoon && event.preventDefault()}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded text-label-md transition-colors duration-150 ease-in-out',
                isActive
                  ? 'bg-primary-container text-on-primary-container font-bold border-r-4 border-primary rounded-l'
                  : 'text-on-surface-variant hover:bg-surface-container-high',
                item.comingSoon && 'opacity-50 cursor-not-allowed',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={item.icon} filled={isActive} />
                <span>{item.label}</span>
                {item.comingSoon && (
                  <span className="ml-auto text-[9px] uppercase tracking-wide text-outline">
                    Soon
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
