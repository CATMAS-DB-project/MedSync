import { Drawer, DrawerSection } from '../../../components/layout/Drawer';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { calculateAge, formatDate, getInitials } from '../../../utils/formatters';
import { PATIENT_STATUS_TONE } from '../statusStyles';
import type { Patient } from '../../../types';

export interface PatientDetailDrawerProps {
  patient: Patient | null;
  onClose: () => void;
}

export function PatientDetailDrawer({ patient, onClose }: PatientDetailDrawerProps) {
  return (
    <Drawer
      isOpen={patient !== null}
      onClose={onClose}
      title={patient?.fullName ?? ''}
      subtitle={patient ? `NIC: ${patient.nic}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" icon="event">
            Book Appointment
          </Button>
        </>
      }
    >
      {patient && (
        <>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-headline-sm font-bold shrink-0">
              {getInitials(patient.fullName)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-body-md font-semibold text-on-surface">{patient.fullName}</h3>
                <Badge tone={PATIENT_STATUS_TONE[patient.status]}>{patient.status}</Badge>
              </div>
              <p className="text-body-sm text-on-surface-variant mt-0.5">
                {calculateAge(patient.dateOfBirth) ?? '—'} yrs · {patient.gender}
              </p>
            </div>
          </div>

          <DrawerSection title="Demographics" icon="badge">
            <div className="grid grid-cols-2 gap-4 text-body-sm">
              <div>
                <div className="text-on-surface-variant text-label-md">Date of Birth</div>
                <div className="text-on-surface">{formatDate(patient.dateOfBirth)}</div>
              </div>
              <div>
                <div className="text-on-surface-variant text-label-md">Branch</div>
                <div className="text-on-surface">{patient.branch}</div>
              </div>
              <div>
                <div className="text-on-surface-variant text-label-md">Registered</div>
                <div className="text-on-surface">{formatDate(patient.registeredOn)}</div>
              </div>
              <div>
                <div className="text-on-surface-variant text-label-md">Last Visit</div>
                <div className="text-on-surface">{formatDate(patient.lastVisit)}</div>
              </div>
              {patient.bloodType && (
                <div>
                  <div className="text-on-surface-variant text-label-md">Blood Type</div>
                  <div className="text-on-surface">{patient.bloodType}</div>
                </div>
              )}
            </div>
          </DrawerSection>

          <DrawerSection title="Contact Information" icon="call">
            <div className="grid grid-cols-2 gap-4 text-body-sm">
              <div>
                <div className="text-on-surface-variant text-label-md">Phone</div>
                <div className="text-on-surface">{patient.phone}</div>
              </div>
              <div>
                <div className="text-on-surface-variant text-label-md">Email</div>
                <div className="text-on-surface">{patient.email ?? '—'}</div>
              </div>
              {patient.address && (
                <div className="col-span-2">
                  <div className="text-on-surface-variant text-label-md">Address</div>
                  <div className="text-on-surface">{patient.address}</div>
                </div>
              )}
            </div>
          </DrawerSection>

          {patient.allergies && patient.allergies.length > 0 && (
            <DrawerSection title="Allergies" icon="warning">
              <div className="flex flex-wrap gap-2">
                {patient.allergies.map((allergy) => (
                  <Badge key={allergy} tone="error">
                    {allergy}
                  </Badge>
                ))}
              </div>
            </DrawerSection>
          )}

          {patient.emergencyContact && (
            <DrawerSection title="Emergency Contact" icon="emergency">
              <div className="grid grid-cols-2 gap-4 text-body-sm">
                <div>
                  <div className="text-on-surface-variant text-label-md">Name</div>
                  <div className="text-on-surface">{patient.emergencyContact.name}</div>
                </div>
                <div>
                  <div className="text-on-surface-variant text-label-md">Relationship</div>
                  <div className="text-on-surface">{patient.emergencyContact.relationship}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-on-surface-variant text-label-md">Phone</div>
                  <div className="text-on-surface">{patient.emergencyContact.phone}</div>
                </div>
              </div>
            </DrawerSection>
          )}
        </>
      )}
    </Drawer>
  );
}
