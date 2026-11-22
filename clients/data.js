/*
  Data layer: the one place the tracker pages load and save data.
  Every page (client tracker, log screen, trainer dashboard) goes through TrackerData,
  so moving from Google Sheets to the real database later means changing this file only.

  TrackerData.listClients()            -> [{ slug, name, trainer, goal, location, demo, ... }]
  TrackerData.getClient(slug)          -> that entry, or null
  TrackerData.loadClient(entry, opts)  -> { settings, data, summary, canLog, formUrl }
                                          opts.onSlow(): called once if loading takes over 8 seconds
  TrackerData.saveEntries(entry, list) -> { ok, saved, skipped, error }
  Errors thrown carry .kind: 'list' | 'network' | 'format', and .detail for the technical reason.
*/
(function () {
  var me = document.currentScript;
  var BASE = new URL('.', me ? me.src : location.href).href; // the clients/ folder

  function fail(kind, detail) {
    var e = new Error(kind);
    e.kind = kind;
    e.detail = detail || '';
    return e;
  }
  function abs(url) { return /^https?:/.test(url) ? url : BASE + url; }
  function fresh(url) { return url + (url.indexOf('?') > -1 ? '&' : '?') + 't=' + Date.now(); }
  function isSheet(entry) { return /^https:\/\/script\.google\.com\//.test(entry && entry.feed || ''); }

  // ---------- Google Sheets backend (pilot) ----------
  var sheets = {
    listClients: function () {
      return fetch(BASE + 'clients.json', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .catch(function (e) { throw fail('list', e && e.message); });
    },
    loadClient: function (entry, opts) {
      opts = opts || {};
      var slow = setTimeout(function () { if (opts.onSlow) opts.onSlow(); }, 8000);
      var ctl = window.AbortController ? new AbortController() : null;
      var stop = setTimeout(function () { if (ctl) ctl.abort(); }, 45000);
      return fetch(fresh(abs(entry.feed)), ctl ? { signal: ctl.signal } : {})
        .then(function (r) { return r.json(); })
        .catch(function (e) { throw fail('network', e && (e.name + ' ' + e.message)); })
        .then(function (feed) {
          if (!feed || !feed.data) throw fail('format');
          var s = feed.settings || {};
          return {
            settings: s,
            data: feed.data,
            summary: feed.summary || {},
            // Sheets on script v2.2 or later take entries from the app's own log screen. Older sheets use the Google Form.
            canLog: !!feed.can_log && isSheet(entry),
            formUrl: s.form_url || entry.form || ''
          };
        })
        .finally(function () { clearTimeout(slow); clearTimeout(stop); });
    },
    saveEntries: function (entry, entries) {
      return fetch(entry.feed, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ entries: entries }) })
        .then(function (r) { return r.json(); })
        .catch(function () { return { ok: false, error: 'Not saved. Check your signal and tap Save again.' }; });
    }
  };

  var backend = sheets;
  var listCache = null;

  window.TrackerData = {
    backendName: 'sheets',
    listClients: function () {
      if (!listCache) listCache = backend.listClients().catch(function (e) { listCache = null; throw e; });
      return listCache;
    },
    getClient: function (slug) {
      return this.listClients().then(function (list) {
        return list.filter(function (x) { return x.slug === slug; })[0] || null;
      });
    },
    loadClient: function (entry, opts) { return backend.loadClient(entry, opts); },
    saveEntries: function (entry, entries) { return backend.saveEntries(entry, entries); }
  };
})();
