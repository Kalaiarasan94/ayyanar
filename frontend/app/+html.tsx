import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Web-only HTML shell used by Expo Router web.
 * Configures the viewport, PWA manifest, meta tags, and responsive shell.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* Critical: Mobile PWA Viewport — prevents accidental zoom, fits notch/safe-areas, and resizes on virtual keyboard */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content" />
        <title>Ayyanar Construction CRM</title>
        <meta name="description" content="Ayyanar Infra Engineering — Construction CRM for sites, staff, drivers and accounts." />
        
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />
        
        {/* Brand Theme Color */}
        <meta name="theme-color" content="#CB202D" />
        <meta name="msapplication-TileColor" content="#CB202D" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Ayyanar Construction CRM" />

        {/* Apple iOS PWA Meta Tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Ayyanar CRM" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

        {/* Favicons */}
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon.png" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveShellCss }} />

        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .then(function(reg) {
                      console.log('[PWA] Service Worker registered with scope:', reg.scope);
                    })
                    .catch(function(err) {
                      console.warn('[PWA] Service Worker registration failed:', err);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveShellCss = `
  html, body {
    width: 100%;
    height: 100%;
    height: 100dvh;
    margin: 0;
    padding: 0;
    overscroll-behavior-y: none;
    -webkit-overflow-scrolling: touch;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  body {
    overflow: hidden;
    background: #F7F5F5;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  #root {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    height: 100dvh;
    min-height: 100%;
    flex: 1;
    background: #F7F5F5;
    overflow: hidden;
  }

  /* Safe Area variables */
  :root {
    --sat: env(safe-area-inset-top, 0px);
    --sar: env(safe-area-inset-right, 0px);
    --sab: env(safe-area-inset-bottom, 0px);
    --sal: env(safe-area-inset-left, 0px);
  }

  /* Universal Mobile Web Input Improvements:
     - 16px font-size prevents iOS Safari from auto-zooming on focus
     - text-size-adjust: 100% prevents mobile font inflation
     - touch-action: manipulation eliminates 300ms tap delay
  */
  input, textarea, select {
    font-size: 16px !important;
    -webkit-text-size-adjust: 100%;
    touch-action: manipulation;
  }

  /* Smooth momentum scrolling for all scroll containers */
  [data-rnw-scrollview], [style*="overflow: auto"], [style*="overflow-y: auto"], [style*="overflow: scroll"], [style*="overflow-y: scroll"] {
    -webkit-overflow-scrolling: touch !important;
    overscroll-behavior-y: contain;
  }

  /* Clean subtle scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.15);
    border-radius: 4px;
  }

  /* TABLET (768px - 1023px): comfortable full-width web app */
  @media (min-width: 768px) {
    body {
      background: radial-gradient(1400px 700px at 50% -150px, #2A2D31 0%, #111317 65%);
    }
    #root {
      height: 100vh;
      box-shadow: 0 0 50px rgba(0, 0, 0, 0.4);
    }
  }

  /* DESKTOP / LAPTOP (>= 1024px): centered responsive application container */
  @media (min-width: 1024px) {
    #root {
      max-width: 1180px;
      margin: 0 auto;
    }
  }

  /* MOBILE (< 768px): true edge-to-edge mobile app */
  @media (max-width: 767px) {
    #root {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      box-shadow: none !important;
    }
  }

  /* Standalone PWA mode enhancements */
  @media all and (display-mode: standalone) {
    html, body {
      user-select: none;
      -webkit-user-select: none;
    }
    input, textarea {
      user-select: text;
      -webkit-user-select: text;
    }
  }
`;
