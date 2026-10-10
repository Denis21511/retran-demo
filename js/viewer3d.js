'use strict';
/* =========================================================
   3D-превью изделия. Небольшая функциональная модель:
   размеры меняются вместе с параметрами в форме.
   ========================================================= */
const Viewer3D = (() => {
  let T = null, loading = null, ENV = null;
  function load() {
    if (!loading) loading = import('three').then(async m => {
      T = m;
      try { const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'); ENV = RoomEnvironment; } catch (e) { ENV = null; }
      return T;
    }).catch(() => null);
    return loading;
  }

  const ANIM_KEYS = ['length', 'width', 'height', 'depth', 'thickness', 'seam'];

  function create(host, opts = {}) {
    const v = { host, opts, target: null, cur: null, key: '', ready: false, dead: false, theta: .72, phi: .42, idleAt: 0, visible: true };
    host.classList.add('v3d');
    if (opts.small) host.classList.add('v3d--sm');
    host.innerHTML = `<div class="v3d__msg">${icon('cube', 28)}Загрузка 3D-модели…</div><div class="v3d__cap"><b></b><span>Потяните, чтобы повернуть</span></div>`;
    v.cap = $('b', host);
    v.update = (cat, params, extras) => {
      v.target = { cat, p: { ...params }, extras: [...(extras || [])] };
      v.cap.textContent = caption(cat, params);
      if (v.ready) v.dirty = true;
    };
    load().then(TT => {
      if (!TT || !host.isConnected) { if (host.isConnected) $('.v3d__msg', host).innerHTML = `${icon('cube', 28)}3D-просмотр недоступен в этом браузере`; return; }
      try { init(v); } catch (e) { console.warn(e); $('.v3d__msg', host).textContent = '3D-просмотр недоступен'; }
    });
    return v;
  }

  function caption(cat, p) {
    if (!p) return '';
    switch (cat) {
      case 'laser': return `${p.length} × ${p.width} × ${String(p.thickness).replace('.', ',')} мм`;
      case 'metal': return `${p.length} × ${p.width} × ${p.height} мм`;
      case 'sign': return `${p.width} × ${p.height} мм`;
      case 'furniture': case 'kupe': return `${p.width} × ${p.height} × ${p.depth} мм`;
      case 'kitchen': return kitchenSize(p);
      case 'glass': return `${p.length} × ${p.width} × ${p.thickness} мм`;
      case 'windows': return `${p.width} × ${p.height} мм`;
      default: return '';
    }
  }

  function init(v) {
    const host = v.host;
    const r = new T.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.setClearColor(0xf4f6f8, 1);
    r.outputColorSpace = T.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFSoftShadowMap;
    $('.v3d__msg', host).remove();
    host.prepend(r.domElement);
    const scene = new T.Scene();
    if (ENV) { const pm = new T.PMREMGenerator(r); scene.environment = pm.fromScene(new ENV(), .04).texture; pm.dispose(); }
    scene.add(new T.HemisphereLight(0xffffff, 0xdfe5ec, .55));
    const sun = new T.DirectionalLight(0xffffff, 1.5);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -.0004; sun.shadow.radius = 4;
    scene.add(sun, sun.target);
    const ground = new T.Mesh(new T.PlaneGeometry(200, 200), new T.ShadowMaterial({ opacity: .13 }));
    v.ground = ground;
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const grid = new T.GridHelper(1, 24, 0xd5dbe2, 0xe3e7ec); grid.position.y = .0005; scene.add(grid);
    const cam = new T.PerspectiveCamera(32, 1, .01, 300);

    const M = (o) => new T.MeshStandardMaterial({ envMapIntensity: .7, ...o });
    v.mats = {
      steel: M({ color: 0x939ca6, metalness: .6, roughness: .4 }),
      powder: M({ color: 0x3a4149, metalness: .25, roughness: .55 }),
      stainless: M({ color: 0xc9d0d6, metalness: .8, roughness: .25 }),
      alu: M({ color: 0xd2d7dc, metalness: .55, roughness: .32 }),
      zinc: M({ color: 0xb2bbc3, metalness: .65, roughness: .38 }),
      ldsp: M({ color: 0xe6dfd2, roughness: .8 }),
      oak: M({ color: 0xb2875a, roughness: .65 }),
      pine: M({ color: 0xdcb88a, roughness: .7 }),
      carcass: M({ color: 0xefece6, roughness: .8 }),
      film: M({ color: 0xd9cbb6, roughness: .5 }),
      plastic: M({ color: 0xf6f6f4, roughness: .15, metalness: .05 }),
      enamel: M({ color: 0x7d8f86, roughness: .35 }),
      lacobel: M({ color: 0x2e3a46, roughness: .08, metalness: .2 }),
      stone: M({ color: 0xe9e6e1, roughness: .25 }),
      kmirror: M({ color: 0xd3dde4, metalness: .45, roughness: .08, envMapIntensity: 1.4 }),
      mdf: M({ color: 0xcfd6dd, roughness: .55 }),
      loftWood: M({ color: 0x96693f, roughness: .7 }),
      black: M({ color: 0x2b2f34, metalness: .4, roughness: .5 }),
      counter: M({ color: 0x585e66, roughness: .4 }),
      glass: M({ color: 0x9cc9e2, transparent: true, opacity: .32, roughness: .04, metalness: .15, depthWrite: false }),
      mirror: M({ color: 0xe4eaef, metalness: .95, roughness: .06, envMapIntensity: 1.2 }),
      poly: M({ color: 0xcfe2ee, transparent: true, opacity: .55, roughness: .3, depthWrite: false }),
      pvc: M({ color: 0xf5f6f7, roughness: .45 }),
      wall: M({ color: 0xe9ecef, roughness: .95 }),
      navySide: M({ color: 0x1b2f47, metalness: .3, roughness: .45 }),
      composite: M({ color: 0xf2f3f5, metalness: .2, roughness: .4 }),
      doorMetal: M({ color: 0x3c424a, metalness: .4, roughness: .5 }),
      handle: M({ color: 0x24282d, metalness: .7, roughness: .3 }),
      hole: M({ color: 0x1d2228, roughness: .9 }),
      wood: M({ color: 0xc89e6d, roughness: .7 }),
      glow: new T.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, depthWrite: false }),
      face: M({ color: 0xffffff, roughness: .35, emissive: 0xffffff, emissiveIntensity: 0 }),
      faceDark: M({ color: 0x24303d, metalness: .5, roughness: .35 }),
    };
    v.lineMats = {};
    v.unitBox = new T.BoxGeometry(1, 1, 1);
    v.unitEdges = new T.EdgesGeometry(v.unitBox);
    v.unitPlane = new T.PlaneGeometry(1, 1);
    v.pool = []; v.ppool = [];
    v.group = new T.Group(); scene.add(v.group);
    Object.assign(v, { r, scene, cam, sun, grid, center: new T.Vector3(0, .5, 0), dist: 4, tCenter: new T.Vector3(0, .5, 0), tDist: 4 });

    const ro = new ResizeObserver(() => resize(v)); ro.observe(host); v.ro = ro;
    const io = new IntersectionObserver(es => { v.visible = es[0].isIntersecting; }); io.observe(host); v.io = io;
    resize(v);

    // поворот мышью / пальцем
    let drag = null;
    r.domElement.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; v.idleAt = performance.now() + 5000; });
    window.addEventListener('pointermove', v.onMove = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (e.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx) * 1.2 && !drag.lock) return; // даём прокручивать страницу
      drag.lock = true;
      v.theta -= dx * .009; v.phi = clamp(v.phi + dy * .006, .05, 1.35);
      drag.x = e.clientX; drag.y = e.clientY; v.idleAt = performance.now() + 5000;
    });
    window.addEventListener('pointerup', v.onUp = () => { drag = null; });

    v.ready = true; v.dirty = true;
    const loop = () => {
      if (!host.isConnected) { dispose(v); return; }
      v.raf = requestAnimationFrame(loop);
      if (!v.visible || !v.target) return;
      step(v);
      r.render(scene, cam);
    };
    loop();
  }

  function resize(v) {
    const w = v.host.clientWidth || 300, h = v.host.clientHeight || 200;
    v.r.setSize(w, h, false); v.cam.aspect = w / h; v.cam.updateProjectionMatrix();
  }

  function dispose(v) {
    if (v.dead) return; v.dead = true;
    cancelAnimationFrame(v.raf);
    v.ro?.disconnect(); v.io?.disconnect();
    window.removeEventListener('pointermove', v.onMove); window.removeEventListener('pointerup', v.onUp);
    Object.values(v.mats).forEach(m => { m.map?.dispose(); m.alphaMap?.dispose(); m.dispose(); });
    (v.extraMats || []).forEach(m => m.dispose());
    v.r.dispose(); v.r.forceContextLoss?.();
  }

  /* цвета сцены под светлую или тёмную тему */
  function themeScene(v) {
    const dark = document.documentElement.dataset.theme === 'dark';
    const bg = getComputedStyle(v.host).backgroundColor;
    try { v.r.setClearColor(new T.Color().setStyle(bg), 1); } catch (e) { v.r.setClearColor(dark ? 0x0c121a : 0xf4f6f8, 1); }
    const g = new T.GridHelper(1, 24, dark ? 0x2c3a4e : 0xd5dbe2, dark ? 0x1b2533 : 0xe3e7ec);
    g.scale.copy(v.grid.scale); g.position.copy(v.grid.position);
    v.scene.remove(v.grid); v.grid.geometry.dispose(); v.grid.material.dispose();
    v.scene.add(g); v.grid = g;
    v.ground.material.opacity = dark ? .4 : .13;
  }

  /* плавное изменение размеров */
  function step(v) {
    const th = document.documentElement.dataset.theme;
    if (th !== v.theme) { v.theme = th; themeScene(v); }
    const t = v.target;
    const key = t.cat + '|' + JSON.stringify({ ...t.p, length: 0, width: 0, height: 0, depth: 0, thickness: 0, seam: 0 }) + '|' + t.extras.join();
    if (!v.cur || v.cur.cat !== t.cat) { v.cur = { cat: t.cat, p: { ...t.p } }; v.key = ''; }
    let moving = false;
    ANIM_KEYS.forEach(k => {
      if (typeof t.p[k] !== 'number') return;
      const a = +v.cur.p[k] || t.p[k], b = t.p[k];
      if (Math.abs(a - b) > Math.max(.5, Math.abs(b) * .002)) { v.cur.p[k] = REDUCED ? b : a + (b - a) * .2; moving = true; }
      else v.cur.p[k] = b;
    });
    Object.keys(t.p).forEach(k => { if (!ANIM_KEYS.includes(k)) v.cur.p[k] = t.p[k]; });
    if (moving || key !== v.key || v.dirty) {
      v.key = key; v.dirty = false;
      build(v, t.cat, v.cur.p, t.extras, !moving);
    }
    // камера
    const now = performance.now();
    if (now > v.idleAt && !REDUCED) v.theta += .0022;
    v.center.lerp(v.tCenter, .12);
    v.dist += (v.tDist - v.dist) * .12;
    const c = v.center;
    v.cam.position.set(c.x + v.dist * Math.cos(v.phi) * Math.sin(v.theta), c.y + v.dist * Math.sin(v.phi), c.z + v.dist * Math.cos(v.phi) * Math.cos(v.theta));
    v.cam.lookAt(c);
  }

  /* ---------- сборка модели из простых брусков ---------- */
  function build(v, cat, p, extras, settled) {
    const ctx = { out: [], planes: [], v, settled, painted: extras.includes('paint') };
    const fn = BUILD[cat]; if (!fn) return;
    fn(p, ctx);
    apply(v, ctx);
  }

  function apply(v, ctx) {
    const box = new T.Box3();
    const tmp = new T.Vector3();
    // бруски
    ctx.out.forEach((b, i) => {
      let m = v.pool[i];
      if (!m) {
        m = new T.Mesh(v.unitBox, v.mats.steel); m.castShadow = true; m.receiveShadow = true;
        const e = new T.LineSegments(v.unitEdges, lineMat(v, 0x000000)); e.visible = false; m.add(e); m.userData.edges = e;
        v.group.add(m); v.pool[i] = m;
      }
      m.visible = !b.hide;
      m.material = typeof b.m === 'string' ? v.mats[b.m] : b.m;
      m.castShadow = !b.noShadow;
      m.position.set(...b.p); m.scale.set(Math.max(b.s[0], 1e-4), Math.max(b.s[1], 1e-4), Math.max(b.s[2], 1e-4));
      m.rotation.set(...(b.r || [0, 0, 0]));
      m.userData.edges.visible = !!b.e;
      if (b.e) m.userData.edges.material = lineMat(v, b.e);
      if (!b.skipBounds) {
        for (const sx of [-.5, .5]) for (const sy of [-.5, .5]) for (const sz of [-.5, .5]) {
          tmp.set(sx, sy, sz); m.updateMatrix(); tmp.applyMatrix4(m.matrix); box.expandByPoint(tmp);
        }
      }
    });
    for (let i = ctx.out.length; i < v.pool.length; i++) v.pool[i].visible = false;
    // плоскости (лицевые поверхности вывесок)
    ctx.planes.forEach((pl, i) => {
      let m = v.ppool[i];
      if (!m) { m = new T.Mesh(v.unitPlane, v.mats.face); v.group.add(m); v.ppool[i] = m; }
      m.visible = true; m.material = pl.m; m.position.set(...pl.p); m.scale.set(pl.s[0], pl.s[1], 1);
      m.rotation.set(0, 0, 0); m.castShadow = !!pl.shadow; m.renderOrder = pl.order || 0;
    });
    for (let i = ctx.planes.length; i < v.ppool.length; i++) v.ppool[i].visible = false;

    if (box.isEmpty()) return;
    const c = box.getCenter(new T.Vector3()), size = box.getSize(new T.Vector3());
    const rad = Math.max(.25, size.length() / 2);
    v.tCenter.copy(c);
    v.tDist = rad / Math.sin(T.MathUtils.degToRad(v.cam.fov / 2)) * (v.cam.aspect < 1 ? 1.35 : 1.14);
    if (!v.framed) { v.center.copy(c); v.dist = v.tDist; v.framed = true; }
    // тень подстраиваем под размер модели
    const s = v.sun.shadow.camera;
    s.left = s.bottom = -rad * 1.6; s.right = s.top = rad * 1.6; s.near = .1; s.far = rad * 12; s.updateProjectionMatrix();
    v.sun.position.set(c.x + rad * 1.8, c.y + rad * 3.2, c.z + rad * 2.2);
    v.sun.target.position.copy(c);
    const gs = Math.max(3, Math.ceil(rad * 6));
    v.grid.scale.setScalar(gs); v.grid.position.set(0, .0005, 0);
  }

  function lineMat(v, color) { return v.lineMats[color] || (v.lineMats[color] = new T.LineBasicMaterial({ color, transparent: true, opacity: .55 })); }

  /* текстура с надписью для вывесок */
  function textTexture(v, key, text, w, h, mode) {
    v.tex = v.tex || {};
    const asp = Math.round(clamp(w / h, .25, 12) * 4) / 4;
    const id = key + asp + mode;
    if (v.tex[key]?.id === id) return v.tex[key].t;
    const cw = 1024, ch = Math.max(48, Math.round(cw / asp));
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const g = cv.getContext('2d');
    const fs = Math.min(ch * .52, cw / (Math.max(1, text.length) * .72));
    g.font = `700 ${fs}px Onest, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (mode === 'face') { g.fillStyle = '#ffffff'; g.fillRect(0, 0, cw, ch); g.fillStyle = '#0d2440'; g.fillText(text, cw / 2, ch / 2 + fs * .04); }
    else if (mode === 'plate') { g.fillStyle = '#f2f3f5'; g.fillRect(0, 0, cw, ch); g.fillStyle = '#0d2440'; g.font = `700 ${fs * .7}px Onest, system-ui, sans-serif`; g.fillText(text, cw / 2, ch * .44); g.fillStyle = '#2b86de'; g.fillRect(cw * .3, ch * .66, cw * .4, Math.max(3, ch * .03)); }
    else if (mode === 'alpha') { g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch); g.fillStyle = '#fff'; g.fillText(text, cw / 2, ch / 2 + fs * .04); }
    else if (mode === 'glow') { g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch); g.filter = `blur(${Math.round(fs * .18)}px)`; g.fillStyle = '#fff'; g.font = `800 ${fs * 1.04}px Onest, system-ui, sans-serif`; g.fillText(text, cw / 2, ch / 2 + fs * .04); g.fillText(text, cw / 2, ch / 2 + fs * .04); }
    else if (mode === 'glowrect') { g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch); const b = Math.round(Math.min(cw, ch) * .12); g.filter = `blur(${b}px)`; g.fillStyle = '#fff'; g.fillRect(cw * .09, ch * .2, cw * .82, ch * .6); }
    const t = new T.CanvasTexture(cv); t.colorSpace = mode === 'alpha' || mode === 'glow' || mode === 'glowrect' ? T.NoColorSpace : T.SRGBColorSpace; t.anisotropy = 4;
    v.tex[key]?.t.dispose();
    v.tex[key] = { id, t };
    return t;
  }
  function planeMat(v, key, opts) {
    v.pm = v.pm || {};
    let m = v.pm[key];
    if (!m) { m = v.pm[key] = opts.basic ? new T.MeshBasicMaterial({}) : new T.MeshStandardMaterial({ envMapIntensity: .6 }); (v.extraMats = v.extraMats || []).push(m); }
    const { basic, ...rest } = opts;
    Object.entries(rest).forEach(([k, val]) => {
      if (k === 'color' || k === 'emissive') m[k].set(val); else if (m[k] !== val) { m[k] = val; m.needsUpdate = true; }
    });
    return m;
  }

  /* ---------- построители по категориям ---------- */
  const mm = x => (+x || 0) / 1000;
  function adder(ctx) { return (x, y, z, w, h, d, m, extra = {}) => ctx.out.push({ p: [x, y, z], s: [w, h, d], m, ...extra }); }

  const BUILD = {
    laser(p, ctx) {
      const B = adder(ctx);
      const L = mm(p.length), W = mm(p.width), T0 = Math.max(mm(p.thickness), .0015);
      const mat = ctx.painted ? 'powder' : { st3: 'steel', aisi: 'stainless', alu: 'alu', zn: 'zinc' }[p.material] || 'steel';
      B(0, T0 / 2, 0, L, T0, W, mat, { e: 0x4b5562 });
      // отверстия и вырезы показывают сложность контура
      const hs = Math.min(L, W) * .07, y = T0 + .0004;
      if (p.contour !== 'simple') {
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => B(sx * (L / 2 - hs * 1.6), y, sz * (W / 2 - hs * 1.6), hs, .0008, hs, 'hole', { noShadow: true, skipBounds: true }));
      }
      if (p.contour === 'complex') {
        const n = 5;
        for (let i = 0; i < n; i++) B(0, y, -W * .3 + i * W * .6 / (n - 1), L * .45, .0008, Math.max(.004, W * .035), 'hole', { noShadow: true, skipBounds: true });
      }
    },

    metal(p, ctx) {
      const B = adder(ctx);
      const L = mm(p.length), W = mm(p.width), H = mm(p.height);
      const s = { p40x20: .03, p40: .04, p60: .06, p80: .08 }[p.material] || .04;
      const m = ctx.painted ? 'powder' : 'steel';
      const posts = (h, inset = 0) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => B(a * (L / 2 - s / 2 - inset), h / 2, b * (W / 2 - s / 2 - inset), s, h, s, m));
      switch (p.type) {
        case 'canopy': {
          posts(H);
          [-1, 1].forEach(b => B(0, H - s / 2, b * (W / 2 - s / 2), L, s, s, m));
          [-1, 1].forEach(a => B(a * (L / 2 - s / 2), H - s / 2, 0, s, s, W, m));
          const n = Math.max(2, Math.ceil(L / .8) + 1);
          for (let i = 0; i < n; i++) B(-L / 2 + s / 2 + i * (L - s) / (n - 1), H + s * .4, 0, s * .7, s * .8, W + .1, m);
          B(0, H + s * .8 + .006, 0, L + .2, .008, W + .3, 'poly', { r: [.05, 0, 0] });
          break;
        }
        case 'stairs': {
          const ang = Math.atan2(H, L), len = Math.hypot(L, H);
          [-1, 1].forEach(b => B(0, H / 2, b * (W / 2 - s / 2), len, s * 2.4, s, m, { r: [0, 0, ang] }));
          const n = Math.max(3, Math.round(H / .17)), d = L / n;
          for (let i = 0; i < n; i++) B(-L / 2 + (i + .5) * d, (i + 1) * H / n - .02, 0, d * .96, .03, W - s * 2, m);
          B(L / 2 + .3, H - .015, 0, .6, .03, W, m); // площадка
          break;
        }
        case 'fence': {
          const n = Math.ceil(L / 1.5) + 1;
          for (let i = 0; i < n; i++) B(-L / 2 + s / 2 + i * (L - s) / (n - 1), H / 2, 0, s, H, s, m);
          B(0, H - s / 2, 0, L, s, s * .9, m);
          B(0, .12, 0, L, s * .7, s * .7, m);
          const k = Math.floor(L / .15), bh = H - s - .12;
          for (let i = 0; i < k; i++) B(-L / 2 + (i + .5) * L / k, .12 + bh / 2, 0, .016, bh, .016, m);
          break;
        }
        case 'gate': {
          const y0 = .06;
          [-1, 1].forEach(a => B(a * (L / 2 + .07), (H + .3) / 2, 0, .1, H + .3, .1, 'powder'));
          [-1, 1].forEach(a => B(a * (L / 2 - s / 2), y0 + H / 2, 0, s, H, s, m));
          B(0, y0 + s / 2, 0, L, s, s, m); B(0, y0 + H - s / 2, 0, L, s, s, m); B(0, y0 + H / 2, 0, L - 2 * s, s * .7, s * .7, m);
          const k = Math.floor(L / .12), bh = H - 2 * s;
          for (let i = 0; i < k; i++) B(-L / 2 + s + (i + .5) * (L - 2 * s) / k, y0 + H / 2, 0, .02, bh, .02, m);
          break;
        }
        case 'rack': {
          posts(H);
          const n = Math.max(3, Math.round(H / .5));
          for (let i = 0; i < n; i++) {
            const y = .08 + i * (H - .12) / (n - 1);
            [-1, 1].forEach(b => B(0, y, b * (W / 2 - s / 2), L - 2 * s, s * .8, s * .8, m));
            B(0, y + s * .4 + .009, 0, L - .01, .018, W - .01, 'wood', { e: 0x8b6b48 });
          }
          break;
        }
        default: { // каркас
          posts(H);
          [s / 2, H - s / 2].forEach(y => {
            [-1, 1].forEach(b => B(0, y, b * (W / 2 - s / 2), L - 2 * s, s, s, m));
            [-1, 1].forEach(a => B(a * (L / 2 - s / 2), y, 0, s, s, W - 2 * s, m));
          });
          B(0, H / 2, -(W / 2 - s / 2), L - 2 * s, s * .8, s * .8, m);
        }
      }
    },

    sign(p, ctx) {
      const B = adder(ctx), v = ctx.v;
      const W = mm(p.width), H = mm(p.height);
      const depth = { box: .12, letters: .08, flat: .012, plate: .004 }[p.type] || .1;
      const wallW = W + .9, wallH = H + .7, wz = -depth / 2 - .02 - (p.type === 'plate' ? .02 : 0);
      B(0, wallH / 2, wz, wallW, wallH, .04, 'wall');
      const cy = .35 + H / 2, lit = p.light === 'inner', back = p.light === 'back';
      if (p.type === 'box') {
        B(0, cy, 0, W, H, depth, 'navySide');
        const t = textTexture(v, 'face', 'ВЫВЕСКА', W, H, 'face');
        ctx.planes.push({ p: [0, cy, depth / 2 + .001], s: [W - .03, H - .03], m: planeMat(v, 'face', { map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: lit ? .85 : 0, roughness: .3 }) });
        if (back) ctx.planes.push({ p: [0, cy, wz + .021], s: [W * 1.18, H * 1.5], m: planeMat(v, 'glowbox', { basic: true, color: 0xfff1d0, alphaMap: textTexture(v, 'glowbox', '', W, H, 'glowrect'), transparent: true, depthWrite: false }) });
      } else if (p.type === 'letters') {
        const a = textTexture(v, 'alpha', 'ВЫВЕСКА', W, H, 'alpha');
        const n = 10;
        for (let i = 0; i < n; i++) {
          const z = -depth / 2 + i * depth / (n - 1);
          const front = i === n - 1;
          ctx.planes.push({ p: [0, cy, z], s: [W, H], shadow: true, m: front ? planeMat(v, 'lfront', { alphaMap: a, alphaTest: .5, color: back ? 0x2a3440 : 0xffffff, emissive: 0xffffff, emissiveIntensity: lit ? .8 : 0, metalness: back ? .6 : 0, roughness: .35 }) : planeMat(v, 'lside', { alphaMap: a, alphaTest: .5, color: 0x1b2f47, metalness: .3, roughness: .5 }) });
        }
        if (back) ctx.planes.push({ p: [0, cy, wz + .021], s: [W * 1.08, H * 1.25], m: planeMat(v, 'glowl', { basic: true, color: 0xfff1d0, alphaMap: textTexture(v, 'glow', 'ВЫВЕСКА', W, H, 'glow'), transparent: true, depthWrite: false }) });
        ctx.out.push({ p: [0, cy, 0], s: [W, H, depth], m: 'navySide', noShadow: true, hide: true });
      } else {
        const plate = p.type === 'plate';
        B(0, cy, 0, W, H, depth, plate ? 'composite' : 'composite', { e: 0x9aa4ae });
        const t = textTexture(v, plate ? 'plate' : 'flat', plate ? 'ТАБЛИЧКА' : 'ВЫВЕСКА', W, H, plate ? 'plate' : 'face');
        ctx.planes.push({ p: [0, cy, depth / 2 + .001], s: [W - .006, H - .006], m: planeMat(v, plate ? 'plate' : 'flat', { map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: lit ? .7 : 0, roughness: .35 }) });
        if (plate) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => B(a * (W / 2 - .03), cy + b * (H / 2 - .03), -.01, .016, .016, .03, 'stainless'));
        if (back) ctx.planes.push({ p: [0, cy, wz + .021], s: [W * 1.12, H * 1.3], m: planeMat(v, 'glowf', { basic: true, color: 0xfff1d0, alphaMap: textTexture(v, 'glowf', '', W, H, 'glowrect'), transparent: true, depthWrite: false }) });
      }
    },

    furniture(p, ctx) {
      const B = adder(ctx);
      const W = mm(p.width), H = mm(p.height), D = mm(p.depth), t = .018;
      const mt = { ldsp: 'ldsp', mdf: 'mdf', oak: 'oak', pine: 'pine', loft: 'loftWood' }[p.material] || 'ldsp';
      const loft = p.material === 'loft';
      const side = loft ? 'black' : mt, e = loft ? null : 0x8a7e6c;
      const box = (withBack = true) => {
        if (loft) {
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => B(a * (W / 2 - .015), H / 2, b * (D / 2 - .015), .03, H, .03, 'black'));
        } else {
          [-1, 1].forEach(a => B(a * (W / 2 - t / 2), H / 2, 0, t, H, D, side, { e }));
        }
        B(0, H - t / 2, 0, loft ? W : W - 2 * t, t, D, mt, { e });
        B(0, .06 + t / 2, 0, loft ? W - .06 : W - 2 * t, t, D, mt, { e });
        if (!loft) B(0, .03, D / 2 - .05, W - 2 * t, .06, t, mt);
        if (withBack && !loft) B(0, H / 2, -D / 2 + .002, W - 2 * t, H - .004, .004, mt);
      };
      switch (p.type) {
        case 'table': {
          B(0, H - .015, 0, W, .03, D, mt, { e });
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => B(a * (W / 2 - .05), (H - .03) / 2, b * (D / 2 - .05), .05, H - .03, .05, loft ? 'black' : mt));
          break;
        }
        case 'rack': {
          box(false);
          const n = Math.max(1, Math.floor(H / .4) - 1);
          for (let i = 0; i < n; i++) B(0, .06 + (i + 1) * (H - .06) / (n + 1), 0, W - 2 * t, t, D - .01, mt, { e });
          break;
        }
        case 'tumba': case 'kitchen': {
          box(true);
          if (p.type === 'kitchen') {
            B(0, H + .019, .01, W + .004, .038, D + .03, 'counter');
            [-1, 1].forEach(a => { B(a * W / 4, H / 2 + .03, D / 2 + t / 2, W / 2 - .004, H - .066, t, mt, { e }); B(a * .04, H - .12, D / 2 + t + .01, .012, .1, .012, 'handle'); });
          } else {
            const n = 3, hh = (H - .066) / n;
            for (let i = 0; i < n; i++) {
              const y = .063 + hh * (i + .5);
              B(0, y, D / 2 + t / 2, W - .004, hh - .004, t, mt, { e });
              B(0, y + hh * .25, D / 2 + t + .01, Math.min(.16, W * .3), .012, .012, 'handle');
            }
          }
          break;
        }
        default: { // шкаф
          box(true);
          const n = Math.max(1, Math.floor(H / .45) - 1);
          for (let i = 0; i < n; i++) B(0, .06 + (i + 1) * (H - .06) / (n + 1), .01, W - 2 * t, t, D - .03, mt, { e });
          if (!loft) {
            const dw = W / 2 - .004, a = 1.1;
            B(W / 4, H / 2 + .03, D / 2 + t / 2, dw, H - .064, t, mt, { e });
            B(-W / 2 + Math.cos(a) * dw / 2, H / 2 + .03, D / 2 + Math.sin(a) * dw / 2, dw, H - .064, t, mt, { e, r: [0, -a, 0] });
            B(.04, H * .5, D / 2 + t + .01, .012, .14, .012, 'handle');
          }
        }
      }
    },

    kitchen(p, ctx) {
      const B0 = adder(ctx);
      const L1 = mm(p.length), L2 = mm(p.length2), D = .6, t = .018;
      const fm = { ldsp: 'ldsp', film: 'film', plastic: 'plastic', enamel: 'enamel', pine: 'pine', oak: 'oak' }[p.material] || 'film';
      const tm = p.top === 'stone' ? 'stone' : 'counter';
      const e = 0x8a7e6c;
      // ветка кухни: локальные координаты, фасады смотрят в +z
      const leg = (ox, oz, a, len, opts = {}) => {
        if (len < .2) return;
        const c = Math.cos(a), s = Math.sin(a);
        const B = (x, y, z, w, h, d, m, ex = {}) => B0(ox + x * c + z * s, y, oz - x * s + z * c, w, h, d, m, { ...ex, r: [0, a, 0] });
        B(0, .05, -.03, len, .1, D - .08, 'black');
        B(0, .475, -.01, len, .75, D - .02, 'carcass', { e });
        const n = Math.max(1, Math.round(len / .6)), w = len / n;
        for (let i = 0; i < n; i++) {
          const x = -len / 2 + w * (i + .5);
          const drawers = i % 3 === 1;
          if (drawers) {
            [0, 1, 2].forEach(j => { B(x, .13 + .24 * j + .115, D / 2 - .01, w - .004, .236, t, fm, { e }); B(x, .13 + .24 * j + .2, D / 2 + .01, Math.min(.14, w * .4), .012, .012, 'handle'); });
          } else {
            B(x, .475, D / 2 - .01, w - .004, .726, t, fm, { e });
            B(x, .79, D / 2 + .01, Math.min(.14, w * .4), .012, .012, 'handle');
          }
        }
        B(0, .869, .01, len, .038, D + .02, tm, { e: 0x6b6f74 });
        if (opts.sink) B(len * .22, .889, .02, .5, .004, .42, 'stainless');
        if (opts.hob) B(-len * .2, .89, .02, .58, .006, .5, 'black');
        if (p.uppers !== 'no') {
          B(0, 1.81, -D / 2 + .16, len, .72, .32, 'carcass', { e });
          for (let i = 0; i < n; i++) {
            const x = -len / 2 + w * (i + .5);
            B(x, 1.81, -D / 2 + .32 + .009, w - .004, .716, t, fm, { e });
            B(x, 1.49, -D / 2 + .32 + .028, Math.min(.14, w * .4), .012, .012, 'handle');
          }
        }
      };
      leg(0, 0, 0, L1, { sink: true, hob: p.layout === 'line' });
      if (p.layout !== 'line') leg(-L1 / 2 + D / 2, D / 2 + (L2 - D) / 2, Math.PI / 2, L2 - D, { hob: true });
      if (p.layout === 'u') leg(L1 / 2 - D / 2, D / 2 + (L2 - D) / 2, -Math.PI / 2, L2 - D);
    },

    kupe(p, ctx) {
      const B = adder(ctx);
      const W = mm(p.width), H = mm(p.height), D = mm(p.depth), t = .018, e = 0x8a7e6c;
      const niche = p.build === 'niche';
      if (niche) {
        [-1, 1].forEach(a => B(a * (W / 2 + .06), (H + .1) / 2, 0, .12, H + .1, D + .1, 'wall'));
        B(0, H + .05, 0, W + .24, .1, D + .1, 'wall');
      } else {
        [-1, 1].forEach(a => B(a * (W / 2 - t / 2), H / 2, 0, t, H, D, 'carcass', { e }));
        B(0, H - t / 2, 0, W - 2 * t, t, D, 'carcass', { e });
        B(0, .05, -.02, W - 2 * t, .1, D - .06, 'carcass', { e });
        B(0, H / 2, -D / 2 + .002, W - 2 * t, H - .004, .004, 'carcass');
      }
      // направляющие
      const x0 = niche ? -W / 2 : -W / 2 + t, ww = niche ? W : W - 2 * t;
      B(0, H - (niche ? .02 : t) - .02, D / 2 - .03, ww, .04, .06, 'alu');
      B(0, .11, D / 2 - .03, ww, .015, .06, 'alu');
      const n = p.doors, dw = ww / n + .02, dh = H - (niche ? .06 : t + .06) - .1;
      const cy = .12 + dh / 2;
      const panel = { ldsp: 'ldsp', mirror: 'kmirror', glass: 'lacobel', mdf: 'mdf', wood: 'oak', combo: 'ldsp' }[p.facade] || 'ldsp';
      for (let i = 0; i < n; i++) {
        const x = x0 + ww / n * (i + .5);
        const z = D / 2 - .015 + (i % 2 ? .03 : 0);
        if (p.facade === 'combo') {
          const hh = dh * .22;
          B(x, cy - dh / 2 + hh / 2, z, dw - .02, hh, .01, 'ldsp', { e });
          B(x, cy, z, dw - .02, dh - 2 * hh, .006, 'kmirror', { e: 0x8e99a3 });
          B(x, cy + dh / 2 - hh / 2, z, dw - .02, hh, .01, 'ldsp', { e });
        } else {
          B(x, cy, z, dw - .02, dh, .01, panel, { e: panel === 'kmirror' ? 0x8e99a3 : e });
        }
        [-1, 1].forEach(a => B(x + a * (dw / 2 - .01), cy, z, .02, dh, .022, 'alu'));
      }
    },

    glass(p, ctx) {
      const B = adder(ctx);
      const L = mm(p.length), H = mm(p.width), t = Math.max(mm(p.thickness), .003);
      const mirror = p.material === 'mirror';
      B(0, H / 2 + .04, 0, L, H, t, mirror ? 'mirror' : 'glass', { e: mirror ? 0x8e99a3 : 0x5f93b5, noShadow: !mirror });
      [-1, 1].forEach(a => B(a * L * .3, .02, 0, .12, .04, .08, 'black'));
    },

    windows(p, ctx) {
      const B = adder(ctx);
      const W = mm(p.width), H = mm(p.height);
      const door = p.product === 'dmetal' || p.product === 'dalu';
      const fm = p.product === 'alu' || p.product === 'dalu' ? 'alu' : p.product === 'dmetal' ? 'doorMetal' : 'pvc';
      const y0 = door ? 0 : .8, wt = .22, f = door ? .05 : .065, fd = .07;
      const wallH = y0 + H + .45;
      [-1, 1].forEach(a => B(a * (W / 2 + .35), wallH / 2, -.02, .7, wallH, wt, 'wall'));
      B(0, y0 + H + .225, -.02, W, .45, wt, 'wall');
      if (!door) { B(0, y0 / 2, -.02, W, y0, wt, 'wall'); B(0, y0 - .01, .1, W + .08, .02, .2, 'pvc'); }
      // коробка
      B(0, y0 + H - f / 2, 0, W, f, fd, fm); if (!door) B(0, y0 + f / 2, 0, W, f, fd, fm);
      [-1, 1].forEach(a => B(a * (W / 2 - f / 2), y0 + H / 2, 0, f, H, fd, fm));
      if (p.product === 'dmetal') {
        B(0, (H - f) / 2, .005, W - 2 * f, H - f, .06, 'doorMetal');
        B(0, (H - f) / 2, .036, W - 2 * f - .16, H - f - .3, .004, 'black');
        B(W / 2 - f - .1, H * .48, .06, .14, .022, .03, 'handle');
        B(W / 2 - f - .1, H * .42, .045, .03, .05, .006, 'handle');
        return;
      }
      if (p.product === 'dalu') {
        const gh = (H - f) * .62;
        B(0, H - f - gh / 2 - .04, 0, W - 2 * f - .08, gh, .024, 'glass', { noShadow: true });
        B(0, (H - f - gh) / 2, 0, W - 2 * f, H - f - gh - .08, .05, 'alu');
        B(0, H - f - gh - .04, 0, W - 2 * f, .08, fd * .9, 'alu');
        [-1, 1].forEach(a => B(a * (W / 2 - f - .04), (H - f) / 2, 0, .08, H - f, fd * .9, 'alu'));
        B(W / 2 - f - .12, H * .5, .06, .025, .6, .025, 'handle');
        return;
      }
      const two = W > 1200, opening = p.opening || 'fixed';
      const secs = two ? [[-W / 4, W / 2, false], [W / 4, W / 2, opening !== 'fixed']] : [[0, W, opening !== 'fixed']];
      if (two) B(0, y0 + H / 2, 0, f * .9, H - 2 * f, fd, fm);
      secs.forEach(([cx, sw, sash]) => {
        const iw = sw - (two ? f * 1.45 : 2 * f), ih = H - 2 * f;
        if (sash) {
          const sf = .055;
          B(cx, y0 + f + sf / 2, .006, iw, sf, fd * .85, fm); B(cx, y0 + H - f - sf / 2, .006, iw, sf, fd * .85, fm);
          [-1, 1].forEach(a => B(cx + a * (iw / 2 - sf / 2), y0 + H / 2, .006, sf, ih - 2 * sf, fd * .85, fm));
          B(cx, y0 + H / 2, 0, iw - 2 * sf, ih - 2 * sf, .024, 'glass', { noShadow: true });
          B(cx - iw / 2 + sf / 2, y0 + H / 2, fd / 2 + .02, .022, .13, .025, 'handle');
        } else {
          B(cx, y0 + H / 2, 0, iw, ih, .024, 'glass', { noShadow: true });
        }
      });
    },
  };

  return { create, load };
})();
