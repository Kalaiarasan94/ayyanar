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
        {/* Critical: Mobile PWA Viewport — prevents accidental zoom, fits notch/safe-areas, and stable virtual keyboard behavior */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <title>Ayyanar Construction CRM</title>
        <meta name="description" content="Ayyanar Infra Engineering — Construction CRM for sites, staff, drivers and accounts." />
        
        {/* Force light color scheme so mobile browsers never inject dark-mode black boxes */}
        <meta name="color-scheme" content="light" />
        
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
  :root {
    color-scheme: light;
    --sat: env(safe-area-inset-top, 0px);
    --sar: env(safe-area-inset-right, 0px);
    --sab: env(safe-area-inset-bottom, 0px);
    --sal: env(safe-area-inset-left, 0px);
  }

  html, body {
    width: 100%;
    min-height: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overscroll-behavior-y: none;
    -webkit-overflow-scrolling: touch;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    background: #F7F5F5;
    color-scheme: light;
  }
  body {
    overflow-x: hidden;
    background: #F7F5F5;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  #root {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 100%;
    flex: 1;
    background: #F7F5F5;
  }

  /* Universal Mobile Web Input Improvements:
     - 16px font-size prevents iOS Safari from auto-zooming on focus
     - text-size-adjust: 100% prevents mobile font inflation
     - outline: none prevents browser black box focus rings
     - background: transparent prevents dark mode user-agent black box
  */
  input, textarea, select {
    font-size: 16px !important;
    -webkit-text-size-adjust: 100%;
    touch-action: manipulation;
    outline: none !important;
    outline-style: none !important;
    box-shadow: none !important;
    background-color: transparent !important;
    color: #26191A !important;
    border-color: transparent;
  }
  input:focus, textarea:focus, select:focus {
    outline: none !important;
    outline-style: none !important;
    box-shadow: none !important;
  }

  /* Prevent Chrome autofill from painting inputs with black/yellow box */
  input:-webkit-autofill,
  input:-webkit-autofill:hover, 
  input:-webkit-autofill:focus,
  input:-webkit-autofill:active {
    -webkit-box-shadow: 0 0 0 1000px #FFFFFF inset !important;
    box-shadow: 0 0 0 1000px #FFFFFF inset !important;
    -webkit-text-fill-color: #26191A !important;
    transition: background-color 5000s ease-in-out 0s;
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

  /* TABLET (768px - 1023px): clean responsive brand layout */
  @media (min-width: 768px) {
    body {
      background: #F3EFEF;
    }
    #root {
      min-height: 100vh;
      box-shadow: 0 0 40px rgba(0, 0, 0, 0.08);
    }
  }

  /* DESKTOP / LAPTOP (>= 1024px): centered responsive application container */
  @media (min-width: 1024px) {
    body {
      background: #ECE8E8;
    }
    #root {
      max-width: 1180px;
      margin: 0 auto;
      min-height: 100vh;
      box-shadow: 0 0 50px rgba(0, 0, 0, 0.06);
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
