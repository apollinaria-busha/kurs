/* Экран «Настроить» для элементов наборов: живое превью + свои цвета, надписи, картинка вместо значка, скорость.
   Общий для плагинов Премьера (kk-montazh, kk-motion) и приложения (pack.js). Рисует движок KKE (pack/engine/kke.js).
   KKEDIT.load(base) → Promise      — подгрузить движок и шрифты (base — адрес папки pack/engine/)
   KKEDIT.open(el, o)                — o = { style, kind, id, name, fmt, act:'Вставить', onAct(st), onBack() }
   KKEDIT.render(st, fmt, each)      — все кадры в полном размере: each(i, canvas, F) → Promise */
(function (G) {
  let LOADING = null;
  function load(base) {
    if (G.KKE) return Promise.resolve();
    if (LOADING) return LOADING;
    G.KK_BASE = base;
    LOADING = fetch(base + 'engine.json?t=' + Date.now()).then(r => r.json()).then(info =>
      fetch(base + 'fonts.css?v=' + info.v).then(r => r.text()).then(css => {
        const s = document.createElement('style'); s.textContent = css.split('{BASE}').join(base); document.head.appendChild(s);
        return new Promise((ok, bad) => { const sc = document.createElement('script'); sc.src = base + 'kke.js?v=' + info.v; sc.onload = ok; sc.onerror = () => bad(new Error('движок не загрузился')); document.head.appendChild(sc); });
      })).then(() => Promise.all(G.KK_READY || [])).then(() => document.fonts.ready).catch(e => { LOADING = null; throw e; });
    return LOADING;
  }
  const CSS = `.kke{display:flex;flex-direction:column;gap:10px}.kke-top{display:flex;align-items:center;gap:8px}.kke-top b{flex:1;font-size:13px}
.kke-back{background:none;border:0;color:inherit;opacity:.7;cursor:pointer;font:inherit;padding:4px 0}.kke-pv{display:flex;justify-content:center;border-radius:8px;padding:8px;
background:repeating-conic-gradient(#8884 0 25%,#0000 0 50%) 0 0/16px 16px}.kke-pv canvas{max-width:100%;max-height:260px;display:block}
.kke h4{margin:6px 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;opacity:.6;font-weight:600}.kke-cols{display:flex;flex-wrap:wrap;gap:8px}
.kke-col{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10px;opacity:.9}.kke-col input{width:38px;height:38px;border:2px solid #fff3;border-radius:50%;padding:0;cursor:pointer;background:none}
.kke-col input::-webkit-color-swatch-wrapper{padding:0}.kke-col input::-webkit-color-swatch{border:0;border-radius:50%}.kke-tx{display:flex;flex-direction:column;gap:6px}
.kke-tx input{width:100%;box-sizing:border-box;padding:7px 9px;border-radius:7px;border:1px solid #8886;background:#0002;color:inherit;font:inherit}
.kke-ic{display:flex;flex-wrap:wrap;gap:8px}.kke-ic label{display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px dashed #8888;border-radius:8px;cursor:pointer;font-size:12px}
.kke-ic img{width:24px;height:24px;object-fit:contain}.kke-ic input{display:none}.kke-sp{display:flex;gap:4px;flex-wrap:wrap}.kke-sp button,.kke-row button{border:1px solid #8886;background:none;color:inherit;
border-radius:7px;padding:6px 10px;cursor:pointer;font:inherit;font-size:12px}.kke-sp button.on{background:#FFAD05;border-color:#FFAD05;color:#111}.kke-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.kke-go{background:#FFAD05!important;border-color:#FFAD05!important;color:#111!important;font-weight:700;padding:9px 16px!important}.kke-note{font-size:11px;opacity:.65;line-height:1.4}`;
  const SPEEDS = [[.5, 'Медленно'], [.75, '0.75×'], [1, 'Как есть'], [1.5, '1.5×'], [2, 'Быстро']];
  const NAMES = { k: 'Тёмный', w: 'Светлый', g: 'Серый' };
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

  function open(el, o) {
    if (!document.getElementById('kke-css')) { const s = document.createElement('style'); s.id = 'kke-css'; s.textContent = CSS; document.head.appendChild(s); }
    el.innerHTML = '<div class="kke"><div class="kke-top"><button class="kke-back">← Назад</button><b>' + esc(o.name || '') + '</b></div><p class="kke-note">Загружаю настройки…</p></div>';
    el.querySelector('.kke-back').onclick = () => { stop(); o.onBack && o.onBack(); };
    let raf = 0; const stop = () => cancelAnimationFrame(raf);
    load(o.base).then(() => {
      const I = G.KKE.inspect(o.style, o.kind, o.id); if (!I) { el.querySelector('.kke-note').textContent = 'Этот элемент нельзя настроить: он снят или нарисован заранее.'; return; }
      const st = { style: o.style, kind: o.kind, id: o.id, name: o.name, speed: 1, colors: {}, texts: {}, icons: {}, iconSrc: {} };
      const moving = o.kind === 'an' || o.kind === 'tr' || o.kind === 'ov';
      const box = el.querySelector('.kke');
      box.innerHTML = (o.top === false ? '' : '<div class="kke-top"><button class="kke-back">← Назад</button><b>' + esc(o.name || '') + '</b></div>') + '<div class="kke-pv"><canvas></canvas></div>' +
        (I.colors.length ? '<div><h4>Цвета</h4><div class="kke-cols">' + I.colors.map((c, i) => '<label class="kke-col"><input type="color" data-c="' + c.key + '" value="' + c.hex.toLowerCase() + '"><span>' + (NAMES[c.key] || 'Цвет ' + (i + 1)) + '</span></label>').join('') + '</div></div>' : '') +
        (I.texts.length ? '<div><h4>Надписи</h4><div class="kke-tx">' + I.texts.map(t => '<input data-t="' + esc(t) + '" value="' + esc(t) + '" placeholder="' + esc(t) + '">').join('') + '</div></div>' : '') +
        (I.icons.length ? '<div><h4>Своя картинка вместо значка</h4><div class="kke-ic">' + I.icons.map(c => '<label><input type="file" accept="image/*" data-i="' + esc(c.key) + '"><img alt="" style="display:none"><span>' + esc(c.label) + ' → выбрать PNG</span></label>').join('') + '</div><p class="kke-note">Лучше всего — PNG без фона: лого, стикер, эмодзи.</p></div>' : '') +
        (moving ? '<div><h4>Скорость</h4><div class="kke-sp">' + SPEEDS.map(s => '<button data-s="' + s[0] + '" class="' + (s[0] === 1 ? 'on' : '') + '">' + s[1] + '</button>').join('') + '</div></div>' : '') +
        (!I.colors.length && !I.texts.length && !I.icons.length && !moving ? '<p class="kke-note">У этого элемента нечего менять.</p>' : '') +
        '<div class="kke-row"><button class="kke-go">' + esc(o.act || 'Вставить') + '</button><button class="kke-reset">Сбросить</button><span class="kke-msg kke-note"></span></div>' + (o.note ? '<p class="kke-note">' + o.note + '</p>' : '');
      if (box.querySelector('.kke-back')) box.querySelector('.kke-back').onclick = () => { stop(); o.onBack && o.onBack(); };
      const cv = box.querySelector('canvas'), ctx = cv.getContext('2d');
      let cfg = null; const upd = () => { cfg = G.KKE.cfgFrom(st); };
      box.querySelectorAll('[data-c]').forEach(inp => inp.oninput = () => { st.colors[inp.dataset.c] = inp.value; upd(); });
      box.querySelectorAll('[data-t]').forEach(inp => inp.oninput = () => { if (inp.value === inp.dataset.t) delete st.texts[inp.dataset.t]; else st.texts[inp.dataset.t] = inp.value; upd(); });
      box.querySelectorAll('[data-i]').forEach(inp => inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) return; const rd = new FileReader();
        rd.onload = () => { const im = new Image(); im.onload = () => { st.icons[inp.dataset.i] = im; st.iconSrc[inp.dataset.i] = rd.result; const pv = inp.parentNode.querySelector('img'); pv.src = rd.result; pv.style.display = ''; upd(); }; im.src = rd.result; }; rd.readAsDataURL(f); });
      box.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { st.speed = +b.dataset.s; box.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', x === b)); t0 = performance.now(); });
      box.querySelector('.kke-reset').onclick = () => { stop(); open(el, o); };
      const msg = box.querySelector('.kke-msg');
      box.querySelector('.kke-go').onclick = () => { const b = box.querySelector('.kke-go'); if (b.disabled) return; b.disabled = true;
        Promise.resolve(o.onAct(st, s => msg.textContent = s)).catch(e => msg.textContent = 'Не получилось: ' + e.message).then(() => b.disabled = false); };
      // живое превью: в размере экрана, кадры по времени
      let t0 = performance.now(), F0 = null, sp0 = 0;
      function tick() {
        if (!cv.isConnected) return;
        if (!F0 || sp0 !== st.speed) { F0 = G.KKE.frames(o.style, o.kind, o.id, o.fmt || 'v', st.speed); sp0 = st.speed; const k = 360 / Math.max(F0.W, F0.H); cv.width = Math.round(F0.W * k); cv.height = Math.round(F0.H * k); }
        const n = F0.n, i = F0.still ? 0 : Math.floor((performance.now() - t0) / 1000 * G.KKE.FPS) % (n + (o.kind === 'tr' ? 15 : 0)); // у перехода — пауза после
        ctx.clearRect(0, 0, cv.width, cv.height);
        try { G.KKE.draw(ctx, o.style, o.kind, o.id, cv.width, cv.height, F0.v(Math.min(i, n - 1)), cfg); } catch (e) { console.warn(e); }
        raf = requestAnimationFrame(tick);
      }
      tick();
    }).catch(e => { const n = el.querySelector('.kke-note'); if (n) n.textContent = 'Не получилось загрузить настройки: ' + e.message + '. Проверь интернет.'; });
  }
  // все кадры в полном размере (для вставки в Премьер или видео для CapCut)
  async function render(st, fmt, each, bg) {
    const F = G.KKE.frames(st.style, st.kind, st.id, fmt, st.speed), cfg = G.KKE.cfgFrom(st);
    const cv = document.createElement('canvas'); cv.width = F.W; cv.height = F.H; const ctx = cv.getContext('2d');
    for (let i = 0; i < F.n; i++) { ctx.clearRect(0, 0, F.W, F.H); if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, F.W, F.H); } G.KKE.draw(ctx, st.style, st.kind, st.id, F.W, F.H, F.v(i), cfg); await each(i, cv, F); if (i % 4 === 3) await new Promise(r => setTimeout(r)); }
    return F;
  }
  // подпись настроек для имени файла: одинаковые настройки — один и тот же файл
  function sig(st) { const s = JSON.stringify([st.speed, st.colors, st.texts, Object.values(st.iconSrc || {}).map(x => x.length + x.slice(-40))]); let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) >>> 0; return h.toString(36); }
  G.KKEDIT = { load, open, render, sig };
})(window);
