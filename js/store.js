'use strict';
/* =========================================================
   Данные сервиса: заказы, клиенты, сотрудники, уведомления.
   Хранятся в localStorage; вкладки синхронизируются между собой.
   ========================================================= */

const STATUSES = [
  { key: 'new', label: 'Заявка получена', short: 'Новая заявка', tone: 'blue' },
  { key: 'calc', label: 'Расчёт подготовлен', short: 'Ждёт согласования', tone: 'amber' },
  { key: 'confirmed', label: 'Заказ подтверждён', short: 'Ожидает запуска', tone: 'slate' },
  { key: 'production', label: 'В производстве', short: 'В производстве', tone: 'navy' },
  { key: 'qc', label: 'Контроль качества', short: 'Контроль', tone: 'violet' },
  { key: 'ready', label: 'Готово', short: 'Готов', tone: 'green' },
  { key: 'shipped', label: 'Отгружено', short: 'Отгружен', tone: 'gray' },
];
const ST = Object.fromEntries(STATUSES.map((s, i) => [s.key, { ...s, i }]));

/* MVP: путь заказа из четырёх шагов. Внутренние статусы сворачиваются в них:
   заявка (new, calc) → новый заказ (confirmed) → в работе (production, qc) → готово (ready, shipped) */
const PHASES = [
  { key: 'request', label: 'Заявка', client: 'Заявка отправлена', tone: 'blue', status: 'new' },
  { key: 'new', label: 'Новый', client: 'Заказ принят', tone: 'slate', status: 'confirmed' },
  { key: 'work', label: 'В работе', client: 'В работе', tone: 'navy', status: 'production' },
  { key: 'done', label: 'Готово', client: 'Готово', tone: 'green', status: 'ready' },
];
const PH = Object.fromEntries(PHASES.map((p, i) => [p.key, { ...p, i }]));
const PHASE_OF = { new: 'request', calc: 'request', confirmed: 'new', production: 'work', qc: 'work', ready: 'done', shipped: 'done' };
const phaseOf = o => PHASE_OF[o.status];
/* когда заказ стал готов (для выручки и колонки «Готово») */
const doneAt = o => o.times.ready || o.times.shipped || 0;
const STAGES = [
  { key: 'prep', label: 'Проект', short: 'Проект', worker: 'w1' },
  { key: 'cut', label: 'Раскрой', short: 'Раскрой', worker: 'w2' },
  { key: 'process', label: 'Кромка и присадка', short: 'Кромка', worker: 'w2' },
  { key: 'weld', label: 'Сборка', short: 'Сборка', worker: 'w3' },
  { key: 'paint', label: 'Фасады', short: 'Фасады', worker: 'w4' },
  { key: 'mount', label: 'Монтаж', short: 'Монтаж', worker: 'w5' },
];
const SG = Object.fromEntries(STAGES.map(s => [s.key, s]));

const NOTIF = {
  client: {
    sent: { title: 'Заявка отправлена', icon: 'send' },
    accepted: { title: 'Ваш заказ принят', icon: 'inbox' },
    calc: { title: 'Расчёт готов', icon: 'ruble' },
    production: { title: 'Заказ в работе', icon: 'factory' },
    ready: { title: 'Ваш заказ готов', icon: 'check' },
    shipped: { title: 'Заказ отгружен', icon: 'truck' },
    message: { title: 'Сообщение от менеджера', icon: 'chat' },
  },
  admin: {
    new: { title: 'Новая заявка', icon: 'inbox' },
    overdue: { title: 'Заказ просрочен', icon: 'alert' },
    slot: { title: 'Освободился производственный слот', icon: 'factory' },
    confirmed: { title: 'Клиент подтвердил заказ', icon: 'check' },
    message: { title: 'Сообщение от клиента', icon: 'chat' },
    delivery: { title: 'Клиент заказал доставку', icon: 'truck' },
  },
};

const STORE_KEY = 'retran.demo.v1';
const ME = 'c1'; // клиент, от лица которого открыт кабинет

/* ---------- генерация демо-данных ---------- */
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function workdaysBetween(a, b) { let n = 0; const x = new Date(a); x.setHours(0, 0, 0, 0); const e = new Date(b); e.setHours(0, 0, 0, 0); while (x < e) { x.setDate(x.getDate() + 1); const w = x.getDay(); if (w && w !== 6) n++; } return Math.max(1, n); }

function seedState() {
  const P = JSON.parse(JSON.stringify(DEFAULT_PRICES));
  const now = Date.now(), t0 = today0();
  const at = (daysAgo, hour = 10) => { const d = addDays(t0, -Math.floor(daysAgo)); d.setHours(hour, Math.floor((daysAgo % 1) * 60), 0, 0); return Math.min(d.getTime(), now - 6e4); };
  const ago = min => now - min * 6e4;

  const clients = [
    { id: 'c1', name: 'Ольга Смирнова', company: 'Частный клиент', phone: '+7 910 345-67-89', email: 'o.smirnova@mail.ru', manager: 's1', address: 'Тула, ул. Луначарского, 61, кв. 14' },
    { id: 'c2', name: 'Марина Соколова', company: 'Частный клиент', phone: '+7 920 118-40-21', email: 'sokolova.m@yandex.ru', manager: 's2' },
    { id: 'c3', name: 'Олег Захаров', company: 'Кафе «Тульский пряник»', phone: '+7 953 640-12-77', email: 'zakharov@pryanik-cafe.ru', manager: 's2' },
    { id: 'c4', name: 'Дмитрий Орлов', company: 'Частный клиент', phone: '+7 910 221-08-33', email: 'orlov.d@mail.ru', manager: 's1' },
    { id: 'c5', name: 'Елена Миронова', company: 'ООО «ТулаСтройИнвест»', phone: '+7 915 700-55-10', email: 'mironova@tsinvest.ru', manager: 's1' },
    { id: 'c6', name: 'Анна Крылова', company: 'Частный клиент', phone: '+7 962 402-19-90', email: 'krylova.a@gmail.com', manager: 's2' },
    { id: 'c7', name: 'Игорь Васильев', company: 'Частный клиент', phone: '+7 919 335-80-44', email: 'vasiliev.i@yandex.ru', manager: 's1' },
    { id: 'c8', name: 'Сергей Иванов', company: 'Частный клиент', phone: '+7 906 517-62-05', email: 'ivanov.s@yandex.ru', manager: 's2' },
    { id: 'c9', name: 'Константин Фролов', company: 'Офис «ФинКонсалт»', phone: '+7 910 860-24-71', email: 'frolov@finconsult71.ru', manager: 's1' },
    { id: 'c10', name: 'Татьяна Белых', company: 'Частный клиент', phone: '+7 920 093-41-16', email: 'belykh.t@mail.ru', manager: 's2' },
    { id: 'c11', name: 'Артём Никитин', company: 'Частный клиент', phone: '+7 951 274-33-08', email: 'nikitin.a@gmail.com', manager: 's2' },
    { id: 'c12', name: 'Роман Козлов', company: 'Частный клиент', phone: '+7 909 611-75-42', email: 'kozlov.r@gmail.com', manager: 's1' },
    { id: 'c13', name: 'Павел Шестаков', company: 'Салон «Форма»', phone: '+7 917 448-20-63', email: 'p.shestakov@forma71.ru', manager: 's2' },
  ];
  const staff = [
    { id: 's1', name: 'Ирина Белова', role: 'Дизайнер-конструктор', phone: '+7 910 000-11-01', kind: 'manager' },
    { id: 's2', name: 'Олег Смирнов', role: 'Менеджер по заказам', phone: '+7 910 000-11-02', kind: 'manager' },
    { id: 'w1', name: 'Андрей Ковалёв', role: 'Конструктор', phone: '+7 910 000-11-03', kind: 'worker', stages: ['prep'] },
    { id: 'w2', name: 'Виктор Савельев', role: 'Оператор ЧПУ', phone: '+7 910 000-11-04', kind: 'worker', stages: ['cut', 'process'] },
    { id: 'w3', name: 'Сергей Тимофеев', role: 'Сборщик', phone: '+7 910 000-11-05', kind: 'worker', stages: ['weld'] },
    { id: 'w4', name: 'Николай Гусев', role: 'Мастер по фасадам', phone: '+7 910 000-11-06', kind: 'worker', stages: ['paint'] },
    { id: 'w5', name: 'Павел Ершов', role: 'Монтажник', phone: '+7 910 000-11-07', kind: 'worker', stages: ['mount'] },
  ];

  const orders = [];
  const rnd = mulberry(1048);
  const pick = a => a[Math.floor(rnd() * a.length)];
  const step = (a, b, s) => a + Math.round(rnd() * (b - a) / s) * s;

  function mk(o) {
    const params = { ...defaultParams(o.cat), ...o.params };
    const extras = o.extras || [];
    const calc = calcOrder(o.cat, params, extras, !!o.urgent, P);
    const createdAt = o.createdAt;
    const deadline = isoDate(addDays(t0, o.deadlineOff));
    const ord = {
      id: o.id, clientId: o.client, cat: o.cat, title: o.title || productTitle(o.cat, params, P), params, extras, urgent: !!o.urgent,
      price: o.price || { lines: calc.lines, total: calc.total },
      days: workdaysBetween(createdAt, parseIso(deadline)),
      deadline, createdAt, managerId: o.manager || clients.find(c => c.id === o.client).manager,
      status: o.status, stage: o.stage || null, route: o.route || routeFor(o.cat, extras),
      history: [], messages: [], unread: { client: 0, admin: 0 }, payments: [], times: {}, flags: {},
      source: o.source || pick(['Онлайн-форма', 'Онлайн-форма', 'Телефон', 'WhatsApp']), comment: o.comment || '',
    };
    buildHistory(ord, clients, staff, o.end);
    // оплаты
    const tot = ord.price.total || 0, si = ST[ord.status].i;
    if (si >= ST.confirmed.i && o.pay !== 0) {
      const pre = o.pay === 1 ? tot : Math.round(tot * .5 / 100) * 100;
      if (pre) ord.payments.push({ t: ord.times.confirmed + 36e5, sum: pre });
      if (ord.status === 'shipped' && pre < tot) ord.payments.push({ t: doneAt(ord), sum: tot - pre });
    }
    orders.push(ord);
    return ord;
  }

  /* архив: сданные заказы прошлых месяцев */
  for (let id = 998; id <= 1030; id++) {
    const daysAgo = 122 - (id - 998) * 2.6;
    const createdAt = at(daysAgo, 9 + Math.floor(rnd() * 8));
    const cat = pick(['kitchen', 'kitchen', 'kupe', 'kupe', 'kupe', 'furniture', 'furniture']);
    let params = {}, extras = [];
    if (cat === 'kitchen') { params = { layout: pick(['line', 'corner', 'corner', 'u']), length: step(2200, 3800, 100), length2: step(1200, 2400, 100), material: pick(['ldsp', 'film', 'film', 'enamel', 'pine']), uppers: pick(['yes', 'yes', 'no']), top: pick(['post', 'post', 'stone']) }; extras = ['mount', 'delivery']; if (rnd() < .4) extras.push('closer'); }
    if (cat === 'kupe') { params = { build: pick(['box', 'niche']), width: step(1400, 3000, 50), height: step(2200, 2700, 50), depth: pick([450, 550, 600, 650]), doors: pick([2, 2, 3, 4]), facade: pick(['ldsp', 'mirror', 'combo', 'combo', 'glass']), drawers: pick([0, 2, 2, 4]), qty: 1 }; extras = ['mount', 'delivery']; }
    if (cat === 'furniture') { params = { type: pick(['hallway', 'cabinet', 'tumba', 'table', 'rack']), width: step(800, 2000, 50), height: step(750, 2400, 50), depth: step(400, 650, 50), material: pick(['ldsp', 'ldsp', 'mdf', 'pine', 'oak']), qty: 1 }; if (params.type === 'table') params.height = 750; extras = ['delivery']; }
    const client = pick(['c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c13', 'c5', 'c7']);
    mk({ id, client, cat, params, extras, status: 'shipped', createdAt, deadlineOff: -Math.round(daysAgo - (12 + rnd() * 9)) });
  }

  /* текущие заказы */
  const recent = [
    { id: 1031, client: 'c2', cat: 'kupe', params: { build: 'niche', width: 2200, height: 2600, depth: 600, doors: 3, facade: 'combo', drawers: 2 }, extras: ['mount', 'delivery'], status: 'shipped', d: 40, deadlineOff: -24 },
    { id: 1032, client: 'c5', cat: 'furniture', title: 'Шкафы для офиса продаж', params: { type: 'cabinet', width: 1600, height: 2000, depth: 450, material: 'ldsp', qty: 4 }, extras: ['mount', 'delivery'], status: 'shipped', d: 38, deadlineOff: -20 },
    { id: 1033, client: 'c7', cat: 'kitchen', params: { layout: 'corner', length: 3200, length2: 1900, material: 'enamel', uppers: 'yes', top: 'stone' }, extras: ['closer', 'mount', 'delivery'], status: 'shipped', d: 36, deadlineOff: -12 },
    { id: 1034, client: 'c13', cat: 'furniture', title: 'Стеллажи для салона', params: { type: 'rack', width: 900, height: 2000, depth: 400, material: 'oak', qty: 3 }, extras: ['delivery'], status: 'shipped', d: 30, deadlineOff: -14 },
    { id: 1035, client: 'c3', cat: 'furniture', title: 'Барная стойка и столы', params: { type: 'table', width: 1800, height: 750, depth: 800, material: 'pine', qty: 6 }, extras: ['delivery'], status: 'shipped', d: 28, deadlineOff: -10 },
    { id: 1036, client: 'c4', cat: 'kupe', params: { build: 'box', width: 1600, height: 2400, depth: 600, doors: 2, facade: 'mirror', drawers: 2 }, extras: ['mount', 'delivery'], status: 'shipped', d: 26, deadlineOff: -9 },
    { id: 1038, client: 'c4', cat: 'furniture', params: { type: 'tumba', width: 1200, height: 900, depth: 500, material: 'mdf' }, extras: ['closer', 'delivery'], status: 'ready', d: 20, deadlineOff: -1 },
    { id: 1039, client: 'c7', cat: 'kupe', title: 'Шкаф-купе в спальню', params: { build: 'box', width: 2400, height: 2500, depth: 650, doors: 3, facade: 'glass', drawers: 4 }, extras: ['light', 'mount', 'delivery'], status: 'production', stage: 'mount', d: 19, deadlineOff: 2 },
    { id: 1040, client: 'c5', cat: 'kitchen', title: 'Кухня в шоу-рум', params: { layout: 'line', length: 3600, material: 'plastic', uppers: 'yes', top: 'stone' }, extras: ['mount', 'delivery'], status: 'ready', d: 17, deadlineOff: 0, pay: 1 },
    { id: 1041, client: 'c6', cat: 'kitchen', params: { layout: 'u', length: 2800, length2: 2000, material: 'film', uppers: 'yes', top: 'post' }, extras: ['closer', 'mount', 'delivery'], status: 'production', stage: 'paint', d: 15, deadlineOff: 6 },
    { id: 1042, client: 'c9', cat: 'furniture', title: 'Офисные шкафы', params: { type: 'cabinet', width: 2000, height: 2200, depth: 450, material: 'ldsp', qty: 3 }, extras: ['mount', 'delivery'], status: 'production', stage: 'weld', d: 16, deadlineOff: -1 },
    { id: 1043, client: 'c8', cat: 'kupe', title: 'Шкаф-купе в прихожую', params: { build: 'niche', width: 1800, height: 2500, depth: 600, doors: 2, facade: 'combo', drawers: 0 }, extras: ['mount', 'delivery'], status: 'production', stage: 'cut', d: 9, deadlineOff: 8 },
    { id: 1044, client: 'c10', cat: 'furniture', params: { type: 'hallway', width: 1400, height: 2200, depth: 450, material: 'ldsp' }, extras: ['mount', 'delivery'], status: 'production', stage: 'process', d: 7, deadlineOff: 5 },
    { id: 1045, client: 'c11', cat: 'kitchen', params: { layout: 'corner', length: 2600, length2: 1600, material: 'ldsp', uppers: 'yes', top: 'post' }, extras: ['mount', 'delivery'], status: 'confirmed', d: 5, deadlineOff: 18, pay: 0 },
  ];
  recent.forEach(o => mk({ ...o, createdAt: at(o.d, 9 + (o.id % 7)) }));

  mk({ id: 1046, client: 'c2', cat: 'furniture', title: 'Комод в детскую', params: { type: 'tumba', width: 1000, height: 900, depth: 450, material: 'pine', qty: 1 }, extras: ['closer'], status: 'ready', createdAt: at(4, 10), deadlineOff: 0, source: 'WhatsApp' });
  mk({ id: 1047, client: 'c9', cat: 'furniture', title: 'Стол переговорный', params: { type: 'table', width: 2400, height: 750, depth: 1000, material: 'oak', qty: 1 }, extras: ['delivery'], status: 'shipped', createdAt: at(24, 15), deadlineOff: -3, source: 'Телефон', pay: 1 });
  mk({ id: 1051, client: 'c1', cat: 'kupe', title: 'Шкаф-купе 2400 в спальню', params: { build: 'box', width: 2400, height: 2400, depth: 600, doors: 3, facade: 'combo', drawers: 2, qty: 1 }, extras: ['mount', 'delivery'], status: 'new', createdAt: ago(42), deadlineOff: 14, source: 'Онлайн-расчёт', comment: 'Нужен в спальню, стена 2450 мм. Можно приехать на замер в субботу?' });
  mk({ id: 1050, client: 'c12', cat: 'kitchen', title: 'Кухня угловая 3,0 + 1,8', params: { layout: 'corner', length: 3000, length2: 1800, material: 'film', uppers: 'yes', top: 'stone' }, extras: ['closer', 'mount', 'delivery'], status: 'new', createdAt: ago(185), deadlineOff: 20, source: 'Онлайн-расчёт', comment: 'Цвет фасадов — светлый дуб. Газовая плита, мойка у окна.' });
  // заказ из примера на главной: угловая кухня
  const o1048 = mk({
    id: 1048, client: 'c1', cat: 'kitchen', title: 'Кухня угловая', params: { layout: 'corner', length: 3000, length2: 1800, material: 'film', uppers: 'yes', top: 'post' }, extras: ['mount', 'delivery'],
    status: 'production', stage: 'weld', createdAt: at(12, 11), deadlineOff: 9, source: 'Онлайн-расчёт',
  });
  mk({ id: 1049, client: 'c13', cat: 'kupe', title: 'Шкаф-купе в салон', params: { build: 'box', width: 2000, height: 2400, depth: 500, doors: 2, facade: 'mirror', drawers: 0, qty: 1 }, extras: ['delivery'], status: 'confirmed', createdAt: at(2, 15), deadlineOff: 12, source: 'Телефон' });
  mk({ id: 1052, client: 'c6', cat: 'furniture', title: 'Прихожая 1600', params: { type: 'hallway', width: 1600, height: 2300, depth: 400, material: 'ldsp', qty: 1 }, extras: ['mount'], status: 'new', createdAt: ago(18), deadlineOff: 14, source: 'Онлайн-расчёт' });

  /* переписка */
  const by = id => orders.find(o => o.id === id);
  const msg = (o, from, text, t, extra = {}) => o.messages.push({ id: 'm' + Math.round(t) + Math.floor(rnd() * 1e4), from, text, t, ...extra });
  msg(o1048, 'client', 'Добрый день! Можно ручки поменять на чёрные?', at(1, 10));
  msg(o1048, 'manager', 'Ольга, добрый день. Да, поставим чёрные, цена не изменится. Кухня сейчас на сборке.', at(1, 10) + 9e5);
  msg(o1048, 'client', 'Отлично, спасибо! Когда сможете привезти?', at(1, 11));
  msg(o1048, 'manager', 'Монтажники приедут в срок, накануне позвоним и согласуем время.', at(1, 11) + 6e5);
  const o1042 = by(1042);
  msg(o1042, 'client', 'Добрый день. Шкафы успеете к понедельнику? Переезжаем в новый офис.', ago(70));
  o1042.unread.admin = 1;
  const o1050 = by(1050);
  msg(o1050, 'client', 'Цвет фасадов — светлый дуб. Газовая плита, мойка у окна.', o1050.createdAt);
  o1050.unread.admin = 1;
  const o1041 = by(1041);
  msg(o1041, 'client', 'А посудомойку встраиваете сами?', at(2, 16));
  msg(o1041, 'manager', 'Да, встроим при монтаже кухни, отдельно это не оплачивается.', at(2, 16) + 12e5);
  by(1042).flags.overdueNotified = true;

  /* уведомления */
  const notifs = [];
  const nt = (side, type, orderId, text, t, read = false, clientId) => notifs.push({ id: 'n' + notifs.length + '_' + t, side, type, orderId, text, t, read, clientId });
  nt('admin', 'new', 1052, 'Анна Крылова · Прихожая 1600', ago(18));
  nt('admin', 'new', 1051, 'Ольга Смирнова · Шкаф-купе 2400 в спальню', ago(42));
  nt('admin', 'overdue', 1042, 'Офис «ФинКонсалт» · Офисные шкафы · срок был ' + fmtDate(by(1042).deadline), ago(150));
  nt('admin', 'new', 1050, 'Роман Козлов · Кухня угловая 3,0 + 1,8', ago(185), true);
  nt('client', 'sent', 1051, 'Заявка №1051 отправлена, менеджер проверит расчёт', ago(42), true, 'c1');
  nt('client', 'production', 1048, 'Кухня угловая — заказ в работе', o1048.times.production, true, 'c1');

  // дата регистрации клиента — дата первого заказа
  clients.forEach(c => { const f = orders.filter(o => o.clientId === c.id).sort((a, b) => a.createdAt - b.createdAt)[0]; c.createdAt = f ? f.createdAt - 864e5 : now; });

  return {
    v: 5, seededOn: isoDate(t0),
    prices: P, clients, staff, orders, notifs,
    settings: {
      company: 'ООО «Ретран»', phone: '+7 (4872) 47-22-33', address: 'Тула, ул. Октябрьская, 48', hours: 'Пн–Пт 9:00–18:00',
      capacity: 10,
      notify: { admin: { new: true, overdue: true, slot: true, confirmed: true }, client: { accepted: true, calc: true, production: true, ready: true } },
    },
    owner: { name: 'Алексей Николаевич', role: 'Директор' },
  };
}

/* история изменений по статусу заказа */
function buildHistory(o, clients, staff, endTs) {
  const client = clients.find(c => c.id === o.clientId);
  const mgr = staff.find(s => s.id === o.managerId);
  const ev = [];
  const si = PH[phaseOf(o)].i;
  ev.push(['new', `Заявка получена (${o.source.toLowerCase()}) · ${rub(o.price.total)}`, client.name]);
  if (si >= 1) ev.push(['confirmed', 'Заявка принята — создан заказ', mgr.name]);
  if (si >= 2) ev.push(['production', 'Статус: В работе', 'Производство']);
  if (si >= 3) ev.push(['ready', 'Статус: Готово', 'Производство']);
  const start = o.createdAt;
  let end = endTs || (si >= 3 ?Math.min(parseIso(o.deadline).getTime() + 15 * 36e5, Date.now() - 36e5) : Date.now() - 50 * 6e4);
  if (end <= start) end = start + 6e4 * ev.length;
  const n = ev.length;
  const work = t => { // события — в рабочее время цеха
    const d = new Date(t), h = d.getHours();
    if (h < 8) d.setHours(8 + h % 3); else if (h >= 19) d.setHours(16 + h % 3);
    return d.getTime() <= Date.now() ? d.getTime() : t;
  };
  const ts = ev.map((_, i) => work(n === 1 ? start : Math.round(start + (end - start) * (i === 0 ? 0 : Math.pow(i / (n - 1), .9))))).sort((a, b) => a - b);
  ev.forEach(([key, text, who], i) => {
    const t = ts[i];
    o.history.push({ t, text, who });
    if (key) o.times[key] = t;
  });
}

/* сдвиг дат, чтобы демо всегда выглядело «сегодняшним» */
function shiftState(s, days) {
  const ms = days * DAY;
  const sh = iso => isoDate(addDays(parseIso(iso), days));
  s.orders.forEach(o => {
    o.createdAt += ms; o.deadline = sh(o.deadline);
    o.history.forEach(h => h.t += ms); o.messages.forEach(m => m.t += ms); o.payments.forEach(p => p.t += ms);
    Object.keys(o.times).forEach(k => o.times[k] += ms);
    if (o.delivery?.date) o.delivery.date = sh(o.delivery.date);
  });
  s.notifs.forEach(n => n.t += ms);
  s.clients.forEach(c => c.createdAt += ms);
}

/* ---------- хранилище ---------- */
const Store = {
  s: null,
  subs: new Set(),
  load() {
    let s = null;
    try { s = JSON.parse(LS.get(STORE_KEY)); } catch (e) { s = null; }
    if (!s || s.v !== 5) s = seedState();
    const d = daysBetween(parseIso(s.seededOn), today0());
    if (d) { shiftState(s, d); s.seededOn = isoDate(today0()); }
    this.s = s;
    this.checkOverdue(true);
    this.save();
  },
  save() { LS.set(STORE_KEY, JSON.stringify(this.s)); },
  reset() { LS.del(STORE_KEY); this.s = seedState(); this.save(); this.emit({ type: 'reset' }); },
  on(fn) { this.subs.add(fn); return () => this.subs.delete(fn); },
  emit(e) { this.subs.forEach(fn => { try { fn(e); } catch (err) { console.error(err); } }); },
  commit(e = { type: 'change' }) { this.save(); this.emit(e); },

  /* выборки */
  get P() { return this.s.prices; },
  order(id) { return this.s.orders.find(o => o.id === +id); },
  client(id) { return this.s.clients.find(c => c.id === id); },
  person(id) { return this.s.staff.find(s => s.id === id); },
  me() { return this.client(ME); },
  ordersOf(cid) { return this.s.orders.filter(o => o.clientId === cid).sort((a, b) => b.id - a.id); },
  isOverdue(o) { return !['ready', 'shipped'].includes(o.status) && parseIso(o.deadline) < today0(); },
  paid(o) { return o.payments.reduce((s, p) => s + p.sum, 0); },
  workerOf(o) { return o.status === 'production' && o.stage ? this.person(SG[o.stage].worker) : o.status === 'qc' ? this.person('w1') : null; },
  /* выручка MVP: стоимость заказов, которые стали готовы за период */
  earned(from, to = Date.now() + DAY) { return this.s.orders.reduce((s, o) => { const t = doneAt(o); return s + (phaseOf(o) === 'done' && t >= from && t < to ? o.price.total || 0 : 0); }, 0); },
  revenue(from, to = Date.now() + DAY) { let s = 0; this.s.orders.forEach(o => o.payments.forEach(p => { if (p.t >= from && p.t < to) s += p.sum; })); return s; },
  nextId() { return Math.max(...this.s.orders.map(o => o.id)) + 1; },
  notifs(side) { return this.s.notifs.filter(n => n.side === side && (side === 'admin' || n.clientId === ME)).sort((a, b) => b.t - a.t); },

  /* действия */
  log(o, text, who) { o.history.push({ t: Date.now(), text, who: who || this.s.owner.name }); },
  notify(side, type, o, text) {
    const set = this.s.settings.notify[side];
    if (set && set[type] === false) return;
    const n = { id: 'n' + Date.now() + Math.random().toString(36).slice(2, 6), side, type, orderId: o?.id, text, t: Date.now(), read: false, clientId: o?.clientId };
    this.s.notifs.push(n);
    this._fresh.push(n);
  },
  _fresh: [],
  flushFresh() { const f = this._fresh; this._fresh = []; return f; },
  readNotifs(side) { this.s.notifs.forEach(n => { if (n.side === side) n.read = true; }); this.commit(); },

  createOrder(d, by = 'client') {
    const P = this.P;
    const c = calcOrder(d.cat, d.params, d.extras, d.urgent, P);
    let clientId = d.clientId || ME;
    if (by === 'client') { const me = this.me(); Object.assign(me, { name: d.contact.name || me.name, phone: d.contact.phone || me.phone, email: d.contact.email || me.email }); }
    if (d.newClient) {
      clientId = 'c' + (this.s.clients.length + 1) + Date.now().toString(36).slice(-3);
      this.s.clients.push({ id: clientId, name: d.newClient.name, company: d.newClient.company || 'Частный клиент', phone: d.newClient.phone, email: d.newClient.email || '', manager: 's1', createdAt: Date.now() });
    }
    const client = this.client(clientId);
    const now = Date.now();
    const o = {
      id: this.nextId(), clientId, cat: d.cat, title: productTitle(d.cat, d.params, P), params: { ...d.params }, extras: [...d.extras], urgent: !!d.urgent,
      price: c.manual ? { lines: [], total: null } : { lines: c.lines, total: c.total },
      days: c.days, deadline: c.deadline, createdAt: now, managerId: client.manager || 's1',
      status: by === 'admin' ? 'confirmed' : 'new', stage: null, route: routeFor(d.cat, d.extras),
      history: [], messages: [], unread: { client: 0, admin: 0 }, payments: [], times: { new: now }, flags: {},
      source: by === 'admin' ? 'Менеджер' : 'Онлайн-форма', comment: d.comment || '',
    };
    if (by === 'admin') o.times.confirmed = now;
    o.history.push({ t: now, text: by === 'admin' ? 'Заказ создан менеджером' + (o.price.total ? ' · ' + rub(o.price.total) : '') : 'Заявка получена (онлайн-форма)' + (o.price.total ? ' · ' + rub(o.price.total) : ''), who: by === 'admin' ? this.s.owner.name : client.name });
    if (d.comment) o.messages.push({ id: 'm' + now, from: by === 'admin' ? 'manager' : 'client', text: d.comment, t: now });
    (d.files || []).forEach((f, i) => o.messages.push({ id: 'm' + now + 'f' + i, from: by === 'admin' ? 'manager' : 'client', text: '', file: f, t: now + i + 1 }));
    this.s.orders.push(o);
    if (by === 'client') {
      if (o.messages.length) o.unread.admin = o.messages.length;
      this.notify('admin', 'new', o, `${client.company !== 'Частный клиент' ? client.company : client.name} · ${o.title}${o.price.total ? ' · ' + rub(o.price.total) : ''}`);
      this.notify('client', 'sent', o, `Заявка №${o.id} отправлена, менеджер проверит расчёт`);
    }
    this.commit({ type: 'order:new', id: o.id });
    return o;
  },

  setStatus(id, status, who = 'admin') {
    const o = this.order(id); if (!o || o.status === status) return;
    const prev = o.status, now = Date.now();
    const client = this.client(o.clientId);
    const actor = who === 'client' ? client.name : this.s.owner.name;
    o.status = status; o.times[status] = now;
    // сбрасываем отметки времени для «будущих» статусов при откате назад
    STATUSES.forEach(s => { if (s.i > ST[status].i) delete o.times[s.key]; });
    switch (status) {
      case 'new': this.log(o, 'Возвращён в заявки', actor); break;
      case 'calc':
        this.log(o, 'Расчёт подготовлен: ' + rub(o.price.total), actor);
        o.messages.push({ id: 'm' + now, from: 'system', text: 'Расчёт подготовлен: ' + rub(o.price.total) + '. Срок — ' + o.days + ' ' + plural(o.days, 'рабочий день', 'рабочих дня', 'рабочих дней') + '. Подтвердите заказ, чтобы мы запустили производство.', t: now });
        o.unread.client++;
        this.notify('client', 'calc', o, `${o.title} — ${rub(o.price.total)}`);
        break;
      case 'confirmed':
        o.stage = null;
        if (PHASE_OF[prev] === 'request') {
          this.log(o, 'Заявка принята — создан заказ', actor);
          this.notify('client', 'accepted', o, `${o.title} — ${rub(o.price.total)}, готовность ${fmtDate(o.deadline)}`);
        } else this.log(o, 'Статус: Новый', actor);
        break;
      case 'production':
        if (!o.stage || !o.route.includes(o.stage)) o.stage = o.route[0];
        this.log(o, 'Статус: В работе', actor);
        this.notify('client', 'production', o, `${o.title} — изготавливаем, готовность ${fmtDate(o.deadline)}`);
        break;
      case 'qc': o.stage = null; this.log(o, 'Передан на контроль качества', actor); break;
      case 'ready':
        o.stage = null;
        this.log(o, 'Статус: Готово', actor);
        this.notify('client', 'ready', o, `${o.title} — можно забирать`);
        break;
      case 'shipped':
        this.log(o, 'Заказ отгружен клиенту', actor);
        o.messages.push({ id: 'm' + now, from: 'system', text: 'Заказ отгружен. Спасибо, что работаете с нами!', t: now });
        break;
    }
    this.commit({ type: 'order:status', id: o.id, status });
  },

  freeSlot(o) {
    const waiting = this.s.orders.filter(x => x.status === 'confirmed').sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
    this.notify('admin', 'slot', o, `Заказ №${o.id} вышел из производства.` + (waiting ? ` Можно запускать №${waiting.id} (${waiting.title.toLowerCase()})` : ''));
  },

  completeStage(id) {
    const o = this.order(id); if (!o || o.status !== 'production') return;
    const i = o.route.indexOf(o.stage);
    const sg = SG[o.stage];
    o.history.push({ t: Date.now(), text: `Этап «${sg.label}» завершён`, who: this.person(sg.worker).name });
    if (i < o.route.length - 1) {
      o.stage = o.route[i + 1];
      this.commit({ type: 'order:stage', id: o.id });
    } else {
      this.setStatus(id, 'qc');
    }
  },

  /* MVP: перевести заказ на шаг пути — new | work | done (канбан «Производство») */
  setPhase(id, phase) {
    const o = this.order(id); if (!o || phaseOf(o) === phase) return;
    this.setStatus(id, PH[phase].status);
  },

  /* перетаскивание на доске этапов (полная версия): queue | этап | qc | ready */
  moveOrder(id, col) {
    const o = this.order(id); if (!o) return;
    if (col === 'queue') return this.setStatus(id, 'confirmed');
    if (col === 'qc' || col === 'ready') return this.setStatus(id, col);
    if (!o.route.includes(col)) o.route = STAGE_ORDER.filter(s => s === col || o.route.includes(s));
    if (o.status !== 'production') { o.stage = col; this.setStatus(id, 'production'); return; }
    if (o.stage === col) return;
    const from = o.stage;
    o.stage = col;
    this.log(o, `Перемещён: «${SG[from].label}» → «${SG[col].label}»`);
    this.commit({ type: 'order:stage', id: o.id });
  },

  setDeadline(id, iso) {
    const o = this.order(id); if (!o || o.deadline === iso) return;
    this.log(o, `Срок изменён: ${fmtDate(o.deadline)} → ${fmtDate(iso)}`);
    o.deadline = iso; o.flags.overdueNotified = false;
    this.commit({ type: 'order:deadline', id: o.id });
  },
  setManager(id, sid) { const o = this.order(id); o.managerId = sid; this.log(o, 'Ответственный: ' + this.person(sid).name); this.commit(); },
  setPrice(id, lines) {
    const o = this.order(id);
    const total = lines.reduce((s, l) => s + (+l.sum || 0), 0);
    if (o.price.total !== total) this.log(o, `Стоимость изменена: ${rub(o.price.total)} → ${rub(total)}`);
    o.price = { lines, total, manual: true };
    this.commit();
  },
  sendMessage(id, from, text, file) {
    const o = this.order(id); const now = Date.now();
    const m = { id: 'm' + now + Math.random().toString(36).slice(2, 5), from, text, t: now };
    if (file) m.file = file;
    o.messages.push(m);
    if (from === 'client') { o.unread.admin++; this.notify('admin', 'message', o, `№${o.id} · ${this.client(o.clientId).name}: ${text || file?.name || 'файл'}`); }
    else { o.unread.client++; }
    this.commit({ type: 'message', id: o.id, from });
    return m;
  },
  markRead(id, side) { const o = this.order(id); if (o && o.unread[side]) { o.unread[side] = 0; this.commit({ type: 'read' }); } },
  addPayment(id, sum) {
    const o = this.order(id);
    o.payments.push({ t: Date.now(), sum });
    this.log(o, 'Оплата: ' + rub(sum));
    this.commit();
  },
  requestDelivery(id, address, date) {
    const o = this.order(id);
    o.delivery = { address, date };
    if (!o.extras.includes('delivery')) o.extras.push('delivery');
    this.log(o, `Клиент заказал доставку на ${fmtDate(date)}`, this.client(o.clientId).name);
    o.messages.push({ id: 'm' + Date.now(), from: 'system', text: `Доставка заказана: ${fmtDate(date)}, ${address}`, t: Date.now() });
    this.notify('admin', 'delivery', o, `№${o.id} · ${fmtDate(date)}, ${address}`);
    this.commit();
  },
  /* повтор заказа менеджером — сразу с новым расчётом */
  repeatOrder(id) {
    const src = this.order(id);
    return this.createOrder({ cat: src.cat, params: src.params, extras: [...src.extras], urgent: false, clientId: src.clientId, comment: `Повтор заказа №${src.id}` }, 'admin');
  },
  updateClient(id, data) { Object.assign(this.client(id), data); this.commit(); },
  addStaff(p) { this.s.staff.push({ id: 'w' + Date.now().toString(36), kind: 'worker', ...p }); this.commit(); },

  checkOverdue(silent) {
    let changed = false;
    this.s.orders.forEach(o => {
      if (this.isOverdue(o) && !o.flags.overdueNotified) {
        o.flags.overdueNotified = true; changed = true;
        this.notify('admin', 'overdue', o, `${this.client(o.clientId).company} · ${o.title} · срок был ${fmtDate(o.deadline)}`);
      }
    });
    if (changed && !silent) this.commit({ type: 'overdue' });
    if (silent) this._fresh = [];
  },
};

/* синхронизация вкладок: клиент в одной, цех в другой */
window.addEventListener('storage', e => {
  if (e.key !== STORE_KEY || !e.newValue) return;
  const before = new Set(Store.s.notifs.map(n => n.id));
  try { Store.s = JSON.parse(e.newValue); } catch (err) { return; }
  Store._fresh = Store.s.notifs.filter(n => !before.has(n.id));
  Store.emit({ type: 'external' });
});
