'use strict';
/* =========================================================
   Панель цеха: каркас, обзор, заявки, заказы, карточка заказа
   MVP: Расчёт → Заявка → Заказ → Производство → Готово
   ========================================================= */
const Admin = {
  /* В меню только путь заказа. Календарь, сотрудники, оплаты, аналитика и настройки
     остаются в коде (admin-pages.js), но убраны из меню и маршрутов — см. App.HIDDEN */
  NAV: [
    ['dash', '#/admin', 'grid', 'Обзор'],
    ['requests', '#/admin/requests', 'inbox', 'Заявки'],
    ['orders', '#/admin/orders', 'list', 'Заказы'],
    ['production', '#/admin/production', 'board', 'Производство'],
    ['clients', '#/admin/clients', 'users', 'Клиенты'],
    ['prices', '#/admin/prices', 'tag', 'Цены'],
  ],
  shell(root) {
    if ($('.aapp', root)) return $('#view', root);
    const S = Store.s;
    root.innerHTML = `<div class="aapp">
      <aside class="side-nav" aria-label="Разделы панели">
        <a href="#/admin" class="logo logo--light">Ретран<i></i></a>
        <div class="org">${esc(S.settings.company)}</div>
        <nav>${Admin.NAV.map(([k, h, i, t], n) => `${n === 4 ? '<div class="sep"></div>' : ''}<a href="${h}" data-nav="${k}">${icon(i, 19)}${t}<span class="count hidden" data-badge="${k}"></span></a>`).join('')}</nav>
        <div class="foot">
          <div class="me">${UI.avatar(S.owner.name)}<div><b>${esc(S.owner.name)}</b><small>${esc(S.owner.role)}</small></div></div>
          <a class="switchrole" href="#/app">${icon('user', 16)}Кабинет клиента (демо)</a>
          <button class="resetdemo" type="button" data-reset>${icon('rotate', 14)}Сбросить демо-данные</button>
        </div>
      </aside>
      <div class="navscrim"></div>
      <div class="amain">
        <header class="atop">
          <button class="iconbtn burger" aria-label="Меню">${icon('menu', 20)}</button>
          <h1 data-title>Обзор</h1>
          <div class="search"><span>${icon('search', 18)}</span><input class="input" placeholder="Номер заказа, клиент, изделие" aria-label="Поиск заказов"><div class="sresults hidden"></div></div>
          <a class="btn btn--primary newbtn" href="#/admin/new">${icon('plus', 18)}<span>Новый расчёт</span></a>
          ${Theme.btn()}
        </header>
        <div class="acontent" id="view"></div>
      </div>
    </div>`;
    const app = $('.aapp', root);
    $('.burger', root).onclick = () => app.classList.add('nav-open');
    $('.navscrim', root).onclick = () => app.classList.remove('nav-open');
    $('[data-reset]', root).onclick = () => App.confirmReset();
    Admin.bindSearch($('.search', root));
    return $('#view', root);
  },
  bindSearch(box) {
    const inp = $('input', box), res = $('.sresults', box);
    let found = [], sel = 0;
    const draw = () => {
      const q = inp.value.trim().toLowerCase();
      if (!q) { res.classList.add('hidden'); return; }
      found = Store.s.orders.filter(o => { const c = Store.client(o.clientId); return String(o.id).includes(q) || o.title.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q); }).sort((a, b) => b.id - a.id).slice(0, 7);
      sel = 0;
      res.innerHTML = found.length ? found.map((o, i) => `<a href="${Admin.href(o)}" class="${i === sel ? 'is-on' : ''}"><span class="mono small">№${o.id}</span><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o.title)} <span class="muted">· ${esc(UI.clientName(Store.client(o.clientId)))}</span></span>${UI.pill(o)}</a>`).join('') : `<div class="empty" style="padding:16px">Ничего не найдено</div>`;
      res.classList.remove('hidden');
    };
    inp.oninput = draw;
    inp.onfocus = draw;
    inp.onkeydown = e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = clamp(sel + (e.key === 'ArrowDown' ? 1 : -1), 0, found.length - 1); $$('a', res).forEach((a, i) => a.classList.toggle('is-on', i === sel)); }
      if (e.key === 'Enter' && found[sel]) { location.hash = Admin.href(found[sel]); inp.value = ''; inp.blur(); res.classList.add('hidden'); }
      if (e.key === 'Escape') { inp.value = ''; res.classList.add('hidden'); inp.blur(); }
    };
    inp.onblur = () => setTimeout(() => res.classList.add('hidden'), 150);
    res.onclick = () => { inp.value = ''; res.classList.add('hidden'); };
  },
  /* заявка открывается в «Заявках», заказ — в своей карточке */
  href(o) { return phaseOf(o) === 'request' ? '#/admin/requests?id=' + o.id : '#/admin/order/' + o.id; },
  badges() {
    const os = Store.s.orders;
    const set = (k, n, warn) => $$(`[data-badge="${k}"]`).forEach(b => { b.textContent = n; b.classList.toggle('hidden', !n); b.classList.toggle('warn', !!warn); });
    set('requests', os.filter(o => phaseOf(o) === 'request').length);
    set('orders', os.filter(o => Store.isOverdue(o) && phaseOf(o) !== 'request').length, true);
    set('production', os.filter(o => phaseOf(o) === 'new').length);
  },
  setNav(key, title) {
    $$('.aapp [data-nav]').forEach(a => a.classList.toggle('is-on', a.dataset.nav === key));
    const t = $('.aapp [data-title]'); if (t) t.textContent = title;
    $('.aapp')?.classList.remove('nav-open');
    document.title = title + ' — Ретран';
  },
  clientLabel(o) { const c = Store.client(o.clientId); return UI.clientName(c); },
  dl(o, cls = 'dl') {
    const late = Store.isOverdue(o);
    const rel = phaseOf(o) === 'done' ? 'готов' : relDeadline(o.deadline);
    return `<div class="${cls} ${late ? 'late' : ''}">${fmtDate(o.deadline)}<small class="${late ? 'late' : ''}">${rel}</small></div>`;
  },
  /* только что созданный или изменённый заказ — подсвечиваем */
  isFresh(o) { return Date.now() - Math.max(o.createdAt, ...Object.values(o.times)) < 9e4; },

  /* ---------- обзор: 4 показателя, очередь, новые заявки ---------- */
  dash(view) {
    const os = Store.s.orders, t0 = today0().getTime(), from = Date.now() - 30 * DAY;
    const reqs = os.filter(o => phaseOf(o) === 'request').sort((a, b) => b.createdAt - a.createdAt);
    const work = os.filter(o => phaseOf(o) === 'work');
    const late = os.filter(o => Store.isOverdue(o) && phaseOf(o) !== 'request');
    const done = os.filter(o => phaseOf(o) === 'done' && doneAt(o) >= from);
    const todayNew = reqs.filter(o => o.createdAt >= t0).length;
    const queue = os.filter(o => ['new', 'work'].includes(phaseOf(o))).sort((a, b) => (Store.isOverdue(b) - Store.isOverdue(a)) || a.deadline.localeCompare(b.deadline)).slice(0, 8);
    view.innerHTML = `
      <div class="kpis kpis--4">
        <a class="kpi" href="#/admin/requests"><div class="kh">Новые заявки ${icon('inbox', 18)}</div><div class="kv">${reqs.length}</div><div class="ks">${todayNew ? '+' + todayNew + ' сегодня' : 'за сегодня новых нет'}</div></a>
        <a class="kpi" href="#/admin/orders?f=work"><div class="kh">Заказы в работе ${icon('factory', 18)}</div><div class="kv">${work.length}</div><div class="ks">${late.length ? `<span class="dn">${late.length} ${plural(late.length, 'просрочен', 'просрочено', 'просрочено')}</span>` : '<span class="up">все в срок</span>'}</div></a>
        <a class="kpi" href="#/admin/orders?f=done"><div class="kh">Готовые заказы ${icon('check', 18)}</div><div class="kv">${done.length}</div><div class="ks">за 30 дней</div></a>
        <div class="kpi kpi--accent"><div class="kh">Выручка ${icon('ruble', 18)}</div><div class="kv">${rub(Store.earned(from))}</div><div class="ks">готовые заказы за 30 дней</div></div>
      </div>
      <div class="dash">
        <div class="card">
          <div class="card__h"><h2>Производственная очередь</h2><a class="link small" href="#/admin/production">Открыть доску ${icon('right', 14)}</a></div>
          <div class="table-wrap" style="margin-top:8px"><table class="table qtable">
            <thead><tr><th>№ заказа</th><th>Изделие</th><th class="hide-m">Клиент</th><th>Срок</th><th class="num">Стоимость</th><th>Статус</th></tr></thead>
            <tbody>${queue.map(o => `<tr class="is-link ${Admin.isFresh(o) ? 'is-fresh' : ''}" data-o="${o.id}"><td class="mono nowrap">№${o.id}</td><td><div class="ttl">${esc(o.title)}</div><div class="sub show-m">${esc(Admin.clientLabel(o))}</div></td><td class="hide-m">${esc(Admin.clientLabel(o))}</td><td class="nowrap ${Store.isOverdue(o) ? 'late' : ''}">${fmtDate(o.deadline)}</td><td class="num">${rub(o.price.total)}</td><td>${UI.pill(o)}</td></tr>`).join('') || `<tr><td colspan="6" class="empty">Очередь пуста — примите новую заявку</td></tr>`}</tbody>
          </table></div>
        </div>
        <div class="card">
          <div class="card__h"><h2>Новые заявки</h2><a class="link small" href="#/admin/requests">Все ${icon('right', 14)}</a></div>
          <div style="margin-top:10px">${reqs.map(o => `<a class="rq ${Admin.isFresh(o) ? 'is-fresh' : ''}" href="#/admin/requests?id=${o.id}"><div class="t"><b>${esc(o.title)}</b><span class="pr">${o.price.total ? rub(o.price.total) : 'нужен расчёт'}</span></div><small><span class="mono">№${o.id}</span> · ${esc(Admin.clientLabel(o))} · ${fmtAgo(o.createdAt)}</small></a>`).join('') || `<div class="empty" style="padding:20px">Новых заявок нет</div>`}</div>
        </div>
      </div>`;
    view.onclick = e => { const r = e.target.closest('[data-o]'); if (r && r.dataset.o) location.hash = '#/admin/order/' + r.dataset.o; };
  },

  /* ---------- заявки: список + карточка заявки ---------- */
  requests(view, q) {
    const list = Store.s.orders.filter(o => phaseOf(o) === 'request').sort((a, b) => b.createdAt - a.createdAt);
    let cur = Store.order(q.id);
    if (!cur || !list.includes(cur)) cur = list[0];
    const editing = !!cur && Admin.editReq === cur.id;
    const item = o => `<a class="ritem ${o === cur ? 'is-on' : ''} ${Admin.isFresh(o) ? 'is-fresh' : ''}" href="#/admin/requests?id=${o.id}"><div class="t"><b>${esc(o.title)}</b><span class="mono small muted">№${o.id}</span></div><small>${esc(Admin.clientLabel(o))} · ${fmtDateShort(o.createdAt)}, ${fmtTime(o.createdAt)}</small><div class="b"><span style="font-weight:600">${o.price.total ? rub(o.price.total) : 'нужен расчёт'}</span>${UI.pill(o)}</div></a>`;
    view.innerHTML = `<div class="split">
      <div class="rlist">
        <div class="grp">Входящие · ${list.length}</div>${list.map(item).join('') || `<div class="empty" style="padding:20px">Новых заявок нет</div>`}
      </div>
      <div>${cur ? Admin.requestDetail(cur, editing) : `<div class="card empty">${icon('inbox', 28)}Все заявки обработаны</div>`}</div>
    </div>`;
    if (!cur) return;
    if (q.id) history.replaceState(null, '', '#/admin/requests?id=' + cur.id);
    if (CATS[cur.cat].view3d) UI.keep3d($('[data-3d]', view), 'req-' + cur.id, cur.cat, cur.params, cur.extras, { small: true });
    if (editing) Admin.bindPriceEditor(view, cur);
    view.onclick = e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      if (act === 'editprice') { Admin.editReq = cur.id; Admin.requests(view, { id: cur.id }); $('[data-line]', view)?.focus(); }
      if (act === 'cancelprice') { Admin.editReq = null; Admin.requests(view, { id: cur.id }); }
      if (act === 'saveprice') {
        if (!Admin.savePrice(view, cur)) return;
        Admin.editReq = null; Admin.requests(view, { id: cur.id });
        UI.toast({ title: 'Стоимость изменена', text: `№${cur.id} · ${rub(Store.order(cur.id).price.total)}`, icon: 'edit', tone: 'ok', timeout: 2500 });
      }
      if (act === 'accept') {
        if (editing && !Admin.savePrice(view, cur)) return;
        if (!Store.order(cur.id).price.total) { Admin.editReq = cur.id; Admin.requests(view, { id: cur.id }); UI.toast({ title: 'Укажите стоимость', text: 'Без цены заказ не создать', icon: 'alert', tone: 'warn' }); return; }
        Admin.editReq = null;
        const id = cur.id;
        Store.setStatus(id, 'confirmed');
        UI.toast({ title: `Заказ №${id} создан`, text: 'Он появился в «Производстве», колонка «Новые»', icon: 'check', tone: 'ok', onClick: () => { location.hash = '#/admin/order/' + id; } });
      }
    };
  },
  requestDetail(o, editing) {
    const c = Store.client(o.clientId), P = Store.P;
    const tel = c.phone.replace(/[^+\d]/g, '');
    return `<div class="card">
      <div class="card__h" style="padding-top:20px"><div><span class="mono small muted">Заявка №${o.id} · ${fmtWhen(o.createdAt)} · ${esc(o.source)}</span><h2 style="font-size:22px;margin-top:4px">${esc(o.title)}</h2></div>${UI.pill(o)}</div>
      <div class="card__b">
        <div class="fgrid" style="gap:24px">
          <div>
            <div class="section-title" style="margin-bottom:10px">Описание</div>
            <p style="font-size:14.5px">${esc(CATS[o.cat].label.replace('­', ''))}: ${esc(specLine(o.cat, o.params, P))}${o.extras.length ? ' · ' + o.extras.map(x => P.extras[x].label.toLowerCase()).join(', ') : ''}</p>
            ${o.comment ? `<div class="example" style="margin-top:10px"><span class="small muted">Комментарий клиента</span><div style="display:block">${esc(o.comment)}</div></div>` : ''}
            <div class="section-title" style="margin:20px 0 10px">Контакт клиента</div>
            <div class="mgr">${UI.avatar(c.name)}<div class="grow"><b>${esc(c.name)}</b><small>${esc(c.company)}</small></div></div>
            <a class="btn btn--outline btn--block" style="margin-top:12px;justify-content:flex-start" href="tel:${tel}">${icon('phone', 17)}${esc(c.phone)}</a>
            <div class="row row--between" style="margin:22px 0 4px"><div class="section-title">Стоимость</div><span class="small muted">${o.price.manual ? 'изменена менеджером' : 'рассчитана калькулятором'}</span></div>
            ${Admin.priceEditorHTML(o, editing)}
            <div class="row row--wrap" style="margin-top:18px;gap:10px">
              <button class="btn btn--primary btn--lg" data-act="accept">${icon('check', 18)}Принять заказ</button>
              ${editing ? `<button class="btn btn--outline btn--lg" data-act="saveprice">Сохранить</button><button class="btn btn--ghost btn--lg" data-act="cancelprice">Отмена</button>` : `<button class="btn btn--outline btn--lg" data-act="editprice">${icon('edit', 18)}Изменить стоимость</button>`}
            </div>
          </div>
          <div>
            <div class="section-title" style="margin-bottom:10px">Параметры изделия</div>
            ${CATS[o.cat].view3d ? `<div data-3d style="margin-bottom:10px"></div>` : ''}
            <ul class="plist">${Admin.paramRows(o).map(([k, v]) => `<li><span>${k}</span><span>${v}</span></li>`).join('')}</ul>
          </div>
        </div>
      </div>
    </div>`;
  },
  paramRows(o) {
    const P = Store.P;
    const rows = CATS[o.cat].fields.filter(f => fieldVisible(f, o.params)).map(f => [f.label, f.type === 'num' ? `${num(o.params[f.key])} ${f.unit}` : f.type === 'qty' ? o.params.qty + ' шт' : f.type === 'textarea' || f.type === 'text' ? esc(o.params[f.key] || '—') : optLabel(o.cat, f.key, o.params[f.key], P)]);
    rows.push(['Доп. работы', o.extras.length ? o.extras.map(x => P.extras[x].label).join(', ') : 'нет']);
    return rows;
  },

  /* редактор стоимости: строки расчёта можно поправить вручную */
  priceEditorHTML(o, editable) {
    const lines = o.price.lines.length ? o.price.lines : [{ key: 'material', label: 'Материал', sub: '', sum: 0 }, { key: 'work', label: 'Обработка', sub: '', sum: 0 }, { key: 'extras', label: 'Дополнительные работы', sub: '', sum: 0 }];
    if (!editable) return `<ul class="elines" style="margin-top:0">${lines.map(l => `<li><div>${esc(l.label)}<small>${esc(l.sub || '')}</small></div><span class="v">${rub(l.sum)}</span></li>`).join('')}</ul><div class="etotal row row--between"><small>Итого</small><span class="big" style="font-size:24px">${rub(o.price.total)}</span></div>`;
    return `<div class="edit-lines" data-pe>${lines.map((l, i) => `<div class="el"><div>${esc(l.label)}<small>${esc(l.sub || '')}</small></div><div class="inunit"><input class="input input--sm" data-line="${i}" inputmode="numeric" value="${l.sum}" aria-label="${esc(l.label)}"><span>₽</span></div></div>`).join('')}</div>
      <div class="etotal row row--between"><small>Итого для клиента</small><span class="big" style="font-size:24px" data-pt>${rub(lines.reduce((s, l) => s + l.sum, 0))}</span></div>`;
  },
  bindPriceEditor(view, o) {
    const box = $('[data-pe]', view); if (!box) return;
    const tot = $('[data-pt]', view); tot._val = o.price.total || 0;
    box.oninput = () => tweenNumber(tot, $$('[data-line]', box).reduce((s, i) => s + (parseInt(i.value.replace(/\D/g, '')) || 0), 0));
  },
  savePrice(view, o) {
    const box = $('[data-pe]', view); if (!box) return true;
    const base = o.price.lines.length ? o.price.lines : [{ key: 'material', label: 'Материал', sub: '' }, { key: 'work', label: 'Обработка', sub: '' }, { key: 'extras', label: 'Дополнительные работы', sub: '' }];
    const lines = base.map((l, i) => ({ ...l, sum: parseInt($(`[data-line="${i}"]`, box).value.replace(/\D/g, '')) || 0 })).filter(l => l.sum > 0);
    const total = lines.reduce((s, l) => s + l.sum, 0);
    if (!total) { UI.toast({ title: 'Укажите стоимость', text: 'Заполните хотя бы одну строку расчёта', icon: 'alert', tone: 'warn' }); $('[data-line]', box).focus(); return false; }
    if (total !== o.price.total || lines.length !== o.price.lines.length) Store.setPrice(o.id, lines);
    return true;
  },

  /* ---------- заказы: компактный список карточек ---------- */
  ordFilter: {
    all: ['Все', o => phaseOf(o) !== 'request'],
    new: ['Новые', o => phaseOf(o) === 'new'],
    work: ['В работе', o => phaseOf(o) === 'work'],
    done: ['Готово', o => phaseOf(o) === 'done'],
  },
  ocard(o) {
    const late = Store.isOverdue(o);
    return `<a class="mcard ${late ? 'is-late' : ''} ${Admin.isFresh(o) ? 'is-fresh' : ''}" href="#/admin/order/${o.id}">
      <div class="t"><span class="no">№${o.id}</span>${UI.pill(o)}</div>
      <b>${esc(o.title)}</b>
      <div class="cl">${esc(Admin.clientLabel(o))}</div>
      <div class="f"><span class="sum">${rub(o.price.total)}</span><span class="${late ? 'late' : ''}">Срок: ${fmtDate(o.deadline)}</span></div>
    </a>`;
  },
  orders(view, q) {
    const f = Admin.ordFilter[q.f] ? q.f : 'all';
    const term = (Admin.ordTerm || '').toLowerCase();
    let list = Store.s.orders.filter(Admin.ordFilter[f][1]);
    if (term) list = list.filter(o => { const c = Store.client(o.clientId); return String(o.id).includes(term) || o.title.toLowerCase().includes(term) || c.name.toLowerCase().includes(term) || c.company.toLowerCase().includes(term); });
    // активные — по сроку, готовые — сначала свежие
    const rank = o => PH[phaseOf(o)].i === 3 ? 1 : 0;
    list.sort((a, b) => rank(a) - rank(b) || (rank(a) ? doneAt(b) - doneAt(a) : a.deadline.localeCompare(b.deadline)));
    view.innerHTML = `
      <div class="row row--between row--wrap" style="gap:12px;margin-bottom:16px">
        <div class="seg ofilter" role="tablist">${Object.entries(Admin.ordFilter).map(([k, [t, fn]]) => `<button role="tab" data-f="${k}" class="${k === f ? 'is-on' : ''}">${t}<span class="count count--muted">${Store.s.orders.filter(fn).length}</span></button>`).join('')}</div>
        <input class="input input--sm" style="width:240px;max-width:100%" placeholder="Поиск по заказам" value="${esc(Admin.ordTerm || '')}" data-term aria-label="Поиск по заказам">
      </div>
      <div class="mcards">${list.map(Admin.ocard).join('') || `<div class="card empty">${icon('list', 28)}Заказов нет</div>`}</div>`;
    view.onclick = e => { const b = e.target.closest('[data-f]'); if (b) location.hash = '#/admin/orders' + (b.dataset.f === 'all' ? '' : '?f=' + b.dataset.f); };
    view.oninput = e => {
      if (!e.target.hasAttribute('data-term')) return;
      Admin.ordTerm = e.target.value;
      const pos = e.target.selectionStart;
      Admin.orders(view, q);
      const inp = $('[data-term]', view); inp.focus(); inp.setSelectionRange(pos, pos);
    };
  },

  /* ---------- карточка заказа: только нужное ---------- */
  NEXT: {
    request: ['accept', 'Принять заказ', 'check'],
    new: ['work', 'Взять в работу', 'play'],
    work: ['done', 'Готово', 'check'],
  },
  order(view, id) {
    const o = Store.order(id);
    if (!o) { view.innerHTML = `<div class="card empty">Заказ не найден. <a class="link" href="#/admin/orders">К заказам</a></div>`; return; }
    const ph = phaseOf(o);
    if (ph === 'request') { location.replace('#/admin/requests?id=' + o.id); return; }
    Admin.setNav('orders', 'Заказ №' + o.id);
    const c = Store.client(o.clientId), P = Store.P;
    const next = Admin.NEXT[ph];
    const late = Store.isOverdue(o);
    const editPrice = Admin.editPrice === o.id;
    const tel = c.phone.replace(/[^+\d]/g, '');
    view.innerHTML = `
      <a class="back" href="#/admin/orders">${icon('left', 16)}Заказы</a>
      <div class="ahead">
        <div><div class="no">Заказ №${o.id} ${UI.pill(o)}</div><h2>${esc(o.title)}</h2><div class="small muted" style="margin-top:4px">${esc(specLine(o.cat, o.params, P))}</div></div>
        ${next ? `<div class="acts2"><button class="btn btn--primary btn--lg" data-phase="${next[0]}">${icon(next[2], 18)}${next[1]}</button></div>` : ''}
      </div>
      <div class="ocols2">
        <div class="col">
          <div class="card"><div class="card__h"><h3>Клиент</h3><a class="small link" href="#/admin/client/${c.id}">Все заказы клиента</a></div><div class="card__b">
            <div class="mgr">${UI.avatar(c.name)}<div class="grow"><b>${esc(c.name)}</b><small>${esc(c.company)}</small></div><a class="iconbtn" href="tel:${tel}" aria-label="Позвонить">${icon('phone', 18)}</a></div>
            <ul class="plist" style="margin-top:8px"><li><span>Телефон</span><span><a class="link" href="tel:${tel}">${esc(c.phone)}</a></span></li>${c.email ? `<li><span>Email</span><span>${esc(c.email)}</span></li>` : ''}</ul>
            ${o.comment ? `<div class="example" style="margin-top:10px"><span class="small muted">Комментарий</span><div style="display:block">${esc(o.comment)}</div></div>` : ''}
          </div></div>
          <div class="card"><div class="card__h"><h3>Параметры</h3><span class="small muted">${CATS[o.cat].label}</span></div><div class="card__b">
            ${CATS[o.cat].view3d ? `<div data-3d style="margin-bottom:12px"></div>` : ''}
            <ul class="plist">${Admin.paramRows(o).map(([k, v]) => `<li><span>${k}</span><span>${v}</span></li>`).join('')}</ul>
          </div></div>
        </div>
        <div class="col">
          <div class="card"><div class="card__h"><h3>Стоимость</h3>${editPrice ? '' : `<button class="btn btn--ghost btn--sm" data-act="editprice">${icon('edit', 15)}Изменить</button>`}</div><div class="card__b">
            ${Admin.priceEditorHTML(o, editPrice)}
            ${editPrice ? `<div class="row" style="margin-top:14px"><button class="btn btn--primary" data-act="saveprice">Сохранить</button><button class="btn btn--ghost" data-act="cancelprice">Отмена</button></div>` : ''}
          </div></div>
          <div class="card"><div class="card__h"><h3>Срок</h3><span class="small ${late ? 'late' : 'muted'}">${ph === 'done' ? 'выполнен' : relDeadline(o.deadline)}</span></div><div class="card__b">
            <input class="input ${late ? 'late' : ''}" type="date" value="${o.deadline}" data-deadline aria-label="Срок готовности">
          </div></div>
          <div class="card"><div class="card__h"><h3>Производство</h3></div><div class="card__b">
            <div class="seg pseg" role="radiogroup" aria-label="Статус производства">${['new', 'work', 'done'].map(k => `<button type="button" role="radio" aria-checked="${k === ph}" class="${k === ph ? 'is-on' : ''}" data-phase="${k}">${PH[k].label}</button>`).join('')}</div>
            <p class="small muted" style="margin-top:10px">${ph === 'new' ? 'Заказ ждёт запуска. Возьмите его в работу здесь или на доске «Производство».' : ph === 'work' ? 'Заказ изготавливается. Когда будет готов — нажмите «Готово», клиент увидит новый статус.' : 'Заказ готов. Клиент видит статус «Готово» в своём кабинете.'}</p>
          </div></div>
          <div class="card"><div class="card__h"><h3>История статуса</h3></div><div class="card__b"><ul class="hist">${o.history.slice().reverse().map(h => `<li><div>${esc(h.text)}<small>${fmtWhen(h.t)} · ${esc(h.who)}</small></div></li>`).join('')}</ul></div></div>
        </div>
      </div>`;
    if (CATS[o.cat].view3d) UI.keep3d($('[data-3d]', view), 'aorder-' + o.id, o.cat, o.params, o.extras, { small: true });
    if (editPrice) Admin.bindPriceEditor(view, o);
    view.onclick = e => {
      const p = e.target.closest('[data-phase]')?.dataset.phase;
      if (p) { Admin.toPhase(o.id, p); return; }
      const a = e.target.closest('[data-act]')?.dataset.act;
      if (a === 'editprice') { Admin.editPrice = o.id; Admin.order(view, id); }
      if (a === 'cancelprice') { Admin.editPrice = null; Admin.order(view, id); }
      if (a === 'saveprice' && Admin.savePrice(view, o)) { Admin.editPrice = null; Admin.order(view, id); UI.toast({ title: 'Стоимость обновлена', text: rub(Store.order(o.id).price.total), icon: 'check', tone: 'ok', timeout: 3000 }); }
    };
    view.onchange = e => {
      const t = e.target;
      if (t.hasAttribute('data-deadline') && t.value) { Store.setDeadline(o.id, t.value); UI.toast({ title: 'Срок изменён', text: fmtDate(t.value), icon: 'calendar', timeout: 2500 }); }
    };
  },
  /* смена шага заказа + понятное уведомление */
  toPhase(id, phase) {
    const o = Store.order(id); if (!o || phaseOf(o) === phase) return;
    if (phase === 'accept') phase = 'new';
    Store.setPhase(id, phase);
    if (phase === 'done') UI.toast({ title: `Заказ №${id} готов`, text: `${o.title} — клиент видит статус «Готово»`, icon: 'check', tone: 'ok' });
    else UI.toast({ title: `Заказ №${id} → ${PH[phase].label}`, text: o.title, icon: phase === 'work' ? 'play' : 'board', timeout: 2600 });
  },

  payModal(o) {
    const rest = o.price.total - Store.paid(o);
    UI.modal({
      title: 'Оплата по заказу №' + o.id,
      body: `<div class="col" style="gap:14px">
        <div class="example"><div><span>Сумма заказа</span><b>${rub(o.price.total)}</b></div><div><span>Оплачено</span><span>${rub(Store.paid(o))}</span></div><div><span>Остаток</span><b>${rub(rest)}</b></div></div>
        <div class="field"><label for="pay_sum">Получено</label><div class="inunit"><input class="input" id="pay_sum" inputmode="numeric" value="${rest}"><span>₽</span></div></div>
        <div class="seg" data-quick><button type="button" data-v="${Math.round(o.price.total / 2 / 100) * 100}">Предоплата 50%</button><button type="button" data-v="${rest}" class="is-on">Остаток</button></div>
      </div>`,
      foot: `<button class="btn btn--outline" data-close>Отмена</button><button class="btn btn--primary" data-ok>Отметить оплату</button>`,
      onMount(m, close) {
        $$('[data-quick] button', m).forEach(b => b.onclick = () => { $('#pay_sum', m).value = Math.min(+b.dataset.v, rest); $$('[data-quick] button', m).forEach(x => x.classList.toggle('is-on', x === b)); });
        $('[data-ok]', m).onclick = () => {
          const s = parseInt($('#pay_sum', m).value.replace(/\D/g, '')) || 0;
          if (s <= 0) return;
          Store.addPayment(o.id, s); close();
          UI.toast({ title: 'Оплата отмечена', text: `№${o.id} · ${rub(s)}`, icon: 'wallet', tone: 'ok', timeout: 3000 });
        };
      },
    });
  },
};
