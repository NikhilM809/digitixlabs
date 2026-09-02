import ExcelJS from "exceljs";
import { format } from "date-fns";
import type { WnInvoiceStatus, WnProjectStatus } from "@prisma/client";
import { trackerWnProjectStatusLabel, workTypeLabel } from "@/worknest/lib/constants";
import { hoursByWorkType } from "@/worknest/lib/data";
import { workTypeBucket } from "@/worknest/lib/work-types";

export type TrackerProject = {
  code: string;
  name: string;
  clientName: string;
  description: string;
  status: WnProjectStatus;
  sellValue: number;
  startDate: Date | null;
  createdAt: Date;
  eta: Date;
  actualCompletionDate: Date | null;
  managerName: string;
  currencyCode: string;
  timeEntries: { date: Date; hours: number; workType: string; notes: string }[];
  invoices: { status: WnInvoiceStatus }[];
};

function asDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function taskLabel(workType: string) {
  const bucket = workTypeBucket(workType);
  if (bucket === "changes") return "Changes";
  if (bucket === "live") return "Other project managemnt tasks";
  return workTypeLabel(workType);
}

function billedLabel(invoices: { status: WnInvoiceStatus }[]) {
  if (invoices.some((invoice) => invoice.status === "PAID") || invoices.length > 0) {
    return "Checked and billed";
  }
  return "To be billed";
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function headerRow(sheet: ExcelJS.Worksheet, values: string[], widths: number[]) {
  sheet.columns = widths.map((width) => ({ width }));
  const row = sheet.addRow(values);
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF15202E" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
}

export async function buildEffortsTrackerWorkbook(input: {
  companyName: string;
  projects: TrackerProject[];
  periodLabel: string;
  exportedBy: string;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = input.companyName;
  workbook.created = new Date();

  const changes = workbook.addWorksheet("Changes", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  headerRow(
    changes,
    ["SN.", "Date", "Project Name", "Task", "Hours", "Remark(if any!)", "Billed", "Payment Received"],
    [8, 14, 46, 34, 10, 36, 18, 18],
  );

  const changeRows = input.projects
    .flatMap((project) =>
      project.timeEntries.map((entry) => ({
        project,
        entry,
      })),
    )
    .sort((a, b) => a.entry.date.getTime() - b.entry.date.getTime());

  changeRows.forEach((row, index) => {
    const paid = row.project.invoices.some((invoice) => invoice.status === "PAID");
    const excelRow = changes.addRow([
      index + 1,
      asDate(row.entry.date),
      `${row.project.name} - ${row.project.code}`,
      taskLabel(row.entry.workType),
      row.entry.hours,
      row.entry.notes || "",
      billedLabel(row.project.invoices),
      paid ? "Yes" : "",
    ]);
    excelRow.getCell(2).numFmt = "dd-mmm-yyyy";
    excelRow.getCell(5).numFmt = "0.00";
    excelRow.alignment = { vertical: "middle", wrapText: true };
    excelRow.font = { name: "Calibri", size: 11 };
  });

  const billing = workbook.addWorksheet("Project_Billing_details_status", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const currencies = [...new Set(input.projects.map((project) => project.currencyCode).filter(Boolean))];
  const costHeader = currencies.length === 1 ? `Total cost (${currencies[0]})` : "Total cost";
  headerRow(
    billing,
    [
      "Status",
      "Project",
      costHeader,
      "Project Receive Date",
      "Delivery Date and Time",
      "Billed",
      "Payment Received",
      "REMARKS",
      "Had Issue",
      "Full Outsource",
      "Data Validation",
      "POC",
      "Has extra costs except intial & launching",
      "Outsourced to SP Team",
      "XML Feedback",
    ],
    [16, 44, 16, 18, 22, 12, 18, 28, 12, 14, 16, 18, 22, 18, 28],
  );

  for (const project of input.projects) {
    const breakdown = hoursByWorkType(project.timeEntries);
    const billed = project.invoices.length > 0;
    const paid = project.invoices.some((invoice) => invoice.status === "PAID");
    const receive = asDate(project.startDate) ?? asDate(project.createdAt);
    const delivery = asDate(project.actualCompletionDate) ?? asDate(project.eta);
    const excelRow = billing.addRow([
      trackerWnProjectStatusLabel(project.status),
      `${project.name} - ${project.code}`,
      project.sellValue,
      receive,
      delivery ? format(delivery, "M/d/yyyy") : "",
      yesNo(billed),
      paid ? "Yes" : "",
      project.description || "",
      "No",
      "No",
      "No",
      project.managerName,
      yesNo(breakdown.changes > 0),
      "",
      "",
    ]);
    excelRow.getCell(3).numFmt = "#,##0.00";
    excelRow.getCell(4).numFmt = "dd-mmm-yyyy";
    excelRow.alignment = { vertical: "middle", wrapText: true };
    excelRow.font = { name: "Calibri", size: 11 };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
