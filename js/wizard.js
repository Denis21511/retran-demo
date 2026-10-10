'use strict';
/* =========================================================
   Расчёт заказа — центральный экран продукта.
   Один экран: тип изделия → размеры → 3D и цена → «Отправить заявку».
   Используется в кабинете клиента и в панели цеха («Новый расчёт»).
   ========================================================= */
const Wizard = {
  /* в MVP — изделия, которые считаются автоматически и показываются в 3D */
  CATS: ['kitchen', 'kupe', 'furniture'],

  key(mode) { return 'retran.calc.' + mode; },
  fresh(mode, cat = 'kupe') {
    const me = Store.me();
    return { v: 2, step: 'calc', cat, params: defaultParams(cat), extras: [], urgent: false, contact: mode === 'client' ? { name: me.name, phone: me.phone, email: me.email } : {}, comment: '', files: [], clientId: mode === 'admin' ? '' : ME, newClient: null };
  },
  /* черновик из быстрого калькулятора на главной */
  draft(cat, params, extras) { SS.set(Wizard.key('client'), { ...Wizard.fresh('client', cat), params: { ...params }, extras: [...extras] }); },

  open(view, mode, q) {
    let d = SS.get(Wizard.key(mode));
    if (!d || d.v !== 2 || !Wizard.CATS.includes(d.cat) || d.step !== 'calc') d = Wizard.fresh(mode);
    if (q.cat && Wizard.CATS.includes(q.cat) && q.cat !== d.cat) { d.cat = q.cat; d.params = defaultParams(q.cat); d.extras = []; }
    if (q.client && mode === 'admin') d.clientId = q.client;
    if (q.cat || q.client) history.replaceState(null, '', mode === 'admin' ? '#/admin/new' : '#/app/new');
    Wizard.d = d; Wizard.mode = mode; Wizard.view = view;
    Wizard.render();
  },
  save() { SS.set(Wizard.key(Wizard.mode), { ...Wizard.d, files: [] }); },
  calc() { const d = Wizard.d; return calcOrder(d.cat, d.params, d.extras, false, Store.P); },

  render() {
    const { d, mode, view } = Wizard;
    resetHandlers(view);
    if (d.step === 'done') return Wizard.renderSuccess();
    $('.capp')?.classList.add('in-wizard');
    const c = Wizard.calc();
    const mobile = matchMedia('(max-width: 1080px)').matches;
    const cta = mode === 'admin' ? 'Создать заказ' : 'Отправить заявку';
    view.innerHTML = `
      <div class="wiz">
        <div class="wiz__main">
          <a class="back" href="${mode === 'admin' ? '#/admin' : '#/app'}">${icon('left', 16)}${mode === 'admin' ? 'Обзор' : 'Мои заказы'}</a>
          <div class="calc-h"><h1>Расчёт заказа</h1><p>${mode === 'admin' ? 'Посчитайте заказ, принятый по телефону, — он сразу попадёт в производство.' : 'Выберите изделие и укажите размеры — стоимость и 3D-модель обновятся сразу.'}</p></div>
          <section class="csec"><div class="section-title">Тип изделия</div>
            <div class="catgrid catgrid--row">${Wizard.CATS.map(k => `<button type="button" class="catbtn ${d.cat === k ? 'is-on' : ''}" data-cat="${k}" aria-pressed="${d.cat === k}"><span class="ci">${icon(CATS[k].icon, 20)}</span><div><b>${CATS[k].label}</b><span>${CATS[k].hint}</span></div></button>`).join('')}</div>
          </section>
          ${mobile ? `<div class="mobile-3d"><div data-3d></div></div>` : ''}
          <section class="csec"><div class="section-title">Параметры</div><div class="fgrid" data-fields>${Wizard.fieldsHTML()}</div></section>
          <section class="csec"><div class="section-title">Дополнительные работы <span class="opt">— по желанию</span></div><div class="xchips" data-xchips>${Wizard.extrasHTML()}</div></section>
        </div>
        <aside class="wiz__side">
          ${mobile ? '' : `<div class="card card-3d"><div data-3d></div></div>`}
          <div class="card"><div data-est>${Wizard.estimateHTML(c)}</div><div class="est-cta"><button class="btn btn--primary btn--lg btn--block" data-act="send">${icon(mode === 'admin' ? 'plus' : 'send', 18)}${cta}</button></div></div>
        </aside>
      </div>
      <div class="wbar">
        <div class="p"><small>Ориентировочно</small><b data-total-m>${rub(c.total)}</b></div>
        <button class="btn btn--primary btn--lg" data-act="send">${cta}</button>
      </div>`;
    const t = $('[data-total]', view); if (t) t._val = c.total;
    const tm = $('[data-total-m]', view); if (tm) tm._val = c.total;
    Wizard.v3d = UI.keep3d($('[data-3d]', view), 'wiz-' + mode + (mobile ? '-m' : ''), d.cat, d.params, d.extras);
    Wizard.bind();
  },

  fieldsHTML() {
    const d = Wizard.d;
    return CATS[d.cat].fields.filter(f => fieldVisible(f, d.params)).map((f, i) => Wizard.fieldHTML(f, d.params[f.key], i)).join('');
  },
  extrasHTML() {
    const { d } = Wizard, P = Store.P;
    return EXTRAS.filter(x => !isIncluded(d.cat, x.key)).map(x => {
      const on = d.extras.includes(x.key);
      return `<button type="button" class="xchip ${on ? 'is-on' : ''}" data-x="${x.key}" aria-pressed="${on}" title="${esc(x.hint)}"><span class="chk">${icon('check', 12)}</span>${P.extras[x.key].label}</button>`;
    }).join('');
  },
  fieldHTML(f, val, i) {
    const P = Store.P;
    const id = 'f_' + f.key;
    const full = f.type === 'seg' || f.type === 'textarea' || f.type === 'text' || (f.type === 'select' && i === 0);
    let ctl = '';
    if (f.type === 'select') ctl = `<select class="select" id="${id}" data-f="${f.key}">${f.opts(P).map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    if (f.type === 'seg') ctl = `<div class="seg" role="radiogroup" aria-label="${f.label}" data-seg="${f.key}">${f.opts(P).map(([v, l]) => `<button type="button" role="radio" aria-checked="${String(v) === String(val)}" class="${String(v) === String(val) ? 'is-on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>`;
    if (f.type === 'num') ctl = `<div class="inunit"><input class="input" id="${id}" data-f="${f.key}" inputmode="decimal" autocomplete="off" value="${String(val).replace('.', ',')}"><span>${f.unit}</span></div>`;
    if (f.type === 'qty') ctl = `<div class="stepper"><button type="button" data-qty="-1" aria-label="Меньше">${icon('minus', 18)}</button><input id="${id}" data-f="qty" inputmode="numeric" value="${val}" aria-label="Количество"><button type="button" data-qty="1" aria-label="Больше">${icon('plus', 18)}</button></div>`;
    if (f.type === 'text') ctl = `<input class="input" id="${id}" data-f="${f.key}" value="${esc(val)}" placeholder="${esc(f.placeholder || '')}">`;
    if (f.type === 'textarea') ctl = `<textarea class="textarea" id="${id}" data-f="${f.key}" placeholder="${esc(f.placeholder || '')}">${esc(val)}</textarea>`;
    return `<div class="field ${full ? 'full' : ''}">${f.type === 'seg' ? `<span class="label">${f.label}</span>` : `<label for="${id}">${f.label}</label>`}${ctl}${f.type === 'num' ? `<span class="small muted">от ${String(f.min).replace('.', ',')} до ${f.max} ${f.unit}</span>` : ''}</div>`;
  },

  /* ---------- сводка ---------- */
  estimateHTML(c, big) {
    const P = Store.P;
    if (!c) return `<div class="estimate"><h3>Расчёт стоимости</h3><p class="enote" style="margin-top:8px">Выберите, что нужно изготовить — стоимость появится здесь.</p></div>`;
    if (c.manual) return `<div class="estimate"><h3>Расчёт стоимости</h3><div class="etotal" style="border:0;margin-top:4px;padding-top:4px"><small>Ориентировочная стоимость</small><div><span class="big">от ${rub(P.minOrder)}</span></div></div><p class="enote">Для изделий по эскизу стоимость рассчитывает менеджер.</p></div>`;
    return `<div class="estimate">
      <h3>${big ? 'Состав расчёта' : 'Расчёт стоимости'} ${big ? '' : `<span class="small muted" style="font-weight:400">пересчитывается сразу</span>`}</h3>
      <ul class="elines" data-lines>${Wizard.linesHTML(c)}</ul>
      <div class="etotal"><small>Ориентировочная стоимость</small><div><span class="big" data-total>${rub(c.total)}</span></div><div class="small muted" data-days>Срок: ${UI.days(c.days)} · до ${fmtDate(c.deadline)}</div></div>
      <p class="enote">Финальную стоимость подтвердит менеджер, когда примет заказ.</p>
    </div>`;
  },
  linesHTML(c) { return c.lines.map(l => `<li data-k="${l.key}"><div>${l.label}<small>${esc(l.sub)}</small></div><span class="v">${rub(l.sum)}</span></li>`).join(''); },

  /* обновить цену и 3D без перерисовки формы */
  refresh() {
    const { d, view } = Wizard;
    const c = Wizard.calc();
    Wizard.save();
    const lines = $('[data-lines]', view);
    if (c && !c.manual && lines) {
      const keys = $$('li', lines).map(li => li.dataset.k).join();
      if (keys === c.lines.map(l => l.key).join()) c.lines.forEach(l => { const li = $(`li[data-k="${l.key}"]`, lines); $('small', li).textContent = l.sub; $('.v', li).textContent = rub(l.sum); });
      else lines.innerHTML = Wizard.linesHTML(c);
      tweenNumber($('[data-total]', view), c.total);
      $('[data-days]', view).textContent = `Срок: ${UI.days(c.days)} · до ${fmtDate(c.deadline)}`;
    }
    tweenNumber($('[data-total-m]', view), c.total);
    Wizard.v3d?.update(d.cat, d.params, d.extras);
  },
  setCat(cat) {
    const { d, view } = Wizard;
    if (d.cat === cat) return;
    d.cat = cat; d.params = defaultParams(cat); d.extras = d.extras.filter(x => !isIncluded(cat, x));
    $$('.catbtn', view).forEach(b => { b.classList.toggle('is-on', b.dataset.cat === cat); b.setAttribute('aria-pressed', b.dataset.cat === cat); });
    $('[data-fields]', view).innerHTML = Wizard.fieldsHTML();
    $('[data-xchips]', view).innerHTML = Wizard.extrasHTML();
    Wizard.refresh();
  },

  bind() {
    const { d, view } = Wizard;
    view.onclick = e => {
      const t = e.target;
      if (t.closest('[data-act="send"]')) { Wizard.sendModal(); return; }
      const cat = t.closest('[data-cat]')?.dataset.cat;
      if (cat) { Wizard.setCat(cat); return; }
      const seg = t.closest('[data-seg] button');
      if (seg) {
        const box = seg.parentElement, f = CATS[d.cat].fields.find(x => x.key === box.dataset.seg);
        d.params[f.key] = f.numeric ? +seg.dataset.v : seg.dataset.v;
        $$('button', box).forEach(b => { b.classList.toggle('is-on', b === seg); b.setAttribute('aria-checked', b === seg); });
        Wizard.refresh(); return;
      }
      const q = t.closest('[data-qty]');
      if (q) { d.params.qty = clamp((+d.params.qty || 1) + +q.dataset.qty, 1, 9999); $('[data-f="qty"]', view).value = d.params.qty; Wizard.refresh(); return; }
      const x = t.closest('[data-x]');
      if (x) {
        const k = x.dataset.x;
        d.extras = d.extras.includes(k) ? d.extras.filter(z => z !== k) : [...d.extras, k];
        x.classList.toggle('is-on', d.extras.includes(k)); x.setAttribute('aria-pressed', d.extras.includes(k));
        Wizard.refresh();
      }
    };
    view.oninput = e => {
      const t = e.target;
      if (!t.dataset.f) return;
      const f = CATS[d.cat].fields.find(x => x.key === t.dataset.f);
      if (f.type === 'num' || f.type === 'qty') {
        const n = parseFloat(t.value.replace(',', '.').replace(/[^\d.]/g, ''));
        if (!isNaN(n)) { d.params[f.key] = f.type === 'qty' ? clamp(Math.round(n), 1, 9999) : clamp(n, f.min, f.max); Wizard.refresh(); }
      } else { d.params[f.key] = f.numeric ? +t.value : t.value; Wizard.refresh(); }
    };
    view.onchange = e => {
      // поле «Открывание» есть только у окон — перерисовываем поля
      if (e.target.dataset.f === 'product' && d.cat === 'windows') $('[data-fields]', view).innerHTML = Wizard.fieldsHTML();
    };
    view.onfocusout = e => {
      const t = e.target;
      if (!t.dataset?.f) return;
      const f = CATS[d.cat].fields.find(x => x.key === t.dataset.f);
      if (f && (f.type === 'num' || f.type === 'qty')) t.value = String(d.params[f.key]).replace('.', ',');
    };
    view.onkeydown = e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); e.target.blur(); } };
  },

  /* ---------- отправка: контакты в модальном окне ---------- */
  contactHTML() {
    const d = Wizard.d;
    return `<div class="fgrid">
      <div class="field full" data-wrap="name"><label for="c_name">Имя</label><input class="input" id="c_name" data-c="name" autocomplete="name" value="${esc(d.contact.name || '')}"><span class="err hidden">Укажите имя</span></div>
      <div class="field full" data-wrap="phone"><label for="c_phone">Телефон</label><input class="input" id="c_phone" data-c="phone" type="tel" autocomplete="tel" value="${esc(d.contact.phone || '')}" placeholder="+7 900 000-00-00"><span class="err hidden">Нужен номер для связи</span></div>
      <div class="field full"><label for="c_comment">Комментарий <span class="muted">— необязательно</span></label><textarea class="textarea" id="c_comment" data-comment placeholder="Цвет покраски, сроки, особые требования">${esc(d.comment)}</textarea></div>
    </div>`;
  },
  clientHTML() {
    const d = Wizard.d;
    const cl = Store.s.clients.slice().sort((a, b) => a.name.localeCompare(b.name));
    const isNew = d.clientId === '__new';
    return `<div class="fgrid">
      <div class="field full" data-wrap="client"><label for="a_client">Клиент</label><select class="select" id="a_client" data-client><option value="">Выберите клиента</option><option value="__new" ${isNew ? 'selected' : ''}>+ Новый клиент</option>${cl.map(c => `<option value="${c.id}" ${d.clientId === c.id ? 'selected' : ''}>${esc(c.name)} — ${esc(c.company)}</option>`).join('')}</select><span class="err hidden">Выберите клиента</span></div>
      <div class="field ${isNew ? '' : 'hidden'}" data-newcli data-wrap="nname"><label for="n_name">Имя</label><input class="input" id="n_name" data-n="name" value="${esc(d.newClient?.name || '')}"><span class="err hidden">Укажите имя</span></div>
      <div class="field ${isNew ? '' : 'hidden'}" data-newcli data-wrap="nphone"><label for="n_phone">Телефон</label><input class="input" id="n_phone" data-n="phone" type="tel" value="${esc(d.newClient?.phone || '')}"><span class="err hidden">Укажите телефон</span></div>
      <div class="field full ${isNew ? '' : 'hidden'}" data-newcli><label for="n_company">Компания</label><input class="input" id="n_company" data-n="company" value="${esc(d.newClient?.company || '')}" placeholder="Необязательно"></div>
      <div class="field full"><label for="c_comment">Комментарий к заказу</label><textarea class="textarea" id="c_comment" data-comment>${esc(d.comment)}</textarea></div>
    </div>`;
  },
  sendModal() {
    const { d, mode } = Wizard, P = Store.P;
    const c = Wizard.calc();
    UI.modal({
      title: mode === 'admin' ? 'Создать заказ' : 'Отправить заявку',
      body: `<div class="example" style="margin-bottom:16px"><div><span>${esc(productTitle(d.cat, d.params, P))}</span><b>${rub(c.total)}</b></div><div><span>${esc(specLine(d.cat, d.params, P))}</span></div></div>${mode === 'admin' ? Wizard.clientHTML() : Wizard.contactHTML()}`,
      foot: `<button class="btn btn--outline" data-close>Отмена</button><button class="btn btn--primary" data-ok>${icon(mode === 'admin' ? 'plus' : 'send', 17)}${mode === 'admin' ? 'Создать заказ' : 'Отправить заявку'}</button>`,
      onMount(m, close) {
        m.addEventListener('input', e => {
          const t = e.target;
          if (t.dataset.c) { if (t.dataset.c === 'phone') t.value = Wizard.fmtPhone(t.value); d.contact[t.dataset.c] = t.value; }
          if (t.dataset.n) { if (t.dataset.n === 'phone') t.value = Wizard.fmtPhone(t.value); d.newClient = { ...(d.newClient || {}), [t.dataset.n]: t.value }; }
          if (t.hasAttribute('data-comment')) d.comment = t.value;
          const f = t.closest('.field'); f?.classList.remove('is-error'); $('.err', f || m)?.classList.add('hidden');
          Wizard.save();
        });
        m.addEventListener('change', e => {
          if (!e.target.hasAttribute('data-client')) return;
          d.clientId = e.target.value; Wizard.save();
          $$('[data-newcli]', m).forEach(x => x.classList.toggle('hidden', d.clientId !== '__new'));
          e.target.closest('.field').classList.remove('is-error'); $('[data-wrap="client"] .err', m).classList.add('hidden');
        });
        $('[data-ok]', m).onclick = e => { if (!Wizard.validate(m)) return; Wizard.send(e.currentTarget, close); };
        m.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); $('[data-ok]', m).click(); } });
      },
    });
  },
  validate(m) {
    const { d, mode } = Wizard;
    let ok = true;
    const bad = (w, cond) => { const el = $(`[data-wrap="${w}"]`, m); if (!el) return; el.classList.toggle('is-error', cond); $('.err', el).classList.toggle('hidden', !cond); if (cond && ok) { $('input,select', el).focus(); ok = false; } };
    if (mode === 'client') {
      bad('name', !(d.contact.name || '').trim());
      bad('phone', (d.contact.phone || '').replace(/\D/g, '').length < 10);
    } else {
      bad('client', !d.clientId);
      if (d.clientId === '__new') { bad('nname', !(d.newClient?.name || '').trim()); bad('nphone', (d.newClient?.phone || '').replace(/\D/g, '').length < 10); }
    }
    return ok;
  },
  fmtPhone(v) {
    let s = v.replace(/\D/g, '');
    if (!s) return '';
    if (s[0] === '8') s = '7' + s.slice(1);
    if (s[0] !== '7') s = '7' + s;
    s = s.slice(0, 11);
    const p = [s.slice(1, 4), s.slice(4, 7), s.slice(7, 9), s.slice(9, 11)];
    return '+7' + (p[0] ? ' ' + p[0] : '') + (p[1] ? ' ' + p[1] : '') + (p[2] ? '-' + p[2] : '') + (p[3] ? '-' + p[3] : '');
  },
  send(btn, close) {
    const { d, mode } = Wizard;
    btn.disabled = true; btn.textContent = 'Отправляем…';
    setTimeout(() => {
      close();
      const o = Store.createOrder({ ...d, urgent: false, clientId: d.clientId === '__new' ? null : d.clientId, newClient: d.clientId === '__new' ? d.newClient : null }, mode);
      SS.del(Wizard.key(mode));
      if (mode === 'admin') {
        UI.toast({ title: `Заказ №${o.id} создан`, text: `${rub(o.price.total)} · в колонке «Новые» на доске производства`, icon: 'check', tone: 'ok' });
        location.hash = '#/admin/order/' + o.id;
        return;
      }
      d.step = 'done'; d.createdId = o.id;
      Wizard.render();
    }, 400);
  },

  /* ---------- заявка отправлена ---------- */
  renderSuccess() {
    const { d, view } = Wizard;
    const o = Store.order(d.createdId);
    if (!o) { Wizard.d = Wizard.fresh(Wizard.mode); return Wizard.render(); }
    $('.capp')?.classList.remove('in-wizard');
    view.innerHTML = `<div class="success">
      <div class="ok">${icon('check', 34)}</div>
      <h1>Заявка №${o.id} отправлена</h1>
      <p class="muted" style="margin-top:6px">Менеджер проверит расчёт и примет заказ. Статус будет обновляться в разделе «Мои заказы».</p>
      <div class="card">
        <div class="card__b">
          <dl class="kv">
            <dt>Изделие</dt><dd>${esc(o.title)}</dd>
            <dt>Ориентировочная стоимость</dt><dd>${rub(o.price.total)}</dd>
            <dt>Готовность</dt><dd>до ${fmtDate(o.deadline)}</dd>
            <dt>Статус</dt><dd>${UI.pill(o, 'client')}</dd>
          </dl>
        </div>
      </div>
      <div class="row" style="justify-content:center;margin-top:20px;flex-wrap:wrap">
        <a class="btn btn--primary btn--lg" href="#/app/order/${o.id}">Открыть заказ</a>
        <a class="btn btn--outline btn--lg" href="#/app">Мои заказы</a>
      </div>
    </div>`;
    window.scrollTo(0, 0);
  },
};
