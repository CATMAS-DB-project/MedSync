// src/api/appointments.js
// TODO: replace all with real API calls

export async function searchPatients(query) {
  // GET /api/patients?q=...
  if (!query) return [];
  return [
    { id: 1, name: "John Doe",    mrn: "#892-110" },
    { id: 2, name: "Sarah Smith", mrn: "#744-023" },
    { id: 3, name: "Alan Moore",  mrn: "#221-908" },
  ].filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
}

export async function getSpecialties() {
  // GET /api/specialties
  return ["General Practice", "Cardiology", "Pediatrics"];
}

export async function getProviders(specialty) {
  // GET /api/providers?specialty=...
  return [
    { id: 1, name: "Dr. Sarah Jenkins", status: "Available" },
    { id: 2, name: "Dr. Michael Chen",  status: "Busy" },
    { id: 3, name: "Any Available Provider", status: "Auto" },
  ];
}

export async function getTimeSlots({ date, providerId }) {
  // GET /api/appointments/slots?date=...&provider=...
  return [
    {
      period: "09:00 AM",
      slots: [
        { time: "09:00", available: true },
        { time: "09:15", available: false },
        { time: "09:30", available: true },
        { time: "09:45", available: true },
      ],
    },
    {
      period: "10:00 AM",
      slots: [
        { time: "10:00", available: false },
        { time: "10:15", available: false },
        { time: "10:30", available: true },
        { time: "10:45", available: true },
      ],
    },
    {
      period: "11:00 AM",
      slots: [
        { time: "11:00", available: true },
        { time: "11:15", available: true },
        { time: "11:30", available: true },
        { time: "11:45", available: false },
      ],
    },
    { period: "12:00 PM", slots: [], lunch: true },
    {
      period: "01:00 PM",
      slots: [
        { time: "13:00", available: true },
        { time: "13:15", available: true },
        { time: "13:30", available: true },
        { time: "13:45", available: true },
      ],
    },
  ];
}

export async function createAppointment(payload) {
  // POST /api/appointments
  console.log("Creating appointment:", payload);
  await new Promise((r) => setTimeout(r, 500));
  return { id: 101, ...payload, status: "Scheduled" };
}
