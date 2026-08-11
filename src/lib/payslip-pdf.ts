import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { amountInWordsIndian } from "@/lib/number-to-words";

export interface PayslipLineItem {
  label: string;
  amount: number;
}

export interface PayslipPdfData {
  companyName: string;
  companyEmail?: string | null;
  companyTan?: string | null;
  employeeId: string;
  employeeName: string;
  employeePan?: string | null;
  designation: string;
  department: string;
  month: number;
  year: number;
  salary: number;
  bonus: number;
  incentive: number;
  reimbursement: number;
  deductions: number;
  netSalary: number;
  payableDays?: number;
  totalDaysInMonth?: number;
  generatedAt?: Date;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const BRAND = { r: 6, g: 147, b: 227 };
const MUTED = { r: 100, g: 100, b: 100 };
const BORDER = { r: 220, g: 225, b: 230 };

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatCurrencyDisplay(amount: number) {
  // Use "Rs." — Helvetica in jsPDF cannot render ₹ (shows as superscript "1")
  return `Rs. ${formatCurrency(amount)}`;
}

/** Build earnings/deduction rows using explicit string keys — avoids autoTable numeric-key "1" bug */
function toTableRows(items: PayslipLineItem[]) {
  return items.map((item) => ({
    particulars: item.label,
    amount: formatCurrencyDisplay(item.amount),
  }));
}

export function generatePayslipPdfBuffer(data: PayslipPdfData): Buffer {
  return Buffer.from(buildPayslipDoc(data).output("arraybuffer"));
}

/** Client-side download using jsPDF save (no Node Buffer) */
export function downloadPayslipPdfClient(data: PayslipPdfData, filename: string) {
  buildPayslipDoc(data).save(filename);
}

function buildPayslipDoc(data: PayslipPdfData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const monthName = MONTHS[data.month - 1] ?? String(data.month);
  const gross = data.salary + data.bonus + data.incentive + data.reimbursement;

  const earnings: PayslipLineItem[] = [
    { label: "Basic Salary", amount: data.salary },
  ];
  if (data.bonus > 0) {
    earnings.push({ label: "Bonus", amount: data.bonus });
  }
  earnings.push(
    { label: "Incentive", amount: data.incentive },
    { label: "Reimbursement", amount: data.reimbursement }
  );

  const deductionItems: PayslipLineItem[] = [
    { label: "Tax", amount: 0 },
    { label: "PF", amount: 0 },
  ];
  if (data.deductions > 0) {
    deductionItems.push({ label: "Other Deductions", amount: data.deductions });
  }

  // Header band
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(data.companyName, margin, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (data.companyEmail) {
    doc.text(data.companyEmail, margin, 18);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("SALARY SLIP", pageWidth - margin, 12, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`For the month of ${monthName} ${data.year}`, pageWidth - margin, 18, {
    align: "right",
  });

  let y = 36;
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 40, 2, 2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Employee Details", margin + 4, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  const leftCol = margin + 4;
  const rightCol = pageWidth / 2 + 4;
  const rowH = 5.5;
  const details: [string, string][] = [
    ["Employee Name", data.employeeName],
    ["Employee ID", data.employeeId],
    ["Designation", data.designation],
    ["Department", data.department],
    ["PAN", data.employeePan?.trim() || "-"],
    ["Company TAN", data.companyTan?.trim() || "-"],
  ];
  if (data.payableDays !== undefined && data.totalDaysInMonth !== undefined) {
    details.push(["Payable Days", `${data.payableDays} / ${data.totalDaysInMonth}`]);
  }
  if (data.generatedAt) {
    details.push([
      "Generated On",
      data.generatedAt.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    ]);
  }

  details.forEach(([label, value], i) => {
    const col = i % 2 === 0 ? leftCol : rightCol;
    const row = Math.floor(i / 2);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(`${label}:`, col, y + 14 + row * rowH);
    doc.setTextColor(0, 0, 0);
    doc.text(value, col + 28, y + 14 + row * rowH);
  });

  y += 48;

  const tableColumns = [
    { header: "Particulars", dataKey: "particulars" },
    { header: "Amount (INR)", dataKey: "amount" },
  ];

  const tableStyles = {
    fontSize: 8.5,
    cellPadding: 2.5,
    lineColor: [BORDER.r, BORDER.g, BORDER.b] as [number, number, number],
    lineWidth: 0.2,
  };

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: (pageWidth - margin * 2) / 2 - 2,
    columns: tableColumns,
    body: toTableRows(earnings),
    headStyles: {
      fillColor: [BRAND.r, BRAND.g, BRAND.b],
      textColor: 255,
      fontStyle: "bold",
    },
    bodyStyles: tableStyles,
    theme: "grid",
    didParseCell: (hook) => {
      if (hook.section === "body" && hook.column.dataKey === "amount") {
        hook.cell.styles.halign = "right";
      }
    },
  });

  const earningsEndY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;

  autoTable(doc, {
    startY: y,
    margin: { left: pageWidth / 2 + 2, right: margin },
    tableWidth: (pageWidth - margin * 2) / 2 - 2,
    columns: tableColumns,
    body:
      deductionItems.length > 0
        ? toTableRows(deductionItems)
        : toTableRows([
            { label: "Tax", amount: 0 },
            { label: "PF", amount: 0 },
          ]),
    headStyles: {
      fillColor: [BRAND.r, BRAND.g, BRAND.b],
      textColor: 255,
      fontStyle: "bold",
    },
    bodyStyles: tableStyles,
    theme: "grid",
    didParseCell: (hook) => {
      if (hook.section === "body" && hook.column.dataKey === "amount") {
        hook.cell.styles.halign = "right";
      }
    },
  });

  y = Math.max(
    earningsEndY,
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  ) + 8;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    columns: [
      { header: "Summary", dataKey: "label" },
      { header: "Amount (INR)", dataKey: "value" },
    ],
    body: [
      { label: "Gross Salary", value: formatCurrencyDisplay(gross) },
      { label: "Total Deductions", value: formatCurrencyDisplay(data.deductions) },
      { label: "Net Salary", value: formatCurrencyDisplay(data.netSalary) },
    ],
    headStyles: {
      fillColor: [240, 244, 248],
      textColor: 0,
      fontStyle: "bold",
    },
    bodyStyles: tableStyles,
    theme: "grid",
    didParseCell: (hook) => {
      if (hook.column.dataKey === "value") {
        hook.cell.styles.halign = "right";
      }
      if (hook.section === "body" && hook.row.index === 2) {
        hook.cell.styles.fontStyle = "bold";
        hook.cell.styles.textColor = [BRAND.r, BRAND.g, BRAND.b];
      }
    },
  });

  y =
    ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 10;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 16, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text("Amount in Words:", margin + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  const words = amountInWordsIndian(data.netSalary);
  const splitWords = doc.splitTextToSize(words, pageWidth - margin * 2 - 8);
  doc.text(splitWords, margin + 4, y + 11);

  y += 22;
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(
    "This is a computer-generated payslip and does not require a signature.",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  return doc;
}
