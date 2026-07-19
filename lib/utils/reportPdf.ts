import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

const BRAND_NAME = "MEDWISE PHARMACEUTICAL PRODUCTS TRADING";
// Brand header fill (matches the app's blue accent)
const HEAD_FILL: [number, number, number] = [37, 99, 235];

export interface ReportPdfSummary {
  label: string;
  value: string;
}

export interface ReportPdfOptions {
  /** Report title shown under the brand name. */
  title: string;
  /** Output file name WITHOUT extension. */
  fileName: string;
  /** Table column headers. */
  columns: string[];
  /** Table rows (each an array aligned to `columns`). */
  rows: (string | number | null | undefined)[][];
  /** Optional context lines (period, branch, filters) rendered under the title. */
  meta?: string[];
  /** Optional key figures rendered as a summary strip above the table. */
  summary?: ReportPdfSummary[];
  /** Column indices to right-align (numeric/currency columns). */
  numericColumns?: number[];
  /** Page orientation. Defaults to landscape for wide tables. */
  orientation?: "portrait" | "landscape";
}

/**
 * Generates a consistent, branded PDF for a report and triggers a download.
 * Replaces the previous Excel (XLSX) exports across the /reports module so
 * every downloadable is a print-ready, formatted PDF.
 */
export function exportReportPdf({
  title,
  fileName,
  columns,
  rows,
  meta = [],
  summary = [],
  numericColumns = [],
  orientation = "landscape",
}: ReportPdfOptions) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // ----- Header -----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(BRAND_NAME, pageWidth / 2, 42, { align: "center" });

  doc.setFontSize(15);
  doc.text(title, pageWidth / 2, 64, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    `Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`,
    pageWidth / 2,
    80,
    { align: "center" }
  );
  doc.setTextColor(0);

  let cursorY = 100;

  // ----- Meta / filter context -----
  if (meta.length) {
    doc.setFontSize(10);
    for (const line of meta) {
      doc.text(line, margin, cursorY);
      cursorY += 15;
    }
    cursorY += 4;
  }

  // ----- Summary strip -----
  if (summary.length) {
    doc.setFontSize(10);
    const strip = summary.map((s) => `${s.label}: ${s.value}`).join("     ");
    const wrapped = doc.splitTextToSize(strip, pageWidth - margin * 2);
    doc.setFont("helvetica", "bold");
    doc.text(wrapped, margin, cursorY);
    doc.setFont("helvetica", "normal");
    cursorY += wrapped.length * 14 + 6;
  }

  const columnStyles = numericColumns.reduce(
    (acc, idx) => {
      acc[idx] = { halign: "right" as const };
      return acc;
    },
    {} as Record<number, { halign: "right" }>
  );

  // ----- Table -----
  autoTable(doc, {
    head: [columns],
    body: rows.map((r) => r.map((c) => (c === null || c === undefined ? "-" : c))),
    startY: cursorY,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: HEAD_FILL, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles,
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(130);
      doc.text(
        `Page ${doc.getCurrentPageInfo().pageNumber} of ${pageCount}`,
        pageWidth - margin,
        pageHeight - 18,
        { align: "right" }
      );
      doc.setTextColor(0);
    },
  });

  doc.save(`${fileName}_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf`);
}
