export interface TreatmentCatalogueItem {
  serviceCode: string;
  treatmentName: string;
  unitPrice: number;
  category: string;
}

export interface AppointmentTreatment {
  appointmentTreatmentId: number;
  appointmentId: number;
  serviceCode: string;
  treatmentName?: string;
  priceAtTime: number;
  isAmended: boolean;
  amendmentReason?: string;
  originalRecordId?: number;
  recordedAt: string;
}

export interface TreatmentCreateFailure {
  index: number;
  serviceCode?: string;
  error: string;
}

export interface BatchTreatmentCreateResult {
  created: AppointmentTreatment[];
  failed: TreatmentCreateFailure[];
}
