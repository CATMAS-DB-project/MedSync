export interface DailyVolume {
  label: string;
  count: number;
}

export const mockAppointmentVolume: DailyVolume[] = [
  { label: 'Mon', count: 24 },
  { label: 'Tue', count: 42 },
  { label: 'Wed', count: 68 },
  { label: 'Thu', count: 35 },
  { label: 'Fri', count: 50 },
];

export interface AgingBalance {
  label: string;
  amount: number;
  percentOfMax: number;
}

export const mockAgingBalances: AgingBalance[] = [
  { label: '0-30 Days', amount: 12450, percentOfMax: 70 },
  { label: '31-60 Days', amount: 4200, percentOfMax: 35 },
  { label: '61-90 Days', amount: 1800, percentOfMax: 15 },
  { label: '90+ Days', amount: 900, percentOfMax: 8 },
];

export interface ProviderRevenue {
  name: string;
  amountLabel: string;
  percentOfMax: number;
}

export const mockProviderRevenue: ProviderRevenue[] = [
  { name: 'Dr. A. Smith', amountLabel: '$45k', percentOfMax: 85 },
  { name: 'Dr. J. Doe', amountLabel: '$32k', percentOfMax: 65 },
  { name: 'NP S. Lee', amountLabel: '$18k', percentOfMax: 40 },
];
