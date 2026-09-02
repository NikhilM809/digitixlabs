import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, RGB } from "pdf-lib";
import { formatDate, formatMoneyPdf, formatMonthYear, pdfSafeText } from "@/worknest/lib/format";
import { readFile } from "fs/promises";
import path from "path";

export type InvoiceLine = {
  code: string;
  name: string;
  amount: number;
};

export type CompanyInvoiceDetails = {
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  panNumber?: string;
  tanNumber?: string;
  gstin?: string;
  lutNumber?: string;
  servicesDescription?: string;
  bankAccountName?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankSwift?: string;
  bankMicr?: string;
  bankBranch?: string;
  bankBranchCode?: string;
  bankCountry?: string;
  logoUrl?: string;
};

export type ClientInvoicePdfInput = CompanyInvoiceDetails & {
  invoiceNumber: string;
  invoiceDate: Date;
  billingMonth: number;
  billingYear: number;
  clientName: string;
  billToName?: string;
  billToAddress?: string;
  currency: string;
  status: string;
  lines: InvoiceLine[];
  discount: number;
  gstRate: number;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const teal = rgb(0.04, 0.43, 0.42);
const ink = rgb(0.12, 0.16, 0.2);
const muted = rgb(0.42, 0.46, 0.5);
const lineColor = rgb(0.86, 0.88, 0.9);
const headerBg = rgb(0.08, 0.16, 0.22);
const rowAlt = rgb(0.97, 0.98, 0.98);
const boxBg = rgb(0.95, 0.97, 0.97);

function lutPeriod(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

async function embedLogo(doc: PDFDocument, logoUrl?: string) {
  const candidates = [logoUrl?.trim(), "/logo.png"].filter(Boolean) as string[];
  for (const logo of candidates) {
    try {
      let bytes: ArrayBuffer;
      if (/^https?:\/\//i.test(logo)) {
        const response = await fetch(logo);
        if (!response.ok) continue;
        bytes = await response.arrayBuffer();
      } else {
        const filePath = path.join(process.cwd(), "public", logo.replace(/^\//, ""));
        const buffer = await readFile(filePath);
        bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      }
      try {
        return await doc.embedPng(bytes);
      } catch {
        return await doc.embedJpg(bytes);
      }
    } catch {
      continue;
    }
  }
  return null;
}

function wrap(font: PDFFont, value: string, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of pdfSafeText(value).split(/\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

export async function buildClientInvoicePdf(input: ClientInvoicePdfInput) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedLogo(doc, input.logoUrl);

  const subtotal = input.lines.reduce((sum, line) => sum + line.amount, 0);
  const discount = Math.max(0, input.discount || 0);
  const taxable = Math.max(0, subtotal - discount);
  const gstAmount = taxable * ((input.gstRate || 0) / 100);
  const total = taxable + gstAmount;
  const billToName = input.billToName?.trim() || input.clientName;
  const currency = input.currency;
  const rightEdge = PAGE_WIDTH - MARGIN;

  const drawText = (page: PDFPage, value: string, opts: { x: number; y: number; size: number; font: PDFFont; color: RGB }) => {
    page.drawText(pdfSafeText(value), opts);
  };

  const drawRight = (
    page: PDFPage,
    value: string,
    rightX: number,
    y: number,
    size: number,
    usedFont: PDFFont,
    color: RGB,
  ) => {
    const text = pdfSafeText(value);
    const width = usedFont.widthOfTextAtSize(text, size);
    page.drawText(text, { x: rightX - width, y, size, font: usedFont, color });
  };

  const addPage = () => {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 6, width: PAGE_WIDTH, height: 6, color: teal });
    return page;
  };

  let page = addPage();
  let y = PAGE_HEIGHT - 32;

  if (logo) {
    const maxH = 34;
    const scale = maxH / logo.height;
    page.drawImage(logo, { x: MARGIN, y: y - maxH + 10, width: logo.width * scale, height: maxH });
  }
  drawRight(page, "TAX INVOICE", rightEdge, y - 4, 18, bold, teal);
  y -= 42;
  drawText(page, input.companyName || "Digitixlabs LLP", { x: MARGIN, y, size: 14, font: bold, color: ink });
  y -= 16;
  drawText(page, "Survey programming invoice. Pay the amount due using the bank details on the last page.", {
    x: MARGIN,
    y,
    size: 9,
    font,
    color: muted,
  });

  y -= 22;
  page.drawRectangle({ x: MARGIN, y: y - 40, width: CONTENT_WIDTH, height: 52, color: boxBg });
  const metaY = y - 14;
  const metaCols = [
    ["Invoice number", input.invoiceNumber],
    ["Invoice date", formatDate(input.invoiceDate)],
    ["Billing period", formatMonthYear(input.billingMonth, input.billingYear)],
    ["Payment", input.status],
  ];
  metaCols.forEach(([label, value], index) => {
    const x = MARGIN + 12 + index * 124;
    drawText(page, label, { x, y: metaY, size: 8, font, color: muted });
    drawText(page, value, { x, y: metaY - 15, size: 10, font: bold, color: ink });
  });
  y -= 64;

  const colWidth = (CONTENT_WIDTH - 20) / 2;
  const fromLines = [
    input.companyName,
    ...wrap(font, input.companyAddress || "", 9, colWidth),
    input.companyEmail,
    input.companyPhone,
    input.panNumber ? `PAN  ${input.panNumber}` : "",
    input.tanNumber ? `TAN  ${input.tanNumber}` : "",
    input.gstin ? `GSTIN  ${input.gstin}` : "",
    input.lutNumber ? `LUT (${lutPeriod(input.invoiceDate)})  ${input.lutNumber}` : "",
    input.servicesDescription ? `Services  ${input.servicesDescription}` : "",
  ].filter(Boolean) as string[];
  const toLines = [
    billToName,
    ...wrap(font, input.billToAddress || "", 9, colWidth),
    billToName !== input.clientName ? `Client  ${input.clientName}` : "",
  ].filter(Boolean) as string[];
  const boxHeight = Math.max(fromLines.length, toLines.length) * 13 + 20;

  drawText(page, "Bill from", { x: MARGIN, y, size: 9, font: bold, color: teal });
  drawText(page, "Bill to", { x: MARGIN + colWidth + 20, y, size: 9, font: bold, color: teal });
  y -= 16;
  fromLines.forEach((line, index) => {
    drawText(page, line, { x: MARGIN, y: y - index * 13, size: 9, font: index === 0 ? bold : font, color: ink });
  });
  toLines.forEach((line, index) => {
    drawText(page, line, {
      x: MARGIN + colWidth + 20,
      y: y - index * 13,
      size: 9,
      font: index === 0 ? bold : font,
      color: ink,
    });
  });
  y -= boxHeight;

  drawText(page, `Project efforts (${currency})`, { x: MARGIN, y, size: 12, font: bold, color: ink });
  y -= 14;
  drawText(page, `${input.lines.length} project${input.lines.length === 1 ? "" : "s"} on this invoice. Amounts are the overall project values unless changed.`, {
    x: MARGIN,
    y,
    size: 8,
    font,
    color: muted,
  });
  y -= 16;

  const colNo = MARGIN + 6;
  const colCode = MARGIN + 32;
  const colName = MARGIN + 118;
  const amountRight = rightEdge - 10;
  const nameWidth = amountRight - 118 - colName;

  const drawTableHeader = () => {
    page.drawRectangle({ x: MARGIN, y: y - 6, width: CONTENT_WIDTH, height: 22, color: headerBg });
    drawText(page, "#", { x: colNo, y, size: 9, font: bold, color: rgb(1, 1, 1) });
    drawText(page, "Project ID", { x: colCode, y, size: 9, font: bold, color: rgb(1, 1, 1) });
    drawText(page, "Project", { x: colName, y, size: 9, font: bold, color: rgb(1, 1, 1) });
    drawRight(page, "Amount", amountRight, y, 9, bold, rgb(1, 1, 1));
    y -= 24;
  };

  drawTableHeader();

  input.lines.forEach((line, index) => {
    const escapedCode = line.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const displayName =
      line.name
        .replace(new RegExp(`^${escapedCode}\\s*[-:]?\\s*`, "i"), "")
        .replace(new RegExp(`\\s*[-:]\\s*${escapedCode}$`, "i"), "")
        .trim() || line.name;
    const nameLines = wrap(font, displayName, 9, Math.max(80, nameWidth));
    const rowHeight = Math.max(18, nameLines.length * 12 + 6);
    if (y - rowHeight < 80) {
      page = addPage();
      y = PAGE_HEIGHT - 48;
      drawTableHeader();
    }
    if (index % 2 === 1) {
      page.drawRectangle({
        x: MARGIN,
        y: y - rowHeight + 12,
        width: CONTENT_WIDTH,
        height: rowHeight,
        color: rowAlt,
      });
    }
    drawText(page, String(index + 1), { x: colNo, y, size: 9, font, color: muted });
    drawText(page, line.code, { x: colCode, y, size: 9, font: bold, color: ink });
    nameLines.forEach((part, lineIndex) => {
      drawText(page, part, { x: colName, y: y - lineIndex * 12, size: 9, font, color: ink });
    });
    drawRight(page, formatMoneyPdf(line.amount, currency), amountRight, y, 9, bold, ink);
    y -= rowHeight;
  });

  if (y < 210) {
    page = addPage();
    y = PAGE_HEIGHT - 56;
  }

  y -= 10;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: rightEdge, y }, thickness: 1, color: lineColor });
  y -= 18;

  const totalsWidth = 250;
  const totalsX = rightEdge - totalsWidth;
  page.drawRectangle({ x: totalsX - 10, y: y - 92, width: totalsWidth + 10, height: 108, color: boxBg });

  const totalRows: [string, string, boolean][] = [
    ["Project total", formatMoneyPdf(subtotal, currency), false],
    ["Less discount", formatMoneyPdf(discount, currency), false],
    [
      input.gstRate ? `GST ${input.gstRate}%` : "GST (not charged)",
      formatMoneyPdf(gstAmount, currency),
      false,
    ],
    ["Amount due", formatMoneyPdf(total, currency), true],
  ];
  for (const [label, value, strong] of totalRows) {
    drawText(page, label, {
      x: totalsX,
      y,
      size: strong ? 11 : 9,
      font: strong ? bold : font,
      color: strong ? ink : muted,
    });
    drawRight(page, value, amountRight, y, strong ? 12 : 9, bold, strong ? teal : ink);
    y -= strong ? 22 : 16;
  }

  y -= 18;
  const note =
    input.gstRate > 0
      ? `GST is charged at ${input.gstRate}%. Please pay the amount due in ${currency}.`
      : input.lutNumber
        ? `GST is not charged. This is an export of services covered by LUT ${input.lutNumber}. Please pay the amount due in ${currency}.`
        : `GST is not charged on this invoice. Please pay the amount due in ${currency}.`;
  wrap(font, note, 8, CONTENT_WIDTH).forEach((line) => {
    drawText(page, line, { x: MARGIN, y, size: 8, font, color: muted });
    y -= 12;
  });

  page = addPage();
  y = PAGE_HEIGHT - 52;
  drawText(page, "How to pay", { x: MARGIN, y, size: 16, font: bold, color: ink });
  y -= 18;
  wrap(
    font,
    `Transfer the amount due to the account below. Put ${input.invoiceNumber} in the payment reference so we can match your payment.`,
    9,
    CONTENT_WIDTH,
  ).forEach((line) => {
    drawText(page, line, { x: MARGIN, y, size: 9, font, color: muted });
    y -= 13;
  });
  y -= 12;

  page.drawRectangle({ x: MARGIN, y: y - 8, width: CONTENT_WIDTH, height: 28, color: headerBg });
  drawText(page, "Bank details", { x: MARGIN + 10, y, size: 11, font: bold, color: rgb(1, 1, 1) });
  y -= 32;

  const bankRows: [string, string][] = [
    ["Account name", input.bankAccountName || input.companyName],
    ["Bank", input.bankName || ""],
    ["Account number", input.bankAccountNumber || ""],
    ["IFSC", input.bankIfsc || ""],
    ["SWIFT", input.bankSwift || ""],
    ["MICR", input.bankMicr || ""],
    ["Branch", input.bankBranch || ""],
    ["Branch code", input.bankBranchCode || ""],
    ["Country", input.bankCountry || "India"],
  ].filter(([, value]) => value) as [string, string][];

  bankRows.forEach(([label, value], index) => {
    if (index % 2 === 0) {
      page.drawRectangle({ x: MARGIN, y: y - 8, width: CONTENT_WIDTH, height: 24, color: boxBg });
    }
    drawText(page, label, { x: MARGIN + 10, y, size: 9, font, color: muted });
    drawText(page, value, { x: MARGIN + 160, y, size: 10, font: bold, color: ink });
    y -= 24;
  });

  y -= 20;
  drawText(page, `For ${input.companyName || "Digitixlabs LLP"}`, { x: MARGIN, y, size: 10, font: bold, color: ink });
  y -= 36;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 180, y }, thickness: 0.6, color: lineColor });
  y -= 14;
  drawText(page, "Authorised signatory", { x: MARGIN, y, size: 9, font, color: muted });

  const pageCount = doc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const current = doc.getPage(i);
    current.drawText(pdfSafeText(`Page ${i + 1} of ${pageCount}`), {
      x: PAGE_WIDTH / 2 - 28,
      y: 24,
      size: 8,
      font,
      color: muted,
    });
  }

  return doc.save();
}

type LegacyInvoicePdfInput = CompanyInvoiceDetails & {
  invoiceNumber: string;
  invoiceDate: Date;
  billingMonth: number;
  billingYear: number;
  clientName: string;
  billToName?: string;
  billToAddress?: string;
  projectName: string;
  projectCode: string;
  description: string;
  amount: number;
  currency: string;
  currencySymbol?: string;
  status: string;
};

export async function buildInvoicePdf(input: LegacyInvoicePdfInput) {
  return buildClientInvoicePdf({
    ...input,
    lines: [{ code: input.projectCode, name: input.projectName, amount: input.amount }],
    discount: 0,
    gstRate: 0,
  });
}
