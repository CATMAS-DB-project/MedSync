import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { getGroupedNavForRole } from '../../constants/navigation';
import { Icon } from '../ui/Icon';
import { cn } from '../../utils/cn';
import type { CurrentUser } from '../../types';

export interface BottomNavProps {
  currentUser: CurrentUser;
}

const PRIMARY_LABELS = ['Home', 'Appointments', 'Patients'] as const;

export function BottomNav({ currentUser }: BottomNavProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const groups = getGroupedNavForRole(currentUser.role);
  const flat = groups.flatMap((group) => group.items);

  const primary = PRIMARY_LABELS
    .map((label) => flat.find((item) => item.label === label))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const extras = flat.filter((item) => !primary.some((p) => p.path === item.path));
  const isExtraActive = extras.some((item) => location.pathname.startsWith(item.path));

  useEffect(() => {
    setIsSheetOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = isSheetOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSheetOpen]);

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex h-bottomnav-height items-stretch border-t border-outline-variant bg-surface-container-lowest pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {primary.map((item, index) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={index === 0}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-label-sm font-medium transition-colors',
                isActive ? 'text-primary' : 'text-on-surface-variant',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'flex h-8 w-12 items-center justify-center rounded-full transition-colors',
                    isActive && 'bg-primary-container',
                  )}
                >
                  <Icon name={item.icon} filled={isActive} size={20} />
                </span>
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}

        <button
          type="button"
          onClick={() => setIsSheetOpen(true)}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1 text-label-sm font-medium transition-colors',
            isExtraActive ? 'text-primary' : 'text-on-surface-variant',
          )}
        >
          <span
            className={cn(
              'flex h-8 w-12 items-center justify-center rounded-full transition-colors',
              isExtraActive && 'bg-primary-container',
            )}
          >
            <Icon name="more_horiz" filled={isExtraActive} size={20} />
          </span>
          <span>More</span>
        </button>
      </nav>

      {isSheetOpen &&
        createPortal(
          <div className="fixed inset-0 z-[60] md:hidden">
            <div
              className="absolute inset-0 bg-[#0F1E3D]/40 backdrop-blur-sm animate-fade-in"
              onClick={() => setIsSheetOpen(false)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="More navigation"
              className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-3xl bg-surface-container-lowest pb-[env(safe-area-inset-bottom)] pt-3 shadow-modal animate-slide-up"
            >
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-outline-variant" />
              <div className="flex flex-col gap-1 px-3 pb-4">
                {extras.length === 0 ? (
                  <p className="px-3 py-4 text-body-sm text-on-surface-variant">
                    Nothing else here.
                  </p>
                ) : (
                  extras.map((item) => (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => {
                        setIsSheetOpen(false);
                        navigate(item.path);
                      }}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-3 text-body-md font-medium transition-colors',
                        location.pathname.startsWith(item.path)
                          ? 'bg-primary-container text-on-primary-container'
                          : 'text-on-surface hover:bg-surface-container-low',
                      )}
                    >
                      <Icon name={item.icon} size={20} />
                      <span>{item.label}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}