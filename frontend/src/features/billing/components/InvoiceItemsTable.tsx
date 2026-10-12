import { formatCurrency } from '../../../utils/formatters';
import type { InvoiceLineItem } from '../../../types';

export interface InvoiceItemsTableProps {
  lineItems: InvoiceLineItem[];
}

export function InvoiceItemsTable({ lineItems }: InvoiceItemsTableProps) {
  if (lineItems.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-container-low p-4 text-body-sm text-on-surface-variant">
        No treatments logged
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-surface-container-low">
      <table className="w-full">
        <tbody>
          {lineItems.map((item) => (
            <tr
              key={item.appointmentTreatmentId}
              className="border-b border-outline-variant/60 last:border-b-0"
            >
              <td className="px-3 py-2.5">
                <div className="text-body-sm font-medium text-on-surface">
                  {item.treatmentName}
                </div>
                <div className="text-label-md text-on-surface-variant">
                  <span className="font-mono">{item.serviceCode}</span>
                  {item.isAmended && ' · amended'}
                </div>
              </td>
              <td className="px-3 py-2.5 text-right text-body-sm tabular-nums text-on-surface">
                {formatCurrency(item.priceAtTime)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
