# Client trackers (pilot)

- `index.html`: trainer roster. Live at https://javadsuggs.github.io/js-fitness-tracker/clients/
- `c.html?c=<slug>`: one client's tracker, loaded live from their Google Sheet.
- `clients.json`: the client list. Add one entry per client:

```json
[
  { "slug": "jane-d", "name": "Jane D.", "feed": "https://script.google.com/macros/s/XXXX/exec" }
]
```

- `apps-script/Code.gs`: paste into the template Google Sheet (Extensions > Apps Script).
