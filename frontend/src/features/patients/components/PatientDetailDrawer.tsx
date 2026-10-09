import { useNavigate } from 'react-router-dom';
import { Drawer, DrawerSection } from '../../../components/layout/Drawer';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { useAuth } from '../../../context/AuthContext';
import { ROUTES } from '../../../constants/routes';
import { useAsync } from '../../../hooks/useAsync';
import { fetchPatientById } from '../../../services/api/patients';
import { calculateAge, formatDate, formatFullName, getInitials } from '../../../utils/formatters';

export interface PatientDetailDrawerProps {
  patientId: number | null;
  onClose: () => void;
}

export function PatientDetailDrawer({ patientId, onClose }: PatientDetailDrawerProps) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const canBook = currentUser?.role !== 'Doctor';

  // Fetch the full profile (phones, guardians, insurance) whenever a patient is opened.
  const { data: fetched, error, isLoading } = useAsync(
    () => (patientId === null ? Promise.resolve(null) : fetchPatientById(patientId)),
    [patientId],
  );
  const patient = patientId !== null && fetched?.patientId === patientId ? fetched : null;
  const fullName = patient ? formatFullName(patient.firstName, patient.lastName) : '';

  return (
    <Drawer
      isOpen={patientId !== null}
      onClose={onClose}
      title={fullName || 'Patient'}
      subtitle={patient ? `NIC: ${patient.nicPassportNo}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {canBook && patient && (
            <Button
              variant="primary"
              icon="event"
              onClick={() =>
                navigate(ROUTES.APPOINTMENT_BOOKING, { state: { patientId: patient.patientId } })
              }
            >
              Book Appointment
            </Button>
          )}
        </>
      }
    >
      {isLoading && !patient && (
        <p className="text-body-sm text-on-surface-variant">Loading patient…</p>
      )}
      {error && <p className="text-body-sm text-error">{error}</p>}

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
                <div className="text-on-surface">{patient.registeredBranchName ?? '—'}</div>
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

          <DrawerSection title="Guardians / Emergency Contacts" icon="family_restroom">
            {patient.guardians && patient.guardians.length > 0 ? (
              <ul className="flex flex-col gap-2 text-body-sm">
                {patient.guardians.map((link) => (
                  <li key={link.guardianId} className="flex items-center justify-between">
                    <span className="text-on-surface">
                      {link.guardian
                        ? formatFullName(link.guardian.firstName, link.guardian.lastName)
                        : `Guardian #${link.guardianId}`}
                    </span>
                    <Badge tone="neutral">{link.relationship}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-on-surface-variant">No guardians linked.</p>
            )}
          </DrawerSection>

          <DrawerSection title="Insurance" icon="health_and_safety">
            {patient.insurance && patient.insurance.length > 0 ? (
              <ul className="flex flex-col gap-2 text-body-sm">
                {patient.insurance.map((policy) => (
                  <li key={policy.policyId} className="flex items-center justify-between">
                    <span className="text-on-surface">
                      {policy.providerName} · {policy.coverageLevel}
                      <span className="block font-mono text-xs text-on-surface-variant">
                        {policy.policyId}
                      </span>
                    </span>
                    <Badge tone={policy.status === 'Active' ? 'success' : 'neutral'}>
                      {policy.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-on-surface-variant">No insurance policy on file.</p>
            )}
          </DrawerSection>
        </>
      )}
    </Drawer>
  );
}
