import { Drawer, DrawerSection } from '../../../components/layout/Drawer';
import { Button } from '../../../components/ui/Button';
import { calculateAge, formatDate, formatFullName, getInitials } from '../../../utils/formatters';
import type { Patient } from '../../../types';

export interface PatientDetailDrawerProps {
  patient: Patient | null;
  onClose: () => void;
}

export function PatientDetailDrawer({ patient, onClose }: PatientDetailDrawerProps) {
  const fullName = patient ? formatFullName(patient.firstName, patient.lastName) : '';

  return (
    <Drawer
      isOpen={patient !== null}
      onClose={onClose}
      title={fullName}
      subtitle={patient ? `NIC: ${patient.nicPassportNo}` : undefined}
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
              {getInitials(fullName)}
            </div>
            <div>
              <h3 className="text-body-md font-semibold text-on-surface">{fullName}</h3>
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
                <div className="text-on-surface-variant text-label-md">Registered Branch</div>
                <div className="text-on-surface">{patient.registeredBranchName}</div>
              </div>
              <div>
                <div className="text-on-surface-variant text-label-md">Registered On</div>
                <div className="text-on-surface">{formatDate(patient.createdAt)}</div>
              </div>
            </div>
          </DrawerSection>

          <DrawerSection title="Contact Information" icon="call">
            <div className="grid grid-cols-2 gap-4 text-body-sm">
              {patient.phones && patient.phones.length > 0 ? (
                patient.phones.map((phone) => (
                  <div key={phone.phoneId}>
                    <div className="text-on-surface-variant text-label-md">{phone.phoneType}</div>
                    <div className="text-on-surface">{phone.phoneNumber}</div>
                  </div>
                ))
              ) : (
                <div className="text-on-surface-variant col-span-2">No phone numbers on file.</div>
              )}
              {patient.address && (
                <div className="col-span-2">
                  <div className="text-on-surface-variant text-label-md">Address</div>
                  <div className="text-on-surface">{patient.address}</div>
                </div>
              )}
            </div>
          </DrawerSection>

        </>
      )}
    </Drawer>
  );
}
