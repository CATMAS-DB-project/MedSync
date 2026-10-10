import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';

export function AppLayout() {
  const { currentUser } = useAuth();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = isMobileNavOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileNavOpen]);

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-background text-on-surface">
      {/* Desktop sidebar */}
      <div className="fixed left-0 top-0 z-40 hidden h-screen w-sidebar-width md:block">
        <Sidebar currentUser={currentUser} />
      </div>

      {/* Mobile off-canvas sidebar */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-[#0F1E3D]/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsMobileNavOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-0 h-full w-[80vw] max-w-[300px] animate-slide-in-right shadow-drawer">
            <Sidebar currentUser={currentUser} onNavigate={() => setIsMobileNavOpen(false)} />
          </div>
        </div>
      )}

      <Topbar
        currentUser={currentUser}
        onMenuClick={() => setIsMobileNavOpen(true)}
      />

      <div
        className={cn(
          'flex min-h-screen min-w-0 flex-col',
          'pt-topbar-height pb-bottomnav-height md:pb-0 md:pl-sidebar-width',
        )}
      >
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>

      <BottomNav currentUser={currentUser} />
    </div>
  );
}