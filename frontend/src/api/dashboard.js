// src/api/dashboard.js
// TODO: replace with real endpoints

export async function getDashboardStats() {
  // GET /api/dashboard/stats
  return {
    todaysAppointments: { value: 42, change: "+12%" },
    outstandingDues:    { value: "$12,450", note: "Across 3 branches" },
    activeStaff:        { value: 18, total: 24 },
  };
}

export async function getRecentAppointments() {
  // GET /api/appointments/recent
  return [
    { id: 1, patient: "Sarah Jenkins", time: "09:00 AM - Today", branch: "Central Branch", status: "Scheduled" },
    { id: 2, patient: "Michael Chen",  time: "10:30 AM - Today", branch: "North Clinic",   status: "Completed" },
    { id: 3, patient: "Emily Davis",   time: "11:15 AM - Today", branch: "Central Branch", status: "Scheduled" },
    { id: 4, patient: "Robert Wilson", time: "01:00 PM - Today", branch: "South Annex",    status: "Scheduled" },
  ];
}
