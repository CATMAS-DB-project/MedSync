import { useNavigate } from 'react-router-dom';
import { Drawer, DrawerSection } from '../../../components/layout/Drawer';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { useAuth } from '../../../context/AuthContext';
import { ROUTES } from '../../../constants/routes';
import { useAsync } from '../../../hooks/useAsync';
import { fetchPatientById } from '../../../services/api/patients';
import { calculateAge, formatDate, formatFullName } from '../../../utils/formatters';

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
      headerVariant="accent"
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
        <div role="status" className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-body-sm text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-primary" aria-hidden="true">progress_activity</span>
          Loading patient details…
        </div>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-error/30 bg-error-container/50 p-4 text-body-sm text-on-error-container">
          <span className="material-symbols-outlined mt-0.5 shrink-0" aria-hidden="true">error</span>
          {error}
        </p>
      )}

      {patient && (
        <>
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-elevated">
          <DrawerSection title="Demographics" icon="badge">
            <div className="grid grid-cols-1 gap-3 text-body-sm sm:grid-cols-2">
              <div className="rounded-lg bg-surface-container-low p-3">
                <div className="text-label-md text-on-surface-variant">Age</div>
                <div className="text-on-surface">{calculateAge(patient.dateOfBirth) ?? '—'} yrs</div>
              </div>
              <div className="rounded-lg bg-surface-container-low p-3">
                <div className="text-label-md text-on-surface-variant">Gender</div>
                <div className="text-on-surface">{patient.gender}</div>
              </div>
              <div className="rounded-lg bg-surface-container-low p-3">
                <div className="text-label-md text-on-surface-variant">Date of Birth</div>
                <div className="text-on-surface">{formatDate(patient.dateOfBirth)}</div>
              </div>
              <div className="rounded-lg bg-surface-container-low p-3">
                <div className="text-label-md text-on-surface-variant">Registered Branch</div>
                <div className="text-on-surface">{patient.registeredBranchName ?? '—'}</div>
              </div>
              <div className="rounded-lg bg-surface-container-low p-3">
                <div className="text-label-md text-on-surface-variant">Registered On</div>
                <div className="text-on-surface">{formatDate(patient.createdAt)}</div>
              </div>
            </div>
          </DrawerSection>
          </div>

          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-elevated">
          <DrawerSection title="Contact Information" icon="call">
            <div className="grid grid-cols-1 gap-3 text-body-sm sm:grid-cols-2">
              {patient.phones && patient.phones.length > 0 ? (
                patient.phones.map((phone) => (
                  <div key={phone.phoneId} className="rounded-lg bg-surface-container-low p-3">
                    <div className="text-on-surface-variant text-label-md">{phone.phoneType}</div>
                    <div className="text-on-surface">{phone.phoneNumber}</div>
                  </div>
                ))
              ) : (
                <div className="text-on-surface-variant col-span-2">No phone numbers on file.</div>
              )}
              {patient.address && (
                <div className="col-span-2 rounded-lg bg-surface-container-low p-3">
                  <div className="text-on-surface-variant text-label-md">Address</div>
                  <div className="text-on-surface">{patient.address}</div>
                </div>
              )}
            </div>
          </DrawerSection>
          </div>

          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-elevated">
          <DrawerSection title="Guardians / Emergency Contacts" icon="family_restroom">
            {patient.guardians && patient.guardians.length > 0 ? (
              <ul className="flex flex-col gap-2 text-body-sm">
                {patient.guardians.map((link) => (
                  <li key={link.guardianId} className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/70 bg-surface-container-low p-3">
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
          </div>

          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-elevated">
          <DrawerSection title="Insurance" icon="health_and_safety">
            {patient.insurance && patient.insurance.length > 0 ? (
              <ul className="flex flex-col gap-2 text-body-sm">
                {patient.insurance.map((policy) => (
                  <li key={policy.policyId} className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/70 bg-surface-container-low p-3">
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
          </div>
        </>
      )}
    </Drawer>
  );
}
