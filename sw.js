/* ============================================================
   NOS RECETTES — service worker
   Son seul role : permettre d'ouvrir l'app sans reseau.

   Le piege classique d'un service worker, c'est de servir eternellement
   une vieille version depuis le cache : tu deploies sur Vercel et rien ne
   change sur le telephone. On l'evite avec une regle simple :

     la page  -> RESEAU D'ABORD, cache en secours
     le reste -> cache d'abord, pour que ce soit instantane

   Donc en ligne tu as toujours la derniere version, et hors ligne tu as
   la derniere que tu as vue.
   ============================================================ */

const VERSION    = "nos-recettes-v2";   // v2 : nouvelles icones (purge les anciennes)
const CACHE_APP  = VERSION + "-app";     // la page et ses icones
const CACHE_PHOTOS = VERSION + "-photos"; // les photos des recettes

// Ce qui est mis en cache des l'installation, pour que l'app s'ouvre
// hors ligne meme si on ne l'a lancee qu'une fois.
const SOCLE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.jpg",
  "/icon-512.jpg",
  "/apple-touch-icon.jpg"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_APP)
      // addAll echoue en entier si un seul fichier manque : on ajoute donc
      // un par un, et un absent ne bloque pas l'installation.
      .then(c => Promise.all(SOCLE.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())   // la nouvelle version prend la main tout de suite
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(noms => Promise.all(
        noms.filter(n => !n.startsWith(VERSION)).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;             // on ne touche pas aux ecritures
  const url = new URL(req.url);

  // 1. Les appels a la base : jamais de cache. Des donnees perimees seraient
  //    pires que pas de donnees — l'app a deja son propre cache local.
  if (url.pathname.startsWith("/rest/v1/")) return;

  // 2. Les photos des recettes : cache d'abord, et on rafraichit en fond.
  //    C'est ce qui permet de revoir ses recettes en photo sans reseau.
  if (url.pathname.includes("/storage/v1/object/public/")) {
    e.respondWith(
      caches.open(CACHE_PHOTOS).then(c =>
        c.match(req).then(enCache => {
          const reseau = fetch(req)
            .then(res => { if (res.ok) c.put(req, res.clone()); return res; })
            .catch(() => enCache);
          return enCache || reseau;
        })
      )
    );
    return;
  }

  // 3. La page elle-meme : reseau d'abord. C'est ce qui fait qu'un
  //    deploiement Vercel apparait immediatement.
  if (req.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html")) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copie = res.clone();
          caches.open(CACHE_APP).then(c => c.put(req, copie));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match("/index.html")))
    );
    return;
  }

  // 4. Le reste (icones, polices) : cache d'abord, ce sont des fichiers stables.
  e.respondWith(
    caches.match(req).then(enCache =>
      enCache || fetch(req).then(res => {
        if (res.ok && (url.origin === location.origin || url.hostname.endsWith("gstatic.com"))) {
          const copie = res.clone();
          caches.open(CACHE_APP).then(c => c.put(req, copie));
        }
        return res;
      })
    )
  );
});

/* Permet a la page de forcer la mise a jour si besoin. */
self.addEventListener("message", e => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
