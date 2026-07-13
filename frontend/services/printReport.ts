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

// Web-only PDF generation and download using html2pdf.js CDN
export const printHtmlOnWeb = (html: string, filename: string = 'report.pdf') =>
  new Promise<void>((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '0';
    iframe.style.top = '0';
    iframe.style.width = '1024px';
    iframe.style.height = '768px';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-9999';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      resolve();
      return;
    }

    const scriptTag = `<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>`;
    
    const initScript = `
      <script>
        window.addEventListener('load', () => {
          const checkLoaded = setInterval(() => {
            if (window.html2pdf) {
              clearInterval(checkLoaded);
              
              const opt = {
                margin: 0.25,
                filename: '${filename.replace(/'/g, "\\'")}',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
              };
              
              window.html2pdf().from(document.body).set(opt).save()
                .then(() => {
                  window.parent.postMessage('pdf-downloaded', '*');
                })
                .catch(err => {
                  console.error(err);
                  window.parent.postMessage('pdf-error', '*');
                });
            }
          }, 50);
        });
      </script>
    `;

    doc.open();
    doc.write(`
      <html>
        <head>
          ${scriptTag}
        </head>
        <body style="margin:0; padding:0;">
          <div style="padding:20px;">
            ${html}
          </div>
          ${initScript}
        </body>
      </html>
    `);
    doc.close();

    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'pdf-downloaded' || event.data === 'pdf-error') {
        window.removeEventListener('message', handleMessage);
        setTimeout(() => {
          document.body.removeChild(iframe);
          resolve();
        }, 800);
      }
    };

    window.addEventListener('message', handleMessage);
  });
