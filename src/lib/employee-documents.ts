import type { EmployeeDocumentCategory } from "@prisma/client";

export const DOCUMENT_CATEGORY_LABELS: Record<EmployeeDocumentCategory, string> = {
  APPRAISAL: "Appraisal",
  LAPTOP_UNDERTAKING: "Laptop Undertaking",
  OFFER_LETTER: "Offer Letter",
  APPOINTMENT_LETTER: "Appointment Letter",
  NDA: "NDA / Confidentiality",
  ID_PROOF: "ID Proof",
  OTHER: "Other",
};

export const DOCUMENT_CATEGORIES = Object.entries(DOCUMENT_CATEGORY_LABELS).map(
  ([value, label]) => ({
    value: value as EmployeeDocumentCategory,
    label,
  })
);

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
