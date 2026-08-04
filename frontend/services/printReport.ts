import { Platform } from 'react-native';

// Downloads/shares a CSV file that opens directly in Excel.
// Web: browser download. Native: saved to cache and opened in the share sheet.
export const exportCsv = async (filename: string, csv: string) => {
  // BOM so Excel renders ₹/unicode correctly
  const content = '﻿' + csv;

  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const fileUri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: filename });
  }
};

// Escapes one CSV cell
export const csvCell = (value: any) => {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Downloads a remote image (e.g. a driver's diesel bill photo) to the device.
// Web: forces a browser file download. Native: saves to cache and opens the
// share sheet, which includes a "Save Image" option on both iOS and Android.
export const downloadImage = async (url: string, filename: string) => {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(url)).blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
    return;
  }

  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const localUri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.downloadAsync(url, localUri);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(localUri, { mimeType: 'image/jpeg', dialogTitle: `Save ${filename}` });
  }
};

// Shares a remote image. Web browsers cannot attach a binary file to WhatsApp
// from JS, so we send the image's link as WhatsApp text instead; native opens
// the OS share sheet with the actual image (pick WhatsApp there directly).
export const shareImageOnWhatsApp = async (url: string, filename: string, caption?: string) => {
  if (Platform.OS === 'web') {
    const text = `${caption ? caption + '\n' : ''}${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    return;
  }

  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const localUri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.downloadAsync(url, localUri);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(localUri, { mimeType: 'image/jpeg', dialogTitle: 'Share on WhatsApp' });
  }
};

// NOTE: Real PDF report generation lives in services/pdfReport.ts (jsPDF —
// genuine vector text/tables). The old html2pdf.js/html2canvas approach that
// used to live here rasterized the page into an image ("looked like a
// screenshot" inside the PDF) and has been removed.
