'use strict';
/* =========================================================
   Маршрутизация и живое обновление экранов
   ========================================================= */
const App = {
  side: null, live: false, key: '',
  /* MVP: эти разделы остаются в коде, но не входят в путь пользователя — ссылки ведут на главную раздела */
  HIDDEN: {
    client: ['messages', 'chat', 'profile'],
    admin: ['calendar', 'staff', 'payments', 'analytics', 'settings'],
  },
  CLIENT: {
    '': ['home', (v) => Client.home(v), true],
    new: ['new', (v, q) => Wizard.open(v, 'client', q), false],
    orders: ['home', (v) => Client.home(v), true],
    order: ['home', (v, q, id) => Client.order(v, id), true],
    messages: ['messages', (v) => Client.messages(v), true],
    chat: ['messages', (v, q, id) => Client.chat(v, id), false],
    profile: ['profile', (v) => Client.profile(v), false],
  },
  ADMIN: {
    '': ['dash', 'Обзор', (v) => Admin.dash(v), true],
    requests: ['requests', 'Заявки', (v, q) => Admin.requests(v, q), true],
    orders: ['orders', 'Заказы', (v, q) => Admin.orders(v, q), true],
    order: ['orders', 'Заказ', (v, q, id) => Admin.order(v, id), true],
    new: ['', 'Расчёт заказа', (v, q) => Wizard.open(v, 'admin', q), false],
    production: ['production', 'Производство', (v) => Admin.production(v), true],
    clients: ['clients', 'Клиенты', (v) => Admin.clients(v), true],
    client: ['clients', 'Клиент', (v, q, id) => Admin.client(v, id), true],
    calendar: ['calendar', 'Календарь производства', (v, q) => Admin.calendar(v, q), true],
    staff: ['staff', 'Сотрудники', (v) => Admin.staff(v), true],
    prices: ['prices', 'Цены', (v, q) => Admin.prices(v, q), false],
    payments: ['payments', 'Оплаты', (v, q) => Admin.payments(v, q), true],
    analytics: ['analytics', 'Аналитика', (v) => Admin.analytics(v), true],
    settings: ['settings', 'Настройки', (v) => Admin.settings(v), false],
  },

  parse() {
    const [path, qs] = (location.hash.slice(1) || '/').split('?');
    return { parts: path.split('/').filter(Boolean), q: Object.fromEntries(new URLSearchParams(qs || '')) };
  },

  render(keepScroll) {
    const root = $('#root');
    const { parts, q } = App.parse();
    const side = parts[0] === 'app' ? 'client' : parts[0] === 'admin' ? 'admin' : 'landing';
    if (side !== 'landing' && App.HIDDEN[side].includes(parts[1])) { location.replace('#/' + parts[0]); return; }
    if (side !== App.side) { resetHandlers(root); $('#overlay').innerHTML = ''; }
    App.side = side;
    const key = location.hash;
    if (key !== App.key && !keepScroll) window.scrollTo(0, 0);
    App.key = key;

    if (side === 'landing') {
      App.live = false;
      document.title = 'Ретран — расчёт мебели онлайн';
      Landing.render(root);
      return;
    }
    if (side === 'client') {
      const view = Client.shell(root);
      const r = App.CLIENT[parts[1] || ''] || App.CLIENT[''];
      Client.setNav(r[0]);
      resetHandlers(view);
      document.title = 'Расчёт мебели — Ретран';
      r[1](view, q, parts[2]);
      App.live = r[2];
      Client.badges();
      return;
    }
    const view = Admin.shell(root);
    const r = App.ADMIN[parts[1] || ''] || App.ADMIN[''];
    Admin.setNav(r[0], r[1]);
    resetHandlers(view);
    r[2](view, q, parts[2]);
    App.live = r[3];
    Admin.badges();
  },

  /* реакция на изменения данных: своя вкладка или соседняя */
  onStore(e) {
    if (e.type === 'reset') { $('#root').innerHTML = ''; App.side = null; App.render(true); return; }
    const LIVE = ['order:new', 'order:status', 'order:stage', 'order:deadline', 'change', 'external', 'overdue'];
    const go = id => { location.hash = (App.side === 'admin' ? '#/admin/order/' : '#/app/order/') + id; };
    if (App.side === 'client') { Client.badges(); UI.showFresh('client', go); }
    if (App.side === 'admin') { Admin.badges(); UI.showFresh('admin', go); }
    if (App.side === 'landing') Store.flushFresh();
    if (App.live && LIVE.includes(e.type) && !$('#overlay').children.length) App.render(true);
  },

  confirmReset() {
    UI.modal({
      title: 'Сбросить демо-данные?',
      body: '<p class="muted">Все созданные заказы, сообщения и изменения цен будут удалены. Вернётся исходный пример.</p>',
      foot: '<button class="btn btn--outline" data-close>Отмена</button><button class="btn btn--danger" data-ok>Сбросить</button>',
      onMount(m, close) { $('[data-ok]', m).onclick = () => { close(); SS.del(Wizard.key('client')); SS.del(Wizard.key('admin')); Store.reset(); UI.toast({ title: 'Демо-данные восстановлены', icon: 'rotate', timeout: 2500 }); }; },
    });
  },

  start() {
    Theme.init();
    Store.load();
    Store.on(e => App.onStore(e));
    window.addEventListener('hashchange', () => App.render());
    setInterval(() => Store.checkOverdue(), 60000);
    App.render();
  },
};

App.start();
