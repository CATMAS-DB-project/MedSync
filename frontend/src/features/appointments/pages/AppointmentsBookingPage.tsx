import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/ui/Icon';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Toggle } from '../../../components/ui/Toggle';
import { mockPatients } from '../../../services/mock/patients';
import { getInitials } from '../../../utils/formatters';
import { ROUTES } from '../../../constants/routes';
import type { Patient } from '../../../types';

const SPECIALTY_OPTIONS = [
  { label: 'General Medicine', value: 'general' },
  { label: 'Pediatrics', value: 'pediatrics' },
  { label: 'Orthopedics', value: 'orthopedics' },
];

const TYPE_OPTIONS = [
  { label: 'Consultation', value: 'Consultation' },
  { label: 'Follow-up', value: 'Follow-up' },
  { label: 'Procedure', value: 'Procedure' },
  { label: 'Lab Test', value: 'Lab Test' },
];

// Slots booked ~30% of the time, deterministic by index so the grid doesn't
// shuffle on every render.
function isSlotBooked(index: number) {
  return (index * 7) % 5 === 0;
}

function buildTimeSlots(): { hourLabel: string; times: string[] }[] {
  const blocks: { hourLabel: string; times: string[] }[] = [];
  for (let hour = 9; hour < 17; hour++) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    blocks.push({
      hourLabel: `${displayHour}:00 ${period}`,
      times: ['00', '15', '30', '45'].map((m) => `${String(hour).padStart(2, '0')}:${m}`),
    });
  }
  return blocks;
}

function buildCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = Array.from({ length: firstDay }, () => null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function AppointmentBookingPage() {
  const navigate = useNavigate();
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [patientQuery, setPatientQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [specialty, setSpecialty] = useState('general');
  const [type, setType] = useState('Consultation');

  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const days = buildCalendarDays(viewDate.getFullYear(), viewDate.getMonth());
  const timeBlocks = useMemo(() => buildTimeSlots(), []);
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const patientMatches =
    patientQuery.trim() === ''
      ? []
      : mockPatients.filter((patient) =>
          patient.fullName.toLowerCase().includes(patientQuery.toLowerCase()),
        );

  const canSubmit = selectedPatient !== null && selectedTime !== null;

  const handleSubmit = () => {
    if (!canSubmit) return;
    // Backend isn't ready yet - once it is, this becomes a real POST and
    // redirect using the created appointment's id.
    navigate(ROUTES.APPOINTMENTS);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-display-sm text-on-surface mb-1">Book Appointment</h1>
          <p className="text-body-md text-on-surface-variant">
            Schedule a patient visit or consultation.
          </p>
        </div>
        <Toggle checked={isWalkIn} onChange={setIsWalkIn} label="Walk-in" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-element-gap">
        {/* Left Column */}
        <div className="lg:col-span-5 flex flex-col gap-element-gap">
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm">
            <h3 className="text-headline-sm text-on-surface mb-4">Patient Information</h3>
            {!selectedPatient ? (
              <div className="relative">
                <Input
                  label="Search Patient"
                  icon="search"
                  placeholder="Name, ID, or Phone..."
                  value={patientQuery}
                  onChange={(event) => setPatientQuery(event.target.value)}
                />
                {patientMatches.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-surface-container-lowest border border-outline-variant rounded shadow-elevated max-h-48 overflow-y-auto">
                    {patientMatches.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatient(patient);
                          setPatientQuery('');
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-surface-container-low flex items-center gap-2"
                      >
                        <div className="w-6 h-6 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center text-[10px] font-bold">
                          {getInitials(patient.fullName)}
                        </div>
                        <span className="text-body-sm text-on-surface">{patient.fullName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-surface-container-low p-3 rounded border border-outline-variant flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-label-md">
                    {getInitials(selectedPatient.fullName)}
                  </div>
                  <div>
                    <div className="text-body-md font-medium text-on-surface">
                      {selectedPatient.fullName}
                    </div>
                    <div className="text-label-md text-outline">
                      NIC: {selectedPatient.nic}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="text-error text-label-md hover:underline"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm flex-1">
            <h3 className="text-headline-sm text-on-surface mb-4">Provider &amp; Type</h3>
            <div className="flex flex-col gap-4">
              <Select
                label="Specialty / Department"
                options={SPECIALTY_OPTIONS}
                value={specialty}
                onChange={(event) => setSpecialty(event.target.value)}
              />
              <Select
                label="Appointment Type"
                options={TYPE_OPTIONS}
                value={type}
                onChange={(event) => setType(event.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-7 flex flex-col gap-element-gap">
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm h-full flex flex-col">
            <div className="mb-6 pb-6 border-b border-outline-variant">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-headline-sm text-on-surface">Select Date</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMonthOffset((m) => m - 1)}
                    className="w-8 h-8 flex items-center justify-center rounded border border-outline-variant hover:bg-surface-container-low text-on-surface-variant"
                  >
                    <Icon name="chevron_left" size={18} />
                  </button>
                  <span className="text-body-md font-medium flex items-center">{monthLabel}</span>
                  <button
                    onClick={() => setMonthOffset((m) => m + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded border border-outline-variant hover:bg-surface-container-low text-on-surface-variant"
                  >
                    <Icon name="chevron_right" size={18} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="text-label-md text-outline">
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {days.map((day, index) => {
                  const isPast =
                    day !== null &&
                    monthOffset === 0 &&
                    day < today.getDate();
                  const isSelected = day !== null && day === selectedDay && monthOffset === 0;
                  return (
                    <div
                      key={index}
                      onClick={() => {
                        if (day === null || isPast) return;
                        setSelectedDay(day);
                        setSelectedTime(null);
                      }}
                      className={`py-1 text-body-md rounded ${
                        day === null
                          ? ''
                          : isPast
                            ? 'text-outline cursor-not-allowed'
                            : isSelected
                              ? 'bg-primary-container text-on-primary-container font-medium cursor-pointer'
                              : 'text-on-surface hover:bg-surface-container-low cursor-pointer'
                      }`}
                    >
                      {day ?? ''}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-headline-sm text-on-surface">Available Slots</h3>
                <span className="text-label-md text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded">
                  {monthLabel.split(' ')[0]} {selectedDay}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 overflow-y-auto pr-2 max-h-[300px]">
                {timeBlocks.map((block, blockIndex) => (
                  <div key={block.hourLabel} className="col-span-4">
                    <div className="text-label-md text-outline mt-2 mb-1">{block.hourLabel}</div>
                    <div className="grid grid-cols-4 gap-2">
                      {block.times.map((time, timeIndex) => {
                        const globalIndex = blockIndex * 4 + timeIndex;
                        const booked = isSlotBooked(globalIndex);
                        const isSelected = selectedTime === time;
                        return (
                          <button
                            key={time}
                            type="button"
                            disabled={booked}
                            onClick={() => setSelectedTime(time)}
                            className={`py-2 rounded text-body-md border transition-colors ${
                              booked
                                ? 'bg-surface-container-low border-outline-variant text-outline cursor-not-allowed opacity-60'
                                : isSelected
                                  ? 'bg-primary border-primary text-on-primary font-medium shadow-sm'
                                  : 'bg-surface-container-lowest border-outline-variant text-on-surface hover:border-primary'
                            }`}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={() => navigate(ROUTES.APPOINTMENTS)}>
          Cancel
        </Button>
        <Button variant="primary" icon="event_available" disabled={!canSubmit} onClick={handleSubmit}>
          Confirm Booking
        </Button>
      </div>
    </div>
  );
}
