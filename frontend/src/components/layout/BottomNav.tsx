import { NavLink } from 'react-router-dom';
import { BOTTOM_NAV_ITEMS } from '../../constants/navigation';
import { Icon } from '../ui/Icon';
import { cn } from '../../utils/cn';

export function BottomNav() {
  return (
    <nav className="flex justify-around items-center h-16 pb-safe bg-surface fixed bottom-0 w-full z-50 md:hidden border-t border-outline-variant">
      {BOTTOM_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center px-2 py-1 rounded transition-transform active:scale-95',
              isActive
                ? 'text-primary bg-secondary-container rounded-full px-4'
                : 'text-on-surface-variant active:bg-surface-variant',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon name={item.icon} filled={isActive} />
              <span className="text-label-md mt-0.5">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
