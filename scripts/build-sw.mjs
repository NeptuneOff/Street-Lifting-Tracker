import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory() ? files(`${directory}/${entry.name}`) : `${directory}/${entry.name}`,
      ),
    )
  ).flat();
}
const paths = (await files('dist')).filter(
  (path) => !path.endsWith('.map') && !path.endsWith('sw.js'),
);
const digest = createHash('sha256');
for (const path of paths) digest.update(await readFile(path));
const version = digest.digest('hex').slice(0, 16);
const assets = paths.map((path) => path.replace(/^dist\//, ''));
await writeFile(
  'dist/sw.js',
  `
const SCOPE = new URL(self.registration.scope).pathname;
const PREFIX = 'streetlift:' + SCOPE + ':';
const CACHE = PREFIX + '${version}';
const ASSETS = ${JSON.stringify(assets)}.map(path => SCOPE + path);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(SCOPE + 'index.html', { ignoreVary: true })));
    return;
  }
  // Built assets are same-origin, content-hashed and identical for every viewer.
  // Ignore Vary: Origin emitted by preview/CDN servers for module requests.
  if (ASSETS.includes(url.pathname)) event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.pathname, { ignoreVary: true, ignoreSearch: true })) || fetch(event.request)));
});
`,
);
console.log(`Service worker ${version}: ${assets.length} ressources précachées.`);
