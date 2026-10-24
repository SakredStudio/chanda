// Chanda Collector — Service Worker (cache-first app shell, versioned cache name)

// Cache-first shell: installed phones only pick up a new release when this name changes.
// BUMP THIS ON EVERY DEPLOY (v4 = 2026-10-24 delete/add people/wipe/dark theme).
const CACHE_NAME = 'chanda-shell-v5';

const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './privacy.html',
  './app.js',
  './manifest.webmanifest',
  './i18n/en.json',
  './i18n/hi.json',
  './i18n/hinglish.json',
  './lib/format.js',
  './lib/i18n.js',
  './lib/phone.js',
  './lib/store.js',
  './lib/tally.js',
  './lib/upi.js',
  './lib/wa.js',
  './lib/billing.js',
  './vendor/qrcode.js',
  './vendor/LICENSE',
  './fonts/mukta.css',
  './fonts/OFL.txt',
  './fonts/Mukta-400-devanagari.woff2',
  './fonts/Mukta-400-latin-ext.woff2',
  './fonts/Mukta-400-latin.woff2',
  './fonts/Mukta-500-devanagari.woff2',
  './fonts/Mukta-500-latin-ext.woff2',
  './fonts/Mukta-500-latin.woff2',
  './fonts/Mukta-600-devanagari.woff2',
  './fonts/Mukta-600-latin-ext.woff2',
  './fonts/Mukta-600-latin.woff2',
  './fonts/Mukta-700-devanagari.woff2',
  './fonts/Mukta-700-latin-ext.woff2',
  './fonts/Mukta-700-latin.woff2',
  './fonts/Mukta-800-devanagari.woff2',
  './fonts/Mukta-800-latin-ext.woff2',
  './fonts/Mukta-800-latin.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((oldKey) => caches.delete(oldKey))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request)
        .then((response) => {
          if (
            response &&
            response.status === 200 &&
            response.type === 'basic'
          ) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return undefined;
        });
    })
  );
});
