/**
 * Tenn — Costing sync (Sheet → App)
 * ---------------------------------------------------------------------------
 * Paste this into the bound Apps Script of your Google Sheet
 *   (Extensions → Apps Script), fill in the four CONFIG values below, save,
 *   then reload the sheet. A "Tenn Sync" menu appears.
 *
 * It reads a flat tab named "Sync" (one row per costing) and pushes it to the
 * app, which makes its costing table match the sheet and re-links each row to
 * its Unit automatically.
 *
 * "Sync" tab — header row 1, any column order (matched by name):
 *   Category | Cash Sale | Unit / Customer | Selling | Costs | Sharing | Status | Notes | Date
 *   - Category: Mindhome/Reno, Smart Home, Smart Lock, Aluminium Cabinet, EE, Products
 *   - Costs:   "Material Costing:15232.58; Bank Charges:39; Salesman Comm (w/c/l/g):900"
 *   - Sharing: "Other Sharing:50; CZX & GES:10"   (name:percent of gross profit)
 *   - Status/Notes/Date optional. Linked units override Status in the app.
 * ---------------------------------------------------------------------------
 */

// ============================ CONFIG (fill these) ============================
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co'; // Supabase → Settings → API → Project URL
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';        // Supabase → Settings → API → the PUBLISHABLE / "anon public" key. NOT the secret / service_role key.
const SYNC_SECRET = 'your-long-random-secret';           // must match sync_config.costings_secret
const SYNC_TAB = 'Sync';                                 // the flat tab to read
const TRIGGER_TOKEN = 'set-a-trigger-token';             // only needed for the in-app "Sync sheet" button

// Where to read costings from:
//   'analysis' — read your category analysis tabs directly (fill ANALYSIS_TABS below)
//   'synctab'  — read the flat "Sync" tab instead
const SOURCE = 'analysis';

// >>> Put your actual tab names here (read them off the bottom of your sheet). <<<
// Leave a name blank ('') to skip that category.
const ANALYSIS_TABS = {
  reno:      'Mindhome',           // the Mind Home Analysis Report tab
  smarthome: 'Smart Home',
  smartlock: 'Smart Lock',
  alucab:    'Aluminium Cabinet',
  ee:        'EE',
  product:   'Products'
};
// ============================================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Tenn Sync')
    .addItem('Sync now', 'syncCostings')
    .addSeparator()
    .addItem('Enable hourly auto-sync', 'enableAutoSync')
    .addItem('Disable auto-sync', 'disableAutoSync')
    .addToUi();
}

// Map friendly category names to the app's keys.
function normCategory_(v) {
  const s = String(v || '').trim().toLowerCase();
  const map = {
    'mindhome': 'reno', 'mindhome / reno': 'reno', 'reno': 'reno', 'renovation': 'reno',
    'smart home': 'smarthome', 'smarthome': 'smarthome',
    'smart lock': 'smartlock', 'smartlock': 'smartlock',
    'aluminium cabinet': 'alucab', 'aluminium': 'alucab', 'alu cabinet': 'alucab', 'alucab': 'alucab',
    'ee': 'ee', 'electrical': 'ee',
    'product': 'product', 'products': 'product'
  };
  return map[s] || s;
}

function num_(v) {
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

// "label:amount; label2:amount2" (or newline-separated) → [[label, amount], ...]
function pairs_(v) {
  return String(v || '')
    .split(/[;\n]+/).map(s => s.trim()).filter(Boolean)
    .map(p => {
      const i = p.lastIndexOf(':');
      if (i < 0) return null;
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    })
    .filter(Boolean);
}

function fmtDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '').trim();
}

function buildRows_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SYNC_TAB);
  if (!sh) throw new Error('No tab named "' + SYNC_TAB + '". Create a flat "Sync" tab first.');
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];

  const hdr = data[0].map(h => String(h || '').trim().toLowerCase());
  const col = (...names) => {
    for (const n of names) { const i = hdr.indexOf(n); if (i >= 0) return i; }
    return -1;
  };
  const ci = {
    category: col('category'),
    cash: col('cash sale', 'cash sale no', 'cs no', 'cs'),
    customer: col('unit / customer', 'unit/customer', 'unit', 'customer', 'item'),
    selling: col('selling', 'selling price', 'sales'),
    costs: col('costs', 'costing'),
    sharing: col('sharing', 'p.sharing', 'share'),
    status: col('status'),
    notes: col('notes', 'remarks'),
    date: col('date')
  };

  const rows = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const cat = ci.category >= 0 ? normCategory_(row[ci.category]) : '';
    const cust = ci.customer >= 0 ? String(row[ci.customer] || '').trim() : '';
    if (!cat && !cust) continue; // skip blank rows

    rows.push({
      category: cat,
      cash_sale_no: ci.cash >= 0 ? String(row[ci.cash] || '').trim() : '',
      customer: cust,
      revenue: ci.selling >= 0 ? num_(row[ci.selling]) : 0,
      costs: ci.costs >= 0 ? pairs_(row[ci.costs]).map(([l, a]) => ({ label: l, amount: num_(a) })) : [],
      commissions: [],
      shares: ci.sharing >= 0 ? pairs_(row[ci.sharing]).map(([n, p]) => ({ name: n, percent: num_(p) })) : [],
      status: ci.status >= 0 ? String(row[ci.status] || '').trim() : '',
      notes: ci.notes >= 0 ? String(row[ci.notes] || '').trim() : '',
      costing_date: ci.date >= 0 && row[ci.date] ? fmtDate_(row[ci.date]) : ''
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Analysis-tab parser. Column indices below were read directly from your sheet
// (0-based). If you insert/delete a column in an analysis tab, update the
// matching numbers here. Cost columns are [columnIndex, "Label"].
// ---------------------------------------------------------------------------
const ANALYSIS = [
  { key: 'reno', tab: ANALYSIS_TABS.reno,
    unit: 1, item: 2, selling: 21, status: 25, cash: 26,
    costs: [[13,'Bank Installment Charges'],[14,'Bank Charges'],[15,'Comm Bal'],
            [16,'Salesman Comm (w/c/l/g)'],[17,'Salesman Comm (angel/sally)'],
            [18,'Salesman Comm (CZX/GES)'],[19,'Material Costing']],
    sharingCol: 24, sharing: 'Other Sharing:50; CZX & GES:10',
    supplierCols: [], notesCols: [29] },

  { key: 'smarthome', tab: ANALYSIS_TABS.smarthome,
    unit: 0, item: 1, selling: 7, status: 10, cash: 11,
    costs: [[2,'Bank Interest'],[3,'Material Costing'],[4,'Salesman Comm'],[5,'Overriding Comm']],
    sharingCol: 12, sharing: 'P.Sharing:50',
    supplierCols: [], notesCols: [15] },

  { key: 'smartlock', tab: ANALYSIS_TABS.smartlock,
    unit: 1, item: 2, selling: 9, status: 12, cash: 13,
    costs: [[3,'Bank Comm'],[4,'Device Costing'],[5,'Installation'],[6,'Lalamove'],[7,'Salesman Comm (3%)']],
    sharingCol: 14, sharing: 'P.Sharing:50',
    supplierCols: [], notesCols: [15,16] },

  { key: 'alucab', tab: ANALYSIS_TABS.alucab,
    unit: 1, item: 2, selling: 7, status: 10, cash: 11,
    costs: [[3,'Cabinet Costing'],[5,'Sink & Paip']],
    sharingCol: null, sharing: '',
    supplierCols: [4,6], notesCols: [12,13] },

  { key: 'ee', tab: ANALYSIS_TABS.ee, itemFallback: 'EE',
    unit: 0, item: 1, selling: 4, status: 7, cash: 8,
    costs: [[2,'Costing']],
    sharingCol: null, sharing: '',
    supplierCols: [3], notesCols: [9,10] },

  { key: 'product', tab: ANALYSIS_TABS.product, itemFallback: 'Products',
    unit: 1, item: 2, selling: 5, status: 8, cash: 9,
    costs: [[3,'Costing']],
    sharingCol: 10, sharing: 'Sharing:20',
    supplierCols: [4], notesCols: [11,12] }
];

// A cell looks like a unit code (e.g. "AG15-WAYNE", "A-03-02 -TSL", "A-08-33A").
function isUnitCode_(s) {
  if (!s) return false;
  if (/^(units?\b|total|nett|status|supplier|item|category)/i.test(s)) return false;
  return /^[A-Za-z]{1,4}[-\d]/.test(s) && /\d/.test(s) && s.length <= 28;
}

function buildRowsFromAnalysis_() {
  const ss = SpreadsheetApp.getActive();
  const out = [];
  ANALYSIS.forEach(function (c) {
    if (!c.tab) return;
    const sh = ss.getSheetByName(c.tab);
    if (!sh) return;
    sh.getDataRange().getValues().forEach(function (r) {
      const code = String(r[c.unit] == null ? '' : r[c.unit]).trim();
      const selling = num_(r[c.selling]);
      if (!isUnitCode_(code) || !(selling > 0)) return; // skip headers/totals/junk

      const item = String((c.item != null ? r[c.item] : '') || '').trim() || (c.itemFallback || '');
      const costs = [];
      (c.costs || []).forEach(function (cc) { const a = num_(r[cc[0]]); if (a > 0) costs.push({ label: cc[1], amount: a }); });

      const shares = [];
      if (c.sharing && (c.sharingCol == null || String(r[c.sharingCol] || '').trim() !== '')) {
        pairs_(c.sharing).forEach(function (p) { shares.push({ name: p[0], percent: num_(p[1]) }); });
      }

      const parts = [];
      (c.supplierCols || []).forEach(function (sc) { const v = String(r[sc] || '').trim(); if (v) parts.push('Supplier: ' + v); });
      (c.notesCols || []).forEach(function (nc) { const v = String(r[nc] || '').trim(); if (v) parts.push(v); });

      out.push({
        category: c.key,
        cash_sale_no: c.cash != null ? String(r[c.cash] || '').trim() : '',
        customer: item ? (code + ' — ' + item) : code,
        revenue: selling,
        costs: costs, commissions: [], shares: shares,
        status: c.status != null ? String(r[c.status] || '').trim() : '',
        notes: parts.join(' · ')
      });
    });
  });
  return out;
}

// Choose the data source.
function getRows_() {
  return SOURCE === 'analysis' ? buildRowsFromAnalysis_() : buildRows_();
}

// Read the chosen source and push it to Supabase; returns the imported count.
function pushRows_() {
  const rows = getRows_();
  if (!rows.length) throw new Error(SOURCE === 'analysis'
    ? 'No costing rows found — check the tab names in ANALYSIS_TABS.'
    : 'The "' + SYNC_TAB + '" tab has no data rows.');

  const res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/sync_costings', {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY },
    payload: JSON.stringify({ p_secret: SYNC_SECRET, p_rows: rows }),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code < 200 || code >= 300) throw new Error('Sync failed (' + code + '): ' + body);
  let n = rows.length;
  try { n = JSON.parse(body).imported || n; } catch (e) {}
  return n;
}

// Menu / scheduled-trigger entry point.
function syncCostings() {
  try {
    const n = pushRows_();
    toast_('Synced ' + n + ' costing rows to the app.');
  } catch (e) {
    toast_('Sync failed: ' + e.message);
    throw e;
  }
}

// ---- In-app "Sync sheet" button endpoint (needs Deploy → Web app) ----
// The app calls  <web-app-url>?token=<TRIGGER_TOKEN>  to run a sync and read
// back { ok, imported }.
function doGet(e) {
  return triggerSync_(e && e.parameter ? e.parameter.token : '');
}
function doPost(e) {
  let token = '';
  try { token = (e && e.parameter && e.parameter.token) || (e && e.postData ? e.postData.contents : ''); } catch (_) {}
  return triggerSync_(token);
}
function triggerSync_(token) {
  let out;
  try {
    if (!TRIGGER_TOKEN || token !== TRIGGER_TOKEN) out = { ok: false, error: 'unauthorized' };
    else out = { ok: true, imported: pushRows_() };
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function enableAutoSync() {
  disableAutoSync();
  ScriptApp.newTrigger('syncCostings').timeBased().everyHours(1).create();
  toast_('Hourly auto-sync enabled.');
}

function disableAutoSync() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'syncCostings') ScriptApp.deleteTrigger(t);
  });
}

function toast_(msg) {
  try { SpreadsheetApp.getActive().toast(msg, 'Tenn Sync', 6); } catch (e) { /* no UI in triggers */ }
}
