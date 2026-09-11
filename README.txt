JW EDS AUDIO ENGINE PWA v1.3

THIS IS THE COMPLETE FLAT PWA PACKAGE.

FILES REQUIRED FOR HOSTING ARE AT THE TOP LEVEL:
  index.html
  styles.css
  app.js
  manifest.webmanifest
  sw.js

QUICK TEST
1. Unzip the folder.
2. For a proper PWA test, serve the folder over HTTP/HTTPS (service workers do not run from file://).
3. GitHub Pages: upload ALL contents to the repository root, enable Pages from the main branch/root.
4. Safari: open the resulting HTTPS link, Share > Add to Home Screen.

LOCAL VOICE ENGINE
The PWA expects an optional local voice engine at http://127.0.0.1:8765 and checks GET /health.
The browser UI works without it; actual offline neural voice cloning requires the local backend/model runtime.

This package intentionally contains no cloud API secret keys.
