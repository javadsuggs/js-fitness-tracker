/**
 * Client Fitness Tracker: Google Sheet script.
 *
 * Paste this into the TEMPLATE sheet once (Extensions > Apps Script). Every copy of the template
 * carries it along. In each client's copy:
 *   1. Fill in the Settings tab.
 *   2. Menu "Tracker" > "Build logging form" (approve the permissions prompt the first time).
 *   3. Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone > Deploy.
 *      Copy the Web app URL. That URL is the client's data feed for the tracker page.
 */

// ---------- Form layout. Titles must stay unique: the feed reads answers by title. ----------
var Q = {
  date: 'Date',
  type: 'What are you logging?',
  weight: 'Body weight (lb)',
  meal: 'Meal',
  savedFood: 'Saved food (optional)',
  servings: 'Servings of saved food',
  food: 'What did you eat?',
  cal: 'Calories',
  pro: 'Protein (g)',
  carb: 'Carbs (g)',
  fat: 'Fat (g)',
  sodium: 'Sodium (mg)',
  focus: 'Muscle group',
  exercise: 'Exercise',
  lift: 'Weight lifted (lb)',
  sets: 'Sets',
  repsAssigned: 'Reps assigned',
  repsDone: 'Reps done',
  liftNotes: 'Workout notes',
  sleep: 'Sleep last night (hours)',
  water: 'Water (oz)',
  energy: 'Energy (1 to 5)',
  hunger: 'Hunger (1 to 5)',
  waist: 'Waist at navel (in)', hips: 'Hips (in)', chest: 'Chest (in)', shoulders: 'Shoulders (in)', neck: 'Neck (in)',
  armL: 'Left arm (in)', armR: 'Right arm (in)', thighL: 'Left thigh (in)', thighR: 'Right thigh (in)', calfL: 'Left calf (in)', calfR: 'Right calf (in)',
  tapeTime: 'Time measured (for example 8:30 PM)',
  ibWeight: 'Scan weight (lb)', ibMuscle: 'Skeletal muscle (lb)', ibFat: 'Body fat mass (lb)', ibPct: 'Body fat (%)', ibVisc: 'Visceral fat level',
  ibArmR: 'Right arm muscle (% of ideal)', ibArmL: 'Left arm muscle (% of ideal)', ibTrunk: 'Trunk muscle (% of ideal)', ibLegR: 'Right leg muscle (% of ideal)', ibLegL: 'Left leg muscle (% of ideal)',
  cardioMin: 'Cardio minutes', cardioWhat: 'Cardio type and notes', cardioIncline: 'Incline (%)', cardioSpeed: 'Speed (mph)', cardioCal: 'Calories burned (if your device shows it)',
  noteFrom: 'Note from', note: 'Note'
};
var TYPES = ['Weigh-in', 'Food', 'Workout', 'Sleep, water, energy', 'Measurements', 'InBody scan', 'Cardio', 'Trainer note'];
var MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Pre-workout', 'Post-workout'];
var FOCUS = ['Legs', 'Chest', 'Back', 'Arms', 'Shoulders', 'Core', 'Full body', 'Other'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Tracker')
    .addItem('Build logging form', 'buildForm')
    .addItem('Update saved foods in the form', 'refreshFoods')
    .addItem('Show my tracker links', 'showLinks')
    .addToUi();
}

// ---------- Settings ----------
function readSettings_() {
  var sh = SpreadsheetApp.getActive().getSheetByName('Settings');
  var out = {};
  if (!sh) return out;
  sh.getDataRange().getValues().forEach(function (r) {
    var k = String(r[0] || '').trim();
    if (k && k !== 'Setting') out[k] = r[1] instanceof Date ? fmtDate_(r[1]) : r[1];
  });
  return out;
}
function writeSetting_(key, value) {
  var sh = SpreadsheetApp.getActive().getSheetByName('Settings');
  var vals = sh.getDataRange().getValues();
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]).trim() === key) { sh.getRange(i + 1, 2).setValue(value); return; }
  sh.appendRow([key, value]);
}
function fmtDate_(d) {
  return Utilities.formatDate(d, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
}

// ---------- Build the Google Form ----------
function buildForm() {
  var ss = SpreadsheetApp.getActive();
  var s = readSettings_();
  if (s.form_id) {
    var ui = SpreadsheetApp.getUi();
    if (ui.alert('This sheet already has a form. Build a new one anyway?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  }
  var name = s.name || 'Client';
  var form = FormApp.create(name + ' - Fitness Log');
  form.setDescription('Log one thing at a time. Tap "Submit another response" after submitting to log the next item.')
    .setCollectEmail(false).setShowLinkToRespondAgain(true).setConfirmationMessage('Logged. Your tracker updates right away.');
  form.addDateItem().setTitle(Q.date).setRequired(true);
  var typeItem = form.addMultipleChoiceItem().setTitle(Q.type).setRequired(true);

  var pages = {};
  var section = function (title) { var p = form.addPageBreakItem().setTitle(title); pages[title] = p; return p; };
  var num = function (title, help) {
    var t = form.addTextItem().setTitle(title);
    if (help) t.setHelpText(help);
    t.setValidation(FormApp.createTextValidation().requireNumber().setHelpText('Numbers only').build());
    return t;
  };

  section('Weigh-in'); num(Q.weight).setRequired(true);
  section('Food');
  form.addListItem().setTitle(Q.meal).setChoiceValues(MEALS).setRequired(true);
  form.addListItem().setTitle(Q.savedFood).setChoiceValues(foodNames_().length ? foodNames_() : ['(none saved yet)'])
    .setHelpText('Pick a food from your saved list and the numbers fill in for you. Leave the boxes below empty.');
  num(Q.servings, 'Only for a saved food. Leave empty for 1.');
  form.addTextItem().setTitle(Q.food).setHelpText('Describe it if it is not a saved food.');
  num(Q.cal); num(Q.pro); num(Q.carb); num(Q.fat); num(Q.sodium, 'Optional');
  section('Workout');
  form.addListItem().setTitle(Q.focus).setChoiceValues(FOCUS).setRequired(true);
  form.addTextItem().setTitle(Q.exercise).setRequired(true);
  num(Q.lift, 'Leave empty for body weight'); num(Q.sets); num(Q.repsAssigned); num(Q.repsDone);
  form.addParagraphTextItem().setTitle(Q.liftNotes).setHelpText('How it felt, failed at rep 12, etc.');
  section('Sleep, water, energy');
  num(Q.sleep); num(Q.water, 'Add each bottle as you finish it, or the day total once.');
  form.addScaleItem().setTitle(Q.energy).setBounds(1, 5);
  form.addScaleItem().setTitle(Q.hunger).setBounds(1, 5);
  section('Measurements');
  form.addTextItem().setTitle(Q.tapeTime);
  [Q.waist, Q.hips, Q.chest, Q.shoulders, Q.neck, Q.armL, Q.armR, Q.thighL, Q.thighR, Q.calfL, Q.calfR].forEach(function (t) { num(t); });
  section('InBody scan');
  [Q.ibWeight, Q.ibMuscle, Q.ibFat, Q.ibPct, Q.ibVisc, Q.ibArmR, Q.ibArmL, Q.ibTrunk, Q.ibLegR, Q.ibLegL].forEach(function (t) { num(t); });
  section('Cardio');
  num(Q.cardioMin).setRequired(true); form.addTextItem().setTitle(Q.cardioWhat); num(Q.cardioIncline); num(Q.cardioSpeed); num(Q.cardioCal);
  section('Trainer note');
  form.addTextItem().setTitle(Q.noteFrom).setHelpText('Your name');
  form.addParagraphTextItem().setTitle(Q.note).setRequired(true);

  // Each type jumps to its own section, and every section ends by submitting.
  typeItem.setChoices(TYPES.map(function (t) { return typeItem.createChoice(t, pages[t]); }));
  TYPES.forEach(function (t, i) {
    var next = TYPES[i + 1];
    if (next) pages[next].setGoToPage(FormApp.PageNavigationType.SUBMIT);
  });
  // The last section ends at the end of the form, which submits on its own.

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  var url = form.getPublishedUrl();
  ss.getSheets().forEach(function (sh) {
    var fu = sh.getFormUrl && sh.getFormUrl();
    if (fu && fu.indexOf(form.getId()) !== -1) sh.setName('Responses');
  });
  writeSetting_('form_id', form.getId());
  writeSetting_('form_url', url);
  SpreadsheetApp.getUi().alert('Form ready:\n' + url + '\n\nNext: Deploy > New deployment > Web app (Execute as Me, Anyone) to get the data feed link.');
}

function foodNames_() {
  var sh = SpreadsheetApp.getActive().getSheetByName('Foods');
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]).trim(); }).filter(String);
}
function refreshFoods() {
  var s = readSettings_();
  if (!s.form_id) { SpreadsheetApp.getUi().alert('Build the form first.'); return; }
  var form = FormApp.openById(s.form_id);
  var item = form.getItems(FormApp.ItemType.LIST).filter(function (i) { return i.getTitle() === Q.savedFood; })[0];
  var names = foodNames_();
  item.asListItem().setChoiceValues(names.length ? names : ['(none saved yet)']);
  SpreadsheetApp.getUi().alert('Saved foods updated: ' + names.length + ' foods.');
}
function showLinks() {
  var s = readSettings_();
  var feed = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert('Logging form:\n' + (s.form_url || '(build the form first)') + '\n\nData feed:\n' + (feed || '(deploy as a web app first)'));
}

// ---------- Data feed for the tracker page ----------
function doGet() {
  var ss = SpreadsheetApp.getActive();
  var resp = ss.getSheetByName('Responses') || ss.getSheets().filter(function (sh) { return /^Form Responses/.test(sh.getName()) || (sh.getFormUrl && sh.getFormUrl()); })[0];
  var values = resp ? resp.getDataRange().getValues() : [[]];
  var foodsSh = ss.getSheetByName('Foods');
  var foods = foodsSh ? foodsSh.getDataRange().getValues() : [];
  var tz = ss.getSpreadsheetTimeZone();
  var tab = function (n) { var sh = ss.getSheetByName(n); return sh && sh.getLastRow() > 1 ? sh.getDataRange().getValues() : null; };
  var extra = { plan: tab('Plan'), meals: tab('Meal orders') };
  var feed = buildFeed(readSettings_(), values, foods, function (d) { return Utilities.formatDate(d, tz, 'yyyy-MM-dd'); }, extra);
  return ContentService.createTextOutput(JSON.stringify(feed)).setMimeType(ContentService.MimeType.JSON);
}

/** Pure function (no Google calls) so it can be tested anywhere. */
function buildFeed(settings, values, foodRows, fmt, extra) {
  extra = extra || {};
  var head = (values[0] || []).map(function (h) { return String(h).trim(); });
  var col = {};
  head.forEach(function (h, i) { col[h] = i; });
  var get = function (r, key) { var i = col[Q[key]]; return i == null ? '' : r[i]; };
  var num = function (v) { if (v === '' || v == null) return ''; var n = Number(String(v).replace(/,/g, '')); return isFinite(n) ? n : ''; };
  var dateOf = function (r) { var d = get(r, 'date'); if (d instanceof Date) return fmt(d); var s = String(d || ''); var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s); return m ? m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2) : s.slice(0, 10); };
  var foods = {};
  (foodRows || []).slice(1).forEach(function (f) { var n = String(f[0] || '').trim(); if (n) foods[n] = { cal: num(f[1]), pro: num(f[2]), carb: num(f[3]), fat: num(f[4]), na: num(f[5]) }; });

  var weigh = [], food = [], lift = [], habit = {}, tape = [], inbody = [], walks = [], notes = [];
  var mealCount = {};
  values.slice(1).forEach(function (r) {
    var date = dateOf(r), type = String(get(r, 'type') || '');
    if (!date) return;
    if (type === 'Weigh-in' && num(get(r, 'weight')) !== '') weigh.push({ date: date, weight_lb: num(get(r, 'weight')) });
    else if (type === 'Food') {
      var meal = String(get(r, 'meal') || 'Snack');
      var key = date + ' ' + meal; mealCount[key] = (mealCount[key] || 0) + 1;
      var saved = foods[String(get(r, 'savedFood') || '').trim()];
      var sv = num(get(r, 'servings')) || 1;
      var pick = function (k, fk) { var v = num(get(r, k)); return v !== '' ? v : (saved && saved[fk] !== '' ? Math.round(saved[fk] * sv * 10) / 10 : ''); };
      var item = String(get(r, 'food') || '').trim() || (saved ? (sv !== 1 ? sv + ' x ' : '') + String(get(r, 'savedFood')).trim() : 'Food');
      food.push({ entry: key + (mealCount[key] > 1 ? ' ' + mealCount[key] : ''), date: date, meal: meal, item: item,
        calories: pick('cal', 'cal') || 0, protein_g: pick('pro', 'pro') || 0, carbs_g: pick('carb', 'carb') || 0, fat_g: pick('fat', 'fat') || 0,
        sodium_mg: pick('sodium', 'na'), basis: saved && num(get(r, 'cal')) === '' ? 'Saved food' : 'Entered' });
    } else if (type === 'Workout') {
      lift.push({ date: date, exercise: String(get(r, 'exercise') || ''), sets: num(get(r, 'sets')), reps_assigned: num(get(r, 'repsAssigned')),
        reps_done: num(get(r, 'repsDone')), weight_lb: num(get(r, 'lift')), notes: String(get(r, 'liftNotes') || ''), focus: String(get(r, 'focus') || '') });
    } else if (type === 'Sleep, water, energy') {
      var h = habit[date] || (habit[date] = { date: date, sleep_hr: '', water_oz: '', energy: '', hunger: '' });
      if (num(get(r, 'sleep')) !== '') h.sleep_hr = num(get(r, 'sleep'));
      if (num(get(r, 'water')) !== '') h.water_oz = (Number(h.water_oz) || 0) + num(get(r, 'water'));
      if (num(get(r, 'energy')) !== '') h.energy = num(get(r, 'energy'));
      if (num(get(r, 'hunger')) !== '') h.hunger = num(get(r, 'hunger'));
    } else if (type === 'Measurements') {
      tape.push({ date: date, time: String(get(r, 'tapeTime') || ''), waist_in: num(get(r, 'waist')), hips_in: num(get(r, 'hips')), chest_in: num(get(r, 'chest')), shoulders_in: num(get(r, 'shoulders')),
        neck_in: num(get(r, 'neck')), arm_l_in: num(get(r, 'armL')), arm_r_in: num(get(r, 'armR')), thigh_l_in: num(get(r, 'thighL')), thigh_r_in: num(get(r, 'thighR')),
        calf_l_in: num(get(r, 'calfL')), calf_r_in: num(get(r, 'calfR')) });
    } else if (type === 'InBody scan') {
      inbody.push({ date: date, machine: 'InBody', time: '', weight_lb: num(get(r, 'ibWeight')), muscle_lb: num(get(r, 'ibMuscle')), fat_mass_lb: num(get(r, 'ibFat')),
        body_fat_pct: num(get(r, 'ibPct')), visceral_fat: num(get(r, 'ibVisc')), arm_r_pct: num(get(r, 'ibArmR')), arm_l_pct: num(get(r, 'ibArmL')), trunk_pct: num(get(r, 'ibTrunk')), leg_r_pct: num(get(r, 'ibLegR')), leg_l_pct: num(get(r, 'ibLegL')) });
    } else if (type === 'Cardio') {
      walks.push({ date: date, minutes: num(get(r, 'cardioMin')), incline_pct: num(get(r, 'cardioIncline')), speed_mph: num(get(r, 'cardioSpeed')), est_calories: num(get(r, 'cardioCal')), notes: String(get(r, 'cardioWhat') || '') });
    } else if (type === 'Trainer note') {
      notes.push({ date: date, source: String(get(r, 'noteFrom') || 'Trainer'), note: String(get(r, 'note') || '') });
    }
  });
  var byDate = function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; };
  [weigh, food, lift, tape, inbody, walks, notes].forEach(function (a) { a.sort(byDate); });
  var habits = Object.keys(habit).sort().map(function (k) { return habit[k]; });

  var csv = function (cols, rows) {
    var esc = function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return [cols.join(',')].concat(rows.map(function (r) { return cols.map(function (c) { return esc(r[c]); }).join(','); })).join('\n') + '\n';
  };
  var data = {
    'weigh-ins': csv(['date', 'weight_lb'], weigh),
    'food-log': csv(['entry', 'date', 'meal', 'item', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'sodium_mg', 'basis'], food),
    'strength': csv(['date', 'exercise', 'sets', 'reps_assigned', 'reps_done', 'weight_lb', 'notes', 'focus'], lift),
    'habits': csv(['date', 'sleep_hr', 'water_oz', 'energy', 'hunger'], habits),
    'tape': csv(['date', 'time', 'waist_in', 'hips_in', 'chest_in', 'shoulders_in', 'neck_in', 'arm_l_in', 'arm_r_in', 'thigh_l_in', 'thigh_r_in', 'calf_l_in', 'calf_r_in'], tape),
    'inbody': csv(['date', 'machine', 'time', 'weight_lb', 'muscle_lb', 'fat_mass_lb', 'body_fat_pct', 'visceral_fat', 'arm_r_pct', 'arm_l_pct', 'trunk_pct', 'leg_r_pct', 'leg_l_pct'], inbody),
    'walks': csv(['date', 'minutes', 'incline_pct', 'speed_mph', 'est_calories', 'notes'], walks),
    'trainer-notes': csv(['date', 'source', 'note'], notes),
    'photos': 'date,pose,src\n',
    'plan': tabCsv(extra.plan, ['order', 'slot', 'item', 'calories', 'protein_g', 'carbs_g', 'fat_g']),
    'meal-menu': tabCsv(extra.meals, ['week_start', 'meal', 'qty', 'flavor', 'protein', 'carb', 'veggie', 'calories', 'protein_g', 'carbs_g', 'fat_g'])
  };
  function tabCsv(vals, cols) {
    if (!vals || vals.length < 2) return cols.join(',') + '\n';
    var rows = vals.slice(1).filter(function (r) { return r.some(function (v) { return v !== '' && v != null; }); }).map(function (r, i) {
      var o = {}; cols.forEach(function (c, j) { var v = r[j]; o[c] = v instanceof Date ? fmt(v) : v; });
      if (cols[0] === 'order' && (o.order === '' || o.order == null)) o.order = i + 1;
      return o;
    });
    return csv(cols, rows);
  }
  var allDates = [].concat(weigh, food, lift, habits, tape, inbody, walks).map(function (x) { return x.date; }).sort();
  var w0 = weigh[0], w1 = weigh[weigh.length - 1];
  var publicSettings = {};
  ['name', 'trainer', 'goal_type', 'start_date', 'goal_weight_lb', 'calories', 'protein_g', 'sodium_mg', 'sleep_hr', 'min_loss_lb_per_week', 'visceral_goal', 'plan_start', 'form_url'].forEach(function (k) {
    if (settings[k] !== '' && settings[k] != null) publicSettings[k] = settings[k];
  });
  return {
    settings: publicSettings,
    data: data,
    summary: {
      latest_weight: w1 ? w1.weight_lb : null,
      change_lb: w0 && w1 ? Math.round((w1.weight_lb - w0.weight_lb) * 10) / 10 : null,
      last_log: allDates.length ? allDates[allDates.length - 1] : null
    }
  };
}

if (typeof module !== 'undefined') module.exports = { buildFeed: buildFeed, Q: Q };
