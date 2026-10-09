import { ApiError } from './ApiError';
import { addGuardianPhone } from './guardians';
import { addPatientInsurance } from './insurance';
import type { AddInsuranceInput } from './insurance';
import { linkGuardianToPatient } from './patientGuardians';
import { addPatientPhone } from './patientPhones';
import { fetchPatientById, registerPatient } from './patients';
import type { RegisterPatientInput } from './patients';
import type { Patient, PhoneType } from '../../types';

export type EmergencyContactInput =
  | { relationship: string; existingGuardianId: number }
  | {
      relationship: string;
      firstName: string;
      lastName: string;
      nic?: string;
      address?: string;
      phoneNumber?: string;
      phoneType?: PhoneType;
    };

export interface RegisterPatientWithDetailsInput {
  patient: RegisterPatientInput;
  phones?: { phoneNumber: string; phoneType: PhoneType }[];
  insurance?: AddInsuranceInput;
  emergencyContact?: EmergencyContactInput;
}

export type RegistrationStep = 'phone' | 'insurance' | 'emergencyContact' | 'emergencyContactPhone';

export interface RegistrationFailure {
  step: RegistrationStep;
  message: string;
}

export interface RegisterPatientWithDetailsResult {
  patient: Patient;
  failures: RegistrationFailure[];
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Unexpected error';
}

export async function registerPatientWithDetails(
  input: RegisterPatientWithDetailsInput,
): Promise<RegisterPatientWithDetailsResult> {
  const created = await registerPatient(input.patient);
  const failures: RegistrationFailure[] = [];

  for (const phone of input.phones ?? []) {
    try {
      await addPatientPhone(created.patientId, phone);
    } catch (error) {
      failures.push({
        step: 'phone',
        message: `Phone ${phone.phoneNumber} was not saved: ${messageOf(error)}`,
      });
    }
  }

  if (input.insurance) {
    try {
      await addPatientInsurance(created.patientId, input.insurance);
    } catch (error) {
      failures.push({
        step: 'insurance',
        message: `Insurance policy was not saved: ${messageOf(error)}`,
      });
    }
  }

  const contact = input.emergencyContact;
  if (contact) {
    try {
      const link = await linkGuardianToPatient(
        created.patientId,
        'existingGuardianId' in contact
          ? { relationship: contact.relationship, guardianId: contact.existingGuardianId }
          : {
              relationship: contact.relationship,
              newGuardian: {
                firstName: contact.firstName,
                lastName: contact.lastName,
                nic: contact.nic,
                address: contact.address,
              },
            },
      );

      if (!('existingGuardianId' in contact) && contact.phoneNumber && contact.phoneType) {
        try {
          await addGuardianPhone(link.guardianId, {
            phoneNumber: contact.phoneNumber,
            phoneType: contact.phoneType,
          });
        } catch (error) {
          failures.push({
            step: 'emergencyContactPhone',
            message: `Emergency contact phone was not saved: ${messageOf(error)}`,
          });
        }
      }
    } catch (error) {
      failures.push({
        step: 'emergencyContact',
        message: `Emergency contact was not saved: ${messageOf(error)}`,
      });
    }
  }

  let patient = created;
  try {
    patient = await fetchPatientById(created.patientId);
  } catch {

  }

  return { patient, failures };
}
