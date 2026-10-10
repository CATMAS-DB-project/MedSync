import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';
import { useAuth } from '../../context/AuthContext';

export function AppLayout() {
  const { currentUser } = useAuth();

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Sidebar currentUser={currentUser} />
      <Topbar currentUser={currentUser} />

      <div className="flex-1 flex flex-col min-w-0 md:ml-sidebar-width pt-16 pb-16 md:pb-0">
        <main className="flex-1 p-container-padding">
          <Outlet />
        </main>
      </div>

      <BottomNav currentUser={currentUser} />
    </div>
  );
}
