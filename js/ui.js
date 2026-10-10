'use strict';
/* =========================================================
   Общие компоненты интерфейса: статусы, таймлайн, тосты,
   модальные окна, уведомления, чат по заказу
   ========================================================= */

const UI = {};

UI.pill = (o, side = 'admin') => {
  if (side === 'admin' && Store.isOverdue(o)) return `<span class="pill pill--red">Просрочен</span>`;
  const p = PH[phaseOf(o)];
  return `<span class="pill pill--${p.tone}">${side === 'client' ? p.client : p.label}</span>`;
};
UI.phasePill = (phase, side = 'admin') => `<span class="pill pill--${PH[phase].tone}">${side === 'client' ? PH[phase].client : PH[phase].label}</span>`;
UI.statusPill = (status, side = 'admin') => `<span class="pill pill--${ST[status].tone}">${side === 'client' ? ST[status].label : ST[status].short}</span>`;
/* прогресс по четырём шагам пути заказа */
UI.prog = o => { const i = PH[phaseOf(o)].i; return `<div class="prog" aria-label="${PH[phaseOf(o)].client}">${PHASES.map((p, k) => `<i class="${k < i || (k === i && p.key === 'done') ? 'on' : k === i ? 'cur' : ''}"></i>`).join('')}</div>`; };
UI.avatar = (name, cls = '') => `<span class="avatar ${cls}" aria-hidden="true">${esc(initials(name))}</span>`;
UI.days = n => n + ' ' + plural(n, 'рабочий день', 'рабочих дня', 'рабочих дней');
UI.clientName = c => (c.company && c.company !== 'Частный клиент' ? c.company : c.name);

/* стадии производства для карточек */
UI.stageDots = o => {
  const i = o.status === 'production' ? o.route.indexOf(o.stage) : ST[o.status].i > ST.production.i ? o.route.length : -1;
  return `<div class="sdots">${o.route.map((s, k) => `<i class="${k < i ? 'on' : k === i ? 'cur' : ''}" title="${SG[s].label}"></i>`).join('')}</div>`;
};

/* вертикальный таймлайн для клиента: Заявка → Принят → В работе → Готово */
UI.timeline = (o, justChanged) => {
  const cur = PH[phaseOf(o)].i;
  const when = { request: o.times.new || o.createdAt, new: o.times.confirmed, work: o.times.production, done: doneAt(o) };
  const hint = { request: 'менеджер проверяет параметры и стоимость', new: 'заказ в очереди производства', work: 'изготавливаем, готовность ' + fmtDate(o.deadline), done: 'можно забирать' };
  return `<ol class="timeline">${PHASES.map((p, i) => {
    const done = i < cur || (p.key === 'done' && i === cur);
    const isCur = i === cur && p.key !== 'done';
    let sub = (done || isCur) && when[p.key] ? fmtWhen(when[p.key]) : '';
    if (isCur) sub = hint[p.key];
    if (!done && !isCur && p.key === 'done') sub = 'ориентировочно ' + fmtDate(o.deadline);
    return `<li class="tl ${done ? 'done' : ''} ${isCur ? 'cur' : ''} ${justChanged && (isCur || (done && i === cur)) ? 'just' : ''}"><span class="tl__dot">${done ? icon('check', 14) : ''}</span><div><div class="tl__t">${p.client}</div>${sub ? `<div class="tl__s">${sub}</div>` : ''}</div></li>`;
  }).join('')}</ol>`;
};

/* ---------- тосты ---------- */
UI.toast = ({ title, text = '', icon: ic = 'bell', tone = '', onClick, timeout = 5000 }) => {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast__i ${tone}">${icon(ic, 18)}</span><div><b>${esc(title)}</b>${text ? `<p>${esc(text)}</p>` : ''}</div><button class="x" aria-label="Закрыть">${icon('x', 14)}</button>`;
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); };
  el.addEventListener('click', e => { if (!e.target.closest('.x') && onClick) onClick(); close(); });
  box.prepend(el);
  while (box.children.length > 4) box.lastElementChild.remove();
  if (timeout) setTimeout(close, timeout);
};

/* ---------- модальное окно ---------- */
UI.modal = ({ title, body, foot = '', onMount, wide }) => {
  const ov = $('#overlay');
  ov.innerHTML = `<div class="scrim"></div><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" ${wide ? 'style="width:min(640px,calc(100vw - 32px))"' : ''}><div class="modal__h"><h3>${esc(title)}</h3><button class="iconbtn" data-close aria-label="Закрыть">${icon('x', 18)}</button></div><div class="modal__b">${body}</div>${foot ? `<div class="modal__f">${foot}</div>` : ''}</div>`;
  const m = $('.modal', ov);
  const close = () => { ov.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  $('.scrim', ov).onclick = close;
  m.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  onMount?.(m, close);
  setTimeout(() => $('input,select,textarea,button.btn--primary', m)?.focus(), 50);
  return close;
};

/* ---------- уведомления ---------- */
UI.notifPanel = (anchor, side, go) => {
  const ov = $('#overlay');
  const list = Store.notifs(side).slice(0, 30);
  const r = anchor.getBoundingClientRect();
  const left = Math.max(12, Math.min(window.innerWidth - 392, r.right - 380));
  ov.innerHTML = `<div class="scrim" style="background:transparent"></div><div class="popover" style="top:${r.bottom + 8}px;left:${left}px">
    <div class="popover__h"><b>Уведомления</b><button class="btn btn--ghost btn--sm" data-readall>Прочитать все</button></div>
    ${list.length ? `<ul class="nlist">${list.map(n => {
      const meta = NOTIF[side][n.type] || { title: 'Уведомление', icon: 'bell' };
      return `<li class="nitem ${n.read ? '' : 'unread'} ${n.type === 'overdue' ? 'warn' : ''}" data-o="${n.orderId || ''}"><span class="ni">${icon(meta.icon, 17)}</span><div><b>${meta.title}${n.orderId ? ` · №${n.orderId}` : ''}</b><p>${esc(n.text)}</p><time>${fmtAgo(n.t)}</time></div></li>`;
    }).join('')}</ul>` : `<div class="empty">${icon('bell', 28)}Пока нет уведомлений</div>`}
  </div>`;
  const close = () => { ov.innerHTML = ''; };
  $('.scrim', ov).onclick = close;
  $('[data-readall]', ov).onclick = () => { Store.readNotifs(side); close(); };
  $$('.nitem', ov).forEach(li => li.onclick = () => {
    const id = li.dataset.o; close();
    const n = Store.notifs(side).find(x => String(x.orderId) === id); if (n) n.read = true;
    Store.commit({ type: 'read' });
    if (id) go(id);
  });
};
UI.unreadNotifs = side => Store.notifs(side).filter(n => !n.read).length;

/* показать свежие уведомления всплывающими сообщениями */
UI.showFresh = (side, go) => {
  const fresh = Store.flushFresh().filter(n => n.side === side && (side === 'admin' || n.clientId === ME));
  fresh.slice(-3).forEach(n => {
    const meta = NOTIF[side][n.type] || { title: 'Уведомление', icon: 'bell' };
    UI.toast({ title: meta.title + (n.orderId ? ` · №${n.orderId}` : ''), text: n.text, icon: meta.icon, tone: n.type === 'overdue' ? 'warn' : n.type === 'ready' || n.type === 'confirmed' ? 'ok' : '', onClick: n.orderId ? () => go(n.orderId) : null });
  });
};

/* ---------- файлы: превью картинок уменьшаем, чтобы влезали в хранилище ---------- */
UI.readFile = file => new Promise(resolve => {
  const base = { name: file.name, size: file.size, kind: file.type.startsWith('image/') ? 'image' : 'file' };
  if (base.kind !== 'image') return resolve(base);
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 560 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve({ ...base, url: c.toDataURL('image/jpeg', .72) });
    };
    img.onerror = () => resolve({ ...base, kind: 'file' });
    img.src = fr.result;
  };
  fr.onerror = () => resolve(base);
  fr.readAsDataURL(file);
});
UI.fileSize = b => b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' МБ' : Math.max(1, Math.round(b / 1024)) + ' КБ';
/* имитация загрузки с прогрессом */
UI.fakeUpload = (bar, done) => {
  let p = 0;
  const t = setInterval(() => { p = Math.min(100, p + 9 + Math.random() * 16); bar.style.width = p + '%'; if (p >= 100) { clearInterval(t); setTimeout(done, 150); } }, 90);
};

/* ---------- чат по заказу (клиент и цех) ---------- */
const Chat = {
  html(o, side, { page = false, ctx = true, quick = false } = {}) {
    const mgr = Store.person(o.managerId), client = Store.client(o.clientId);
    const head = side === 'client'
      ? `<div class="chat__h">${UI.avatar(mgr.name)}<div class="grow"><b>${esc(mgr.name)}</b><small>Менеджер · заказ №${o.id}</small></div><a class="iconbtn" href="tel:${mgr.phone.replace(/[^+\d]/g, '')}" aria-label="Позвонить">${icon('phone', 18)}</a></div>`
      : `<div class="chat__h">${UI.avatar(client.name)}<div class="grow"><b>${esc(client.name)}</b><small>${esc(client.company)}</small></div><a class="iconbtn" href="tel:${client.phone.replace(/[^+\d]/g, '')}" aria-label="Позвонить">${icon('phone', 18)}</a></div>`;
    const ctxBar = ctx ? `<a class="chat__ctx" href="${side === 'client' ? '#/app/order/' + o.id : '#/admin/order/' + o.id}">${icon('box', 16)}<span class="grow">№${o.id} · ${esc(o.title)}</span>${UI.pill(o, side === 'client' ? 'client' : 'admin')}</a>` : '';
    const qs = quick ? `<div class="quick">${['Когда будет готово?', 'Можно изменить размеры?', 'Нужна доставка', 'Пришлю эскиз'].map(q => `<button type="button" data-q="${q}">${q}</button>`).join('')}</div>` : '';
    return `<div class="chat ${page ? 'chat--page' : ''}" data-chat="${o.id}" data-side="${side}">${head}${ctxBar}<div class="chat__list">${Chat.list(o, side)}</div>${qs}
      <form class="composer"><input type="file" hidden multiple accept="image/*,.pdf,.dwg,.dxf,.zip,.doc,.docx,.xls,.xlsx"><button type="button" class="att" aria-label="Прикрепить файл">${icon('clip', 20)}</button><textarea rows="1" placeholder="${side === 'client' ? 'Сообщение менеджеру' : 'Сообщение клиенту'}"></textarea><button class="send" aria-label="Отправить">${icon('send', 18)}</button></form></div>`;
  },
  list(o, side) {
    if (!o.messages.length) return `<div class="empty" style="margin:auto">${icon('chat', 28)}Напишите, если нужно уточнить детали заказа</div>`;
    const mine = side === 'client' ? 'client' : 'manager';
    let lastFrom = null;
    return o.messages.map(m => {
      const cls = m.from === 'system' ? 'sys' : m.from === mine ? 'mine' : '';
      const who = m.from !== 'system' && m.from !== mine && lastFrom !== m.from ? `<span class="who">${esc(m.from === 'client' ? Store.client(o.clientId).name : Store.person(o.managerId).name)}</span>` : '';
      lastFrom = m.from;
      return `<div class="msg ${cls}" data-mid="${m.id}">${who}${Chat.body(m)}<time>${fmtWhen(m.t)}</time></div>`;
    }).join('');
  },
  body(m) {
    let h = '';
    if (m.file) {
      h += m.file.kind === 'image' && m.file.url
        ? `<a class="img" href="${m.file.url}" target="_blank" rel="noopener"><img src="${m.file.url}" alt="${esc(m.file.name)}"></a>`
        : `<div class="fchip"><span class="fi">${icon('file', 18)}</span><div><b class="small">${esc(m.file.name)}</b><small>${UI.fileSize(m.file.size || 0)}</small></div></div>`;
    }
    if (m.text) h += `<div class="bub">${esc(m.text)}</div>`;
    return h;
  },
  /* подключить обработчики к отрисованному чату */
  mount(root, o, side) {
    const el = $('[data-chat]', root) || root;
    const list = $('.chat__list', el), form = $('.composer', el), ta = $('textarea', form), file = $('input[type=file]', form);
    const from = side === 'client' ? 'client' : 'manager';
    let known = new Set(o.messages.map(m => m.id));
    const scroll = () => { list.scrollTop = list.scrollHeight; };
    scroll(); requestAnimationFrame(scroll);
    Store.markRead(o.id, side === 'client' ? 'client' : 'admin');

    const rerender = () => {
      const ord = Store.order(o.id); if (!ord) return;
      const typing = $('.typing-row', list);
      list.innerHTML = Chat.list(ord, side);
      $$('.msg', list).forEach(n => { if (!known.has(n.dataset.mid)) n.classList.add('new'); });
      known = new Set(ord.messages.map(m => m.id));
      if (typing) list.append(typing);
      scroll();
      Store.markRead(o.id, side === 'client' ? 'client' : 'admin');
    };
    const off = Store.on(e => {
      if (!el.isConnected) { off(); return; }
      if (e.type === 'message' || e.type === 'external' || e.type === 'order:status' || e.type === 'change') rerender();
    });

    const autosize = () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; };
    ta.addEventListener('input', autosize);
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const text = ta.value.trim(); if (!text) return;
      ta.value = ''; autosize();
      Store.sendMessage(o.id, from, text);
      if (side === 'client') Chat.autoReply(o.id, text, list);
    });
    $('.att', form).onclick = () => file.click();
    file.onchange = async () => {
      const files = [...file.files]; file.value = '';
      for (const f of files) {
        const tmp = document.createElement('div');
        tmp.className = 'msg mine new';
        tmp.innerHTML = `<div class="fchip"><span class="fi">${icon(f.type.startsWith('image/') ? 'image' : 'file', 18)}</span><div class="grow"><b class="small">${esc(f.name)}</b><small>Загрузка… ${UI.fileSize(f.size)}</small><div class="upbar"><i></i></div></div></div>`;
        if (side !== 'client') tmp.querySelector('.fchip').style.cssText = '';
        list.append(tmp); scroll();
        const data = await UI.readFile(f);
        await new Promise(r => UI.fakeUpload($('.upbar i', tmp), r));
        tmp.remove();
        Store.sendMessage(o.id, from, '', data);
        if (side === 'client') Chat.autoReply(o.id, '', list, true);
      }
    };
    $$('.quick button', el).forEach(b => b.onclick = () => { ta.value = b.dataset.q; ta.focus(); autosize(); });
  },
  /* демо: менеджер отвечает сам */
  autoReply(id, text, list, isFile) {
    clearTimeout(Chat._t1); clearTimeout(Chat._t2);
    Chat._t1 = setTimeout(() => {
      if (!list.isConnected) return;
      $('.typing-row', list)?.remove();
      const row = document.createElement('div'); row.className = 'msg typing-row new';
      row.innerHTML = `<span class="typing"><i></i><i></i><i></i></span>`;
      list.append(row); list.scrollTop = list.scrollHeight;
    }, 700);
    Chat._t2 = setTimeout(() => {
      $('.typing-row', list)?.remove();
      const o = Store.order(id); if (!o) return;
      const t = (text || '').toLowerCase();
      let r;
      if (isFile) r = 'Файл получила, спасибо. Передам технологу — если будут вопросы по размерам, напишу здесь.';
      else if (/когда|срок|готов/.test(t)) r = o.status === 'production' ? `Заказ сейчас на этапе «${SG[o.stage].label}». Готовность — ${fmtDate(o.deadline)}, идём по графику.` : `Ориентировочная готовность — ${fmtDate(o.deadline)}. Как только заказ пройдёт контроль, сразу сообщу.`;
      else if (/доставк|привез/.test(t)) r = 'Доставку организуем. Нажмите «Заказать доставку» в карточке заказа и выберите дату — или напишите адрес здесь.';
      else if (/размер|измен|поменя/.test(t)) r = o.status === 'production' || o.status === 'qc' ? 'Заказ уже в работе — уточню у мастера, можно ли внести изменение, и вернусь с ответом в течение 15 минут.' : 'Да, можно. Пришлите новые размеры — пересчитаю стоимость и обновлю заказ.';
      else if (/цен|стоим|дорог|скидк/.test(t)) r = `Сейчас стоимость ${rub(o.price.total)}. Если увеличите тираж или уберёте срочность, могу пересчитать дешевле.`;
      else if (/эскиз|чертеж|чертёж|файл/.test(t)) r = 'Присылайте, посмотрю. Подойдут фото, PDF, DXF или DWG.';
      else r = 'Получила, посмотрю и отвечу в течение 15 минут.';
      Store.sendMessage(id, 'manager', r);
    }, 2300);
  },
};

/* ---------- 3D в блоке ---------- */
UI.mount3d = (host, cat, params, extras, opts) => {
  if (!host) return null;
  if (!CATS[cat]?.view3d) {
    host.className = 'v3d';
    host.innerHTML = `<div class="v3d__msg"><div>${icon(cat === 'weld' ? 'c_weld' : 'image', 28)}${cat === 'weld' ? 'Для сварочных работ модель не нужна.<br>Приложите фото детали — так быстрее.' : 'Опишите изделие и приложите эскиз —<br>менеджер рассчитает стоимость.'}</div></div>`;
    host.style.cursor = 'default';
    return null;
  }
  const v = Viewer3D.create(host, opts);
  v.update(cat, params, extras);
  return v;
};

/* 3D-блок, который переживает перерисовку страницы (без повторной загрузки) */
UI.k3d = {};
UI.keep3d = (slot, key, cat, params, extras, opts) => {
  if (!slot) return null;
  const k = UI.k3d[key];
  if (k && k.viewer && !k.viewer.dead && k.cat === cat && CATS[cat]?.view3d) {
    slot.replaceWith(k.el); k.viewer.update(cat, params, extras); return k.viewer;
  }
  const el = document.createElement('div');
  slot.replaceWith(el);
  const viewer = UI.mount3d(el, cat, params, extras, opts);
  UI.k3d[key] = { el, viewer, cat };
  return viewer;
};

/* ---------- тема: светлая / тёмная ---------- */
const Theme = {
  KEY: 'tseh.theme',
  n: 0,
  mode() { const m = LS.get(Theme.KEY); return m === 'dark' || m === 'system' ? m : 'light'; }, // по умолчанию — светлая, как в фирменном стиле
  resolve(m = Theme.mode()) { return m === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : m; },
  current() { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; },
  /* кнопка: солнце, которое превращается в месяц */
  btn() {
    const id = 'ttm' + (++Theme.n), dark = Theme.current() === 'dark';
    const rays = [0, 45, 90, 135, 180, 225, 270, 315].map(a => {
      const r = a * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
      return `<line x1="${(12 + c * 7).toFixed(2)}" y1="${(12 + s * 7).toFixed(2)}" x2="${(12 + c * 9.3).toFixed(2)}" y2="${(12 + s * 9.3).toFixed(2)}"/>`;
    }).join('');
    return `<button class="iconbtn theme-btn" data-theme-toggle aria-pressed="${dark}" aria-label="${dark ? 'Включить светлую тему' : 'Включить тёмную тему'}" title="${dark ? 'Светлая тема' : 'Тёмная тема'}">
      <svg class="tt" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <mask id="${id}"><rect x="-4" y="-4" width="32" height="32" fill="#fff"/><circle class="tt-cut" cx="24.5" cy="-0.5" r="6.2" fill="#000"/></mask>
        <g mask="url(#${id})"><circle class="tt-core" cx="12" cy="12" r="4.3" fill="currentColor"/></g>
        <g class="tt-rays" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">${rays}</g>
      </svg></button>`;
  },
  apply(t) {
    document.documentElement.dataset.theme = t;
    $('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#141c27' : '#ffffff');
    $$('[data-theme-toggle]').forEach(b => {
      b.setAttribute('aria-pressed', t === 'dark');
      b.setAttribute('aria-label', t === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
      b.title = t === 'dark' ? 'Светлая тема' : 'Тёмная тема';
    });
    $$('[data-theme-mode]').forEach(b => { const on = b.dataset.themeMode === Theme.mode(); b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on); });
  },
  set(mode, origin) {
    LS.set(Theme.KEY, mode);
    const t = Theme.resolve(mode);
    if (t === Theme.current()) { Theme.apply(t); return; }
    Theme.animate(t, origin);
  },
  toggle(origin) { Theme.set(Theme.current() === 'dark' ? 'light' : 'dark', origin); },
  /* новая тема раскрывается кругом из точки нажатия */
  animate(t, origin) {
    const root = document.documentElement;
    if (REDUCED || !document.startViewTransition) {
      root.classList.add('theme-fade'); Theme.apply(t);
      clearTimeout(Theme._t); Theme._t = setTimeout(() => root.classList.remove('theme-fade'), 600);
      return;
    }
    const x = origin?.x ?? innerWidth - 48, y = origin?.y ?? 32;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = document.startViewTransition(() => Theme.apply(t));
    vt.ready.then(() => root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 720, easing: 'cubic-bezier(.65, 0, .35, 1)', pseudoElement: '::view-transition-new(root)' },
    )).catch(() => {});
  },
  init() {
    Theme.apply(Theme.resolve());
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (Theme.mode() === 'system') Theme.animate(Theme.resolve()); });
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-theme-toggle], [data-theme-mode]');
      if (!b) return;
      const r = b.getBoundingClientRect(), o = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      if (b.dataset.themeMode) Theme.set(b.dataset.themeMode, o); else Theme.toggle(o);
    });
    window.addEventListener('storage', e => { if (e.key === Theme.KEY) Theme.animate(Theme.resolve()); });
  },
  /* выбор темы в профиле и настройках */
  seg() {
    const m = Theme.mode();
    return `<div class="seg" role="radiogroup" aria-label="Оформление">${[['light', 'Светлая'], ['dark', 'Тёмная'], ['system', 'Как в системе']].map(([k, l]) => `<button type="button" role="radio" aria-checked="${m === k}" data-theme-mode="${k}" class="${m === k ? 'is-on' : ''}">${l}</button>`).join('')}</div>`;
  },
};

/* общий хелпер: сбросить обработчики контейнера страницы */
function resetHandlers(el) { ['onclick', 'oninput', 'onchange', 'onsubmit', 'onkeydown', 'ondragstart', 'ondragend', 'ondragover', 'ondragleave', 'ondrop', 'onfocusout'].forEach(k => { el[k] = null; }); }
