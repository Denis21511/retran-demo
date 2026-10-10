'use strict';
/* =========================================================
   Цех — базовые утилиты: DOM, форматирование, даты, иконки
   ========================================================= */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const rub = n => (n == null ? '—' : nf.format(Math.round(n)) + ' ₽');
const num = n => nf.format(Math.round(n));

function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

/* ---------- даты ---------- */
const DAY = 864e5;
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WD_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

function today0() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function isoDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function parseIso(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addWorkDays(d, n) {
  const x = new Date(d); let k = 0;
  while (k < n) { x.setDate(x.getDate() + 1); const w = x.getDay(); if (w !== 0 && w !== 6) k++; }
  return x;
}
function daysBetween(a, b) { return Math.round((b - a) / DAY); }
function fmtDate(s) { if (!s) return '—'; const d = typeof s === 'string' ? parseIso(s) : new Date(s); return d.getDate() + ' ' + MONTHS_GEN[d.getMonth()]; }
function fmtDateShort(s) { const d = typeof s === 'string' ? parseIso(s) : new Date(s); return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()]; }
function fmtTime(ts) { const d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function fmtWhen(ts) {
  const d = new Date(ts), t = today0();
  const diff = daysBetween(new Date(d.getFullYear(), d.getMonth(), d.getDate()), t);
  if (diff === 0) return 'сегодня, ' + fmtTime(ts);
  if (diff === 1) return 'вчера, ' + fmtTime(ts);
  return fmtDateShort(ts) + ', ' + fmtTime(ts);
}
function fmtAgo(ts) {
  const m = Math.round((Date.now() - ts) / 6e4);
  if (m < 1) return 'только что';
  if (m < 60) return m + ' мин назад';
  const h = Math.round(m / 60);
  if (h < 24) return h + ' ч назад';
  return fmtWhen(ts);
}
/* срок относительно сегодняшнего дня */
function relDeadline(iso) {
  const n = daysBetween(today0(), parseIso(iso));
  if (n === 0) return 'сегодня';
  if (n === 1) return 'завтра';
  if (n > 1) return 'через ' + n + ' ' + plural(n, 'день', 'дня', 'дней');
  return 'просрочен на ' + (-n) + ' ' + plural(-n, 'день', 'дня', 'дней');
}

/* ---------- плавное изменение чисел (расчётная стоимость) ---------- */
function tweenNumber(el, to, fmt = rub) {
  if (!el) return;
  const from = el._val ?? to;
  el._val = to;
  if (REDUCED || from === to) { el.textContent = fmt(to); return; }
  cancelAnimationFrame(el._raf);
  clearTimeout(el._end);
  const t0 = performance.now(), dur = 420;
  el._end = setTimeout(() => { cancelAnimationFrame(el._raf); el.textContent = fmt(to); }, dur + 60); // если вкладка в фоне и кадры не идут
  el.classList.remove('is-ticking'); void el.offsetWidth; el.classList.add('is-ticking');
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (k < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

/* ---------- FLIP: плавное перемещение карточек между колонками ---------- */
function flip(root, selector, mutate) {
  const before = new Map();
  $$(selector, root).forEach(n => before.set(n.dataset.id, n.getBoundingClientRect()));
  mutate();
  if (REDUCED) return;
  $$(selector, root).forEach(n => {
    const a = before.get(n.dataset.id);
    const b = n.getBoundingClientRect();
    if (!a) { n.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' }); return; }
    const dx = a.left - b.left, dy = a.top - b.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    n.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.7,.2,1)' });
  });
}

/* ---------- иконки (24×24, линия 1.8) ---------- */
const ICONS = {
  home: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  box: '<path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5z"/><path d="M4 7.5 12 11l8-3.5M12 11v9"/>',
  chat: '<path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-4.5 3.5V17H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c1.2-3.6 4-5.2 7.5-5.2s6.3 1.6 7.5 5.2"/>',
  users: '<circle cx="9" cy="9" r="3.4"/><path d="M2.8 19.5c.9-3.1 3.3-4.6 6.2-4.6s5.3 1.5 6.2 4.6"/><path d="M15.5 5.8a3.3 3.3 0 0 1 0 6.4M17.6 14.9c1.8.6 3 1.9 3.6 4.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  bell: '<path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  right: '<path d="m9.5 6 6 6-6 6"/>',
  left: '<path d="m14.5 6-6 6 6 6"/>',
  down: '<path d="m6 9.5 6 6 6-6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  truck: '<path d="M3 6h11v10H3zM14 9.5h4l3 3.5v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
  repeat: '<path d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H19l-3-3M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H5l3 3"/>',
  phone: '<path d="M6.5 3.5h3l1.5 4-2 1.5a10 10 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><path d="m4 7 8 6 8-6"/>',
  clip: '<path d="m19.5 11.5-7.4 7.4a4.7 4.7 0 0 1-6.6-6.6l7.6-7.6a3.1 3.1 0 0 1 4.4 4.4l-7.5 7.5a1.6 1.6 0 0 1-2.2-2.2l6.9-6.9"/>',
  send: '<path d="M4 12 20 4l-5.5 16-3-6.5z"/><path d="m11.5 13.5 3.5-3.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="1.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  factory: '<path d="M3 20.5V10l5 3V10l5 3V5h4l1 4h3v11.5z"/><path d="M7 17h2M12 17h2M17 17h1"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2 1.2M17.8 15.3l2 1.2M4.2 16.5l2-1.2M17.8 8.7l2-1.2"/><circle cx="12" cy="12" r="7"/>',
  tag: '<path d="M3.5 12.3V4.5a1 1 0 0 1 1-1h7.8l8.2 8.2a1.5 1.5 0 0 1 0 2.1l-6.5 6.5a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8" cy="8" r="1.5"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="1.5"/><path d="M3 9.5h18M16 14h2"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  inbox: '<path d="M4 13.5 6.5 5h11l2.5 8.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 13.5h4.5l1 2h5l1-2H20"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  board: '<rect x="3.5" y="4" width="5" height="16" rx="1"/><rect x="9.5" y="4" width="5" height="10" rx="1"/><rect x="15.5" y="4" width="5" height="13" rx="1"/>',
  edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m14 8 3 3"/>',
  file: '<path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><circle cx="9" cy="9.5" r="1.8"/><path d="m4 18 5.5-5.5 4 4 2.5-2.5 4.5 4.5"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17v.5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  layers: '<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5"/>',
  logout: '<path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M10 8l-4 4 4 4M6 12h10"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  dots: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4.5h-4.5"/>',
  zap: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
  shield: '<path d="M12 3.5 19 6v6c0 4.3-2.9 7.4-7 8.5-4.1-1.1-7-4.2-7-8.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="1.5"/><path d="M15.5 8.5V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9.5a1 1 0 0 0 1 1h3.5"/>',
  drag: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  ruble: '<path d="M8 20V4h5.5a4 4 0 0 1 0 8H6M6 16h8"/>',
  cube: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
  /* категории изделий */
  c_metal: '<path d="M3 5h18M3 19h18M7 5v14M17 5v14M7 5l10 14"/>',
  c_laser: '<path d="M12 3v6"/><path d="M9 3h6"/><path d="M12 9l-1.5 3h3z" fill="currentColor"/><path d="M4 16h16v4H4zM12 12v4"/>',
  c_weld: '<path d="M4 20 14 10M12 8l4 4"/><path d="m16.5 3.5.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7zM19 12l.4 1.1 1.1.4-1.1.4-.4 1.1-.4-1.1-1.1-.4 1.1-.4z"/>',
  c_sign: '<rect x="3" y="5" width="18" height="10" rx="1"/><path d="M7 15v5M17 15v5M7 9h10M7 11.5h6"/>',
  c_furniture: '<rect x="4.5" y="3.5" width="15" height="15" rx="1"/><path d="M12 3.5v15M10 10v2M14 10v2M6 18.5v2M18 18.5v2"/>',
  c_glass: '<path d="M6 3h12v18H6z"/><path d="m9 8 3-3M9 13l6-6M13 15l2-2"/>',
  c_windows: '<rect x="4.5" y="3.5" width="15" height="17" rx="1"/><path d="M12 3.5v17M4.5 12h15"/>',
  c_other: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><circle cx="16.5" cy="7.5" r="3.5"/><path d="M4.5 20 7.5 14l3 6zM14 14h6v6h-6z"/>',
  /* доп. работы */
  x_cut: '<circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/><path d="M8.3 15.7 18 4M15.7 15.7 6 4"/>',
  x_drill: '<path d="M4 7h10v5H4zM14 8.5h3M17 7v4M8 12v3l1 1v4"/>',
  x_bend: '<path d="M4 18h7a5 5 0 0 0 5-5V5"/><path d="M13 8l3-3 3 3"/>',
  x_weld: '<path d="M12 3c2.5 3 4.5 5.4 4.5 8.5A4.5 4.5 0 0 1 12 16a4.5 4.5 0 0 1-4.5-4.5C7.5 9 9 7.5 9.5 5.5c1 1.5 2 2 2.5 2.2"/><path d="M5 20h14"/>',
  x_paint: '<rect x="4" y="3.5" width="14" height="6" rx="1"/><path d="M18 6.5h2v5h-8v3"/><rect x="10.5" y="14.5" width="3" height="6" rx="1"/>',
  x_engrave: '<path d="m14.5 4.5 5 5L9 20H4v-5z"/><path d="M4 20h16"/>',
  x_mount: '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3z"/><path d="m4 20 3-3"/>',
  x_delivery: '<path d="M3 6h11v10H3zM14 9.5h4l3 3.5v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
};
function icon(name, size = 20, cls = '') {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

/* ---------- имена ---------- */
function initials(name) { return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
function firstName(name) { return String(name || '').split(/\s+/)[0]; }

/* безопасная работа с хранилищем */
const LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } },
};
const SS = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) { } },
};
