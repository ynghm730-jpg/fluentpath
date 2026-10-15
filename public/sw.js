// FluentPath Service Worker (PWA)
const CACHE_NAME = 'fluentpath-cache-v1';
const BASE_PATH = '/fluentpath/';

// 初期キャッシュ対象
const PRECACHE_ASSETS = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}manifest.json`,
  `${BASE_PATH}icon-192.png`,
  `${BASE_PATH}icon-512.png`,
  `${BASE_PATH}icon.svg`
];

// インストール時にコアアセットをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Precache partial fail (normal during dev):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// アクティベート時に古いキャッシュを整理
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ネットワーク優先、フォールバックでキャッシュを返す戦略
self.addEventListener('fetch', (event) => {
  // GETリクエストのみ対象
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 同一オリジンのアセットのみキャッシュ対象
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 成功したレスポンスをキャッシュに複製保存
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // オフライン時はキャッシュから返す
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            // ナビゲーションリクエストならindex.htmlを返す
            if (event.request.mode === 'navigate') {
              return caches.match(`${BASE_PATH}index.html`);
            }
            return new Response('Offline', { status: 503, statusText: 'Offline' });
          });
        })
    );
  }
});
