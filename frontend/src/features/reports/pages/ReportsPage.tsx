import { useState } from 'react';
import { Icon } from '../../../components/ui/Icon';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { formatCurrency } from '../../../utils/formatters';
import {
  mockAgingBalances,
  mockAppointmentVolume,
  mockProviderRevenue,
} from '../../../services/mock/reports';

const BRANCH_OPTIONS = [
  { label: 'All Branches', value: 'all' },
  { label: 'Central Branch', value: 'central' },
  { label: 'Northside Clinic', value: 'northside' },
  { label: 'West End Facility', value: 'westend' },
];

const maxVolume = Math.max(...mockAppointmentVolume.map((d) => d.count));

export function ReportsPage() {
  const [branch, setBranch] = useState('all');

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-display-sm text-on-surface">Reports Dashboard</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Key performance metrics and financial overviews.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" icon="download">
            Export PDF
          </Button>
          <Button variant="secondary" icon="table_view">
            Export CSV
          </Button>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <Select
            label="Branch Location"
            options={BRANCH_OPTIONS}
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-label-md text-on-surface-variant">Date Range</label>
          <div className="flex items-center border border-outline-variant rounded bg-surface h-9 px-3">
            <Icon name="calendar_month" className="text-on-surface-variant mr-2" size={16} />
            <span className="text-body-sm text-on-surface">Sep 1, 2026 - Sep 30, 2026</span>
          </div>
        </div>
        <Button variant="secondary">Apply Filters</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Appointment Volume */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 col-span-1 lg:col-span-2 flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-outline-variant pb-2">
            <h2 className="text-headline-sm text-on-surface">Appointment Volume</h2>
            <span className="text-body-sm text-on-surface-variant">Past 7 Days</span>
          </div>
          <div className="flex-1 flex items-end justify-between gap-2 pt-4 pb-2 h-48">
            {mockAppointmentVolume.map((day) => {
              const heightPercent = Math.max(10, (day.count / maxVolume) * 100);
              const isPeak = day.count === maxVolume;
              return (
                <div
                  key={day.label}
                  className="w-full flex flex-col items-center gap-2 h-full justify-end"
                >
                  <div
                    className={`w-full rounded-t relative group cursor-pointer transition-colors ${
                      isPeak
                        ? 'bg-primary-container hover:bg-primary'
                        : 'bg-primary-container/20 hover:bg-primary-container/40'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-inverse-surface text-inverse-on-surface text-xs py-1 px-2 rounded pointer-events-none transition-opacity">
                      {day.count}
                    </div>
                  </div>
                  <span
                    className={`text-label-md text-on-surface-variant ${isPeak ? 'font-bold' : ''}`}
                  >
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Aging Balances */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-outline-variant pb-2">
            <h2 className="text-headline-sm text-on-surface">Aging Balances</h2>
            <Icon name="more_vert" className="text-on-surface-variant cursor-pointer" size={16} />
          </div>
          <div className="flex flex-col gap-3">
            {mockAgingBalances.map((balance) => (
              <div key={balance.label} className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-body-sm text-on-surface">{balance.label}</span>
                  <span className="text-body-md font-semibold text-on-surface">
                    {formatCurrency(balance.amount)}
                  </span>
                </div>
                <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full" style={{ width: `${balance.percentOfMax}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue by Provider */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 col-span-1 lg:col-span-3 flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-outline-variant pb-2">
            <h2 className="text-headline-sm text-on-surface">Revenue by Provider</h2>
            <span className="text-body-sm text-on-surface-variant">This Month</span>
          </div>
          <div className="flex flex-col gap-4">
            {mockProviderRevenue.map((provider) => (
              <div key={provider.name} className="flex items-center gap-4">
                <div className="w-32 truncate text-body-sm text-on-surface">{provider.name}</div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="bg-surface-container-high h-6 rounded flex-1 overflow-hidden">
                    <div
                      className="bg-primary-container h-full flex items-center px-2 text-on-primary-container text-xs font-medium"
                      style={{ width: `${provider.percentOfMax}%` }}
                    >
                      {provider.amountLabel}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
