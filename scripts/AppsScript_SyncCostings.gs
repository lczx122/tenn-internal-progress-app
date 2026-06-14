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
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';        // Supabase → Settings → API → anon public key
const SYNC_SECRET = 'your-long-random-secret';           // must match sync_config.costings_secret
const SYNC_TAB = 'Sync';                                 // the flat tab to read
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

function syncCostings() {
  const rows = buildRows_();
  if (!rows.length) { toast_('Nothing to sync — the "Sync" tab has no data rows.'); return; }

  const res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/sync_costings', {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY },
    payload: JSON.stringify({ p_secret: SYNC_SECRET, p_rows: rows }),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code >= 200 && code < 300) {
    let n = rows.length;
    try { n = JSON.parse(body).imported || n; } catch (e) {}
    toast_('Synced ' + n + ' costing rows to the app.');
  } else {
    throw new Error('Sync failed (' + code + '): ' + body);
  }
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
