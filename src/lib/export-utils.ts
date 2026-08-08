import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ExportRow = Record<string, string | number | boolean | null | undefined>;

export function exportToExcel(
  rows: ExportRow[],
  filename: string,
  sheetName = "Report"
) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function exportToCsv(rows: ExportRow[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportToPdf(
  rows: ExportRow[],
  filename: string,
  title: string
) {
  const doc = new jsPDF({ orientation: rows.length > 6 ? "landscape" : "portrait" });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const body = rows.map((row) => headers.map((key) => String(row[key] ?? "")));

  doc.setFontSize(16);
  doc.text(title, 14, 18);
  autoTable(doc, {
    head: [headers],
    body,
    startY: 24,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [6, 147, 227] },
  });
  doc.save(`${filename}.pdf`);
}
