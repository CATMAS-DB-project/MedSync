export interface TreatmentCatalogueItem {
  id: string;
  name: string;
  code: string;
  price: number;
}

export const mockTreatmentCatalogue: TreatmentCatalogueItem[] = [
  { id: 'tc-1', name: 'Standard Consultation', code: 'CPT: 99213', price: 125 },
  { id: 'tc-2', name: 'Extended Consultation', code: 'CPT: 99214', price: 175 },
  { id: 'tc-3', name: 'MRI Review & Analysis', code: 'CPT: 76140', price: 85 },
  { id: 'tc-4', name: 'Prescription Refill', code: 'Meds Mgmt', price: 45 },
  { id: 'tc-5', name: 'Blood Pressure Check', code: 'CPT: 99401', price: 20 },
  { id: 'tc-6', name: 'Wound Dressing', code: 'CPT: 97597', price: 60 },
];
