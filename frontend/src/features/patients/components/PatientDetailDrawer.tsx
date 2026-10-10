import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer } from '../../../components/layout/Drawer';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Avatar } from '../../../components/ui/Avatar';
import { Tabs } from '../../../components/ui/Tabs';
import type { TabItem } from '../../../components/ui/Tabs';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { fetchPatientById } from '../../../services/api/patients';
import { fetchAppointments } from '../../../services/api/appointments';
import { fetchInvoices } from '../../../services/api/invoices';
import { ROUTES } from '../../../constants/routes';
import {
  calculateAge,
  formatCurrency,
  formatDate,
  formatFullName,
  formatTime,
} from '../../../utils/formatters';
import { APPOINTMENT_STATUS_TONE } from '../../appointments/statusStyles';
import { INVOICE_STATUS_TONE } from '../../billing/statusStyles';
import { PatientFormModal } from './PatientFormModal';

export interface PatientDetailDrawerProps {
  patientId: number | null;
  onClose: () => void;
  /** Optional callback fired after the patient record was saved from within the drawer. */
  onChanged?: () => void;
}

type TabKey = 'overview' | 'insurance' | 'appointments' | 'invoices';

export function PatientDetailDrawer(props: PatientDetailDrawerProps) {
  // Re-mount whenever the patient changes so nothing leaks between patients.
  return <PatientDetailDrawerInner key={props.patientId ?? 'closed'} {...props} />;
}

function PatientDetailDrawerInner({
  patientId,
  onClose,
  onChanged,
}: PatientDetailDrawerProps) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isReceptionist = currentUser?.role === 'Receptionist';
  const isOpen = patientId !== null;

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [formOpen, setFormOpen] = useState(false);

  const patient = useAsync(
    () => (patientId === null ? Promise.resolve(null) : fetchPatientById(patientId)),
    [patientId],
  );

  const appointments = useAsync(
    () =>
      patientId === null || activeTab !== 'appointments'
        ? Promise.resolve(null)
        : fetchAppointments({ patientId, pageSize: 50 }),
    [patientId, activeTab],
  );

  const invoices = useAsync(
    () =>
      patientId === null || activeTab !== 'invoices'
        ? Promise.resolve(null)
        : fetchInvoices({ patientId, pageSize: 50 }),
    [patientId, activeTab],
  );

  const data = patientId !== null && patient.data?.patientId === patientId ? patient.data : null;
  const fullName = data ? formatFullName(data.firstName, data.lastName) : '';

  const tabs: TabItem<TabKey>[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'appointments', label: 'Appointments' },
    { value: 'invoices', label: 'Invoices' },
  ];

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={fullName || 'Patient'}
        subtitle={data ? `NIC: ${data.nicPassportNo}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {isReceptionist && data && (
              <>
                <Button
                  variant="secondary"
                  icon="edit"
                  onClick={() => setFormOpen(true)}
                >
                  Edit
                </Button>
                <Button
                  variant="primary"
                  icon="event"
                  onClick={() =>
                    navigate(`${ROUTES.APPOINTMENT_BOOKING}?patientId=${data.patientId}`)
                  }
                >
                  Book appointment
                </Button>
              </>
            )}
          </>
        }
      >
        {patient.error && (
          <ErrorBanner message={patient.error} onRetry={patient.reload} />
        )}

        {!data && patient.isLoading && (
          <div className="flex flex-col gap-3">
            <Skeleton height={72} rounded="xl" />
            <Skeleton height={140} rounded="xl" />
            <Skeleton height={120} rounded="xl" />
          </div>
        )}

        {data && (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-4">
              <Avatar name={fullName} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-headline-sm text-on-surface">{fullName}</div>
                <div className="truncate text-label-md text-on-surface-variant">
                  {data.nicPassportNo}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone="neutral" pill>
                    {calculateAge(data.dateOfBirth) ?? '—'} yrs
                  </Badge>
                  <Badge tone="info" pill>
                    {data.gender}
                  </Badge>
                </div>
              </div>
            </div>

            <Tabs<TabKey>
              items={tabs}
              value={activeTab}
              onChange={setActiveTab}
              ariaLabel="Patient sections"
            />

            {activeTab === 'overview' && <OverviewTab patient={data} />}
            {activeTab === 'insurance' && <InsuranceTab patient={data} />}
            {activeTab === 'appointments' && (
              <AppointmentsTab
                data={appointments.data?.items ?? []}
                loading={appointments.isLoading}
                error={appointments.error}
                onRetry={appointments.reload}
              />
            )}
            {activeTab === 'invoices' && (
              <InvoicesTab
                data={invoices.data?.items ?? []}
                loading={invoices.isLoading}
                error={invoices.error}
                onRetry={invoices.reload}
              />
            )}
          </>
        )}
      </Drawer>

      {isReceptionist && data && (
        <PatientFormModal
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          patientId={data.patientId}
          onSaved={() => {
            setFormOpen(false);
            patient.reload();
            onChanged?.();
          }}
          onViewExisting={() => {
            setFormOpen(false);
            patient.reload();
          }}
        />
      )}
    </>
  );
}

// ---------------- Tabs ----------------

function OverviewTab({ patient }: { patient: import('../../../types').Patient }) {
  return (
    <div className="flex flex-col gap-5">
      <Section title="Demographics">
        <KeyValue label="Full name" value={`${patient.firstName} ${patient.lastName}`} />
        <KeyValue label="NIC / Passport" value={patient.nicPassportNo} />
        <KeyValue label="Date of birth" value={formatDate(patient.dateOfBirth)} />
        <KeyValue label="Gender" value={patient.gender} />
        <KeyValue
          label="Registered branch"
          value={patient.registeredBranchName ?? '—'}
        />
        <KeyValue label="Registered on" value={formatDate(patient.createdAt)} />
      </Section>

      <Section title="Contact">
        {patient.phones && patient.phones.length > 0 ? (
          patient.phones.map((phone) => (
            <KeyValue
              key={phone.phoneId}
              label={phone.phoneType}
              value={phone.phoneNumber}
            />
          ))
        ) : (
          <p className="text-body-sm text-on-surface-variant">No phone numbers</p>
        )}
        {patient.address && <KeyValue label="Address" value={patient.address} />}
      </Section>

      <Section title="Guardians">
        {patient.guardians && patient.guardians.length > 0 ? (
          patient.guardians.map((link) => (
            <KeyValue
              key={link.guardianId}
              label={link.relationship}
              value={
                link.guardian
                  ? formatFullName(link.guardian.firstName, link.guardian.lastName)
                  : `Guardian #${link.guardianId}`
              }
            />
          ))
        ) : (
          <p className="text-body-sm text-on-surface-variant">No guardians linked</p>
        )}
      </Section>
    </div>
  );
}

function InsuranceTab({ patient }: { patient: import('../../../types').Patient }) {
  const policies = patient.insurance ?? [];
  if (policies.length === 0) {
    return <EmptyState icon="health_and_safety" title="No insurance policy on file" />;
  }
  return (
    <div className="flex flex-col gap-3">
      {policies.map((policy) => (
        <div
          key={policy.policyId}
          className="flex items-start justify-between gap-3 rounded-xl bg-surface-container-low p-3"
        >
          <div className="min-w-0">
            <div className="text-body-sm font-medium text-on-surface">
              {policy.providerName}
            </div>
            <div className="text-label-md text-on-surface-variant">
              {policy.coverageLevel}
            </div>
            <div className="mt-0.5 font-mono text-label-sm text-on-surface-variant">
              {policy.policyId}
            </div>
          </div>
          <Badge
            tone={policy.status === 'Active' ? 'success' : 'neutral'}
            dot
            pill
          >
            {policy.status}
          </Badge>
        </div>
      ))}
    </div>
  );
}

interface AppointmentsTabProps {
  data: import('../../../types').Appointment[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function AppointmentsTab({ data, loading, error, onRetry }: AppointmentsTabProps) {
  if (error) return <ErrorBanner message={error} onRetry={onRetry} />;
  if (loading && data.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} height={56} rounded="xl" />
        ))}
      </div>
    );
  }
  if (data.length === 0) {
    return <EmptyState icon="event_busy" title="No appointments" />;
  }
  return (
    <ul className="flex flex-col gap-2">
      {data.map((item) => (
        <li
          key={item.appointmentId}
          className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low p-3"
        >
          <div className="min-w-0">
            <div className="text-body-sm font-medium text-on-surface">
              {formatDate(item.appointmentDate)} · {formatTime(item.appointmentTime)}
            </div>
            <div className="truncate text-label-md text-on-surface-variant">
              {item.doctorName ?? '—'}
            </div>
          </div>
          <Badge tone={APPOINTMENT_STATUS_TONE[item.status]} dot pill>
            {item.status}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

interface InvoicesTabProps {
  data: import('../../../types').Invoice[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function InvoicesTab({ data, loading, error, onRetry }: InvoicesTabProps) {
  if (error) return <ErrorBanner message={error} onRetry={onRetry} />;
  if (loading && data.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} height={56} rounded="xl" />
        ))}
      </div>
    );
  }
  if (data.length === 0) {
    return <EmptyState icon="receipt_long" title="No invoices" />;
  }
  return (
    <ul className="flex flex-col gap-2">
      {data.map((item) => (
        <li
          key={item.invoiceId}
          className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low p-3"
        >
          <div className="min-w-0">
            <div className="text-body-sm font-medium text-on-surface">
              #{item.invoiceId}
            </div>
            <div className="text-label-md text-on-surface-variant">
              {formatCurrency(item.payableAmount ?? item.subtotalAmount)}
            </div>
          </div>
          <Badge tone={INVOICE_STATUS_TONE[item.status]} dot pill>
            {item.status}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-label-sm uppercase tracking-wider text-on-surface-variant">
        {title}
      </h3>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-outline-variant/60 py-1.5 last:border-b-0">
      <span className="shrink-0 text-label-md text-on-surface-variant">{label}</span>
      <span className="min-w-0 truncate text-right text-body-sm text-on-surface">
        {value}
      </span>
    </div>
  );
}
