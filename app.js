import { ACTIVITIES } from './activities.js';
import * as store from './store.js';

const VERSION = '3';
const $view = document.getElementById('view');
const $tabs = document.getElementById('tabs');

// ---------- Datumshilfen (lokale Zeit, Woche beginnt Montag) ----------
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const mondayOf = (s) => { const d = parse(s); return addDays(s, -((d.getDay() + 6) % 7)); };
const todayIso = () => iso(new Date());
const fmtLong = (s) => parse(s).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = (s) => parse(s).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' });
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const state = { tab: 'day', day: todayIso(), weekStart: mondayOf(todayIso()) };
const act = (id) => ACTIVITIES.find((a) => a.id === id);
const isDone = (date, id) => !!store.get(date, id).done;
const fmtNum = (n, digits = 0) => n.toLocaleString('de-DE', { maximumFractionDigits: digits });

// ---------- Theme (auto | light | dark) ----------
const THEME_KEY = 'moveme-theme';
const getTheme = () => { try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch { return 'auto'; } };
function applyTheme(t) {
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme'); else root.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]').content = dark ? '#0a1210' : '#e9f5ee';
}
applyTheme(getTheme());
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(getTheme()));

// ---------- Streaks / Statistik ----------
function stats(a) {
  const days = [];
  for (const k of store.all().keys()) {
    const [d, id] = k.split('|');
    if (id === a.id && store.all().get(k).done) days.push(d);
  }
  days.sort();
  const set = new Set(days);
  let best = 0, run = 0, prev = null;
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  const today = todayIso();
  let cur = 0;
  let c = set.has(today) ? today : addDays(today, -1);
  while (set.has(c)) { cur++; c = addDays(c, -1); }
  const wk = mondayOf(today);
  const inRange = (from, to) => days.filter((d) => d >= from && d <= to);
  const week = inRange(wk, addDays(wk, 6));
  const monthStart = today.slice(0, 8) + '01';
  const month = inRange(monthStart, today);
  const sum = (arr) => arr.reduce((s, d) => s + (store.get(d, a.id).value || 0), 0);
  const km = (n) => n * (a.kmPerUnit || 0);
  return { cur, best, week: week.length, month: month.length, total: days.length,
    weekSum: sum(week), monthSum: sum(month), allSum: sum(days),
    kmTotal: km(days.length), kmMonth: km(month.length), minTotal: days.length * (a.minutes || 0) };
}

// ---------- Ansichten ----------
function dayView() {
  const today = todayIso();
  const isToday = state.day === today;
  const tiles = ACTIVITIES.map((a) => {
    const e = store.get(state.day, a.id);
    const style = `--c:${a.color};--c2:${a.c2}`;
    if (a.type === 'count') {
      return `<section class="tile ${e.done ? 'done' : ''}" style="${style}">
        <div class="t-head"><span class="t-icon">${a.icon}</span><span class="t-name">${a.name}</span></div>
        <div class="count">
          <button class="round" data-act="dec" data-id="${a.id}" aria-label="Weniger">−</button>
          <div class="num"><b>${e.value || 0}</b><small>${a.unit || ''}</small></div>
          <button class="round" data-act="inc" data-id="${a.id}" aria-label="Mehr">+</button>
        </div>
      </section>`;
    }
    return `<button class="tile ${e.done ? 'done' : ''}" style="${style}" data-act="toggle" data-id="${a.id}" aria-pressed="${!!e.done}">
      <div class="t-head"><span class="t-icon">${a.icon}</span><span class="t-name">${a.name}</span></div>
      <div class="check">${e.done ? '✓' : ''}</div>
    </button>`;
  }).join('');
  return `<header class="bar">
      <button class="nav" data-act="prev" aria-label="Vorheriger Tag">‹</button>
      <div class="title"><h1>${isToday ? 'Heute' : fmtShort(state.day)}</h1><p>${fmtLong(state.day)}</p></div>
      <button class="nav" data-act="next" aria-label="Nächster Tag" ${state.day >= today ? 'disabled' : ''}>›</button>
    </header>
    ${isToday ? '' : '<button class="chip" data-act="today">Zu heute</button>'}
    <div class="tiles">${tiles}</div>`;
}

function weekView() {
  const days = Array.from({ length: 7 }, (_, i) => addDays(state.weekStart, i));
  const today = todayIso();
  const head = `<div class="wk-days">${days.map((d, i) =>
    `<span class="${d === today ? 'now' : ''}">${WD[i]}<small>${parse(d).getDate()}</small></span>`).join('')}</div>`;
  const rows = ACTIVITIES.map((a) => {
    const n = days.filter((d) => isDone(d, a.id)).length;
    const cells = days.map((d) => {
      const e = store.get(d, a.id);
      const label = a.type === 'count' && e.value ? e.value : (e.done ? '✓' : '');
      return `<button class="cell ${e.done ? 'done' : ''} ${d > today ? 'future' : ''}" data-act="goto" data-date="${d}">${label}</button>`;
    }).join('');
    return `<section class="wk-row" style="--c:${a.color};--c2:${a.c2}">
      <div class="wk-title"><span>${a.icon} ${a.name}</span><b>${n}/7</b></div>
      <div class="wk-cells">${cells}</div>
    </section>`;
  }).join('');
  return `<header class="bar">
      <button class="nav" data-act="wprev" aria-label="Vorherige Woche">‹</button>
      <div class="title"><h1>Woche</h1><p>${fmtShort(days[0])} – ${fmtShort(days[6])}</p></div>
      <button class="nav" data-act="wnext" aria-label="Nächste Woche" ${state.weekStart >= mondayOf(today) ? 'disabled' : ''}>›</button>
    </header>${head}${rows}`;
}

function statsView() {
  const cards = ACTIVITIES.map((a) => {
    const s = stats(a);
    const extra = a.type === 'count'
      ? `<div class="kv"><span>Diese Woche</span><b>${s.weekSum}</b></div>
         <div class="kv"><span>Dieser Monat</span><b>${s.monthSum}</b></div>
         <div class="kv"><span>Gesamt</span><b>${s.allSum}</b></div>` : '';
    return `<section class="card" style="--c:${a.color};--c2:${a.c2}">
      <h2>${a.icon} ${a.name}</h2>
      <div class="big"><div><b>${s.cur}</b><span>Serie (Tage)</span></div><div><b>${s.best}</b><span>Beste Serie</span></div></div>
      <div class="kv"><span>Tage diese Woche</span><b>${s.week}</b></div>
      <div class="kv"><span>Tage dieser Monat</span><b>${s.month}</b></div>
      <div class="kv"><span>Tage gesamt</span><b>${s.total}</b></div>${a.kmPerUnit
        ? `<div class="kv"><span>Strecke dieser Monat (ca.)</span><b>${fmtNum(s.kmMonth, 1)} km</b></div>` : ''}${extra}
    </section>`;
  }).join('');
  const totals = ACTIVITIES.map((a) => {
    const s = stats(a);
    const main = a.type === 'count' ? s.allSum : s.total;
    const label = a.type === 'count' ? `${a.name} gesamt` : `${a.name}-Einheiten`;
    const sub = a.kmPerUnit
      ? `≈ ${fmtNum(s.kmTotal, 1)} km · ${fmtNum(s.minTotal)} Min`
      : (a.type === 'count' ? `an ${s.total} Tagen` : '');
    return `<div class="total" style="--c:${a.color};--c2:${a.c2}">
      <span class="tl">${a.icon} ${label}</span><b>${fmtNum(main)}</b><small>${sub}</small></div>`;
  }).join('');
  return `<header class="bar"><div class="title"><h1>Statistik</h1></div></header>
    <section class="totals">${totals}</section>${cards}
    <p class="hint center">Kilometer sind geschätzt: ${ACTIVITIES.filter((a) => a.kmPerUnit).map((a) => `${a.minutes} Min ≈ ${fmtNum(a.kmPerUnit, 1)} km`).join(', ')} pro Einheit (Anfängertempo ca. 8 Min/km).</p>`;
}

function settingsView() {
  const t = getTheme();
  const seg = (v, l) => `<button class="${t === v ? 'on' : ''}" data-act="theme" data-v="${v}">${l}</button>`;
  return `<header class="bar"><div class="title"><h1>Mehr</h1></div></header>
    <section class="card">
      <h2>Darstellung</h2>
      <div class="seg">${seg('auto', 'Auto')}${seg('light', 'Hell')}${seg('dark', 'Dunkel')}</div>
    </section>
    <section class="card">
      <h2>Datensicherung</h2>
      <p class="hint">Alle Daten liegen nur auf diesem Handy. Sichere sie regelmäßig als Datei.</p>
      <button class="btn" data-act="export">Daten exportieren</button>
      <button class="btn ghost" data-act="import">Daten importieren</button>
      <input type="file" id="file" accept="application/json,.json" hidden>
      <p class="hint" id="msg"></p>
    </section>
    <p class="hint center">MoveMe · Version ${VERSION}</p>`;
}

const views = { day: dayView, week: weekView, stats: statsView, settings: settingsView };

function render() {
  $view.innerHTML = views[state.tab]();
  for (const b of $tabs.children) b.classList.toggle('active', b.dataset.tab === state.tab);
  $view.scrollTop = 0;
}

// ---------- Aktionen ----------
const buzz = (ms = 15) => navigator.vibrate && navigator.vibrate(ms);

function changeCount(id, delta) {
  const a = act(id);
  const v = Math.max(0, (store.get(state.day, id).value || 0) + delta * (a.step || 1));
  store.set(state.day, id, { done: v > 0, value: v });
}

const actions = {
  toggle: (el) => { const id = el.dataset.id; store.set(state.day, id, { done: !isDone(state.day, id) }); buzz(); },
  inc: (el) => { changeCount(el.dataset.id, 1); buzz(); },
  dec: (el) => { changeCount(el.dataset.id, -1); buzz(); },
  prev: () => { state.day = addDays(state.day, -1); },
  next: () => { if (state.day < todayIso()) state.day = addDays(state.day, 1); },
  today: () => { state.day = todayIso(); },
  wprev: () => { state.weekStart = addDays(state.weekStart, -7); },
  wnext: () => { if (state.weekStart < mondayOf(todayIso())) state.weekStart = addDays(state.weekStart, 7); },
  goto: (el) => { if (el.dataset.date <= todayIso()) { state.day = el.dataset.date; state.tab = 'day'; } },
  theme: (el) => {
    try { localStorage.setItem(THEME_KEY, el.dataset.v); } catch { /* ignorieren */ }
    applyTheme(el.dataset.v);
  },
  export: () => {
    const blob = new Blob([store.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `moveme-${todayIso()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return 'keep';
  },
  import: () => { document.getElementById('file').click(); return 'keep'; },
};

$view.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn && fn(el) !== 'keep') render();
});

$view.addEventListener('change', async (e) => {
  if (e.target.id !== 'file' || !e.target.files[0]) return;
  const msg = document.getElementById('msg');
  try {
    await store.importJson(await e.target.files[0].text());
    msg.textContent = 'Import erfolgreich.';
  } catch (err) {
    msg.textContent = 'Import fehlgeschlagen: ' + err.message;
  }
});

$tabs.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  state.tab = b.dataset.tab;
  if (state.tab === 'week') state.weekStart = mondayOf(state.day);
  render();
});

// Wischen zwischen Tagen
let sx = 0, sy = 0;
$view.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
$view.addEventListener('touchend', (e) => {
  if (state.tab !== 'day') return;
  const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    actions[dx > 0 ? 'prev' : 'next']();
    render();
  }
}, { passive: true });

// Beim Zurückkehren in die App nach Mitternacht auf "heute" springen
let lastToday = todayIso();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const t = todayIso();
  if (t !== lastToday) {
    if (state.day === lastToday) state.day = t;
    state.weekStart = mondayOf(state.day);
    lastToday = t;
  }
  render();
});

(async () => {
  await store.init();
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
})();
