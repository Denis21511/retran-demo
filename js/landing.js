'use strict';
/* =========================================================
   Главная страница продукта
   ========================================================= */
const Landing = {
  render(root) {
    const o = Store.order(1048) || Store.s.orders.find(x => x.status === 'production');
    const queue = Store.s.orders.filter(x => ['new', 'work'].includes(phaseOf(x))).sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 3);
    const mgr = Store.person(o.managerId);
    const qcat = Landing.qc || (Landing.qc = { cat: 'kupe', params: defaultParams('kupe'), extras: [], urgent: false });
    root.innerHTML = `
    <header class="lhead"><div class="wrap">
      <a href="#/" class="logo" aria-label="Ретран — на главную">Ретран<i></i></a>
      <nav aria-label="Разделы"><button data-scroll="calc">Расчёт</button><button data-scroll="flow">Как это работает</button><button data-scroll="sides">Клиенту и вам</button></nav>
      <div class="actions">${Theme.btn()}<a class="btn btn--outline" href="#/admin">Панель «Ретран»</a><a class="btn btn--primary" href="#/app/new">Рассчитать мебель</a></div>
    </div></header>

    <main>
      <section class="hero"><div class="wrap">
        <div>
          <span class="eyebrow">${icon('factory', 15)}Демо для ООО «Ретран», Тула</span>
          <h1>Клиент сам считает кухню или шкаф-купе — вам приходит готовая заявка</h1>
          <p class="lead">Так может работать расчёт на ретран.рф: клиент вводит размеры, выбирает фасады и сразу видит цену и 3D-модель. Цены — ваши, меняются в разделе «Цены».</p>
          <div class="cta">
            <button class="btn btn--primary btn--lg" data-scroll="calc">${icon('ruble', 18)}Попробовать расчёт</button>
            <a class="btn btn--outline btn--lg" href="#/admin">${icon('inbox', 18)}Как видите заявки вы</a>
          </div>
          <div class="note"><span>${icon('check', 16)}Цена сразу, без ожидания</span><span>${icon('check', 16)}3D-модель изделия</span><span>${icon('check', 16)}Заявка с размерами — вам</span></div>
        </div>
        <div class="preview" aria-label="Пример карточки заказа">
          <div class="card">
            <div class="pv-order">
              <div class="top"><div><span class="mono muted small">Заказ №${o.id}</span><h3>${esc(o.title)}</h3></div>${UI.pill(o, 'client')}</div>
              <div class="pv-facts"><div><small>Стоимость</small><b>${rub(o.price.total)}</b></div><div><small>Готовность</small><b>${fmtDate(o.deadline)}</b></div><div><small>Менеджер</small><b>${esc(firstName(mgr.name))}</b></div></div>
              <div class="hsteps">${PHASES.map((s, i) => `<div class="hs ${i < PH[phaseOf(o)].i ? 'done' : i === PH[phaseOf(o)].i ? 'cur' : ''}">${s.key === 'request' ? 'Заявка' : s.key === 'new' ? 'Принят' : s.label}</div>`).join('')}</div>
            </div>
            <div class="pv-queue" style="border-top:1px solid var(--line)">
              <div class="pv-label"><span>Производственная очередь</span><span class="small" style="font-weight:500">сегодня</span></div>
              ${queue.map(q => `<div class="qrow"><span class="mono small">№${q.id}</span><div style="min-width:0"><b style="font-weight:500;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(q.title)}</b><small class="muted">срок ${fmtDate(q.deadline)}</small></div>${UI.pill(q)}</div>`).join('')}
            </div>
          </div>
        </div>
      </div></section>

      <section class="benefits" aria-label="Преимущества"><div class="wrap">
        <div class="benefit"><span class="bi">${icon('zap', 22)}</span><h3>Быстрый расчёт</h3><p>Клиент вводит размеры кухни или шкафа — стоимость и срок считаются сразу, по вашим ценам за м.п. и м².</p></div>
        <div class="benefit"><span class="bi">${icon('factory', 22)}</span><h3>Заявки не теряются</h3><p>Каждая заявка — с размерами, фасадами, ценой и телефоном. Видно, кому перезвонить и кто ждёт замер.</p></div>
        <div class="benefit"><span class="bi">${icon('layers', 22)}</span><h3>Все заказы в одном месте</h3><p>Заявка, расчёт, срок и статус — в карточке заказа, а не в WhatsApp и тетрадях.</p></div>
      </div></section>

      <section class="lsec" id="calc"><div class="wrap">
        <h2>Посчитайте, как клиент</h2>
        <p class="sub">Цены взяты с ретран.рф: кухни от 9 000 ₽ за м.п., шкафы-купе от 18 000 ₽. Их можно поправить в разделе «Цены» панели «Ретран».</p>
        <div class="calc-demo" data-qc>${Landing.qcHTML(qcat)}</div>
      </div></section>

      <section class="lsec" id="flow"><div class="wrap">
        <h2>От расчёта до сборки у клиента — пять шагов</h2>
        <p class="sub">Клиент и «Ретран» смотрят на один и тот же заказ. Каждый шаг виден обеим сторонам.</p>
        <ol class="flow">
          <li><b>Расчёт</b><span>Клиент вводит размеры и видит цену и 3D</span></li>
          <li><b>Заявка</b><span>Одна кнопка — заявка уже у вас</span></li>
          <li><b>Замер и договор</b><span>Вы уточняете размеры и принимаете заказ</span></li>
          <li><b>Производство</b><span>Раскрой, кромка, сборка — на доске</span></li>
          <li><b>Монтаж</b><span>Клиент видит, когда приедут собирать</span></li>
        </ol>
      </div></section>

      <section class="lsec" id="sides"><div class="wrap">
        <h2>Каждый видит то, что ему нужно</h2>
        <div class="sides">
          <div class="side">
            <div class="tag">Кабинет клиента</div><h3>Клиент видит</h3>
            <ul>${['цену и 3D-модель изделия до заказа', 'сколько стоит', 'когда будет готово', 'статус заказа: принят, в работе, готово'].map(t => `<li>${icon('check', 18)}${t}</li>`).join('')}</ul>
            <a class="btn btn--primary" href="#/app">Открыть кабинет клиента ${icon('arrow', 16)}</a>
          </div>
          <div class="side side--navy">
            <div class="tag">Панель «Ретран»</div><h3>Вы видите</h3>
            <ul>${['новые заявки с размерами и ценой', 'что в работе и что просрочено', 'что готово к монтажу', 'сколько заработано'].map(t => `<li>${icon('check', 18)}${t}</li>`).join('')}</ul>
            <a class="btn btn--outline" href="#/admin">Открыть панель «Ретран» ${icon('arrow', 16)}</a>
          </div>
        </div>
      </div></section>

      <section class="lsec lcta"><div class="wrap">
        <div>
          <h2>Сделано на «Цехе» за час — под ваш каталог</h2>
          <p class="sub">Это демо: заявки и цены хранятся только в вашем браузере. Нажмите «Отправить заявку» в расчёте и откройте панель — она уже там.</p>
        </div>
        <div class="row row--wrap"><a class="btn btn--primary btn--lg" href="#/app/new">Рассчитать мебель</a><a class="btn btn--outline btn--lg" href="#/admin">Открыть панель «Ретран»</a></div>
      </div></section>
    </main>
    <footer class="lfoot"><div class="wrap"><div class="row"><span class="logo" style="font-size:18px">Ретран<i></i></span><span>Мебель на заказ в Туле · работает на «Цехе»</span></div><span>Демо-версия · данные хранятся в этом браузере</span></div></footer>`;

    root.onclick = e => {
      const s = e.target.closest('[data-scroll]');
      if (s) { document.getElementById(s.dataset.scroll)?.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }); return; }
      Landing.qcClick(e, root);
    };
    root.oninput = e => Landing.qcInput(e, root);
    Landing.qcMount(root);
  },

  /* быстрый калькулятор на главной */
  qcHTML(q) {
    const P = Store.P;
    const c = calcOrder(q.cat, q.params, q.extras, q.urgent, P);
    const fields = CATS[q.cat].fields.filter(f => f.key !== 'contour' && fieldVisible(f, q.params));
    return `<div class="card card--pad">
        <div class="seg" style="margin-bottom:18px">${['kitchen', 'kupe', 'furniture'].map(k => `<button data-qcat="${k}" class="${q.cat === k ? 'is-on' : ''}">${CATS[k].label}</button>`).join('')}</div>
        <div class="fgrid">${fields.map((f, i) => Wizard.fieldHTML(f, q.params[f.key], i)).join('')}</div>
        <div class="row" style="margin-top:18px;gap:18px;flex-wrap:wrap">
          <label class="row" style="gap:10px;cursor:pointer"><span class="switch"><input type="checkbox" data-qx="closer" ${q.extras.includes('closer') ? 'checked' : ''}><span></span></span>Доводчики</label>
          <label class="row" style="gap:10px;cursor:pointer"><span class="switch"><input type="checkbox" data-qx="mount" ${q.extras.includes('mount') ? 'checked' : ''}><span></span></span>Сборка и установка</label>
        </div>
      </div>
      <div class="card" style="overflow:hidden">
        <div style="padding:12px 12px 0"><div data-qc3d></div></div>
        <div data-qcest>${Wizard.estimateHTML(c)}</div>
        <div style="padding:0 20px 20px"><button class="btn btn--primary btn--lg btn--block" data-qgo>Отправить заявку ${icon('arrow', 18)}</button></div>
      </div>`;
  },
  qcMount(root) {
    const q = Landing.qc, host = $('[data-qc3d]', root);
    if (host) Landing.v3d = UI.keep3d(host, 'landing', q.cat, q.params, q.extras, { small: true });
    const t = $('[data-total]', root); if (t) t._val = calcOrder(q.cat, q.params, q.extras, q.urgent, Store.P).total;
  },
  qcRefresh(root) {
    const q = Landing.qc;
    const c = calcOrder(q.cat, q.params, q.extras, q.urgent, Store.P);
    const lines = $('[data-lines]', root);
    if (lines) lines.innerHTML = Wizard.linesHTML(c);
    tweenNumber($('[data-total]', root), c.total);
    const dd = $('[data-days]', root); if (dd) dd.textContent = `Срок: ${UI.days(c.days)} · до ${fmtDate(c.deadline)}`;
    Landing.v3d?.update(q.cat, q.params, q.extras);
  },
  qcClick(e, root) {
    const q = Landing.qc, t = e.target;
    const cat = t.closest('[data-qcat]')?.dataset.qcat;
    if (cat && cat !== q.cat) {
      Landing.qc = { cat, params: defaultParams(cat), extras: q.extras, urgent: q.urgent };
      $('[data-qc]', root).innerHTML = Landing.qcHTML(Landing.qc); Landing.qcMount(root); return;
    }
    const seg = t.closest('[data-seg] button');
    if (seg && seg.closest('[data-qc]')) {
      const f = CATS[q.cat].fields.find(x => x.key === seg.parentElement.dataset.seg);
      q.params[f.key] = f.numeric ? +seg.dataset.v : seg.dataset.v;
      $$('button', seg.parentElement).forEach(b => b.classList.toggle('is-on', b === seg));
      Landing.qcRefresh(root); return;
    }
    const qty = t.closest('[data-qty]');
    if (qty && qty.closest('[data-qc]')) { q.params.qty = clamp((+q.params.qty || 1) + +qty.dataset.qty, 1, 9999); $('[data-qc] [data-f="qty"]', root).value = q.params.qty; Landing.qcRefresh(root); return; }
    if (t.closest('[data-qgo]')) {
      Wizard.draft(q.cat, q.params, q.extras);
      location.hash = '#/app/new';
    }
  },
  qcInput(e, root) {
    const q = Landing.qc, t = e.target;
    if (!t.closest('[data-qc]')) return;
    if (t.dataset.f) {
      const f = CATS[q.cat].fields.find(x => x.key === t.dataset.f);
      if (f.type === 'num' || f.type === 'qty') { const n = parseFloat(t.value.replace(',', '.')); if (!isNaN(n)) q.params[f.key] = f.type === 'qty' ? clamp(Math.round(n), 1, 9999) : clamp(n, f.min, f.max); }
      else q.params[f.key] = f.numeric ? +t.value : t.value;
    }
    if (t.dataset.qx) q.extras = t.checked ? [...new Set([...q.extras, t.dataset.qx])] : q.extras.filter(x => x !== t.dataset.qx);
    if (t.hasAttribute('data-qurg')) q.urgent = t.checked;
    Landing.qcRefresh(root);
  },
};
