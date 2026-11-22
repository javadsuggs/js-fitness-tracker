# Client trackers (pilot)

- `../trainer-dashboard/index.html`: trainer dashboard. Live at https://javadsuggs.github.io/js-fitness-tracker/trainer-dashboard/
- `c.html?c=<slug>`: one client's tracker, loaded live from their Google Sheet.
- `clients.json`: the client list. Add one entry per client:

```json
[
  { "slug": "jane-d", "name": "Jane D.", "feed": "https://script.google.com/macros/s/XXXX/exec" }
]
```

- `apps-script/Code.gs`: paste into the template Google Sheet (Extensions > Apps Script).

## Phone app (install to home screen)

- `pwa.js`: added to c.html, log.html and the trainer dashboard. Builds an app file (manifest) for the page it is on, so the home screen icon opens that same client's tracker (or that trainer's view). Shows a one-time "add to home screen" tip and a "No signal" note when offline.
- `sw.js` (and `../trainer-dashboard/sw.js`): offline helper. Tries the network first, falls back to the last copy saved on the phone. Never touches saves. Not used on Javad's personal page.
- `icons/`: app icons and link preview images. Rebuild with `make_icons.py` if the look changes.
- To publish a change to pages or feeds, nothing extra is needed: the helper always fetches fresh copies when online. If `sw.js` itself changes, bump `CACHE` (for example `tracker-v2`).
