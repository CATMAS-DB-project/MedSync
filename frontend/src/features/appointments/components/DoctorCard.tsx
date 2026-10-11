import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Icon } from '../../../components/ui/Icon';
import { formatCurrency } from '../../../utils/formatters';
import { cn } from '../../../utils/cn';
import type { DoctorOption } from '../../../services/api/doctorOptions';

export interface DoctorCardProps {
  doctor: DoctorOption;
  selected: boolean;
  onSelect: () => void;
}

export function DoctorCard({
  doctor,
  selected,
  onSelect,
}: DoctorCardProps) {
  const visibleSpecialties = doctor.specialties.slice(0, 3);
  const extraCount = Math.max(0, doctor.specialties.length - visibleSpecialties.length);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full flex-col gap-3 rounded-2xl border bg-surface-container-lowest p-4 text-left',
        'transition-all duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        selected
          ? 'border-primary bg-primary-container/20 ring-2 ring-primary'
          : 'border-outline-variant hover:border-primary/40 hover:bg-primary-container/10',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={doctor.doctorName} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-body-md font-semibold text-on-surface">
              Dr. {doctor.doctorName}
            </span>
            {selected && (
              <Icon
                name="check_circle"
                filled
                size={18}
                className="shrink-0 text-primary"
              />
            )}
          </div>
          {visibleSpecialties.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {visibleSpecialties.map((specialty) => (
                <Badge key={specialty} tone="primary" pill>
                  {specialty}
                </Badge>
              ))}
              {extraCount > 0 && (
                <Badge tone="neutral" pill>
                  +{extraCount}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-outline-variant pt-3">
        <span className="text-label-md text-on-surface-variant">Consultation fee</span>
        <span className="text-body-sm font-semibold text-on-surface">
          {formatCurrency(doctor.consultationFee)}
        </span>
      </div>
    </button>
  );
}
