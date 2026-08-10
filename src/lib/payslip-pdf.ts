import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface PayslipPdfData {
  companyName: string;
  employeeId: string;
  employeeName: string;
  department: string;
  month: number;
  year: number;
  salary: number;
  bonus: number;
  deductions: number;
  netSalary: number;
  generatedAt?: Date;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function generatePayslipPdfBuffer(data: PayslipPdfData): Buffer {
  const doc = new jsPDF();
  const monthName = MONTHS[data.month - 1] ?? String(data.month);
  const gross = data.salary + data.bonus;

  doc.setFontSize(20);
  doc.setTextColor(6, 147, 227);
  doc.text(data.companyName, 14, 20);

  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("Payslip", 14, 30);
  doc.setFontSize(11);
  doc.text(`Pay Period: ${monthName} ${data.year}`, 14, 38);

  if (data.generatedAt) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Generated: ${data.generatedAt.toLocaleDateString("en-IN")}`,
      14,
      44
    );
  }

  autoTable(doc, {
    startY: 52,
    head: [["Employee Information", ""]],
    body: [
      ["Employee ID", data.employeeId],
      ["Name", data.employeeName],
      ["Department", data.department],
    ],
    headStyles: { fillColor: [6, 147, 227] },
    theme: "grid",
  });

  const earningsY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 52;

  autoTable(doc, {
    startY: earningsY + 8,
    head: [["Earnings & Deductions", "Amount (INR)"]],
    body: [
      ["Basic Salary", formatCurrency(data.salary)],
      ["Bonus", formatCurrency(data.bonus)],
      ["Gross Salary", formatCurrency(gross)],
      ["Deductions", formatCurrency(data.deductions)],
      ["Net Salary", formatCurrency(data.netSalary)],
    ],
    headStyles: { fillColor: [6, 147, 227] },
    theme: "grid",
    didParseCell: (hook) => {
      if (hook.row.index === 4 && hook.section === "body") {
        hook.cell.styles.fontStyle = "bold";
        hook.cell.styles.textColor = [6, 147, 227];
      }
    },
  });

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("This is a computer-generated payslip.", 14, 285);

  return Buffer.from(doc.output("arraybuffer"));
}
