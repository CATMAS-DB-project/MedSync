// Local helpers for the Appointments feature. Not exported from anywhere else.

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** Monday-start week. */
export function startOfWeek(iso: string): string {
  const date = parseIsoDate(iso);
  const day = date.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toIsoDate(date);
}

export function weekDaysFrom(startIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startIso, i));
}

export function formatDayLabel(iso: string): string {
  const d = parseIsoDate(iso);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatWeekLabel(startIso: string, endIso: string): string {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  const startMonthShort = start.toLocaleDateString('en-GB', { month: 'short' });
  const endMonthShort = end.toLocaleDateString('en-GB', { month: 'short' });

  if (sameMonth) {
    return `${start.getDate()} – ${end.getDate()} ${startMonthShort} ${start.getFullYear()}`;
  }
  if (sameYear) {
    return `${start.getDate()} ${startMonthShort} – ${end.getDate()} ${endMonthShort} ${start.getFullYear()}`;
  }
  return `${formatDayLabel(startIso)} – ${formatDayLabel(endIso)}`;
}

export function weekdayShort(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString('en-GB', { weekday: 'short' });
}

export function dayNumber(iso: string): string {
  return String(parseIsoDate(iso).getDate()).padStart(2, '0');
}
