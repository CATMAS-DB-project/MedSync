import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  searchPatients,
  getSpecialties,
  getProviders,
  getTimeSlots,
  createAppointment,
} from "../api/appointments";

export default function BookAppointment() {
  const navigate = useNavigate();

  // form state
  const [walkIn, setWalkIn] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState({
    id: 1,
    name: "John Doe",
    mrn: "#892-110",
  }); // pre-selected to match mockup

  const [specialties, setSpecialties] = useState([]);
  const [specialty, setSpecialty] = useState("");
  const [providers, setProviders] = useState([]);
  const [providerId, setProviderId] = useState("");

  const [apptType, setApptType] = useState("standard"); // "standard" | "extended"
  const [reason, setReason] = useState("");

  const [selectedDate, setSelectedDate] = useState(new Date(2023, 9, 4)); // Oct 4, 2023
  const [slotGroups, setSlotGroups] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  // load static lists
  useEffect(() => {
    getSpecialties().then((list) => {
      setSpecialties(list);
      setSpecialty(list[0] ?? "");
    });
  }, []);

  // load providers when specialty changes
  useEffect(() => {
    if (!specialty) return;
    getProviders(specialty).then((list) => {
      setProviders(list);
      setProviderId(list[0]?.id ?? "");
    });
  }, [specialty]);

  // load time slots when date/provider changes
  useEffect(() => {
    if (!providerId) return;
    getTimeSlots({ date: selectedDate, providerId }).then((groups) => {
      setSlotGroups(groups);
      setSelectedSlot(null);
    });
  }, [selectedDate, providerId]);

  // patient search (debounced-ish; simple here)
  useEffect(() => {
    const t = setTimeout(() => {
      searchPatients(patientQuery).then(setPatientResults);
    }, 200);
    return () => clearTimeout(t);
  }, [patientQuery]);

  const providerLabel = useMemo(() => {
    const p = providers.find((x) => x.id === providerId);
    if (!p) return "";
    return p.status === "Available" ? `${p.name} (Available)` : `${p.name} (${p.status})`;
  }, [providers, providerId]);

  async function handleBook() {
    if (!selectedPatient || !providerId || !selectedSlot) return;
    setSubmitting(true);
    try {
      await createAppointment({
        patient: selectedPatient,
        providerId,
        specialty,
        type: apptType,
        reason,
        date: selectedDate.toISOString(),
        slot: selectedSlot,
        walkIn,
      });
      navigate("/dashboard");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 mb-6">
        <div>
          <h1 className="text-display-sm text-on-surface mb-1">Book Appointment</h1>
          <p className="text-body-md text-on-surface-variant">
            Schedule a patient visit or consultation.
          </p>
        </div>

        {/* Walk-in toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none self-start sm:self-auto">
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
            directions_walk
          </span>
          <span className="text-label-md text-on-surface-variant">Walk-in</span>
          <button
            type="button"
            onClick={() => setWalkIn((v) => !v)}
            className={`w-10 h-5 rounded-full relative transition-colors ${
              walkIn ? "bg-primary" : "bg-surface-container-high border border-outline-variant"
            }`}
            aria-pressed={walkIn}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                walkIn ? "translate-x-5" : ""
              }`}
            />
          </button>
        </label>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-element-gap">
        {/* LEFT column */}
        <div className="lg:col-span-5 flex flex-col gap-element-gap">
          {/* Patient info */}
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm">
            <h3 className="text-headline-sm text-on-surface mb-4">Patient Information</h3>

            <label className="block text-label-md text-on-surface-variant mb-1">
              Search Patient
            </label>
            <div className="relative mb-4">
              <span className="material-symbols-outlined absolute left-2 top-2 text-outline text-[18px]">
                search
              </span>
              <input
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                placeholder="Name, ID, or Phone..."
                className="w-full bg-surface border border-outline-variant text-body-md py-2 pl-8 pr-3 rounded h-9 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {patientResults.length > 0 && patientQuery && (
                <ul className="absolute z-20 mt-1 w-full bg-surface-container-lowest border border-outline-variant rounded shadow max-h-40 overflow-auto">
                  {patientResults.map((p) => (
                    <li
                      key={p.id}
                      onClick={() => {
                        setSelectedPatient(p);
                        setPatientQuery("");
                        setPatientResults([]);
                      }}
                      className="px-3 py-2 text-body-md hover:bg-surface-container-low cursor-pointer"
                    >
                      {p.name} <span className="text-outline text-label-md">{p.mrn}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selectedPatient && (
              <div className="bg-surface-container-low p-3 rounded border border-outline-variant flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-label-md">
                    {initials(selectedPatient.name)}
                  </div>
                  <div>
                    <div className="text-body-md font-medium text-on-surface">
                      {selectedPatient.name}
                    </div>
                    <div className="text-label-md text-outline">
                      MRN: {selectedPatient.mrn}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPatient(null)}
                  className="text-error text-label-md hover:underline"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Provider & type */}
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm flex-1">
            <h3 className="text-headline-sm text-on-surface mb-4">Provider &amp; Type</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-label-md text-on-surface-variant mb-1">
                  Specialty / Department
                </label>
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full bg-surface border border-outline-variant text-body-md py-2 px-3 rounded h-9 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {specialties.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-label-md text-on-surface-variant mb-1">
                  Provider
                </label>
                <select
                  value={providerId}
                  onChange={(e) => setProviderId(Number(e.target.value))}
                  className="w-full bg-surface border border-outline-variant text-body-md py-2 px-3 rounded h-9 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.status !== "Auto" ? ` (${p.status})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-label-md text-on-surface-variant mb-1">
                  Appointment Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setApptType("standard")}
                    className={`text-body-md py-1.5 rounded border text-center transition-colors ${
                      apptType === "standard"
                        ? "bg-primary-container text-on-primary-container border-primary"
                        : "bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container-low"
                    }`}
                  >
                    Standard (15m)
                  </button>
                  <button
                    type="button"
                    onClick={() => setApptType("extended")}
                    className={`text-body-md py-1.5 rounded border text-center transition-colors ${
                      apptType === "extended"
                        ? "bg-primary-container text-on-primary-container border-primary"
                        : "bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container-low"
                    }`}
                  >
                    Extended (30m)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-label-md text-on-surface-variant mb-1">
                  Reason for Visit
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Brief description..."
                  className="w-full bg-surface border border-outline-variant text-body-md py-2 px-3 rounded resize-none placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT column */}
        <div className="lg:col-span-7 flex flex-col gap-element-gap">
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm h-full flex flex-col">
            {/* Calendar */}
            <Calendar selectedDate={selectedDate} onSelect={setSelectedDate} />

            {/* Time slots */}
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-headline-sm text-on-surface">Available Slots</h3>
                <span className="text-label-md text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded">
                  {formatShortDate(selectedDate)}, {providerLabel || "—"}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 overflow-y-auto pr-2 max-h-[300px]">
                {slotGroups.map((group) => (
                  <SlotGroup
                    key={group.period}
                    group={group}
                    selectedSlot={selectedSlot}
                    onSelect={setSelectedSlot}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="mt-6 flex justify-end gap-3 border-t border-outline-variant pt-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-4 py-2 border border-outline-variant text-on-surface-variant bg-surface rounded text-body-md hover:bg-surface-container-low transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={submitting || !selectedPatient || !selectedSlot}
          onClick={handleBook}
          className="px-6 py-2 bg-primary text-on-primary rounded text-body-md font-medium hover:bg-surface-tint shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[18px]">event_available</span>
          {submitting ? "Booking…" : "Book Appointment"}
        </button>
      </div>
    </>
  );
}

/* ----------------------------- helpers ----------------------------- */

function initials(name = "") {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatShortDate(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SlotGroup({ group, selectedSlot, onSelect }) {
  if (group.lunch) {
    return (
      <>
        <div className="col-span-4 text-label-md text-outline mt-2 mb-1">
          {group.period}
        </div>
        <div className="col-span-4 bg-surface-container-low py-2 rounded text-center text-label-md text-outline border border-dashed border-outline-variant">
          Lunch Break
        </div>
      </>
    );
  }
  return (
    <>
      <div className="col-span-4 text-label-md text-outline mt-2 mb-1">
        {group.period}
      </div>
      {group.slots.map((s) => {
        const isSelected = selectedSlot === s.time;
        const disabled = !s.available;
        return (
          <button
            key={s.time}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(s.time)}
            className={
              disabled
                ? "bg-surface-container-low border border-outline-variant text-outline py-2 rounded text-body-md cursor-not-allowed opacity-60"
                : isSelected
                ? "bg-primary border border-primary text-on-primary py-2 rounded text-body-md font-medium shadow-sm"
                : "bg-surface-container-lowest border border-outline-variant text-on-surface py-2 rounded text-body-md hover:border-primary transition-colors"
            }
          >
            {s.time}
          </button>
        );
      })}
    </>
  );
}

function Calendar({ selectedDate, onSelect }) {
  const [viewMonth, setViewMonth] = useState(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevDays - i, current: false, date: new Date(year, month - 1, prevDays - i) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true, date: new Date(year, month, d) });
  }
  while (cells.length % 7 !== 0) {
    const d = cells.length - firstDay - daysInMonth + 1;
    cells.push({ day: d, current: false, date: new Date(year, month + 1, d) });
  }

  const monthLabel = viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  return (
    <div className="mb-6 pb-6 border-b border-outline-variant">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-headline-sm text-on-surface">Select Date</h3>
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => setViewMonth(new Date(year, month - 1, 1))}
            className="w-8 h-8 flex items-center justify-center rounded border border-outline-variant hover:bg-surface-container-low text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <span className="text-body-md font-medium">{monthLabel}</span>
          <button
            type="button"
            onClick={() => setViewMonth(new Date(year, month + 1, 1))}
            className="w-8 h-8 flex items-center justify-center rounded border border-outline-variant hover:bg-surface-container-low text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {weekdays.map((d) => (
          <div key={d} className="text-label-md text-outline">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {cells.map((c, i) => {
          const selected = c.current && isSameDay(c.date, selectedDate);
          return (
            <div
              key={i}
              onClick={() => c.current && onSelect(c.date)}
              className={
                !c.current
                  ? "py-1 text-body-md text-outline cursor-not-allowed"
                  : selected
                  ? "py-1 text-body-md bg-primary-container text-on-primary-container font-medium rounded cursor-pointer"
                  : "py-1 text-body-md text-on-surface hover:bg-surface-container-low rounded cursor-pointer"
              }
            >
              {c.day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
