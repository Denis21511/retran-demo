'use strict';
/* =========================================================
   Каталог изделий, цены и калькулятор
   Все цены — в разделе «Услуги и цены», калькулятор берёт их оттуда.
   ========================================================= */

const DEFAULT_PRICES = {
  minOrder: 5000,
  urgentK: 1.2,
  round: 100,
  materials: {
    kitchen: { label: 'Кухни: фасады', tab: 'Кухни', unit: '₽ за м.п.', items: [
      { key: 'ldsp', label: 'ЛДСП', price: 9000 },
      { key: 'film', label: 'МДФ в плёнке ПВХ', price: 12000 },
      { key: 'plastic', label: 'МДФ пластик (глянец)', price: 13000 },
      { key: 'enamel', label: 'МДФ эмаль', price: 14500 },
      { key: 'pine', label: 'Массив сосны', price: 15000 },
      { key: 'oak', label: 'Массив дуба', price: 17000 },
    ] },
    kupe: { label: 'Шкафы-купе: фасад дверей', tab: 'Шкафы-купе', unit: '₽ за м² фасада', items: [
      { key: 'ldsp', label: 'ЛДСП', price: 4200 },
      { key: 'mirror', label: 'Зеркало', price: 5000 },
      { key: 'combo', label: 'ЛДСП + зеркало', price: 5400 },
      { key: 'glass', label: 'Стекло лакобель', price: 6200 },
      { key: 'mdf', label: 'МДФ фрезерованный', price: 6800 },
      { key: 'wood', label: 'Массив дерева', price: 9500 },
    ] },
    furniture: { label: 'Корпусная мебель', tab: 'Корпусная мебель', unit: '₽/м²', items: [
      { key: 'ldsp', label: 'ЛДСП', price: 1500 },
      { key: 'mdf', label: 'МДФ', price: 4200 },
      { key: 'pine', label: 'Массив сосны', price: 5200 },
      { key: 'oak', label: 'Массив дуба', price: 9800 },
    ] },
  },
  work: {
    furniture: { label: 'Раскрой, кромка и сборка мебели', price: 1800, unit: '₽/м² панелей' },
    corner: { label: 'Угловой модуль кухни', price: 6000, unit: '₽/шт' },
    top: { label: 'Столешница из искусственного камня', price: 7500, unit: '₽ за м.п.' },
    door: { label: 'Дополнительная дверь купе (сверх двух)', price: 2500, unit: '₽/шт' },
    drawer: { label: 'Выдвижной ящик с доводчиком', price: 2200, unit: '₽/шт' },
  },
  extras: {
    closer: { label: 'Доводчики', price: 1500, unit: '₽ за изделие' },
    mill: { label: 'Фрезеровка фасадов', price: 4000, unit: '₽ за изделие' },
    light: { label: 'LED-подсветка', price: 3500, unit: '₽ за изделие' },
    mount: { label: 'Сборка и установка', price: 10, unit: '% от стоимости', min: 2000 },
    delivery: { label: 'Доставка', price: 1500, unit: '₽ по Туле' },
  },
  days: { kitchen: 20, kupe: 14, furniture: 14, other: 10 },
};

const EXTRAS = [
  { key: 'closer', icon: 'x_drill', hint: 'плавное закрывание' },
  { key: 'mill', icon: 'x_engrave', hint: 'узор на фасадах' },
  { key: 'light', icon: 'zap', hint: 'подсветка внутри' },
  { key: 'mount', icon: 'x_mount', hint: 'сборка у вас дома' },
  { key: 'delivery', icon: 'x_delivery', hint: 'по Туле' },
];

const matOpts = g => P => P.materials[g].items.map(i => [i.key, i.label]);

const CATS = {
  kitchen: {
    label: 'Кухни', icon: 'c_furniture', hint: 'прямые, угловые, П-образные', view3d: true,
    fields: [
      { key: 'layout', label: 'Планировка', type: 'seg', def: 'corner', opts: () => [['line', 'Прямая'], ['corner', 'Угловая'], ['u', 'П-образная']] },
      { key: 'length', label: 'Длина вдоль стены', type: 'num', unit: 'мм', def: 3000, min: 1200, max: 8000, step: 100 },
      { key: 'length2', label: 'Длина боковой стороны', type: 'num', unit: 'мм', def: 1800, min: 900, max: 5000, step: 100, when: p => p.layout !== 'line' },
      { key: 'material', label: 'Фасады', type: 'select', def: 'film', opts: matOpts('kitchen') },
      { key: 'uppers', label: 'Верхние шкафы', type: 'seg', def: 'yes', opts: () => [['yes', 'Есть'], ['no', 'Только нижние']] },
      { key: 'top', label: 'Столешница', type: 'seg', def: 'post', opts: () => [['post', 'ЛДСП 38 мм'], ['stone', 'Искусственный камень']] },
    ],
  },
  kupe: {
    label: 'Шкафы-купе', icon: 'c_furniture', hint: 'корпусные и встроенные', view3d: true,
    fields: [
      { key: 'build', label: 'Исполнение', type: 'seg', def: 'box', opts: () => [['box', 'Корпусный'], ['niche', 'Встроенный в нишу']] },
      { key: 'width', label: 'Ширина', type: 'num', unit: 'мм', def: 1800, min: 900, max: 4500, step: 50 },
      { key: 'height', label: 'Высота', type: 'num', unit: 'мм', def: 2400, min: 1800, max: 2800, step: 50 },
      { key: 'depth', label: 'Глубина', type: 'num', unit: 'мм', def: 600, min: 400, max: 800, step: 50 },
      { key: 'doors', label: 'Двери', type: 'seg', def: 2, opts: () => [2, 3, 4].map(v => [v, v + ' двери']), numeric: true },
      { key: 'facade', label: 'Фасад дверей', type: 'select', def: 'combo', opts: matOpts('kupe') },
      { key: 'drawers', label: 'Ящики внутри', type: 'seg', def: 2, opts: () => [0, 2, 4].map(v => [v, v ? v + ' шт' : 'Без ящиков']), numeric: true },
      { key: 'qty', label: 'Количество', type: 'qty', def: 1 },
    ],
  },
  furniture: {
    label: 'Корпусная мебель', icon: 'c_furniture', hint: 'прихожие, шкафы, комоды, столы', view3d: true,
    fields: [
      { key: 'type', label: 'Изделие', type: 'select', def: 'hallway', opts: () => [['hallway', 'Прихожая'], ['cabinet', 'Шкаф распашной'], ['tumba', 'Комод'], ['rack', 'Стеллаж'], ['table', 'Стол']] },
      { key: 'width', label: 'Ширина', type: 'num', unit: 'мм', def: 1400, min: 300, max: 4000, step: 50 },
      { key: 'height', label: 'Высота', type: 'num', unit: 'мм', def: 2200, min: 300, max: 2800, step: 50 },
      { key: 'depth', label: 'Глубина', type: 'num', unit: 'мм', def: 450, min: 200, max: 1200, step: 50 },
      { key: 'material', label: 'Материал', type: 'select', def: 'ldsp', opts: matOpts('furniture') },
      { key: 'qty', label: 'Количество', type: 'qty', def: 1 },
    ],
  },
  other: {
    label: 'Другое', icon: 'c_other', hint: 'по описанию или эскизу', view3d: false,
    fields: [
      { key: 'descr', label: 'Что нужно изготовить', type: 'textarea', def: '', placeholder: 'Например: лестница из дуба на второй этаж, 14 ступеней' },
      { key: 'size', label: 'Примерные размеры', type: 'text', def: '', placeholder: '2400 × 600 × 2700 мм' },
      { key: 'qty', label: 'Количество', type: 'qty', def: 1 },
    ],
  },
};
const CAT_ORDER = ['kitchen', 'kupe', 'furniture', 'other'];

const TYPE_TITLES = {
  furniture: { cabinet: 'Шкаф распашной', hallway: 'Прихожая', rack: 'Стеллаж', tumba: 'Комод', table: 'Стол' },
  kitchen: { line: 'Кухня прямая', corner: 'Кухня угловая', u: 'Кухня П-образная' },
};

function defaultParams(cat) {
  const p = {};
  CATS[cat].fields.forEach(f => { p[f.key] = f.def; });
  return p;
}
function fieldVisible(f, p) { return !f.when || f.when(p); }
function optLabel(cat, key, val, P) {
  const f = CATS[cat].fields.find(x => x.key === key);
  if (!f || !f.opts) return val;
  const o = f.opts(P).find(o => String(o[0]) === String(val));
  return o ? o[1] : val;
}
function findMat(P, g, key) { const items = P.materials[g].items; return items.find(i => i.key === key) || items[0]; }

function productTitle(cat, p, P) {
  if (cat === 'kitchen') return TYPE_TITLES.kitchen[p.layout] || 'Кухня';
  if (cat === 'kupe') return p.build === 'niche' ? 'Встроенный шкаф-купе' : 'Шкаф-купе';
  if (TYPE_TITLES[cat]) return TYPE_TITLES[cat][p.type] || CATS[cat].label;
  if (cat === 'other') return (p.descr || 'Изделие по эскизу').split(/[,.\n]/)[0].slice(0, 48) || 'Изделие по эскизу';
  return CATS[cat].label;
}

/* погонные метры кухни */
function kitchenRun(p) {
  const a = p.length / 1000, b = (p.length2 || 0) / 1000;
  return p.layout === 'u' ? a + 2 * b : p.layout === 'corner' ? a + b : a;
}
const kitchenSize = p => p.layout === 'line' ? `${p.length} мм` : p.layout === 'u' ? `${p.length2} + ${p.length} + ${p.length2} мм` : `${p.length} + ${p.length2} мм`;

/* короткая строка параметров для карточек */
function specLine(cat, p, P) {
  const q = (p.qty || 1) + ' шт';
  switch (cat) {
    case 'kitchen': return `${findMat(P, 'kitchen', p.material).label} · ${kitchenSize(p)} · ${fmt1(kitchenRun(p))} м.п.`;
    case 'kupe': return `${findMat(P, 'kupe', p.facade).label} · ${p.width}×${p.height}×${p.depth} мм · ${p.doors} двери`;
    case 'furniture': return `${findMat(P, 'furniture', p.material).label} · ${p.width}×${p.height}×${p.depth} мм · ${q}`;
    default: return (p.size ? p.size + ' · ' : '') + q;
  }
}
/* основной материал — для карточек производства */
function materialLine(cat, p, P) {
  switch (cat) {
    case 'kitchen': return 'Фасады: ' + findMat(P, 'kitchen', p.material).label;
    case 'kupe': return 'Фасад: ' + findMat(P, 'kupe', p.facade).label;
    case 'furniture': return findMat(P, 'furniture', p.material).label;
    default: return 'по эскизу';
  }
}

/* ---------- геометрия для расчёта ---------- */
function furnitureArea(p) {
  const W = p.width / 1000, H = p.height / 1000, D = p.depth / 1000;
  switch (p.type) {
    case 'rack': return 2 * H * D + (Math.max(1, Math.floor(H / 0.4) - 1) + 2) * W * D;
    case 'tumba': return 2 * H * D + 2 * W * D + W * H * 1.3;
    case 'table': return W * D * 1.4;
    case 'hallway': return 2 * H * D + 2 * W * D + Math.max(1, Math.floor(H / 0.45) - 1) * W * D * .6 + W * H * .8;
    default: return 2 * H * D + 2 * W * D + Math.max(1, Math.floor(H / 0.45) - 1) * W * D + W * H * 1.3;
  }
}
const fmt1 = v => (Math.round(v * 10) / 10).toLocaleString('ru-RU');

function isIncluded(cat, x) { return false; }

/* ---------- главный расчёт ---------- */
function calcOrder(cat, p, extras, urgent, P) {
  const res = { lines: [], total: null, days: 0, manual: false };
  const qty = Math.max(1, +p.qty || 1);
  let material = 0, work = 0, matSub = '', workSub = '', workLabel = 'Обработка', surface = 0;
  const special = [];

  switch (cat) {
    case 'kitchen': {
      const m = findMat(P, 'kitchen', p.material);
      const run = kitchenRun(p), k = p.uppers === 'no' ? .65 : 1;
      const base = run * m.price * k;
      material = base * .55; matSub = `${m.label} · ${fmt1(run)} м.п.${p.uppers === 'no' ? ' · без верхних' : ''}`;
      work = base * .45; workLabel = 'Изготовление'; workSub = 'корпуса, фасады, фурнитура';
      const corners = p.layout === 'u' ? 2 : p.layout === 'corner' ? 1 : 0;
      if (corners) special.push({ key: 'corner', label: 'Угловые модули', sub: `${corners} шт с поворотной полкой`, sum: corners * P.work.corner.price });
      if (p.top === 'stone') special.push({ key: 'top', label: 'Столешница', sub: `искусственный камень · ${fmt1(run)} м.п.`, sum: run * P.work.top.price });
      surface = run;
      break;
    }
    case 'kupe': {
      const m = findMat(P, 'kupe', p.facade);
      const area = p.width * p.height / 1e6;
      const k = (p.build === 'niche' ? .85 : 1) * (.8 + .2 * p.depth / 600);
      const base = area * m.price * k * qty;
      material = base * .6; matSub = `${m.label} · ${fmt1(area * qty)} м² фасада`;
      work = base * .4; workLabel = 'Изготовление'; workSub = p.build === 'niche' ? 'полки, штанги, двери в нишу' : 'корпус, полки, штанги, двери';
      if (p.doors > 2) special.push({ key: 'door', label: 'Дополнительные двери', sub: `${p.doors - 2} шт · раздвижная система`, sum: (p.doors - 2) * P.work.door.price * qty });
      if (p.drawers) special.push({ key: 'drawer', label: 'Выдвижные ящики', sub: `${p.drawers} шт с доводчиками`, sum: p.drawers * P.work.drawer.price * qty });
      surface = area * qty;
      break;
    }
    case 'furniture': {
      const m = findMat(P, 'furniture', p.material);
      const area = furnitureArea(p);
      material = area * m.price * qty; matSub = `${m.label} · ${fmt1(area * qty)} м²`;
      work = area * P.work.furniture.price * qty; workSub = 'раскрой, кромка, сборка';
      surface = area * qty;
      break;
    }
    default: {
      res.manual = true;
      res.days = P.days.other;
      res.deadline = isoDate(addWorkDays(today0(), urgent ? Math.max(1, Math.ceil(res.days * .5)) : res.days));
      res.minOrder = P.minOrder;
      return res;
    }
  }

  const lines = [];
  lines.push({ key: 'material', label: 'Материал', sub: matSub, sum: material });
  lines.push({ key: 'work', label: workLabel, sub: workSub, sum: work });
  special.forEach(s => lines.push(s));

  // дополнительные работы
  let exSum = 0; const exNames = [];
  (extras || []).forEach(x => {
    if (x === 'mount' || x === 'delivery' || isIncluded(cat, x)) return;
    const e = P.extras[x]; if (!e) return;
    exSum += e.price * qty;
    exNames.push(e.label.toLowerCase());
  });
  if (exSum) lines.push({ key: 'extras', label: 'Дополнительные работы', sub: exNames.join(', '), sum: exSum });

  const base = lines.reduce((s, l) => s + l.sum, 0);
  if (extras?.includes('mount')) {
    const e = P.extras.mount;
    lines.push({ key: 'mount', label: 'Сборка и установка', sub: 'у клиента дома', sum: Math.max(e.min, base * e.price / 100) });
  }
  const beforeUrgent = lines.reduce((s, l) => s + l.sum, 0);
  if (urgent) lines.push({ key: 'urgent', label: 'Срочность', sub: `+${Math.round((P.urgentK - 1) * 100)}% · приоритет в очереди`, sum: beforeUrgent * (P.urgentK - 1) });
  if (extras?.includes('delivery')) lines.push({ key: 'delivery', label: 'Доставка', sub: 'по Туле', sum: P.extras.delivery.price });

  let raw = lines.reduce((s, l) => s + l.sum, 0);
  if (raw < P.minOrder) { lines.push({ key: 'min', label: 'До минимальной стоимости', sub: `минимальный заказ — ${rub(P.minOrder)}`, sum: P.minOrder - raw }); raw = P.minOrder; }

  // округляем итог, строки — до 10 ₽, разницу отдаём самой крупной строке
  const R = P.round || 100;
  const total = Math.max(R, Math.round(raw / R) * R);
  lines.forEach(l => { l.sum = Math.round(l.sum / 10) * 10; });
  const diff = total - lines.reduce((s, l) => s + l.sum, 0);
  if (diff) lines.reduce((a, b) => (b.sum > a.sum ? b : a)).sum += diff;

  res.lines = lines;
  res.total = total;

  // срок
  let days = P.days[cat] + Math.floor(Math.log2(qty));
  if (extras?.includes('mill')) days += 3;
  if (extras?.includes('mount')) days += 1;
  res.normalDays = days;
  res.urgentDays = Math.max(1, Math.ceil(days * .5));
  res.days = urgent ? res.urgentDays : days;
  res.deadline = isoDate(addWorkDays(today0(), res.days));
  return res;
}

/* ---------- производственный маршрут ---------- */
const STAGE_ORDER = ['prep', 'cut', 'process', 'weld', 'paint', 'mount'];
function routeFor(cat, extras) {
  const base = { kitchen: ['prep', 'cut', 'process', 'paint', 'weld'], kupe: ['prep', 'cut', 'process', 'weld'], furniture: ['prep', 'cut', 'process', 'weld'], other: ['prep', 'process'] }[cat] || ['prep', 'process'];
  const set = new Set(base);
  if ((extras || []).includes('mill')) set.add('paint');
  if ((extras || []).includes('mount')) set.add('mount');
  return STAGE_ORDER.filter(s => set.has(s));
}
