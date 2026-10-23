// CampusFind Minimal Pass-Through Service Worker
// Satisfies PWA installation criteria without risky offline caching or storage of private user data.

const SW_VERSION = 'campusfind-pwa-v1';

self.addEventListener('install', (event) => {
  // Activate worker immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all open pages under scope immediately
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Direct network pass-through: do not cache API requests or dynamic data
  return;
});
