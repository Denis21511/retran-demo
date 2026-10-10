'use strict';
/* =========================================================
   Кабинет клиента (MVP): Мои заказы · Новый расчёт
   Клиент сам считает заказ, отправляет заявку и видит статус.
   Сообщения, профиль и доставка остаются в коде, но вне MVP.
   ========================================================= */
const Client = {
  seen: {},
  shell(root) {
    if ($('.capp', root)) return $('#view', root);
    root.innerHTML = `<div class="capp">
      <header class="ctop"><div class="in">
        <a href="#/app" class="logo" aria-label="Ретран — мои заказы">Ретран<i></i></a>
        <nav class="cnav" aria-label="Кабинет">
          <a href="#/app" data-nav="home">${icon('box', 18)}Мои заказы</a>
          <a href="#/app/new" data-nav="new">${icon('cube', 18)}Новый расчёт</a>
        </nav>
        <div class="right">
          <a class="btn btn--ghost btn--sm hide-m" href="#/admin" title="Демо: открыть панель «Ретран»">${icon('factory', 16)}Панель «Ретран»</a>
          ${Theme.btn()}
          <span title="${esc(Store.me().name)}">${UI.avatar(Store.me().name, 'avatar--sm')}</span>
        </div>
      </div></header>
      <main class="cmain" id="view"></main>
      <nav class="tabbar tabbar--2" aria-label="Кабинет">
        <a href="#/app" data-nav="home">${icon('box', 22)}Мои заказы</a>
        <a href="#/app/new" data-nav="new">${icon('cube', 22)}Новый расчёт</a>
      </nav>
    </div>`;
    return $('#view', root);
  },
  badges() {},
  setNav(key) {
    $$('.capp [data-nav]').forEach(a => a.classList.toggle('is-on', a.dataset.nav === key));
    $('.capp')?.classList.remove('in-wizard');
  },

  /* ---------- главная: новый расчёт + мои заказы ---------- */
  home(view) {
    const me = Store.me();
    const mine = Store.ordersOf(ME);
    const current = mine.filter(o => phaseOf(o) !== 'done');
    const done = mine.filter(o => phaseOf(o) === 'done').slice(0, 5);
    const h = new Date().getHours();
    const hi = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
    view.innerHTML = `<div class="chome">
      <div>
        <div class="hello"><h1>${hi}, ${esc(firstName(me.name))}</h1><p>${esc(me.company)}</p></div>
        <div class="newcard">
          <h2>Рассчитать заказ</h2>
          <p>Выберите изделие и размеры — цена и 3D-модель появятся сразу</p>
          <div class="cats cats--3">${Wizard.CATS.map(k => `<a class="cat" href="#/app/new?cat=${k}">${icon(CATS[k].icon, 22)}${CATS[k].label}</a>`).join('')}</div>
        </div>
      </div>
      <div>
        <div class="row row--between" style="margin:6px 0 12px"><h2 class="section-title">Текущие заказы</h2><span class="small muted">${current.length}</span></div>
        <div class="olist">${current.length ? current.map(Client.ocard).join('') : `<div class="card empty">${icon('box', 28)}Текущих заказов нет<div style="margin-top:14px"><a class="btn btn--primary" href="#/app/new">Рассчитать заказ</a></div></div>`}</div>
        ${done.length ? `<div class="row row--between" style="margin:22px 0 12px"><h2 class="section-title">Готовые</h2></div><div class="olist">${done.map(Client.ocard).join('')}</div>` : ''}
      </div>
    </div>`;
  },
  ocard(o) {
    const ph = phaseOf(o);
    return `<a class="ocard" href="#/app/order/${o.id}">
      <div class="t"><div><span class="no">№${o.id}</span><h3>${esc(o.title)}</h3></div>${UI.pill(o, 'client')}</div>
      <div class="meta"><span>${icon('ruble', 15)}${o.price.total ? rub(o.price.total) : 'рассчитывается'}</span><span>${icon('clock', 15)}${ph === 'done' ? 'готов ' + fmtDate(isoDate(new Date(doneAt(o) || Date.now()))) : 'до ' + fmtDate(o.deadline)}</span></div>
      ${UI.prog(o)}
    </a>`;
  },
  orders(view) { Client.home(view); },

  /* ---------- карточка заказа: статус, параметры, стоимость ---------- */
  order(view, id) {
    const o = Store.order(id);
    if (!o || o.clientId !== ME) { view.innerHTML = `<div class="card empty">Заказ не найден. <a class="link" href="#/app">К заказам</a></div>`; return; }
    const ph = phaseOf(o);
    const just = Client.seen[o.id] && Client.seen[o.id] !== ph;
    Client.seen[o.id] = ph;
    const P = Store.P, S = Store.s.settings;
    const params = CATS[o.cat].fields.filter(f => fieldVisible(f, o.params) && f.key !== 'descr').map(f => [f.label, f.type === 'num' ? `${num(o.params[f.key])} ${f.unit}` : f.type === 'qty' ? o.params.qty + ' шт' : optLabel(o.cat, f.key, o.params[f.key], P)]);
    const sub = { request: 'менеджер проверяет расчёт', new: 'в очереди производства', work: 'изготавливаем', done: 'можно забирать' }[ph];
    view.innerHTML = `<a class="back" href="#/app">${icon('left', 16)}Мои заказы</a>
    <div class="ogrid">
      <div class="col" style="gap:16px">
        <div class="card" style="overflow:hidden">
          <div class="ohead"><span class="no">Заказ №${o.id}</span><h1>${esc(o.title)}</h1><span class="${just ? 'pill-wrap' : ''}">${UI.pill(o, 'client').replace('class="pill', `class="pill ${just ? 'is-changed' : ''}`)}</span></div>
          <div class="facts">
            <div><small>${ph === 'request' ? 'Ориентировочная стоимость' : 'Стоимость'}</small><b>${o.price.total ? rub(o.price.total) : 'считаем'}</b><div class="s">${ph === 'request' ? 'подтвердит менеджер' : 'подтверждена'}</div></div>
            <div><small>Готовность</small><b>${ph === 'done' ? 'готов' : fmtDate(o.deadline)}</b><div class="s">${ph === 'done' ? fmtDate(isoDate(new Date(doneAt(o) || Date.now()))) : relDeadline(o.deadline)}</div></div>
            <div><small>Статус</small><b>${PH[ph].client}</b><div class="s">${sub}</div></div>
          </div>
        </div>
        <div class="card"><div class="card__h"><h3>Статус заказа</h3><span class="small muted">обновлено ${fmtAgo(Math.max(...o.history.map(h => h.t)))}</span></div><div class="card__b">${UI.timeline(o, just)}</div></div>
        <div class="card"><div class="card__h"><h3>Параметры изделия</h3><span class="small muted">${CATS[o.cat].label}</span></div><div class="card__b">
          ${CATS[o.cat].view3d ? `<div data-3d style="margin-bottom:14px"></div>` : ''}
          <ul class="plist">${params.map(([k, v]) => `<li><span>${k}</span><span>${v}</span></li>`).join('')}${o.extras.length ? `<li><span>Дополнительно</span><span>${o.extras.map(x => P.extras[x].label).join(', ')}</span></li>` : ''}</ul>
        </div></div>
      </div>
      <div class="col" style="gap:16px">
        ${o.price.total ? `<div class="card">${Client.priceHTML(o)}</div>` : ''}
        <div class="card card--pad">
          <div class="section-title" style="margin-bottom:10px">Вопросы по заказу</div>
          <b>${esc(S.company)}</b>
          <div class="small muted" style="margin-top:2px">${esc(S.hours)} · ${esc(S.address)}</div>
          <a class="btn btn--outline btn--block" style="margin-top:14px" href="tel:${S.phone.replace(/[^+\d]/g, '')}">${icon('phone', 17)}${esc(S.phone)}</a>
        </div>
      </div>
    </div>`;
    if (CATS[o.cat].view3d) UI.keep3d($('[data-3d]', view), 'corder-' + o.id, o.cat, o.params, o.extras, { small: true });
  },
  priceHTML(o) {
    const req = phaseOf(o) === 'request';
    return `<div class="estimate"><h3>Состав расчёта</h3><ul class="elines">${o.price.lines.map(l => `<li><div>${esc(l.label)}<small>${esc(l.sub || '')}</small></div><span class="v">${rub(l.sum)}</span></li>`).join('')}</ul>
      <div class="etotal"><small>${req ? 'Ориентировочная стоимость' : 'Стоимость заказа'}</small><div><span class="big">${rub(o.price.total)}</span></div></div>
      ${req ? `<p class="enote">Финальную стоимость подтвердит менеджер, когда примет заказ.</p>` : ''}</div>`;
  },

  /* ---------- вне MVP: доставка, сообщения, профиль ---------- */
  deliveryModal(o) {
    const me = Store.me();
    const min = isoDate(addDays(parseIso(o.deadline), 1) < today0() ? today0() : parseIso(o.deadline));
    UI.modal({
      title: 'Доставка заказа №' + o.id,
      body: `<div class="col" style="gap:14px">
        <div class="field"><label for="d_addr">Адрес</label><input class="input" id="d_addr" value="${esc(o.delivery?.address || me.address || '')}" placeholder="Город, улица, дом"></div>
        <div class="fgrid">
          <div class="field"><label for="d_date">Дата</label><input class="input" id="d_date" type="date" min="${min}" value="${o.delivery?.date || min}"></div>
          <div class="field"><span class="label">Время</span><div class="seg" data-slot><button type="button" class="is-on">9–13</button><button type="button">13–18</button></div></div>
        </div>
        <div class="example"><div><span>Стоимость доставки</span><b>${rub(Store.P.extras.delivery.price)}</b></div><div><span>Ближайшая дата</span><span>${fmtDate(min)}</span></div></div>
      </div>`,
      foot: `<button class="btn btn--outline" data-close>Отмена</button><button class="btn btn--primary" data-ok>${icon('truck', 18)}Заказать доставку</button>`,
      onMount(m, close) {
        $$('[data-slot] button', m).forEach(b => b.onclick = () => $$('[data-slot] button', m).forEach(x => x.classList.toggle('is-on', x === b)));
        $('[data-ok]', m).onclick = () => {
          const addr = $('#d_addr', m).value.trim();
          if (!addr) { $('#d_addr', m).closest('.field').classList.add('is-error'); $('#d_addr', m).focus(); return; }
          const date = $('#d_date', m).value || min;
          Store.updateClient(ME, { address: addr });
          Store.requestDelivery(o.id, addr + ', ' + $('[data-slot] .is-on', m).textContent, date);
          close();
          UI.toast({ title: 'Доставка заказана', text: `${fmtDate(date)}, ${addr}`, icon: 'truck', tone: 'ok' });
        };
      },
    });
  },

  /* ---------- сообщения ---------- */
  messages(view) {
    const mine = Store.ordersOf(ME).filter(o => o.messages.length || o.status !== 'shipped');
    const last = o => o.messages[o.messages.length - 1];
    mine.sort((a, b) => (last(b)?.t || b.createdAt) - (last(a)?.t || a.createdAt));
    view.innerHTML = `<div class="page-h"><h1>Сообщения</h1></div>
      <p class="muted small" style="margin:-10px 0 16px">Переписка ведётся по каждому заказу отдельно — так ничего не теряется.</p>
      <div class="threads" style="max-width:760px">${mine.map(o => {
        const m = last(o), mgr = Store.person(o.managerId);
        const prev = m ? (m.from === 'client' ? 'Вы: ' : m.from === 'system' ? '' : '') + (m.text || (m.file ? '📎 ' + m.file.name : '')) : 'Нет сообщений — напишите менеджеру';
        return `<a class="thread" href="#/app/chat/${o.id}">${UI.avatar(mgr.name)}<div style="min-width:0"><b>№${o.id} · ${esc(o.title)}</b><p>${esc(prev)}</p></div><div class="r"><span>${m ? fmtWhen(m.t).replace('сегодня, ', '') : ''}</span>${o.unread.client ? `<span class="count">${o.unread.client}</span>` : '<span></span>'}</div></a>`;
      }).join('') || `<div class="empty">${icon('chat', 28)}Сообщений пока нет</div>`}</div>`;
  },
  chat(view, id) {
    const o = Store.order(id);
    if (!o || o.clientId !== ME) { view.innerHTML = `<div class="card empty">Чат не найден</div>`; return; }
    view.innerHTML = `<a class="back" href="#/app/messages">${icon('left', 16)}Сообщения</a><div style="max-width:760px">${Chat.html(o, 'client', { page: true, quick: true })}</div>`;
    Chat.mount(view, o, 'client');
  },

  /* ---------- профиль ---------- */
  profile(view) {
    const me = Store.me(), n = Store.s.settings.notify.client;
    const orders = Store.ordersOf(ME);
    view.innerHTML = `<div class="page-h"><h1>Профиль</h1></div>
    <div class="pgrid">
      <div class="card card--pad">
        <div class="row" style="margin-bottom:18px">${UI.avatar(me.name, 'avatar--lg avatar--navy')}<div><b style="font-size:18px">${esc(me.name)}</b><div class="small muted">${esc(me.company)} · ${orders.length} ${plural(orders.length, 'заказ', 'заказа', 'заказов')}</div></div></div>
        <form class="col" data-form style="gap:14px">
          <div class="field"><label for="p_name">Имя</label><input class="input" id="p_name" name="name" value="${esc(me.name)}"></div>
          <div class="fgrid"><div class="field"><label for="p_phone">Телефон</label><input class="input" id="p_phone" name="phone" type="tel" value="${esc(me.phone)}"></div><div class="field"><label for="p_email">Email</label><input class="input" id="p_email" name="email" type="email" value="${esc(me.email)}"></div></div>
          <div class="field"><label for="p_company">Компания</label><input class="input" id="p_company" name="company" value="${esc(me.company)}"></div>
          <div class="field"><label for="p_addr">Адрес доставки</label><input class="input" id="p_addr" name="address" value="${esc(me.address || '')}"></div>
          <div><button class="btn btn--primary">Сохранить</button></div>
        </form>
      </div>
      <div class="col" style="gap:16px">
        <div class="card card--pad">
          <h3 style="font-size:16px;margin-bottom:12px">Оформление</h3>
          ${Theme.seg()}
        </div>
        <div class="card card--pad">
          <h3 style="font-size:16px;margin-bottom:6px">Уведомления</h3>
          ${[['accepted', 'Заказ принят', 'когда заявка получена'], ['calc', 'Расчёт готов', 'стоимость подтверждена менеджером'], ['production', 'Запуск в производство', 'когда заказ поставлен в работу'], ['ready', 'Заказ готов', 'можно забирать или ждать доставку']].map(([k, t, s]) => `<div class="trow"><div><b>${t}</b><small>${s}</small></div><label class="switch"><input type="checkbox" data-n="${k}" ${n[k] !== false ? 'checked' : ''} aria-label="${t}"><span></span></label></div>`).join('')}
        </div>
        <div class="card card--pad">
          <h3 style="font-size:16px;margin-bottom:6px">Демо-режим</h3>
          <p class="small muted" style="margin-bottom:14px">Откройте панель «Ретран» в соседней вкладке: заказы, статусы и сообщения синхронизируются между кабинетом клиента и вами.</p>
          <div class="row row--wrap"><a class="btn btn--outline" href="#/admin" target="_blank">${icon('factory', 17)}Панель «Ретран»</a><button class="btn btn--ghost" data-reset>Сбросить демо-данные</button></div>
        </div>
      </div>
    </div>`;
    view.onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target);
      Store.updateClient(ME, Object.fromEntries(f.entries()));
      UI.toast({ title: 'Профиль сохранён', icon: 'check', tone: 'ok', timeout: 2500 });
    };
    view.onchange = e => { if (e.target.dataset.n) { Store.s.settings.notify.client[e.target.dataset.n] = e.target.checked; Store.commit({ type: 'settings' }); } };
    view.onclick = e => { if (e.target.closest('[data-reset]')) App.confirmReset(); };
  },
};
