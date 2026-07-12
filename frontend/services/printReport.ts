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

// Web-only report printing. expo-print's printAsync on web prints the CURRENT
// page (a screenshot of the app) instead of the given HTML — so we render the
// report HTML into a hidden iframe and print that document instead.
export const printHtmlOnWeb = (html: string) =>
  new Promise<void>((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      resolve();
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();

    // Give the iframe a moment to lay out before opening the print dialog
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      // Clean up after the dialog closes (print blocks in most browsers)
      setTimeout(() => {
        document.body.removeChild(iframe);
        resolve();
      }, 500);
    }, 300);
  });
