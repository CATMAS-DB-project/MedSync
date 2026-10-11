import { DropdownMenu } from '../../../components/ui/DropdownMenu';
import type { DropdownMenuItem } from '../../../components/ui/DropdownMenu';
import { IconButton } from '../../../components/ui/IconButton';
import type { Appointment, Role } from '../../../types';

export interface AppointmentRowActionsProps {
  appointment: Appointment;
  role: Role | undefined;
  onViewPatient: (patientId: number) => void;
  onCancel: (appointment: Appointment) => void;
  onOpenConsultation: (appointmentId: number) => void;
}

export function buildAppointmentActions({
  appointment,
  role,
  onViewPatient,
  onCancel,
  onOpenConsultation,
}: AppointmentRowActionsProps): DropdownMenuItem[] {
  const items: DropdownMenuItem[] = [
    {
      id: 'view-patient',
      label: 'View patient',
      icon: 'person',
      onSelect: () => onViewPatient(appointment.patientId),
    },
  ];

  if (role === 'Doctor') {
    items.push({
      id: 'open-consultation',
      label: 'Open consultation',
      icon: 'clinical_notes',
      onSelect: () => onOpenConsultation(appointment.appointmentId),
    });
  } else if (role === 'Admin') {
    items.push({
      id: 'view-consultation',
      label: 'View consultation',
      icon: 'clinical_notes',
      onSelect: () => onOpenConsultation(appointment.appointmentId),
    });
  }

  if (role === 'Receptionist' && appointment.status === 'Scheduled') {
    items.push({
      id: 'cancel',
      label: 'Cancel appointment',
      icon: 'event_busy',
      danger: true,
      onSelect: () => onCancel(appointment),
    });
  }

  return items;
}

export function AppointmentRowActions(props: AppointmentRowActionsProps) {
  const items = buildAppointmentActions(props);
  return (
    <DropdownMenu
      ariaLabel="Appointment actions"
      trigger={<IconButton icon="more_horiz" size="sm" aria-label="Actions" />}
      items={items}
    />
  );
}
