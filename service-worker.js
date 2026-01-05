// 最小限のService Worker（PWAインストール可能にするため）
// オフライン対応は実装していません

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installed');
  // すぐにアクティブ化
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated');
  // すべてのクライアントを即座に制御下に置く
  event.waitUntil(clients.claim());
});

// fetchイベント - 何もせずネットワークリクエストをそのまま通す
self.addEventListener('fetch', (event) => {
  // オンライン時は通常通りネットワークから取得
  event.respondWith(fetch(event.request));
});