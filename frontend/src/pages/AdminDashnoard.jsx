import { useEffect, useState } from "react";
import { getDashboardStats, getRecentAppointments } from "../api/dashboard";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    Promise.all([getDashboardStats(), getRecentAppointments()])
      .then(([s, a]) => {
        if (!mounted) return;
        setStats(s);
        setAppointments(a);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h2 className="text-display-sm text-on-surface">Admin Dashboard</h2>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Overview for All Branches
          </p>
        </div>
        <button onClick={() => navigate("/appointments/book")} className="bg-primary text-white text-label-md px-4 py-2 rounded flex items-center gap-2 hover:opacity-90 transition-opacity self-start sm:self-auto">
          <span className="material-symbols-outlined text-sm">add</span>
          New Appointment
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-element-gap">
        <KpiCard
          title="Today's Appointments"
          icon="calendar_month"
          iconClass="text-primary bg-primary-fixed"
          value={loading ? "—" : stats.todaysAppointments.value}
          suffix={
            !loading && (
              <span className="text-secondary bg-secondary-container px-1.5 rounded text-[11px] font-medium">
                {stats.todaysAppointments.change}
              </span>
            )
          }
        />
        <KpiCard
          title="Outstanding Dues"
          icon="payments"
          iconClass="text-error bg-error-container"
          value={loading ? "—" : stats.outstandingDues.value}
          suffix={
            !loading && (
              <span className="text-on-surface-variant text-[11px]">
                {stats.outstandingDues.note}
              </span>
            )
          }
        />
        <KpiCard
          title="Active Staff"
          icon="medical_services"
          iconClass="text-secondary bg-secondary-container"
          value={loading ? "—" : stats.activeStaff.value}
          suffix={
            !loading && (
              <span className="text-on-surface-variant text-[11px]">
                / {stats.activeStaff.total} total
              </span>
            )
          }
        />
      </div>

      {/* Recent Appointments */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
          <h3 className="text-headline-sm text-on-surface">Recent Appointments</h3>
          <button className="text-primary text-label-md hover:underline flex items-center gap-1">
            View All
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-bright">
                <Th sortable>Patient</Th>
                <Th sortable>Time</Th>
                <Th>Branch</Th>
                <Th>Status</Th>
                <Th align="right">Action</Th>
              </tr>
            </thead>
            <tbody className="text-table-data">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-on-surface-variant">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading &&
                appointments.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-outline-variant last:border-b-0 hover:bg-[#EDF2F7] cursor-pointer transition-colors group"
                  >
                    <td className="px-3 py-2 font-medium text-on-surface">{a.patient}</td>
                    <td className="px-3 py-2 text-on-surface-variant">{a.time}</td>
                    <td className="px-3 py-2 text-on-surface-variant">{a.branch}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button className="text-primary opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-primary-fixed rounded">
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ---------- small helpers ---------- */

function KpiCard({ title, icon, iconClass, value, suffix }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-label-md text-on-surface-variant uppercase tracking-wide">
          {title}
        </h3>
        <span className={`material-symbols-outlined rounded p-1 text-sm ${iconClass}`}>
          {icon}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-on-surface">{value}</span>
        {suffix}
      </div>
    </div>
  );
}

function Th({ children, sortable, align = "left" }) {
  return (
    <th
      className={`px-3 py-2 text-label-md text-on-surface-variant font-medium ${
        align === "right" ? "text-right" : ""
      } ${sortable ? "cursor-pointer hover:bg-surface-variant transition-colors" : ""}`}
    >
      {children}
      {sortable && (
        <span className="material-symbols-outlined text-[12px] align-middle">
          unfold_more
        </span>
      )}
    </th>
  );
}

function StatusBadge({ status }) {
  const styles =
    status === "Completed"
      ? "bg-secondary/10 text-secondary border-secondary/20"
      : "bg-primary-container/10 text-primary border-primary-container/20";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${styles}`}
    >
      {status}
    </span>
  );
}
