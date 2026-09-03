// Ported from frontend/services/pdfReport.ts — web-only (this app never runs
// on native, so the Platform.OS branching and expo-file-system/expo-sharing
// paths from the original are dropped; every function keeps the same name
// and signature as the mobile app's version).
//
// Builds REAL vector PDFs (actual text + tables) using jsPDF — never a
// screenshot/canvas rasterization of the page.

export type SummaryBox = { label: string; value: string; color?: string };

export type ReportTable = {
  title?: string;
  head: string[];
  body: (string | number)[][];
  foot?: (string | number)[];
  columnStyles?: Record<number, { halign?: 'left' | 'center' | 'right'; cellWidth?: number }>;
};

export type ReportDoc = { doc: any; filename: string };

const BRAND_RED: [number, number, number] = [226, 26, 18];
const DARK: [number, number, number] = [15, 23, 42];
const GREY: [number, number, number] = [100, 116, 139];
const LIGHT_ROW: [number, number, number] = [248, 250, 252];
const BORDER: [number, number, number] = [226, 232, 240];

export const buildPdfReport = async (opts: {
  filename: string;
  title: string;
  subtitle: string;
  summaryBoxes?: SummaryBox[];
  tables: ReportTable[];
  orientation?: 'portrait' | 'landscape';
}): Promise<ReportDoc> => {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: opts.orientation || 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let y = 46;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...BRAND_RED);
  doc.text(`Ayyanar Construction — ${opts.title}`, marginX, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text(opts.subtitle, marginX, y);
  y += 12;
  doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, marginX, y);
  y += 20;

  if (opts.summaryBoxes?.length) {
    const gap = 10;
    const count = opts.summaryBoxes.length;
    const boxWidth = (pageWidth - marginX * 2 - gap * (count - 1)) / count;
    const boxHeight = 46;
    opts.summaryBoxes.forEach((box, i) => {
      const x = marginX + i * (boxWidth + gap);
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(1);
      doc.roundedRect(x, y, boxWidth, boxHeight, 4, 4);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...GREY);
      doc.text(box.label.toUpperCase(), x + 8, y + 16);
      doc.setFontSize(12.5);
      doc.setTextColor(...(hexToRgb(box.color) || DARK));
      doc.text(box.value, x + 8, y + 34);
    });
    y += boxHeight + 22;
  }

  opts.tables.forEach((table) => {
    if (table.title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...DARK);
      doc.text(table.title, marginX, y);
      y += 14;
    }
    autoTable(doc, {
      startY: y,
      head: [table.head],
      body: table.body,
      foot: table.foot ? [table.foot] : undefined,
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 8.5, cellPadding: 5, textColor: DARK, lineColor: BORDER, lineWidth: 0.5 },
      headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: LIGHT_ROW },
      columnStyles: table.columnStyles as any,
      didDrawPage: () => {
        y = 40;
      },
    });
    y = (doc as any).lastAutoTable.finalY + 26;
  });

  return { doc, filename: opts.filename };
};

const hexToRgb = (hex?: string): [number, number, number] | null => {
  if (!hex) return null;
  const m = hex.replace('#', '');
  if (m.length !== 6) return null;
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
};

// Instant browser download, no dialog.
export const downloadPdfReport = async ({ doc, filename }: ReportDoc) => {
  doc.save(filename);
};

// Web Share API where the browser supports sharing files (opens the native
// share sheet with WhatsApp as an option); otherwise downloads the PDF and
// opens WhatsApp with a text summary so it can be attached manually.
export const sharePdfReportOnWhatsApp = async ({ doc, filename }: ReportDoc, textSummary: string) => {
  const blob = doc.output('blob') as Blob;
  const nav: any = typeof navigator !== 'undefined' ? navigator : null;
  try {
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (nav?.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: filename, text: textSummary });
      return;
    }
  } catch {
    // User cancelled the native share sheet, or the browser rejected it — fall through
  }
  doc.save(filename);
  window.open(`https://wa.me/?text=${encodeURIComponent(`${textSummary}\n\n(PDF downloaded to your device — attach it here)`)}`, '_blank');
};
