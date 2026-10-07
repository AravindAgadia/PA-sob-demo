import type { IntakeData } from "@/lib/policy/types";

export interface PostalAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

const BLANK_ADDRESS: PostalAddress = { line1: "", line2: "", city: "", state: "", zip: "" };

export interface EnrollmentPayerPatient {
  payer: string;
  urgency: string;
  patientFirstName: string;
  patientLastName: string;
  patientDob: string;
  patientGender: string;
  memberId: string;
  patientAddress: PostalAddress;
}

export interface EnrollmentPrescriber {
  npi: string;
  firstName: string;
  lastName: string;
  licenseState: string;
  licenseNumber: string;
  taxId: string;
  phoneType: string;
  phone: string;
  faxType: string;
  fax: string;
  email: string;
  confirmEmail: string;
  address: PostalAddress;
}

/** Deliberately not the same shape as EnrollmentPrescriber — the Servicing
 *  Provider reference screen's field list is a strict subset (no email, no
 *  address), so sharing a type would fabricate fields that screen never
 *  shows. */
export interface EnrollmentServicingProvider {
  sameAsPrescriber: boolean;
  npi: string;
  firstName: string;
  lastName: string;
  licenseState: string;
  licenseNumber: string;
  taxId: string;
  phone: string;
  fax: string;
}

export interface EnrollmentDrugDetails {
  drugDescription: string;
  ndc: string;
  hcpcsCode: string;
  routeOfAdministration: string;
  startDateOfService: string;
  directions: string;
  daysSupply: string;
  quantity: string;
  billUnder: "Medical" | "Pharmacy";
  /** Not shown in the reference screens — added so this wizard can drive
   *  the existing eligibility/policy-match pipeline, which requires both. */
  diagnosis: string;
  icd10Code: string;
  dispensingLocation: string;
}

export interface EnrollmentData {
  payerPatient: EnrollmentPayerPatient;
  prescriber: EnrollmentPrescriber;
  drug: EnrollmentDrugDetails;
  servicingProvider: EnrollmentServicingProvider;
}

export const BLANK_ENROLLMENT: EnrollmentData = {
  payerPatient: {
    payer: "",
    urgency: "",
    patientFirstName: "",
    patientLastName: "",
    patientDob: "",
    patientGender: "",
    memberId: "",
    patientAddress: { ...BLANK_ADDRESS },
  },
  prescriber: {
    npi: "",
    firstName: "",
    lastName: "",
    licenseState: "",
    licenseNumber: "",
    taxId: "",
    phoneType: "Mobile",
    phone: "",
    faxType: "Office",
    fax: "",
    email: "",
    confirmEmail: "",
    address: { ...BLANK_ADDRESS },
  },
  drug: {
    drugDescription: "",
    ndc: "",
    hcpcsCode: "",
    routeOfAdministration: "",
    startDateOfService: "",
    directions: "",
    daysSupply: "",
    quantity: "",
    billUnder: "Medical",
    diagnosis: "",
    icd10Code: "",
    dispensingLocation: "",
  },
  servicingProvider: {
    sameAsPrescriber: true,
    npi: "",
    firstName: "",
    lastName: "",
    licenseState: "",
    licenseNumber: "",
    taxId: "",
    phone: "",
    fax: "",
  },
};

/** Local-date (not UTC) "today" for a native date input's default value. */
function todayIso(): string {
  const now = new Date();
  const localMidnight = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localMidnight.toISOString().slice(0, 10);
}

/** A fresh blank enrollment with Start Date of Service defaulted to today.
 *  A function (not a second module constant) so "today" is computed at
 *  call time — once per wizard mount/reset — rather than frozen at
 *  whenever this module first loaded. */
export function createInitialEnrollment(): EnrollmentData {
  return { ...BLANK_ENROLLMENT, drug: { ...BLANK_ENROLLMENT.drug, startDateOfService: todayIso() } };
}

/** Maps the wizard's richer local state down to the shape the existing
 *  matching engine (`runIntake`) consumes. Everything collected beyond
 *  these fields — NDC, HCPCS, route, days supply/quantity, directions,
 *  urgency, gender, both addresses, the entire Servicing Provider section,
 *  license/tax ID/phone/fax/email — is shown in the Summary step for
 *  fidelity to the reference UI but isn't wired into new matching logic. */
export function mapEnrollmentToIntake(data: EnrollmentData): IntakeData {
  return {
    patientFirstName: data.payerPatient.patientFirstName,
    patientLastName: data.payerPatient.patientLastName,
    patientDob: data.payerPatient.patientDob,
    insuranceId: data.payerPatient.memberId,
    payer: data.payerPatient.payer,
    drug: data.drug.drugDescription,
    diagnosis: data.drug.diagnosis,
    icd10Code: data.drug.icd10Code,
    buyAndBill: data.drug.billUnder === "Medical",
    orderingProviderNpi: data.prescriber.npi,
    dispensingLocation: data.drug.dispensingLocation,
  };
}

export type EnrollStepId =
  | "payer-patient"
  | "prescriber"
  | "drug"
  | "servicing-provider"
  | "benefit-summary";

export const ENROLL_STEPS: { id: EnrollStepId; label: string }[] = [
  { id: "payer-patient", label: "Payer & Patient" },
  { id: "prescriber", label: "Prescriber" },
  { id: "drug", label: "Drug Details" },
  { id: "servicing-provider", label: "Servicing Provider" },
  { id: "benefit-summary", label: "Benefit Summary" },
];
