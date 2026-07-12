import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Web-only HTML shell used by `npx expo export --platform web`.
 * Has zero effect on the native Android/iOS app.
 *
 * - On MOBILE browsers the app fills the screen exactly like the mobile app (viewport meta).
 * - On DESKTOP browsers the app is presented as a clean centered column, website-style.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* Critical: makes the site render as MOBILE VIEW on phones */}
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <title>Ayyanar Construction CRM</title>
        <meta name="description" content="Ayyanar Infra Engineering — Construction CRM for sites, staff, drivers and accounts." />
        <meta name="theme-color" content="#111317" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveShellCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveShellCss = `
  html, body { height: 100%; margin: 0; padding: 0; }
  body { overflow: hidden; background: #EEF1F4; }
  #root { height: 100%; min-height: 100%; background: #F4F5F7; }

  /* MOBILE BROWSERS (< 768px): full-screen, identical to the mobile app. Untouched. */

  /* TABLET (768px - 1023px): comfortable full-width web app */
  @media (min-width: 768px) {
    body {
      background: radial-gradient(1400px 700px at 50% -150px, #2A2D31 0%, #111317 65%);
    }
    #root {
      height: 100vh;
      box-shadow: 0 0 60px rgba(0, 0, 0, 0.45);
    }
  }

  /* DESKTOP / LAPTOP (>= 1024px): real website layout — wide centered container,
     rendered at 125% so text and controls are comfortably sized on laptops.
     (zoom on body also covers modals, which render outside #root) */
  @media (min-width: 1024px) {
    body {
      zoom: 1.25;
    }
    #root {
      max-width: 1180px;
      margin: 0 auto;
    }
  }
`;
