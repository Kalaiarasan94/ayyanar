import { Platform } from 'react-native';

// Builds REAL vector PDFs (actual text + tables) using jsPDF — never a
// screenshot/canvas rasterization of the page. Used by every report in the
// app: I/O statements, site expenses, driver trips, leads, and account books.

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

// Builds a jsPDF document with a letterhead, optional summary boxes, and one
// or more tables. Nothing here touches the DOM or a canvas — every element is
// drawn with real vector text, so the output is small, crisp, and selectable.
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
        y = 40; // reset top margin for continuation pages
      },
    });
    y = (doc as any).lastAutoTable.finalY + 26;
  });

  return { doc, filename: opts.filename };
};

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;
const dailySheetDateLabel = (iso: string) => {
  const parts = (iso || '').toString().split('T')[0].split('-');
  if (parts.length < 3) return iso || '-';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parts[2]} ${MONTHS[parseInt(parts[1]) - 1] || ''} ${parts[0]}`;
};

export type DailySheetInput = {
  siteName: string;
  supervisorName: string;
  date: string;
  workDescription: string;
  attendance: { name?: string; category: string; count: number }[];
  amountReceived: number;
  billsNormal: number;
  billsGst: number;
  billsCredit: number;
  vehicleRental: number;
  labourSalary: { name: string; amount: number }[];
  totalAmount: number;
};

// Builds a real vector PDF for one Daily Sheet — used both from the Supervisor's
// own Daily Sheet screen (fresh submit + Submitted list) and from the Admin
// panel's Daily Sheet review, so both sides get an identical professional printout.
export const buildDailySheetPdfDoc = async (sheet: DailySheetInput): Promise<ReportDoc> => {
  const labourTotal = sheet.labourSalary.reduce((s, l) => s + Number(l.amount || 0), 0);
  return buildPdfReport({
    filename: `daily-sheet-${sheet.siteName}-${sheet.date}.pdf`,
    title: 'Daily Sheet',
    subtitle: `${sheet.siteName} • ${dailySheetDateLabel(sheet.date)} • Supervisor: ${sheet.supervisorName}${sheet.workDescription ? ` • Work: ${sheet.workDescription}` : ''}`,
    summaryBoxes: [
      { label: 'Amount Received', value: rupees(sheet.amountReceived), color: '#15803d' },
      { label: 'Total Amount Spent', value: rupees(sheet.totalAmount), color: '#e23744' },
    ],
    tables: [
      {
        title: `Attendance (${sheet.attendance.length})`,
        head: ['Category', 'Name', 'Present'],
        body: sheet.attendance.length
          ? sheet.attendance.map((a) => [a.category, a.name || '-', a.count])
          : [['No attendance recorded', '', '']],
      },
      {
        title: 'Bills & Expenses',
        head: ['Type', 'Amount (Rs)'],
        body: [
          ['Bills Spent — Normal', Number(sheet.billsNormal).toLocaleString('en-IN')],
          ['Bills Spent — GST', Number(sheet.billsGst).toLocaleString('en-IN')],
          ['Bills Under GST / No GST — In Credit', Number(sheet.billsCredit).toLocaleString('en-IN')],
          ['Vehicle & Rental Use', Number(sheet.vehicleRental).toLocaleString('en-IN')],
        ],
        foot: ['TOTAL BILLS & EXPENSES', (Number(sheet.billsNormal) + Number(sheet.billsGst) + Number(sheet.billsCredit) + Number(sheet.vehicleRental)).toLocaleString('en-IN')],
      },
      {
        title: `Labour Salary (${sheet.labourSalary.length})`,
        head: ['Worker Name', 'Amount (Rs)'],
        body: sheet.labourSalary.length
          ? sheet.labourSalary.map((l) => [l.name, Number(l.amount).toLocaleString('en-IN')])
          : [['No labour salary recorded', '']],
        foot: ['TOTAL LABOUR SALARY', labourTotal.toLocaleString('en-IN')],
      },
    ],
  });
};

const hexToRgb = (hex?: string): [number, number, number] | null => {
  if (!hex) return null;
  const m = hex.replace('#', '');
  if (m.length !== 6) return null;
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
};

// Downloads the PDF. Web: instant browser download (no dialog). Native:
// writes to cache and opens the share sheet, which includes "Save to Files".
export const downloadPdfReport = async ({ doc, filename }: ReportDoc) => {
  if (Platform.OS === 'web') {
    doc.save(filename);
    return;
  }
  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const base64 = doc.output('datauristring').split(',')[1];
  const localUri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(localUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(localUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: filename });
  }
};

// Shares the actual PDF file. Web: uses the Web Share API (opens the native
// share sheet with WhatsApp as an option) where the browser supports sharing
// files; otherwise downloads the real PDF and opens WhatsApp with a text
// summary so it can be attached manually. Native: real file via the share sheet.
export const sharePdfReportOnWhatsApp = async ({ doc, filename }: ReportDoc, textSummary: string) => {
  if (Platform.OS === 'web') {
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
    return;
  }

  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const base64 = doc.output('datauristring').split(',')[1];
  const localUri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(localUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(localUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share on WhatsApp' });
  }
};
