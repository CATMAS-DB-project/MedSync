import { useState } from 'react';
import { Icon } from '../../../components/ui/Icon';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';

const DOCTOR_OPTIONS = [
  { label: 'First Available', value: '' },
  { label: 'Dr. Silva (General) - 1 Waiting', value: 'dr_silva' },
  { label: 'Dr. Chen (Pediatrics) - Available', value: 'dr_chen' },
  { label: 'Dr. Rodriguez (Urgent) - 3 Waiting', value: 'dr_rodriguez' },
];

const DOCTOR_LABELS: Record<string, string> = {
  '': 'Dr. Silva',
  dr_silva: 'Dr. Silva',
  dr_chen: 'Dr. Chen',
  dr_rodriguez: 'Dr. Rodriguez',
};

export function WalkInPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [patientQuery, setPatientQuery] = useState('');
  const [reason, setReason] = useState('');
  const [doctor, setDoctor] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    // Simulated booking delay - will become a real API call once the
    // backend is ready.
    setTimeout(() => {
      setIsSubmitting(false);
      setIsRegistered(true);
    }, 800);
  };

  const handleReset = () => {
    setIsRegistered(false);
    setPatientQuery('');
    setReason('');
    setDoctor('');
  };

  return (
    <div className="flex justify-center items-start pt-8">
      {!isRegistered ? (
        <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-lg p-6">
          <div className="mb-6 border-b border-outline-variant pb-4">
            <h1 className="text-headline-sm text-on-surface">New Walk-In</h1>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Register an unscheduled arrival.
            </p>
          </div>
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1">
              <Input
                label="Patient"
                icon="search"
                placeholder="Search by name, DOB, or ID..."
                value={patientQuery}
                onChange={(event) => setPatientQuery(event.target.value)}
              />
              <div className="flex justify-end mt-1">
                <button
                  type="button"
                  className="text-primary text-label-md hover:underline flex items-center gap-1"
                >
                  <Icon name="add" size={14} />
                  New Patient
                </button>
              </div>
            </div>

            <Input
              label="Reason for Visit (Brief)"
              placeholder="e.g., Fever, Sprained Ankle"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
            />

            <Select
              label="Assign To (Current Branch)"
              options={DOCTOR_OPTIONS}
              value={doctor}
              onChange={(event) => setDoctor(event.target.value)}
            />

            <Button
              type="submit"
              variant="primary"
              icon={isSubmitting ? undefined : 'how_to_reg'}
              isLoading={isSubmitting}
              className="w-full mt-4"
              size="md"
            >
              {isSubmitting ? 'Booking...' : 'Book Walk-In'}
            </Button>
          </form>
        </div>
      ) : (
        <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-lg p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center mb-6">
            <Icon name="check_circle" filled className="text-secondary" size={32} />
          </div>
          <h2 className="text-headline-sm text-on-surface mb-2">Walk-In Registered</h2>
          <p className="text-body-md text-on-surface-variant mb-6">Patient added to the queue.</p>
          <div className="bg-surface-container-low w-full p-6 rounded border border-outline-variant mb-8">
            <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">
              Estimated Time
            </p>
            <div className="text-display-sm text-primary mb-1">3:15 PM</div>
            <div className="text-body-md text-on-surface flex items-center justify-center gap-2">
              <Icon name="stethoscope" size={18} />
              {DOCTOR_LABELS[doctor] ?? 'Dr. Silva'}
            </div>
          </div>
          <Button variant="secondary" className="w-full" onClick={handleReset}>
            Register Another
          </Button>
        </div>
      )}
    </div>
  );
}
