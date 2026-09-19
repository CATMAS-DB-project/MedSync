import { useMemo, useState } from 'react';
import { Icon } from '../../../components/ui/Icon';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { TextArea } from '../../../components/ui/TextArea';
import { mockPatients } from '../../../services/mock/patients';
import { mockTreatmentCatalogue } from '../../../services/mock/treatmentCatalogue';
import { calculateAge, formatCurrency, formatFullName, getInitials } from '../../../utils/formatters';

const activePatient = mockPatients[0];
const activePatientName = formatFullName(activePatient.firstName, activePatient.lastName);

export function ConsultationPage() {
  const [notes, setNotes] = useState('');
  const [catalogueQuery, setCatalogueQuery] = useState('');
  // Keyed by service_code, matching appointment_treatment.service_code.
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(
    () => new Set(['CONS-STD', 'IMG-MRI']),
  );

  const filteredCatalogue = useMemo(
    () =>
      mockTreatmentCatalogue.filter((item) =>
        item.treatmentName.toLowerCase().includes(catalogueQuery.toLowerCase()),
      ),
    [catalogueQuery],
  );

  const selectedItems = mockTreatmentCatalogue.filter((item) =>
    selectedCodes.has(item.serviceCode),
  );
  const totalCost = selectedItems.reduce((sum, item) => sum + item.unitPrice, 0);

  const toggleItem = (serviceCode: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(serviceCode)) {
        next.delete(serviceCode);
      } else {
        next.add(serviceCode);
      }
      return next;
    });
  };

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col gap-6">
      {/* Patient Header */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-elevated">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-headline-sm font-bold border border-outline-variant shrink-0">
            {getInitials(activePatientName)}
          </div>
          <div>
            <h1 className="text-display-sm text-on-surface">{activePatientName}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-body-md text-on-surface-variant">
                Age: {calculateAge(activePatient.dateOfBirth) ?? '—'}
              </span>
              <span className="w-1 h-1 rounded-full bg-outline-variant" />
              <span className="text-body-md text-on-surface-variant">
                Patient #{activePatient.patientId}
              </span>
              <span className="w-1 h-1 rounded-full bg-outline-variant" />
              <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container text-label-md">
                Follow-up
              </span>
            </div>
          </div>
        </div>
        <div className="bg-surface-container-low p-3 rounded border border-outline-variant max-w-sm w-full md:w-auto">
          <div className="text-label-md text-on-surface-variant mb-1 uppercase tracking-wider">
            Appointment Reason
          </div>
          <div className="text-body-md text-on-surface font-medium">
            Persistent migraine assessment, review of recent MRI scans.
          </div>
        </div>
      </div>

      {/* Working Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        {/* Clinical Notes */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
              <h2 className="text-headline-sm text-on-surface flex items-center gap-2">
                <Icon name="edit_document" className="text-primary" />
                Clinical Notes
              </h2>
              <button className="text-label-md px-3 py-1.5 rounded hover:bg-surface-container-high text-primary transition-colors">
                Use Template
              </button>
            </div>
            <div className="flex-1 relative">
              <TextArea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Enter objective findings, assessment, and plan here..."
                className="w-full h-full min-h-[240px] border-none rounded-none focus:ring-0"
                rows={10}
              />
              <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-surface-container-low px-3 py-2 rounded-full border border-outline-variant shadow-elevated cursor-pointer hover:bg-surface-container-high transition-colors">
                <Icon name="mic" className="text-primary" size={16} />
                <span className="text-label-md text-on-surface-variant">Dictate (Ctrl+M)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Treatment Catalogue & Billing */}
        <div className="flex flex-col bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden h-full">
          <div className="px-4 py-3 border-b border-outline-variant bg-surface-container-low">
            <h2 className="text-headline-sm text-on-surface flex items-center gap-2">
              <Icon name="medication" className="text-secondary" />
              Treatment Catalogue
            </h2>
            <div className="mt-3">
              <Input
                icon="search"
                placeholder="Search treatments..."
                value={catalogueQuery}
                onChange={(event) => setCatalogueQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {filteredCatalogue.map((item) => {
              const isSelected = selectedCodes.has(item.serviceCode);
              return (
                <button
                  key={item.serviceCode}
                  type="button"
                  onClick={() => toggleItem(item.serviceCode)}
                  className={`w-full flex items-center justify-between p-2 mb-1 rounded cursor-pointer border transition-colors text-left group ${
                    isSelected
                      ? 'bg-surface-container-high border-primary'
                      : 'border-transparent hover:border-outline-variant hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Icon
                      name={isSelected ? 'check_box' : 'check_box_outline_blank'}
                      filled={isSelected}
                      size={18}
                      className={`mt-0.5 ${
                        isSelected ? 'text-primary' : 'text-outline group-hover:text-primary'
                      }`}
                    />
                    <div>
                      <div
                        className={`text-body-sm text-on-surface ${isSelected ? 'font-medium' : ''}`}
                      >
                        {item.treatmentName}
                      </div>
                      <div className="text-label-md text-on-surface-variant">
                        {item.serviceCode} · {item.category}
                      </div>
                    </div>
                  </div>
                  <div className={`text-body-sm ${isSelected ? 'font-medium' : ''}`}>
                    {formatCurrency(item.unitPrice)}
                  </div>
                </button>
              );
            })}
            {filteredCatalogue.length === 0 && (
              <p className="text-body-sm text-on-surface-variant text-center py-6">
                No treatments match your search.
              </p>
            )}
          </div>

          <div className="border-t border-outline-variant bg-surface-container-low p-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-body-md text-on-surface-variant">
                Total Cost ({selectedItems.length} item{selectedItems.length === 1 ? '' : 's'})
              </span>
              <span className="text-headline-sm text-on-surface font-semibold">
                {formatCurrency(totalCost)}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="primary" icon="check_circle" className="w-full">
                Complete &amp; Send to Billing
              </Button>
              <Button variant="secondary" className="w-full">
                Save Draft
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
