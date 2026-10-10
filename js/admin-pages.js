'use strict';
/* =========================================================
   Панель цеха: производство, доска, календарь, клиенты,
   сотрудники, цены, оплаты, аналитика, настройки
   ========================================================= */
Object.assign(Admin, {

  /* ---------- производство (MVP): канбан Новые → В работе → Готово ---------- */
  KCOLS: [['new', 'Новые'], ['work', 'В работе'], ['done', 'Готово']],
  DONE_DAYS: 14, // в «Готово» показываем заказы за две недели, остальные — в «Заказах»
  production(view) {
    const os = Store.s.orders, since = Date.now() - Admin.DONE_DAYS * DAY;
    const cols = {
      new: os.filter(o => phaseOf(o) === 'new').sort((a, b) => a.deadline.localeCompare(b.deadline)),
      work: os.filter(o => phaseOf(o) === 'work').sort((a, b) => (Store.isOverdue(b) - Store.isOverdue(a)) || a.deadline.localeCompare(b.deadline)),
      done: os.filter(o => phaseOf(o) === 'done' && doneAt(o) >= since).sort((a, b) => doneAt(b) - doneAt(a)),
    };
    const card = (o, k) => {
      const late = Store.isOverdue(o);
      return `<div class="kcard ${Admin.isFresh(o) ? 'is-fresh' : ''}" draggable="true" data-id="${o.id}" tabindex="0" aria-label="Заказ №${o.id}, ${esc(o.title)}">
        <div class="no"><span>№${o.id}</span></div>
        <b>${esc(o.title)}</b>
        <div class="cl">${esc(Admin.clientLabel(o))}</div>
        <div class="m"><span class="${late ? 'late' : ''}">${k === 'done' ? 'готов ' + fmtDateShort(doneAt(o)) : late ? 'просрочен · ' + fmtDateShort(o.deadline) : 'срок ' + fmtDateShort(o.deadline)}</span><span class="sum">${rub(o.price.total)}</span></div>
        ${k !== 'done' ? `<button class="adv" data-adv="${o.id}" title="${k === 'new' ? 'Взять в работу' : 'Готово'}" aria-label="№${o.id}: ${k === 'new' ? 'взять в работу' : 'готово'}">${icon('right', 16)}</button>` : ''}
      </div>`;
    };
    view.innerHTML = `
      <p class="small muted" style="margin:-4px 0 14px">Перетащите карточку в другую колонку, чтобы сменить статус заказа. Стрелка на карточке — следующий шаг.</p>
      <div class="board3">${Admin.KCOLS.map(([k, t]) => `<div class="kcol kcol--${k}" data-col="${k}">
        <div class="kcol__h"><span>${t}</span><span class="count">${cols[k].length}</span></div>
        ${cols[k].map(o => card(o, k)).join('') || `<div class="kcol__empty">${k === 'new' ? 'Новых заказов нет.<br>Примите заявку — она появится здесь.' : 'Перетащите заказ сюда'}</div>`}
        ${k === 'done' ? `<a class="kcol__more" href="#/admin/orders?f=done">Все готовые заказы ${icon('right', 14)}</a>` : ''}
      </div>`).join('')}</div>`;
    view.onclick = e => {
      const adv = e.target.closest('[data-adv]');
      if (adv) { e.stopPropagation(); const id = +adv.dataset.adv; Admin.kmove(view, id, phaseOf(Store.order(id)) === 'new' ? 'work' : 'done'); return; }
      const c = e.target.closest('.kcard');
      if (c) location.hash = '#/admin/order/' + c.dataset.id;
    };
    view.onkeydown = e => { const c = e.target.closest?.('.kcard'); if (c && e.key === 'Enter') location.hash = '#/admin/order/' + c.dataset.id; };
    Admin.bindKanban(view);
  },
  kmove(view, id, to) {
    if (phaseOf(Store.order(id)) === to) return;
    flip(view, '.kcard', () => Admin.toPhase(id, to));
  },
  bindKanban(view) {
    let dragId = null;
    view.ondragstart = e => { const c = e.target.closest('.kcard'); if (!c) return; dragId = +c.dataset.id; e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; requestAnimationFrame(() => c.classList.add('dragging')); };
    view.ondragend = e => { e.target.closest?.('.kcard')?.classList.remove('dragging'); $$('.kcol.is-over', view).forEach(c => c.classList.remove('is-over')); dragId = null; };
    view.ondragover = e => { const col = e.target.closest('.kcol'); if (!col || dragId == null) return; e.preventDefault(); $$('.kcol.is-over', view).forEach(c => c !== col && c.classList.remove('is-over')); col.classList.add('is-over'); };
    view.ondragleave = e => { const col = e.target.closest('.kcol'); if (col && !col.contains(e.relatedTarget)) col.classList.remove('is-over'); };
    view.ondrop = e => {
      const col = e.target.closest('.kcol'); if (!col || dragId == null) return;
      e.preventDefault();
      const id = dragId; dragId = null;
      col.classList.remove('is-over');
      if (phaseOf(Store.order(id)) === col.dataset.col) { $(`.kcard[data-id="${id}"]`, view)?.classList.remove('dragging'); return; }
      Admin.kmove(view, id, col.dataset.col);
    };
  },

  /* ---------- производство (полная версия: этапы, контроль) — вне MVP ---------- */
  productionFull(view, q) {
    const mode = q.view === 'board' ? 'board' : 'today';
    const os = Store.s.orders;
    const prod = os.filter(o => o.status === 'production').sort((a, b) => (b.urgent - a.urgent) || a.deadline.localeCompare(b.deadline));
    const wait = os.filter(o => o.status === 'confirmed').sort((a, b) => a.deadline.localeCompare(b.deadline));
    const qc = os.filter(o => o.status === 'qc');
    view.innerHTML = `
      <div class="row row--between row--wrap" style="margin-bottom:18px;gap:12px">
        <div class="seg" style="max-width:100%;overflow-x:auto"><button data-mode="today" class="${mode === 'today' ? 'is-on' : ''}">${icon('factory', 16)} Сегодня в производстве</button><button data-mode="board" class="${mode === 'board' ? 'is-on' : ''}">${icon('board', 16)} Доска этапов</button></div>
        <div class="row small muted" style="gap:18px"><span><b style="color:var(--ink)">${prod.length}</b> в работе</span><span><b style="color:var(--ink)">${wait.length}</b> ждут запуска</span><span><b style="color:var(--ink)">${qc.length}</b> на контроле</span></div>
      </div>
      <div data-pbody>${mode === 'board' ? Admin.boardHTML() : Admin.todayHTML(prod, wait, qc)}</div>`;
    view.onclick = e => {
      const m = e.target.closest('[data-mode]');
      if (m) { location.hash = '#/admin/production' + (m.dataset.mode === 'board' ? '?view=board' : ''); return; }
      const done = e.target.closest('[data-done]');
      if (done) {
        const id = +done.dataset.done, o = Store.order(id);
        const prev = SG[o.stage].label;
        const last = o.route.indexOf(o.stage) === o.route.length - 1;
        Admin.flash = id;
        const run = () => flip(view, '.pcard', () => Store.completeStage(id));
        if (last && !REDUCED) { done.closest('.pcard').classList.add('leaving'); setTimeout(run, 380); } else run();
        const n = Store.order(id);
        UI.toast({ title: `№${id}: этап «${prev}» завершён`, text: last ? 'Передан на контроль качества' : 'Следующий этап: ' + SG[n.stage].label, icon: 'check', tone: 'ok', timeout: 2600 });
        return;
      }
      const launch = e.target.closest('[data-launch]');
      if (launch) { const id = +launch.dataset.launch; Admin.flash = id; flip(view, '.pcard', () => Store.setStatus(id, 'production')); UI.toast({ title: `№${id} запущен в производство`, icon: 'play', tone: 'ok', timeout: 2600 }); return; }
      const qcb = e.target.closest('[data-qc]');
      if (qcb) { const id = +qcb.dataset.qc; flip(view, '.pcard', () => Store.setStatus(id, 'ready')); UI.toast({ title: `№${id}: контроль пройден`, text: 'Клиент получил уведомление «Ваш заказ готов»', icon: 'shield', tone: 'ok', timeout: 2600 }); return; }
      const adv = e.target.closest('[data-adv]');
      if (adv) { e.stopPropagation(); Admin.advance(view, +adv.dataset.adv); return; }
      const card = e.target.closest('.kcard');
      if (card) location.hash = '#/admin/order/' + card.dataset.id;
    };
    if (mode === 'board') Admin.bindBoard(view);
    Admin.flash = null;
  },
  pcard(o, kind) {
    const c = Store.client(o.clientId), w = Store.workerOf(o) || Store.person('w1');
    const late = Store.isOverdue(o);
    const stageName = kind === 'prod' ? SG[o.stage].label : kind === 'qc' ? 'Контроль качества' : 'Ожидает запуска';
    return `<div class="pcard ${late ? 'is-late' : ''}" data-id="${o.id}">
      <div class="t"><div style="min-width:0"><span class="no">№${o.id} · ${esc(UI.clientName(c))}</span><h4>${esc(o.title)}</h4></div>${o.urgent ? '<span class="pill pill--amber pill--plain">срочно</span>' : late ? '<span class="pill pill--red">просрочен</span>' : ''}</div>
      <div class="props">
        <div><small>Количество</small>${o.params.qty || 1} шт</div>
        <div><small>Материал</small>${esc(materialLine(o.cat, o.params, Store.P))}</div>
        <div><small>Срок</small><span class="${late ? 'late' : ''}">${fmtDate(o.deadline)}</span></div>
        <div><small>Осталось</small><span class="${late ? 'late' : ''}">${relDeadline(o.deadline)}</span></div>
      </div>
      <div class="stage">
        <div class="sn"><span class="small muted">Текущий этап</span><b class="${Admin.flash === o.id ? 'flash' : ''}">${stageName}</b></div>
        ${UI.stageDots(o)}
        <div class="sdots-l">${o.route.map(s => `<span>${SG[s].short}</span>`).join('')}</div>
      </div>
      <div class="who">${UI.avatar(w.name, 'avatar--sm')}<div><div>${esc(w.name)}</div><small class="muted">${kind === 'wait' ? 'начнёт: ' + SG[o.route[0]].label.toLowerCase() : esc(w.role.toLowerCase())}</small></div></div>
      <div class="f">
        ${kind === 'prod' ? `<button class="btn btn--primary" data-done="${o.id}">${icon('check', 17)}Завершить этап</button>` : kind === 'qc' ? `<button class="btn btn--primary" data-qc="${o.id}">${icon('shield', 17)}Контроль пройден</button>` : `<button class="btn btn--accent" data-launch="${o.id}">${icon('play', 17)}Запустить</button>`}
        <a class="btn btn--outline btn--icon" href="#/admin/order/${o.id}" aria-label="Открыть заказ №${o.id}">${icon('right', 18)}</a>
      </div>
    </div>`;
  },
  todayHTML(prod, wait, qc) {
    const grp = (title, list, kind, ic) => `<section class="pgroup"><h3>${icon(ic, 18)}${title}<span class="count count--muted">${list.length}</span></h3>${list.length ? `<div class="pcards">${list.map(o => Admin.pcard(o, kind)).join('')}</div>` : `<div class="card empty" style="padding:22px">Пусто</div>`}</section>`;
    return `<div class="pgroups">${grp('В производстве', prod, 'prod', 'factory')}${grp('Ожидают запуска', wait, 'wait', 'clock')}${grp('Контроль качества', qc, 'qc', 'shield')}</div>`;
  },

  /* доска этапов с перетаскиванием */
  COLS: [['queue', 'Ожидают запуска'], ...STAGES.map(s => [s.key, s.label]), ['qc', 'Контроль'], ['ready', 'Готово']],
  colOf(o) { return o.status === 'confirmed' ? 'queue' : o.status === 'production' ? o.stage : o.status === 'qc' ? 'qc' : o.status === 'ready' ? 'ready' : null; },
  boardHTML() {
    const os = Store.s.orders.filter(o => Admin.colOf(o));
    return `<p class="small muted" style="margin:-6px 0 12px">Перетаскивайте карточки между этапами. Стрелка на карточке переводит заказ на следующий этап маршрута.</p>
    <div class="boardwrap"><div class="board">${Admin.COLS.map(([k, t]) => {
      const list = os.filter(o => Admin.colOf(o) === k).sort((a, b) => (b.urgent - a.urgent) || a.deadline.localeCompare(b.deadline));
      return `<div class="kcol ${k === 'queue' ? 'kcol--queue' : k === 'ready' ? 'kcol--done' : ''}" data-col="${k}"><div class="kcol__h"><span>${t}</span><span class="count">${list.length}</span></div>${list.map(o => {
        const w = Store.workerOf(o), late = Store.isOverdue(o);
        return `<div class="kcard ${o.urgent ? 'urgent' : ''}" draggable="true" data-id="${o.id}"><div class="no"><span>№${o.id}</span></div><b>${esc(o.title)}</b><div class="m"><span class="${late ? 'late' : ''}">${late ? 'просрочен' : fmtDateShort(o.deadline)}</span>${w ? UI.avatar(w.name, 'avatar--sm') : ''}</div>${k !== 'ready' ? `<button class="adv" data-adv="${o.id}" title="Следующий этап" aria-label="Перевести №${o.id} на следующий этап">${icon('right', 16)}</button>` : ''}</div>`;
      }).join('')}</div>`;
    }).join('')}</div></div>`;
  },
  advance(view, id) {
    const o = Store.order(id);
    let to;
    if (o.status === 'confirmed') to = o.route[0];
    else if (o.status === 'production') { const i = o.route.indexOf(o.stage); to = o.route[i + 1] || 'qc'; }
    else if (o.status === 'qc') to = 'ready';
    if (!to) return;
    flip(view, '.kcard', () => Store.moveOrder(id, to));
    UI.toast({ title: `№${id} → ${Admin.COLS.find(c => c[0] === to)[1]}`, icon: 'arrow', timeout: 2200 });
  },
  bindBoard(view) {
    let dragId = null;
    view.ondragstart = e => { const c = e.target.closest('.kcard'); if (!c) return; dragId = +c.dataset.id; e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; requestAnimationFrame(() => c.classList.add('dragging')); };
    view.ondragend = e => { e.target.closest?.('.kcard')?.classList.remove('dragging'); $$('.kcol.is-over', view).forEach(c => c.classList.remove('is-over')); };
    view.ondragover = e => { const col = e.target.closest('.kcol'); if (!col || dragId == null) return; e.preventDefault(); $$('.kcol.is-over', view).forEach(c => c !== col && c.classList.remove('is-over')); col.classList.add('is-over'); };
    view.ondragleave = e => { const col = e.target.closest('.kcol'); if (col && !col.contains(e.relatedTarget)) col.classList.remove('is-over'); };
    view.ondrop = e => {
      const col = e.target.closest('.kcol'); if (!col || dragId == null) return;
      e.preventDefault();
      const id = dragId, to = col.dataset.col; dragId = null;
      col.classList.remove('is-over');
      const o = Store.order(id);
      if (Admin.colOf(o) === to) { $(`.kcard[data-id="${id}"]`, view)?.classList.remove('dragging'); return; }
      flip(view, '.kcard', () => Store.moveOrder(id, to));
      UI.toast({ title: `№${id} → ${Admin.COLS.find(c => c[0] === to)[1]}`, text: o.title, icon: 'board', timeout: 2200 });
    };
  },

  /* ---------- календарь ---------- */
  calendar(view, q) {
    const base = q.m ? parseIso(q.m + '-01') : new Date(today0().getFullYear(), today0().getMonth(), 1);
    const y = base.getFullYear(), m = base.getMonth();
    const first = new Date(y, m, 1), start = addDays(first, -((first.getDay() + 6) % 7));
    const showShipped = q.all === '1';
    const os = Store.s.orders.filter(o => showShipped || o.status !== 'shipped');
    const byDay = {};
    os.forEach(o => (byDay[o.deadline] = byDay[o.deadline] || []).push(o));
    const tone = o => Store.isOverdue(o) ? 'red' : ST[o.status].tone === 'slate' ? 'slate' : ST[o.status].tone;
    const tIso = isoDate(today0());
    const mk = d => isoDate(d).slice(0, 7);
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i), iso = isoDate(d);
      if (i >= 35 && d.getMonth() !== m) break;
      const list = (byDay[iso] || []).sort((a, b) => ST[a.status].i - ST[b.status].i);
      const wd = d.getDay();
      cells.push(`<div class="cday ${d.getMonth() !== m ? 'out' : ''} ${wd === 0 || wd === 6 ? 'we' : ''} ${iso === tIso ? 'today' : ''}" data-day="${iso}"><div class="dn"><b>${d.getDate()}</b>${list.length ? `<small>${list.length} ${plural(list.length, 'заказ', 'заказа', 'заказов')}</small>` : ''}</div>${list.slice(0, 3).map(o => `<a class="chip t-${tone(o)}" draggable="true" data-id="${o.id}" href="#/admin/order/${o.id}" title="№${o.id} · ${esc(o.title)} · ${ST[o.status].short}"><span class="mono">${o.id}</span>${esc(o.title)}</a>`).join('')}${list.length > 3 ? `<button class="link small" style="text-align:left;padding:0 4px" data-more="${iso}">ещё ${list.length - 3}</button>` : ''}</div>`);
    }
    view.innerHTML = `
      <div class="calh">
        <h2>${MONTHS[m]} ${y}</h2>
        <a class="btn btn--outline btn--icon btn--sm" href="#/admin/calendar?m=${mk(new Date(y, m - 1, 1))}${showShipped ? '&all=1' : ''}" aria-label="Предыдущий месяц">${icon('left', 18)}</a>
        <a class="btn btn--outline btn--icon btn--sm" href="#/admin/calendar?m=${mk(new Date(y, m + 1, 1))}${showShipped ? '&all=1' : ''}" aria-label="Следующий месяц">${icon('right', 18)}</a>
        <a class="btn btn--ghost btn--sm" href="#/admin/calendar${showShipped ? '?all=1' : ''}">Сегодня</a>
        <label class="row small" style="margin-left:auto;gap:8px;cursor:pointer"><span class="switch"><input type="checkbox" data-all ${showShipped ? 'checked' : ''}><span></span></span>Показывать отгруженные</label>
      </div>
      <p class="small muted" style="margin:-4px 0 12px">Заказы стоят в дне готовности. Перетащите заказ на другой день, чтобы перенести срок.</p>
      <div class="cal">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => `<div class="wd">${d}</div>`).join('')}${cells.join('')}</div>
      <div class="legend">${[['blue', 'Новая заявка'], ['amber', 'Ждёт согласования'], ['slate', 'Ожидает запуска'], ['navy', 'В производстве'], ['violet', 'Контроль'], ['green', 'Готов'], ['red', 'Просрочен']].map(([t, l]) => `<span><i class="chip t-${t}" style="padding:0;width:12px;height:12px;border-left-width:12px"></i>${l}</span>`).join('')}</div>`;
    let dragId = null;
    view.ondragstart = e => { const c = e.target.closest('.chip'); if (!c) return; dragId = +c.dataset.id; e.dataTransfer.setData('text/plain', dragId); requestAnimationFrame(() => c.classList.add('dragging')); };
    view.ondragend = () => { $$('.chip.dragging', view).forEach(c => c.classList.remove('dragging')); $$('.cday.is-over', view).forEach(c => c.classList.remove('is-over')); };
    view.ondragover = e => { const d = e.target.closest('.cday'); if (!d || dragId == null) return; e.preventDefault(); $$('.cday.is-over', view).forEach(c => c !== d && c.classList.remove('is-over')); d.classList.add('is-over'); };
    view.ondrop = e => {
      const d = e.target.closest('.cday'); if (!d || dragId == null) return;
      e.preventDefault();
      const id = dragId; dragId = null;
      const o = Store.order(id); if (o.deadline === d.dataset.day) return;
      Store.setDeadline(id, d.dataset.day);
      UI.toast({ title: `Срок №${id} перенесён`, text: `${o.title} — на ${fmtDate(d.dataset.day)}`, icon: 'calendar', timeout: 2600 });
    };
    view.onchange = e => { if (e.target.hasAttribute('data-all')) location.hash = '#/admin/calendar?' + (q.m ? 'm=' + q.m + '&' : '') + (e.target.checked ? 'all=1' : ''); };
    view.onclick = e => {
      const more = e.target.closest('[data-more]');
      if (more) {
        const list = byDay[more.dataset.more];
        UI.modal({ title: 'Заказы на ' + fmtDate(more.dataset.more), body: `<div class="threads">${list.map(o => `<a class="thread" href="#/admin/order/${o.id}" style="grid-template-columns:56px 1fr auto"><span class="mono small">№${o.id}</span><div style="min-width:0"><b>${esc(o.title)}</b><p>${esc(Admin.clientLabel(o))}</p></div>${UI.pill(o)}</a>`).join('')}</div>`, onMount(mm, close) { mm.addEventListener('click', ev => { if (ev.target.closest('a')) close(); }); } });
      }
    };
  },

  /* ---------- клиенты ---------- */
  clientStats(c) {
    const os = Store.ordersOf(c.id);
    const sum = os.reduce((s, o) => s + (ST[o.status].i >= 2 ? o.price.total || 0 : 0), 0);
    return { os, n: os.length, sum, last: os[0] };
  },
  /* MVP: простой список — имя/компания, телефон, количество заказов, последний заказ */
  clients(view) {
    const term = (Admin.cliTerm || '').toLowerCase();
    let list = Store.s.clients.map(c => ({ c, ...Admin.clientStats(c) })).filter(x => x.n);
    if (term) list = list.filter(({ c }) => (c.name + c.company + c.phone).toLowerCase().includes(term));
    list.sort((a, b) => b.last.createdAt - a.last.createdAt);
    view.innerHTML = `<div class="card">
      <div class="row row--between row--wrap" style="padding:14px 16px;gap:10px"><div class="small muted">${list.length} ${plural(list.length, 'клиент', 'клиента', 'клиентов')}</div><input class="input input--sm" style="width:260px;max-width:100%" placeholder="Имя, компания или телефон" value="${esc(Admin.cliTerm || '')}" data-term aria-label="Поиск клиентов"></div>
      <div class="divider"></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Имя / компания</th><th>Телефон</th><th class="num">Заказов</th><th>Последний заказ</th></tr></thead>
        <tbody>${list.map(({ c, n, last }) => `<tr class="is-link" data-c="${c.id}"><td><div class="row" style="gap:10px">${UI.avatar(c.name, 'avatar--sm')}<div><div>${esc(c.name)}</div><div class="sub">${esc(c.company)}</div></div></div></td><td class="nowrap">${esc(c.phone)}</td><td class="num">${n}</td><td><div><span class="mono small">№${last.id}</span> ${esc(last.title)}</div><div class="sub">${fmtDate(isoDate(new Date(last.createdAt)))} · ${PH[phaseOf(last)].label.toLowerCase()}</div></td></tr>`).join('') || `<tr><td colspan="4" class="empty">Никого не нашли</td></tr>`}</tbody>
      </table></div></div>`;
    view.onclick = e => { const r = e.target.closest('[data-c]'); if (r) location.hash = '#/admin/client/' + r.dataset.c; };
    view.oninput = e => { if (!e.target.hasAttribute('data-term')) return; Admin.cliTerm = e.target.value; const p = e.target.selectionStart; Admin.clients(view); const i = $('[data-term]', view); i.focus(); i.setSelectionRange(p, p); };
  },
  client(view, id) {
    const c = Store.client(id);
    if (!c) { view.innerHTML = `<div class="card empty">Клиент не найден</div>`; return; }
    Admin.setNav('clients', c.name);
    const { os, n } = Admin.clientStats(c);
    const tel = c.phone.replace(/[^+\d]/g, '');
    view.innerHTML = `<a class="back" href="#/admin/clients">${icon('left', 16)}Клиенты</a>
    <div class="cgrid">
      <div class="card card--pad">
        <div class="row">${UI.avatar(c.name, 'avatar--lg avatar--navy')}<div><b style="font-size:18px">${esc(c.name)}</b><div class="small muted">${esc(c.company)}</div></div></div>
        <ul class="plist" style="margin-top:14px">
          <li><span>Телефон</span><span><a class="link" href="tel:${tel}">${esc(c.phone)}</a></span></li>
          ${c.email ? `<li><span>Email</span><span>${esc(c.email)}</span></li>` : ''}
          <li><span>Заказов</span><span>${n}</span></li>
          <li><span>Клиент с</span><span>${fmtDate(isoDate(new Date(c.createdAt)))}</span></li>
        </ul>
        <a class="btn btn--outline btn--block" style="margin-top:16px" href="tel:${tel}">${icon('phone', 17)}Позвонить</a>
      </div>
      <div class="card">
        <div class="card__h"><h3>История заказов</h3><span class="small muted">${n} ${plural(n, 'заказ', 'заказа', 'заказов')}</span></div>
        <div class="table-wrap" style="margin-top:8px"><table class="table">
          <thead><tr><th>№</th><th>Изделие</th><th>Дата</th><th class="num">Стоимость</th><th>Статус</th></tr></thead>
          <tbody>${os.map(o => `<tr class="is-link" data-o="${o.id}"><td class="mono nowrap">№${o.id}</td><td>${esc(o.title)}<div class="sub">${esc(specLine(o.cat, o.params, Store.P))}</div></td><td class="nowrap">${fmtDateShort(o.createdAt)}</td><td class="num">${o.price.total ? rub(o.price.total) : '—'}</td><td>${UI.pill(o)}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>
    </div>`;
    view.onclick = e => { const o = e.target.closest('[data-o]'); if (o) location.hash = Admin.href(Store.order(o.dataset.o)); };
  },

  /* ---------- сотрудники ---------- */
  staff(view) {
    const os = Store.s.orders;
    const active = o => ['new', 'calc', 'confirmed', 'production', 'qc', 'ready'].includes(o.status);
    const loadOf = s => s.kind === 'manager' ? os.filter(o => o.managerId === s.id && active(o)) : os.filter(o => (o.status === 'production' && s.stages?.includes(o.stage)) || (o.status === 'qc' && s.id === 'w1'));
    const max = Math.max(4, ...Store.s.staff.map(s => loadOf(s).length));
    view.innerHTML = `<div class="row row--between" style="margin-bottom:16px"><p class="small muted">Без кадрового учёта: только кто за что отвечает и сколько заказов у него сейчас.</p><button class="btn btn--primary" data-add>${icon('plus', 18)}Добавить сотрудника</button></div>
      <div class="sgrid">${Store.s.staff.map(s => { const l = loadOf(s); return `<div class="scard">
        <div class="row">${UI.avatar(s.name, s.kind === 'manager' ? 'avatar--navy' : '')}<div class="grow"><b>${esc(s.name)}</b><small>${esc(s.role)}</small></div><a class="iconbtn" href="tel:${s.phone.replace(/[^+\d]/g, '')}" aria-label="Позвонить">${icon('phone', 18)}</a></div>
        <div class="lb"><div class="row row--between small"><span class="muted">${s.kind === 'manager' ? 'Ведёт заказов' : 'Участок: ' + (s.stages || []).map(k => SG[k].label).join(', ') + (s.id === 'w1' ? ', контроль' : '')}</span><b>${l.length}</b></div><div class="bar"><i style="width:${l.length / max * 100}%"></i></div></div>
        ${l.length ? `<div class="row row--wrap" style="gap:6px;margin-top:12px">${l.slice(0, 6).map(o => `<a class="pill pill--plain" href="#/admin/order/${o.id}" style="font-family:var(--mono);font-size:12px">№${o.id}</a>`).join('')}${l.length > 6 ? `<span class="small muted">+${l.length - 6}</span>` : ''}</div>` : `<div class="small muted" style="margin-top:12px">Свободен</div>`}
      </div>`; }).join('')}</div>`;
    view.onclick = e => {
      if (!e.target.closest('[data-add]')) return;
      UI.modal({
        title: 'Новый сотрудник',
        body: `<div class="col" style="gap:14px"><div class="field"><label for="s_name">Имя и фамилия</label><input class="input" id="s_name"></div><div class="fgrid"><div class="field"><label for="s_role">Должность</label><input class="input" id="s_role" placeholder="Например, сварщик"></div><div class="field"><label for="s_stage">Участок</label><select class="select" id="s_stage">${STAGES.map(s => `<option value="${s.key}">${s.label}</option>`).join('')}</select></div></div><div class="field"><label for="s_phone">Телефон</label><input class="input" id="s_phone" type="tel"></div></div>`,
        foot: `<button class="btn btn--outline" data-close>Отмена</button><button class="btn btn--primary" data-ok>Добавить</button>`,
        onMount(m, close) {
          $('[data-ok]', m).onclick = () => {
            const name = $('#s_name', m).value.trim(); if (!name) { $('#s_name', m).focus(); return; }
            Store.addStaff({ name, role: $('#s_role', m).value.trim() || 'Рабочий', stages: [$('#s_stage', m).value], phone: $('#s_phone', m).value.trim() || '—' });
            close(); UI.toast({ title: 'Сотрудник добавлен', text: name, icon: 'user', tone: 'ok', timeout: 2500 });
          };
        },
      });
    };
  },

  /* ---------- услуги и цены ---------- */
  prices(view, q) {
    const P = Store.P;
    const grp = q.g && P.materials[q.g] ? q.g : 'kitchen';
    const row = (path, label, val, unit, sub = '', step = 1) => `<tr><td>${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</td><td><div class="pin"><input class="input input--sm" data-path="${path}" inputmode="decimal" value="${String(val).replace('.', ',')}" aria-label="${esc(label)}" data-step="${step}"><span>${esc(unit)}</span></div></td></tr>`;
    // MVP: три группы цен; правила округления, срочность и сроки остаются по умолчанию
    const work = Object.entries(P.work).filter(([k]) => k !== 'weld');
    view.innerHTML = `<div class="prgrid">
      <div class="col" style="gap:16px">
        <div class="demo-hint">${icon('zap', 18)}Калькулятор расчёта сразу использует эти цены. Изменения сохраняются автоматически. <span class="saved" data-saved>${icon('check', 14)}Сохранено</span></div>
        <div class="card">
          <div class="card__h"><h3>Стоимость материала</h3></div>
          <div class="tabs" style="padding:0 12px;margin-top:6px">${Object.entries(P.materials).map(([k, g]) => `<a href="#/admin/prices?g=${k}" class="${k === grp ? 'is-on' : ''}">${g.tab || g.label}</a>`).join('')}</div>
          <div class="card__b"><table class="ptable">${P.materials[grp].items.map((it, i) => row(`materials.${grp}.items.${i}.price`, it.label, it.price, P.materials[grp].unit, it.density ? `плотность ${String(it.density).replace('.', ',')} г/см³` : '')).join('')}</table></div>
        </div>
        <div class="card"><div class="card__h"><h3>Стоимость обработки</h3></div><div class="card__b"><table class="ptable">${work.map(([k, w]) => row(`work.${k}.price`, w.label, w.price, w.unit)).join('')}</table></div></div>
        <div class="card"><div class="card__h"><h3>Дополнительные работы</h3></div><div class="card__b"><table class="ptable">${Object.entries(P.extras).map(([k, x]) => row(`extras.${k}.price`, x.label, x.price, x.unit)).join('')}${row('extras.mount.min', 'Монтаж — минимум', P.extras.mount.min, '₽')}</table></div></div>
      </div>
      <div class="sticky">
        <div class="card">
          <div class="card__h" style="padding-top:18px"><h3>Проверка калькулятора</h3><span class="pill pill--blue pill--plain">пример</span></div>
          <div class="card__b">
            <div class="example">
              <div><span>Изделие</span><span>Каркас / рама</span></div>
              <div><span>Материал</span><span>Профтруба 40×40</span></div>
              <div><span>Размер</span><span>3000 × 1500 × 2400 мм</span></div>
              <div><span>Количество</span><span>1</span></div>
            </div>
            <div data-ex></div>
            <a class="btn btn--primary btn--lg btn--block" href="#/admin/new?cat=kupe" style="margin-top:4px">${icon('cube', 18)}Открыть расчёт</a>
          </div>
        </div>
      </div>
    </div>`;
    const ex = () => calcOrder('kupe', defaultParams('kupe'), [], false, Store.P);
    const exBox = $('[data-ex]', view);
    const drawEx = () => {
      const c = ex();
      const prev = $('[data-total]', exBox)?._val;
      exBox.innerHTML = `<ul class="elines">${c.lines.map(l => `<li><div>${l.label}<small>${esc(l.sub)}</small></div><span class="v">${rub(l.sum)}</span></li>`).join('')}</ul><div class="etotal" style="margin-bottom:14px"><small>Ориентировочная стоимость</small><div><span class="big" data-total>${rub(c.total)}</span></div><div class="small muted">Срок: ${UI.days(c.days)}</div></div>`;
      const t = $('[data-total]', exBox);
      if (prev != null && prev !== c.total) { t._val = prev; tweenNumber(t, c.total); } else t._val = c.total;
    };
    drawEx();
    let tm;
    view.oninput = e => {
      const t = e.target; if (!t.dataset.path) return;
      const v = parseFloat(t.value.replace(',', '.').replace(/[^\d.]/g, ''));
      if (isNaN(v) || v < 0) return;
      const path = t.dataset.path.split('.');
      let o = Store.P; path.slice(0, -1).forEach(k => { o = o[k]; });
      o[path[path.length - 1]] = path[0] === 'urgentK' ? Math.max(1, v) : path[0] === 'round' ? Math.max(1, Math.round(v)) : v;
      Store.save();
      drawEx();
      const s = $('[data-saved]', view); s.classList.add('on'); clearTimeout(tm); tm = setTimeout(() => s.classList.remove('on'), 1400);
    };
  },

  /* ---------- оплаты ---------- */
  payments(view, q) {
    const f = q.f || 'wait';
    const os = Store.s.orders.filter(o => ST[o.status].i >= 2 && o.price.total);
    const rest = o => o.price.total - Store.paid(o);
    const payState = o => { const p = Store.paid(o); return p >= o.price.total ? ['green', 'Оплачен'] : p > 0 ? ['amber', 'Частично'] : ['gray', 'Не оплачен']; };
    let list = os.filter(o => f === 'all' || (f === 'wait' ? rest(o) > 0 : rest(o) <= 0));
    list.sort((a, b) => (rest(b) > 0) - (rest(a) > 0) || ST[b.status].i - ST[a.status].i || b.id - a.id);
    const got = Store.revenue(Date.now() - 30 * DAY);
    const expect = os.filter(o => o.status !== 'shipped').reduce((s, o) => s + Math.max(0, rest(o)), 0);
    const debt = os.filter(o => ['ready', 'shipped'].includes(o.status)).reduce((s, o) => s + Math.max(0, rest(o)), 0);
    const lastPay = o => o.payments.length ? fmtDateShort(o.payments[o.payments.length - 1].t) : '—';
    view.innerHTML = `
      <div class="kpis3">
        <div class="kpi kpi--accent"><div class="kh">Получено за 30 дней ${icon('wallet', 18)}</div><div class="kv">${rub(got)}</div></div>
        <div class="kpi"><div class="kh">Ожидается по заказам в работе</div><div class="kv">${rub(expect)}</div></div>
        <div class="kpi"><div class="kh">Долг по готовым и отгруженным</div><div class="kv" style="color:${debt ? 'var(--red)' : 'inherit'}">${rub(debt)}</div></div>
      </div>
      <div class="card">
        <div class="tabs" style="padding:0 12px">${[['wait', 'Ожидают оплаты'], ['paid', 'Оплачены'], ['all', 'Все']].map(([k, t]) => `<a href="#/admin/payments?f=${k}" class="${k === f ? 'is-on' : ''}">${t}</a>`).join('')}</div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Заказ</th><th>Клиент</th><th class="num">Сумма</th><th class="num">Оплачено</th><th class="num">Остаток</th><th>Оплата</th><th>Последний платёж</th><th></th></tr></thead>
          <tbody>${list.map(o => { const [t, l] = payState(o), r = rest(o); return `<tr class="is-link" data-o="${o.id}"><td><span class="mono">№${o.id}</span><div class="sub">${esc(o.title)}</div></td><td>${esc(Admin.clientLabel(o))}</td><td class="num">${rub(o.price.total)}</td><td class="num">${rub(Store.paid(o))}</td><td class="num" style="font-weight:600;${r > 0 && ['ready', 'shipped'].includes(o.status) ? 'color:var(--red)' : ''}">${r > 0 ? rub(r) : '—'}</td><td><span class="pill pill--${t}">${l}</span></td><td class="nowrap">${lastPay(o)}</td><td>${r > 0 ? `<button class="btn btn--soft btn--sm" data-pay="${o.id}">Отметить оплату</button>` : ''}</td></tr>`; }).join('') || `<tr><td colspan="8" class="empty">Нет заказов</td></tr>`}</tbody>
        </table></div>
      </div>`;
    view.onclick = e => {
      const p = e.target.closest('[data-pay]'); if (p) { e.stopPropagation(); Admin.payModal(Store.order(p.dataset.pay)); return; }
      const r = e.target.closest('[data-o]'); if (r) location.hash = '#/admin/order/' + r.dataset.o;
    };
  },

  /* ---------- аналитика ---------- */
  analytics(view) {
    const os = Store.s.orders, now = Date.now(), from = now - 30 * DAY;
    const recent = os.filter(o => o.createdAt >= from);
    const priced = recent.filter(o => o.price.total);
    const avg = priced.length ? priced.reduce((s, o) => s + o.price.total, 0) / priced.length : 0;
    const newClients = Store.s.clients.filter(c => c.createdAt >= from).length;
    const active = os.filter(o => ['confirmed', 'production', 'qc'].includes(o.status)).length;
    const loadPct = Math.round(active / Store.s.settings.capacity * 100);
    const late = os.filter(o => Store.isOverdue(o));
    // выручка по неделям (12 недель)
    const w0 = today0(); w0.setDate(w0.getDate() - ((w0.getDay() + 6) % 7));
    const weeks = [];
    for (let i = 11; i >= 0; i--) { const s = addDays(w0, -7 * i); weeks.push({ s, sum: Store.revenue(s.getTime(), addDays(s, 7).getTime()) }); }
    const catCount = CAT_ORDER.map(k => [CATS[k].label, os.filter(o => o.cat === k && o.createdAt >= now - 90 * DAY).length]).filter(x => x[1]).sort((a, b) => b[1] - a[1]);
    const stageCount = STAGES.map(s => [s.label, os.filter(o => o.status === 'production' && o.stage === s.key).length]);
    stageCount.unshift(['Ожидают запуска', os.filter(o => o.status === 'confirmed').length]);
    stageCount.push(['Контроль', os.filter(o => o.status === 'qc').length]);
    const hb = (rows, fmt = v => v) => { const mx = Math.max(1, ...rows.map(r => r[1])); return `<div class="hbars">${rows.map(([l, v]) => `<div class="hbar"><span>${l}</span><div class="tr"><i style="width:${v / mx * 100}%"></i></div><span>${fmt(v)}</span></div>`).join('')}</div>`; };
    view.innerHTML = `
      <div class="agrid">
        <div class="kpi kpi--accent"><div class="kh">Выручка за месяц</div><div class="kv">${rub(Store.revenue(from))}</div><div class="ks">последние 30 дней</div></div>
        <div class="kpi"><div class="kh">Количество заказов</div><div class="kv">${recent.length}</div><div class="ks">за 30 дней</div></div>
        <div class="kpi"><div class="kh">Средний чек</div><div class="kv">${rub(avg)}</div><div class="ks">по заказам за 30 дней</div></div>
        <div class="kpi"><div class="kh">Новые клиенты</div><div class="kv">${newClients}</div><div class="ks">первый заказ за 30 дней</div></div>
        <div class="kpi"><div class="kh">Загрузка производства</div><div class="kv">${loadPct}%</div><div class="ks">${active} из ${Store.s.settings.capacity} мест</div></div>
        <a class="kpi" href="#/admin/orders?f=late"><div class="kh">Просроченные заказы</div><div class="kv" style="color:${late.length ? 'var(--red)' : 'inherit'}">${late.length}</div><div class="ks">${late.length ? late.map(o => '№' + o.id).join(', ') : 'все в срок'}</div></a>
      </div>
      <div class="charts">
        <div class="card wide"><div class="card__h"><h3>Выручка по неделям</h3><span class="small muted">поступления от клиентов, 12 недель</span></div><div class="card__b"><div class="chart" data-chart>${Admin.barChart(weeks)}</div></div></div>
        <div class="card"><div class="card__h"><h3>Заказы по видам работ</h3><span class="small muted">90 дней</span></div><div class="card__b">${hb(catCount)}</div></div>
        <div class="card"><div class="card__h"><h3>Загрузка участков</h3><span class="small muted">заказов сейчас</span></div><div class="card__b">${hb(stageCount)}</div></div>
      </div>`;
    // подсказка при наведении
    const ch = $('[data-chart]', view), tip = document.createElement('div'); tip.className = 'tip'; ch.append(tip);
    ch.onmousemove = e => {
      const b = e.target.closest('[data-w]');
      if (!b) { tip.classList.remove('on'); return; }
      const w = weeks[+b.dataset.w], r = ch.getBoundingClientRect(), br = b.getBoundingClientRect();
      tip.innerHTML = `${fmtDateShort(w.s)} – ${fmtDateShort(addDays(w.s, 6))}<br><b>${rub(w.sum)}</b>${+b.dataset.w === 11 ? ' · неделя идёт' : ''}`;
      tip.style.left = (br.left - r.left + br.width / 2) + 'px'; tip.style.top = (br.top - r.top) + 'px';
      tip.classList.add('on');
    };
    ch.onmouseleave = () => tip.classList.remove('on');
  },
  barChart(weeks) {
    const W = 1000, H = 250, pl = 52, pr = 8, pt = 12, pb = 28;
    const max = Math.max(1, ...weeks.map(w => w.sum));
    const step = Math.pow(10, Math.floor(Math.log10(max)));
    const top = Math.ceil(max / step / 2) * step * 2 || 1;
    const ticks = [0, .25, .5, .75, 1].map(k => k * top);
    const bw = (W - pl - pr) / weeks.length;
    const y = v => pt + (H - pt - pb) * (1 - v / top);
    const short = v => v >= 1e6 ? (v / 1e6).toFixed(1).replace('.', ',') + ' млн' : v >= 1e3 ? Math.round(v / 1e3) + ' тыс' : String(v);
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Выручка по неделям">
      <g class="grid">${ticks.map(t => `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}"/>`).join('')}</g>
      <g class="axis">${ticks.map(t => `<text x="${pl - 8}" y="${y(t) + 4}" text-anchor="end">${short(t)}</text>`).join('')}
      ${weeks.map((w, i) => true ? `<text x="${pl + bw * i + bw / 2}" y="${H - 8}" text-anchor="middle">${fmtDateShort(w.s)}</text>` : '').join('')}</g>
      ${weeks.map((w, i) => { const x = pl + bw * i + bw * .2, bwid = bw * .6, yy = y(w.sum), h = H - pb - yy; const r = Math.min(4, h); return `<g class="b" data-w="${i}"><rect class="hit" x="${pl + bw * i}" y="${pt}" width="${bw}" height="${H - pt - pb}"/>${w.sum ? `<path class="bar ${i === 11 ? 'cur' : ''}" d="M${x},${H - pb} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + bwid - r} Q${x + bwid},${yy} ${x + bwid},${yy + r} V${H - pb} Z"/>` : ''}</g>`; }).join('')}
    </svg>`;
  },

  /* ---------- настройки ---------- */
  settings(view) {
    const S = Store.s.settings;
    const link = location.href.split('#')[0] + '#/app/new';
    const tg = (side, k, t, s) => `<div class="trow"><div><b>${t}</b><small>${s}</small></div><label class="switch"><input type="checkbox" data-n="${side}.${k}" ${S.notify[side][k] !== false ? 'checked' : ''} aria-label="${t}"><span></span></label></div>`;
    view.innerHTML = `<div class="setgrid">
      <div class="col" style="gap:20px">
        <form class="card card--pad col" data-company style="gap:14px">
          <h3 style="font-size:16px">Компания</h3>
          <div class="field"><label for="s_c">Название</label><input class="input" id="s_c" name="company" value="${esc(S.company)}"></div>
          <div class="fgrid"><div class="field"><label for="s_p">Телефон</label><input class="input" id="s_p" name="phone" value="${esc(S.phone)}"></div><div class="field"><label for="s_h">Режим работы</label><input class="input" id="s_h" name="hours" value="${esc(S.hours)}"></div></div>
          <div class="field"><label for="s_a">Адрес цеха</label><input class="input" id="s_a" name="address" value="${esc(S.address)}"></div>
          <div class="field"><label for="s_cap">Сколько заказов цех ведёт одновременно</label><div class="inunit" style="max-width:200px"><input class="input" id="s_cap" name="capacity" inputmode="numeric" value="${S.capacity}"><span>шт</span></div><span class="small muted">Используется для расчёта загрузки производства</span></div>
          <div><button class="btn btn--primary">Сохранить</button></div>
        </form>
        <div class="card card--pad">
          <h3 style="font-size:16px;margin-bottom:8px">Ссылка для клиентов</h3>
          <p class="small muted" style="margin-bottom:12px">Разместите на сайте, в WhatsApp или в подписи письма — клиент сразу попадёт в расчёт заказа.</p>
          <div class="row"><input class="input" readonly value="${esc(link)}" data-link aria-label="Ссылка на расчёт"><button class="btn btn--outline" data-copy>${icon('copy', 17)}Копировать</button></div>
        </div>
      </div>
      <div class="col" style="gap:20px">
        <div class="card card--pad"><h3 style="font-size:16px;margin-bottom:12px">Оформление</h3>${Theme.seg()}<p class="small muted" style="margin-top:10px">Тёмная тема удобна вечером и в цеху с приглушённым светом. Выбор сохраняется в этом браузере.</p></div>
        <div class="card card--pad"><h3 style="font-size:16px;margin-bottom:4px">Уведомления владельцу</h3>
          ${tg('admin', 'new', 'Новая заявка', 'клиент отправил заказ')}${tg('admin', 'overdue', 'Заказ просрочен', 'срок готовности прошёл')}${tg('admin', 'slot', 'Освободился производственный слот', 'заказ вышел из производства')}${tg('admin', 'confirmed', 'Клиент подтвердил заказ', 'можно запускать в работу')}
        </div>
        <div class="card card--pad"><h3 style="font-size:16px;margin-bottom:4px">Уведомления клиентам</h3>
          ${tg('client', 'accepted', '«Ваш заказ принят»', 'сразу после отправки заявки')}${tg('client', 'calc', '«Расчёт готов»', 'когда менеджер подтвердил стоимость')}${tg('client', 'production', '«Заказ запущен в производство»', 'при запуске первого этапа')}${tg('client', 'ready', '«Ваш заказ готов»', 'после контроля качества')}
        </div>
        <div class="card card--pad"><h3 style="font-size:16px;margin-bottom:8px">Демо-данные</h3><p class="small muted" style="margin-bottom:12px">Вернуть заказы, клиентов и цены к исходному примеру.</p><button class="btn btn--danger" data-reset>Сбросить демо-данные</button></div>
      </div>
    </div>`;
    view.onsubmit = e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target).entries());
      Object.assign(S, { ...f, capacity: Math.max(1, parseInt(f.capacity) || S.capacity) });
      Store.commit({ type: 'settings' });
      $('.side-nav .org').textContent = S.company;
      UI.toast({ title: 'Настройки сохранены', icon: 'check', tone: 'ok', timeout: 2500 });
    };
    view.onchange = e => { const n = e.target.dataset.n; if (!n) return; const [side, k] = n.split('.'); S.notify[side][k] = e.target.checked; Store.commit({ type: 'settings' }); };
    view.onclick = e => {
      if (e.target.closest('[data-copy]')) { const i = $('[data-link]', view); i.select(); navigator.clipboard?.writeText(i.value).catch(() => document.execCommand('copy')); UI.toast({ title: 'Ссылка скопирована', icon: 'link', timeout: 2000 }); }
      if (e.target.closest('[data-reset]')) App.confirmReset();
    };
  },
});
