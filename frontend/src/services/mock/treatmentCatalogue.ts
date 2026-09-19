import type { TreatmentCatalogueItem } from '../../types';

export const mockTreatmentCatalogue: TreatmentCatalogueItem[] = [
  { serviceCode: 'CONS-STD', treatmentName: 'Standard Consultation', unitPrice: 125, category: 'Consultation' },
  { serviceCode: 'CONS-EXT', treatmentName: 'Extended Consultation', unitPrice: 175, category: 'Consultation' },
  { serviceCode: 'IMG-MRI', treatmentName: 'MRI Review & Analysis', unitPrice: 85, category: 'Imaging' },
  { serviceCode: 'MED-REFILL', treatmentName: 'Prescription Refill', unitPrice: 45, category: 'Medication' },
  { serviceCode: 'VIT-BP', treatmentName: 'Blood Pressure Check', unitPrice: 20, category: 'Vitals' },
  { serviceCode: 'PROC-DRESS', treatmentName: 'Wound Dressing', unitPrice: 60, category: 'Procedure' },
];
