/*
  Makes the tracker installable as a phone app.
  - Adds an app file (web manifest) built for this exact page, so the home screen icon opens
    the same client's tracker (or the same trainer view) it was added from.
  - Starts the offline helper (sw.js), which keeps the last loaded copy for when there is no signal.
  - Shows a small, dismissible tip on how to add the app to the home screen.
  Use: <script src="pwa.js" data-app="client" defer></script>  (data-app="trainer" on the dashboard)
*/
(function () {
  var me = document.currentScript;
  var kind = (me && me.dataset.app) || 'client';
  var base = new URL('.', me ? me.src : location.href).href; // the clients/ folder
  var embedded = window.parent !== window; // inside the trainer dashboard's viewer
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var params = new URLSearchParams(location.search);

  // ---------- App file (manifest) for this page ----------
  var start, scope, name, shortName, desc, color, icon;
  if (kind === 'trainer') {
    var keep = new URLSearchParams();
    ['loc', 't'].forEach(function (k) { if (params.get(k)) keep.set(k, params.get(k)); });
    scope = new URL('./', location.href).href;
    start = scope + (keep.toString() ? '?' + keep : '');
    name = 'Trainer Dashboard';
    shortName = 'Trainers';
    desc = 'Client progress, goals and training logs in one place.';
    color = '#121417';
    icon = 'trainer';
  } else {
    var slug = params.get('c');
    scope = base;
    start = base + 'c.html' + (slug ? '?c=' + encodeURIComponent(slug) : '');
    name = 'Fitness Tracker';
    shortName = 'Tracker';
    desc = 'Log workouts, food, weigh-ins, water and sleep, and see your progress.';
    color = '#121417';
    icon = 'client';
  }
  var manifest = {
    id: start,
    name: name,
    short_name: shortName,
    description: desc,
    start_url: start,
    scope: scope,
    display: 'standalone',
    orientation: 'portrait',
    background_color: color,
    theme_color: color,
    icons: [
      { src: base + 'icons/' + icon + '-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: base + 'icons/' + icon + '-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: base + 'icons/' + icon + '-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
  function addTag(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    document.head.appendChild(el);
    return el;
  }
  addTag('link', { rel: 'manifest', href: 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest)) });

  // ---------- Offline helper ----------
  if ('serviceWorker' in navigator && !embedded && window.isSecureContext) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* the page still works without it */ });
    });
  }

  // ---------- Offline note and install tip ----------
  var css = '.pwa-note{margin:10px 0 12px;padding:10px 12px;border:1px solid #2c3038;border-radius:10px;background:#1b1e23;color:#c9ced5;' +
    'font:13.5px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;display:flex;gap:10px;align-items:flex-start}' +
    '.pwa-note p{margin:0;flex:1}.pwa-note b{color:#eceef1}.pwa-note button{font:inherit;cursor:pointer;border-radius:999px;border:1px solid #353a43;background:#23272d;color:#eceef1;padding:5px 12px;flex:none}' +
    '.pwa-note button.go{background:#4fd1a5;border-color:#4fd1a5;color:#0d1f18;font-weight:700}.pwa-note button.x{padding:5px 10px}' +
    '.pwa-off{border-color:#5a4a22;background:#262115;color:#e8d9b0}';
  addTag('style', {}).textContent = css;
  var anchor = null;
  function place(el) {
    var a = document.getElementById(me && me.dataset.after);
    if (!a) return false;
    // Put notes after the log button when there is one, so the page title stays on top.
    var after = a.nextElementSibling && a.nextElementSibling.classList.contains('log-btn') ? a.nextElementSibling : a;
    if (anchor && anchor.parentNode) after = anchor;
    after.after(el); anchor = el;
    return true;
  }
  function note(html, cls) {
    var el = document.createElement('div');
    el.className = 'pwa-note' + (cls ? ' ' + cls : '');
    el.innerHTML = html;
    return el;
  }
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage off: the tip shows again next time */ } }
  };
  var offEl = null;
  function showOffline() {
    if (offEl || navigator.onLine !== false) return;
    offEl = note('<p><b>No signal.</b> Showing the last copy saved on this phone. New entries need a connection.</p>', 'pwa-off');
    if (!place(offEl)) offEl = null;
  }
  window.addEventListener('offline', showOffline);
  window.addEventListener('online', function () { if (offEl) { offEl.remove(); offEl = null; } });

  var TIP_KEY = 'pwa-tip-hidden:' + kind;
  var deferred = null, tipEl = null;
  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isIOSSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  function hideTip() { store.set(TIP_KEY, '1'); if (tipEl) { tipEl.remove(); tipEl = null; } }
  function showTip(html, withButton) {
    if (tipEl || embedded || standalone || (me && me.dataset.tip === 'no') || store.get(TIP_KEY)) return;
    tipEl = note('<p>' + html + '</p>' + (withButton ? '<button class="go" type="button">Install</button>' : '') +
      '<button class="x" type="button" aria-label="Hide this tip">&times;</button>');
    tipEl.querySelector('.x').onclick = hideTip;
    var go = tipEl.querySelector('.go');
    if (go) go.onclick = function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function (c) { if (c && c.outcome === 'accepted') hideTip(); deferred = null; });
    };
    if (!place(tipEl)) tipEl = null;
  }
  var what = kind === 'trainer' ? 'the dashboard' : 'your tracker';
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    whenReady(function () { showTip('<b>Add ' + what + ' to your home screen</b> to open it like an app.', true); });
  });
  window.addEventListener('appinstalled', hideTip);

  // The client page draws its header after its data loads, so wait for the anchor to exist.
  function whenReady(fn) {
    var tries = 0;
    (function check() {
      var a = document.getElementById(me && me.dataset.after);
      if (a && !a.closest('[hidden]')) return fn();
      if (++tries < 120) setTimeout(check, 250);
    })();
  }
  whenReady(function () {
    showOffline();
    if (isIOSSafari) showTip('<b>Add ' + what + ' to your home screen:</b> tap the Share button, then <b>Add to Home Screen</b>.', false);
  });
})();
