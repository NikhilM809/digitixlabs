import { formatDate, formatHours, formatMonthYear, hoursProgress } from "@/worknest/lib/format";
import { PROJECT_STATUS_LABEL } from "@/worknest/lib/constants";
import { hoursByWorkType } from "@/worknest/lib/data";
import { displayBillingStatus } from "@/worknest/lib/finance";
import ExcelJS from "exceljs";
import type { WnBillingStage, WnInvoiceStatus, WnProjectStatus } from "@prisma/client";

type ApprovalProject = {
  code: string;
  name: string;
  clientName: string;
  description: string;
  status: WnProjectStatus;
  billingStage: WnBillingStage;
  sellValue: number;
  estimatedHours: number;
  startDate: Date | null;
  eta: Date;
  actualCompletionDate: Date | null;
  manager: { name: string };
  currency: { code: string; name: string; symbol: string } | null;
  timeEntries: { hours: number; workType: string }[];
  invoices: {
    invoiceNumber: string;
    invoiceDate: Date;
    status: WnInvoiceStatus;
    billingMonth: number;
    billingYear: number;
  }[];
};

function asDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function buildApprovalWorkbook(input: {
  companyName: string;
  project: ApprovalProject;
  billingMonth: number;
  billingYear: number;
  exportedBy: string;
}) {
  const { project, billingMonth, billingYear } = input;
  const breakdown = hoursByWorkType(project.timeEntries);
  const progress = hoursProgress(breakdown.total, project.estimatedHours);
  const invoice = project.invoices.find(
    (row) => row.billingMonth === billingMonth && row.billingYear === billingYear,
  ) ?? project.invoices[0];
  const code = project.currency?.code ?? "";
  const remainingValue = progress.over ? progress.overBy : progress.remaining;
  const remainingLabel = progress.over ? "Exceeded hours" : "Remaining hours";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Worknest";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Project Approval", {
    views: [{ showGridLines: false, state: "frozen", ySplit: 3 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1, paperSize: 9 },
  });

  sheet.columns = [
    { key: "label", width: 28 },
    { key: "value", width: 36 },
    { key: "label2", width: 26 },
    { key: "value2", width: 28 },
  ];

  const title = sheet.addRow(["Project details for approval"]);
  title.font = { name: "Calibri", size: 18, bold: true, color: { argb: "FF15202E" } };
  title.height = 28;
  sheet.mergeCells("A1:D1");
  const company = sheet.addRow([input.companyName]);
  company.font = { name: "Calibri", size: 12, color: { argb: "FF0B6E6A" } };
  sheet.mergeCells("A2:D2");
  const meta = sheet.addRow([
    `Billing month: ${formatMonthYear(billingMonth, billingYear)}    Prepared by: ${input.exportedBy}    Exported: ${formatDate(new Date())}`,
  ]);
  meta.font = { name: "Calibri", size: 10, color: { argb: "FF5B6573" } };
  sheet.mergeCells("A3:D3");
  sheet.addRow([]);

  const section = (heading: string) => {
    const row = sheet.addRow([heading]);
    row.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    row.height = 22;
    sheet.mergeCells(`A${row.number}:D${row.number}`);
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B6E6A" } };
  };

  const applyValue = (cell: ExcelJS.Cell, value: string | number | Date | null, numFmt?: string) => {
    if (value instanceof Date) {
      cell.value = value;
      cell.numFmt = "dd-mmm-yyyy";
    } else if (typeof value === "number") {
      cell.value = value;
      cell.numFmt = numFmt ?? "0.0";
    } else {
      cell.value = value || "—";
    }
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.font = { name: "Calibri", size: 11, color: { argb: "FF15202E" } };
  };

  const pair = (
    label: string,
    value: string | number | Date | null,
    label2?: string,
    value2?: string | number | Date | null,
    formats?: { v?: string; v2?: string },
  ) => {
    const row = sheet.addRow(["", "", "", ""]);
    row.height = 20;
    row.getCell(1).value = label;
    row.getCell(1).font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF5B6573" } };
    applyValue(row.getCell(2), value, formats?.v);
    row.getCell(3).value = label2 ?? "";
    row.getCell(3).font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF5B6573" } };
    applyValue(row.getCell(4), value2 ?? "", formats?.v2);
    return row;
  };

  section("Project information");
  pair("Project ID", project.code, "Project name", project.name);
  pair("Client name", project.clientName, "Project manager", project.manager.name);
  pair("Project status", PROJECT_STATUS_LABEL[project.status], "Start date", asDate(project.startDate));
  pair("ETA", asDate(project.eta), "Completion date", asDate(project.actualCompletionDate));
  sheet.addRow([]);

  section("Hours");
  pair("Estimated hours", project.estimatedHours, "Initial scripting hours", breakdown.initial, { v: "0.0", v2: "0.0" });
  pair("Changes hours", breakdown.changes, "Live hours", breakdown.live, { v: "0.0", v2: "0.0" });
  pair("Total actual hours", breakdown.total, remainingLabel, remainingValue, { v: "0.0", v2: "0.0" });
  pair("Hours summary", `${formatHours(breakdown.total)} / ${formatHours(project.estimatedHours)}`, "", "");
  sheet.addRow([]);

  section("Financial information");
  pair(
    "Project value",
    project.sellValue,
    "Currency",
    project.currency ? `${project.currency.name} (${code})` : code || "Not set",
    { v: "#,##0.00" },
  );
  pair("Currency code", code || "Not set", "Currency symbol", project.currency?.symbol ?? "—");
  pair("Billing month", formatMonthYear(billingMonth, billingYear), "Billing status", displayBillingStatus(project));
  sheet.addRow([]);

  section("Invoice information");
  pair(
    "Invoice number",
    invoice?.invoiceNumber ?? "Not generated",
    "Invoice date",
    invoice ? asDate(invoice.invoiceDate) : "Not generated",
  );
  sheet.addRow([]);

  const notes = sheet.addRow(["Reviewer notes / approval"]);
  notes.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  sheet.mergeCells(`A${notes.number}:D${notes.number}`);
  notes.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF15202E" } };
  const box = sheet.addRow(["Approved by:", "", "Date:", ""]);
  box.getCell(1).font = { name: "Calibri", size: 11, bold: true };
  box.getCell(3).font = { name: "Calibri", size: 11, bold: true };
  box.height = 22;
  const sign = sheet.addRow(["Signature:", "", "Decision (Approved / Changes needed):", ""]);
  sign.getCell(1).font = { name: "Calibri", size: 11, bold: true };
  sign.getCell(3).font = { name: "Calibri", size: 11, bold: true };
  sign.height = 28;
  sheet.addRow([]);
  const footer = sheet.addRow([
    "This file is for internal approval only. Generating this export does not create an invoice. Re-exporting is allowed and will not duplicate invoices.",
  ]);
  footer.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF5B6573" } };
  sheet.mergeCells(`A${footer.number}:D${footer.number}`);

  sheet.eachRow((row) => {
    row.font = { ...(row.font ?? {}), name: row.font?.name ?? "Calibri", size: row.font?.size ?? 11 };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
