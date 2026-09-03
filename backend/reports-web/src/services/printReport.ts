// Ported from frontend/services/printReport.ts — web-only (native branches
// dropped; same exported names/signatures as the mobile app's version).

// Downloads/shares a CSV file that opens directly in Excel.
export const exportCsv = async (filename: string, csv: string) => {
  // BOM so Excel renders ₹/unicode correctly
  const content = '﻿' + csv;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Escapes one CSV cell
export const csvCell = (value: any) => {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Forces a browser file download of a remote image.
export const downloadImage = async (url: string, filename: string) => {
  const blob = await (await fetch(url)).blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
};

// Browsers cannot attach a binary file to WhatsApp from JS, so this sends the
// image's link as WhatsApp text instead.
export const shareImageOnWhatsApp = async (url: string, _filename: string, caption?: string) => {
  const text = `${caption ? caption + '\n' : ''}${url}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
};
