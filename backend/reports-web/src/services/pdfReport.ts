import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export const dailySheetDateLabel = (iso: string) => {
  const parts = (iso || '').toString().split('T')[0].split('-');
  if (parts.length < 3) return iso || '-';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parts[2]} ${MONTHS[parseInt(parts[1]) - 1] || ''} ${parts[0]}`;
};

export type SingleDailySheetInput = {
  supervisorName: string;
  siteName: string;
  date: string;
  workDescription?: string;
  attendance?: { name?: string; category: string; count: number | string }[];
  amountReceived?: number | string;
  billsNormal?: number | string;
  billsGst?: number | string;
  billsCredit?: number | string;
  vehicleRental?: number | string;
  labourSalary?: { name: string; amount: number | string }[];
  totalAmount?: number | string;
};

// Generates a professional single Daily Sheet PDF matching the exact paper format:
// Supervisor Name, Date, Site, Work Description, Attendance, Bills, Labour Salary, Signatures
export const buildSingleDailySheetPdfDoc = async (sheet: SingleDailySheetInput): Promise<ReportDoc> => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let y = 0;

  // Header Company Banner Box
  doc.setFillColor(...BRAND_RED);
  doc.rect(0, 0, pageWidth, 56, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('AYYANAR BUILDERS & PROPERTYS', marginX, 35);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('SUPERVISOR DAILY SHEET REPORT', pageWidth - marginX, 35, { align: 'right' });

  y = 75;

  // Supervisor & Site Metadata Container Box
  doc.setDrawColor(...BORDER);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginX, y, pageWidth - marginX * 2, 64, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);

  // Left Column
  doc.text('SUPERVISOR NAME:', marginX + 14, y + 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...DARK);
  doc.text(sheet.supervisorName || '—', marginX + 120, y + 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  doc.text('WORK DETAILS:', marginX + 14, y + 46);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...DARK);
  doc.text(sheet.workDescription || 'General Site Work', marginX + 120, y + 46);

  // Right Column
  const rightColX = pageWidth / 2 + 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  doc.text('DATE:', rightColX, y + 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...DARK);
  doc.text(dailySheetDateLabel(sheet.date), rightColX + 45, y + 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  doc.text('SITE NAME:', rightColX, y + 46);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...DARK);
  doc.text(sheet.siteName || '—', rightColX + 65, y + 46);

  y += 80;

  // 1. Attendance Section
  const attRows = (sheet.attendance || []).map((a, i) => [
    i + 1,
    a.category || 'Worker',
    a.name || '—',
    a.count || 1,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'ATTENDANCE — Worker Category', 'Worker Name', 'Present Count']],
    body: attRows.length > 0 ? attRows : [['-', 'No attendance entries recorded', '-', '-']],
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 8.5, cellPadding: 5, textColor: DARK, lineColor: BORDER, lineWidth: 0.5 },
    headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT_ROW },
  });

  y = (doc as any).lastAutoTable.finalY + 16;

  // 2. Financial Breakdown Section (Matching handwritten sheet categories)
  const received = Number(sheet.amountReceived || 0);
  const normal = Number(sheet.billsNormal || 0);
  const gst = Number(sheet.billsGst || 0);
  const credit = Number(sheet.billsCredit || 0);
  const vehicle = Number(sheet.vehicleRental || 0);

  const labourItems = sheet.labourSalary || [];
  const totalLabourSalary = labourItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalSpent = Number(sheet.totalAmount || (normal + gst + credit + vehicle + totalLabourSalary));

  autoTable(doc, {
    startY: y,
    head: [['FINANCIAL STATEMENT & EXPENSES CATEGORY', 'AMOUNT (RS)']],
    body: [
      ['AMOUNT RECEIVED (Cash / Bank Inflow)', Number(received).toLocaleString('en-IN')],
      ['BILLS SPENT NORMAL', Number(normal).toLocaleString('en-IN')],
      ['BILLS SPENT GST', Number(gst).toLocaleString('en-IN')],
      ['BILLS UNDER GST / CREDIT', Number(credit).toLocaleString('en-IN')],
      ['VEHICLE AND RENTAL USE', Number(vehicle).toLocaleString('en-IN')],
      ['TOTAL LABOUR SALARY PAID', Number(totalLabourSalary).toLocaleString('en-IN')],
    ],
    foot: [
      ['TOTAL AMOUNT SPENT', Number(totalSpent).toLocaleString('en-IN')],
    ],
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 8.5, cellPadding: 5, textColor: DARK, lineColor: BORDER, lineWidth: 0.5 },
    headStyles: { fillColor: BRAND_RED, textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT_ROW },
  });

  y = (doc as any).lastAutoTable.finalY + 16;

  // 3. Labour Salary Detailed Breakdown Section
  const salaryRows = labourItems.map((l, i) => [
    i + 1,
    l.name || 'Worker',
    Number(l.amount || 0).toLocaleString('en-IN'),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'LABOUR SALARY — Worker Name', 'Amount Paid (Rs)']],
    body: salaryRows.length > 0 ? salaryRows : [['-', 'No labour salary recorded', '-']],
    foot: [['', 'TOTAL LABOUR SALARY', Number(totalLabourSalary).toLocaleString('en-IN')]],
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 8.5, cellPadding: 5, textColor: DARK, lineColor: BORDER, lineWidth: 0.5 },
    headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT_ROW },
  });

  y = (doc as any).lastAutoTable.finalY + 36;

  // Signatures Block
  const sigBoxWidth = (pageWidth - marginX * 2 - 40) / 2;

  doc.setDrawColor(...BORDER);
  doc.line(marginX, y + 20, marginX + sigBoxWidth, y + 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  doc.text('SUPERVISOR SIGNATURE', marginX, y + 34);

  doc.line(pageWidth - marginX - sigBoxWidth, y + 20, pageWidth - marginX, y + 20);
  doc.text('VERIFIED BY (ADMIN / ACCOUNTS)', pageWidth - marginX - sigBoxWidth, y + 34);

  const cleanSupervisor = (sheet.supervisorName || 'supervisor').toLowerCase().replace(/[^a-z0-9]/g, '-');
  const filename = `daily-sheet-${cleanSupervisor}-${sheet.date}.pdf`;
  return { doc, filename };
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
