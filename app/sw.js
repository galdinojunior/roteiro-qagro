/*
 * Service Worker: guarda o app no aparelho para abrir sem internet.
 * Chamadas ao Apps Script (outra origem) NUNCA passam pelo cache.
 * Ao publicar mudança em app/, aumente VERSAO_CACHE junto com VERSAO em config.js.
 */
const VERSAO_CACHE = 'roteiro-v1.1.0';
const ARQUIVOS = [
  "./",
  "index.html",
  "estilo.css",
  "config.js",
  "geo.js",
  "logica.js",
  "armazenamento.js",
  "gps.js",
  "sincronizacao.js",
  "app.js",
  "manifest.webmanifest",
  "img/innovare-logo.png",
  "icones/icone-192.png",
  "icones/icone-512.png"
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSAO_CACHE).then((cache) => cache.addAll(ARQUIVOS)));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO_CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// A nova versão só assume quando o usuário toca em "atualizar" (evita trocar o app no meio do trabalho).
self.addEventListener('message', (evento) => {
  if (evento.data === 'ATUALIZAR') self.skipWaiting();
});

self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url);
  if (evento.request.method !== 'GET' || url.origin !== self.location.origin) return;
  evento.respondWith(
    caches.match(evento.request, { ignoreSearch: true })
      .then((resposta) => resposta || fetch(evento.request))
  );
});
