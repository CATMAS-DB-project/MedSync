import { Drawer, DrawerSection } from '../../../components/layout/Drawer';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';

export interface PatientRegistrationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const GENDER_OPTIONS = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Other', value: 'Other' },
];

const BLOOD_TYPE_OPTIONS = [
  { label: 'A+', value: 'A+' },
  { label: 'A-', value: 'A-' },
  { label: 'B+', value: 'B+' },
  { label: 'B-', value: 'B-' },
  { label: 'AB+', value: 'AB+' },
  { label: 'AB-', value: 'AB-' },
  { label: 'O+', value: 'O+' },
  { label: 'O-', value: 'O-' },
];

const BRANCH_OPTIONS = [
  { label: 'Main Branch', value: 'Main Branch' },
  { label: 'Kandy Clinic', value: 'Kandy Clinic' },
  { label: 'Galle Center', value: 'Galle Center' },
];

export function PatientRegistrationDrawer({ isOpen, onClose }: PatientRegistrationDrawerProps) {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Register New Patient"
      subtitle="Enter details to create a new patient record."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onClose}>
            Save Patient
          </Button>
        </>
      }
    >
      <DrawerSection title="Personal Information" icon="badge">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input label="National Identity Card (NIC)" placeholder="e.g. 199012345678" />
          </div>
          <div className="sm:col-span-2">
            <Input label="Full Name" placeholder="Legal full name" />
          </div>
          <Input label="Date of Birth" type="date" />
          <Select label="Gender" placeholder="Select gender" options={GENDER_OPTIONS} />
          <Select
            label="Blood Type (optional)"
            placeholder="Select blood type"
            options={BLOOD_TYPE_OPTIONS}
          />
          <Select label="Registering Branch" placeholder="Select branch" options={BRANCH_OPTIONS} />
        </div>
      </DrawerSection>

      <DrawerSection title="Contact Information" icon="call">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Phone" placeholder="077-123-4567" />
          <Input label="Email (optional)" type="email" placeholder="name@example.com" />
          <div className="sm:col-span-2">
            <Input label="Address (optional)" placeholder="Street, city" />
          </div>
        </div>
      </DrawerSection>

      <DrawerSection title="Emergency Contact" icon="emergency">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input label="Contact Name" placeholder="Full name" />
          </div>
          <Input label="Relationship" placeholder="e.g. Spouse, Parent" />
          <Input label="Phone" placeholder="077-123-4567" />
        </div>
      </DrawerSection>
    </Drawer>
  );
}
