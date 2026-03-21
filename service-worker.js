const CACHE_VERSION = "v93-1-3-pwa-1";
const APP_CACHE = `lottery-ai-app-${CACHE_VERSION}`;
const DATA_CACHE = `lottery-ai-data-${CACHE_VERSION}`;

const APP_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./favicon.png",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png"
];

const DATA_ASSETS = [
  "./latest.json",
  "./raw_data/bingo.csv",
  "./raw_data/539.csv",
  "./raw_data/lotto649.csv",
  "./raw_data/649.csv",
  "./raw_data/superlotto638.csv",
  "./raw_data/638.csv",
  "./raw_data/power.csv"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const appCache = await caches.open(APP_CACHE);
      await appCache.addAll(APP_ASSETS.map(addCacheBust));

      const dataCache = await caches.open(DATA_CACHE);
      await Promise.allSettled(DATA_ASSETS.map((url) => dataCache.add(addCacheBust(url))));

      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== APP_CACHE && key !== DATA_CACHE) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  if (isDataRequest(url)) {
    event.respondWith(networkFirst(req, DATA_CACHE));
    return;
  }

  if (isAppShellRequest(url)) {
    event.respondWith(cacheFirst(req, APP_CACHE));
    return;
  }

  event.respondWith(staleWhileRevalidate(req, APP_CACHE));
});

function isDataRequest(url) {
  const path = url.pathname;
  return (
    path.endsWith("/latest.json") ||
    path.endsWith("/raw_data/bingo.csv") ||
    path.endsWith("/raw_data/539.csv") ||
    path.endsWith("/raw_data/lotto649.csv") ||
    path.endsWith("/raw_data/649.csv") ||
    path.endsWith("/raw_data/superlotto638.csv") ||
    path.endsWith("/raw_data/638.csv") ||
    path.endsWith("/raw_data/power.csv")
  );
}

function isAppShellRequest(url) {
  const path = url.pathname;
  return (
    path.endsWith("/") ||
    path.endsWith("/index.html") ||
    path.endsWith("/style.css") ||
    path.endsWith("/app.js") ||
    path.endsWith("/manifest.json") ||
    path.endsWith("/favicon.png") ||
    path.endsWith("/apple-touch-icon.png") ||
    path.endsWith("/icon-192.png") ||
    path.endsWith("/icon-512.png")
  );
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    return cached || offlineFallback();
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const fresh = await fetch(request, { cache: "no-store" });
    if (fresh && fresh.ok) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    return cached || offlineFallback();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });

  const fetchPromise = fetch(request)
    .then((fresh) => {
      if (fresh && fresh.ok) {
        cache.put(request, fresh.clone());
      }
      return fresh;
    })
    .catch(() => null);

  return cached || (await fetchPromise) || offlineFallback();
}

function offlineFallback() {
  return new Response("離線中，且快取內沒有可用資料。", {
    status: 503,
    statusText: "Service Unavailable",
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}

function addCacheBust(url) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${CACHE_VERSION}`;
}
