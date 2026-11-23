/*
  Gym leaderboard scoring. Shared by the client tracker, the trainer dashboard and the tests.
  The same rules as the database version (leaderboard() in the tethrfit repo):
  - Percent only, never pounds. First name and last initial.
  - Only clients who agreed (and SAMPLE clients during the pilot).
  - A client joins after 14 days and at least 3 weigh-ins.
  - Fat loss:    % of starting weight lost.
    Muscle gain: % of starting weight gained.
    Maintaining: % of weigh-ins within 2% of starting weight.
  - Fat loss and muscle gain credit stops at 1% of starting weight per week,
    so losing or gaining too fast does not win.
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Leaderboard = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var MIN_DAYS = 14, MIN_WEIGHINS = 3, CAP_PER_WEEK = 1, STEADY_BAND = 0.02;
  var GOALS = [
    { key: 'cut', label: 'Fat loss' },
    { key: 'bulk', label: 'Muscle gain' },
    { key: 'maintain', label: 'Maintaining' }
  ];

  function goalOf(v) {
    var s = String(v || '').toLowerCase();
    if (/bulk|gain/.test(s)) return 'bulk';
    if (/main/.test(s)) return 'maintain';
    return 'cut';
  }

  // "Marcus Thompson" -> "Marcus T."   "Marcus T." -> "Marcus T."   "Javad" -> "Javad"
  function shortName(name) {
    var parts = String(name || 'Client').trim().split(/\s+/);
    return parts[0] + (parts[1] ? ' ' + parts[1].replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase() + '.' : '');
  }

  function weighIns(csvText) {
    var lines = String(csvText || '').trim().split('\n');
    var head = (lines.shift() || '').split(',');
    var di = head.indexOf('date'), wi = head.indexOf('weight_lb');
    return lines.map(function (l) { var c = l.split(','); return { date: c[di], lb: Number(c[wi]) }; })
      .filter(function (r) { return /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.lb > 0; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }

  function daysBetween(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5); }

  // One client's score from their feed data. Returns { eligible, score, days, count, note }.
  function score(data, goal) {
    var w = weighIns(data && data['weigh-ins']);
    if (!w.length) return { eligible: false, count: 0, days: 0, note: 'No weigh-ins yet.' };
    var start = w[0].lb, now = w[w.length - 1].lb, days = daysBetween(w[0].date, w[w.length - 1].date);
    if (w.length < MIN_WEIGHINS || days < MIN_DAYS) {
      return { eligible: false, count: w.length, days: days, note: 'Joins after ' + MIN_DAYS + ' days and ' + MIN_WEIGHINS + ' weigh-ins.' };
    }
    var cap = days / 7 * CAP_PER_WEEK, s;
    if (goal === 'bulk') s = Math.min((now - start) / start * 100, cap);
    else if (goal === 'maintain') s = w.filter(function (r) { return Math.abs(r.lb - start) <= start * STEADY_BAND; }).length / w.length * 100;
    else s = Math.min((start - now) / start * 100, cap);
    return { eligible: true, score: Math.round(s * 10) / 10, count: w.length, days: days };
  }

  // rows: [{ slug, name, goal, data, sample, optIn }] -> { cut: [...], bulk: [...], maintain: [...] }, each ranked.
  function build(rows, mySlug) {
    var out = { cut: [], bulk: [], maintain: [] }, me = null;
    rows.forEach(function (r) {
      var goal = goalOf(r.goal);
      var sc = score(r.data, goal);
      var item = { slug: r.slug, name: shortName(r.name), goal: goal, sample: !!r.sample, isMe: r.slug === mySlug, optIn: !!r.optIn, eligible: sc.eligible, score: sc.score, note: sc.note };
      if (item.isMe) me = item;
      if (item.optIn && item.eligible) out[goal].push(item);
    });
    Object.keys(out).forEach(function (k) {
      out[k].sort(function (a, b) { return b.score - a.score || (a.name < b.name ? -1 : 1); });
      // Ties share a place (1, 2, 2, 4).
      out[k].forEach(function (it, i) { it.place = i && it.score === out[k][i - 1].score ? out[k][i - 1].place : i + 1; });
    });
    return { groups: out, me: me };
  }

  function fmt(x) { return (x > 0 ? '' : x < 0 ? '−' : '') + Math.abs(x).toFixed(1) + '%'; }
  function ordinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

  return { GOALS: GOALS, goalOf: goalOf, shortName: shortName, score: score, build: build, fmt: fmt, ordinal: ordinal,
    rules: { MIN_DAYS: MIN_DAYS, MIN_WEIGHINS: MIN_WEIGHINS, CAP_PER_WEEK: CAP_PER_WEEK, STEADY_BAND: STEADY_BAND } };
});
