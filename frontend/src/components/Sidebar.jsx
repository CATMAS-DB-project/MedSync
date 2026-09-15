import { Link, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { label: "Dashboard",     icon: "dashboard",       path: "/dashboard" },
  { label: "Appointments",  icon: "calendar_today",  path: "/appointments" },
  { label: "Patients",      icon: "person",          path: "/patients" },
  { label: "Inventory",     icon: "inventory_2",     path: "/inventory" },
  { label: "Reports",       icon: "analytics",       path: "/reports" },
];

export default function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="hidden md:flex flex-col py-4 gap-2 bg-surface border-r border-outline-variant fixed left-0 top-0 h-full w-sidebar-width z-40">
      {/* Profile */}
      <div className="flex items-center gap-3 px-4 mb-6">
        <img
          alt="Staff Profile"
          className="w-10 h-10 rounded-full object-cover border border-outline-variant"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAzNv-vuN6y-IBoDlSWYbXt462n-7-0QUn9OL_nwKMm4doG2Y28mNu6YSegK9SG8N1mdw-0AelrNZI19pkmXod2Ar0swVHD6e3HBiEfAK_cZENy6r19dT4gEYkb7081h-uYF_TZriDguN28ucDMgPmhGk_eLfl37MQpXrixkFySFLv4v3xXi5qp_OnIooYNqRv6D_GBdPdjpGRUKp9WHsqHQmvJzu1x9HMcPYQ5AWNMs6c0SOAYCH8Q"
        />
        <div>
          <h3 className="text-body-md font-semibold text-primary">Clinical Staff</h3>
          <p className="text-label-md text-on-surface-variant">Central Branch</p>
          <span className="text-[10px] uppercase tracking-wider text-outline">Admin</span>
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
          return (
            <Link
              key={item.label}
              to={item.path}
              className={
                isActive
                  ? "flex items-center gap-3 px-3 py-2 bg-primary-container text-on-primary-container font-bold border-r-4 border-primary rounded-l transition-colors duration-150"
                  : "flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:bg-surface-container-high transition-all duration-150 rounded"
              }
            >
              <span
                className="material-symbols-outlined"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              <span className="text-label-md">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
