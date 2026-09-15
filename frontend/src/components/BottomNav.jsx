import { Link, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { label: "Home",     icon: "home",   path: "/dashboard" },
  { label: "Schedule", icon: "event",  path: "/appointments" },
  { label: "Patients", icon: "group",  path: "/patients" },
  { label: "More",     icon: "menu",   path: "/more" },
];

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="flex justify-around items-center h-16 bg-surface fixed bottom-0 w-full z-50 md:hidden border-t border-outline-variant">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.path;
        return (
          <Link
            key={item.label}
            to={item.path}
            className={
              isActive
                ? "text-primary bg-secondary-container rounded-full px-4 py-1 flex flex-col items-center transition-transform active:scale-95"
                : "text-on-surface-variant flex flex-col items-center active:bg-surface-variant transition-transform active:scale-95 rounded px-2 py-1"
            }
          >
            <span
              className="material-symbols-outlined"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.icon}
            </span>
            <span className="text-label-md mt-0.5">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
