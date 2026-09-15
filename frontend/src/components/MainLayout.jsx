import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";

export default function MainLayout({ children }) {
  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 md:ml-sidebar-width">
        <TopBar />
        <main className="flex-1 overflow-auto pt-14 pb-16 md:pb-0 px-6 py-6">
          <div className="max-w-7xl mx-auto space-y-6">{children}</div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
