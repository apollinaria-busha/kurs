/* ---- lib.js ---- */
/* Библиотека рисования стилевых наборов КК (canvas 2D).
   Каждая функция рисует один элемент в стиле S (палитра, шрифты, «рукотворность» линии)
   и умеет анимироваться: p — прогресс 0..1 (для статики p = 1), t — время в секундах (для циклов). */
(function (G) {
  const TAU = Math.PI * 2;
  const E = {
    out: x => 1 - Math.pow(1 - x, 3), inOut: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
    back: x => { const c = 1.70158, d = c + 1; return 1 + d * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
    elastic: x => x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * TAU / 3) + 1,
    clamp: (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
  };
  // детерминированный «случайный» генератор: одинаковые кадры при каждом рендере
  function rnd(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

  /* ---------- линии ---------- */
  // путь из точек с «дрожью руки»: rough 0 — ровно, 1 — как маркером от руки
  function path(ctx, pts, S, close) {
    const r = S.rough || 0, R = rnd(S.seed || 7);
    ctx.beginPath();
    pts.forEach((p, i) => { const jx = (R() - .5) * r * 3, jy = (R() - .5) * r * 3; i ? ctx.lineTo(p[0] + jx, p[1] + jy) : ctx.moveTo(p[0] + jx, p[1] + jy); });
    if (close) ctx.closePath();
  }
  function sample(fn, n) { const a = []; for (let i = 0; i <= n; i++) a.push(fn(i / n)); return a; }
  function look(ctx, S, o = {}) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = o.stroke || S.c1; ctx.fillStyle = o.fill || S.c1;
    ctx.lineWidth = o.lw || S.lw || 14;
    if (S.glow) { ctx.shadowColor = o.glowColor || S.glowColor || ctx.strokeStyle; ctx.shadowBlur = S.glow; } else { ctx.shadowBlur = 0; }
    if (S.shadow && !S.glow) { ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8; } else ctx.shadowOffsetY = 0;
  }
  // обводка с «рисованием»: p — какая часть линии уже нарисована
  function strokeDraw(ctx, pts, S, p, o) {
    const n = Math.max(2, Math.round(pts.length * E.clamp(p)));
    look(ctx, S, o); path(ctx, pts.slice(0, n), S); ctx.stroke();
  }

  /* ---------- текст ---------- */
  function font(S, size, which = 'accent') { return `${size}px "${which === 'body' ? S.fontBody : S.font}"`; }
  function text(ctx, s, x, y, S, size, o = {}) {
    ctx.save(); if (o.caps) s = s.toUpperCase();
    ctx.font = font(S, size, o.which); if (o.maxW) { const w0 = ctx.measureText(s).width; if (w0 > o.maxW) { size = size * o.maxW / w0; ctx.font = font(S, size, o.which); } } // подгонка под ширину
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
    if (o.outline) { ctx.lineWidth = o.outline; ctx.strokeStyle = o.outlineColor || S.ink; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
    look(ctx, S, { fill: o.color || S.c1 }); ctx.shadowOffsetY = 0; if (!o.glow) ctx.shadowBlur = 0;
    ctx.fillText(s, x, y); ctx.restore();
    ctx.font = font(S, size, o.which); return ctx.measureText(s).width;
  }
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

  /* ---------- элементы ---------- */
  const L = {
    // стрелка: кривая с наконечником
    arrow(ctx, W, H, S, p = 1, o = {}) {
      const bend = o.bend ?? .35, a = [W * .15, H * .7], b = [W * .82, H * .32], c = [W * .45, H * (.32 - bend)];
      const pts = sample(t => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]], 40);
      strokeDraw(ctx, pts, S, E.clamp(p / .8), { lw: o.lw });
      if (p > .8) { const k = E.out((p - .8) / .2), ang = Math.atan2(b[1] - pts[37][1], b[0] - pts[37][0]), s = W * .12 * k;
        look(ctx, S, { lw: o.lw }); path(ctx, [[b[0] - s * Math.cos(ang - .5), b[1] - s * Math.sin(ang - .5)], b, [b[0] - s * Math.cos(ang + .5), b[1] - s * Math.sin(ang + .5)]], S); ctx.stroke(); }
    },
    // обвести кружком
    circle(ctx, W, H, S, p = 1, o = {}) {
      const pts = sample(t => { const a = -Math.PI * .6 + t * TAU * 1.08; return [W / 2 + Math.cos(a) * W * .4 * (1 + .03 * Math.sin(t * 9)), H / 2 + Math.sin(a) * H * .3]; }, 80);
      strokeDraw(ctx, pts, S, p, { lw: o.lw, stroke: o.color });
    },
    // подчёркивание (marker — толстое полупрозрачное)
    underline(ctx, W, H, S, p = 1, o = {}) {
      const pts = sample(t => [W * (.08 + .84 * t), H * .55 + Math.sin(t * 5) * H * .04 * (S.rough ? 1 : .2)], 30);
      ctx.save(); if (o.marker) ctx.globalAlpha = .85;
      strokeDraw(ctx, pts, S, p, { lw: o.marker ? H * .35 : o.lw, stroke: o.color }); ctx.restore();
      if (o.double) { const p2 = sample(t => [W * (.12 + .78 * t), H * .7], 20); strokeDraw(ctx, p2, S, E.clamp(p * 1.4 - .4), { lw: o.lw, stroke: o.color }); }
    },
    // сердце
    heart(ctx, W, H, S, p = 1, o = {}) {
      const s = Math.min(W, H) * .42 * (o.scale ?? 1) * (p < 1 ? E.back(E.clamp(p)) : 1), cx = W / 2, cy = H / 2;
      const pts = sample(t => { const a = t * TAU, x = 16 * Math.pow(Math.sin(a), 3), y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); return [cx + x / 17 * s, cy - y / 17 * s]; }, 90);
      look(ctx, S, { fill: o.color || S.c1, stroke: o.line || S.ink }); path(ctx, pts, S, true);
      if (!o.outlineOnly) ctx.fill(); if (o.line || o.outlineOnly) { ctx.shadowBlur = 0; ctx.lineWidth = o.lw || S.lw * .7; ctx.stroke(); }
      if (o.shine && !o.outlineOnly) { ctx.save(); ctx.globalAlpha = .5; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(cx - s * .38, cy - s * .38, s * .14, s * .08, -.7, 0, TAU); ctx.fill(); ctx.restore(); }
    },
    // искра-звёздочка (4 луча)
    sparkle(ctx, W, H, S, p = 1, o = {}) {
      const k = p < 1 ? E.back(E.clamp(p)) : 1, s = Math.min(W, H) * .45 * k * (o.scale ?? 1), cx = W / 2, cy = H / 2, n = o.rays || 4, inr = o.inner ?? .18;
      look(ctx, S, { fill: o.color || S.c2 }); ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.rot || 0); ctx.beginPath();
      for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n - Math.PI / 2, r = i % 2 ? s * inr : s; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.restore();
    },
    // звезда (5 лучей) / взрыв-облачко («BAM»)
    star(ctx, W, H, S, p = 1, o = {}) { L.sparkle(ctx, W, H, S, p, Object.assign({ rays: 5, inner: .45 }, o)); },
    burst(ctx, W, H, S, p = 1, o = {}) {
      const k = p < 1 ? E.back(E.clamp(p)) : 1, R = rnd(o.seed || 3), n = o.rays || 14, s = Math.min(W, H) * .46 * k;
      look(ctx, S, { fill: o.color || S.c2 }); ctx.save(); ctx.translate(W / 2, H / 2); ctx.beginPath();
      for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n, r = i % 2 ? s * (.62 + R() * .08) : s * (.9 + R() * .1); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * .8); }
      ctx.closePath(); ctx.fill(); if (o.line) { ctx.shadowBlur = 0; ctx.lineWidth = S.lw * .6; ctx.strokeStyle = S.ink; ctx.stroke(); } ctx.restore();
      if (o.label) text(ctx, o.label, W / 2, H / 2, S, Math.min(W, H) * .2 * k, { color: o.labelColor || S.ink, caps: true, outline: o.labelOutline });
    },
    // плашка с текстом (тег, бейдж)
    label(ctx, W, H, S, p = 1, o = {}) {
      const k = p < 1 ? E.back(E.clamp(p)) : 1, base = H * .3;
      ctx.save(); ctx.font = font(S, base, o.which); const tw0 = ctx.measureText(o.caps ? o.text.toUpperCase() : o.text).width;
      const size = Math.min(base, base * (W * .94 - base * 1.2) / tw0), tw = tw0 * size / base; // длинный текст — мельче шрифт и ниже плашка
      const pw = tw + size * 1.4, ph = size * 1.7;
      ctx.translate(W / 2, H / 2); ctx.rotate(o.tilt || 0); ctx.scale(k, k);
      look(ctx, S, { fill: o.bg || S.c1 }); rrect(ctx, -pw / 2, -ph / 2, pw, ph, o.radius ?? ph * .3); ctx.fill();
      if (o.border) { ctx.shadowBlur = 0; ctx.lineWidth = o.border; ctx.strokeStyle = o.borderColor || S.ink; ctx.stroke(); }
      ctx.restore(); ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(o.tilt || 0); ctx.scale(k, k);
      text(ctx, o.text, 0, size * .05, S, size, { color: o.color || S.ink, caps: o.caps, which: o.which });
      ctx.restore();
    },
    // пузырь реплики: round | ios | shout (зубчатый) | think (облачко)
    bubble(ctx, W, H, S, p = 1, o = {}) {
      const k = p < 1 ? E.back(E.clamp(p)) : 1, kind = o.kind || 'round', R = rnd(o.seed || 5);
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
      look(ctx, S, { fill: o.bg || '#fff', stroke: o.line || S.ink });
      const x = W * .08, y = H * .14, w = W * .84, h = H * .58;
      if (kind === 'shout') { ctx.beginPath(); const n = 22; for (let i = 0; i < n; i++) { const a = i / n * TAU, r = i % 2 ? .82 : 1 + R() * .12; ctx.lineTo(W / 2 + Math.cos(a) * w / 2 * r, H * .43 + Math.sin(a) * h / 2 * r); } ctx.closePath(); }
      else if (kind === 'think') { ctx.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; ctx.moveTo(W / 2 + Math.cos(a) * w * .36 + h * .22, H * .43 + Math.sin(a) * h * .34); ctx.arc(W / 2 + Math.cos(a) * w * .36, H * .43 + Math.sin(a) * h * .34, h * .22, 0, TAU); } ctx.rect(W / 2 - w * .34, H * .43 - h * .3, w * .68, h * .6); }
      else { rrect(ctx, x, y, w, h, kind === 'ios' ? h * .48 : h * .3); }
      ctx.fill(); if (o.line !== false) { ctx.shadowBlur = 0; ctx.lineWidth = o.lw || S.lw * .5; ctx.stroke(); }
      // хвостик
      ctx.beginPath(); if (kind === 'think') { [[.3, .86, .05], [.22, .95, .03]].forEach(c => { ctx.moveTo(W * c[0] + H * c[2], H * c[1]); ctx.arc(W * c[0], H * c[1], H * c[2], 0, TAU); }); }
      else { const tx = o.tail === 'right' ? W * .72 : W * .28; ctx.moveTo(tx - W * .06, y + h - 2); ctx.lineTo(tx + (o.tail === 'right' ? W * .1 : -W * .1), H * .9); ctx.lineTo(tx + W * .06, y + h - 2); }
      ctx.fill(); if (o.line !== false && kind !== 'think') { ctx.shadowBlur = 0; ctx.stroke(); } ctx.restore();
      if (o.text) { ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2); text(ctx, o.text, W / 2, H * .43, S, h * .34, { color: o.color || S.ink, caps: o.caps, which: o.which, maxW: w * (kind === 'shout' ? .62 : kind === 'think' ? .6 : .8) }); ctx.restore(); }
    },
    // рамка: rect | rounded | polaroid | film | brackets (HUD-уголки)
    frame(ctx, W, H, S, p = 1, o = {}) {
      const kind = o.kind || 'rounded', m = Math.min(W, H) * .08;
      if (kind === 'brackets') { const L2 = Math.min(W, H) * .18, pp = E.out(E.clamp(p));
        [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(c => { look(ctx, S, { lw: o.lw }); ctx.beginPath(); ctx.moveTo(c[0], c[1] + c[3] * L2 * pp); ctx.lineTo(c[0], c[1]); ctx.lineTo(c[0] + c[2] * L2 * pp, c[1]); ctx.stroke(); }); return; }
      if (kind === 'polaroid') { look(ctx, S, { fill: '#fdfcf8' }); ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
        ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(o.tilt || -.05); ctx.fillRect(-W * .38, -H * .44, W * .76, H * .88);
        ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'destination-out'; ctx.fillRect(-W * .33, -H * .39, W * .66, H * .62); ctx.restore();
        if (o.text) { ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(o.tilt || -.05); text(ctx, o.text, 0, H * .33, S, H * .07, { color: S.ink, which: o.which }); ctx.restore(); } return; }
      if (kind === 'film') { look(ctx, S, { fill: '#111' }); ctx.fillRect(0, 0, W, H * .14); ctx.fillRect(0, H * .86, W, H * .14);
        ctx.globalCompositeOperation = 'destination-out'; for (let x = W * .02; x < W; x += W * .07) { rrect(ctx, x, H * .035, W * .035, H * .07, 4); ctx.fill(); rrect(ctx, x, H * .895, W * .035, H * .07, 4); ctx.fill(); } ctx.globalCompositeOperation = 'source-over'; return; }
      const pts = []; const r = kind === 'rect' ? 0 : Math.min(W, H) * .12, x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      const edge = (a, b, n) => { for (let i = 0; i < n; i++) pts.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]); };
      const corner = (cx, cy, a0) => { for (let i = 0; i < 8; i++) { const a = a0 + i / 8 * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
      edge([x0 + r, y0], [x1 - r, y0], 20); corner(x1 - r, y0 + r, -Math.PI / 2); edge([x1, y0 + r], [x1, y1 - r], 20); corner(x1 - r, y1 - r, 0);
      edge([x1 - r, y1], [x0 + r, y1], 20); corner(x0 + r, y1 - r, Math.PI / 2); edge([x0, y1 - r], [x0, y0 + r], 20); corner(x0 + r, y0 + r, Math.PI); pts.push(pts[0]);
      strokeDraw(ctx, pts, S, p, { lw: o.lw, stroke: o.color });
    },
    // галочка / крестик
    check(ctx, W, H, S, p = 1, o = {}) {
      if (o.ring) { look(ctx, S, { fill: o.ring }); ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.min(W, H) * .42 * E.back(E.clamp(p * 1.5)), 0, TAU); ctx.fill(); }
      const pts = sample(t => t < .4 ? [W * (.28 + t / .4 * .17), H * (.52 + t / .4 * .17)] : [W * (.45 + (t - .4) / .6 * .3), H * (.69 - (t - .4) / .6 * .38)], 30);
      strokeDraw(ctx, pts, S, E.clamp(p * 1.5 - .4), { stroke: o.color || S.c1, lw: o.lw });
    },
    cross(ctx, W, H, S, p = 1, o = {}) {
      const a = sample(t => [W * (.25 + .5 * t), H * (.25 + .5 * t)], 12), b = sample(t => [W * (.75 - .5 * t), H * (.25 + .5 * t)], 12);
      strokeDraw(ctx, a, S, E.clamp(p * 2), { stroke: o.color, lw: o.lw }); strokeDraw(ctx, b, S, E.clamp(p * 2 - 1), { stroke: o.color, lw: o.lw });
    },
    // кнопка (подписаться, лайк)
    button(ctx, W, H, S, p = 1, o = {}) {
      const k = p < 1 ? E.back(E.clamp(p)) : 1, press = o.press ? 1 - .08 * Math.sin(E.clamp(o.press) * Math.PI) : 1;
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(k * press, k * press);
      const w = W * .86, h = Math.min(H * .42, w * .27); look(ctx, S, { fill: o.bg || S.c1 }); rrect(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fill();
      ctx.restore(); ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(k * press, k * press);
      text(ctx, o.text, o.icon ? h * .32 : 0, 0, S, h * .38, { color: o.color || '#fff', which: o.which, caps: o.caps, maxW: w - h * (o.icon ? 1.5 : .8) });
      if (o.icon === 'bell') { ctx.fillStyle = o.color || '#fff'; ctx.beginPath(); const bx = -w / 2 + h * .5; ctx.arc(bx, -h * .03, h * .2, Math.PI, 0); ctx.lineTo(bx + h * .24, h * .16); ctx.lineTo(bx - h * .24, h * .16); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(bx, h * .2, h * .06, 0, TAU); ctx.fill(); }
      ctx.restore();
    },
    // карточка уведомления iOS
    notice(ctx, W, H, S, p = 1, o = {}) {
      const k = p < 1 ? E.out(E.clamp(p)) : 1, w = W * .94, h = Math.min(H * .62, w * .27), x = (W - w) / 2, y = (H - h) / 2 - (1 - k) * H * .4;
      ctx.save(); ctx.globalAlpha = k; ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
      ctx.fillStyle = o.bg || 'rgba(245,245,247,.96)'; rrect(ctx, x, y, w, h, h * .2); ctx.fill(); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      const ic = h * .42; ctx.fillStyle = o.icon || S.c2; rrect(ctx, x + h * .18, y + (h - ic) / 2, ic, ic, ic * .24); ctx.fill();
      text(ctx, (o.glyph || (o.app || 'К')[0]).toUpperCase(), x + h * .18 + ic / 2, y + h / 2, S, ic * .55, { color: '#fff', which: 'body' });
      const tx = x + h * .18 + ic + h * .14, tw = x + w - h * .16 - tx;
      text(ctx, (o.app || 'КОД КРЕАТОРА').toUpperCase(), tx, y + h * .3, S, h * .13, { align: 'left', color: '#8a8a8e', which: 'body', maxW: tw * .7 });
      text(ctx, 'сейчас', x + w - h * .16, y + h * .3, S, h * .13, { align: 'right', color: '#8a8a8e', which: 'body' });
      text(ctx, o.title || 'Новое сообщение', tx, y + h * .52, S, h * .19, { align: 'left', color: '#111', which: 'body', maxW: tw });
      text(ctx, o.text || 'Твой ролик набрал 1 млн 🔥', tx, y + h * .75, S, h * .16, { align: 'left', color: '#333', which: 'body', maxW: tw });
      ctx.restore();
    },
    // курсор-стрелка
    cursor(ctx, W, H, S, p = 1, o = {}) {
      const s = Math.min(W, H) * .7, x = W * .3, y = H * .15; ctx.save(); look(ctx, S, { fill: o.color || '#111', stroke: '#fff', lw: s * .05 });
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + s * .78); ctx.lineTo(x + s * .2, y + s * .6); ctx.lineTo(x + s * .34, y + s * .9); ctx.lineTo(x + s * .44, y + s * .85); ctx.lineTo(x + s * .3, y + s * .56); ctx.lineTo(x + s * .55, y + s * .56); ctx.closePath();
      ctx.stroke(); ctx.fill(); ctx.restore();
      if (o.click) { const c = E.clamp(o.click); ctx.save(); ctx.globalAlpha = 1 - c; ctx.strokeStyle = S.c1; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, s * .1 + c * s * .3, 0, TAU); ctx.stroke(); ctx.restore(); }
    },
    // спиннер загрузки / точки «печатает» / прогресс
    spinner(ctx, W, H, S, t = 0, o = {}) { const n = 12, r = Math.min(W, H) * .32; for (let i = 0; i < n; i++) { const a = i / n * TAU - Math.PI / 2; ctx.globalAlpha = ((i / n - t * 1.2) % 1 + 1) % 1 * .85 + .15; look(ctx, S, { stroke: o.color || S.c1, lw: r * .14 }); ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r * .55, H / 2 + Math.sin(a) * r * .55); ctx.lineTo(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r); ctx.stroke(); } ctx.globalAlpha = 1; },
    dots(ctx, W, H, S, t = 0, o = {}) { L.bubble(ctx, W, H, S, 1, { kind: 'ios', bg: o.bg || '#e9e9eb', line: false }); for (let i = 0; i < 3; i++) { const b = Math.max(0, Math.sin((t * 2.2 - i * .18) * TAU)); ctx.fillStyle = o.color || '#8e8e93'; ctx.beginPath(); ctx.arc(W * (.38 + i * .12), H * .43 - b * H * .05, H * .055, 0, TAU); ctx.fill(); } },
    progress(ctx, W, H, S, p = 1, o = {}) { const w = W * .84, h = H * .16, x = (W - w) / 2, y = H / 2 - h / 2; ctx.fillStyle = o.track || 'rgba(255,255,255,.25)'; rrect(ctx, x, y, w, h, h / 2); ctx.fill(); look(ctx, S, { fill: o.color || S.c1 }); rrect(ctx, x, y, Math.max(h, w * E.clamp(p)), h, h / 2); ctx.fill();
      if (o.pct) text(ctx, Math.round(E.clamp(p) * 100) + '%', W / 2, y - h * 1.2, S, h * 1.1, { color: o.pctColor || S.c1 }); },
    ring(ctx, W, H, S, p = 1, o = {}) { const r = Math.min(W, H) * .36; ctx.lineCap = 'round'; ctx.lineWidth = r * .22; ctx.strokeStyle = o.track || 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, TAU); ctx.stroke(); look(ctx, S, { stroke: o.color || S.c1, lw: r * .22 }); ctx.beginPath(); ctx.arc(W / 2, H / 2, r, -Math.PI / 2, -Math.PI / 2 + TAU * E.clamp(p)); ctx.stroke(); },
    // тумблер iOS
    toggle(ctx, W, H, S, p = 1) { const w = W * .7, h = w * .6, x = (W - w) / 2, y = (H - h) / 2, k = E.inOut(E.clamp(p)); ctx.fillStyle = k > .5 ? '#34C759' : '#e5e5ea'; rrect(ctx, x, y, w, h, h / 2); ctx.fill(); ctx.shadowColor = 'rgba(0,0,0,.2)'; ctx.shadowBlur = 10; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + h / 2 + (w - h) * k, y + h / 2, h * .44, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; },
    // лучи от центра (санбёрст)
    rays(ctx, W, H, S, t = 0, o = {}) { const n = o.n || 24, R = Math.hypot(W, H); ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(t * (o.speed ?? .3)); ctx.fillStyle = o.color || S.c2; ctx.globalAlpha = o.alpha ?? 1;
      for (let i = 0; i < n; i++) { if (i % 2) continue; const a0 = i / n * TAU, a1 = (i + 1) / n * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a0) * R, Math.sin(a0) * R); ctx.lineTo(Math.cos(a1) * R, Math.sin(a1) * R); ctx.closePath(); ctx.fill(); } ctx.restore(); },
    // линии скорости (аниме): по кругу к центру
    speed(ctx, W, H, S, t = 0, o = {}) { const R = rnd(Math.floor(t * 12) + 1), n = o.n || 90, cx = W / 2, cy = H / 2, rmax = Math.hypot(W, H) / 2;
      ctx.fillStyle = o.color || '#000'; for (let i = 0; i < n; i++) { const a = R() * TAU, w = .004 + R() * .012, r0 = rmax * (o.inner ?? .42) * (.85 + R() * .3); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a - w) * rmax * 1.1, cy + Math.sin(a - w) * rmax * 1.1); ctx.lineTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a + w) * rmax * 1.1, cy + Math.sin(a + w) * rmax * 1.1); ctx.fill(); } },
    // сетка / шахматы / точки / полосы
    grid(ctx, W, H, S, o = {}) { const step = o.step || 80; ctx.strokeStyle = o.color || S.c1; ctx.lineWidth = o.lw || 2; ctx.globalAlpha = o.alpha ?? 1; ctx.beginPath(); for (let x = 0; x <= W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); } for (let y = 0; y <= H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); } ctx.stroke(); ctx.globalAlpha = 1; },
    checker(ctx, W, H, S, o = {}) { const s = o.step || 120; for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) { ctx.fillStyle = ((x + y) / s) % 2 ? (o.a || S.c1) : (o.b || S.ink); ctx.fillRect(x, y, s, s); } },
    dotsBg(ctx, W, H, S, o = {}) { const s = o.step || 60; ctx.fillStyle = o.color || S.c1; ctx.globalAlpha = o.alpha ?? 1; for (let y = s / 2; y < H; y += s) for (let x = s / 2; x < W; x += s) { ctx.beginPath(); ctx.arc(x, y, o.r || 5, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; },
    stripes(ctx, W, H, S, o = {}) { const cols = o.colors || [S.c1, S.c2, S.c3], h = H / cols.length; cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * h, W, h + 1); }); },
    noise(ctx, W, H, t = 0, o = {}) { const R = rnd(Math.floor(t * 30) * 7 + (o.seed || 1)), n = o.n || Math.round(W * H / 900); ctx.fillStyle = o.color || '#fff'; for (let i = 0; i < n; i++) { ctx.globalAlpha = R() * (o.alpha ?? .5); const s = R() * (o.size || 2.5) + .5; ctx.fillRect(R() * W, R() * H, s, s); } ctx.globalAlpha = 1; },
    gradient(ctx, W, H, cols, o = {}) { const g = o.radial ? ctx.createRadialGradient(W * (o.cx ?? .5), H * (o.cy ?? .4), 0, W / 2, H / 2, Math.hypot(W, H) * .6) : ctx.createLinearGradient(0, 0, o.horizontal ? W : W * .3, o.horizontal ? 0 : H); cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); },
    blobs(ctx, W, H, cols, o = {}) { const R = rnd(o.seed || 11); cols.forEach(c => { const x = R() * W, y = R() * H, r = Math.max(W, H) * (.25 + R() * .3), g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }); },
    // частицы: сакура, сердечки, искры, пыль — падают/парят по кругу (бесшовный цикл длиной loop секунд)
    particles(ctx, W, H, S, t = 0, o = {}) { const R = rnd(o.seed || 21), n = o.n || 30, loop = o.loop || 3;
      for (let i = 0; i < n; i++) { const x0 = R() * W, ph = R(), sz = Math.min(W, H) * (o.size || .03) * (.5 + R()), sp = o.dir === 'up' ? -1 : 1, sw = R() * TAU;
        const f = ((t / loop) + ph) % 1, y = sp > 0 ? -sz * 2 + f * (H + sz * 4) : H + sz * 2 - f * (H + sz * 4), x = x0 + Math.sin(f * TAU * 2 + sw) * W * .03;
        ctx.save(); ctx.translate(x, y); ctx.rotate(f * TAU * (R() > .5 ? 1 : -1)); ctx.globalAlpha = o.twinkle ? .4 + .6 * Math.abs(Math.sin((f * 6 + ph) * Math.PI)) : (o.alpha ?? 1);
        const g = o.shape || 'dot', c = (o.colors || [S.c1])[i % (o.colors || [S.c1]).length]; ctx.fillStyle = c; ctx.strokeStyle = c;
        if (g === 'petal') { ctx.beginPath(); ctx.ellipse(0, 0, sz, sz * .6, 0, 0, TAU); ctx.fill(); }
        else if (g === 'heart') { ctx.translate(-sz, -sz); L.heart(ctx, sz * 2, sz * 2, Object.assign({}, S, { glow: 0, rough: 0 }), 1, { color: c }); }
        else if (g === 'spark') { ctx.translate(-sz, -sz); L.sparkle(ctx, sz * 2, sz * 2, Object.assign({}, S, { rough: 0 }), 1, { color: c }); }
        else { ctx.beginPath(); ctx.arc(0, 0, sz / 2, 0, TAU); ctx.fill(); }
        ctx.restore(); } ctx.globalAlpha = 1; },
    // окно (терминал, ретро-ОС)
    window(ctx, W, H, S, p = 1, o = {}) { const k = p < 1 ? E.back(E.clamp(p)) : 1, w = W * .9, h = H * .78; ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(k, k);
      look(ctx, S, { fill: o.bg || '#0f141a' }); rrect(ctx, -w / 2, -h / 2, w, h, o.radius ?? 18); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = o.bar || '#1d2530'; rrect(ctx, -w / 2, -h / 2, w, h * .12, [o.radius ?? 18, o.radius ?? 18, 0, 0]); ctx.fill();
      (o.btns || ['#ff5f57', '#febc2e', '#28c840']).forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(-w / 2 + h * .06 + i * h * .07, -h / 2 + h * .06, h * .022, 0, TAU); ctx.fill(); });
      if (o.title) text(ctx, o.title, 0, -h / 2 + h * .06, S, h * .05, { color: o.titleColor || '#9aa4b2', which: 'body' });
      (o.lines || []).forEach((ln, i) => { const shown = Math.floor(E.clamp((o.typing ?? 1) * (o.lines.length) - i) * ln.length); text(ctx, ln.slice(0, shown) + (o.caret && shown < ln.length && shown > 0 ? '▍' : ''), -w / 2 + h * .06, -h / 2 + h * .2 + i * h * .1, S, h * .055, { align: 'left', color: o.colors ? o.colors[i % o.colors.length] : S.c1, which: o.mono ? 'accent' : 'body' }); });
      ctx.restore(); },
    // волна звука
    wave(ctx, W, H, S, t = 0, o = {}) { const n = o.n || 32, bw = W / n * .55; look(ctx, S, { fill: o.color || S.c1 }); for (let i = 0; i < n; i++) { const a = .15 + .85 * Math.abs(Math.sin(i * .7 + t * 6) * Math.sin(i * .23 + t * 2.3)), h = H * .7 * a; rrect(ctx, i * W / n + (W / n - bw) / 2, (H - h) / 2, bw, h, bw / 2); ctx.fill(); } },
    // глитч-полосы
    glitch(ctx, W, H, S, t = 0, o = {}) { const R = rnd(Math.floor(t * 18) + (o.seed || 1)), n = o.n || 12; for (let i = 0; i < n; i++) { if (R() > (o.density ?? .55)) continue; ctx.fillStyle = (o.colors || [S.c1, S.c2, S.c3])[i % 3]; ctx.globalAlpha = .55 + R() * .45; ctx.fillRect(R() * W * .6 - W * .1, R() * H, W * (.2 + R() * .7), H * (.004 + R() * .03)); } ctx.globalAlpha = 1; },
    // сканлайны
    scan(ctx, W, H, t = 0, o = {}) { ctx.fillStyle = o.color || '#000'; ctx.globalAlpha = o.alpha ?? .25; for (let y = 0; y < H; y += o.step || 6) ctx.fillRect(0, y, W, (o.step || 6) / 2); const by = ((t * (o.speed ?? .35)) % 1) * H; ctx.globalAlpha = (o.alpha ?? .25) * .8; ctx.fillStyle = o.band || '#fff'; ctx.fillRect(0, by, W, H * .04); ctx.globalAlpha = 1; },
    // световая утечка (light leak)
    leak(ctx, W, H, t = 0, o = {}) { const cols = o.colors || ['rgba(255,140,60,.9)', 'rgba(255,60,120,.6)', 'rgba(255,220,120,.7)']; ctx.globalCompositeOperation = 'lighter';
      cols.forEach((c, i) => { const ph = t / (o.loop || 3) * TAU + i * 2.1, x = W * (.5 + .45 * Math.cos(ph)), y = H * (.5 + .4 * Math.sin(ph * 1.3)), r = Math.max(W, H) * (.45 + .1 * Math.sin(ph)); const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); });
      ctx.globalCompositeOperation = 'source-over'; },
    // цветок (5 лепестков)
    flower(ctx, W, H, S, p = 1, o = {}) { const k = p < 1 ? E.back(E.clamp(p)) : 1, r = Math.min(W, H) * .2 * k; ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(o.rot || 0); look(ctx, S, { fill: o.color || S.c2 });
      for (let i = 0; i < 5; i++) { ctx.save(); ctx.rotate(i / 5 * TAU); ctx.beginPath(); ctx.ellipse(0, -r * 1.1, r * .75, r * 1.15, 0, 0, TAU); ctx.fill(); ctx.restore(); }
      ctx.shadowBlur = 0; ctx.fillStyle = o.center || S.c3; ctx.beginPath(); ctx.arc(0, 0, r * .55, 0, TAU); ctx.fill(); ctx.restore(); },
    // бантик
    bow(ctx, W, H, S, p = 1, o = {}) { const k = p < 1 ? E.back(E.clamp(p)) : 1, s = Math.min(W, H) * .4 * k; ctx.save(); ctx.translate(W / 2, H / 2); look(ctx, S, { fill: o.color || S.c2 });
      [-1, 1].forEach(d => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(d * s * .5, -s * .9, d * s * 1.2, -s * .5, d * s, 0); ctx.bezierCurveTo(d * s * 1.2, s * .5, d * s * .5, s * .5, 0, 0); ctx.fill(); ctx.beginPath(); ctx.moveTo(d * s * .05, s * .05); ctx.lineTo(d * s * .5, s * .95); ctx.lineTo(d * s * .25, s * .9); ctx.lineTo(0, s * .15); ctx.fill(); });
      ctx.fillStyle = o.knot || S.c1; ctx.beginPath(); ctx.ellipse(0, 0, s * .17, s * .2, 0, 0, TAU); ctx.fill(); ctx.restore(); },
    // шахматный конь (силуэт КК, упрощённый)
    knight(ctx, W, H, S, p = 1, o = {}) { const k = p < 1 ? E.back(E.clamp(p)) : 1, s = Math.min(W, H) * .8 * k; ctx.save(); ctx.translate(W / 2 - s * .4, H / 2 - s * .5); ctx.scale(s / 100, s / 100); look(ctx, S, { fill: o.color || S.c1 });
      ctx.beginPath(); ctx.moveTo(22, 96); ctx.lineTo(78, 96); ctx.lineTo(74, 84); ctx.lineTo(66, 80); ctx.bezierCurveTo(62, 64, 70, 50, 76, 40); ctx.bezierCurveTo(80, 28, 74, 14, 58, 8); ctx.lineTo(52, 0); ctx.lineTo(46, 8);
      ctx.bezierCurveTo(32, 12, 22, 24, 18, 40); ctx.lineTo(12, 52); ctx.bezierCurveTo(10, 58, 16, 62, 22, 58); ctx.lineTo(34, 50); ctx.bezierCurveTo(38, 56, 34, 66, 28, 72); ctx.lineTo(30, 80); ctx.lineTo(24, 84); ctx.closePath(); ctx.fill();
      ctx.fillStyle = o.eye || S.ink; ctx.beginPath(); ctx.arc(46, 24, 4, 0, TAU); ctx.fill(); ctx.restore(); },
    // кадр «REC» VHS
    rec(ctx, W, H, S, t = 0, o = {}) { const on = (t % 1) < .55; if (on) { ctx.fillStyle = '#ff2b2b'; ctx.beginPath(); ctx.arc(W * .14, H / 2, H * .18, 0, TAU); ctx.fill(); }
      text(ctx, 'REC', W * .26, H / 2, S, H * .42, { color: '#fff', align: 'left', maxW: W * .3 }); const s = Math.floor(t) % 60; text(ctx, '00:0' + Math.floor(t / 60) + ':' + (s < 10 ? '0' : '') + s, W * .98, H / 2, S, H * .3, { color: '#fff', which: 'body', align: 'right', maxW: W * .4 }); }
  };
  G.KKL = { L, E, rnd, text, rrect, look, path, sample, TAU };
})(window);

/* ---- styles.js ---- */
/* Состав 6 стилевых наборов. Размеры: элементы 1024×1024, плашки 1600×600,
   фоны/оверлеи/переходы — под кадр (v 1080×1920, h 1920×1080).
   png — статика; an — циклы (t, сек); ov — оверлеи на весь кадр (t); tr — переходы (p 0..1, закрывают кадр в середине);
   bg — фоны; tx — пустые плашки под текст. key — цвет фона для хромакея в CapCut. */
(function (G) {
  const { L, E, rnd, text, rrect, TAU, look } = G.KKL;
  const P = (id, name, draw) => ({ id, name, draw });
  const A = (id, name, draw, dur = 2) => ({ id, name, draw, dur });

  /* ---------- переходы (общие) ---------- */
  const T = {
    iris(color, inner) { return (ctx, W, H, S, p) => { const R = Math.hypot(W, H) / 2;
      if (p < .5) { const k = E.inOut(p / .5); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(W / 2, H / 2, R * k, 0, TAU); ctx.fill(); if (inner) { ctx.fillStyle = inner; ctx.beginPath(); ctx.arc(W / 2, H / 2, R * k * .7, 0, TAU); ctx.fill(); } }
      else { const k = E.inOut((p - .5) / .5); ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(W / 2, H / 2, R * k * 1.02, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; } }; },
    stripes(colors, angle = -.35) { return (ctx, W, H, S, p) => { const n = colors.length * 2, D = Math.hypot(W, H); ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(angle);
      for (let i = 0; i < n; i++) { const d = i / n * .35, k = p < .5 ? E.inOut(E.clamp((p - d * .5) / (.5 - .175))) : 1 + E.inOut(E.clamp((p - .5 - d * .5) / (.5 - .175)));
        const h = D / n + 2, y = -D / 2 + i * D / n, x = -D + k * D; ctx.fillStyle = colors[i % colors.length]; ctx.fillRect(x - D / 2, y, D, h); } ctx.restore(); }; },
    blocks(colors, size = 6) { return (ctx, W, H, S, p) => { const cols = size, rows = Math.ceil(cols * H / W), w = W / cols, h = H / rows, R = rnd(9);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const d = R() * .3, on = p < .5 ? E.clamp((p - d * .5) / .25) : 1 - E.clamp((p - .5 - d * .5) / .25);
        if (on <= 0) continue; ctx.fillStyle = colors[(x + y) % colors.length]; const s = E.out(on); ctx.fillRect(x * w + w * (1 - s) / 2, y * h + h * (1 - s) / 2, w * s + 1, h * s + 1); } }; },
    shape(fn, color, spin = 1) { return (ctx, W, H, S, p) => { const R = Math.hypot(W, H) * 1.25;
      if (p < .5) { const k = E.inOut(p / .5); ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(k * spin); fn(ctx, R * k, color); ctx.restore(); }
      else { const k = E.inOut((p - .5) / .5); ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'destination-out'; ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-k * spin); fn(ctx, R * k, '#000'); ctx.restore(); ctx.globalCompositeOperation = 'source-over'; } }; },
    flash(color, rays) { return (ctx, W, H, S, p) => { const a = p < .5 ? E.out(p / .5) : 1 - E.inOut((p - .5) / .5); ctx.globalAlpha = a; ctx.fillStyle = color; ctx.fillRect(0, 0, W, H);
      if (rays) { ctx.globalAlpha = a * .8; L.rays(ctx, W, H, S, p * 2, { color: rays, n: 32, speed: 1 }); } ctx.globalAlpha = 1; }; },
    slide(color, deco) { return (ctx, W, H, S, p) => { const k = p < .5 ? E.inOut(p / .5) - 1 : E.inOut((p - .5) / .5); ctx.save(); ctx.translate(k * W * 1.05, 0); ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); if (deco) deco(ctx, W, H, S); ctx.restore(); }; },
    glitch(colors) { return (ctx, W, H, S, p) => { const a = 1 - Math.abs(p - .5) * 2, R = rnd(Math.floor(p * 30) + 3);
      if (a > .85) { ctx.fillStyle = colors[0]; ctx.fillRect(0, 0, W, H); }
      for (let i = 0; i < 40; i++) { if (R() > a + .1) continue; ctx.fillStyle = colors[i % colors.length]; ctx.fillRect(R() * W - W * .2, R() * H, W * (.3 + R() * .9), H * (.01 + R() * .08) * (.5 + a)); } }; }
  };
  const heartShape = (ctx, s, c) => { ctx.fillStyle = c; ctx.beginPath(); for (let i = 0; i <= 90; i++) { const a = i / 90 * TAU, x = 16 * Math.pow(Math.sin(a), 3), y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); ctx.lineTo(x / 17 * s, -y / 17 * s); } ctx.fill(); };
  const starShape = n => (ctx, s, c) => { ctx.fillStyle = c; ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n - Math.PI / 2, r = i % 2 ? s * .45 : s; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.fill(); };
  const squareShape = (ctx, s, c) => { ctx.fillStyle = c; ctx.fillRect(-s * .7, -s * .7, s * 1.4, s * 1.4); };

  /* ---------- стили ---------- */
  const STYLES = {};

  /* iOS / интерфейсы */
  STYLES.ios = { name: 'iOS и интерфейсы', key: '#FF00FF', // в элементах есть зелёный — хромакей по розовому
    S: { c1: '#0A84FF', c2: '#34C759', c3: '#FF375F', ink: '#1C1C1E', font: 'Inter-Bold', fontBody: 'Inter-Medium', lw: 26, rough: 0, glow: 0, shadow: 1 },
    png: [
      P('notice', 'Уведомление', (c, W, H, S) => L.notice(c, W, H, S, 1, {})),
      P('notice-like', 'Уведомление «лайк»', (c, W, H, S) => L.notice(c, W, H, S, 1, { title: 'Новый лайк ❤️', text: 'Клиент оценил твой монтаж', icon: '#FF375F' })),
      P('notice-pay', 'Уведомление «оплата»', (c, W, H, S) => L.notice(c, W, H, S, 1, { app: 'Банк', title: 'Поступление +25 000 ₽', text: 'Оплата за ролик', icon: '#34C759' })),
      P('msg-blue', 'Сообщение синее', (c, W, H, S) => L.bubble(c, W, H, S, 1, { kind: 'ios', bg: '#0A84FF', line: false, text: 'Готово? 😍', color: '#fff', tail: 'right', which: 'body' })),
      P('msg-gray', 'Сообщение серое', (c, W, H, S) => L.bubble(c, W, H, S, 1, { kind: 'ios', bg: '#E9E9EB', line: false, text: 'Смотри, что вышло', color: '#111', which: 'body' })),
      P('typing', 'Печатает…', (c, W, H, S) => L.dots(c, W, H, S, .1)),
      P('btn-sub', 'Кнопка «Подписаться»', (c, W, H, S) => L.button(c, W, H, S, 1, { text: 'Подписаться', icon: 'bell' })),
      P('btn-follow', 'Кнопка «Follow»', (c, W, H, S) => L.button(c, W, H, S, 1, { text: 'Follow', bg: '#1C1C1E' })),
      P('like', 'Лайк', (c, W, H, S) => L.heart(c, W, H, S, 1, { color: '#FF375F', shine: 1 })),
      P('toggle-on', 'Тумблер вкл', (c, W, H, S) => L.toggle(c, W, H, S, 1)),
      P('toggle-off', 'Тумблер выкл', (c, W, H, S) => L.toggle(c, W, H, S, 0)),
      P('cursor', 'Курсор', (c, W, H, S) => L.cursor(c, W, H, S, 1, {})),
      P('check', 'Готово ✓', (c, W, H, S) => L.check(c, W, H, S, 1, { ring: '#34C759', color: '#fff', lw: 60 })),
      P('progress', 'Загрузка 72%', (c, W, H, S) => L.progress(c, W, H, S, .72, { track: '#E5E5EA', pct: 1, pctColor: '#1C1C1E' })),
      P('ring', 'Кольцо прогресса', (c, W, H, S) => L.ring(c, W, H, S, .8, { track: '#E5E5EA', color: '#34C759' })),
      P('label-new', 'Плашка NEW', (c, W, H, S) => L.label(c, W, H, S, 1, { text: 'NEW', bg: '#FF375F', color: '#fff' })),
      P('label-live', 'Плашка LIVE', (c, W, H, S) => L.label(c, W, H, S, 1, { text: '● LIVE', bg: '#FF3B30', color: '#fff' })),
      P('search', 'Поиск', (c, W, H, S) => { const w = W * .9, h = H * .16; c.fillStyle = '#E9E9EB'; rrect(c, (W - w) / 2, H / 2 - h / 2, w, h, h * .3); c.fill(); text(c, '🔍  Как монтировать рилс', W / 2 - w / 2 + h * .4, H / 2, S, h * .38, { align: 'left', color: '#8E8E93', which: 'body' }); }),
      P('arrow', 'Стрелка', (c, W, H, S) => L.arrow(c, W, H, S, 1, { bend: .3 })),
      P('circle', 'Обвести', (c, W, H, S) => L.circle(c, W, H, S, 1, { color: '#FF375F' }))
    ],
    an: [
      A('notice-in', 'Уведомление выезжает', (c, W, H, S, t) => L.notice(c, W, H, S, E.clamp(t / .6), {}), 2),
      A('typing', 'Печатает…', (c, W, H, S, t) => L.dots(c, W, H, S, t), 2),
      A('like-pop', 'Лайк', (c, W, H, S, t) => L.heart(c, W, H, S, E.clamp(t / .5), { color: '#FF375F', shine: 1, scale: 1 + .06 * Math.sin(Math.max(0, t - .5) * 8) }), 2),
      A('spinner', 'Загрузка', (c, W, H, S, t) => L.spinner(c, W, H, S, t, { color: '#8E8E93' }), 2),
      A('progress', 'Прогресс 0→100', (c, W, H, S, t) => L.progress(c, W, H, S, E.inOut(E.clamp(t / 1.6)), { track: '#E5E5EA', pct: 1, pctColor: '#1C1C1E' }), 2),
      A('toggle', 'Тумблер', (c, W, H, S, t) => L.toggle(c, W, H, S, E.clamp((t - .5) / .3)), 2),
      A('cursor-click', 'Клик курсором', (c, W, H, S, t) => L.cursor(c, W, H, S, 1, { click: E.clamp((t % 1) / .6) }), 2),
      A('btn-sub', 'Нажатие «Подписаться»', (c, W, H, S, t) => L.button(c, W, H, S, E.clamp(t / .4), { text: t > 1 ? 'Вы подписаны' : 'Подписаться', bg: t > 1 ? '#8E8E93' : '#0A84FF', icon: 'bell', press: E.clamp((t - .7) / .3) }), 2)
    ],
    ov: [
      A('camera', 'Интерфейс камеры', (c, W, H, S, t) => { L.frame(c, W, H, Object.assign({}, S, { c1: '#fff', shadow: 0 }), 1, { kind: 'brackets', lw: 6 }); if ((t % 1) < .6) { c.fillStyle = '#FF3B30'; c.beginPath(); c.arc(W / 2 - 90, H * .06, 12, 0, TAU); c.fill(); } text(c, '00:0' + Math.floor(t) + ':' + String(Math.floor(t * 30 % 30)).padStart(2, '0'), W / 2 + 20, H * .06, S, 34, { color: '#fff', which: 'body' }); }, 3),
      A('hearts', 'Лайки летят вверх', (c, W, H, S, t) => L.particles(c, W, H, S, t, { shape: 'heart', dir: 'up', n: 18, size: .045, colors: ['#FF375F', '#ff7aa2', '#fff'], loop: 3, seed: 4 }), 3),
      A('bokeh', 'Мягкие блики', (c, W, H, S, t) => { c.globalCompositeOperation = 'lighter'; L.particles(c, W, H, S, t, { n: 26, size: .09, colors: ['rgba(255,255,255,.18)', 'rgba(10,132,255,.2)'], dir: 'up', loop: 3, seed: 8 }); }, 3),
      A('sparkles', 'Искры', (c, W, H, S, t) => L.particles(c, W, H, S, t, { shape: 'spark', n: 24, size: .02, colors: ['#fff'], twinkle: 1, dir: 'up', loop: 3, seed: 12 }), 3)
    ],
    tr: [
      A('slide', 'Шторка-сдвиг', T.slide('#F2F2F7'), 1), A('iris', 'Круг', T.iris('#0A84FF'), 1), A('blocks', 'Плитки', T.blocks(['#0A84FF', '#34C759', '#FF375F', '#F2F2F7'], 5), 1),
      A('stripes', 'Полосы', T.stripes(['#0A84FF', '#F2F2F7', '#FF375F']), 1), A('flash', 'Белая вспышка', T.flash('#ffffff'), 1), A('heart', 'Сердце', T.shape(heartShape, '#FF375F', .4), 1)
    ],
    bg: [
      P('light', 'Светлый iOS', (c, W, H) => L.gradient(c, W, H, ['#F2F2F7', '#E5E5EA'])),
      P('dark', 'Тёмный iOS', (c, W, H) => L.gradient(c, W, H, ['#1C1C1E', '#000000'])),
      P('blue', 'Синий градиент', (c, W, H) => L.gradient(c, W, H, ['#5AC8FA', '#0A84FF', '#5E5CE6'])),
      P('wallpaper', 'Обои-блики', (c, W, H) => { L.gradient(c, W, H, ['#0b1026', '#1b1f4a']); L.blobs(c, W, H, ['rgba(255,55,95,.55)', 'rgba(10,132,255,.6)', 'rgba(52,199,89,.45)'], { seed: 5 }); }),
      P('grid', 'Сетка', (c, W, H, S) => { c.fillStyle = '#F2F2F7'; c.fillRect(0, 0, W, H); L.grid(c, W, H, S, { color: '#D1D1D6', step: 60, lw: 2 }); }),
      P('pastel', 'Пастель', (c, W, H) => { L.gradient(c, W, H, ['#fde2e4', '#e2ece9', '#dfe7fd']); })
    ],
    tx: [
      P('card', 'Карточка', (c, W, H) => { c.shadowColor = 'rgba(0,0,0,.18)'; c.shadowBlur = 40; c.shadowOffsetY = 14; c.fillStyle = 'rgba(255,255,255,.96)'; rrect(c, W * .04, H * .1, W * .92, H * .8, H * .18); c.fill(); }),
      P('card-dark', 'Карточка тёмная', (c, W, H) => { c.fillStyle = 'rgba(28,28,30,.92)'; rrect(c, W * .04, H * .1, W * .92, H * .8, H * .18); c.fill(); }),
      P('pill-blue', 'Плашка синяя', (c, W, H) => { c.fillStyle = '#0A84FF'; rrect(c, W * .04, H * .22, W * .92, H * .56, H * .28); c.fill(); }),
      P('pill-red', 'Плашка красная', (c, W, H) => { c.fillStyle = '#FF375F'; rrect(c, W * .04, H * .22, W * .92, H * .56, H * .28); c.fill(); }),
      P('glass', 'Стекло', (c, W, H) => { c.fillStyle = 'rgba(255,255,255,.35)'; rrect(c, W * .04, H * .1, W * .92, H * .8, H * .18); c.fill(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 4; c.stroke(); }),
      P('bubble', 'Пузырь сообщения', (c, W, H, S) => L.bubble(c, W, H, S, 1, { kind: 'ios', bg: '#0A84FF', line: false, tail: 'right' }))
    ]
  };

  /* Романтика / нежно */
  const ROSE = '#E8A0B4', BLUSH = '#F7C6CF', LILAC = '#C9B8E8', PLUM = '#7A4E5C', CREAM = '#FFF4F1';
  STYLES.romance = { name: 'Романтика / нежно', key: '#00B140',
    S: { c1: ROSE, c2: BLUSH, c3: LILAC, ink: PLUM, font: 'CormorantInfant-SemiBold', fontBody: 'MarckScript', lw: 20, rough: .6, glow: 22, glowColor: 'rgba(255,255,255,.9)' },
    png: [
      P('heart', 'Сердце', (c, W, H, S) => L.heart(c, W, H, S, 1, { color: ROSE, shine: 1 })),
      P('heart-line', 'Сердце-контур', (c, W, H, S) => L.heart(c, W, H, Object.assign({}, S, { glow: 0 }), 1, { outlineOnly: 1, line: PLUM, lw: 18 })),
      P('heart-blush', 'Сердце нежное', (c, W, H, S) => L.heart(c, W, H, S, 1, { color: BLUSH, line: '#fff', lw: 14, shine: 1 })),
      P('hearts-3', 'Три сердечка', (c, W, H, S) => { [[.3, .4, .5], [.62, .32, .65], [.5, .66, .4]].forEach(h => { c.save(); c.translate(W * h[0] - W * h[2] / 2, H * h[1] - H * h[2] / 2); L.heart(c, W * h[2], H * h[2], S, 1, { color: [ROSE, BLUSH, LILAC][Math.round(h[2] * 10) % 3], shine: 1 }); c.restore(); }); }),
      P('sparkle', 'Искра', (c, W, H, S) => L.sparkle(c, W, H, S, 1, { color: '#fff', inner: .12 })),
      P('sparkles', 'Искорки', (c, W, H, S) => { [[.35, .35, .6], [.7, .6, .35], [.3, .72, .25]].forEach(h => { c.save(); c.translate(W * h[0] - W * h[2] / 2, H * h[1] - H * h[2] / 2); L.sparkle(c, W * h[2], H * h[2], S, 1, { color: '#fff', inner: .12 }); c.restore(); }); }),
      P('flower', 'Цветок', (c, W, H, S) => L.flower(c, W, H, S, 1, { color: BLUSH, center: '#F6D186' })),
      P('flower-lilac', 'Цветок сиреневый', (c, W, H, S) => L.flower(c, W, H, S, 1, { color: LILAC, center: '#fff', rot: .3 })),
      P('bow', 'Бантик', (c, W, H, S) => L.bow(c, W, H, S, 1, { color: ROSE, knot: PLUM })),
      P('bow-blush', 'Бантик нежный', (c, W, H, S) => L.bow(c, W, H, S, 1, { color: BLUSH, knot: ROSE })),
      P('polaroid', 'Полароид', (c, W, H, S) => L.frame(c, W, H, S, 1, { kind: 'polaroid', text: 'наш день ♡', which: 'body' })),
      P('frame', 'Нежная рамка', (c, W, H, S) => L.frame(c, W, H, Object.assign({}, S, { rough: .3 }), 1, { color: '#fff', lw: 10 })),
      P('circle', 'Обвести', (c, W, H, S) => L.circle(c, W, H, S, 1, { color: ROSE })),
      P('underline', 'Подчеркнуть', (c, W, H, S) => L.underline(c, W, H, S, 1, { color: ROSE })),
      P('arrow', 'Стрелка от руки', (c, W, H, S) => L.arrow(c, W, H, Object.assign({}, S, { c1: PLUM, glow: 0 }), 1, {})),
      P('label-love', 'с любовью', (c, W, H, S) => L.label(c, W, H, S, 1, { text: 'с любовью', bg: CREAM, color: PLUM, which: 'body', border: 6, borderColor: ROSE })),
      P('label-forever', 'forever', (c, W, H, S) => L.label(c, W, H, S, 1, { text: 'forever', bg: ROSE, color: '#fff', which: 'body' })),
      P('bubble', 'Облачко мысли', (c, W, H, S) => L.bubble(c, W, H, Object.assign({}, S, { glow: 0 }), 1, { kind: 'think', bg: '#fff', line: false, text: 'мечтаю…', color: PLUM, which: 'body' })),
      P('star', 'Звёздочка', (c, W, H, S) => L.star(c, W, H, S, 1, { color: '#F6D186' })),
      P('moon', 'Месяц', (c, W, H, S) => { c.fillStyle = '#F6D186'; c.shadowColor = '#fff'; c.shadowBlur = 30; c.beginPath(); c.arc(W / 2, H / 2, W * .3, 0, TAU); c.fill(); c.globalCompositeOperation = 'destination-out'; c.shadowBlur = 0; c.beginPath(); c.arc(W * .62, H * .42, W * .27, 0, TAU); c.fill(); })
    ],
    an: [
      A('heart-beat', 'Сердце бьётся', (c, W, H, S, t) => L.heart(c, W, H, S, E.clamp(t / .4), { color: ROSE, shine: 1, scale: 1 + .08 * Math.max(0, Math.sin(t * TAU * 1.2)) }), 2),
      A('sparkle', 'Искра мерцает', (c, W, H, S, t) => L.sparkle(c, W, H, S, 1, { color: '#fff', inner: .12, scale: .7 + .3 * Math.abs(Math.sin(t * Math.PI)), rot: t * .8 }), 2),
      A('circle-draw', 'Обводка рисуется', (c, W, H, S, t) => L.circle(c, W, H, S, E.clamp(t / 1), { color: ROSE }), 2),
      A('underline-draw', 'Подчёркивание рисуется', (c, W, H, S, t) => L.underline(c, W, H, S, E.clamp(t / .8), { color: ROSE }), 2),
      A('arrow-draw', 'Стрелка рисуется', (c, W, H, S, t) => L.arrow(c, W, H, Object.assign({}, S, { c1: PLUM, glow: 0 }), E.clamp(t / 1), {}), 2),
      A('flower-spin', 'Цветок крутится', (c, W, H, S, t) => L.flower(c, W, H, S, E.clamp(t / .5), { color: BLUSH, center: '#F6D186', rot: t * .9 }), 2),
      A('bow-pop', 'Бантик', (c, W, H, S, t) => L.bow(c, W, H, S, E.clamp(t / .5), { color: ROSE, knot: PLUM }), 2),
      A('hearts-up', 'Сердечки вверх', (c, W, H, S, t) => L.particles(c, W, H, S, t, { shape: 'heart', dir: 'up', n: 9, size: .07, colors: [ROSE, BLUSH, LILAC], loop: 2, seed: 3 }), 2)
    ],
    ov: [
      A('leak', 'Тёплая засветка', (c, W, H, S, t) => L.leak(c, W, H, t, { colors: ['rgba(255,170,150,.75)', 'rgba(255,120,170,.5)', 'rgba(255,230,180,.6)'], loop: 3 }), 3),
      A('bokeh', 'Боке', (c, W, H, S, t) => { c.globalCompositeOperation = 'lighter'; L.particles(c, W, H, S, t, { n: 30, size: .08, colors: ['rgba(255,200,210,.25)', 'rgba(255,255,255,.2)', 'rgba(201,184,232,.25)'], dir: 'up', loop: 3, seed: 6 }); }, 3),
      A('hearts', 'Падающие сердечки', (c, W, H, S, t) => L.particles(c, W, H, Object.assign({}, S, { glow: 0 }), t, { shape: 'heart', n: 22, size: .025, colors: [ROSE, BLUSH, '#fff'], loop: 3, seed: 9 }), 3),
      A('sparkles', 'Мерцание', (c, W, H, S, t) => L.particles(c, W, H, S, t, { shape: 'spark', n: 30, size: .018, colors: ['#fff', '#FFE7A8'], twinkle: 1, dir: 'up', loop: 3, seed: 14 }), 3)
    ],
    tr: [
      A('heart', 'Сердце', T.shape(heartShape, ROSE, .3), 1), A('iris', 'Нежный круг', T.iris(BLUSH, ROSE), 1), A('flash', 'Засветка', T.flash('#FFF0F3'), 1),
      A('stripes', 'Ленты', T.stripes([BLUSH, ROSE, LILAC, CREAM], -.25), 1), A('slide', 'Шторка с сердцами', T.slide(BLUSH, (c, W, H, S) => L.particles(c, W, H, Object.assign({}, S, { glow: 0 }), .5, { shape: 'heart', n: 14, size: .04, colors: ['#fff'], seed: 2 })), 1),
      A('star', 'Звезда', T.shape(starShape(5), '#F6D186', .8), 1)
    ],
    bg: [
      P('blush', 'Пудровый', (c, W, H) => L.gradient(c, W, H, [CREAM, BLUSH])),
      P('dream', 'Мечта', (c, W, H) => { L.gradient(c, W, H, ['#fdf1f4', '#efe4fb']); L.blobs(c, W, H, ['rgba(247,198,207,.8)', 'rgba(201,184,232,.7)', 'rgba(255,255,255,.8)'], { seed: 3 }); }),
      P('sunset', 'Закат', (c, W, H) => L.gradient(c, W, H, ['#FBD3C1', '#F7C6CF', '#C9B8E8'])),
      P('hearts', 'В сердечко', (c, W, H, S) => { c.fillStyle = CREAM; c.fillRect(0, 0, W, H); const s = 120; for (let y = 0; y < H + s; y += s) for (let x = (y / s % 2) * s / 2; x < W + s; x += s) { c.save(); c.translate(x - 22, y - 22); L.heart(c, 44, 44, Object.assign({}, S, { glow: 0, rough: 0 }), 1, { color: BLUSH }); c.restore(); } }),
      P('dots', 'Горошек', (c, W, H, S) => { c.fillStyle = '#FFF7F8'; c.fillRect(0, 0, W, H); L.dotsBg(c, W, H, S, { color: BLUSH, step: 70, r: 9 }); }),
      P('night', 'Звёздная ночь', (c, W, H, S) => { L.gradient(c, W, H, ['#2b1d3a', '#5a3d63']); L.noise(c, W, H, 0, { n: Math.round(W * H / 4000), size: 3, alpha: .9 }); })
    ],
    tx: [
      P('cream', 'Кремовая', (c, W, H) => { c.fillStyle = CREAM; c.strokeStyle = ROSE; c.lineWidth = 6; rrect(c, W * .04, H * .15, W * .92, H * .7, H * .35); c.fill(); c.stroke(); }),
      P('rose', 'Розовая', (c, W, H) => { c.fillStyle = ROSE; rrect(c, W * .04, H * .2, W * .92, H * .6, H * .3); c.fill(); }),
      P('lace', 'Кружевная', (c, W, H) => { c.fillStyle = '#fff'; rrect(c, W * .06, H * .18, W * .88, H * .64, 30); c.fill(); c.fillStyle = '#fff'; for (let x = W * .06; x < W * .94; x += 44) { c.beginPath(); c.arc(x + 22, H * .18, 22, Math.PI, 0); c.fill(); c.beginPath(); c.arc(x + 22, H * .82, 22, 0, Math.PI); c.fill(); } }),
      P('glow', 'Сияние', (c, W, H) => { const g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * .5); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }),
      P('lilac', 'Сиреневая', (c, W, H) => { c.fillStyle = LILAC; rrect(c, W * .04, H * .2, W * .92, H * .6, 24); c.fill(); }),
      P('heart-plate', 'С сердечком', (c, W, H, S) => { c.fillStyle = CREAM; rrect(c, W * .08, H * .2, W * .84, H * .6, H * .3); c.fill(); c.save(); c.translate(W * .84, H * .02); L.heart(c, 220, 220, S, 1, { color: ROSE, shine: 1 }); c.restore(); })
    ]
  };

  /* Технологичный / IT */
  const NEON = '#00FF9C', CYAN = '#00B3FF', VIO = '#7A5CFF', DARK = '#0B0F14';
  STYLES.tech = { name: 'Технологичный / IT', key: '#FF00FF',
    S: { c1: NEON, c2: CYAN, c3: VIO, ink: DARK, font: 'JetBrainsMono-Bold', fontBody: 'Inter-Medium', lw: 16, rough: 0, glow: 18 },
    png: [
      P('terminal', 'Терминал', (c, W, H, S) => L.window(c, W, H, S, 1, { title: 'zsh — montage', mono: 1, lines: ['$ npm run reels', '> рендер 1080×1920', '> добавляю субтитры…', '✓ готово за 12 сек'], colors: ['#E6EDF3', NEON, CYAN, NEON] })),
      P('code', 'Код', (c, W, H, S) => L.window(c, W, H, S, 1, { title: 'creator.js', mono: 1, lines: ['const idea = "🔥";', 'edit(idea, {', '  speed: "x2",', '  vibe: "tech"', '});'], colors: [VIO, '#E6EDF3', CYAN, CYAN, '#E6EDF3'] })),
      P('ai-chat', 'Чат с ИИ', (c, W, H, S) => L.bubble(c, W, H, Object.assign({}, S, { glow: 0 }), 1, { kind: 'round', bg: '#161B22', line: NEON, text: 'ИИ: готово ✨', color: NEON, lw: 6 })),
      P('brackets', 'HUD-уголки', (c, W, H, S) => L.frame(c, W, H, S, 1, { kind: 'brackets', lw: 10 })),
      P('target', 'Прицел', (c, W, H, S) => { look(c, S, { lw: 8 }); c.beginPath(); c.arc(W / 2, H / 2, W * .3, 0, TAU); c.stroke(); c.beginPath(); c.arc(W / 2, H / 2, W * .08, 0, TAU); c.stroke(); [[0, -1], [0, 1], [1, 0], [-1, 0]].forEach(d => { c.beginPath(); c.moveTo(W / 2 + d[0] * W * .2, H / 2 + d[1] * H * .2); c.lineTo(W / 2 + d[0] * W * .42, H / 2 + d[1] * H * .42); c.stroke(); }); }),
      P('chip', 'Чип', (c, W, H, S) => { look(c, S, { fill: '#161B22', lw: 8 }); rrect(c, W * .28, H * .28, W * .44, H * .44, 20); c.fill(); c.stroke(); for (let i = 0; i < 5; i++) { const o = W * (.33 + i * .085); [[o, H * .28, o, H * .16], [o, H * .72, o, H * .84], [W * .28, o, W * .16, o], [W * .72, o, W * .84, o]].forEach(l => { c.beginPath(); c.moveTo(l[0], l[1]); c.lineTo(l[2], l[3]); c.stroke(); }); } text(c, 'AI', W / 2, H / 2, S, W * .14, { color: NEON, glow: 1 }); }),
      P('label-ai', 'Плашка AI', (c, W, H, S) => L.label(c, W, H, S, 1, { text: 'AI', bg: '#161B22', color: NEON, border: 6, borderColor: NEON })),
      P('label-new', 'NEW FEATURE', (c, W, H, S) => L.label(c, W, H, S, 1, { text: 'NEW FEATURE', bg: VIO, color: '#fff', radius: 10 })),
      P('label-beta', 'beta', (c, W, H, S) => L.label(c, W, H, S, 1, { text: 'beta', bg: 'transparent', color: CYAN, border: 6, borderColor: CYAN, radius: 10 })),
      P('progress', 'Загрузка', (c, W, H, S) => L.progress(c, W, H, S, .64, { track: '#161B22', pct: 1, pctColor: NEON })),
      P('wave', 'Звуковая волна', (c, W, H, S) => L.wave(c, W, H, S, .3, { color: CYAN })),
      P('cursor', 'Курсор', (c, W, H, S) => L.cursor(c, W, H, Object.assign({}, S, { glow: 0 }), 1, { color: DARK })),
      P('arrow', 'Стрелка', (c, W, H, S) => L.arrow(c, W, H, S, 1, { bend: .2 })),
      P('circle', 'Выделить', (c, W, H, S) => L.circle(c, W, H, S, 1, { color: NEON })),
      P('check', 'OK', (c, W, H, S) => L.check(c, W, H, S, 1, { ring: '#161B22', color: NEON, lw: 50 })),
      P('cross', 'Ошибка', (c, W, H, S) => L.cross(c, W, H, Object.assign({}, S, { glowColor: '#ff3b6b' }), 1, { color: '#ff3b6b', lw: 50 })),
      P('binary', 'Бинарный код', (c, W, H, S) => { const R = rnd(4); for (let y = 0; y < 10; y++) text(c, Array.from({ length: 12 }, () => R() > .5 ? '1' : '0').join(' '), W / 2, H * (.1 + y * .085), S, W * .055, { color: y % 3 ? NEON : CYAN }); }),
      P('graph', 'График роста', (c, W, H, S) => { look(c, S, { lw: 12 }); const pts = [[.1, .8], [.3, .62], [.45, .68], [.62, .42], [.78, .46], [.92, .16]]; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(W * p[0], H * p[1]) : c.moveTo(W * p[0], H * p[1])); c.stroke(); pts.forEach(p => { c.beginPath(); c.arc(W * p[0], H * p[1], 14, 0, TAU); c.fill(); }); }),
      P('qr', 'QR-блок', (c, W, H, S) => { const R = rnd(17), n = 21, s = W * .7 / n; c.fillStyle = NEON; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const corner = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13); const v = corner ? ((x % 6 === 0 || y % 6 === 0 || (x % 7 > 1 && x % 7 < 5 && y % 7 > 1 && y % 7 < 5)) && !(x % 7 === 6 && 0)) : R() > .5; if (v) c.fillRect(W * .15 + x * s, H * .15 + y * s, s - 1, s - 1); } }),
      P('window-err', 'Окно ошибки', (c, W, H, S) => L.window(c, W, H, S, 1, { title: 'system', mono: 1, lines: ['⚠ ERROR 404', 'креатив не найден', '> перезапуск…'], colors: ['#ff3b6b', '#E6EDF3', NEON] }))
    ],
    an: [
      A('terminal-type', 'Терминал печатает', (c, W, H, S, t) => L.window(c, W, H, S, 1, { title: 'zsh — montage', mono: 1, typing: E.clamp(t / 1.6), caret: 1, lines: ['$ npm run reels', '> рендер 1080×1920', '> добавляю субтитры…', '✓ готово за 12 сек'], colors: ['#E6EDF3', NEON, CYAN, NEON] }), 2),
      A('scan-target', 'Прицел сканирует', (c, W, H, S, t) => { c.save(); c.translate(W / 2, H / 2); c.rotate(t * 1.5); c.translate(-W / 2, -H / 2); look(c, S, { lw: 8 }); c.beginPath(); c.arc(W / 2, H / 2, W * .3, 0, TAU * .8); c.stroke(); c.restore(); look(c, S, { lw: 6, stroke: CYAN }); c.beginPath(); c.arc(W / 2, H / 2, W * .08 * (1 + .3 * Math.sin(t * 8)), 0, TAU); c.stroke(); }, 2),
      A('wave', 'Волна звука', (c, W, H, S, t) => L.wave(c, W, H, S, t, { color: CYAN }), 2),
      A('progress', 'Загрузка 0→100', (c, W, H, S, t) => L.progress(c, W, H, S, E.inOut(E.clamp(t / 1.7)), { track: '#161B22', pct: 1, pctColor: NEON }), 2),
      A('glitch-label', 'Глитч AI', (c, W, H, S, t) => { const R = rnd(Math.floor(t * 15)); c.save(); c.translate((R() - .5) * 30 * (R() > .7), 0); L.label(c, W, H, S, 1, { text: 'AI', bg: '#161B22', color: NEON, border: 6, borderColor: NEON }); c.restore(); L.glitch(c, W, H, S, t, { n: 8, density: .4 }); }, 2),
      A('spinner', 'Загрузка-кольцо', (c, W, H, S, t) => { look(c, S, { lw: 26 }); c.beginPath(); c.arc(W / 2, H / 2, W * .3, t * TAU, t * TAU + TAU * .3); c.stroke(); look(c, S, { lw: 26, stroke: VIO }); c.beginPath(); c.arc(W / 2, H / 2, W * .3, -t * TAU * 1.3, -t * TAU * 1.3 + TAU * .2); c.stroke(); }, 2),
      A('brackets-in', 'HUD-уголки', (c, W, H, S, t) => L.frame(c, W, H, S, E.clamp(t / .5), { kind: 'brackets', lw: 10 }), 2),
      A('graph-draw', 'График рисуется', (c, W, H, S, t) => { const pts = [[.1, .8], [.3, .62], [.45, .68], [.62, .42], [.78, .46], [.92, .16]], all = []; for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 10; k++) all.push([W * (pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k / 10), H * (pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k / 10)]); all.push([W * .92, H * .16]); look(c, S, { lw: 12 }); const n = Math.max(2, Math.round(all.length * E.clamp(t / 1.4))); c.beginPath(); all.slice(0, n).forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); }, 2)
    ],
    ov: [
      A('scan', 'Сканлайны', (c, W, H, S, t) => L.scan(c, W, H, t, { color: '#000', band: NEON, alpha: .22, speed: 1 / 3 }), 3),
      A('glitch', 'Глитч', (c, W, H, S, t) => L.glitch(c, W, H, S, t, { n: 16, density: .35 }), 3),
      A('hud', 'HUD-рамка', (c, W, H, S, t) => { L.frame(c, W, H, S, 1, { kind: 'brackets', lw: 6 }); const R = rnd(Math.floor(t * 4) + 1); text(c, 'REC ● ' + (R() * 100).toFixed(1) + '%', W * .08 + 140, H * .05, S, 28, { color: NEON }); text(c, 'AI MODE', W * .92 - 80, H * .05, S, 28, { color: CYAN }); look(c, S, { lw: 3, stroke: CYAN }); c.beginPath(); c.arc(W / 2, H / 2, 40, 0, TAU); c.moveTo(W / 2 - 70, H / 2); c.lineTo(W / 2 - 50, H / 2); c.moveTo(W / 2 + 50, H / 2); c.lineTo(W / 2 + 70, H / 2); c.stroke(); }, 3),
      A('binary', 'Цифровой дождь', (c, W, H, S, t) => { const cols = Math.floor(W / 34), R = rnd(5); c.font = '26px "JetBrainsMono-Bold"'; c.textAlign = 'center'; for (let i = 0; i < cols; i++) { const sp = .5 + R(), off = R(); for (let k = 0; k < 14; k++) { const y = (((t / 3) * sp + off) % 1) * (H + 600) - 300 - k * 34; c.globalAlpha = (1 - k / 14) * .8; c.fillStyle = k ? NEON : '#fff'; c.fillText(R() > .5 ? '1' : '0', i * 34 + 17, y); } } c.globalAlpha = 1; }, 3)
    ],
    tr: [
      A('glitch', 'Глитч', T.glitch([DARK, NEON, CYAN, VIO]), 1), A('blocks', 'Пиксели', T.blocks([DARK, '#161B22', NEON, CYAN], 7), 1), A('stripes', 'Скан-полосы', T.stripes([DARK, NEON, DARK, CYAN], 0), 1),
      A('slide', 'Шторка-терминал', T.slide(DARK, (c, W, H, S) => { L.grid(c, W, H, S, { color: '#1d2a38', step: 60, lw: 2 }); text(c, '> loading…', W / 2, H / 2, S, Math.min(W, H) * .06, { color: NEON, glow: 1 }); }), 1),
      A('iris', 'Кольцо', T.iris(DARK, VIO), 1), A('flash', 'Неоновая вспышка', T.flash(NEON), 1)
    ],
    bg: [
      P('dark', 'Тёмный', (c, W, H) => L.gradient(c, W, H, ['#0B0F14', '#05070A'])),
      P('grid', 'Неоновая сетка', (c, W, H, S) => { L.gradient(c, W, H, ['#0B0F14', '#0d1420']); L.grid(c, W, H, S, { color: '#00FF9C', step: 80, lw: 1.5, alpha: .25 }); }),
      P('cyber', 'Кибер-градиент', (c, W, H) => { L.gradient(c, W, H, ['#05070A', '#130a2a']); L.blobs(c, W, H, ['rgba(122,92,255,.55)', 'rgba(0,179,255,.45)', 'rgba(0,255,156,.25)'], { seed: 9 }); }),
      P('dots', 'Точечная матрица', (c, W, H, S) => { c.fillStyle = DARK; c.fillRect(0, 0, W, H); L.dotsBg(c, W, H, S, { color: CYAN, step: 40, r: 2.5, alpha: .5 }); }),
      P('code', 'Код на фоне', (c, W, H, S) => { c.fillStyle = DARK; c.fillRect(0, 0, W, H); const R = rnd(31), lines = ['const reel = edit(video);', 'if (hook) retention++;', 'render({ fps: 30 });', 'subtitles.style("kk");', 'export default creator;']; c.globalAlpha = .18; for (let y = 40; y < H; y += 46) text(c, lines[Math.floor(R() * 5)], 40 + R() * 200, y, S, 30, { align: 'left', color: R() > .5 ? NEON : CYAN }); c.globalAlpha = 1; }),
      P('violet', 'Фиолетовый', (c, W, H) => L.gradient(c, W, H, ['#1a1040', '#3b1f8f', '#7A5CFF'], { radial: 1 }))
    ],
    tx: [
      P('term', 'Терминал', (c, W, H, S) => L.window(c, W, H, S, 1, { title: 'title.txt' })),
      P('neon', 'Неоновая рамка', (c, W, H, S) => { look(c, S, { lw: 8 }); rrect(c, W * .04, H * .2, W * .92, H * .6, 16); c.fillStyle = 'rgba(11,15,20,.85)'; c.fill(); c.stroke(); }),
      P('violet', 'Фиолетовая', (c, W, H) => { c.fillStyle = VIO; rrect(c, W * .04, H * .22, W * .92, H * .56, 14); c.fill(); }),
      P('hud', 'HUD-рамка', (c, W, H, S) => { c.fillStyle = 'rgba(11,15,20,.6)'; c.fillRect(W * .05, H * .15, W * .9, H * .7); L.frame(c, W, H, S, 1, { kind: 'brackets', lw: 8 }); }),
      P('chip', 'Тег', (c, W, H) => { c.fillStyle = '#161B22'; c.strokeStyle = CYAN; c.lineWidth = 6; rrect(c, W * .04, H * .25, W * .92, H * .5, H * .25); c.fill(); c.stroke(); }),
      P('bar', 'Нижняя полоса', (c, W, H) => { c.fillStyle = 'rgba(11,15,20,.9)'; c.fillRect(0, H * .3, W, H * .4); c.fillStyle = NEON; c.fillRect(0, H * .3, W * .02, H * .4); })
    ]
  };

  /* Аниме */
  const APINK = '#FF4F79', ABLUE = '#3D5AFE', AYEL = '#FFE04D', INK = '#111111';
  STYLES.anime = { name: 'Аниме', key: '#00B140',
    S: { c1: APINK, c2: AYEL, c3: ABLUE, ink: INK, font: 'DelaGothicOne', fontBody: 'RubikBubbles', lw: 28, rough: .3, glow: 0 },
    png: [
      P('bam', 'BAM!', (c, W, H, S) => L.burst(c, W, H, S, 1, { color: AYEL, line: 1, label: 'BAM!', labelColor: APINK, labelOutline: 10 })),
      P('wow', 'ВАУ!', (c, W, H, S) => L.burst(c, W, H, S, 1, { color: APINK, line: 1, label: 'ВАУ!', labelColor: '#fff', labelOutline: 10, seed: 8 })),
      P('shout', 'Крик', (c, W, H, S) => L.bubble(c, W, H, S, 1, { kind: 'shout', bg: '#fff', text: 'ЧТО?!', caps: 1, color: INK })),
      P('bubble', 'Реплика', (c, W, H, S) => L.bubble(c, W, H, S, 1, { kind: 'round', bg: '#fff', text: 'кавай~', color: INK, which: 'body' })),
      P('think', 'Мысль', (c, W, H, S) => L.bubble(c, W, H, S, 1, { kind: 'think', bg: '#fff', line: false, text: '…', color: INK })),
      P('sparkle', 'Блеск', (c, W, H, S) => L.sparkle(c, W, H, S, 1, { color: AYEL, inner: .1 })),
      P('sparkle-pink', 'Блеск розовый', (c, W, H, S) => L.sparkle(c, W, H, S, 1, { color: APINK, inner: .1, rot: .4 })),
      P('heart', 'Сердечко', (c, W, H, S) => L.heart(c, W, H, S, 1, { color: APINK, line: INK, lw: 16, shine: 1 })),
      P('anger', 'Злость', (c, W, H, S) => { look(c, S, { stroke: '#E53935', lw: 34 }); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(d => { c.beginPath(); c.arc(W / 2 + d[0] * W * .19, H / 2 + d[1] * H * .19, W * .16, Math.atan2(-d[1], -d[0]) - .9, Math.atan2(-d[1], -d[0]) + .9); c.stroke(); }); }),
      P('sweat', 'Капля', (c, W, H, S) => { c.fillStyle = '#7EC8FF'; c.strokeStyle = INK; c.lineWidth = 14; c.beginPath(); c.moveTo(W / 2, H * .15); c.bezierCurveTo(W * .82, H * .55, W * .78, H * .85, W / 2, H * .85); c.bezierCurveTo(W * .22, H * .85, W * .18, H * .55, W / 2, H * .15); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(W * .42, H * .62, W * .05, H * .09, -.3, 0, TAU); c.fill(); }),
      P('exclaim', 'Восклицание', (c, W, H, S) => text(c, '!!', W / 2, H / 2, S, H * .7, { color: APINK, outline: 24, outlineColor: INK })),
      P('question', 'Вопрос', (c, W, H, S) => text(c, '?', W / 2, H / 2, S, H * .75, { color: ABLUE, outline: 24, outlineColor: INK })),
      P('speed', 'Линии концентрации', (c, W, H, S) => L.speed(c, W, H, S, 0, { color: INK, n: 70, inner: .5 })),
      P('panel', 'Манга-кадр', (c, W, H, S) => { c.strokeStyle = INK; c.lineWidth = 18; c.strokeRect(W * .08, H * .08, W * .84, H * .84); c.beginPath(); c.moveTo(W * .08, H * .55); c.lineTo(W * .92, H * .42); c.moveTo(W * .5, H * .08); c.lineTo(W * .58, H * .48); c.stroke(); }),
      P('star', 'Звезда', (c, W, H, S) => L.star(c, W, H, S, 1, { color: AYEL })),
      P('label-kawaii', 'KAWAII', (c, W, H, S) => L.label(c, W, H, S, 1, { text: 'KAWAII', bg: APINK, color: '#fff', border: 10, borderColor: INK, tilt: -.08 })),
      P('label-sugoi', 'СУГОЙ!', (c, W, H, S) => L.label(c, W, H, S, 1, { text: 'СУГОЙ!', bg: AYEL, color: INK, border: 10, borderColor: INK, tilt: .06 })),
      P('arrow', 'Стрелка', (c, W, H, S) => L.arrow(c, W, H, S, 1, {})),
      P('circle', 'Обвести', (c, W, H, S) => L.circle(c, W, H, S, 1, { color: APINK })),
      P('petal', 'Лепесток сакуры', (c, W, H, S) => { c.fillStyle = '#FFC1D6'; c.strokeStyle = '#FF8FB1'; c.lineWidth = 8; c.save(); c.translate(W / 2, H / 2); c.rotate(.5); c.beginPath(); c.moveTo(0, H * .35); c.bezierCurveTo(W * .4, H * .1, W * .3, -H * .35, W * .04, -H * .25); c.lineTo(0, -H * .32); c.lineTo(-W * .04, -H * .25); c.bezierCurveTo(-W * .3, -H * .35, -W * .4, H * .1, 0, H * .35); c.fill(); c.stroke(); c.restore(); })
    ],
    an: [
      A('bam-pop', 'BAM! выскакивает', (c, W, H, S, t) => L.burst(c, W, H, S, E.clamp(t / .4), { color: AYEL, line: 1, label: 'BAM!', labelColor: APINK, labelOutline: 10 }), 2),
      A('shake-shout', 'Крик трясётся', (c, W, H, S, t) => { const R = rnd(Math.floor(t * 20)); c.save(); c.translate((R() - .5) * 24, (R() - .5) * 24); L.bubble(c, W, H, S, E.clamp(t / .3), { kind: 'shout', bg: '#fff', text: 'ЧТО?!', caps: 1, color: INK }); c.restore(); }, 2),
      A('sparkle-twinkle', 'Блеск мерцает', (c, W, H, S, t) => { L.sparkle(c, W, H, S, 1, { color: AYEL, inner: .1, scale: .5 + .5 * Math.abs(Math.sin(t * Math.PI * 2)) }); c.save(); c.translate(W * .55, -H * .1); L.sparkle(c, W * .5, H * .5, S, 1, { color: APINK, inner: .1, scale: .5 + .5 * Math.abs(Math.cos(t * Math.PI * 2)) }); c.restore(); }, 2),
      A('speed', 'Линии концентрации', (c, W, H, S, t) => L.speed(c, W, H, S, t, { color: INK, n: 70, inner: .5 }), 2),
      A('anger-pulse', 'Злость пульсирует', (c, W, H, S, t) => { const k = 1 + .15 * Math.abs(Math.sin(t * TAU)); c.save(); c.translate(W / 2, H / 2); c.scale(k, k); c.translate(-W / 2, -H / 2); STYLES.anime.png[8].draw(c, W, H, S); c.restore(); }, 2),
      A('heart-pop', 'Сердечко', (c, W, H, S, t) => L.heart(c, W, H, S, E.clamp(t / .4), { color: APINK, line: INK, lw: 16, shine: 1, scale: 1 + .07 * Math.max(0, Math.sin((t - .4) * 10)) }), 2),
      A('sakura', 'Сакура', (c, W, H, S, t) => L.particles(c, W, H, S, t, { shape: 'petal', n: 10, size: .06, colors: ['#FFC1D6', '#FF8FB1'], loop: 2, seed: 7 }), 2),
      A('exclaim-pop', '!! выскакивает', (c, W, H, S, t) => { const k = E.back(E.clamp(t / .35)); c.save(); c.translate(W / 2, H / 2); c.scale(k, k); c.rotate(.15 * Math.sin(t * 9)); text(c, '!!', 0, 0, S, H * .7, { color: APINK, outline: 24, outlineColor: INK }); c.restore(); }, 2)
    ],
    ov: [
      A('speed', 'Линии скорости', (c, W, H, S, t) => L.speed(c, W, H, S, t, { color: '#fff', n: 110, inner: .55 }), 3),
      A('sakura', 'Сакура падает', (c, W, H, S, t) => L.particles(c, W, H, S, t, { shape: 'petal', n: 28, size: .022, colors: ['#FFC1D6', '#FF8FB1', '#fff'], loop: 3, seed: 3 }), 3),
      A('sparkles', 'Блёстки', (c, W, H, S, t) => L.particles(c, W, H, S, t, { shape: 'spark', n: 26, size: .02, colors: ['#fff', AYEL, '#FFC1D6'], twinkle: 1, dir: 'up', loop: 3, seed: 15 }), 3),
      A('impact', 'Удар-вспышка', (c, W, H, S, t) => { const f = (t % 1); c.globalAlpha = Math.max(0, 1 - f * 2.5); L.rays(c, W, H, S, t, { color: '#fff', n: 40, speed: 2 }); c.globalAlpha = 1; }, 3)
    ],
    tr: [
      A('flash', 'Вспышка с лучами', T.flash('#fff', AYEL), 1), A('speed', 'Линии скорости', (c, W, H, S, p) => { const a = 1 - Math.abs(p - .5) * 2; c.fillStyle = '#fff'; c.globalAlpha = E.clamp(a * 1.6); c.fillRect(0, 0, W, H); c.globalAlpha = 1; L.speed(c, W, H, S, p * 3, { color: INK, n: 120, inner: .6 - a * .5 }); }, 1),
      A('star', 'Звезда', T.shape(starShape(5), AYEL, 1.4), 1), A('heart', 'Сердце', T.shape(heartShape, APINK, .3), 1), A('stripes', 'Манга-полосы', T.stripes([INK, '#fff', APINK, '#fff'], -.6), 1),
      A('iris', 'Круг', T.iris(INK, APINK), 1)
    ],
    bg: [
      P('rays', 'Лучи', (c, W, H, S) => { c.fillStyle = '#FFF5F8'; c.fillRect(0, 0, W, H); L.rays(c, W, H, S, 0, { color: '#FFD9E5', n: 36 }); }),
      P('halftone', 'Растровые точки', (c, W, H) => { c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.fillStyle = '#FFB3C8'; for (let y = 0; y < H; y += 36) for (let x = (y / 36 % 2) * 18; x < W; x += 36) { const r = 3 + 12 * (y / H); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); } }),
      P('sky', 'Аниме-небо', (c, W, H) => { L.gradient(c, W, H, ['#6FB7FF', '#BFE3FF', '#FFE6F0']); L.blobs(c, W, H, ['rgba(255,255,255,.9)', 'rgba(255,255,255,.8)', 'rgba(255,255,255,.7)'], { seed: 2 }); }),
      P('pink', 'Розовый', (c, W, H) => L.gradient(c, W, H, ['#FF9EBB', '#FF4F79'])),
      P('speed', 'Линии скорости', (c, W, H, S) => { c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); L.speed(c, W, H, S, 0, { color: INK, n: 120, inner: .45 }); }),
      P('night', 'Ночной город', (c, W, H) => { L.gradient(c, W, H, ['#1b1446', '#4b2a7a', '#ff6fa0']); L.noise(c, W, H, 0, { n: Math.round(W * H / 5000), size: 3, alpha: .9 }); })
    ],
    tx: [
      P('manga', 'Манга-плашка', (c, W, H) => { c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 12; c.fillRect(W * .04, H * .15, W * .92, H * .7); c.strokeRect(W * .04, H * .15, W * .92, H * .7); }),
      P('pink', 'Розовая с обводкой', (c, W, H) => { c.fillStyle = APINK; c.strokeStyle = INK; c.lineWidth = 12; rrect(c, W * .04, H * .2, W * .92, H * .6, 30); c.fill(); c.stroke(); }),
      P('yellow', 'Жёлтая наклонная', (c, W, H) => { c.save(); c.translate(W / 2, H / 2); c.rotate(-.04); c.fillStyle = AYEL; c.strokeStyle = INK; c.lineWidth = 12; c.fillRect(-W * .45, -H * .3, W * .9, H * .6); c.strokeRect(-W * .45, -H * .3, W * .9, H * .6); c.restore(); }),
      P('shout', 'Крик', (c, W, H, S) => L.bubble(c, W, H, S, 1, { kind: 'shout', bg: '#fff' })),
      P('bubble', 'Реплика', (c, W, H, S) => L.bubble(c, W, H, S, 1, { kind: 'round', bg: '#fff' })),
      P('blue', 'Синяя', (c, W, H) => { c.fillStyle = ABLUE; rrect(c, W * .04, H * .22, W * .92, H * .56, 24); c.fill(); })
    ]
  };

  /* Ретро 70–90 */
  const ORNG = '#E8833A', RED = '#C0392B', TEAL = '#2E6E6A', SAND = '#F4E1C1', BRN = '#2B1E16';
  STYLES.retro = { name: 'Ретро 70–90', key: '#FF00FF',
    S: { c1: ORNG, c2: RED, c3: TEAL, ink: BRN, font: 'RubikMonoOne', fontBody: 'RussoOne', lw: 26, rough: 0, glow: 0 },
    png: [
      P('sun', 'Ретро-солнце', (c, W, H) => { const r = W * .4; c.save(); c.beginPath(); c.arc(W / 2, H * .55, r, 0, TAU); c.clip(); L.stripes(c, W, H, null, { colors: ['#FFD166', ORNG, ORNG, RED, RED, '#8E2C48'] }); c.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 6; i++) c.fillRect(0, H * (.62 + i * .06), W, 6 + i * 4); c.restore(); }),
      P('rainbow', 'Радуга 70-х', (c, W, H) => { [RED, ORNG, '#FFD166', TEAL].forEach((col, i) => { c.strokeStyle = col; c.lineWidth = W * .07; c.beginPath(); c.arc(W / 2, H * .72, W * (.4 - i * .075), Math.PI, 0); c.stroke(); }); }),
      P('cassette', 'Кассета', (c, W, H) => { c.fillStyle = BRN; rrect(c, W * .08, H * .24, W * .84, H * .52, 30); c.fill(); c.fillStyle = SAND; rrect(c, W * .16, H * .3, W * .68, H * .22, 14); c.fill(); c.fillStyle = BRN; [.36, .64].forEach(x => { c.beginPath(); c.arc(W * x, H * .41, W * .06, 0, TAU); c.fill(); }); c.fillStyle = ORNG; c.fillRect(W * .16, H * .56, W * .68, H * .06); }),
      P('tv', 'Телевизор', (c, W, H) => { c.fillStyle = '#6b4a2b'; rrect(c, W * .1, H * .2, W * .8, H * .6, 40); c.fill(); c.fillStyle = '#1a1a1a'; rrect(c, W * .16, H * .26, W * .54, H * .48, 50); c.fill(); c.globalCompositeOperation = 'destination-out'; rrect(c, W * .2, H * .3, W * .46, H * .4, 40); c.fill(); c.globalCompositeOperation = 'source-over'; c.fillStyle = SAND; [.38, .55].forEach(y => { c.beginPath(); c.arc(W * .8, H * y, W * .035, 0, TAU); c.fill(); }); }),
      P('rec', 'REC', (c, W, H, S) => { c.fillStyle = 'rgba(0,0,0,.0)'; L.rec(c, W, H * .4, S, .2); }),
      P('play', 'PLAY ▶', (c, W, H, S) => text(c, 'PLAY ▶', W / 2, H / 2, S, H * .14, { color: '#fff', outline: 10, outlineColor: BRN })),
      P('starburst', 'Звезда NEW', (c, W, H, S) => L.burst(c, W, H, S, 1, { color: '#FFD166', rays: 18, label: 'NEW', labelColor: RED })),
      P('label-groovy', 'GROOVY', (c, W, H, S) => L.label(c, W, H, S, 1, { text: 'GROOVY', bg: ORNG, color: SAND, radius: 60 })),
      P('label-90', 'Вайб 90-х', (c, W, H, S) => L.label(c, W, H, S, 1, { text: 'ВАЙБ 90-Х', bg: TEAL, color: SAND, which: 'body', radius: 8 })),
      P('disco', 'Диско-шар', (c, W, H) => { const r = W * .38; c.save(); c.beginPath(); c.arc(W / 2, H / 2, r, 0, TAU); c.clip(); for (let y = -r; y < r; y += 40) for (let x = -r; x < r; x += 40) { const v = .55 + .45 * Math.sin(x * .03 + y * .05); c.fillStyle = `rgb(${200 * v},${200 * v},${215 * v})`; c.fillRect(W / 2 + x + 2, H / 2 + y + 2, 36, 36); } c.restore(); L.sparkle(c, W * .5, H * .5, { c2: '#fff' }, 1, { color: '#fff', inner: .1 }); }),
      P('film', 'Плёнка', (c, W, H, S) => L.frame(c, W, H, S, 1, { kind: 'film' })),
      P('window90', 'Окно 90-х', (c, W, H, S) => L.window(c, W, H, Object.assign({}, S, { shadow: 0 }), 1, { bg: '#c0c0c0', bar: '#000080', radius: 0, btns: ['#c0c0c0', '#c0c0c0', '#c0c0c0'], title: 'Монтаж.exe', titleColor: '#fff', lines: ['', '  Ролик готов!', '', '  [ ОК ]'], colors: ['#000'] })),
      P('pixel-heart', 'Пиксельное сердце', (c, W, H) => { const m = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'], s = W * .11; c.fillStyle = RED; m.forEach((row, y) => [...row].forEach((v, x) => { if (v === '1') c.fillRect(W * .12 + x * s, H * .2 + y * s, s - 4, s - 4); })); }),
      P('checker', 'Шахматка', (c, W, H, S) => { c.save(); c.beginPath(); c.arc(W / 2, H / 2, W * .42, 0, TAU); c.clip(); L.checker(c, W, H, S, { step: W / 8, a: SAND, b: BRN }); c.restore(); }),
      P('smile', 'Смайл 70-х', (c, W, H) => { c.fillStyle = '#FFD166'; c.strokeStyle = BRN; c.lineWidth = 14; c.beginPath(); c.arc(W / 2, H / 2, W * .4, 0, TAU); c.fill(); c.stroke(); c.fillStyle = BRN; [.38, .62].forEach(x => { c.beginPath(); c.ellipse(W * x, H * .42, W * .04, H * .08, 0, 0, TAU); c.fill(); }); c.beginPath(); c.arc(W / 2, H * .52, W * .22, .2, Math.PI - .2); c.stroke(); }),
      P('flower', 'Ромашка', (c, W, H, S) => L.flower(c, W, H, S, 1, { color: '#fff', center: ORNG })),
      P('arrow', 'Стрелка', (c, W, H, S) => L.arrow(c, W, H, Object.assign({}, S, { c1: ORNG }), 1, {})),
      P('circle', 'Обвести', (c, W, H, S) => L.circle(c, W, H, S, 1, { color: RED })),
      P('vhs-label', 'Наклейка VHS', (c, W, H, S) => L.label(c, W, H, S, 1, { text: 'VHS', bg: SAND, color: RED, border: 8, borderColor: BRN, radius: 6 })),
      P('stars', 'Звёзды', (c, W, H, S) => { [[.35, .35, .55], [.7, .62, .35]].forEach(h => { c.save(); c.translate(W * h[0] - W * h[2] / 2, H * h[1] - H * h[2] / 2); L.star(c, W * h[2], H * h[2], S, 1, { color: '#FFD166' }); c.restore(); }); })
    ],
    an: [
      A('rec', 'REC мигает', (c, W, H, S, t) => { c.save(); c.translate(0, H * .3); L.rec(c, W, H * .4, S, t); c.restore(); }, 2),
      A('disco', 'Диско-шар крутится', (c, W, H, S, t) => { const r = W * .38; c.save(); c.beginPath(); c.arc(W / 2, H / 2, r, 0, TAU); c.clip(); for (let y = -r; y < r; y += 40) for (let x = -r; x < r; x += 40) { const v = .55 + .45 * Math.sin((x + t * 160) * .03 + y * .05); c.fillStyle = `rgb(${200 * v},${200 * v},${215 * v})`; c.fillRect(W / 2 + x + 2, H / 2 + y + 2, 36, 36); } c.restore(); }, 2),
      A('starburst', 'Звезда NEW', (c, W, H, S, t) => { c.save(); c.translate(W / 2, H / 2); c.rotate(t * .5); c.translate(-W / 2, -H / 2); L.burst(c, W, H, S, E.clamp(t / .4), { color: '#FFD166', rays: 18 }); c.restore(); text(c, 'NEW', W / 2, H / 2, S, H * .16 * E.back(E.clamp(t / .4)), { color: RED }); }, 2),
      A('play', 'PLAY мигает', (c, W, H, S, t) => { if ((t % 1) < .7) text(c, 'PLAY ▶', W / 2, H / 2, S, H * .14, { color: '#fff', outline: 10, outlineColor: BRN }); }, 2),
      A('sun-rays', 'Солнце с лучами', (c, W, H, S, t) => { c.save(); c.beginPath(); c.arc(W / 2, H / 2, W * .48, 0, TAU); c.clip(); L.rays(c, W, H, S, t, { color: '#FFD166', n: 20, speed: .5 }); c.restore(); c.fillStyle = ORNG; c.beginPath(); c.arc(W / 2, H / 2, W * .2, 0, TAU); c.fill(); }, 2),
      A('cassette', 'Кассета крутится', (c, W, H, S, t) => { STYLES.retro.png[2].draw(c, W, H, S); c.strokeStyle = SAND; c.lineWidth = 8; [.36, .64].forEach(x => { for (let k = 0; k < 3; k++) { const a = t * 4 + k * TAU / 3; c.beginPath(); c.moveTo(W * x, H * .41); c.lineTo(W * x + Math.cos(a) * W * .05, H * .41 + Math.sin(a) * W * .05); c.stroke(); } }); }, 2),
      A('pixel-heart', 'Пиксельное сердце', (c, W, H, S, t) => { const k = 1 + .1 * Math.abs(Math.sin(t * TAU)); c.save(); c.translate(W / 2, H / 2); c.scale(k, k); c.translate(-W / 2, -H / 2); STYLES.retro.png[12].draw(c, W, H, S); c.restore(); }, 2),
      A('circle-draw', 'Обводка рисуется', (c, W, H, S, t) => L.circle(c, W, H, S, E.clamp(t / 1), { color: RED }), 2)
    ],
    ov: [
      A('vhs', 'VHS', (c, W, H, S, t) => { L.scan(c, W, H, t, { color: '#000', band: '#fff', alpha: .18, step: 4, speed: 1 / 3 }); L.noise(c, W, H, t, { alpha: .35, size: 2 }); c.save(); c.translate(W * .06, H * .05); L.rec(c, Math.min(W, H) * .4, Math.min(W, H) * .07, S, t); c.restore(); text(c, 'PLAY ▶', W * .9, H * .05, S, Math.min(W, H) * .035, { align: 'right', color: '#fff' }); }, 3),
      A('grain', 'Зерно и пыль', (c, W, H, S, t) => { L.noise(c, W, H, t, { alpha: .45, size: 2.2 }); const R = rnd(Math.floor(t * 8) + 3); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { if (R() > .6) continue; const x = R() * W; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (R() - .5) * 30, H); c.stroke(); } }, 3),
      A('leak', 'Оранжевая засветка', (c, W, H, S, t) => L.leak(c, W, H, t, { colors: ['rgba(255,140,40,.8)', 'rgba(255,60,40,.5)', 'rgba(255,210,120,.6)'], loop: 3 }), 3),
      A('rays', 'Лучи 70-х', (c, W, H, S, t) => { c.globalAlpha = .35; L.rays(c, W, H, S, t, { color: '#FFD166', n: 28, speed: .2 }); c.globalAlpha = 1; }, 3)
    ],
    tr: [
      A('stripes', 'Полосы 70-х', T.stripes([RED, ORNG, '#FFD166', TEAL], -.2), 1), A('iris', 'Солнце', T.iris(ORNG, '#FFD166'), 1), A('flash', 'Засветка плёнки', T.flash('#FFE2B8'), 1),
      A('blocks', 'Пиксели', T.blocks([BRN, ORNG, TEAL, SAND], 6), 1), A('star', 'Звезда', T.shape(starShape(8), '#FFD166', 1), 1),
      A('vhs', 'VHS-перемотка', (c, W, H, S, p) => { const a = 1 - Math.abs(p - .5) * 2; c.fillStyle = BRN; c.globalAlpha = E.clamp(a * 1.5); c.fillRect(0, 0, W, H); c.globalAlpha = 1; L.scan(c, W, H, p * 6, { color: '#fff', band: '#fff', alpha: a * .4, step: 8 }); L.noise(c, W, H, p * 9, { alpha: a, size: 3 }); }, 1)
    ],
    bg: [
      P('sand', 'Песочный', (c, W, H) => { L.gradient(c, W, H, [SAND, '#E9CFA3']); L.noise(c, W, H, 0, { color: '#7a5a3a', alpha: .15, size: 2 }); }),
      P('stripes', 'Полосы 70-х', (c, W, H, S) => { c.fillStyle = SAND; c.fillRect(0, 0, W, H); const cols = [RED, ORNG, '#FFD166', TEAL]; cols.forEach((col, i) => { c.fillStyle = col; c.fillRect(0, H * (.55 + i * .07), W, H * .06); }); }),
      P('sunset', 'Ретро-закат', (c, W, H) => { L.gradient(c, W, H, ['#2B1E16', '#8E2C48', ORNG, '#FFD166']); }),
      P('grid80', 'Сетка 80-х', (c, W, H) => { L.gradient(c, W, H, ['#140a2a', '#3d0f4a']); c.strokeStyle = '#ff4fd8'; c.lineWidth = 3; const hz = H * .55; for (let i = -20; i <= 20; i++) { c.beginPath(); c.moveTo(W / 2 + i * 40, hz); c.lineTo(W / 2 + i * W * .18, H); c.stroke(); } for (let k = 0; k < 14; k++) { const y = hz + Math.pow(k / 14, 2) * (H - hz); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); } }),
      P('checker', 'Шахматка', (c, W, H, S) => L.checker(c, W, H, S, { step: 120, a: SAND, b: BRN })),
      P('teal', 'Бирюзовый винтаж', (c, W, H) => { L.gradient(c, W, H, ['#3d8a85', TEAL, '#1f4a47'], { radial: 1 }); L.noise(c, W, H, 0, { alpha: .2, size: 2 }); })
    ],
    tx: [
      P('orange', 'Оранжевая', (c, W, H) => { c.fillStyle = ORNG; rrect(c, W * .04, H * .2, W * .92, H * .6, H * .3); c.fill(); }),
      P('sand', 'Песочная с рамкой', (c, W, H) => { c.fillStyle = SAND; c.strokeStyle = BRN; c.lineWidth = 10; c.fillRect(W * .04, H * .18, W * .92, H * .64); c.strokeRect(W * .04, H * .18, W * .92, H * .64); }),
      P('win90', 'Окно 90-х', (c, W, H, S) => L.window(c, W, H, Object.assign({}, S, { shadow: 0 }), 1, { bg: '#c0c0c0', bar: '#000080', radius: 0, btns: ['#c0c0c0', '#c0c0c0', '#c0c0c0'], title: 'Заголовок.txt', titleColor: '#fff' })),
      P('stripes', 'Полосатая', (c, W, H) => { [RED, ORNG, '#FFD166'].forEach((col, i) => { c.fillStyle = col; rrect(c, W * (.04 + i * .012), H * (.2 + i * .04), W * .92, H * .5, 16); c.fill(); }); }),
      P('teal', 'Бирюзовая', (c, W, H) => { c.fillStyle = TEAL; rrect(c, W * .04, H * .22, W * .92, H * .56, 12); c.fill(); }),
      P('tape', 'Скотч-наклейка', (c, W, H) => { c.save(); c.translate(W / 2, H / 2); c.rotate(-.03); c.fillStyle = 'rgba(244,225,193,.92)'; c.fillRect(-W * .46, -H * .28, W * .92, H * .56); c.restore(); })
    ]
  };

  /* КОД КРЕАТОРА */
  const KY = '#FFAD05', KI = '#16130C', KW = '#F3EFE6';
  STYLES.kk = { name: 'КОД КРЕАТОРА', key: '#00B140',
    S: { c1: KY, c2: KW, c3: '#A29B8C', ink: KI, font: 'Unbounded-ExtraBold', fontBody: 'Montserrat-ExtraBold', lw: 30, rough: .15, glow: 0 },
    png: [
      P('logo', 'КОД КРЕАТОРА', (c, W, H, S) => L.label(c, W, H, S, 1, { text: 'КОД КРЕАТОРА', bg: KY, color: KI, radius: 12 })),
      P('logo-dark', 'КОД КРЕАТОРА тёмный', (c, W, H, S) => L.label(c, W, H, S, 1, { text: 'КОД КРЕАТОРА', bg: KI, color: KY, radius: 12 })),
      P('kk', 'КК', (c, W, H, S) => L.label(c, W, H, S, 1, { text: 'КК', bg: KY, color: KI, radius: 30 })),
      P('chess', 'Шахматный круг', (c, W, H, S) => { c.save(); c.beginPath(); c.arc(W / 2, H / 2, W * .42, 0, TAU); c.clip(); L.checker(c, W, H, S, { step: W / 8, a: KY, b: KI }); c.restore(); }),
      P('arrow', 'Стрелка', (c, W, H, S) => L.arrow(c, W, H, S, 1, {})),
      P('arrow-dark', 'Стрелка тёмная', (c, W, H, S) => L.arrow(c, W, H, Object.assign({}, S, { c1: KI }), 1, {})),
      P('circle', 'Обвести', (c, W, H, S) => L.circle(c, W, H, S, 1, {})),
      P('marker', 'Маркер', (c, W, H, S) => L.underline(c, W, H, S, 1, { marker: 1 })),
      P('underline', 'Подчеркнуть', (c, W, H, S) => L.underline(c, W, H, S, 1, { double: 1 })),
      P('look', 'СМОТРИ', (c, W, H, S) => L.label(c, W, H, S, 1, { text: 'СМОТРИ', bg: KY, color: KI, tilt: -.06, radius: 12 })),
      P('save', 'СОХРАНИ', (c, W, H, S) => L.label(c, W, H, S, 1, { text: 'СОХРАНИ', bg: KI, color: KY, tilt: .05, radius: 12 })),
      P('play', 'Кнопка play', (c, W, H) => { c.fillStyle = KY; c.beginPath(); c.arc(W / 2, H / 2, W * .4, 0, TAU); c.fill(); c.fillStyle = KI; c.beginPath(); c.moveTo(W * .42, H * .32); c.lineTo(W * .68, H * .5); c.lineTo(W * .42, H * .68); c.closePath(); c.fill(); }),
      P('star', 'Звезда', (c, W, H, S) => L.star(c, W, H, S, 1, { color: KY })),
      P('sparkle', 'Искра', (c, W, H, S) => L.sparkle(c, W, H, S, 1, { color: KY, inner: .12 })),
      P('check', 'Галочка', (c, W, H, S) => L.check(c, W, H, S, 1, { ring: KY, color: KI, lw: 60 })),
      P('num1', 'Номер 1', (c, W, H, S) => { c.fillStyle = KY; c.beginPath(); c.arc(W / 2, H / 2, W * .4, 0, TAU); c.fill(); text(c, '1', W / 2, H * .53, S, H * .5, { color: KI }); }),
      P('quote', 'Кавычки', (c, W, H, S) => text(c, '«»', W / 2, H / 2, S, H * .8, { color: KY })),
      P('frame', 'Шахматная рамка', (c, W, H, S) => { c.save(); L.checker(c, W, H, S, { step: 64, a: KY, b: KI }); c.globalCompositeOperation = 'destination-out'; c.fillRect(64, 64, W - 128, H - 128); c.restore(); })
    ],
    an: [
      A('timeline', 'Таймлайн с плейхедом', (c, W, H, S, t) => { const k = E.clamp(t / .5), x0 = W * .1, w = W * .8, rows = [[.0, .38, KY], [.42, .3, '#fff'], [.75, .25, KY], [.05, .5, '#8a8a8a'], [.58, .37, '#fff']];
        c.save(); c.globalAlpha = k; c.fillStyle = KI; c.beginPath(); c.roundRect(x0 - 24, H * .3 - 24, w + 48, H * .4 + 48, 28); c.fill();
        rows.forEach((r, i) => { const y = H * .3 + (i < 3 ? 0 : H * .22), xa = x0 + w * r[0], xw = w * r[1] * E.clamp((t - i * .08) / .4); c.fillStyle = r[2]; c.beginPath(); c.roundRect(xa, y + (i % 3 === 1 ? 0 : 0), Math.max(0, xw), H * .16, 12); c.fill(); });
        const px = x0 + w * ((t * .45) % 1); c.fillStyle = '#ff3b30'; c.fillRect(px - 4, H * .3 - 34, 8, H * .4 + 68); c.beginPath(); c.moveTo(px - 18, H * .3 - 34); c.lineTo(px + 18, H * .3 - 34); c.lineTo(px, H * .3 - 12); c.fill(); c.restore(); }, 3),
      A('arrow-draw', 'Стрелка рисуется', (c, W, H, S, t) => L.arrow(c, W, H, S, E.clamp(t / .9), {}), 2),
      A('circle-draw', 'Обводка рисуется', (c, W, H, S, t) => L.circle(c, W, H, S, E.clamp(t / .9), {}), 2),
      A('marker-draw', 'Маркер рисуется', (c, W, H, S, t) => L.underline(c, W, H, S, E.clamp(t / .7), { marker: 1 }), 2),
      A('look-pop', 'СМОТРИ', (c, W, H, S, t) => L.label(c, W, H, S, E.clamp(t / .4), { text: 'СМОТРИ', bg: KY, color: KI, tilt: -.06 + .03 * Math.sin(t * 6), radius: 12 }), 2),
      A('chess-spin', 'Шахматный круг', (c, W, H, S, t) => { c.save(); c.translate(W / 2, H / 2); c.rotate(t * .8); c.translate(-W / 2, -H / 2); c.beginPath(); c.arc(W / 2, H / 2, W * .42, 0, TAU); c.clip(); L.checker(c, W, H, S, { step: W / 8, a: KY, b: KI }); c.restore(); }, 2),
      A('sparkle', 'Искра', (c, W, H, S, t) => L.sparkle(c, W, H, S, 1, { color: KY, inner: .12, scale: .6 + .4 * Math.abs(Math.sin(t * Math.PI)), rot: t }), 2),
      A('check', 'Галочка', (c, W, H, S, t) => L.check(c, W, H, S, E.clamp(t / .8), { ring: KY, color: KI, lw: 60 }), 2)
    ],
    ov: [
      A('sparkles', 'Жёлтые искры', (c, W, H, S, t) => L.particles(c, W, H, S, t, { shape: 'spark', n: 24, size: .02, colors: [KY, '#fff'], twinkle: 1, dir: 'up', loop: 3, seed: 18 }), 3),
      A('chess-border', 'Шахматная рамка', (c, W, H, S, t) => { const s = Math.min(W, H) * .04, off = (t / 3) * s * 2; c.save(); c.beginPath(); c.rect(0, 0, W, H); c.rect(s, s, W - 2 * s, H - 2 * s); c.clip('evenodd'); c.translate(off % (s * 2), 0); L.checker(c, W + s * 2, H, S, { step: s, a: KY, b: KI }); c.restore(); }, 3),
      A('grain', 'Зерно', (c, W, H, S, t) => L.noise(c, W, H, t, { alpha: .35, size: 2 }), 3),
      A('leak', 'Жёлтая засветка', (c, W, H, S, t) => L.leak(c, W, H, t, { colors: ['rgba(255,173,5,.75)', 'rgba(255,220,120,.55)', 'rgba(255,120,0,.4)'], loop: 3 }), 3)
    ],
    tr: [
      A('chess', 'Шахматы', T.blocks([KY, KI], 6), 1), A('stripes', 'Полосы КК', T.stripes([KY, KI, KW, KY], -.35), 1), A('iris', 'Жёлтый круг', T.iris(KY, KI), 1),
      A('slide', 'Шторка со звездой', T.slide(KY, (c, W, H, S) => { c.save(); c.translate(W / 2 - Math.min(W, H) * .2, H / 2 - Math.min(W, H) * .2); L.sparkle(c, Math.min(W, H) * .4, Math.min(W, H) * .4, S, 1, { color: KI, inner: .14 }); c.restore(); }), 1),
      A('flash', 'Жёлтая вспышка', T.flash(KY), 1), A('star', 'Звезда', T.shape(starShape(4), KY, 1.2), 1)
    ],
    bg: [
      P('ink', 'Тёмный КК', (c, W, H) => L.gradient(c, W, H, ['#201E19', KI])),
      P('yellow', 'Жёлтый КК', (c, W, H) => L.gradient(c, W, H, ['#FFC03D', KY])),
      P('chess', 'Шахматы', (c, W, H, S) => L.checker(c, W, H, S, { step: 120, a: KY, b: KI })),
      P('cream', 'Молочный', (c, W, H) => { L.gradient(c, W, H, [KW, '#E8E1D2']); L.noise(c, W, H, 0, { color: '#6b5a3a', alpha: .12, size: 2 }); }),
      P('glow', 'Жёлтое свечение', (c, W, H) => { c.fillStyle = KI; c.fillRect(0, 0, W, H); L.blobs(c, W, H, ['rgba(255,173,5,.55)', 'rgba(255,173,5,.3)'], { seed: 4 }); }),
      P('grid', 'Сетка', (c, W, H, S) => { c.fillStyle = KI; c.fillRect(0, 0, W, H); L.grid(c, W, H, S, { color: KY, step: 90, lw: 1.5, alpha: .25 }); })
    ],
    tx: [
      P('yellow', 'Жёлтая', (c, W, H) => { c.fillStyle = KY; rrect(c, W * .04, H * .2, W * .92, H * .6, 18); c.fill(); }),
      P('dark', 'Тёмная', (c, W, H) => { c.fillStyle = KI; rrect(c, W * .04, H * .2, W * .92, H * .6, 18); c.fill(); }),
      P('chess-edge', 'С шахматным краем', (c, W, H, S) => { c.fillStyle = KI; rrect(c, W * .04, H * .2, W * .92, H * .6, 18); c.fill(); c.save(); c.beginPath(); c.rect(W * .04, H * .2, W * .92, H * .1); c.clip(); L.checker(c, W, H, S, { step: H * .05, a: KY, b: KI }); c.restore(); }),
      P('cream', 'Молочная', (c, W, H) => { c.fillStyle = KW; c.strokeStyle = KI; c.lineWidth = 8; rrect(c, W * .04, H * .2, W * .92, H * .6, 18); c.fill(); c.stroke(); }),
      P('tag', 'Тег со звездой', (c, W, H, S) => { c.fillStyle = KY; rrect(c, W * .04, H * .2, W * .92, H * .6, 18); c.fill(); c.save(); c.translate(W * .06, H * .25); L.sparkle(c, H * .5, H * .5, S, 1, { color: KI, inner: .14 }); c.restore(); }),
      P('underline', 'Подложка-маркер', (c, W, H) => { c.fillStyle = 'rgba(255,173,5,.85)'; c.save(); c.translate(W / 2, H / 2); c.rotate(-.02); c.fillRect(-W * .46, -H * .12, W * .92, H * .34); c.restore(); })
    ]
  };

  G.KKSTYLES = STYLES;
})(window);

/* ---- styles2.js ---- */
/* Ещё 10 стилевых наборов. Общий «скелет» состава (20 PNG, 8 анимаций, 4 оверлея, 6 переходов, 6 фонов, 6 плашек)
   + у каждого стиля своя палитра, шрифты, характер линии, слова и фирменные элементы. */
(function (G) {
  const { L, E, rnd, text, rrect, TAU } = G.KKL;
  const P = (id, name, draw) => ({ id, name, draw });
  const A = (id, name, draw, dur = 2) => ({ id, name, draw, dur });
  const X = (S, o) => Object.assign({}, S, o);

  /* переходы (как в styles.js) */
  const T = {
    iris(color, inner) { return (ctx, W, H, S, p) => { const R = Math.hypot(W, H) / 2;
      if (p < .5) { const k = E.inOut(p / .5); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(W / 2, H / 2, R * k, 0, TAU); ctx.fill(); if (inner) { ctx.fillStyle = inner; ctx.beginPath(); ctx.arc(W / 2, H / 2, R * k * .7, 0, TAU); ctx.fill(); } }
      else { const k = E.inOut((p - .5) / .5); ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(W / 2, H / 2, R * k * 1.02, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; } }; },
    stripes(colors, angle = -.35) { return (ctx, W, H, S, p) => { const n = colors.length * 2, D = Math.hypot(W, H); ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(angle);
      for (let i = 0; i < n; i++) { const d = i / n * .35, k = p < .5 ? E.inOut(E.clamp((p - d * .5) / (.5 - .175))) : 1 + E.inOut(E.clamp((p - .5 - d * .5) / (.5 - .175)));
        const h = D / n + 2, y = -D / 2 + i * D / n, x = -D + k * D; ctx.fillStyle = colors[i % colors.length]; ctx.fillRect(x - D / 2, y, D, h); } ctx.restore(); }; },
    blocks(colors, size = 6) { return (ctx, W, H, S, p) => { const cols = size, rows = Math.ceil(cols * H / W), w = W / cols, h = H / rows, R = rnd(9);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const d = R() * .3, on = p < .5 ? E.clamp((p - d * .5) / .25) : 1 - E.clamp((p - .5 - d * .5) / .25);
        if (on <= 0) continue; ctx.fillStyle = colors[(x + y) % colors.length]; const s = E.out(on); ctx.fillRect(x * w + w * (1 - s) / 2, y * h + h * (1 - s) / 2, w * s + 1, h * s + 1); } }; },
    shape(fn, color, spin = 1) { return (ctx, W, H, S, p) => { const R = Math.hypot(W, H) * 1.25;
      if (p < .5) { const k = E.inOut(p / .5); ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(k * spin); fn(ctx, R * k, color); ctx.restore(); }
      else { const k = E.inOut((p - .5) / .5); ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'destination-out'; ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-k * spin); fn(ctx, R * k, '#000'); ctx.restore(); ctx.globalCompositeOperation = 'source-over'; } }; },
    flash(color) { return (ctx, W, H, S, p) => { ctx.globalAlpha = p < .5 ? E.out(p / .5) : 1 - E.inOut((p - .5) / .5); ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }; },
    slide(color, deco, vertical) { return (ctx, W, H, S, p) => { const k = p < .5 ? E.inOut(p / .5) - 1 : E.inOut((p - .5) / .5); ctx.save(); vertical ? ctx.translate(0, k * H * 1.05) : ctx.translate(k * W * 1.05, 0); ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); if (deco) deco(ctx, W, H, S); ctx.restore(); }; },
    glitch(colors) { return (ctx, W, H, S, p) => { const a = 1 - Math.abs(p - .5) * 2, R = rnd(Math.floor(p * 30) + 3);
      if (a > .85) { ctx.fillStyle = colors[0]; ctx.fillRect(0, 0, W, H); }
      for (let i = 0; i < 40; i++) { if (R() > a + .1) continue; ctx.fillStyle = colors[i % colors.length]; ctx.fillRect(R() * W - W * .2, R() * H, W * (.3 + R() * .9), H * (.01 + R() * .08) * (.5 + a)); } }; },
    // рваная бумага: край с зубцами едет через кадр
    paper(color, edge) { return (ctx, W, H, S, p) => { const k = p < .5 ? E.inOut(p / .5) : 1 + E.inOut((p - .5) / .5), R = rnd(4), x = -W * .15 + k * W * 1.15;
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x - W * 1.3, 0); ctx.lineTo(x, 0); for (let y = 0; y <= H; y += H / 40) ctx.lineTo(x + (R() - .5) * W * .06, y); ctx.lineTo(x - W * 1.3, H); ctx.closePath(); ctx.fill();
      if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 6; ctx.stroke(); } }; },
    // шторы кино: две половины сходятся
    curtain(color) { return (ctx, W, H, S, p) => { const k = p < .5 ? E.inOut(p / .5) : 1 - E.inOut((p - .5) / .5); ctx.fillStyle = color; ctx.fillRect(0, 0, W / 2 * k + 1, H); ctx.fillRect(W - W / 2 * k - 1, 0, W / 2 * k + 2, H); }; }
  };
  const heartShape = (ctx, s, c) => { ctx.fillStyle = c; ctx.beginPath(); for (let i = 0; i <= 90; i++) { const a = i / 90 * TAU, x = 16 * Math.pow(Math.sin(a), 3), y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); ctx.lineTo(x / 17 * s, -y / 17 * s); } ctx.fill(); };
  const starShape = n => (ctx, s, c) => { ctx.fillStyle = c; ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n - Math.PI / 2, r = i % 2 ? s * .45 : s; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.fill(); };
  const diamondShape = (ctx, s, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * .8, 0); ctx.lineTo(0, s); ctx.lineTo(-s * .8, 0); ctx.closePath(); ctx.fill(); };
  const leafShape = (ctx, s, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * .9, 0, 0, s); ctx.quadraticCurveTo(-s * .9, 0, 0, -s); ctx.fill(); };
  const snowShape = (ctx, s, c) => { ctx.strokeStyle = c; ctx.lineWidth = s * .12; ctx.lineCap = 'round'; for (let i = 0; i < 6; i++) { ctx.save(); ctx.rotate(i * Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s); ctx.moveTo(0, -s * .55); ctx.lineTo(s * .25, -s * .8); ctx.moveTo(0, -s * .55); ctx.lineTo(-s * .25, -s * .8); ctx.stroke(); ctx.restore(); } };

  /* фирменные мелочи */
  const D = {
    // скотч поверх стикера
    tape(c, W, H, col, x = .5, y = .12, rot = -.12) { c.save(); c.translate(W * x, H * y); c.rotate(rot); c.fillStyle = col; c.globalAlpha = .8; c.fillRect(-W * .16, -H * .04, W * .32, H * .08); c.restore(); },
    // хром-градиент для y2k/футуризма
    chrome(c, x0, y0, x1, y1) { const g = c.createLinearGradient(x0, y0, x1, y1); [['#ffffff', 0], ['#9aa3b5', .35], ['#f4f6ff', .5], ['#5d6478', .7], ['#e6e9f5', 1]].forEach(s => g.addColorStop(s[1], s[0])); return g; },
    leaf(c, W, H, col, vein) { c.save(); c.translate(W / 2, H / 2); c.rotate(-.5); leafShape(c, Math.min(W, H) * .42, col); c.strokeStyle = vein; c.lineWidth = Math.min(W, H) * .015; c.beginPath(); c.moveTo(0, -Math.min(W, H) * .38); c.lineTo(0, Math.min(W, H) * .4); c.stroke(); c.restore(); },
    snow(c, W, H, col) { c.save(); c.translate(W / 2, H / 2); snowShape(c, Math.min(W, H) * .42, col); c.restore(); },
    spray(c, x, y, r, col, seed = 3) { const R = rnd(seed); c.fillStyle = col; const n = Math.round(r * r / 25); for (let i = 0; i < n; i++) { const a = R() * TAU, d = Math.pow(R(), 1.3) * r, z = 3 + R() * 5; c.globalAlpha = .6 + R() * .4; c.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, z, z); } c.save(); c.globalAlpha = .9; c.beginPath(); c.arc(x, y, r * .45, 0, TAU); c.fill(); c.restore(); c.globalAlpha = 1; }
  };

  /* скелет набора */
  function make(cfg) {
    const S = cfg.S, c1 = S.c1, c2 = S.c2, c3 = S.c3, ink = S.ink, pap = cfg.paper, w = cfg.words;
    const lbl = (txt, bg, col, tilt) => (c, W, H, S2) => L.label(c, W, H, S2, 1, { text: txt, bg, color: col, tilt, caps: cfg.caps, radius: cfg.radius });
    const png = [
      P('label-1', 'Плашка «' + w[0] + '»', lbl(w[0], c1, cfg.onC1 || ink, -.05)),
      P('label-2', 'Плашка «' + w[1] + '»', lbl(w[1], ink, c1, .04)),
      P('label-3', 'Плашка «' + w[2] + '»', lbl(w[2], c2, cfg.onC2 || ink, -.02)),
      P('bubble', 'Реплика', (c, W, H, S2) => L.bubble(c, W, H, S2, 1, { kind: cfg.bubble || 'round', bg: cfg.bubbleBg || '#fff', text: w[3], color: cfg.bubbleText || ink, line: cfg.bubbleLine ?? ink })),
      P('shout', 'Крик', (c, W, H, S2) => L.bubble(c, W, H, S2, 1, { kind: 'shout', bg: c1, text: w[4], color: cfg.onC1 || ink, caps: true, line: ink })),
      P('think', 'Мысли', (c, W, H, S2) => L.bubble(c, W, H, S2, 1, { kind: 'think', bg: cfg.bubbleBg || '#fff', text: w[5], color: cfg.bubbleText || ink, line: false })),
      P('arrow', 'Стрелка', (c, W, H, S2) => L.arrow(c, W, H, S2, 1, { bend: .35 })),
      P('arrow-flat', 'Стрелка прямая', (c, W, H, S2) => L.arrow(c, W, H, S2, 1, { bend: 0 })),
      P('circle', 'Обвести', (c, W, H, S2) => L.circle(c, W, H, S2, 1, { color: c3 })),
      P('marker', 'Маркер', (c, W, H, S2) => L.underline(c, W, H, S2, 1, { marker: 1, color: c2 })),
      P('underline', 'Подчеркнуть', (c, W, H, S2) => L.underline(c, W, H, S2, 1, { double: 1, color: c1 })),
      P('burst', 'Взрыв «' + w[6] + '»', (c, W, H, S2) => L.burst(c, W, H, S2, 1, { label: w[6], color: c1, line: 1, labelColor: cfg.onC1 || ink })),
      P('star', 'Звезда', (c, W, H, S2) => L.star(c, W, H, S2, 1, { color: c2 })),
      P('sparkle', 'Искра', (c, W, H, S2) => L.sparkle(c, W, H, S2, 1, { color: c1, inner: .14 })),
      P('heart', 'Сердце', (c, W, H, S2) => L.heart(c, W, H, S2, 1, { color: c3, shine: 1 })),
      P('check', 'Галочка', (c, W, H, S2) => L.check(c, W, H, S2, 1, { ring: c1, color: cfg.onC1 || ink, lw: 60 })),
      P('cross', 'Крестик', (c, W, H, S2) => L.cross(c, W, H, S2, 1, { color: c3 })),
      P('button', 'Кнопка «' + w[7] + '»', (c, W, H, S2) => L.button(c, W, H, S2, 1, { text: w[7], bg: c1, color: cfg.onC1 || ink, caps: cfg.caps })),
      ...cfg.sig.png
    ].slice(0, 20);
    const an = [
      A('label-pop', 'Плашка выскакивает', (c, W, H, S2, t) => L.label(c, W, H, S2, E.clamp(t / .4), { text: w[0], bg: c1, color: cfg.onC1 || ink, tilt: -.05 + .02 * Math.sin(t * 5), caps: cfg.caps, radius: cfg.radius }), 2),
      A('arrow-draw', 'Стрелка рисуется', (c, W, H, S2, t) => L.arrow(c, W, H, S2, E.clamp(t / .9), {}), 2),
      A('circle-draw', 'Обводка рисуется', (c, W, H, S2, t) => L.circle(c, W, H, S2, E.clamp(t / .9), { color: c3 }), 2),
      A('marker-draw', 'Маркер рисуется', (c, W, H, S2, t) => L.underline(c, W, H, S2, E.clamp(t / .7), { marker: 1, color: c2 }), 2),
      A('burst-pop', 'Взрыв-реплика', (c, W, H, S2, t) => L.burst(c, W, H, S2, E.clamp(t / .4), { label: w[6], color: c1, line: 1, labelColor: cfg.onC1 || ink }), 2),
      A('sparkle', 'Мерцающая искра', (c, W, H, S2, t) => L.sparkle(c, W, H, S2, 1, { color: c1, inner: .14, scale: .6 + .4 * Math.abs(Math.sin(t * Math.PI)), rot: t * .8 }), 2),
      A('heart-beat', 'Сердце бьётся', (c, W, H, S2, t) => L.heart(c, W, H, S2, E.clamp(t / .4), { color: c3, shine: 1, scale: 1 + .07 * Math.max(0, Math.sin((t - .4) * 7)) }), 2),
      ...cfg.sig.an
    ].slice(0, 8);
    const ov = cfg.ov;
    const tr = [
      A('iris', 'Круг', T.iris(c1, cfg.irisInner), 1),
      A('stripes', 'Полосы', T.stripes([c1, ink, c2, c3]), 1),
      A('blocks', 'Плитки', T.blocks([c1, c2, ink, c3], 6), 1),
      A('slide', 'Шторка', T.slide(pap, cfg.slideDeco), 1),
      ...cfg.sig.tr
    ].slice(0, 6);
    return { name: cfg.name, key: cfg.key || '#00B140', S, png, an, ov, tr, bg: cfg.bg, tx: cfg.tx };
  }
  const plate = (col, r = 18, y = .2, h = .6) => (c, W, H) => { c.fillStyle = col; rrect(c, W * .04, H * y, W * .92, H * h, r); c.fill(); };
  const outlinePlate = (fill, line, lw = 8, r = 18) => (c, W, H) => { c.fillStyle = fill; c.strokeStyle = line; c.lineWidth = lw; rrect(c, W * .04, H * .2, W * .92, H * .6, r); c.fill(); c.stroke(); };
  const markerPlate = col => (c, W, H) => { c.fillStyle = col; c.save(); c.translate(W / 2, H / 2); c.rotate(-.02); c.fillRect(-W * .46, -H * .12, W * .92, H * .34); c.restore(); };

  const ST = G.KKSTYLES;

  /* ===== Y2K / 2000-е ===== */
  { const S = { c1: '#FF8BD8', c2: '#9AF2FF', c3: '#B9C6FF', ink: '#2A2A40', font: 'RussoOne', fontBody: 'Montserrat-ExtraBold', lw: 22, rough: 0, glow: 18, glowColor: 'rgba(255,255,255,.95)' };
    ST.y2k = make({ name: 'Y2K / 2000-е', S, paper: '#E9E9F2', caps: true, radius: 60, words: ['OMG', 'XOXO', 'NEW DROP', 'Это база', 'WOW', 'хмм…', 'ВАУ', 'Подписаться'], bubbleBg: '#fff',
      sig: {
        png: [P('chrome-star', 'Хром-звезда', (c, W, H, S2) => { c.save(); c.translate(W / 2, H / 2); c.fillStyle = D.chrome(c, -W * .4, -H * .4, W * .4, H * .4); c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, r = i % 2 ? W * .12 : W * .45; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.shadowColor = '#fff'; c.shadowBlur = 30; c.fill(); c.restore(); }),
          P('butterfly', 'Бабочка', (c, W, H, S2) => { c.save(); c.translate(W / 2, H / 2); [-1, 1].forEach(d => { c.fillStyle = '#FF8BD8'; c.beginPath(); c.ellipse(d * W * .2, -H * .1, W * .2, H * .25, d * .5, 0, TAU); c.fill(); c.fillStyle = '#9AF2FF'; c.beginPath(); c.ellipse(d * W * .16, H * .18, W * .13, H * .15, -d * .4, 0, TAU); c.fill(); }); c.fillStyle = '#2A2A40'; c.fillRect(-W * .02, -H * .3, W * .04, H * .6); c.restore(); })],
        an: [A('chrome-spin', 'Хром-звезда крутится', (c, W, H, S2, t) => { c.save(); c.translate(W / 2, H / 2); c.rotate(t * 1.5); c.scale(.9 + .1 * Math.sin(t * 4), .9 + .1 * Math.sin(t * 4)); c.fillStyle = D.chrome(c, -W * .4, -H * .4, W * .4, H * .4); c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, r = i % 2 ? W * .12 : W * .45; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.restore(); }, 2)],
        tr: [A('flash', 'Розовая вспышка', T.flash('#FF8BD8'), 1), A('star', 'Звезда', T.shape(starShape(4), '#B9C6FF', 1.2), 1)]
      },
      ov: [A('sparkles', 'Блёстки', (c, W, H, S2, t) => L.particles(c, W, H, S2, t, { shape: 'spark', n: 26, size: .025, colors: ['#fff', '#FF8BD8', '#9AF2FF'], twinkle: 1, dir: 'up', loop: 3, seed: 31 }), 3),
        A('hearts', 'Сердечки', (c, W, H, S2, t) => L.particles(c, W, H, S2, t, { shape: 'heart', n: 14, size: .04, colors: ['#FF8BD8', '#B9C6FF'], dir: 'up', loop: 3, seed: 32 }), 3),
        A('scan', 'Экран 2000-х', (c, W, H, S2, t) => L.scan(c, W, H, t, { alpha: .18, step: 8 }), 3),
        A('leak', 'Перламутровый свет', (c, W, H, S2, t) => L.leak(c, W, H, t, { colors: ['rgba(255,139,216,.6)', 'rgba(154,242,255,.55)', 'rgba(185,198,255,.5)'] }), 3)],
      bg: [P('pearl', 'Перламутр', (c, W, H) => L.gradient(c, W, H, ['#ffd6f3', '#b9c6ff', '#9af2ff'])), P('chrome', 'Хром', (c, W, H) => { c.fillStyle = D.chrome(c, 0, 0, W, H); c.fillRect(0, 0, W, H); }),
        P('pink', 'Розовый', (c, W, H) => L.gradient(c, W, H, ['#FFB3E6', '#FF8BD8'], { radial: 1 })), P('night', 'Ночной клуб', (c, W, H) => { L.gradient(c, W, H, ['#2A2A40', '#120f24']); L.blobs(c, W, H, ['rgba(255,139,216,.5)', 'rgba(154,242,255,.45)'], { seed: 9 }); }),
        P('grid', 'Сетка', (c, W, H, S2) => { L.gradient(c, W, H, ['#E9E9F2', '#d9dcf7']); L.grid(c, W, H, S2, { color: '#B9C6FF', step: 70, lw: 2 }); }), P('dots', 'Горох', (c, W, H, S2) => { c.fillStyle = '#FFD6F3'; c.fillRect(0, 0, W, H); L.dotsBg(c, W, H, S2, { color: '#fff', step: 70, r: 12 }); })],
      tx: [P('pink', 'Розовая', plate('#FF8BD8', 60)), P('chrome', 'Хромовая', (c, W, H) => { c.fillStyle = D.chrome(c, 0, H * .2, W, H * .8); rrect(c, W * .04, H * .2, W * .92, H * .6, 60); c.fill(); }), P('ice', 'Голубая', plate('#9AF2FF', 60)),
        P('outline', 'С обводкой', outlinePlate('#fff', '#2A2A40', 10, 60)), P('dark', 'Тёмная', plate('#2A2A40', 60)), P('marker', 'Маркер', markerPlate('rgba(255,139,216,.85)'))] }); }

  /* ===== Мультяшный / дудлы ===== */
  { const S = { c1: '#FFB800', c2: '#3CB371', c3: '#FF6B6B', ink: '#222222', font: 'Pangolin', fontBody: 'Caveat-Bold', lw: 22, rough: 1, glow: 0 };
    ST.doodle = make({ name: 'Мультяшный / дудлы', S, paper: '#FFFDF5', key: '#FF00FF', words: ['Смотри!', 'Хи-хи', 'Лайфхак', 'А так можно?', 'БАХ!', 'Хм…', 'БУМ', 'Подписаться'], bubbleBg: '#fff',
      sig: {
        png: [P('sun', 'Солнышко', (c, W, H, S2) => { c.save(); c.translate(W / 2, H / 2); c.strokeStyle = '#222'; c.lineWidth = 16; c.lineCap = 'round'; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.beginPath(); c.moveTo(Math.cos(a) * W * .3, Math.sin(a) * H * .3); c.lineTo(Math.cos(a) * W * .44, Math.sin(a) * H * .44); c.stroke(); } c.fillStyle = '#FFB800'; c.beginPath(); c.arc(0, 0, W * .24, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#222'; c.beginPath(); c.arc(-W * .08, -H * .03, W * .025, 0, TAU); c.arc(W * .08, -H * .03, W * .025, 0, TAU); c.fill(); c.beginPath(); c.arc(0, H * .04, W * .1, .2, Math.PI - .2); c.stroke(); c.restore(); }),
          P('cloud', 'Облачко', (c, W, H, S2) => { c.save(); c.fillStyle = '#fff'; c.strokeStyle = '#222'; c.lineWidth = 14; c.beginPath(); [[.32, .55, .16], [.5, .45, .22], [.68, .55, .16], [.5, .62, .16]].forEach(b => { c.moveTo(W * b[0] + W * b[2], H * b[1]); c.arc(W * b[0], H * b[1], W * b[2], 0, TAU); }); c.fill(); c.stroke(); c.restore(); })],
        an: [A('sun-spin', 'Солнышко крутится', (c, W, H, S2, t) => { c.save(); c.translate(W / 2, H / 2); c.rotate(t * .8); c.translate(-W / 2, -H / 2); ST.doodle.png.find(x => x.id === 'sun').draw(c, W, H, S2); c.restore(); }, 2)],
        tr: [A('paper', 'Лист бумаги', T.paper('#FFFDF5', '#222'), 1), A('flash', 'Жёлтая вспышка', T.flash('#FFB800'), 1)]
      },
      ov: [A('doodles', 'Каракули по краям', (c, W, H, S2, t) => { const R = rnd(Math.floor(t * 8) + 2); c.strokeStyle = '#222'; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); for (let x = 0; x < W; x += W / 16) { c.moveTo(x, 20 + R() * 20); c.lineTo(x + W / 32, 40 + R() * 20); c.moveTo(x, H - 30 - R() * 20); c.lineTo(x + W / 32, H - 50 - R() * 20); } c.stroke(); }, 2),
        A('stars', 'Звёздочки', (c, W, H, S2, t) => L.particles(c, W, H, S2, t, { shape: 'spark', n: 20, size: .03, colors: ['#FFB800', '#FF6B6B', '#3CB371'], twinkle: 1, dir: 'up', loop: 3, seed: 41 }), 3),
        A('hearts', 'Сердечки', (c, W, H, S2, t) => L.particles(c, W, H, S2, t, { shape: 'heart', n: 12, size: .04, colors: ['#FF6B6B'], dir: 'up', loop: 3, seed: 42 }), 3),
        A('frame', 'Рамка-каракуля', (c, W, H, S2, t) => L.frame(c, W, H, X(S2, { seed: Math.floor(t * 8) + 1, rough: 2.4 }), 1, { kind: 'rect', lw: 14, color: '#222' }), 2)],
      bg: [P('paper', 'Бумага', (c, W, H) => { c.fillStyle = '#FFFDF5'; c.fillRect(0, 0, W, H); L.noise(c, W, H, 0, { color: '#c9b98a', alpha: .15, size: 2 }); }), P('cells', 'Тетрадь в клетку', (c, W, H, S2) => { c.fillStyle = '#FFFDF5'; c.fillRect(0, 0, W, H); L.grid(c, W, H, S2, { color: '#9cc3e6', step: 54, lw: 2 }); }),
        P('yellow', 'Жёлтый', (c, W, H) => L.gradient(c, W, H, ['#FFD45C', '#FFB800'])), P('mint', 'Мятный', (c, W, H) => L.gradient(c, W, H, ['#d8f5e3', '#9be0b8'])),
        P('dots', 'Горошек', (c, W, H, S2) => { c.fillStyle = '#FFF4D6'; c.fillRect(0, 0, W, H); L.dotsBg(c, W, H, S2, { color: '#FF6B6B', step: 90, r: 10, alpha: .6 }); }), P('stripes', 'Полоски', (c, W, H, S2) => L.stripes(c, W, H, S2, { colors: ['#FFFDF5', '#FFE7A3', '#FFFDF5', '#C9F0D9'] }))],
      tx: [P('yellow', 'Жёлтая', outlinePlate('#FFB800', '#222', 10, 30)), P('white', 'Белая', outlinePlate('#fff', '#222', 10, 30)), P('green', 'Зелёная', outlinePlate('#3CB371', '#222', 10, 30)),
        P('red', 'Красная', outlinePlate('#FF6B6B', '#222', 10, 30)), P('marker', 'Маркер', markerPlate('rgba(255,184,0,.85)')), P('bubble', 'Пузырь', (c, W, H, S2) => L.bubble(c, W, H, S2, 1, { kind: 'round', bg: '#fff', line: '#222' }))] }); }

  /* ===== Футуризм / 3D ===== */
  { const S = { c1: '#8A5CFF', c2: '#00E5FF', c3: '#FF2E88', ink: '#08070D', font: 'Unbounded-ExtraBold', fontBody: 'Manrope-SemiBold', lw: 14, rough: 0, glow: 30 };
    ST.future = make({ name: 'Футуризм / 3D', S, paper: '#08070D', caps: true, radius: 8, onC1: '#fff', onC2: '#08070D', words: ['FUTURE', 'NEXT', 'LEVEL UP', 'Загрузка мысли', 'BOOM', '…', 'WOW', 'START'], bubbleBg: '#14121f', bubbleLine: '#00E5FF', bubbleText: '#fff',
      sig: {
        png: [P('orb', 'Хром-шар', (c, W, H) => { const g = c.createRadialGradient(W * .38, H * .35, W * .02, W / 2, H / 2, W * .42); g.addColorStop(0, '#fff'); g.addColorStop(.35, '#C0C6D6'); g.addColorStop(.7, '#3a3550'); g.addColorStop(1, '#08070D'); c.fillStyle = g; c.beginPath(); c.arc(W / 2, H / 2, W * .42, 0, TAU); c.fill(); }),
          P('hud', 'HUD-прицел', (c, W, H, S2) => { c.save(); c.translate(W / 2, H / 2); c.strokeStyle = '#00E5FF'; c.shadowColor = '#00E5FF'; c.shadowBlur = 20; c.lineWidth = 8; [.42, .3].forEach((r, i) => { c.beginPath(); c.arc(0, 0, W * r, i * .5, i * .5 + Math.PI * 1.4); c.stroke(); }); c.beginPath(); c.moveTo(-W * .48, 0); c.lineTo(-W * .2, 0); c.moveTo(W * .2, 0); c.lineTo(W * .48, 0); c.stroke(); c.restore(); })],
        an: [A('hud-spin', 'HUD крутится', (c, W, H, S2, t) => { c.save(); c.translate(W / 2, H / 2); c.rotate(t * 1.2); c.translate(-W / 2, -H / 2); ST.future.png.find(x => x.id === 'hud').draw(c, W, H, S2); c.restore(); }, 2)],
        tr: [A('glitch', 'Глитч', T.glitch(['#8A5CFF', '#00E5FF', '#FF2E88', '#08070D']), 1), A('diamond', 'Ромб', T.shape(diamondShape, '#8A5CFF', 1.6), 1)]
      },
      ov: [A('scan', 'Сканлайны', (c, W, H, S2, t) => L.scan(c, W, H, t, { alpha: .22, step: 6, band: '#00E5FF' }), 3), A('glitch', 'Глитч-полосы', (c, W, H, S2, t) => L.glitch(c, W, H, S2, t, { colors: ['#8A5CFF', '#00E5FF', '#FF2E88'] }), 2),
        A('hud', 'HUD-рамка', (c, W, H, S2) => L.frame(c, W, H, X(S2, { c1: '#00E5FF' }), 1, { kind: 'brackets', lw: 8 }), 2), A('particles', 'Неоновая пыль', (c, W, H, S2, t) => L.particles(c, W, H, S2, t, { n: 30, size: .012, colors: ['#00E5FF', '#8A5CFF', '#FF2E88'], twinkle: 1, dir: 'up', loop: 3, seed: 51 }), 3)],
      bg: [P('space', 'Космос', (c, W, H) => { L.gradient(c, W, H, ['#14102a', '#08070D']); L.noise(c, W, H, 0, { alpha: .6, size: 2.5, n: 900 }); }), P('neon', 'Неон', (c, W, H) => { c.fillStyle = '#08070D'; c.fillRect(0, 0, W, H); L.blobs(c, W, H, ['rgba(138,92,255,.6)', 'rgba(0,229,255,.45)', 'rgba(255,46,136,.4)'], { seed: 6 }); }),
        P('chrome', 'Хром', (c, W, H) => L.gradient(c, W, H, ['#c0c6d6', '#3a3550', '#08070D'], { radial: 1, cx: .3, cy: .3 })), P('grid', 'Неоновая сетка', (c, W, H, S2) => { c.fillStyle = '#08070D'; c.fillRect(0, 0, W, H); L.grid(c, W, H, S2, { color: '#8A5CFF', step: 80, lw: 2, alpha: .5 }); }),
        P('violet', 'Фиолетовый', (c, W, H) => L.gradient(c, W, H, ['#8A5CFF', '#2a1866'])), P('cyan', 'Бирюзовый', (c, W, H) => L.gradient(c, W, H, ['#00E5FF', '#06404d']))],
      tx: [P('violet', 'Фиолетовая', plate('#8A5CFF', 8)), P('glass', 'Стекло', (c, W, H) => { c.fillStyle = 'rgba(255,255,255,.12)'; c.strokeStyle = '#00E5FF'; c.lineWidth = 4; rrect(c, W * .04, H * .2, W * .92, H * .6, 8); c.fill(); c.stroke(); }),
        P('dark', 'Тёмная', outlinePlate('#08070D', '#8A5CFF', 6, 8)), P('cyan', 'Бирюзовая', plate('#00E5FF', 8)), P('pink', 'Розовая', plate('#FF2E88', 8)), P('hud', 'HUD-плашка', (c, W, H) => { c.strokeStyle = '#00E5FF'; c.lineWidth = 6; c.beginPath(); c.moveTo(W * .04, H * .35); c.lineTo(W * .04, H * .2); c.lineTo(W * .2, H * .2); c.moveTo(W * .96, H * .65); c.lineTo(W * .96, H * .8); c.lineTo(W * .8, H * .8); c.stroke(); c.fillStyle = 'rgba(0,229,255,.12)'; c.fillRect(W * .05, H * .21, W * .9, H * .58); })] }); }

  /* ===== Скрапбук / коллаж ===== */
  { const S = { c1: '#C96B4B', c2: '#D9B99B', c3: '#8BA888', ink: '#3B3027', font: 'Caveat-Bold', fontBody: 'PTSerif', lw: 18, rough: .8, glow: 0, shadow: 1 };
    ST.scrap = make({ name: 'Скрапбук / коллаж', S, paper: '#EFE6D6', onC1: '#fff', words: ['мой день', 'заметка', 'путешествие', 'помню этот момент', 'ура!', 'мечтаю…', 'вау', 'читать'], bubbleBg: '#fffaf0',
      sig: {
        png: [P('polaroid', 'Полароид', (c, W, H, S2) => L.frame(c, W, H, S2, 1, { kind: 'polaroid', text: 'лето ☼', tilt: -.06 })),
          P('tape', 'Скотч', (c, W, H) => { c.save(); c.translate(W / 2, H / 2); c.rotate(-.3); c.fillStyle = 'rgba(217,185,155,.85)'; c.beginPath(); c.moveTo(-W * .42, -H * .1); for (let i = 0; i <= 8; i++) c.lineTo(-W * .42 + i * W * .105, -H * .1 + (i % 2 ? -8 : 0)); for (let i = 8; i >= 0; i--) c.lineTo(-W * .42 + i * W * .105, H * .1 + (i % 2 ? 8 : 0)); c.fill(); c.restore(); })],
        an: [A('polaroid-drop', 'Полароид падает', (c, W, H, S2, t) => { const k = E.back(E.clamp(t / .5)); c.save(); c.translate(W / 2, H / 2); c.rotate((1 - k) * .4); c.scale(.6 + .4 * k, .6 + .4 * k); c.translate(-W / 2, -H / 2); L.frame(c, W, H, S2, 1, { kind: 'polaroid', text: 'лето ☼', tilt: -.06 }); c.restore(); }, 2)],
        tr: [A('paper', 'Рваная бумага', T.paper('#EFE6D6', '#D9B99B'), 1), A('paper2', 'Крафт', T.paper('#D9B99B', '#3B3027'), 1)]
      },
      ov: [A('grain', 'Зерно бумаги', (c, W, H, S2, t) => L.noise(c, W, H, t, { alpha: .3, size: 2 }), 3), A('leak', 'Тёплый свет', (c, W, H, S2, t) => L.leak(c, W, H, t, { colors: ['rgba(255,180,110,.6)', 'rgba(255,220,170,.5)', 'rgba(201,107,75,.4)'] }), 3),
        A('frame', 'Рамка-полароид', (c, W, H, S2) => { c.fillStyle = '#fdfcf8'; const m = Math.min(W, H) * .05; c.fillRect(0, 0, W, m); c.fillRect(0, 0, m, H); c.fillRect(W - m, 0, m, H); c.fillRect(0, H - m * 3, W, m * 3); text(c, 'мой день ♡', W / 2, H - m * 1.5, S2, m * 1.3, { color: '#3B3027' }); }, 2),
        A('petals', 'Сухие лепестки', (c, W, H, S2, t) => L.particles(c, W, H, S2, t, { shape: 'petal', n: 16, size: .025, colors: ['#C96B4B', '#D9B99B', '#8BA888'], loop: 3, seed: 61 }), 3)],
      bg: [P('kraft', 'Крафт', (c, W, H) => { L.gradient(c, W, H, ['#D9B99B', '#c4a07e']); L.noise(c, W, H, 0, { color: '#5c4630', alpha: .25, size: 2 }); }), P('paper', 'Бумага', (c, W, H) => { c.fillStyle = '#EFE6D6'; c.fillRect(0, 0, W, H); L.noise(c, W, H, 0, { color: '#8a7350', alpha: .15, size: 2 }); }),
        P('lined', 'Линейка', (c, W, H) => { c.fillStyle = '#fbf7ee'; c.fillRect(0, 0, W, H); c.strokeStyle = '#b8cde0'; c.lineWidth = 2; for (let y = 120; y < H; y += 56) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); } c.strokeStyle = '#e8a0a0'; c.beginPath(); c.moveTo(W * .1, 0); c.lineTo(W * .1, H); c.stroke(); }),
        P('sage', 'Шалфей', (c, W, H) => L.gradient(c, W, H, ['#c9d6c4', '#8BA888'])), P('collage', 'Коллаж', (c, W, H) => { c.fillStyle = '#EFE6D6'; c.fillRect(0, 0, W, H); const R = rnd(7); for (let i = 0; i < 9; i++) { c.save(); c.translate(R() * W, R() * H); c.rotate((R() - .5) * .6); c.fillStyle = ['#D9B99B', '#8BA888', '#C96B4B', '#fffaf0'][i % 4]; c.globalAlpha = .7; c.fillRect(-W * .2, -H * .1, W * .4, H * .2); c.restore(); } }),
        P('dots', 'Горошек', (c, W, H, S2) => { c.fillStyle = '#EFE6D6'; c.fillRect(0, 0, W, H); L.dotsBg(c, W, H, S2, { color: '#C96B4B', step: 64, r: 6, alpha: .5 }); })],
      tx: [P('note', 'Заметка', (c, W, H) => { c.fillStyle = '#fffaf0'; c.shadowColor = 'rgba(0,0,0,.2)'; c.shadowBlur = 20; c.fillRect(W * .04, H * .18, W * .92, H * .64); c.shadowBlur = 0; D.tape(c, W, H, '#D9B99B', .5, .2, -.04); }),
        P('kraft', 'Крафт', plate('#D9B99B', 4)), P('terra', 'Терракота', plate('#C96B4B', 4)), P('sage', 'Шалфей', plate('#8BA888', 4)), P('torn', 'Рваный край', (c, W, H) => { const R = rnd(3); c.fillStyle = '#fffaf0'; c.beginPath(); c.moveTo(W * .04, H * .2); for (let x = W * .04; x <= W * .96; x += W / 40) c.lineTo(x, H * .2 + R() * 14); for (let x = W * .96; x >= W * .04; x -= W / 40) c.lineTo(x, H * .8 - R() * 14); c.fill(); }),
        P('marker', 'Маркер', markerPlate('rgba(201,107,75,.75)'))] }); }

  /* ===== Люкс / минимализм ===== */
  { const S = { c1: '#B89A5B', c2: '#D8CFC0', c3: '#4A4A4A', ink: '#111111', font: 'PlayfairDisplay-Bold', fontBody: 'Montserrat-ExtraBold', lw: 8, rough: 0, glow: 0 };
    ST.lux = make({ name: 'Люкс / минимализм', S, paper: '#F7F5F0', radius: 2, onC1: '#fff', words: ['Premium', 'Exclusive', 'Limited', 'Детали решают', 'New', '…', 'Sale', 'Подробнее'], bubbleBg: '#F7F5F0',
      sig: {
        png: [P('monogram', 'Монограмма', (c, W, H, S2) => { c.strokeStyle = '#B89A5B'; c.lineWidth = 6; c.beginPath(); c.arc(W / 2, H / 2, W * .4, 0, TAU); c.stroke(); c.beginPath(); c.arc(W / 2, H / 2, W * .36, 0, TAU); c.stroke(); text(c, 'KK', W / 2, H * .52, S2, H * .32, { color: '#B89A5B' }); }),
          P('line-gold', 'Золотая линия', (c, W, H) => { const g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(184,154,91,0)'); g.addColorStop(.5, '#B89A5B'); g.addColorStop(1, 'rgba(184,154,91,0)'); c.fillStyle = g; c.fillRect(0, H / 2 - 3, W, 6); c.save(); c.translate(W / 2, H / 2); c.rotate(Math.PI / 4); c.fillStyle = '#B89A5B'; c.fillRect(-14, -14, 28, 28); c.restore(); })],
        an: [A('shine', 'Блик по золоту', (c, W, H, S2, t) => { ST.lux.png.find(x => x.id === 'monogram').draw(c, W, H, S2); c.save(); c.globalCompositeOperation = 'source-atop'; const x = ((t / 2) % 1) * W * 1.6 - W * .3, g = c.createLinearGradient(x - 80, 0, x + 80, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore(); }, 2)],
        tr: [A('curtain', 'Шторы', T.curtain('#111111'), 1), A('flash', 'Мягкая вспышка', T.flash('#F7F5F0'), 1)]
      },
      ov: [A('gold-dust', 'Золотая пыль', (c, W, H, S2, t) => L.particles(c, W, H, S2, t, { n: 30, size: .01, colors: ['#B89A5B', '#e8d6a8'], twinkle: 1, dir: 'up', loop: 3, seed: 71 }), 3), A('frame', 'Тонкая рамка', (c, W, H) => { c.strokeStyle = '#B89A5B'; c.lineWidth = 3; const m = Math.min(W, H) * .05; c.strokeRect(m, m, W - 2 * m, H - 2 * m); c.strokeRect(m + 10, m + 10, W - 2 * m - 20, H - 2 * m - 20); }, 2),
        A('leak', 'Тёплый блик', (c, W, H, S2, t) => L.leak(c, W, H, t, { colors: ['rgba(232,214,168,.5)', 'rgba(184,154,91,.4)', 'rgba(255,255,255,.3)'] }), 3), A('grain', 'Плёночное зерно', (c, W, H, S2, t) => L.noise(c, W, H, t, { alpha: .25, size: 1.6 }), 3)],
      bg: [P('ivory', 'Слоновая кость', (c, W, H) => L.gradient(c, W, H, ['#F7F5F0', '#ECE6DA'])), P('black', 'Чёрный', (c, W, H) => L.gradient(c, W, H, ['#222', '#0a0a0a'], { radial: 1 })), P('beige', 'Бежевый', (c, W, H) => L.gradient(c, W, H, ['#E6DFD2', '#D8CFC0'])),
        P('marble', 'Мрамор', (c, W, H) => { c.fillStyle = '#F4F2EE'; c.fillRect(0, 0, W, H); const R = rnd(8); c.strokeStyle = 'rgba(120,120,120,.25)'; for (let i = 0; i < 14; i++) { c.lineWidth = 1 + R() * 3; c.beginPath(); let x = R() * W, y = 0; c.moveTo(x, y); while (y < H) { x += (R() - .5) * 120; y += 60; c.lineTo(x, y); } c.stroke(); } }),
        P('gold', 'Золото', (c, W, H) => L.gradient(c, W, H, ['#e8d6a8', '#B89A5B', '#8a6f37'])), P('graphite', 'Графит', (c, W, H) => L.gradient(c, W, H, ['#4A4A4A', '#1a1a1a']))],
      tx: [P('black', 'Чёрная', plate('#111111', 2)), P('ivory', 'Светлая', outlinePlate('#F7F5F0', '#B89A5B', 3, 2)), P('gold', 'Золотая', plate('#B89A5B', 2)),
        P('lines', 'Между линиями', (c, W, H) => { c.fillStyle = '#B89A5B'; c.fillRect(W * .1, H * .22, W * .8, 3); c.fillRect(W * .1, H * .78, W * .8, 3); }), P('glass', 'Матовая', (c, W, H) => { c.fillStyle = 'rgba(247,245,240,.75)'; rrect(c, W * .04, H * .2, W * .92, H * .6, 2); c.fill(); }), P('graphite', 'Графит', plate('#4A4A4A', 2))] }); }

  /* ===== Кино ===== */
  { const S = { c1: '#C9A86A', c2: '#E9E1D3', c3: '#8C1C13', ink: '#0A0A0A', font: 'AlumniSans-Bold', fontBody: 'PTSerif', lw: 10, rough: 0, glow: 0 };
    ST.cinema = make({ name: 'Кино', S, paper: '#0A0A0A', caps: true, radius: 0, onC1: '#0A0A0A', words: ['Глава I', 'Скоро', 'Премьера', 'Всё началось здесь', 'Мотор!', '…', 'Финал', 'Смотреть'], bubbleBg: '#E9E1D3',
      sig: {
        png: [P('clapper', 'Хлопушка', (c, W, H, S2) => { c.save(); c.translate(W * .12, H * .3); const w = W * .76, h = H * .5; c.fillStyle = '#0A0A0A'; c.fillRect(0, h * .2, w, h * .8); c.save(); c.translate(0, h * .2); c.rotate(-.18); c.fillRect(0, -h * .2, w, h * .2); for (let i = 0; i < 6; i++) { c.fillStyle = '#E9E1D3'; c.beginPath(); c.moveTo(i * w / 6 + 10, -h * .2); c.lineTo(i * w / 6 + w / 12 + 10, -h * .2); c.lineTo(i * w / 6 + 10, 0); c.lineTo(i * w / 6 - w / 12 + 10, 0); c.fill(); } c.restore(); text(c, 'СЦЕНА 1  ДУБЛЬ 3', w / 2, h * .62, S2, h * .14, { color: '#E9E1D3', maxW: w * .9 }); c.restore(); }),
          P('film', 'Плёнка', (c, W, H, S2) => L.frame(c, W, H, S2, 1, { kind: 'film' }))],
        an: [A('countdown', 'Отсчёт плёнки', (c, W, H, S2, t) => { c.fillStyle = 'rgba(233,225,211,.9)'; c.beginPath(); c.arc(W / 2, H / 2, W * .42, 0, TAU); c.fill(); c.fillStyle = 'rgba(10,10,10,.35)'; c.beginPath(); c.moveTo(W / 2, H / 2); c.arc(W / 2, H / 2, W * .42, -Math.PI / 2, -Math.PI / 2 + (t % 1) * TAU); c.fill(); c.strokeStyle = '#0A0A0A'; c.lineWidth = 6; c.beginPath(); c.moveTo(W * .08, H / 2); c.lineTo(W * .92, H / 2); c.moveTo(W / 2, H * .08); c.lineTo(W / 2, H * .92); c.stroke(); text(c, String(3 - Math.floor(t % 3)), W / 2, H * .53, S2, H * .5, { color: '#0A0A0A' }); }, 3)],
        tr: [A('curtain', 'Шторы', T.curtain('#0A0A0A'), 1), A('flash', 'Вспышка проектора', T.flash('#E9E1D3'), 1)]
      },
      ov: [A('letterbox', 'Кинокаше', (c, W, H) => { const h = Math.max(0, (H - W / 2.39) / 2); c.fillStyle = '#000'; c.fillRect(0, 0, W, h); c.fillRect(0, H - h, W, h); }, 2), A('grain', 'Зерно плёнки', (c, W, H, S2, t) => { L.noise(c, W, H, t, { alpha: .45, size: 2 }); if (rnd(Math.floor(t * 24))() > .8) { c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(rnd(Math.floor(t * 24) + 5)() * W, 0, 2, H); } }, 3),
        A('leak', 'Засветка плёнки', (c, W, H, S2, t) => L.leak(c, W, H, t, { colors: ['rgba(255,120,40,.7)', 'rgba(255,200,120,.5)', 'rgba(140,28,19,.45)'] }), 3), A('rec', 'REC-рамка', (c, W, H, S2, t) => { L.frame(c, W, H, X(S2, { c1: '#fff' }), 1, { kind: 'brackets', lw: 5 }); if ((t % 1) < .55) { c.fillStyle = '#ff2b2b'; c.beginPath(); c.arc(W * .1, H * .07, 12, 0, TAU); c.fill(); } }, 2)],
      bg: [P('black', 'Чёрный', (c, W, H) => { c.fillStyle = '#0A0A0A'; c.fillRect(0, 0, W, H); }), P('teal', 'Тил-оранж', (c, W, H) => L.gradient(c, W, H, ['#1f3a40', '#5E6B73', '#c9864a'])), P('paper', 'Титры на бумаге', (c, W, H) => { L.gradient(c, W, H, ['#E9E1D3', '#d2c6b0']); L.noise(c, W, H, 0, { color: '#5a4a30', alpha: .15, size: 2 }); }),
        P('vignette', 'Виньетка', (c, W, H) => L.gradient(c, W, H, ['#5E6B73', '#0A0A0A'], { radial: 1, cy: .5 })), P('red', 'Бархат', (c, W, H) => { const R = rnd(2); L.gradient(c, W, H, ['#8C1C13', '#3a0905']); for (let x = 0; x < W; x += W / 14) { const g = c.createLinearGradient(x, 0, x + W / 14, 0); g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(.5, 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(0,0,0,.35)'); c.fillStyle = g; c.fillRect(x, 0, W / 14, H); } }),
        P('gold', 'Золото титров', (c, W, H) => L.gradient(c, W, H, ['#C9A86A', '#6e5428']))],
      tx: [P('black', 'Чёрная', plate('#0A0A0A', 0)), P('paper', 'Бумага', plate('#E9E1D3', 0)), P('lines', 'Титр между линий', (c, W, H) => { c.fillStyle = '#C9A86A'; c.fillRect(W * .2, H * .24, W * .6, 4); c.fillRect(W * .2, H * .76, W * .6, 4); }),
        P('gold', 'Золотая', plate('#C9A86A', 0)), P('red', 'Красная', plate('#8C1C13', 0)), P('subtitle', 'Под субтитр', (c, W, H) => { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(W * .04, H * .28, W * .92, H * .44); })] }); }

  /* ===== Эксперт / бизнес ===== */
  { const S = { c1: '#1E3A8A', c2: '#22C55E', c3: '#F59E0B', ink: '#0F172A', font: 'Montserrat-Black', fontBody: 'Inter-Medium', lw: 16, rough: 0, glow: 0, shadow: 1 };
    ST.expert = make({ name: 'Эксперт / бизнес', S, paper: '#FFFFFF', radius: 14, onC1: '#fff', onC2: '#fff', words: ['Важно', 'Кейс', '+240%', 'Как это работает', 'Ошибка', 'Подумай…', 'Факт', 'Записаться'], bubbleBg: '#fff',
      sig: {
        png: [P('chart', 'График роста', (c, W, H, S2) => { const v = [.2, .35, .3, .55, .5, .8]; v.forEach((y, i) => { c.fillStyle = i === 5 ? '#22C55E' : '#1E3A8A'; rrect(c, W * (.1 + i * .135), H * (.85 - y * .7), W * .1, H * y * .7, 10); c.fill(); }); L.arrow(c, W, H, X(S2, { c1: '#F59E0B' }), 1, { bend: .1, lw: 14 }); }),
          P('pct', 'Проценты', (c, W, H, S2) => { c.fillStyle = '#22C55E'; c.beginPath(); c.arc(W / 2, H / 2, W * .42, 0, TAU); c.fill(); text(c, '%', W / 2, H * .53, S2, H * .5, { color: '#fff' }); })],
        an: [A('chart-grow', 'График растёт', (c, W, H, S2, t) => { const v = [.2, .35, .3, .55, .5, .8]; v.forEach((y, i) => { const k = E.out(E.clamp((t - i * .12) / .5)); c.fillStyle = i === 5 ? '#22C55E' : '#1E3A8A'; rrect(c, W * (.1 + i * .135), H * (.85 - y * .7 * k), W * .1, Math.max(1, H * y * .7 * k), 10); c.fill(); }); }, 2)],
        tr: [A('slide-up', 'Шторка вверх', T.slide('#1E3A8A', null, true), 1), A('flash', 'Белая вспышка', T.flash('#ffffff'), 1)]
      },
      ov: [A('frame', 'Рамка-фокус', (c, W, H, S2) => L.frame(c, W, H, X(S2, { c1: '#fff', shadow: 0 }), 1, { kind: 'brackets', lw: 6 }), 2), A('particles', 'Мягкие точки', (c, W, H, S2, t) => L.particles(c, W, H, S2, t, { n: 20, size: .02, colors: ['rgba(30,58,138,.5)', 'rgba(34,197,94,.5)'], dir: 'up', loop: 3, seed: 81 }), 3),
        A('grid', 'Сетка-разметка', (c, W, H, S2) => { c.globalAlpha = .3; L.grid(c, W, H, S2, { color: '#fff', step: Math.round(W / 6), lw: 2 }); c.globalAlpha = 1; }, 2), A('leak', 'Мягкий свет', (c, W, H, S2, t) => L.leak(c, W, H, t, { colors: ['rgba(120,160,255,.45)', 'rgba(255,255,255,.35)', 'rgba(34,197,94,.3)'] }), 3)],
      bg: [P('white', 'Белый', (c, W, H) => L.gradient(c, W, H, ['#ffffff', '#eef2ff'])), P('navy', 'Тёмно-синий', (c, W, H) => L.gradient(c, W, H, ['#1E3A8A', '#0F172A'])), P('soft', 'Голубой', (c, W, H) => L.gradient(c, W, H, ['#fff', '#dbe4ff'])),
        P('grid', 'Клетка', (c, W, H, S2) => { c.fillStyle = '#F8FAFC'; c.fillRect(0, 0, W, H); L.grid(c, W, H, S2, { color: '#e2e8f0', step: 60, lw: 2 }); }), P('green', 'Зелёный', (c, W, H) => L.gradient(c, W, H, ['#22C55E', '#14532d'])), P('office', 'Офис-блюр', (c, W, H) => { L.gradient(c, W, H, ['#e5e7eb', '#9ca3af']); L.blobs(c, W, H, ['rgba(255,255,255,.7)', 'rgba(30,58,138,.25)', 'rgba(245,158,11,.25)'], { seed: 3 }); })],
      tx: [P('navy', 'Синяя', plate('#1E3A8A', 14)), P('white', 'Белая с тенью', (c, W, H) => { c.shadowColor = 'rgba(0,0,0,.18)'; c.shadowBlur = 30; c.shadowOffsetY = 10; c.fillStyle = '#fff'; rrect(c, W * .04, H * .2, W * .92, H * .6, 14); c.fill(); }), P('green', 'Зелёная', plate('#22C55E', 14)),
        P('amber', 'Акцент', plate('#F59E0B', 14)), P('accent-bar', 'С полосой', (c, W, H) => { c.fillStyle = '#fff'; rrect(c, W * .04, H * .2, W * .92, H * .6, 14); c.fill(); c.fillStyle = '#1E3A8A'; c.fillRect(W * .04, H * .2, W * .02, H * .6); }), P('dark', 'Тёмная', plate('#0F172A', 14))] }); }

  /* ===== Гранж / стрит ===== */
  { const S = { c1: '#FFD60A', c2: '#FF3B30', c3: '#E5E5E5', ink: '#1A1A1A', font: 'RubikSprayPaint', fontBody: 'FiraSansXC-SemiBold', lw: 26, rough: 1.6, glow: 0 };
    ST.grunge = make({ name: 'Гранж / стрит', S, paper: '#1A1A1A', caps: true, radius: 0, onC2: '#fff', words: ['DROP', 'STREET', 'NO RULES', 'Делай громче', 'БАХ', '???', 'HYPE', 'Подписка'], bubbleBg: '#E5E5E5',
      sig: {
        png: [P('spray', 'Пятно краски', (c, W, H) => { D.spray(c, W / 2, H / 2, W * .4, '#FF3B30', 5); D.spray(c, W * .55, H * .45, W * .25, '#FFD60A', 6); }),
          P('crown', 'Корона-тег', (c, W, H, S2) => { c.save(); c.strokeStyle = '#FFD60A'; c.lineWidth = 22; c.lineJoin = 'round'; c.beginPath(); c.moveTo(W * .15, H * .7); c.lineTo(W * .2, H * .3); c.lineTo(W * .38, H * .52); c.lineTo(W * .5, H * .22); c.lineTo(W * .62, H * .52); c.lineTo(W * .8, H * .3); c.lineTo(W * .85, H * .7); c.closePath(); c.stroke(); c.restore(); })],
        an: [A('spray-in', 'Краска распыляется', (c, W, H, S2, t) => { const k = E.out(E.clamp(t / .6)); D.spray(c, W / 2, H / 2, W * .4 * k, '#FF3B30', 5); D.spray(c, W * .55, H * .45, W * .25 * k, '#FFD60A', 6); }, 2)],
        tr: [A('glitch', 'Глитч', T.glitch(['#1A1A1A', '#FFD60A', '#FF3B30', '#E5E5E5']), 1), A('flash', 'Жёлтая вспышка', T.flash('#FFD60A'), 1)]
      },
      ov: [A('grain', 'Грязное зерно', (c, W, H, S2, t) => L.noise(c, W, H, t, { alpha: .55, size: 3 }), 3), A('scratches', 'Царапины', (c, W, H, S2, t) => { const R = rnd(Math.floor(t * 12) + 9); c.strokeStyle = 'rgba(255,255,255,.6)'; for (let i = 0; i < 6; i++) { c.lineWidth = 1 + R() * 2; c.beginPath(); const x = R() * W; c.moveTo(x, R() * H * .3); c.lineTo(x + (R() - .5) * 60, H * (.6 + R() * .4)); c.stroke(); } }, 2),
        A('glitch', 'Глитч', (c, W, H, S2, t) => L.glitch(c, W, H, S2, t, { colors: ['#FFD60A', '#FF3B30', '#E5E5E5'] }), 2), A('tape', 'Лента «осторожно»', (c, W, H, S2, t) => { c.save(); c.translate(W / 2, H * .85); c.rotate(-.12); c.fillStyle = '#FFD60A'; c.fillRect(-W, -H * .035, W * 2, H * .07); c.fillStyle = '#1A1A1A'; const off = (t * 120) % 120; for (let x = -W - 120 + off; x < W; x += 120) { c.beginPath(); c.moveTo(x, -H * .035); c.lineTo(x + 60, -H * .035); c.lineTo(x + 30, H * .035); c.lineTo(x - 30, H * .035); c.fill(); } c.restore(); }, 2)],
      bg: [P('asphalt', 'Асфальт', (c, W, H) => { c.fillStyle = '#1A1A1A'; c.fillRect(0, 0, W, H); L.noise(c, W, H, 0, { alpha: .5, size: 3, n: W * H / 300 }); }), P('concrete', 'Бетон', (c, W, H) => { L.gradient(c, W, H, ['#8a8a8a', '#6B6B6B']); L.noise(c, W, H, 0, { color: '#000', alpha: .3, size: 3 }); }),
        P('yellow', 'Жёлтый', (c, W, H) => { c.fillStyle = '#FFD60A'; c.fillRect(0, 0, W, H); L.noise(c, W, H, 0, { color: '#000', alpha: .2, size: 3 }); }), P('red', 'Красный', (c, W, H) => { c.fillStyle = '#FF3B30'; c.fillRect(0, 0, W, H); L.noise(c, W, H, 0, { color: '#000', alpha: .25, size: 3 }); }),
        P('spray', 'Граффити-стена', (c, W, H) => { c.fillStyle = '#2a2a2a'; c.fillRect(0, 0, W, H); D.spray(c, W * .3, H * .3, W * .5, '#FF3B30', 2); D.spray(c, W * .7, H * .7, W * .5, '#FFD60A', 3); }), P('stripes', 'Полосы', (c, W, H) => { c.save(); c.translate(W / 2, H / 2); c.rotate(-.6); for (let i = -20; i < 20; i++) { c.fillStyle = i % 2 ? '#1A1A1A' : '#FFD60A'; c.fillRect(i * 80, -H * 2, 80, H * 4); } c.restore(); })],
      tx: [P('yellow', 'Жёлтая', plate('#FFD60A', 0)), P('black', 'Чёрная', plate('#1A1A1A', 0)), P('red', 'Красная', plate('#FF3B30', 0)), P('torn', 'Рваная', (c, W, H) => { const R = rnd(4); c.fillStyle = '#E5E5E5'; c.beginPath(); c.moveTo(W * .04, H * .22); for (let x = W * .04; x <= W * .96; x += W / 30) c.lineTo(x, H * .2 + R() * 22); for (let x = W * .96; x >= W * .04; x -= W / 30) c.lineTo(x, H * .8 - R() * 22); c.fill(); }),
        P('spray', 'Распылённая', (c, W, H) => { D.spray(c, W / 2, H / 2, W * .48, 'rgba(255,214,10,.9)', 4); }), P('tape', 'Скотч', (c, W, H) => { c.save(); c.translate(W / 2, H / 2); c.rotate(-.03); c.fillStyle = 'rgba(229,229,229,.9)'; c.fillRect(-W * .46, -H * .26, W * .92, H * .52); c.restore(); })] }); }

  /* ===== Природа / эко ===== (зелёное внутри — хромакей по розовому) */
  { const S = { c1: '#5F7A4E', c2: '#D9A45B', c3: '#A7B88F', ink: '#3A3A2E', font: 'AmaticSC-Bold', fontBody: 'Nunito-Bold', lw: 16, rough: .5, glow: 0 };
    ST.eco = make({ name: 'Природа / эко', S, paper: '#F3EFE4', key: '#FF00FF', onC1: '#fff', words: ['эко', 'натурально', 'забота', 'дыши глубже', 'ура!', 'хм…', 'свежо', 'Подробнее'], bubbleBg: '#fffdf6',
      sig: {
        png: [P('leaf', 'Лист', (c, W, H) => D.leaf(c, W, H, '#5F7A4E', '#A7B88F')), P('sprout', 'Росток', (c, W, H) => { c.strokeStyle = '#5F7A4E'; c.lineWidth = 18; c.lineCap = 'round'; c.beginPath(); c.moveTo(W / 2, H * .9); c.quadraticCurveTo(W * .45, H * .6, W / 2, H * .45); c.stroke(); c.save(); c.translate(W * .36, H * .38); c.rotate(-.9); leafShape(c, W * .18, '#A7B88F'); c.restore(); c.save(); c.translate(W * .64, H * .32); c.rotate(.9); leafShape(c, W * .2, '#5F7A4E'); c.restore(); })],
        an: [A('leaf-sway', 'Лист качается', (c, W, H, S2, t) => { c.save(); c.translate(W / 2, H * .9); c.rotate(Math.sin(t * Math.PI) * .2); c.translate(-W / 2, -H * .9); D.leaf(c, W, H, '#5F7A4E', '#A7B88F'); c.restore(); }, 2)],
        tr: [A('leaf', 'Лист', T.shape(leafShape, '#5F7A4E', .8), 1), A('paper', 'Крафт', T.paper('#F3EFE4', '#A7B88F'), 1)]
      },
      ov: [A('leaves', 'Летят листья', (c, W, H, S2, t) => L.particles(c, W, H, S2, t, { shape: 'petal', n: 16, size: .03, colors: ['#5F7A4E', '#A7B88F', '#D9A45B'], loop: 3, seed: 91 }), 3), A('leak', 'Солнечный свет', (c, W, H, S2, t) => L.leak(c, W, H, t, { colors: ['rgba(255,220,140,.6)', 'rgba(217,164,91,.45)', 'rgba(255,250,220,.4)'] }), 3),
        A('pollen', 'Пыльца', (c, W, H, S2, t) => L.particles(c, W, H, S2, t, { n: 26, size: .01, colors: ['#fff6d0'], twinkle: 1, dir: 'up', loop: 3, seed: 92 }), 3), A('grain', 'Зерно', (c, W, H, S2, t) => L.noise(c, W, H, t, { alpha: .25, size: 2 }), 3)],
      bg: [P('linen', 'Лён', (c, W, H) => { L.gradient(c, W, H, ['#F3EFE4', '#e6dfcc']); L.noise(c, W, H, 0, { color: '#8a7a50', alpha: .15, size: 2 }); }), P('sage', 'Шалфей', (c, W, H) => L.gradient(c, W, H, ['#f3efe4', '#A7B88F'])), P('forest', 'Лес', (c, W, H) => L.gradient(c, W, H, ['#5F7A4E', '#2c3a22'])),
        P('honey', 'Мёд', (c, W, H) => L.gradient(c, W, H, ['#f2d29b', '#D9A45B'])), P('leaves', 'Листья', (c, W, H) => { c.fillStyle = '#e8eddc'; c.fillRect(0, 0, W, H); const R = rnd(5); for (let i = 0; i < 26; i++) { c.save(); c.translate(R() * W, R() * H); c.rotate(R() * TAU); leafShape(c, 40 + R() * 60, ['#A7B88F', '#5F7A4E', '#c9d4b6'][i % 3]); c.restore(); } }), P('sky', 'Утро', (c, W, H) => L.gradient(c, W, H, ['#fdf6e3', '#f3efe4', '#d6e3c8']))],
      tx: [P('green', 'Зелёная', plate('#5F7A4E', 40)), P('linen', 'Льняная', outlinePlate('#F3EFE4', '#5F7A4E', 4, 40)), P('honey', 'Медовая', plate('#D9A45B', 40)), P('sage', 'Шалфей', plate('#A7B88F', 40)),
        P('leaf-edge', 'С листиком', (c, W, H) => { c.fillStyle = '#fffdf6'; rrect(c, W * .04, H * .2, W * .92, H * .6, 40); c.fill(); c.save(); c.translate(W * .07, H * .26); c.rotate(-.6); leafShape(c, H * .12, '#5F7A4E'); c.restore(); }), P('marker', 'Маркер', markerPlate('rgba(167,184,143,.85)'))] }); }

  /* ===== Сезонные ===== */
  { const S = { c1: '#D7263D', c2: '#F4D35E', c3: '#1B998B', ink: '#0D3B66', font: 'Lobster', fontBody: 'Montserrat-ExtraBold', lw: 18, rough: .2, glow: 14, glowColor: 'rgba(255,255,255,.8)' };
    ST.season = make({ name: 'Сезонные', S, paper: '#0D3B66', key: '#FF00FF', onC1: '#fff', words: ['С Новым годом!', 'Скидки', 'Подарок', 'Желаю счастья', 'Ура!', 'Загадай…', 'SALE', 'Забрать'], bubbleBg: '#fff',
      sig: {
        png: [P('snowflake', 'Снежинка', (c, W, H) => D.snow(c, W, H, '#ffffff')), P('gift', 'Подарок', (c, W, H) => { c.fillStyle = '#D7263D'; c.fillRect(W * .2, H * .4, W * .6, H * .45); c.fillRect(W * .16, H * .3, W * .68, H * .14); c.fillStyle = '#F4D35E'; c.fillRect(W * .46, H * .3, W * .08, H * .55); c.save(); c.translate(W / 2, H * .3); [-1, 1].forEach(d => { c.beginPath(); c.ellipse(d * W * .1, -H * .06, W * .1, H * .06, d * .5, 0, TAU); c.fill(); }); c.restore(); })],
        an: [A('snow-spin', 'Снежинка кружится', (c, W, H, S2, t) => { c.save(); c.translate(W / 2, H / 2); c.rotate(t * .6); c.scale(.85 + .15 * Math.sin(t * 3), .85 + .15 * Math.sin(t * 3)); snowShape(c, Math.min(W, H) * .42, '#fff'); c.restore(); }, 2)],
        tr: [A('snow', 'Снежинка', T.shape((c, s, col) => { c.fillStyle = col; c.beginPath(); c.arc(0, 0, s * .5, 0, TAU); c.fill(); snowShape(c, s, col); }, '#ffffff', 1), 1), A('flash', 'Золотая вспышка', T.flash('#F4D35E'), 1)]
      },
      ov: [A('snow', 'Снегопад', (c, W, H, S2, t) => L.particles(c, W, H, S2, t, { n: 40, size: .012, colors: ['#ffffff'], loop: 3, seed: 101 }), 3), A('garland', 'Гирлянда', (c, W, H, S2, t) => { const n = 14; c.strokeStyle = '#1B998B'; c.lineWidth = 4; c.beginPath(); for (let i = 0; i <= n; i++) c.lineTo(i / n * W, H * .05 + Math.sin(i / n * Math.PI * 3) * H * .02); c.stroke(); for (let i = 0; i <= n; i++) { const on = ((i + Math.floor(t * 4)) % 3) === 0; c.fillStyle = ['#D7263D', '#F4D35E', '#1B998B'][i % 3]; c.globalAlpha = on ? 1 : .35; c.shadowColor = c.fillStyle; c.shadowBlur = on ? 25 : 0; c.beginPath(); c.arc(i / n * W, H * .065 + Math.sin(i / n * Math.PI * 3) * H * .02, 14, 0, TAU); c.fill(); } c.globalAlpha = 1; c.shadowBlur = 0; }, 2),
        A('confetti', 'Конфетти', (c, W, H, S2, t) => L.particles(c, W, H, S2, t, { shape: 'petal', n: 30, size: .015, colors: ['#D7263D', '#F4D35E', '#1B998B', '#fff'], loop: 3, seed: 102 }), 3), A('sparkles', 'Огоньки', (c, W, H, S2, t) => L.particles(c, W, H, S2, t, { shape: 'spark', n: 22, size: .02, colors: ['#F4D35E', '#fff'], twinkle: 1, dir: 'up', loop: 3, seed: 103 }), 3)],
      bg: [P('night', 'Зимняя ночь', (c, W, H) => { L.gradient(c, W, H, ['#0D3B66', '#06203a']); L.noise(c, W, H, 0, { alpha: .5, size: 2.5, n: 700 }); }), P('teal', 'Ель', (c, W, H) => L.gradient(c, W, H, ['#1B998B', '#0D3B66'])), P('red', 'Праздничный красный', (c, W, H) => L.gradient(c, W, H, ['#e8485c', '#D7263D', '#8f1222'], { radial: 1 })),
        P('gold', 'Золото', (c, W, H) => { L.gradient(c, W, H, ['#f8e7a6', '#F4D35E', '#c9a227']); L.particles(c, W, H, { c1: '#fff' }, 0, { n: 40, size: .01, colors: ['rgba(255,255,255,.8)'], seed: 7 }); }), P('snowy', 'Снежный', (c, W, H) => L.gradient(c, W, H, ['#ffffff', '#dfeaf5'])), P('stripes', 'Леденец', (c, W, H) => { c.save(); c.translate(W / 2, H / 2); c.rotate(-.7); for (let i = -20; i < 20; i++) { c.fillStyle = i % 2 ? '#fff' : '#D7263D'; c.fillRect(i * 90, -H * 2, 90, H * 4); } c.restore(); })],
      tx: [P('red', 'Красная', plate('#D7263D', 30)), P('gold', 'Золотая', plate('#F4D35E', 30)), P('teal', 'Еловая', plate('#1B998B', 30)), P('white', 'Снежная', outlinePlate('#fff', '#D7263D', 6, 30)),
        P('navy', 'Ночная', plate('#0D3B66', 30)), P('ribbon', 'Лента', (c, W, H) => { c.fillStyle = '#D7263D'; c.beginPath(); c.moveTo(0, H * .3); c.lineTo(W * .06, H * .5); c.lineTo(0, H * .7); c.lineTo(W, H * .7); c.lineTo(W * .94, H * .5); c.lineTo(W, H * .3); c.closePath(); c.fill(); })] }); }
})(window);

/* ---- styles3.js ---- */
/* Общий набор «Текстуры» — для любого стиля. Кладутся ПОВЕРХ видео с режимом наложения
   (Премьер: «Перекрытие» / «Умножение» / «Экран», CapCut: «Смешивание» → «Наложение» / «Умножение» / «Экран»).
   bg — статичные текстуры на весь кадр (JPG), ov — живые текстуры-циклы (зерно, пыль, плёнка — на чёрном для «Экрана»). */
(function (G) {
  const { L, E, rnd, TAU } = G.KKL;
  const P = (id, name, draw) => ({ id, name, draw });
  const A = (id, name, draw, dur = 3) => ({ id, name, draw, dur });
  const fill = (c, W, H, col) => { c.fillStyle = col; c.fillRect(0, 0, W, H); };
  const noise = (c, W, H, col, a, size, seed, n) => L.noise(c, W, H, 0, { color: col, alpha: a, size, seed, n: n || Math.round(W * H / 500) });
  // мягкие пятна-неровности (бумага, бетон, штукатурка)
  // облачная неровность: мелкий шум, растянутый со сглаживанием, в трёх масштабах (бумага, бетон, штукатурка)
  const blotch = (c, W, H, col, n, seed, rmin = .05, rmax = .25) => { const R = rnd(seed), m = col.match(/rgba?\(([^)]+)\)/)[1].split(',').map(Number), a = m[3] ?? 1;
    [rmax, (rmin + rmax) / 2, rmin].forEach((sc, o) => { const step = Math.max(4, Math.round(Math.max(W, H) * sc / 3)), w = Math.ceil(W / step) + 2, h = Math.ceil(H / step) + 2, t = document.createElement('canvas'); t.width = w; t.height = h;
      const x = t.getContext('2d'), d = x.createImageData(w, h); for (let i = 0; i < w * h; i++) { d.data[i * 4] = m[0]; d.data[i * 4 + 1] = m[1]; d.data[i * 4 + 2] = m[2]; d.data[i * 4 + 3] = Math.pow(R(), 2) * 255 * a * 2.2 / (o + 1); } x.putImageData(d, 0, 0);
      c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(t, -step, -step, w * step, h * step); c.restore(); }); };
  // складки/заломы бумаги: светлая и тёмная линия рядом
  const folds = (c, W, H, n, seed) => { const R = rnd(seed); for (let i = 0; i < n; i++) { const x0 = R() * W, y0 = R() * H, a = R() * TAU, len = Math.max(W, H) * (.3 + R() * .6), x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
    c.lineWidth = 2 + R() * 3; c.strokeStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.strokeStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.moveTo(x0 + 3, y0 + 3); c.lineTo(x1 + 3, y1 + 3); c.stroke(); } };
  const fibers = (c, W, H, col, n, seed) => { const R = rnd(seed); c.strokeStyle = col; for (let i = 0; i < n; i++) { const x = R() * W, y = R() * H, a = R() * TAU, l = 6 + R() * 30; c.lineWidth = .6 + R(); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); } };
  const weave = (c, W, H, a, b, step, seed) => { const R = rnd(seed); for (let y = 0; y < H; y += step) { c.fillStyle = a; c.globalAlpha = .25 + R() * .2; c.fillRect(0, y, W, step / 2); } for (let x = 0; x < W; x += step) { c.fillStyle = b; c.globalAlpha = .2 + R() * .2; c.fillRect(x, 0, step / 2, H); } c.globalAlpha = 1; };

  const ST = G.KKSTYLES;
  ST.tex = { name: 'Текстуры (для любого стиля)', key: '#00B140', S: { c1: '#ffffff', c2: '#888888', c3: '#000000', ink: '#111111', font: 'Montserrat-ExtraBold', fontBody: 'Inter-Medium', lw: 10, rough: 0, glow: 0 },
    png: [], an: [], tr: [], tx: [],
    bg: [
      P('paper', 'Белая бумага', (c, W, H) => { fill(c, W, H, '#f6f3ec'); blotch(c, W, H, 'rgba(200,185,150,.18)', 10, 1); fibers(c, W, H, 'rgba(120,100,70,.12)', 900, 2); noise(c, W, H, '#6b5a3a', .14, 1.6, 3); }),
      P('crumpled', 'Мятая бумага', (c, W, H) => { fill(c, W, H, '#efeae0'); blotch(c, W, H, 'rgba(255,255,255,.5)', 14, 4, .03, .12); blotch(c, W, H, 'rgba(120,110,90,.18)', 14, 5, .03, .12); folds(c, W, H, 40, 6); noise(c, W, H, '#5a4a30', .12, 1.6, 7); }),
      P('kraft', 'Крафт', (c, W, H) => { fill(c, W, H, '#c9a477'); blotch(c, W, H, 'rgba(90,60,30,.18)', 12, 8); fibers(c, W, H, 'rgba(70,45,20,.25)', 2200, 9); noise(c, W, H, '#3d2a14', .2, 2, 10); }),
      P('cardboard', 'Картон', (c, W, H) => { fill(c, W, H, '#b8875a'); for (let x = 0; x < W; x += 22) { const g = c.createLinearGradient(x, 0, x + 22, 0); g.addColorStop(0, 'rgba(0,0,0,.14)'); g.addColorStop(.5, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(0,0,0,.14)'); c.fillStyle = g; c.fillRect(x, 0, 22, H); } fibers(c, W, H, 'rgba(60,40,20,.2)', 1500, 11); noise(c, W, H, '#2a1a0a', .2, 2, 12); }),
      P('newspaper', 'Газета', (c, W, H) => { fill(c, W, H, '#e9e4d8'); const R = rnd(13), cols = W > H ? 6 : 3, m = W * .05, cw = (W - m * 2) / cols; c.fillStyle = 'rgba(40,40,40,.35)';
        for (let k = 0; k < cols; k++) for (let y = m; y < H - m; y += 26) { if (R() > .93) { y += 40; continue; } c.fillRect(m + k * cw + 10, y, (cw - 30) * (R() > .85 ? .5 + R() * .4 : 1), 9); } noise(c, W, H, '#3a3020', .18, 1.8, 14); }),
      P('notebook', 'Тетрадь в линейку', (c, W, H) => { fill(c, W, H, '#fbfaf5'); c.strokeStyle = 'rgba(80,140,200,.35)'; c.lineWidth = 2; for (let y = 140; y < H; y += 58) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); } c.strokeStyle = 'rgba(220,80,80,.45)'; c.beginPath(); c.moveTo(W * .12, 0); c.lineTo(W * .12, H); c.stroke(); noise(c, W, H, '#555', .08, 1.5, 15); }),
      P('grid', 'Тетрадь в клетку', (c, W, H, S) => { fill(c, W, H, '#fbfaf5'); L.grid(c, W, H, S, { color: 'rgba(80,140,200,.35)', step: 52, lw: 1.5 }); noise(c, W, H, '#555', .08, 1.5, 16); }),
      P('concrete', 'Бетон', (c, W, H) => { fill(c, W, H, '#9a9a96'); blotch(c, W, H, 'rgba(60,60,60,.25)', 22, 17, .03, .15); blotch(c, W, H, 'rgba(200,200,195,.25)', 18, 18, .03, .12); noise(c, W, H, '#222', .35, 2.5, 19); noise(c, W, H, '#fff', .2, 2, 20); }),
      P('plaster', 'Штукатурка', (c, W, H) => { fill(c, W, H, '#e8e2d6'); blotch(c, W, H, 'rgba(170,150,120,.22)', 26, 21, .02, .1); blotch(c, W, H, 'rgba(255,255,255,.4)', 20, 22, .02, .08); noise(c, W, H, '#7a6a50', .22, 2.2, 23); }),
      P('marble', 'Мрамор', (c, W, H) => { fill(c, W, H, '#f2f0ec'); const R = rnd(24); for (let i = 0; i < 18; i++) { c.strokeStyle = `rgba(110,110,115,${.08 + R() * .2})`; c.lineWidth = .8 + R() * 3.5; c.beginPath(); let x = R() * W, y = -20; c.moveTo(x, y); while (y < H + 20) { x += (R() - .5) * 90; y += 30 + R() * 40; c.lineTo(x, y); } c.stroke(); } noise(c, W, H, '#888', .08, 1.5, 25); }),
      P('linen', 'Лён', (c, W, H) => { fill(c, W, H, '#ddd3c2'); weave(c, W, H, '#b5a78f', '#f4ece0', 6, 26); fibers(c, W, H, 'rgba(90,70,50,.15)', 1200, 27); noise(c, W, H, '#5a4a30', .12, 1.5, 28); }),
      P('denim', 'Джинса', (c, W, H) => { fill(c, W, H, '#2f4a73'); c.save(); c.translate(W / 2, H / 2); c.rotate(-.6); c.translate(-W, -H); weave(c, W * 2, H * 2, '#1d3150', '#7f9ac0', 7, 29); c.restore(); noise(c, W, H, '#dfe8f5', .2, 1.8, 30); }),
      P('velvet', 'Бархат', (c, W, H) => { L.gradient(c, W, H, ['#5a1230', '#2a0716'], { radial: 1, cx: .35, cy: .3 }); blotch(c, W, H, 'rgba(255,120,170,.12)', 8, 31, .1, .35); noise(c, W, H, '#000', .25, 1.4, 32); }),
      P('halftone', 'Растр (точки)', (c, W, H) => { fill(c, W, H, '#ffffff'); c.fillStyle = '#111'; const s = 22; for (let y = 0; y < H + s; y += s) for (let x = 0; x < W + s; x += s) { const k = .5 + .5 * Math.sin(x / W * 3 + y / H * 2); c.beginPath(); c.arc(x + ((y / s) % 2) * s / 2, y, s * .45 * k, 0, TAU); c.fill(); } }),
      P('riso', 'Ризограф (зерно)', (c, W, H) => { fill(c, W, H, '#f4efe4'); blotch(c, W, H, 'rgba(232,70,124,.35)', 0, 38, .02, .12); noise(c, W, H, '#e8467c', .8, 2.6, 33, W * H / 25); noise(c, W, H, '#2e6bd6', .7, 2.6, 34, W * H / 35); noise(c, W, H, '#222', .2, 1.6, 35); }),
      P('splatter', 'Брызги краски', (c, W, H) => { fill(c, W, H, '#ffffff'); const R = rnd(36); c.fillStyle = '#111'; for (let i = 0; i < 26; i++) { const x = R() * W, y = R() * H, r = 6 + R() * 50; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); for (let j = 0; j < 14; j++) { const a = R() * TAU, d = r * (1.2 + R() * 3); c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 1 + R() * r * .18, 0, TAU); c.fill(); } } noise(c, W, H, '#111', .25, 2, 37); })
    ],
    ov: [
      A('grain', 'Плёночное зерно', (c, W, H, S, t) => { L.noise(c, W, H, t, { color: '#fff', alpha: .9, size: 3.2, n: Math.round(W * H / 70) }); const R = rnd(Math.floor(t * 30) + 41); c.fillStyle = `rgba(255,244,226,${.03 + R() * .07})`; c.fillRect(0, 0, W, H); }),
      A('dust', 'Пыль и ворсинки', (c, W, H, S, t) => { const R = rnd(Math.floor(t * 12) + 40); c.fillStyle = '#fff'; c.strokeStyle = '#fff'; for (let i = 0; i < 40; i++) { c.globalAlpha = .4 + R() * .6; const x = R() * W, y = R() * H; if (R() > .7) { c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + (R() - .5) * 60, y + (R() - .5) * 60, x + (R() - .5) * 80, y + (R() - .5) * 80); c.stroke(); } else { c.beginPath(); c.arc(x, y, .8 + R() * 3, 0, TAU); c.fill(); } } c.globalAlpha = 1; }),
      A('scratch', 'Царапины плёнки', (c, W, H, S, t) => { const R = rnd(Math.floor(t * 24) + 60); c.strokeStyle = '#fff'; for (let i = 0; i < 5; i++) { if (R() > .6) continue; c.globalAlpha = .3 + R() * .6; c.lineWidth = .8 + R() * 2.2; const x = R() * W; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (R() - .5) * 30, H); c.stroke(); } c.globalAlpha = 1; L.noise(c, W, H, t, { color: '#fff', alpha: .25, size: 1.6, n: Math.round(W * H / 2000) }); }),
      A('vhs', 'VHS-помехи', (c, W, H, S, t) => { L.scan(c, W, H, t, { color: '#fff', alpha: .12, step: 6, band: '#fff', speed: .5 }); const R = rnd(Math.floor(t * 15) + 80); for (let i = 0; i < 6; i++) { if (R() > .5) continue; c.globalAlpha = .25 + R() * .4; c.fillStyle = ['#ff3b6b', '#3bd5ff', '#ffffff'][i % 3]; c.fillRect(0, R() * H, W, 2 + R() * 8); } c.globalAlpha = 1; L.noise(c, W, H, t, { color: '#fff', alpha: .3, size: 1.8, n: Math.round(W * H / 900) }); }),
      A('glitter', 'Блёстки', (c, W, H, S, t) => L.particles(c, W, H, S, t, { shape: 'spark', n: 60, size: .012, colors: ['#ffffff', '#ffe9a8', '#ffd1ea'], twinkle: 1, dir: 'up', loop: 3, seed: 91 })),
      A('burn', 'Прожиг плёнки', (c, W, H, S, t) => { const k = Math.sin(t / 3 * Math.PI); c.globalCompositeOperation = 'lighter'; [['rgba(255,90,20,.9)', 0], ['rgba(255,200,80,.8)', 1.7], ['rgba(255,40,60,.6)', 3.4]].forEach(([col, ph]) => { const x = W * (.1 + .8 * (.5 + .5 * Math.sin(t * .9 + ph))), y = H * (.15 + .7 * (.5 + .5 * Math.cos(t * .7 + ph))), r = Math.max(W, H) * (.25 + .25 * k), g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }); c.globalCompositeOperation = 'source-over'; })
    ]
  };
})(window);

/* ---- styles4.js ---- */
/* Расширение наборов до полного состава: в каждом стиле 100 PNG, 50 анимаций, 10 переходов, 10 оверлеев, 10 фонов, 10 плашек.
   Новые элементы собираются из общей библиотеки иконок и форм, но рисуются «материалом» стиля:
   стикер с вырубкой, неон, хром, ретро-печать, дудл, тонкая линия люкса, бизнес-бейдж, гранж-трафарет, иконка приложения. */
(function (G) {
  const { L, E, rnd, rrect, TAU } = G.KKL;
  const ST = G.KKSTYLES;
  const P = (id, name, draw, size) => Object.assign({ id, name, draw }, size ? { size } : {});
  const A = (id, name, draw, dur = 2) => ({ id, name, draw, dur });
  const cv = (W, H) => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  const mix = (h1, h2, k) => { const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16), f = s => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
    return '#' + ((1 << 24) + (f(16) << 16) + (f(8) << 8) + f(0)).toString(16).slice(1); };

  /* ---------- геометрия в коробке 100×100 (центр 0,0) ---------- */
  const g = {
    cir: (c, x, y, r) => { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); },
    ell: (c, x, y, rx, ry, a = 0) => { c.moveTo(x + rx * Math.cos(a), y + rx * Math.sin(a)); c.ellipse(x, y, rx, ry, a, 0, TAU); },
    rr: (c, x, y, w, h, r) => { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); },
    poly: (c, pts) => { pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); },
    line: (c, pts) => pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])),
    star: (c, x, y, r, n = 5, k = .45, rot = -Math.PI / 2) => { for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, q = i % 2 ? r * k : r; i ? c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) : c.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); },
    heart: (c, x, y, s) => { for (let i = 0; i <= 60; i++) { const a = i / 60 * TAU, hx = 16 * Math.pow(Math.sin(a), 3), hy = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); i ? c.lineTo(x + hx / 17 * s, y - hy / 17 * s) : c.moveTo(x + hx / 17 * s, y - hy / 17 * s); } c.closePath(); }
  };

  /* ---------- иконки: sh(роль, путь). Роли: a b c — цвета стиля, l — светлая деталь, d — тёмная деталь, w — блик,
     sa sb sc sd sl — линии (обводка толще, без заливки) ---------- */
  const I = {
    camera: sh => { sh('a', c => g.rr(c, -44, -24, 88, 58, 12)); sh('a', c => g.rr(c, -22, -36, 28, 16, 5)); sh('l', c => g.cir(c, 4, 5, 22)); sh('d', c => g.cir(c, 4, 5, 13)); sh('w', c => g.ell(c, -1, 0, 5, 3, -.6)); sh('b', c => g.rr(c, 26, -16, 10, 7, 2)); },
    play: sh => { sh('a', c => g.rr(c, -46, -32, 92, 64, 20)); sh('l', c => g.poly(c, [[-11, -17], [19, 0], [-11, 17]])); },
    phone: sh => { sh('a', c => g.rr(c, -25, -46, 50, 92, 11)); sh('l', c => g.rr(c, -19, -36, 38, 64, 4)); sh('d', c => g.cir(c, 0, 37, 3.5)); sh('b', c => g.rr(c, -13, -24, 26, 6, 3)); sh('c', c => g.rr(c, -13, -12, 18, 6, 3)); },
    mic: sh => { sh('sd', c => { c.moveTo(-24, -2); c.arc(0, -2, 24, Math.PI, 0, true); c.moveTo(0, 22); c.lineTo(0, 38); c.moveTo(-16, 40); c.lineTo(16, 40); }); sh('a', c => g.rr(c, -15, -46, 30, 52, 15)); sh('b', c => g.rr(c, -15, -22, 30, 7, 2)); sh('w', c => g.rr(c, -9, -40, 5, 14, 2.5)); },
    clapper: sh => { sh('a', c => g.rr(c, -42, -8, 84, 52, 5)); sh('b', c => g.poly(c, [[-44, -12], [40, -34], [44, -20], [-40, 2]])); sh('d', c => { g.poly(c, [[-30, -15], [-18, -18], [-24, -1], [-36, 2]]); g.poly(c, [[-6, -21], [6, -24], [0, -7], [-12, -4]]); g.poly(c, [[18, -27], [30, -30], [24, -13], [12, -10]]); }); sh('l', c => g.rr(c, -32, 8, 64, 6, 3)); sh('l', c => g.rr(c, -32, 22, 40, 6, 3)); },
    lightning: sh => { sh('a', c => g.poly(c, [[10, -48], [-28, 6], [-3, 6], [-12, 48], [28, -8], [3, -8], [16, -48]])); sh('w', c => g.poly(c, [[8, -40], [-10, -6], [-4, -6], [12, -40]])); },
    fire: sh => { sh('a', c => { c.moveTo(0, 46); c.bezierCurveTo(-40, 46, -42, 8, -22, -14); c.bezierCurveTo(-18, 0, -10, 4, -8, -2); c.bezierCurveTo(-12, -24, 0, -40, 8, -48); c.bezierCurveTo(8, -26, 38, -16, 36, 14); c.bezierCurveTo(36, 34, 22, 46, 0, 46); }); sh('b', c => { c.moveTo(0, 44); c.bezierCurveTo(-20, 44, -22, 20, -8, 8); c.bezierCurveTo(-6, 18, 2, 18, 4, 10); c.bezierCurveTo(16, 18, 20, 30, 16, 36); c.bezierCurveTo(12, 42, 6, 44, 0, 44); }); },
    crown: sh => { sh('a', c => g.poly(c, [[-42, 30], [-46, -22], [-22, 2], [0, -34], [22, 2], [46, -22], [42, 30]])); sh('b', c => g.rr(c, -42, 26, 84, 12, 4)); sh('c', c => { g.cir(c, 0, -34, 6); g.cir(c, -46, -22, 5); g.cir(c, 46, -22, 5); }); sh('l', c => { g.cir(c, -20, 16, 4); g.cir(c, 0, 14, 5); g.cir(c, 20, 16, 4); }); },
    diamond: sh => { sh('a', c => g.poly(c, [[-26, -32], [26, -32], [46, -10], [0, 44], [-46, -10]])); sh('l', c => g.poly(c, [[-26, -32], [-10, -10], [-46, -10]])); sh('b', c => g.poly(c, [[-10, -10], [10, -10], [0, 44]])); sh('sd', c => g.line(c, [[-46, -10], [46, -10]])); sh('w', c => g.poly(c, [[-4, -28], [14, -28], [6, -16]])); },
    eye: sh => { sh('l', c => { c.moveTo(-46, 0); c.quadraticCurveTo(0, -42, 46, 0); c.quadraticCurveTo(0, 42, -46, 0); }); sh('a', c => g.cir(c, 0, 0, 19)); sh('d', c => g.cir(c, 0, 0, 9)); sh('w', c => g.cir(c, -6, -6, 4)); },
    bulb: sh => { sh('a', c => { c.moveTo(-16, 18); c.bezierCurveTo(-46, -4, -30, -46, 0, -46); c.bezierCurveTo(30, -46, 46, -4, 16, 18); c.closePath(); }); sh('b', c => g.rr(c, -16, 18, 32, 20, 5)); sh('d', c => g.rr(c, -9, 38, 18, 7, 3)); sh('w', c => g.ell(c, -14, -24, 6, 10, .5)); sh('sl', c => { c.moveTo(-8, 10); c.lineTo(-4, -8); c.lineTo(4, -8); c.lineTo(8, 10); }); },
    rocket: sh => { sh('c', c => { c.moveTo(-10, 30); c.quadraticCurveTo(0, 56, 10, 30); }); sh('b', c => { g.poly(c, [[-14, 6], [-32, 30], [-12, 26]]); g.poly(c, [[14, 6], [32, 30], [12, 26]]); }); sh('a', c => { c.moveTo(0, -48); c.bezierCurveTo(26, -28, 22, 10, 14, 30); c.lineTo(-14, 30); c.bezierCurveTo(-22, 10, -26, -28, 0, -48); }); sh('l', c => g.cir(c, 0, -10, 9)); sh('d', c => g.cir(c, 0, -10, 4)); },
    gift: sh => { sh('a', c => g.rr(c, -36, -4, 72, 46, 4)); sh('a', c => g.rr(c, -42, -20, 84, 18, 4)); sh('b', c => { g.rr(c, -7, -20, 14, 62, 1); c.moveTo(0, -20); c.bezierCurveTo(-30, -48, -36, -18, 0, -20); c.moveTo(0, -20); c.bezierCurveTo(30, -48, 36, -18, 0, -20); }); },
    cup: sh => { sh('sd', c => { c.moveTo(26, -6); c.bezierCurveTo(46, -6, 46, 22, 24, 22); }); sh('a', c => { c.moveTo(-32, -16); c.lineTo(30, -16); c.lineTo(24, 36); c.quadraticCurveTo(0, 44, -26, 36); c.closePath(); }); sh('b', c => g.rr(c, -30, -2, 58, 12, 2)); sh('sc', c => { c.moveTo(-12, -24); c.bezierCurveTo(-20, -34, -4, -38, -12, -48); c.moveTo(6, -24); c.bezierCurveTo(-2, -34, 14, -38, 6, -48); }); },
    pin: sh => { sh('a', c => { c.moveTo(0, 48); c.bezierCurveTo(-10, 28, -36, 8, -36, -14); c.arc(0, -14, 36, Math.PI, 0); c.bezierCurveTo(36, 8, 10, 28, 0, 48); }); sh('l', c => g.cir(c, 0, -14, 14)); },
    note: sh => { sh('a', c => { g.ell(c, -24, 30, 14, 10, -.3); g.ell(c, 22, 22, 14, 10, -.3); g.rr(c, -14, -36, 7, 64, 2); g.rr(c, 32, -44, 7, 64, 2); g.poly(c, [[-14, -36], [39, -48], [39, -32], [-14, -20]]); }); },
    magnifier: sh => { sh('a', c => g.poly(c, [[10, 18], [18, 10], [46, 38], [38, 46]])); sh('a', c => g.cir(c, -8, -8, 32)); sh('l', c => g.cir(c, -8, -8, 22)); sh('w', c => g.ell(c, -16, -18, 6, 4, -.7)); },
    megaphone: sh => { sh('b', c => g.rr(c, -36, 8, 14, 26, 4)); sh('a', c => g.poly(c, [[-40, -14], [20, -40], [20, 36], [-40, 12]])); sh('c', c => g.rr(c, 18, -42, 10, 80, 5)); sh('sd', c => { c.moveTo(36, -18); c.quadraticCurveTo(44, -2, 36, 14); c.moveTo(42, -30); c.quadraticCurveTo(56, -2, 42, 26); }); },
    calendar: sh => { sh('l', c => g.rr(c, -40, -32, 80, 76, 10)); sh('a', c => g.rr(c, -40, -32, 80, 24, 10)); sh('d', c => { g.rr(c, -24, -44, 8, 22, 4); g.rr(c, 16, -44, 8, 22, 4); }); sh('b', c => { for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) g.rr(c, -30 + x * 16, 2 + y * 12, 10, 8, 2); }); },
    clock: sh => { sh('a', c => g.cir(c, 0, 0, 46)); sh('l', c => g.cir(c, 0, 0, 36)); sh('sd', c => g.line(c, [[0, -24], [0, 0], [16, 10]])); sh('b', c => g.cir(c, 0, 0, 5)); },
    chat: sh => { sh('a', c => { g.rr(c, -46, -34, 92, 60, 18); c.moveTo(-24, 22); c.lineTo(-34, 44); c.lineTo(-6, 24); }); sh('l', c => { g.cir(c, -20, -4, 6); g.cir(c, 0, -4, 6); g.cir(c, 20, -4, 6); }); },
    thumb: sh => { sh('b', c => g.rr(c, -44, -6, 20, 48, 5)); sh('a', c => { c.moveTo(-20, -4); c.lineTo(-6, -10); c.lineTo(2, -40); c.quadraticCurveTo(16, -42, 14, -24); c.lineTo(10, -8); c.lineTo(36, -8); c.quadraticCurveTo(46, -8, 42, 6); c.lineTo(34, 36); c.quadraticCurveTo(32, 42, 24, 42); c.lineTo(-20, 42); c.closePath(); }); sh('sd', c => { c.moveTo(10, 6); c.lineTo(38, 6); c.moveTo(10, 20); c.lineTo(36, 20); }); },
    bell: sh => { sh('b', c => g.cir(c, 0, 36, 9)); sh('a', c => { c.moveTo(-40, 30); c.quadraticCurveTo(-28, 20, -28, -4); c.bezierCurveTo(-28, -36, 28, -36, 28, -4); c.quadraticCurveTo(28, 20, 40, 30); c.closePath(); }); sh('a', c => g.cir(c, 0, -38, 6)); sh('w', c => g.ell(c, -14, -12, 4, 10, .3)); },
    lock: sh => { sh('sd', c => { c.moveTo(-20, -6); c.lineTo(-20, -20); c.arc(0, -20, 20, Math.PI, 0); c.lineTo(20, -6); }); sh('a', c => g.rr(c, -34, -8, 68, 52, 9)); sh('d', c => { g.cir(c, 0, 12, 7); g.rr(c, -3, 14, 6, 14, 3); }); },
    cloud: sh => { sh('a', c => { c.moveTo(-30, 30); c.arc(-30, 10, 20, Math.PI / 2, Math.PI * 1.5); c.arc(-4, -8, 26, Math.PI * 1.08, Math.PI * 1.92); c.arc(26, 6, 22, Math.PI * 1.35, Math.PI * .5); c.closePath(); }); sh('w', c => g.ell(c, -10, -16, 10, 5, -.3)); },
    sun: sh => { sh('b', c => { for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; c.moveTo(Math.cos(a - .14) * 30, Math.sin(a - .14) * 30); c.lineTo(Math.cos(a) * 48, Math.sin(a) * 48); c.lineTo(Math.cos(a + .14) * 30, Math.sin(a + .14) * 30); c.closePath(); } }); sh('a', c => g.cir(c, 0, 0, 28)); sh('w', c => g.ell(c, -10, -10, 7, 4, -.7)); },
    moon: sh => { sh('a', c => { c.arc(0, 0, 44, Math.PI * .35, Math.PI * 1.65); c.arc(18, -8, 34, Math.PI * 1.45, Math.PI * .6, true); c.closePath(); }); sh('b', c => { g.star(c, 30, -30, 9, 4, .3); g.star(c, 34, 22, 6, 4, .3); }); },
    planet: sh => { sh('a', c => g.cir(c, 0, 0, 30)); sh('sb', c => g.ell(c, 0, 0, 50, 14, -.35)); sh('c', c => { c.moveTo(-28, 10); c.arc(0, 0, 30, Math.PI * .85, Math.PI * .15, true); c.lineTo(28, 10); c.bezierCurveTo(10, 4, -10, 16, -28, 10); }); sh('w', c => g.ell(c, -12, -14, 8, 4, -.6)); },
    flower: sh => { sh('a', c => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - Math.PI / 2; g.ell(c, Math.cos(a) * 24, Math.sin(a) * 24, 20, 14, a); } }); sh('b', c => g.cir(c, 0, 0, 15)); sh('d', c => { g.cir(c, -5, -3, 2.4); g.cir(c, 5, -3, 2.4); }); sh('sd', c => { c.moveTo(-6, 4); c.quadraticCurveTo(0, 9, 6, 4); }); },
    leaf: sh => { sh('a', c => { c.moveTo(-38, 40); c.bezierCurveTo(-46, -10, -6, -44, 44, -44); c.bezierCurveTo(44, 6, 10, 46, -38, 40); }); sh('sl', c => { c.moveTo(-38, 40); c.quadraticCurveTo(4, 4, 30, -30); c.moveTo(-4, 10); c.lineTo(-4, -14); c.moveTo(12, -6); c.lineTo(12, -26); c.moveTo(-6, 10); c.lineTo(18, 12); }); },
    star: sh => { sh('a', c => g.star(c, 0, 4, 48, 5, .46)); sh('w', c => g.ell(c, -10, -8, 7, 4, -.8)); },
    heart: sh => { sh('a', c => g.heart(c, 0, 0, 46)); sh('w', c => g.ell(c, -18, -18, 8, 5, -.8)); },
    sparkles: sh => { sh('a', c => g.star(c, -8, 6, 36, 4, .22)); sh('b', c => g.star(c, 30, -28, 16, 4, .24)); sh('c', c => g.star(c, 32, 30, 11, 4, .26)); },
    smile: sh => { sh('a', c => g.cir(c, 0, 0, 46)); sh('d', c => { g.ell(c, -15, -10, 5, 8); g.ell(c, 15, -10, 5, 8); }); sh('sd', c => { c.moveTo(-24, 8); c.quadraticCurveTo(0, 34, 24, 8); }); sh('b', c => { g.ell(c, -28, 10, 7, 4); g.ell(c, 28, 10, 7, 4); }); },
    wow: sh => { sh('a', c => g.cir(c, 0, 0, 46)); sh('l', c => { g.cir(c, -16, -10, 11); g.cir(c, 16, -10, 11); }); sh('d', c => { g.cir(c, -15, -9, 5); g.cir(c, 17, -9, 5); g.ell(c, 0, 20, 9, 12); }); },
    ghost: sh => { sh('l', c => { c.moveTo(-34, 44); c.lineTo(-34, -6); c.bezierCurveTo(-34, -52, 34, -52, 34, -6); c.lineTo(34, 44); c.lineTo(22, 34); c.lineTo(11, 44); c.lineTo(0, 34); c.lineTo(-11, 44); c.lineTo(-22, 34); c.closePath(); }); sh('d', c => { g.ell(c, -12, -8, 6, 9); g.ell(c, 12, -8, 6, 9); }); sh('a', c => { g.ell(c, -22, 8, 6, 3.5); g.ell(c, 22, 8, 6, 3.5); }); },
    cat: sh => { sh('a', c => { g.poly(c, [[-38, -10], [-34, -46], [-10, -26]]); g.poly(c, [[38, -10], [34, -46], [10, -26]]); g.ell(c, 0, 6, 42, 36); }); sh('d', c => { g.ell(c, -15, 2, 5, 7); g.ell(c, 15, 2, 5, 7); }); sh('b', c => g.poly(c, [[-5, 14], [5, 14], [0, 20]])); sh('sd', c => { c.moveTo(-26, 18); c.lineTo(-46, 14); c.moveTo(-26, 24); c.lineTo(-46, 26); c.moveTo(26, 18); c.lineTo(46, 14); c.moveTo(26, 24); c.lineTo(46, 26); }); },
    cherry: sh => { sh('sd', c => { c.moveTo(-18, 18); c.quadraticCurveTo(-10, -20, 10, -40); c.moveTo(18, 22); c.quadraticCurveTo(14, -10, 10, -40); }); sh('b', c => { c.moveTo(10, -40); c.bezierCurveTo(24, -50, 40, -44, 42, -32); c.bezierCurveTo(28, -26, 16, -30, 10, -40); }); sh('a', c => { g.cir(c, -20, 26, 18); g.cir(c, 20, 30, 18); }); sh('w', c => { g.ell(c, -26, 20, 5, 3, -.6); g.ell(c, 14, 24, 5, 3, -.6); }); },
    film: sh => { sh('a', c => g.cir(c, 0, 0, 46)); sh('l', c => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - Math.PI / 2; g.cir(c, Math.cos(a) * 25, Math.sin(a) * 25, 10); } }); sh('d', c => g.cir(c, 0, 0, 6)); },
    laptop: sh => { sh('a', c => g.rr(c, -38, -36, 76, 54, 6)); sh('l', c => g.rr(c, -31, -29, 62, 40, 3)); sh('b', c => g.poly(c, [[-48, 22], [48, 22], [42, 34], [-42, 34]])); sh('c', c => { g.rr(c, -24, -20, 30, 6, 3); g.rr(c, -24, -8, 44, 6, 3); }); },
    headphones: sh => { sh('sa', c => { c.moveTo(-36, 14); c.lineTo(-36, -2); c.arc(0, -2, 36, Math.PI, 0); c.lineTo(36, 14); }); sh('b', c => { g.rr(c, -46, 4, 22, 38, 9); g.rr(c, 24, 4, 22, 38, 9); }); },
    gamepad: sh => { sh('a', c => { c.moveTo(-30, -24); c.lineTo(30, -24); c.bezierCurveTo(52, -24, 54, 30, 40, 34); c.bezierCurveTo(28, 38, 22, 14, 0, 14); c.bezierCurveTo(-22, 14, -28, 38, -40, 34); c.bezierCurveTo(-54, 30, -52, -24, -30, -24); }); sh('d', c => { g.rr(c, -34, -8, 20, 6, 2); g.rr(c, -27, -15, 6, 20, 2); }); sh('b', c => { g.cir(c, 22, -10, 5); g.cir(c, 32, -1, 5); }); },
    battery: sh => { sh('l', c => g.rr(c, -44, -22, 80, 44, 9)); sh('a', c => g.rr(c, 36, -9, 9, 18, 3)); sh('b', c => g.rr(c, -37, -15, 52, 30, 5)); sh('d', c => g.poly(c, [[-6, -12], [-16, 2], [-8, 2], [-12, 13], [2, -2], [-6, -2], [-2, -12]])); },
    wifi: sh => { sh('sa', c => { c.moveTo(-42, -10); c.quadraticCurveTo(0, -46, 42, -10); }); sh('sb', c => { c.moveTo(-28, 4); c.quadraticCurveTo(0, -20, 28, 4); }); sh('sc', c => { c.moveTo(-14, 18); c.quadraticCurveTo(0, 6, 14, 18); }); sh('a', c => g.cir(c, 0, 34, 7)); },
    folder: sh => { sh('a', c => { c.moveTo(-44, -30); c.lineTo(-14, -30); c.lineTo(-6, -20); c.lineTo(44, -20); c.lineTo(44, 36); c.lineTo(-44, 36); c.closePath(); }); sh('b', c => g.rr(c, -44, -8, 88, 44, 4)); },
    mail: sh => { sh('l', c => g.rr(c, -46, -30, 92, 62, 8)); sh('a', c => { c.moveTo(-46, -24); c.lineTo(0, 6); c.lineTo(46, -24); c.lineTo(46, -22); c.lineTo(0, 12); c.lineTo(-46, -22); c.closePath(); }); sh('b', c => g.cir(c, 34, -30, 12)); },
    coin: (sh, t) => { sh('a', c => g.cir(c, 0, 0, 46)); sh('b', c => g.cir(c, 0, 0, 34)); t('₽', 0, 3, 46, 'd'); },
    trophy: sh => { sh('sa', c => { c.moveTo(-26, -30); c.bezierCurveTo(-52, -30, -46, 6, -18, 4); c.moveTo(26, -30); c.bezierCurveTo(52, -30, 46, 6, 18, 4); }); sh('a', c => { c.moveTo(-30, -40); c.lineTo(30, -40); c.bezierCurveTo(30, 0, 14, 14, 0, 14); c.bezierCurveTo(-14, 14, -30, 0, -30, -40); }); sh('a', c => g.rr(c, -6, 12, 12, 16, 2)); sh('b', c => g.rr(c, -26, 28, 52, 16, 4)); sh('w', c => g.ell(c, -14, -24, 4, 10, .2)); },
    flag: sh => { sh('sd', c => { c.moveTo(-34, -44); c.lineTo(-34, 46); }); sh('a', c => { c.moveTo(-34, -40); c.bezierCurveTo(-10, -52, 10, -26, 40, -38); c.lineTo(40, 4); c.bezierCurveTo(10, 16, -10, -10, -34, 2); c.closePath(); }); },
    target: sh => { sh('a', c => g.cir(c, 0, 0, 46)); sh('l', c => g.cir(c, 0, 0, 34)); sh('a', c => g.cir(c, 0, 0, 22)); sh('l', c => g.cir(c, 0, 0, 11)); sh('sd', c => g.line(c, [[0, 0], [38, -38]])); sh('b', c => g.poly(c, [[34, -46], [46, -34], [52, -48], [40, -44]])); },
    puzzle: sh => { sh('a', c => { c.moveTo(-36, -36); c.lineTo(-8, -36); c.arc(0, -36, 9, Math.PI, 0); c.lineTo(36, -36); c.lineTo(36, -8); c.arc(36, 0, 9, -Math.PI / 2, Math.PI / 2); c.lineTo(36, 36); c.lineTo(-36, 36); c.lineTo(-36, 8); c.arc(-36, 0, 9, Math.PI / 2, -Math.PI / 2, true); c.closePath(); }); },
    shades: sh => { sh('sd', c => { c.moveTo(-46, -12); c.lineTo(46, -12); }); sh('d', c => { c.moveTo(-44, -14); c.lineTo(-6, -14); c.quadraticCurveTo(-6, 22, -24, 22); c.quadraticCurveTo(-44, 22, -44, -14); c.moveTo(44, -14); c.lineTo(6, -14); c.quadraticCurveTo(6, 22, 24, 22); c.quadraticCurveTo(44, 22, 44, -14); }); sh('w', c => { g.poly(c, [[-36, -8], [-26, -8], [-34, 6]]); g.poly(c, [[14, -8], [24, -8], [16, 6]]); }); },
    skull: sh => { sh('l', c => { c.moveTo(-18, 44); c.lineTo(-18, 30); c.bezierCurveTo(-56, 20, -44, -46, 0, -46); c.bezierCurveTo(44, -46, 56, 20, 18, 30); c.lineTo(18, 44); c.closePath(); }); sh('d', c => { g.cir(c, -16, -4, 11); g.cir(c, 16, -4, 11); g.poly(c, [[0, 10], [-6, 20], [6, 20]]); }); sh('sd', c => { c.moveTo(-6, 32); c.lineTo(-6, 44); c.moveTo(6, 32); c.lineTo(6, 44); }); },
    bomb: sh => { sh('sd', c => { c.moveTo(16, -24); c.quadraticCurveTo(26, -44, 40, -38); }); sh('a', c => g.cir(c, -6, 10, 36)); sh('d', c => g.rr(c, 6, -32, 18, 14, 3)); sh('b', c => g.star(c, 42, -38, 12, 6, .4)); sh('w', c => g.ell(c, -20, -6, 9, 5, -.7)); },
    spray: sh => { sh('a', c => g.rr(c, -24, -22, 48, 70, 9)); sh('b', c => g.rr(c, -16, -40, 32, 20, 6)); sh('d', c => g.rr(c, -6, -48, 12, 10, 2)); sh('l', c => g.rr(c, -24, 0, 48, 20, 0)); sh('c', c => { g.cir(c, -28, -48, 3); g.cir(c, -38, -42, 4); g.cir(c, -36, -54, 2.5); g.cir(c, -46, -48, 3); }); },
    rainbow: sh => { sh('sa', c => { c.arc(0, 30, 42, Math.PI, 0); }); sh('sb', c => { c.arc(0, 30, 30, Math.PI, 0); }); sh('sc', c => { c.arc(0, 30, 18, Math.PI, 0); }); sh('l', c => { g.ell(c, -38, 34, 14, 9); g.ell(c, 38, 34, 14, 9); }); },
    butterfly: sh => { sh('a', c => { g.ell(c, -22, -14, 22, 26, -.4); g.ell(c, 22, -14, 22, 26, .4); }); sh('b', c => { g.ell(c, -18, 20, 14, 16, .4); g.ell(c, 18, 20, 14, 16, -.4); }); sh('d', c => g.rr(c, -4, -30, 8, 62, 4)); sh('sd', c => { c.moveTo(-2, -30); c.quadraticCurveTo(-8, -44, -16, -46); c.moveTo(2, -30); c.quadraticCurveTo(8, -44, 16, -46); }); },
    snowflake: sh => { sh('sa', c => { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, x = Math.cos(a), y = Math.sin(a); c.moveTo(0, 0); c.lineTo(x * 46, y * 46); const bx = x * 28, by = y * 28; c.moveTo(bx, by); c.lineTo(bx + Math.cos(a + .7) * 14, by + Math.sin(a + .7) * 14); c.moveTo(bx, by); c.lineTo(bx + Math.cos(a - .7) * 14, by + Math.sin(a - .7) * 14); } }); sh('b', c => g.cir(c, 0, 0, 7)); },
    tree: sh => { sh('b', c => g.rr(c, -8, 30, 16, 16, 2)); sh('a', c => { g.poly(c, [[0, -44], [-26, -6], [26, -6]]); g.poly(c, [[0, -24], [-36, 18], [36, 18]]); g.poly(c, [[0, -4], [-44, 34], [44, 34]]); }); sh('c', c => { g.cir(c, -12, 4, 4); g.cir(c, 14, 20, 4); g.cir(c, -20, 28, 4); g.cir(c, 8, -14, 3.5); }); sh('l', c => g.star(c, 0, -46, 9, 5, .45)); },
    mushroom: sh => { sh('l', c => { c.moveTo(-14, 6); c.quadraticCurveTo(-18, 40, -18, 44); c.lineTo(18, 44); c.quadraticCurveTo(18, 40, 14, 6); c.closePath(); }); sh('a', c => { c.moveTo(-46, 10); c.bezierCurveTo(-46, -50, 46, -50, 46, 10); c.closePath(); }); sh('l', c => { g.cir(c, -20, -12, 7); g.cir(c, 12, -22, 6); g.cir(c, 24, 0, 5); }); },
    drop: sh => { sh('a', c => { c.moveTo(0, -48); c.bezierCurveTo(10, -26, 36, -4, 36, 16); c.arc(0, 16, 36, 0, Math.PI); c.bezierCurveTo(-36, -4, -10, -26, 0, -48); }); sh('w', c => g.ell(c, -14, 14, 6, 11, .3)); },
    pot: sh => { sh('a', c => { g.ell(c, -18, -18, 12, 26, -.6); g.ell(c, 18, -18, 12, 26, .6); g.ell(c, 0, -26, 10, 22, 0); }); sh('b', c => g.poly(c, [[-30, 8], [30, 8], [24, 46], [-24, 46]])); sh('c', c => g.rr(c, -34, 4, 68, 12, 3)); },
    cassette: sh => { sh('a', c => g.rr(c, -46, -30, 92, 62, 7)); sh('l', c => g.rr(c, -36, -22, 72, 32, 4)); sh('d', c => { g.cir(c, -18, -6, 8); g.cir(c, 18, -6, 8); }); sh('b', c => g.poly(c, [[-26, 32], [-20, 16], [20, 16], [26, 32]])); },
    vinyl: sh => { sh('d', c => g.cir(c, 0, 0, 46)); sh('sl', c => { c.arc(0, 0, 36, -2.4, -1.4); c.moveTo(28, 6); c.arc(0, 0, 28, .2, 1.1); }); sh('a', c => g.cir(c, 0, 0, 15)); sh('l', c => g.cir(c, 0, 0, 3.5)); },
    tv: sh => { sh('sd', c => { c.moveTo(-16, -48); c.lineTo(0, -30); c.lineTo(18, -50); }); sh('a', c => g.rr(c, -46, -30, 92, 66, 12)); sh('l', c => g.rr(c, -38, -22, 60, 50, 9)); sh('b', c => { g.cir(c, 34, -12, 5); g.cir(c, 34, 6, 5); }); sh('w', c => g.ell(c, -24, -10, 6, 3, -.4)); },
    floppy: sh => { sh('a', c => { c.moveTo(-42, -44); c.lineTo(30, -44); c.lineTo(44, -30); c.lineTo(44, 44); c.lineTo(-42, 44); c.closePath(); }); sh('l', c => g.rr(c, -24, -44, 48, 28, 2)); sh('d', c => g.rr(c, 8, -40, 10, 20, 2)); sh('b', c => g.rr(c, -30, 6, 62, 32, 4)); },
    disc: sh => { sh('a', c => g.cir(c, 0, 0, 46)); sh('b', c => { c.moveTo(0, 0); c.arc(0, 0, 46, -1.2, -.4); c.closePath(); c.moveTo(0, 0); c.arc(0, 0, 46, 1.9, 2.7); c.closePath(); }); sh('l', c => g.cir(c, 0, 0, 13)); sh('d', c => g.cir(c, 0, 0, 5)); },
    popcorn: sh => { sh('l', c => { g.cir(c, -20, -24, 14); g.cir(c, 0, -32, 15); g.cir(c, 20, -24, 14); g.cir(c, -8, -14, 12); g.cir(c, 10, -14, 12); }); sh('a', c => g.poly(c, [[-34, -14], [34, -14], [24, 46], [-24, 46]])); sh('l', c => { g.poly(c, [[-18, -14], [-8, -14], [-6, 46], [-14, 46]]); g.poly(c, [[8, -14], [18, -14], [14, 46], [6, 46]]); }); },
    ticket: sh => { sh('a', c => { c.moveTo(-46, -26); c.lineTo(46, -26); c.lineTo(46, -8); c.arc(46, 0, 8, -Math.PI / 2, Math.PI / 2, true); c.lineTo(46, 26); c.lineTo(-46, 26); c.lineTo(-46, 8); c.arc(-46, 0, 8, Math.PI / 2, -Math.PI / 2, true); c.closePath(); }); sh('sl', c => { for (let y = -20; y < 22; y += 10) { c.moveTo(18, y); c.lineTo(18, y + 5); } }); sh('l', c => g.star(c, -12, 0, 12, 5, .45)); },
    briefcase: sh => { sh('sd', c => { c.moveTo(-14, -24); c.lineTo(-14, -36); c.lineTo(14, -36); c.lineTo(14, -24); }); sh('a', c => g.rr(c, -46, -24, 92, 64, 9)); sh('b', c => g.rr(c, -46, -4, 92, 10, 0)); sh('l', c => g.rr(c, -8, -8, 16, 18, 3)); },
    chart: sh => { sh('a', c => g.rr(c, -40, 6, 18, 36, 3)); sh('b', c => g.rr(c, -12, -10, 18, 52, 3)); sh('c', c => g.rr(c, 16, -28, 18, 70, 3)); sh('sd', c => { c.moveTo(-44, -6); c.lineTo(-14, -30); c.lineTo(6, -20); c.lineTo(40, -46); c.moveTo(26, -46); c.lineTo(40, -46); c.lineTo(38, -32); }); },
    pie: sh => { sh('a', c => { c.moveTo(0, 0); c.arc(0, 0, 44, -Math.PI / 2, Math.PI * .6); c.closePath(); }); sh('b', c => { c.moveTo(0, 0); c.arc(0, 0, 44, Math.PI * .6, Math.PI * 1.15); c.closePath(); }); sh('c', c => { c.moveTo(-4, -4); c.arc(-4, -4, 44, Math.PI * 1.15, Math.PI * 1.5); c.closePath(); }); },
    onigiri: sh => { sh('l', c => { c.moveTo(0, -42); c.bezierCurveTo(14, -42, 46, 22, 40, 34); c.quadraticCurveTo(36, 44, 0, 44); c.quadraticCurveTo(-36, 44, -40, 34); c.bezierCurveTo(-46, 22, -14, -42, 0, -42); }); sh('d', c => g.rr(c, -18, 14, 36, 30, 3)); sh('a', c => { g.ell(c, -14, 4, 5, 3); g.ell(c, 14, 4, 5, 3); }); sh('sd', c => { c.moveTo(-6, -4); c.quadraticCurveTo(0, 2, 6, -4); }); },
    sakura: sh => { sh('a', c => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - Math.PI / 2, x = Math.cos(a), y = Math.sin(a), px = -y, py = x;
      c.moveTo(0, 0); c.quadraticCurveTo(x * 20 + px * 22, y * 20 + py * 22, x * 44 + px * 8, y * 44 + py * 8); c.lineTo(x * 36, y * 36); c.lineTo(x * 44 - px * 8, y * 44 - py * 8); c.quadraticCurveTo(x * 20 - px * 22, y * 20 - py * 22, 0, 0); } }); sh('b', c => g.cir(c, 0, 0, 7)); },
    ramen: sh => { sh('sb', c => { c.moveTo(-10, -46); c.lineTo(20, 0); c.moveTo(6, -48); c.lineTo(30, 0); }); sh('l', c => { c.moveTo(-40, 0); c.quadraticCurveTo(-20, -14, 0, -6); c.quadraticCurveTo(20, -16, 40, 0); c.closePath(); }); sh('a', c => { c.moveTo(-46, 0); c.lineTo(46, 0); c.bezierCurveTo(46, 30, 26, 44, 0, 44); c.bezierCurveTo(-26, 44, -46, 30, -46, 0); }); sh('c', c => g.cir(c, -20, -4, 7)); },
    wand: sh => { sh('d', c => g.poly(c, [[-44, 40], [-36, 46], [10, -2], [2, -8]])); sh('a', c => g.star(c, 18, -22, 24, 5, .45)); sh('b', c => { g.star(c, -12, -36, 8, 4, .3); g.star(c, 40, 10, 7, 4, .3); }); },
    pencil: sh => { sh('a', c => g.poly(c, [[-30, 42], [-44, 44], [-42, 30], [24, -36], [36, -24]])); sh('l', c => g.poly(c, [[-30, 42], [-44, 44], [-42, 30]])); sh('b', c => g.poly(c, [[24, -36], [32, -44], [44, -32], [36, -24]])); sh('d', c => g.poly(c, [[-41, 40], [-44, 44], [-40, 43]])); },
    bag: sh => { sh('sd', c => { c.moveTo(-16, -16); c.bezierCurveTo(-16, -48, 16, -48, 16, -16); }); sh('a', c => g.poly(c, [[-36, -20], [36, -20], [42, 44], [-42, 44]])); sh('b', c => g.rr(c, -36, -20, 72, 10, 0)); },
    money: (sh, t) => { sh('a', c => g.rr(c, -46, -26, 92, 52, 6)); sh('l', c => g.rr(c, -38, -18, 76, 36, 4)); sh('b', c => g.cir(c, 0, 0, 14)); t('₽', 0, 1, 20, 'd'); },
    hashtag: (sh, t) => { sh('a', c => g.rr(c, -42, -42, 84, 84, 22)); t('#', 0, 4, 66, 'l'); },
    at: (sh, t) => { sh('a', c => g.cir(c, 0, 0, 44)); t('@', 0, 2, 58, 'l'); },
    question: (sh, t) => { sh('a', c => g.cir(c, 0, 0, 44)); t('?', 0, 4, 66, 'l'); },
    exclaim: (sh, t) => { sh('a', c => g.poly(c, [[0, -46], [46, 40], [-46, 40]])); t('!', 0, 14, 54, 'l'); },
    plus: sh => { sh('a', c => g.rr(c, -14, -44, 28, 88, 10)); sh('a', c => g.rr(c, -44, -14, 88, 28, 10)); },
    infinity: sh => { sh('sa', c => { c.moveTo(0, 0); c.bezierCurveTo(16, -26, 44, -22, 44, 0); c.bezierCurveTo(44, 22, 16, 26, 0, 0); c.bezierCurveTo(-16, -26, -44, -22, -44, 0); c.bezierCurveTo(-44, 22, -16, 26, 0, 0); }); }
  };
  const ICON_RU = { camera: 'Камера', play: 'Плей', phone: 'Телефон', mic: 'Микрофон', clapper: 'Хлопушка', lightning: 'Молния', fire: 'Огонь', crown: 'Корона', diamond: 'Бриллиант', eye: 'Глаз', bulb: 'Лампочка-идея', rocket: 'Ракета', gift: 'Подарок', cup: 'Кофе', pin: 'Геометка', note: 'Нота', magnifier: 'Лупа', megaphone: 'Рупор', calendar: 'Календарь', clock: 'Часы', chat: 'Чат', thumb: 'Палец вверх', bell: 'Колокольчик', lock: 'Замок', cloud: 'Облако', sun: 'Солнце', moon: 'Луна', planet: 'Планета', flower: 'Цветок', leaf: 'Лист', star: 'Звезда', heart: 'Сердце', sparkles: 'Блёстки', smile: 'Смайл', wow: 'Удивление', ghost: 'Призрак', cat: 'Котик', cherry: 'Вишня', film: 'Бобина', laptop: 'Ноутбук', headphones: 'Наушники', gamepad: 'Геймпад', battery: 'Батарейка', wifi: 'Wi-Fi', folder: 'Папка', mail: 'Письмо', coin: 'Монета', trophy: 'Кубок', flag: 'Флаг', target: 'Мишень', puzzle: 'Пазл', shades: 'Очки', skull: 'Череп', bomb: 'Бомба', spray: 'Баллончик', rainbow: 'Радуга', butterfly: 'Бабочка', snowflake: 'Снежинка', tree: 'Ёлка', mushroom: 'Гриб', drop: 'Капля', pot: 'Растение', cassette: 'Кассета', vinyl: 'Пластинка', tv: 'Телевизор', floppy: 'Дискета', disc: 'Диск', popcorn: 'Попкорн', ticket: 'Билет', briefcase: 'Портфель', chart: 'График роста', pie: 'Диаграмма', onigiri: 'Онигири', sakura: 'Сакура', ramen: 'Рамен', wand: 'Волшебная палочка', pencil: 'Карандаш', bag: 'Покупки', money: 'Купюра', hashtag: 'Хэштег', at: 'Собака @', question: 'Вопрос', exclaim: 'Внимание', plus: 'Плюс', infinity: 'Бесконечность' };
  const ICON_ALL = Object.keys(I);

  /* ---------- материалы стилей ---------- */
  const TH = {
    kk: { mode: 'sticker', cut: '#F3EFE6', l: '#F3EFE6', lw: 4.5, icons: ['crown', 'camera', 'play', 'clapper', 'lightning', 'fire', 'trophy', 'bulb', 'rocket', 'target', 'mic', 'laptop', 'eye', 'diamond', 'chat', 'thumb', 'bell', 'star', 'phone', 'magnifier', 'headphones', 'film', 'coin', 'flag', 'puzzle', 'clock', 'calendar', 'megaphone', 'heart', 'sparkles', 'shades', 'chart', 'folder', 'hashtag'],
      words: ['ШАХ И МАТ', 'ХОД КОНЁМ', 'СОХРАНИ', 'ЛАЙФХАК', 'БЕЗ ВОДЫ', 'КЕЙС', 'ВАУ', 'ДО', 'ПОСЛЕ', 'СМОТРИ'], stamps: ['КОД КРЕАТОРА • ПРОВЕРЕНО • ', 'ПРО-УРОВЕНЬ • ПРО-УРОВЕНЬ • ', 'СДЕЛАНО КРЕАТОРОМ • ', 'ТОП-КОНТЕНТ • ТОП-КОНТЕНТ • '], ribbons: ['НОВЫЙ УРОВЕНЬ', 'ЛУЧШИЙ ХОД', 'СМОТРИ ДО КОНЦА', 'РАЗБОР'], tall: ['ЖМИ', 'ТОП'] },
    ios: { mode: 'app', l: '#FFFFFF', lw: 0, icons: ['camera', 'chat', 'phone', 'mail', 'calendar', 'clock', 'note', 'magnifier', 'bell', 'lock', 'wifi', 'battery', 'folder', 'play', 'heart', 'star', 'pin', 'gamepad', 'headphones', 'laptop', 'cloud', 'sun', 'moon', 'thumb', 'coin', 'bag', 'chart', 'pie', 'mic', 'gift', 'hashtag', 'at', 'plus', 'question'],
      words: ['Готово ✓', 'Сохранено', 'Новое', 'Скоро', 'Лайфхак', 'Обновление', 'Вау', 'Ок', 'До', 'После'], stamps: ['APPROVED • ОДОБРЕНО • ', 'NEW UPDATE • ', 'iOS-ВАЙБ • iOS-ВАЙБ • ', 'ДОСТУПНО • ДОСТУПНО • '], ribbons: ['Обновление доступно', 'Новая функция', 'Смотри до конца', 'Сохрани себе'], tall: ['Свайп', 'Жми'] },
    romance: { mode: 'sticker', cut: '#FFFFFF', l: '#FFF7F9', lw: 3, soft: 1, icons: ['heart', 'flower', 'butterfly', 'cherry', 'sparkles', 'moon', 'star', 'cloud', 'gift', 'cup', 'mail', 'sakura', 'rainbow', 'cat', 'smile', 'diamond', 'crown', 'bell', 'camera', 'note', 'wand', 'drop', 'leaf', 'pot', 'sun', 'mushroom', 'ghost', 'chat', 'bag', 'eye', 'pencil', 'infinity', 'vinyl', 'calendar'],
      words: ['люблю', 'нежно', 'мило', 'мечта', 'с любовью', 'вдохновение', 'ах', 'навсегда', 'до', 'после'], stamps: ['С ЛЮБОВЬЮ • С ЛЮБОВЬЮ • ', 'LOVE • AMOUR • ЛЮБОВЬ • ', 'НЕЖНОСТЬ • НЕЖНОСТЬ • ', 'ТОЛЬКО ТЫ • ТОЛЬКО ТЫ • '], ribbons: ['с любовью', 'самый нежный день', 'наша история', 'моё вдохновение'], tall: ['love', 'мечта'] },
    tech: { mode: 'neon', lw: 3.2, icons: ['laptop', 'wifi', 'battery', 'lock', 'eye', 'bulb', 'rocket', 'chat', 'folder', 'mail', 'gamepad', 'headphones', 'phone', 'camera', 'mic', 'lightning', 'target', 'chart', 'pie', 'clock', 'magnifier', 'planet', 'skull', 'puzzle', 'bell', 'cloud', 'play', 'hashtag', 'at', 'infinity', 'plus', 'question', 'exclaim', 'diamond'],
      words: ['<HACK/>', 'SYSTEM OK', 'ERROR 404', 'LOADING', 'ЛАЙФХАК', 'AI', 'ДО', 'ПОСЛЕ', 'BUG', 'DEBUG'], stamps: ['ACCESS GRANTED • ДОСТУП • ', 'VERIFIED • SECURE • ', 'SYSTEM • ONLINE • ', '100% CODE • 100% CODE • '], ribbons: ['ACCESS GRANTED', 'SYSTEM UPDATE', 'НОВЫЙ АПДЕЙТ', 'ЗАГРУЗКА…'], tall: ['RUN', 'NEXT'] },
    anime: { mode: 'sticker', cut: '#FFFFFF', l: '#FFFFFF', lw: 5.5, icons: ['sakura', 'onigiri', 'ramen', 'cat', 'star', 'heart', 'sparkles', 'lightning', 'fire', 'wow', 'smile', 'ghost', 'moon', 'gamepad', 'wand', 'cherry', 'bomb', 'exclaim', 'question', 'cloud', 'sun', 'drop', 'mic', 'camera', 'note', 'butterfly', 'crown', 'diamond', 'flower', 'rocket', 'headphones', 'bell', 'phone', 'gift'],
      words: ['КАВАЙ', 'СУГОЙ!', 'НЯ!', 'БАМ!', 'ВАУ!', 'ХА-ХА', 'УРА!', 'ЧТО?!', 'ДО', 'ПОСЛЕ'], stamps: ['KAWAII • КАВАЙ • ', 'СУПЕР • СУПЕР • СУПЕР • ', 'NYA • NYA • NYA • ', 'ANIME VIBE • '], ribbons: ['НОВАЯ СЕРИЯ', 'КАВАЙ-РЕЖИМ', 'СМОТРИ ДО КОНЦА', 'ЛЕВЕЛ АП'], tall: ['ГО!', 'ЖМИ'] },
    retro: { mode: 'retro', lw: 0, icons: ['cassette', 'vinyl', 'tv', 'camera', 'phone', 'sun', 'rainbow', 'star', 'heart', 'lightning', 'shades', 'flower', 'cherry', 'note', 'mic', 'headphones', 'gamepad', 'film', 'clapper', 'cup', 'popcorn', 'ticket', 'diamond', 'crown', 'fire', 'smile', 'mushroom', 'moon', 'planet', 'rocket', 'cloud', 'bell', 'mail', 'disc'],
      words: ['ГРУВИ', 'ДИСКО', 'РЕТРО', 'КЛАСС!', 'ХИТ', 'ВАУ', 'ДО', 'ПОСЛЕ', 'РЕКОРД', 'ЛЕГЕНДА'], stamps: ['ОРИГИНАЛ • 1985 • ', 'ХИТ СЕЗОНА • ХИТ • ', 'ЗНАК КАЧЕСТВА • ', 'RETRO • ВИНТАЖ • '], ribbons: ['ХИТ ПАРАД', 'ЛЕГЕНДА ЭКРАНА', 'ВЕРНИТЕ 80-Е', 'КЛАССИКА'], tall: ['ХИТ', 'ВАУ'] },
    y2k: { mode: 'chrome', cut: '#FFFFFF', lw: 2.5, icons: ['butterfly', 'heart', 'star', 'sparkles', 'cherry', 'phone', 'disc', 'floppy', 'cd', 'smile', 'flower', 'shades', 'crown', 'diamond', 'planet', 'moon', 'lightning', 'mail', 'at', 'cassette', 'headphones', 'gamepad', 'camera', 'bag', 'gift', 'wand', 'rainbow', 'cloud', 'infinity', 'tv', 'bell', 'chat', 'note', 'mushroom'],
      words: ['ЛЮТЫЙ ВАЙБ', 'ОМГ', 'ЛОЛ', 'BFF', 'ЗВЕЗДА', 'ГЛАМУР', 'ДО', 'ПОСЛЕ', 'ХАЙП', 'ВАУ'], stamps: ['Y2K • 2000s • Y2K • ', 'ГЛАМУР • ГЛАМУР • ', 'IT GIRL • IT GIRL • ', 'BFF • 4EVER • '], ribbons: ['ЛЮТЫЙ ВАЙБ', '2000-е вернулись', 'ГЛАМУР ДНЯ', 'ОМГ'], tall: ['ОМГ', 'ХАЙП'] },
    doodle: { mode: 'doodle', lw: 4, icons: ['smile', 'wow', 'sun', 'cloud', 'star', 'heart', 'flower', 'bulb', 'rocket', 'cat', 'ghost', 'pencil', 'lightning', 'fire', 'gift', 'cup', 'note', 'camera', 'phone', 'chat', 'magnifier', 'eye', 'mushroom', 'rainbow', 'cherry', 'leaf', 'drop', 'moon', 'planet', 'bomb', 'question', 'exclaim', 'puzzle', 'sparkles'],
      words: ['ура!', 'хи-хи', 'бум!', 'ого!', 'ой', 'хм…', 'класс', 'идея!', 'до', 'после'], stamps: ['НАРИСОВАНО • ОТ РУКИ • ', 'ВЕСЕЛО • ВЕСЕЛО • ', 'ОТЛИЧНО • 5+ • ', 'ПРОВЕРЕНО • ХА • '], ribbons: ['вот это идея!', 'смотри сюда', 'весело и просто', 'лайфхак дня'], tall: ['ура', 'сюда'] },
    future: { mode: 'neon', lw: 2.6, grad: 1, icons: ['planet', 'rocket', 'diamond', 'lightning', 'eye', 'star', 'sparkles', 'moon', 'infinity', 'laptop', 'phone', 'headphones', 'gamepad', 'wifi', 'battery', 'lock', 'target', 'chart', 'bulb', 'disc', 'play', 'camera', 'mic', 'heart', 'crown', 'cloud', 'sun', 'drop', 'butterfly', 'wand', 'skull', 'plus', 'at', 'hashtag'],
      words: ['FUTURE', '3D', 'NEXT LEVEL', 'МЕТА', 'ВАУ', 'ДО', 'ПОСЛЕ', 'NEW', '2077', 'ВЗЛЁТ'], stamps: ['FUTURE • READY • ', 'NEXT LEVEL • NEXT • ', 'METAVERSE • МЕТА • ', '3D • 3D • 3D • 3D • '], ribbons: ['NEXT LEVEL', 'БУДУЩЕЕ УЖЕ ЗДЕСЬ', 'НОВАЯ ЭРА', 'ЗАПУСК'], tall: ['GO', 'NEXT'] },
    scrap: { mode: 'sticker', cut: '#FFFDF6', l: '#FBF6EC', lw: 3, tape: 1, icons: ['camera', 'flower', 'leaf', 'heart', 'star', 'cup', 'mail', 'pencil', 'butterfly', 'cherry', 'sun', 'cloud', 'moon', 'pin', 'ticket', 'note', 'vinyl', 'cassette', 'calendar', 'clock', 'bag', 'gift', 'mushroom', 'pot', 'sakura', 'rainbow', 'smile', 'cat', 'film', 'bell', 'drop', 'sparkles', 'phone', 'eye'],
      words: ['мой день', 'заметка', 'важно!', 'love', 'вдохнови', 'мысли', 'до', 'после', 'память', 'ура'], stamps: ['ДНЕВНИК • МОЙ ДЕНЬ • ', 'ВАЖНО • ВАЖНО • ', 'HANDMADE • РУЧНАЯ • ', 'ПАМЯТЬ • ПАМЯТЬ • '], ribbons: ['мой маленький дневник', 'заметки на полях', 'сохрани на память', 'день из жизни'], tall: ['мой', 'день'] },
    lux: { mode: 'line', lw: 2.6, gold: 1, icons: ['diamond', 'crown', 'star', 'sparkles', 'moon', 'sun', 'flower', 'leaf', 'bag', 'shades', 'cup', 'camera', 'mail', 'ticket', 'clock', 'eye', 'heart', 'gift', 'butterfly', 'vinyl', 'drop', 'infinity', 'briefcase', 'calendar', 'pin', 'phone', 'note', 'bell', 'key' in I ? 'key' : 'lock', 'trophy', 'coin', 'pencil', 'chart', 'film'],
      words: ['Exclusive', 'Premium', 'Limited', 'Élégance', 'Iconic', 'Luxe', 'до', 'после', 'Couture', 'Signature'], stamps: ['PREMIUM QUALITY • ', 'EXCLUSIVE • EST. 2026 • ', 'LIMITED EDITION • ', 'HAUTE COUTURE • '], ribbons: ['Limited edition', 'Exclusive', 'Signature', 'Premium'], tall: ['Luxe', 'Iconic'] },
    cinema: { mode: 'line', lw: 3, cream: 1, icons: ['clapper', 'film', 'camera', 'popcorn', 'ticket', 'star', 'mic', 'tv', 'eye', 'crown', 'trophy', 'moon', 'shades', 'skull', 'diamond', 'clock', 'note', 'vinyl', 'cup', 'heart', 'lightning', 'fire', 'phone', 'magnifier', 'mail', 'sparkles', 'play', 'flag', 'target', 'bomb', 'drop', 'ghost', 'question', 'exclaim'],
      words: ['ПРЕМЬЕРА', 'КОНЕЦ', 'ДУБЛЬ 2', 'МОТОР!', 'СНЯТО!', 'ДРАМА', 'ДО', 'ПОСЛЕ', 'ТРИЛЛЕР', 'ЭПИЛОГ'], stamps: ['ОФИЦИАЛЬНЫЙ ОТБОР • ', 'ПРЕМЬЕРА • ПРЕМЬЕРА • ', 'ФЕСТИВАЛЬ • 2026 • ', 'НА ЭКРАНАХ • '], ribbons: ['ПРЕМЬЕРА', 'ОФИЦИАЛЬНЫЙ ОТБОР', 'ВСКОРЕ НА ЭКРАНАХ', 'В ГЛАВНОЙ РОЛИ'], tall: ['КИНО', 'МОТОР'] },
    expert: { mode: 'badge', lw: 0, icons: ['chart', 'pie', 'briefcase', 'target', 'bulb', 'rocket', 'trophy', 'coin', 'money', 'calendar', 'clock', 'laptop', 'phone', 'mail', 'chat', 'magnifier', 'lock', 'folder', 'thumb', 'star', 'flag', 'puzzle', 'megaphone', 'mic', 'camera', 'play', 'bell', 'pencil', 'diamond', 'crown', 'eye', 'question', 'exclaim', 'plus'],
      words: ['ФАКТ', 'ВАЖНО', 'КЕЙС', 'ЛАЙФХАК', 'ВЫВОД', 'ЦИФРЫ', 'ДО', 'ПОСЛЕ', 'ШАГ 1', 'ИТОГ'], stamps: ['ЭКСПЕРТ • ПРОВЕРЕНО • ', 'КАЧЕСТВО • ГАРАНТИЯ • ', 'ОДОБРЕНО • ОДОБРЕНО • ', 'ТОП-РЕШЕНИЕ • '], ribbons: ['РЕЗУЛЬТАТ ГАРАНТИРОВАН', 'ЧЕК-ЛИСТ', 'КЕЙС КЛИЕНТА', 'ПОШАГОВО'], tall: ['ШАГ', 'ИТОГ'] },
    grunge: { mode: 'grunge', lw: 5, icons: ['skull', 'bomb', 'spray', 'lightning', 'fire', 'star', 'crown', 'eye', 'heart', 'flag', 'shades', 'mic', 'headphones', 'cassette', 'vinyl', 'camera', 'phone', 'ghost', 'target', 'exclaim', 'drop', 'wow', 'smile', 'moon', 'diamond', 'gamepad', 'tv', 'bell', 'megaphone', 'thumb', 'chat', 'rocket', 'hashtag', 'question'],
      words: ['БУНТ', 'ЖЁСТКО', 'ВЖУХ', 'НЕ ЛЕЗЬ', 'УЛИЦА', 'ВАЙБ', 'ДО', 'ПОСЛЕ', 'ТОП', 'ДИКО'], stamps: ['СТРИТ • УЛИЦА • ', 'НЕ ФОРМАТ • ', 'ANTI • ANTI • ANTI • ', 'ГРАНЖ • ГРАНЖ • '], ribbons: ['БЕЗ ПРАВИЛ', 'ЖЁСТКИЙ МОНТАЖ', 'ГОЛОС УЛИЦ', 'ГРОМЧЕ'], tall: ['БУНТ', 'ВЖУХ'] },
    eco: { mode: 'eco', lw: 3, icons: ['leaf', 'flower', 'sun', 'drop', 'pot', 'mushroom', 'cloud', 'tree', 'butterfly', 'rainbow', 'moon', 'star', 'heart', 'cup', 'bag', 'cherry', 'sakura', 'camera', 'pin', 'mail', 'calendar', 'bulb', 'smile', 'cat', 'snowflake', 'pencil', 'note', 'sparkles', 'gift', 'chat', 'clock', 'eye', 'infinity', 'thumb'],
      words: ['эко', 'природа', 'натурально', 'гармония', 'дыши', 'с заботой', 'до', 'после', 'зелёный', 'тишина'], stamps: ['100% НАТУРАЛЬНО • ', 'ЭКО • ПРИРОДА • ', 'С ЗАБОТОЙ • ', 'ОРГАНИК • ОРГАНИК • '], ribbons: ['ближе к природе', 'натурально', 'с заботой о планете', 'дыши глубже'], tall: ['эко', 'дыши'] },
    season: { mode: 'sticker', cut: '#FFFFFF', l: '#FFFFFF', lw: 3.5, icons: ['snowflake', 'tree', 'gift', 'star', 'bell', 'sun', 'flower', 'leaf', 'mushroom', 'cup', 'heart', 'sparkles', 'moon', 'cloud', 'drop', 'rainbow', 'butterfly', 'cherry', 'sakura', 'calendar', 'camera', 'bag', 'shades', 'smile', 'pot', 'mail', 'crown', 'wand', 'fire', 'clock', 'note', 'pin', 'popcorn', 'diamond'],
      words: ['С Новым годом!', 'Весна', 'Лето!', 'Осень', 'Праздник', 'Ура!', 'до', 'после', 'Каникулы', 'Подарок'], stamps: ['ПРАЗДНИК • ПРАЗДНИК • ', 'С НОВЫМ ГОДОМ • ', 'ЛЕТО • 2026 • ЛЕТО • ', 'ПОДАРОК • ПОДАРОК • '], ribbons: ['С Новым годом', 'Лето начинается', 'Праздничная распродажа', 'Подарок внутри'], tall: ['Ура', 'Ёлка'] }
  };

  function mat(sid, S) {
    const t = TH[sid], m = { mode: t.mode, a: S.c1, b: S.c2, c: S.c3, d: S.ink, l: t.l || '#fff', w: 'rgba(255,255,255,.75)', line: S.ink, lw: t.lw, cut: t.cut || '#fff', glow: 0 };
    if (t.mode === 'neon') Object.assign(m, { line: S.c1, glow: 16, d: S.c1 });
    if (t.mode === 'line') Object.assign(m, { line: t.gold ? S.c1 : S.c2, d: t.gold ? S.c1 : S.c2 });
    if (t.mode === 'retro') Object.assign(m, { l: '#F6E7C8', line: null });
    if (t.mode === 'app') Object.assign(m, { line: null });
    if (t.mode === 'badge') Object.assign(m, { line: null, l: '#fff' });
    if (t.mode === 'grunge') Object.assign(m, { l: S.c3 });
    if (t.mode === 'eco') Object.assign(m, { l: '#F4EFE2' });
    if (t.mode === 'doodle') Object.assign(m, { l: '#fff' });
    return m;
  }

  /* рисование иконки материалом: mono — одним цветом (для иконок в бейджах и плитках) */
  function icon(c, name, size, m, shift = 0, mono) {
    if (G.KKX && G.KKX.icon && G.KKX.icon(c, name, size / 2, size / 2, size)) return; // своя картинка вместо значка (настройки в плагине и приложении)
    const f = I[name] || I.star, cols = [m.a, m.b, m.c], col = r => r === 'a' || r === 'b' || r === 'c' ? cols[('abc'.indexOf(r) + shift) % 3] : m[r];
    const lineMode = m.mode === 'neon' || m.mode === 'line';
    c.save(); c.scale(size / 100, size / 100); c.lineJoin = 'round'; c.lineCap = 'round';
    const paint = (role, build) => {
      const stroke = role[0] === 's' && role.length === 2, r = stroke ? role[1] : role;
      if (mono) { if (r === 'w') return; c.beginPath(); build(c); if (stroke) { c.strokeStyle = r === 'd' || r === 'l' ? mono.bg : mono.fg; c.lineWidth = 7; c.stroke(); } else { c.fillStyle = r === 'd' ? mono.bg : r === 'l' ? mono.bg : mono.fg; c.fill(); } return; }
      if (lineMode) { if (r === 'w') return; c.beginPath(); build(c); c.strokeStyle = m.line; c.lineWidth = stroke ? m.lw * 2 : m.lw;
        if (m.glow) { c.shadowColor = m.line; c.shadowBlur = m.glow; }
        if (r === 'd' && !stroke) { c.fillStyle = m.line; c.fill(); } else c.stroke(); c.shadowBlur = 0; return; }
      c.beginPath(); build(c);
      if (stroke) { c.strokeStyle = r === 'd' ? m.d : col(r); c.lineWidth = Math.max(5, m.lw * 1.8); c.stroke(); return; }
      c.fillStyle = col(r); c.fill();
      if (m.line && r !== 'w' && r !== 'd' && m.lw) { c.strokeStyle = m.line; c.lineWidth = m.lw; c.stroke(); }
    };
    const tx = (s, x, y, sz, r) => { c.save(); c.font = `${sz}px "Montserrat-Black"`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = mono ? mono.bg : lineMode ? m.line : m[r] || m.d; c.fillText(s, x, y); c.restore(); };
    f(paint, tx); c.restore();
  }

  /* вырубка стикера: обводка вокруг силуэта + мягкая тень */
  function cut(c, W, H, draw, col, r, shadow = true) {
    const o = cv(W, H), oc = o.getContext('2d'); draw(oc);
    const s = cv(W, H), sc = s.getContext('2d'); const n = 20;
    for (let i = 0; i < n; i++) { const a = i / n * TAU; sc.drawImage(o, Math.cos(a) * r, Math.sin(a) * r); } sc.drawImage(o, 0, 0);
    sc.globalCompositeOperation = 'source-in'; sc.fillStyle = col; sc.fillRect(0, 0, W, H);
    c.save(); if (shadow) { c.shadowColor = 'rgba(0,0,0,.28)'; c.shadowBlur = r * 1.3; c.shadowOffsetY = r * .45; } c.drawImage(s, 0, 0); c.restore(); c.drawImage(o, 0, 0);
  }
  // силуэт со сдвигом (ретро-печать)
  function offset(c, W, H, draw, col, dx, dy) { const o = cv(W, H), oc = o.getContext('2d'); draw(oc); const s = cv(W, H), sc = s.getContext('2d'); sc.drawImage(o, 0, 0); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = col; sc.fillRect(0, 0, W, H); c.drawImage(s, dx, dy); c.drawImage(o, 0, 0); }
  // потёртости трафарета
  function distress(c, W, H, seed = 5, k = 1) { const R = rnd(seed); c.save(); c.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 260 * k; i++) { const x = R() * W, y = R() * H, r = Math.pow(R(), 3) * W * .02 + 1; c.globalAlpha = .4 + R() * .6; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    c.globalAlpha = .5; c.lineWidth = 2; for (let i = 0; i < 14 * k; i++) { c.beginPath(); const x = R() * W, y = R() * H; c.moveTo(x, y); c.lineTo(x + (R() - .5) * W * .3, y + (R() - .5) * H * .05); c.stroke(); } c.restore(); }
  // кусочек скотча
  function tape(c, x, y, w, rot, col) { c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha = .78; c.fillStyle = col; c.beginPath(); const h = w * .28; c.moveTo(-w / 2, -h / 2); for (let i = 0; i <= 6; i++) c.lineTo(-w / 2 + (i % 2) * 4, -h / 2 + i * h / 6); c.lineTo(w / 2, h / 2); for (let i = 0; i <= 6; i++) c.lineTo(w / 2 - (i % 2) * 4, h / 2 - i * h / 6); c.closePath(); c.fill(); c.restore(); }
  // финальная подача материала: вырубка / сдвиг / потёртость и т. п.
  function finish(c, W, H, m, sid, draw, seed = 1) {
    const t = TH[sid];
    if (m.mode === 'sticker' || m.mode === 'chrome') { cut(c, W, H, draw, m.cut, Math.min(W, H) * (m.mode === 'chrome' ? .014 : .022)); if (t.tape) tape(c, W * .5, H * .1, W * .26, (rnd(seed)() - .5) * .5, '#E9DCC0'); return; }
    if (m.mode === 'retro') { offset(c, W, H, draw, m.d, W * .018, H * .018); return; }
    if (m.mode === 'doodle' || m.mode === 'eco') { draw(c); return; }
    if (m.mode === 'grunge') { draw(c); distress(c, W, H, seed); return; }
    draw(c);
  }

  // толщина линии и подложка для неона/линии
  const SW = (W, H, m) => Math.min(W, H) * (m.mode === 'neon' ? .013 : .0065);
  const under = (k, m, S) => { if (m.mode === 'neon' || m.mode === 'line') { k.save(); k.shadowBlur = 0; k.fillStyle = m.mode === 'neon' ? hexA(S.ink, .6) : 'rgba(12,11,10,.72)'; k.fill(); k.restore(); } };
  /* ---------- шрифт и текст ---------- */
  function fit(c, s, fontName, maxW, maxH) { c.font = `100px "${fontName}"`; const w = c.measureText(s).width || 1; return Math.min(maxH, 100 * maxW / w); }
  function chromeFill(c, y0, y1) { const gr = c.createLinearGradient(0, y0, 0, y1); [['#ffffff', 0], ['#c9d2e8', .35], ['#f8faff', .5], ['#6d7590', .62], ['#eef0fa', 1]].forEach(s => gr.addColorStop(s[1], s[0])); return gr; }
  // слово-стикер в материале стиля
  function word(c, W, H, S, m, sid, s, o = {}) {
    const fnt = o.body ? S.fontBody : S.font, size = fit(c, s, fnt, W * .8, H * .42), y = H / 2 + size * .05;
    const draw = k => { k.save(); k.translate(W / 2, y); k.rotate(o.tilt ?? -.06); k.font = `${size}px "${fnt}"`; k.textAlign = 'center'; k.textBaseline = 'middle'; k.lineJoin = 'round';
      const md = m.mode, col = o.col || m.a;
      if (md === 'neon') { k.shadowColor = col; k.shadowBlur = 30; k.strokeStyle = col; k.lineWidth = size * .05; k.strokeText(s, 0, 0); k.shadowBlur = 12; k.fillStyle = '#fff'; k.globalAlpha = .9; k.fillText(s, 0, 0); }
      else if (md === 'line') { k.fillStyle = m.line; k.fillText(s, 0, 0); const w = k.measureText(s).width; k.fillRect(-w / 2, size * .62, w, Math.max(2, size * .025)); k.beginPath(); k.arc(0, size * .63, size * .05, 0, TAU); k.fill(); }
      else if (md === 'chrome') { k.strokeStyle = m.d; k.lineWidth = size * .1; k.strokeText(s, 0, 0); k.fillStyle = chromeFill(k, -size / 2, size / 2); k.fillText(s, 0, 0); k.globalAlpha = .55; k.fillStyle = col; k.globalCompositeOperation = 'source-atop'; k.fillRect(-W, size * .1, W * 2, size); }
      else if (md === 'retro') { [m.c, m.b].forEach((cc, i) => { k.fillStyle = cc; k.fillText(s, (2 - i) * size * .045, (2 - i) * size * .045); }); k.fillStyle = col; k.fillText(s, 0, 0); }
      else if (md === 'app' || md === 'badge') { const w = k.measureText(s).width, ph = size * 1.5, pw = w + size * 1.1; k.fillStyle = col; rrect(k, -pw / 2, -ph / 2, pw, ph, md === 'app' ? ph / 2 : ph * .18); k.fill(); k.fillStyle = '#fff'; k.fillText(s, 0, size * .03); }
      else { // стикер, дудл, эко, гранж: объём + обводка
        const dep = md === 'sticker' ? size * .07 : size * .04; k.fillStyle = m.d; for (let i = dep; i > 0; i -= 2) k.fillText(s, i * .6, i);
        k.strokeStyle = m.d; k.lineWidth = size * (md === 'doodle' ? .05 : .08); k.strokeText(s, 0, 0); k.fillStyle = col; k.fillText(s, 0, 0);
        if (md === 'sticker') { k.save(); k.globalCompositeOperation = 'source-atop'; k.fillStyle = 'rgba(255,255,255,.28)'; k.fillRect(-W, -size * .55, W * 2, size * .38); k.restore(); } }
      k.restore(); };
    finish(c, W, H, m, sid, draw, s.length);
  }

  /* ---------- остальные элементы ---------- */
  function iconItem(c, W, H, S, m, sid, name, shift) {
    const sz = Math.min(W, H) * .66;
    const draw = k => { k.save(); k.translate(W / 2, H / 2);
      if (m.mode === 'app') { const s = sz * 1.08, cols = [S.c1, S.c2, S.c3, '#FF9F0A', '#5E5CE6', '#1C1C1E'], c0 = cols[shift % cols.length]; const gr = k.createLinearGradient(0, -s / 2, 0, s / 2); gr.addColorStop(0, mix(c0, '#ffffff', .25)); gr.addColorStop(1, c0);
        k.shadowColor = 'rgba(0,0,0,.25)'; k.shadowBlur = 28; k.shadowOffsetY = 12; k.fillStyle = gr; rrect(k, -s / 2, -s / 2, s, s, s * .23); k.fill(); k.shadowColor = 'transparent'; icon(k, name, s * .64, m, 0, { fg: '#fff', bg: c0 }); }
      else if (m.mode === 'badge') { const s = sz * 1.05, cols = [S.c1, S.c2, S.c3, S.ink], c0 = cols[shift % cols.length]; k.shadowColor = 'rgba(15,23,42,.22)'; k.shadowBlur = 24; k.shadowOffsetY = 10; k.fillStyle = c0; k.beginPath(); k.arc(0, 0, s / 2, 0, TAU); k.fill(); k.shadowColor = 'transparent'; icon(k, name, s * .58, m, 0, { fg: '#fff', bg: c0 }); }
      else if (m.mode === 'doodle' || m.mode === 'eco') { const fillOnly = Object.assign({}, m, { line: null }), lineOnly = Object.assign({}, m, { mode: 'line', line: m.d, lw: m.lw });
        k.save(); k.translate(sz * .05, sz * .04); icon(k, name, sz, fillOnly, shift); k.restore(); icon(k, name, sz, lineOnly, shift); }
      else if (m.mode === 'chrome') { k.shadowColor = 'rgba(255,255,255,.9)'; k.shadowBlur = 18; icon(k, name, sz, Object.assign({}, m, { a: chromeFill(k, -sz / 2, sz / 2) }), shift); }
      else icon(k, name, sz, m, shift);
      k.restore(); };
    finish(c, W, H, m, sid, draw, shift + 3);
  }
  // печать по кругу
  function stamp(c, W, H, S, m, sid, txt, ico, p = 1, spin = 0) {
    const r = Math.min(W, H) * .4, col = m.mode === 'neon' || m.mode === 'line' ? m.line : m.mode === 'app' ? S.c1 : m.mode === 'badge' ? S.c1 : m.a;
    const draw = k => { k.save(); k.translate(W / 2, H / 2); k.rotate(-.12 + spin); const sc = p < 1 ? 1 + 1.4 * (1 - E.out(p)) : 1; k.scale(sc, sc); k.globalAlpha = E.clamp(p * 2);
      if (m.glow) { k.shadowColor = col; k.shadowBlur = m.glow; }
      const solid = !(m.mode === 'neon' || m.mode === 'line');
      if (solid) { k.fillStyle = col; k.beginPath(); k.arc(0, 0, r, 0, TAU); k.fill(); } else if (m.mode === 'neon' || m.mode === 'line') { k.beginPath(); k.arc(0, 0, r, 0, TAU); under(k, m, S); }
      k.strokeStyle = solid ? (m.mode === 'app' || m.mode === 'badge' ? '#fff' : m.l) : col; k.lineWidth = r * .03; k.beginPath(); k.arc(0, 0, r * .94, 0, TAU); k.stroke(); k.beginPath(); k.arc(0, 0, r * .64, 0, TAU); k.stroke();
      const ink = solid ? (m.mode === 'app' || m.mode === 'badge' ? '#fff' : m.l) : col;
      k.fillStyle = ink; k.font = `${r * .17}px "${S.fontBody}"`; k.textAlign = 'center'; k.textBaseline = 'middle';
      const chars = [...txt.toUpperCase()], step = TAU / chars.length; chars.forEach((ch, i) => { k.save(); k.rotate(i * step); k.translate(0, -r * .79); k.fillText(ch, 0, 0); k.restore(); });
      k.shadowBlur = 0; icon(k, ico, r * .8, Object.assign({}, m, { mode: 'line', line: ink, lw: 4.5, glow: 0 }), 0);
      k.restore(); };
    if (m.mode === 'grunge') { draw(c); distress(c, W, H, txt.length, 1); } else if (m.mode === 'sticker' || m.mode === 'chrome') cut(c, W, H, draw, m.cut, Math.min(W, H) * .018); else draw(c);
  }
  // лента-баннер с загнутыми концами (широкий формат)
  function ribbon(c, W, H, S, m, sid, txt, p = 1) {
    const k0 = p < 1 ? E.out(E.clamp(p)) : 1, h = H * .42, fnt = S.font, size = fit(c, txt, fnt, W * .66, h * .55), w = Math.min(W * .74, c.measureText ? (() => { c.font = `${size}px "${fnt}"`; return c.measureText(txt).width + h * 1.2; })() : W * .7);
    const main = m.mode === 'neon' || m.mode === 'line' ? 'transparent' : m.mode === 'app' ? S.c1 : m.a, side = m.mode === 'neon' || m.mode === 'line' ? 'transparent' : mix(m.mode === 'app' ? S.c1 : m.b, '#000', .12), fold = mix(main === 'transparent' ? '#000000' : main, '#000', .45);
    const draw = k => { k.save(); k.translate(W / 2, H / 2); k.rotate(-.03); k.scale(k0, 1); k.lineJoin = 'round';
      const stroke = m.mode === 'neon' || m.mode === 'line'; const lc = m.line || m.d;
      const ends = (s) => { k.beginPath(); k.moveTo(s * (w / 2 - h * .1), -h * .2); k.lineTo(s * (w / 2 + h * .9), -h * .2); k.lineTo(s * (w / 2 + h * .55), h * .3); k.lineTo(s * (w / 2 + h * .9), h * .8); k.lineTo(s * (w / 2 - h * .1), h * .8); k.closePath(); };
      [-1, 1].forEach(s => { ends(s); if (stroke) { under(k, m, S); k.strokeStyle = lc; k.lineWidth = SW(W, H, m); if (m.glow) { k.shadowColor = lc; k.shadowBlur = m.glow; } k.stroke(); } else { k.fillStyle = side; k.fill(); if (m.line) { k.strokeStyle = m.line; k.lineWidth = 6; k.stroke(); } }
        if (!stroke) { k.beginPath(); k.moveTo(s * w / 2, h * .5); k.lineTo(s * (w / 2 - h * .1), h * .8); k.lineTo(s * w / 2 - s * h * .1, h * .5); k.closePath(); k.fillStyle = fold; k.fill(); } });
      k.beginPath(); k.rect(-w / 2, -h / 2, w, h); if (stroke) { under(k, m, S); k.strokeStyle = lc; k.lineWidth = SW(W, H, m); k.stroke(); } else { k.fillStyle = main; k.fill(); if (m.line) { k.strokeStyle = m.line; k.lineWidth = 6; k.stroke(); } }
      k.shadowBlur = 0; k.font = `${size}px "${fnt}"`; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillStyle = stroke ? lc : (m.mode === 'app' || m.mode === 'badge' ? '#fff' : m.mode === 'retro' ? '#F6E7C8' : m.d); k.fillText(txt, 0, size * .04);
      k.restore(); };
    finish(c, W, H, m, sid, draw, txt.length);
  }
  // цифра-бейдж
  function number(c, W, H, S, m, sid, txt, shape, p = 1) {
    const r = Math.min(W, H) * .4, k0 = p < 1 ? E.back(E.clamp(p)) : 1, col = m.mode === 'app' || m.mode === 'badge' ? S.c1 : m.a;
    const draw = k => { k.save(); k.translate(W / 2, H / 2); k.scale(k0, k0); k.rotate(-.05);
      const stroke = m.mode === 'neon' || m.mode === 'line'; k.beginPath();
      if (shape === 'burst') g.star(k, 0, 0, r, 14, .8, 0); else if (shape === 'square') g.rr(k, -r * .85, -r * .85, r * 1.7, r * 1.7, r * .3); else if (shape === 'scallop') { for (let i = 0; i <= 120; i++) { const a = i / 120 * TAU, q = r * (1 + .06 * Math.cos(a * 16)); i ? k.lineTo(Math.cos(a) * q, Math.sin(a) * q) : k.moveTo(q, 0); } k.closePath(); } else g.cir(k, 0, 0, r);
      if (stroke) { under(k, m, S); k.strokeStyle = m.line; k.lineWidth = r * .04; k.shadowColor = m.line; k.shadowBlur = m.glow; k.stroke(); } else { k.fillStyle = m.mode === 'chrome' ? chromeFill(k, -r, r) : col; k.fill(); if (m.line && m.lw) { k.strokeStyle = m.line; k.lineWidth = r * .045; k.stroke(); } }
      const size = fit(k, txt, S.font, r * 1.4, r * 1.1); k.font = `${size}px "${S.font}"`; k.textAlign = 'center'; k.textBaseline = 'middle'; k.shadowBlur = 0;
      k.fillStyle = stroke ? m.line : m.mode === 'app' || m.mode === 'badge' ? '#fff' : m.mode === 'retro' ? '#F6E7C8' : m.d; k.fillText(txt, 0, size * .05); k.restore(); };
    finish(c, W, H, m, sid, draw, txt.length + 7);
  }
  // стрелки от руки: точки пути
  const ARROWS = {
    zigzag: t => [-.38 + t * .76, .1 + (Math.abs(((t * 4) % 2) - 1) - .5) * .22 - t * .25],
    loop: t => { const a = t * TAU * 1.15; return [-.4 + t * .8 + Math.sin(a) * .1 * Math.sin(t * Math.PI), .15 - t * .3 - Math.cos(a) * .12 * Math.sin(t * Math.PI) + .06]; },
    wave: t => [-.4 + t * .8, Math.sin(t * TAU * 1.5) * .1],
    down: t => [-.32 + Math.sin(t * Math.PI / 2) * .5, -.34 + (1 - Math.cos(t * Math.PI / 2)) * .62],
    spiral: t => { const a = t * TAU * 1.6, r = .08 + t * .26; return [Math.cos(a) * r * (1 - t) + t * .32, Math.sin(a) * r * (1 - t) - t * .05]; },
    long: t => [-.42 + t * .84, .2 - t * .4 + Math.sin(t * Math.PI) * -.14]
  };
  function arrowItem(c, W, H, S, m, sid, kind, p = 1, dashed) {
    const fn = ARROWS[kind], n = 80, s = Math.min(W, H), pts = []; for (let i = 0; i <= n; i++) { const q = fn(i / n); pts.push([W / 2 + q[0] * s, H / 2 + q[1] * s]); }
    const col = m.mode === 'neon' || m.mode === 'line' ? m.line : m.mode === 'app' || m.mode === 'badge' ? S.c1 : m.a, lw = Math.max(10, (S.lw || 16) * 1.15);
    const draw = k => { const R = rnd(kind.length), r = S.rough || 0, upto = Math.max(2, Math.round(pts.length * E.clamp(p / .85))); k.lineCap = 'round'; k.lineJoin = 'round';
      const jit = pts.map(q => [q[0] + (R() - .5) * r * 4, q[1] + (R() - .5) * r * 4]);
      const stroke = (cc, w2) => { k.beginPath(); jit.slice(0, upto).forEach((q, i) => i ? k.lineTo(q[0], q[1]) : k.moveTo(q[0], q[1])); k.strokeStyle = cc; k.lineWidth = w2; if (dashed) k.setLineDash([w2 * 1.6, w2 * 1.4]); k.stroke(); k.setLineDash([]); };
      if (m.glow) { k.shadowColor = col; k.shadowBlur = m.glow; }
      if (m.line && m.mode !== 'neon' && m.mode !== 'line') stroke(m.line, lw + m.lw * 2.4);
      stroke(col, lw);
      if (p > .85) { const e = jit[jit.length - 1], b = jit[jit.length - 7], ang = Math.atan2(e[1] - b[1], e[0] - b[0]), hl = s * .085 * E.out((p - .85) / .15);
        const head = (cc, w2) => { k.beginPath(); k.moveTo(e[0] - hl * Math.cos(ang - .55), e[1] - hl * Math.sin(ang - .55)); k.lineTo(e[0], e[1]); k.lineTo(e[0] - hl * Math.cos(ang + .55), e[1] - hl * Math.sin(ang + .55)); k.strokeStyle = cc; k.lineWidth = w2; k.stroke(); };
        if (m.line && m.mode !== 'neon' && m.mode !== 'line') head(m.line, lw + m.lw * 2.4); head(col, lw); }
      k.shadowBlur = 0; };
    finish(c, W, H, m, sid, draw, kind.length);
  }
  // дудлы-акценты
  function doodleItem(c, W, H, S, m, sid, kind, p = 1, t = 0) {
    const s = Math.min(W, H), col = m.mode === 'neon' || m.mode === 'line' ? m.line : m.mode === 'app' || m.mode === 'badge' ? S.c1 : m.a, col2 = m.mode === 'neon' || m.mode === 'line' ? m.line : m.b, lw = Math.max(9, (S.lw || 16));
    const draw = k => { k.save(); k.lineCap = 'round'; k.lineJoin = 'round'; if (m.glow) { k.shadowColor = col; k.shadowBlur = m.glow; }
      const st = (pts, cc, w2 = lw) => { const upto = Math.max(2, Math.round(pts.length * E.clamp(p))); if (m.line && m.mode !== 'neon' && m.mode !== 'line') { k.beginPath(); pts.slice(0, upto).forEach((q, i) => i ? k.lineTo(q[0], q[1]) : k.moveTo(q[0], q[1])); k.strokeStyle = m.line; k.lineWidth = w2 + m.lw * 2.2; k.stroke(); }
        k.beginPath(); pts.slice(0, upto).forEach((q, i) => i ? k.lineTo(q[0], q[1]) : k.moveTo(q[0], q[1])); k.strokeStyle = cc; k.lineWidth = w2; k.stroke(); };
      const fillShape = (fn, cc) => { k.beginPath(); fn(k); k.fillStyle = cc; k.fill(); if (m.line && m.mode !== 'neon' && m.mode !== 'line' && m.lw) { k.strokeStyle = m.line; k.lineWidth = m.lw * 2; k.stroke(); } };
      if (kind === 'swirl') { const pts = []; for (let i = 0; i <= 120; i++) { const q = i / 120, a = q * TAU * 3, r = s * (.04 + q * .32); pts.push([W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r]); } st(pts, col); }
      if (kind === 'squiggle') { const pts = []; for (let i = 0; i <= 120; i++) { const q = i / 120; pts.push([W / 2 + (q - .5) * s * .82, H / 2 + Math.sin(q * TAU * 3) * s * .09]); } st(pts, col); }
      if (kind === 'emphasis') { [[-.55, -1], [0, -1.15], [.55, -1]].forEach(([dx, dy], i) => { const x0 = W / 2 + dx * s * .2, y0 = H / 2 + dy * s * .12, x1 = W / 2 + dx * s * .42, y1 = H / 2 + dy * s * .36; st([[x0, y0], [x0 + (x1 - x0) * .5, y0 + (y1 - y0) * .5], [x1, y1]], i === 1 ? col : col2, lw * 1.2); }); }
      if (kind === 'sparks') { const sc = p < 1 ? E.back(E.clamp(p)) : 1; [[0, 0, .3, col], [.27, -.24, .13, col2], [-.25, .25, .1, m.mode === 'neon' || m.mode === 'line' ? m.line : m.c]].forEach(([dx, dy, r, cc], i) => { const tw = .8 + .2 * Math.sin(t * 6 + i * 2); fillShape(q => g.star(q, W / 2 + dx * s, H / 2 + dy * s, r * s * sc * tw, 4, .22), cc); }); }
      if (kind === 'hearts') { const sc = p < 1 ? E.back(E.clamp(p)) : 1; [[-.18, .06, .2, col], [.18, -.12, .15, col2], [.12, .24, .1, m.mode === 'neon' || m.mode === 'line' ? m.line : m.c]].forEach(([dx, dy, r, cc], i) => fillShape(q => g.heart(q, W / 2 + dx * s, H / 2 + dy * s + Math.sin(t * 4 + i) * s * .01, r * s * sc), cc)); }
      if (kind === 'confetti') { const R = rnd(31), cols = m.mode === 'neon' || m.mode === 'line' ? [m.line] : [m.a, m.b, m.c]; for (let i = 0; i < 26; i++) { const a = R() * TAU, d = Math.sqrt(R()) * s * .38 * (p < 1 ? E.out(E.clamp(p)) : 1), x = W / 2 + Math.cos(a) * d, y = H / 2 + Math.sin(a) * d + t * s * .03, z = s * (.02 + R() * .025);
        k.save(); k.translate(x, y); k.rotate(R() * TAU + t * 3); k.fillStyle = cols[i % cols.length]; if (i % 3 === 0) { k.beginPath(); k.arc(0, 0, z * .6, 0, TAU); k.fill(); } else if (i % 3 === 1) k.fillRect(-z, -z * .35, z * 2, z * .7); else { k.beginPath(); g.star(k, 0, 0, z, 4, .3); k.fill(); } k.restore(); } }
      k.restore(); };
    finish(c, W, H, m, sid, draw, kind.length + 2);
  }
  // форма с текстом: волнистый бейдж, клякса, облако, ромб
  function shapeWord(c, W, H, S, m, sid, kind, txt, p = 1, t = 0) {
    const r = Math.min(W, H) * .38, k0 = p < 1 ? E.back(E.clamp(p)) : 1, stroke = m.mode === 'neon' || m.mode === 'line', col = m.mode === 'app' || m.mode === 'badge' ? S.c2 : kind === 'blob' ? m.b : kind === 'cloud' ? m.l : m.a;
    const draw = k => { k.save(); k.translate(W / 2, H / 2); k.scale(k0, k0); k.rotate(kind === 'diamond' ? 0 : .06 * Math.sin(t * 2)); k.beginPath();
      if (kind === 'scallop') { for (let i = 0; i <= 160; i++) { const a = i / 160 * TAU, q = r * (1 + .07 * Math.cos(a * 20)); i ? k.lineTo(Math.cos(a) * q, Math.sin(a) * q) : k.moveTo(q, 0); } k.closePath(); }
      else if (kind === 'blob') { for (let i = 0; i <= 120; i++) { const a = i / 120 * TAU, q = r * (1 + .12 * Math.sin(a * 3 + t * 2) + .06 * Math.cos(a * 5 - t * 3)); i ? k.lineTo(Math.cos(a) * q * 1.15, Math.sin(a) * q * .85) : k.moveTo(q * 1.15, 0); } k.closePath(); }
      else if (kind === 'cloud') { for (let i = 0; i <= 200; i++) { const a = i / 200 * TAU, q = r * (1 + .12 * Math.abs(Math.sin(a * 4))); i ? k.lineTo(Math.cos(a) * q * 1.2, Math.sin(a) * q * .8) : k.moveTo(q * 1.2, 0); } k.closePath(); }
      else { k.moveTo(0, -r * 1.05); k.lineTo(r * 1.25, 0); k.lineTo(0, r * 1.05); k.lineTo(-r * 1.25, 0); k.closePath(); }
      if (stroke) { under(k, m, S); k.strokeStyle = m.line; k.lineWidth = SW(W, H, m); k.shadowColor = m.line; k.shadowBlur = m.glow; k.stroke(); } else { k.fillStyle = m.mode === 'chrome' ? chromeFill(k, -r, r) : col; k.fill(); if (m.line && m.lw) { k.strokeStyle = m.line; k.lineWidth = m.lw * 2.2; k.stroke(); } }
      k.shadowBlur = 0; const size = fit(k, txt, S.font, r * 1.55, r * .6); k.font = `${size}px "${S.font}"`; k.textAlign = 'center'; k.textBaseline = 'middle'; k.rotate(-.06);
      k.fillStyle = stroke ? m.line : m.mode === 'app' || m.mode === 'badge' ? '#fff' : kind === 'cloud' ? (m.mode === 'retro' ? m.a : m.d) : m.mode === 'retro' ? '#F6E7C8' : m.d; k.fillText(txt, 0, size * .05); k.restore(); };
    finish(c, W, H, m, sid, draw, txt.length + 11);
  }
  // вертикальные элементы (высокий формат)
  function tallItem(c, W, H, S, m, sid, kind, txt, p = 1, t = 0) {
    const stroke = m.mode === 'neon' || m.mode === 'line', col = m.mode === 'app' || m.mode === 'badge' ? S.c1 : m.a, ink = stroke ? m.line : m.mode === 'app' || m.mode === 'badge' ? '#fff' : m.mode === 'retro' ? '#F6E7C8' : m.d, k0 = p < 1 ? E.out(E.clamp(p)) : 1;
    const draw = k => { k.save(); k.lineJoin = 'round'; if (m.glow) { k.shadowColor = m.line; k.shadowBlur = m.glow; }
      const paint = () => { if (stroke) { under(k, m, S); k.strokeStyle = m.line; k.lineWidth = SW(W, H, m) * 1.6; k.stroke(); } else { k.fillStyle = m.mode === 'chrome' ? chromeFill(k, 0, H) : col; k.fill(); if (m.line && m.lw) { k.strokeStyle = m.line; k.lineWidth = m.lw * 2.2; k.stroke(); } } k.shadowBlur = 0; };
      const letters = (y0, y1, x = W / 2) => { const ch = [...txt], step = (y1 - y0) / ch.length, size = Math.min(step * .82, W * .5); k.font = `${size}px "${S.font}"`; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillStyle = ink; ch.forEach((q, i) => k.fillText(q, x, y0 + step * (i + .5))); };
      if (kind === 'bookmark') { const w = W * .56, x = (W - w) / 2, h = H * .86 * k0, y = H * .06; k.beginPath(); k.moveTo(x, y); k.lineTo(x + w, y); k.lineTo(x + w, y + h); k.lineTo(W / 2, y + h - w * .35); k.lineTo(x, y + h); k.closePath(); paint(); if (k0 > .6) letters(y + h * .08, y + h * .78); }
      if (kind === 'arrowDown') { const y = H * .06 + (1 - k0) * -H * .2, bob = Math.sin(t * 5) * H * .015; k.translate(0, bob); const w = W * .42, x = (W - w) / 2; k.beginPath(); k.moveTo(x, y); k.lineTo(x + w, y); k.lineTo(x + w, H * .62); k.lineTo(W * .86, H * .62); k.lineTo(W / 2, H * .93); k.lineTo(W * .14, H * .62); k.lineTo(x, H * .62); k.closePath(); paint(); letters(y + H * .03, H * .6); }
      if (kind === 'thermo') { const w = W * .3, x = (W - w) / 2, y = H * .06, h = H * .7; k.beginPath(); g.rr(k, x, y, w, h, w / 2); k.moveTo(W / 2 + w * .9, y + h); k.arc(W / 2, y + h, w * .9, 0, TAU); if (stroke) { under(k, m, S); k.strokeStyle = m.line; k.lineWidth = SW(W, H, m) * 1.6; k.stroke(); } else { k.fillStyle = m.mode === 'retro' ? '#F6E7C8' : m.l || '#fff'; k.fill(); if (m.line && m.lw) { k.strokeStyle = m.line; k.lineWidth = m.lw * 2.2; k.stroke(); } }
        const lv = .82 * k0; k.beginPath(); g.rr(k, x + w * .22, y + h * (1 - lv), w * .56, h * lv + w * .3, w * .28); k.arc(W / 2, y + h, w * .64, 0, TAU); k.fillStyle = stroke ? m.line : col; k.fill(); k.shadowBlur = 0;
        const size = W * .11; k.font = `${size}px "${S.font}"`; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillStyle = stroke ? m.line : m.mode === 'retro' ? '#F6E7C8' : m.mode === 'app' || m.mode === 'badge' ? '#fff' : m.d; k.fillText(Math.round(100 * k0) + '%', W / 2, y + h + size * .05); }
      if (kind === 'hang') { const y = H * .3, w = W * .72, h = H * .62, x = (W - w) / 2, sw = Math.sin(t * 3) * .05; k.translate(W / 2, H * .04); k.rotate(sw); k.translate(-W / 2, -H * .04);
        k.beginPath(); k.moveTo(W / 2, H * .04); k.lineTo(W / 2, y + w * .2); k.strokeStyle = stroke ? m.line : m.d; k.lineWidth = 5; k.stroke();
        k.beginPath(); k.moveTo(x + w * .5, y); k.lineTo(x + w, y + w * .3); k.lineTo(x + w, y + h); k.lineTo(x, y + h); k.lineTo(x, y + w * .3); k.closePath(); paint(); k.beginPath(); k.arc(W / 2, y + w * .22, w * .07, 0, TAU); k.fillStyle = stroke ? m.line : m.d; if (stroke) k.stroke(); else k.fill(); letters(y + w * .4, y + h * .95); }
      k.restore(); };
    finish(c, W, H, m, sid, draw, txt.length + 17);
  }
  // рамки под фото: полароид и телефон (прозрачное окно)
  function frameItem(c, W, H, S, m, sid, kind) {
    const stroke = m.mode === 'neon' || m.mode === 'line';
    const draw = k => { k.save(); if (m.glow) { k.shadowColor = m.line; k.shadowBlur = m.glow; }
      if (kind === 'polaroid') { const w = W * .82, h = H * .9, x = (W - w) / 2, y = (H - h) / 2; k.beginPath(); k.rect(x, y, w, h); const iw = w * .86, ih = h * .72; k.rect(x + (w - iw) / 2, y + (w - iw) / 2, iw, ih);
        if (stroke) { k.strokeStyle = m.line; k.lineWidth = SW(W, H, m) * 1.4; k.stroke(); } else { k.fillStyle = m.mode === 'retro' ? '#F6E7C8' : m.mode === 'grunge' ? S.c3 : m.l || '#fff'; k.fill('evenodd'); if (m.line && m.lw) { k.strokeStyle = m.line; k.lineWidth = m.lw * 1.6; k.stroke(); } } }
      else { const w = W * .78, h = H * .92, x = (W - w) / 2, y = (H - h) / 2, r = w * .14; k.beginPath(); g.rr(k, x, y, w, h, r); const b = w * .05; g.rr(k, x + b, y + b, w - b * 2, h - b * 2, r * .75);
        if (stroke) { k.strokeStyle = m.line; k.lineWidth = SW(W, H, m) * 1.4; k.stroke(); } else { k.fillStyle = m.mode === 'chrome' ? chromeFill(k, y, y + h) : m.mode === 'app' || m.mode === 'badge' ? S.ink : m.a; k.fill('evenodd'); if (m.line && m.lw) { k.strokeStyle = m.line; k.lineWidth = m.lw * 1.6; k.stroke(); } }
        k.shadowBlur = 0; k.fillStyle = stroke ? m.line : S.ink; k.beginPath(); g.rr(k, W / 2 - w * .16, y + b * 1.6, w * .32, w * .085, w * .04); k.fill(); }
      k.restore(); };
    if (m.mode === 'sticker' || m.mode === 'chrome') draw(c); else finish(c, W, H, m, sid, draw, 2);
  }

  /* ---------- состав нового в каждом стиле ---------- */
  const DOODLES = [['swirl', 'Спираль'], ['squiggle', 'Волна-каракуля'], ['emphasis', 'Акцент-лучики'], ['sparks', 'Тройная искра'], ['hearts', 'Три сердечка'], ['confetti', 'Конфетти-взрыв']];
  const ARROW_LIST = [['zigzag', 'Стрелка зигзаг'], ['loop', 'Стрелка с петлёй'], ['wave', 'Стрелка волной'], ['down', 'Стрелка вниз'], ['spiral', 'Стрелка из спирали'], ['long', 'Длинная стрелка']];
  const SHAPES = [['scallop', 'Волнистый бейдж'], ['blob', 'Клякса'], ['cloud', 'Облачко'], ['diamond', 'Ромб']];
  const NUMS = [['1', 'circle'], ['2', 'circle'], ['3', 'circle'], ['ТОП-1', 'burst'], ['№1', 'scallop'], ['100%', 'square']];
  const TALL = [['bookmark', 'Закладка'], ['arrowDown', 'Стрелка вниз «%»'], ['thermo', 'Шкала 100%'], ['hang', 'Бирка на верёвочке']];

  function iconList(sid) { const t = TH[sid], out = []; for (const n of t.icons.concat(ICON_ALL)) if (I[n] && !out.includes(n)) out.push(n); return out.slice(0, 34); }
  const slug = s => s.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '');

  function extend(sid) {
    const st = ST[sid], t = TH[sid]; if (!st || !t) return;
    const M = S => mat(sid, S), icons = iconList(sid), W5 = t.words, shapesTxt = [t.words[2], t.words[6], t.words[4], t.words[9]];
    const png = [];
    icons.forEach((n, i) => png.push(P('i-' + n, ICON_RU[n] || n, (c, W, H, S) => iconItem(c, W, H, S, M(S), sid, n, i))));
    W5.forEach((w, i) => png.push(P('w-' + (i + 1), 'Слово «' + w + '»', (c, W, H, S) => word(c, W, H, S, M(S), sid, w, { tilt: [-.07, .05, -.03, .07, -.05, .03, -.06, .06, -.04, .04][i], col: [null, 'b', null, 'c', null, 'b', null, 'c', null, 'b'][i] && M(S)[[null, 'b', null, 'c', null, 'b', null, 'c', null, 'b'][i]] }), { w: 1600, h: 700 })));
    t.stamps.forEach((s, i) => png.push(P('st-' + (i + 1), 'Печать «' + s.split('•')[0].trim() + '»', (c, W, H, S) => stamp(c, W, H, S, M(S), sid, s, icons[i]))));
    t.ribbons.forEach((s, i) => png.push(P('rb-' + (i + 1), 'Лента «' + s + '»', (c, W, H, S) => ribbon(c, W, H, S, M(S), sid, s), { w: 1800, h: 520 })));
    NUMS.forEach(([s, sh], i) => png.push(P('n-' + (i + 1), 'Бейдж «' + s + '»', (c, W, H, S) => number(c, W, H, S, M(S), sid, s, sh))));
    ARROW_LIST.forEach(([k, n], i) => png.push(P('ar-' + k, n + (i === 5 ? ' пунктир' : ''), (c, W, H, S) => arrowItem(c, W, H, S, M(S), sid, k, 1, i === 5), k === 'long' || k === 'wave' ? { w: 1600, h: 900 } : null)));
    DOODLES.forEach(([k, n]) => png.push(P('dd-' + k, n, (c, W, H, S) => doodleItem(c, W, H, S, M(S), sid, k))));
    SHAPES.forEach(([k, n], i) => png.push(P('sh-' + k, n + ' «' + shapesTxt[i] + '»', (c, W, H, S) => shapeWord(c, W, H, S, M(S), sid, k, shapesTxt[i]), k === 'cloud' || k === 'blob' ? { w: 1400, h: 1000 } : null)));
    TALL.forEach(([k, n], i) => { const txt = k === 'thermo' ? '' : t.tall[i % 2] + (k === 'hang' ? '!' : ''); png.push(P('tl-' + k, k === 'thermo' ? n : n.replace('«%»', '') + (txt ? ' «' + txt + '»' : ''), (c, W, H, S) => tallItem(c, W, H, S, M(S), sid, k, txt), { w: 600, h: 1500 })); });
    png.push(P('fr-polaroid', 'Рамка-полароид', (c, W, H, S) => frameItem(c, W, H, S, M(S), sid, 'polaroid'), { w: 1000, h: 1200 }));
    png.push(P('fr-phone', 'Рамка-телефон', (c, W, H, S) => frameItem(c, W, H, S, M(S), sid, 'phone'), { w: 900, h: 1700 }));
    st.png = st.png.concat(png.filter(x => !st.png.some(y => y.id === x.id))).slice(0, 100);

    /* анимации: 42 новые */
    const pop = (draw) => (c, W, H, S, tt) => { const p = E.clamp(tt / .45), k = E.back(p), fl = Math.sin(tt * Math.PI) * H * .02 * E.clamp(tt * 3 - 1), r = Math.sin(tt * Math.PI * 1.5) * .05 * E.clamp(tt * 3 - 1);
      c.save(); c.translate(W / 2, H / 2 + fl); c.rotate(r); c.scale(k, k); c.translate(-W / 2, -H / 2); draw(c, W, H, S, 1, tt); c.restore(); };
    const slam = (draw) => (c, W, H, S, tt) => { const p = E.clamp(tt / .3), k = 1 + 1.6 * Math.pow(1 - p, 2), sh = tt > .3 && tt < .55 ? Math.sin(tt * 90) * W * .01 * (1 - (tt - .3) / .25) : 0;
      c.save(); c.globalAlpha = E.clamp(p * 2); c.translate(W / 2 + sh, H / 2); c.rotate(-.25 * (1 - p)); c.scale(k, k); c.translate(-W / 2, -H / 2); draw(c, W, H, S, 1, tt); c.restore(); };
    const wiggle = (draw) => (c, W, H, S, tt) => { const p = E.clamp(tt / .35), k = E.back(p); c.save(); c.translate(W / 2, H / 2); c.rotate(Math.sin(tt * 9) * .09 * E.clamp(tt * 2)); c.scale(k * (1 + .04 * Math.sin(tt * 12)), k); c.translate(-W / 2, -H / 2); draw(c, W, H, S, 1, tt); c.restore(); };
    const pulse = (draw) => (c, W, H, S, tt) => { const p = E.clamp(tt / .4), k = E.back(p) * (1 + .08 * Math.max(0, Math.sin((tt - .4) * 8))); c.save(); c.translate(W / 2, H / 2); c.scale(k, k); c.translate(-W / 2, -H / 2); draw(c, W, H, S, 1, tt); c.restore(); };
    const spinIn = (draw) => (c, W, H, S, tt) => { const p = E.clamp(tt / .6), k = E.back(p); c.save(); c.translate(W / 2, H / 2); c.rotate((1 - E.out(p)) * -TAU * .5 + Math.sin(tt * 2) * .04); c.scale(k, k); c.translate(-W / 2, -H / 2); draw(c, W, H, S, 1, tt); c.restore(); };
    const wipe = (draw) => (c, W, H, S, tt) => { const p = E.inOut(E.clamp(tt / .7)); c.save(); c.beginPath(); c.rect(0, 0, W * p, H); c.clip(); draw(c, W, H, S, 1, tt); c.restore(); };
    const anims = [pop, wiggle, pulse, spinIn, pop, slam, wiggle];
    const AN_NAMES = { [pop.name]: 'выскакивает', [wiggle.name]: 'качается', [pulse.name]: 'пульсирует', [spinIn.name]: 'влетает с поворотом', [slam.name]: 'бьёт печатью', [wipe.name]: 'проявляется' };
    const an = [];
    icons.slice(0, 14).forEach((n, i) => { const fx = anims[i % anims.length]; an.push(A('ai-' + n, (ICON_RU[n] || n) + ' ' + AN_NAMES[fx.name], fx((c, W, H, S) => iconItem(c, W, H, S, M(S), sid, n, i)))); });
    W5.slice(0, 6).forEach((w, i) => { const fx = [slam, pop, wiggle, wipe, pulse, slam][i]; an.push(A('aw-' + (i + 1), 'Слово «' + w + '» ' + AN_NAMES[fx.name], fx((c, W, H, S) => word(c, W, H, S, M(S), sid, w, { tilt: i % 2 ? .05 : -.06 })))); });
    t.stamps.slice(0, 2).forEach((s, i) => an.push(A('ast-' + (i + 1), 'Печать «' + s.split('•')[0].trim() + '» ставится', (c, W, H, S, tt) => stamp(c, W, H, S, M(S), sid, s, icons[i], E.clamp(tt / .35), tt > .35 ? (tt - .35) * .15 : 0))));
    t.ribbons.slice(0, 3).forEach((s, i) => an.push(A('arb-' + (i + 1), 'Лента «' + s + '» разворачивается', (c, W, H, S, tt) => { const h = W * .32; c.save(); c.translate(0, (H - h) / 2); ribbon(c, W, h, S, M(S), sid, s, E.clamp(tt / .5)); c.restore(); })));
    NUMS.slice(3, 6).forEach(([s, sh], i) => an.push(A('an-' + (i + 1), 'Бейдж «' + s + '» выскакивает', (c, W, H, S, tt) => { const k = 1 + .06 * Math.max(0, Math.sin((tt - .5) * 8)); c.save(); c.translate(W / 2, H / 2); c.scale(k, k); c.translate(-W / 2, -H / 2); number(c, W, H, S, M(S), sid, s === '100%' ? Math.round(100 * E.out(E.clamp(tt / 1.2))) + '%' : s, sh, E.clamp(tt / .4)); c.restore(); })));
    ARROW_LIST.forEach(([k, n], i) => an.push(A('aar-' + k, n + ' рисуется', (c, W, H, S, tt) => arrowItem(c, W, H, S, M(S), sid, k, E.clamp(tt / .9), i === 5))));
    [['swirl', 'Спираль закручивается'], ['squiggle', 'Каракуля рисуется'], ['sparks', 'Искры мерцают'], ['confetti', 'Конфетти разлетается']].forEach(([k, n]) => an.push(A('add-' + k, n, (c, W, H, S, tt) => doodleItem(c, W, H, S, M(S), sid, k, E.clamp(tt / .8), tt))));
    [['blob', 'Клякса живая'], ['scallop', 'Бейдж-волна выскакивает']].forEach(([k, n], i) => an.push(A('ash-' + k, n + ' «' + shapesTxt[i ? 0 : 1] + '»', (c, W, H, S, tt) => shapeWord(c, W, H, S, M(S), sid, k, shapesTxt[i ? 0 : 1], E.clamp(tt / .45), tt))));
    an.push(A('atl-arrow', 'Стрелка вниз «' + t.tall[0] + '» прыгает', (c, W, H, S, tt) => { const w = W * .4; c.save(); c.translate((W - w) / 2, 0); tallItem(c, w, H, S, M(S), sid, 'arrowDown', t.tall[0], E.clamp(tt / .4), tt); c.restore(); }));
    an.push(A('atl-thermo', 'Шкала заполняется', (c, W, H, S, tt) => { const w = W * .4; c.save(); c.translate((W - w) / 2, 0); tallItem(c, w, H, S, M(S), sid, 'thermo', '', E.clamp(tt / 1.3), tt); c.restore(); }));
    st.an = st.an.concat(an.filter(x => !st.an.some(y => y.id === x.id))).slice(0, 50);

    /* плашки под текст: +4, в том числе полупрозрачные */
    const tx = [
      P('x-glass', 'Стекло полупрозрачное', (c, W, H, S) => { const w = W * .9, h = H * .6, x = (W - w) / 2, y = (H - h) / 2; c.fillStyle = 'rgba(255,255,255,.2)'; rrect(c, x, y, w, h, h * .28); c.fill(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 3; c.stroke();
        const gr = c.createLinearGradient(0, y, 0, y + h * .5); gr.addColorStop(0, 'rgba(255,255,255,.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; rrect(c, x + 6, y + 6, w - 12, h * .45, h * .24); c.fill(); }),
      P('x-shade', 'Тёмная полупрозрачная', (c, W, H, S) => { const w = W * .9, h = H * .56, x = (W - w) / 2, y = (H - h) / 2; c.fillStyle = hexA(S.ink, .55); rrect(c, x, y, w, h, h / 2); c.fill(); c.fillStyle = S.c1; rrect(c, x + h * .2, y + h * .3, h * .08, h * .4, h * .04); c.fill(); }),
      P('x-fade', 'Градиент в прозрачность', (c, W, H, S) => { const w = W * .96, h = H * .5, x = (W - w) / 2, y = (H - h) / 2, gr = c.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, hexA(S.c1, .95)); gr.addColorStop(.55, hexA(S.c1, .6)); gr.addColorStop(1, hexA(S.c1, 0)); c.fillStyle = gr; c.fillRect(x, y, w, h); c.fillStyle = S.ink; c.fillRect(x, y, h * .07, h); }),
      P('x-outline', 'Контур с лёгкой заливкой', (c, W, H, S) => { const w = W * .88, h = H * .58, x = (W - w) / 2, y = (H - h) / 2; c.fillStyle = hexA(S.c2, .16); rrect(c, x, y, w, h, h * .18); c.fill(); c.strokeStyle = S.c1; c.lineWidth = 8; c.stroke();
        c.fillStyle = S.c1; [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([px, py]) => { c.beginPath(); c.arc(px, py, 14, 0, TAU); c.fill(); }); })
    ];
    st.tx = st.tx.concat(tx.filter(x => !st.tx.some(y => y.id === x.id))).slice(0, 10);

    /* фоны: +4 */
    const bg = [
      P('x-mesh', 'Мягкий градиент-меш', (c, W, H, S) => { c.fillStyle = mix(S.ink, '#000', .1); if (m0(sid).light) c.fillStyle = '#FBF8F3'; c.fillRect(0, 0, W, H); L.blobs(c, W, H, [hexA(S.c1, .75), hexA(S.c2, .7), hexA(S.c3, .65), hexA(S.c1, .5)], { seed: 7 }); L.noise(c, W, H, 0, { n: W * H / 500, alpha: .05 }); }),
      P('x-pattern', 'Узор из иконок стиля', (c, W, H, S) => { c.fillStyle = m0(sid).light ? mix(S.c2, '#ffffff', .55) : S.ink; c.fillRect(0, 0, W, H); const s = Math.min(W, H) * .16, ic = icons.slice(0, 6), m = Object.assign(mat(sid, S), { mode: 'line', line: m0(sid).light ? hexA(S.c1, .55) : hexA(S.c1, .35), lw: 4, glow: 0 });
        let n = 0; for (let y = s * .6; y < H + s; y += s * 1.5) for (let x = (Math.round(y / s) % 2) * s * .75 + s * .5; x < W + s; x += s * 1.5) { c.save(); c.translate(x, y); c.rotate(((n * 37) % 11 - 5) * .05); icon(c, ic[n % ic.length], s * .8, m); c.restore(); n++; } }),
      P('x-glow', 'Свечение из центра', (c, W, H, S) => { c.fillStyle = S.ink; c.fillRect(0, 0, W, H); const gr = c.createRadialGradient(W / 2, H * .42, 0, W / 2, H * .42, Math.hypot(W, H) * .55); gr.addColorStop(0, hexA(S.c1, .85)); gr.addColorStop(.45, hexA(S.c3, .35)); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, W, H); L.noise(c, W, H, 0, { n: W * H / 600, alpha: .06 }); }),
      P('x-frame', 'Фон с рамкой', (c, W, H, S) => { c.fillStyle = m0(sid).light ? '#FBF8F3' : S.c1; c.fillRect(0, 0, W, H); const b = Math.min(W, H) * .06; c.strokeStyle = m0(sid).light ? S.c1 : S.ink; c.lineWidth = b * .35; c.strokeRect(b, b, W - b * 2, H - b * 2); c.lineWidth = b * .1; c.strokeRect(b * 1.6, b * 1.6, W - b * 3.2, H - b * 3.2);
        const m = Object.assign(mat(sid, S), { mode: 'line', line: m0(sid).light ? S.c1 : S.ink, lw: 4, glow: 0 }); [[b * 2.8, b * 2.8], [W - b * 2.8, b * 2.8], [b * 2.8, H - b * 2.8], [W - b * 2.8, H - b * 2.8]].forEach(([x, y], i) => { c.save(); c.translate(x, y); icon(c, ['star', 'sparkles', 'sparkles', 'star'][i], b * 2.2, m); c.restore(); }); })
    ];
    st.bg = st.bg.concat(bg.filter(x => !st.bg.some(y => y.id === x.id))).slice(0, 10);

    /* оверлеи: +6 */
    const ovs = [
      A('x-float', 'Иконки стиля всплывают', (c, W, H, S, tt) => { const R = rnd(13), s = Math.min(W, H), ic = icons.slice(0, 8), m = mat(sid, S); for (let i = 0; i < 16; i++) { const x0 = R() * W, ph = R(), sz = s * (.07 + R() * .06), f = ((tt / 3) + ph) % 1, y = H + sz - f * (H + sz * 2), x = x0 + Math.sin(f * TAU * 2 + i) * W * .03;
        c.save(); c.globalAlpha = Math.min(1, Math.sin(f * Math.PI) * 1.6) * .9; c.translate(x, y); c.rotate(Math.sin(f * TAU + i) * .3); if (m.mode === 'app' || m.mode === 'badge') icon(c, ic[i % ic.length], sz, Object.assign({}, m, { mode: 'line', line: '#fff', lw: 5 })); else icon(c, ic[i % ic.length], sz, m, i); c.restore(); } }, 3),
      A('x-confetti', 'Конфетти падает', (c, W, H, S, tt) => { const R = rnd(17), s = Math.min(W, H), cols = [S.c1, S.c2, S.c3, '#ffffff']; for (let i = 0; i < 110; i++) { const x0 = R() * W, ph = R(), z = s * (.008 + R() * .012), sp = .7 + R() * .6, f = ((tt / 3) * sp + ph) % 1, y = -z * 3 + f * (H + z * 6), x = x0 + Math.sin(f * TAU * 3 + i) * W * .02;
        c.save(); c.translate(x, y); c.rotate(f * TAU * 4 * (i % 2 ? 1 : -1)); c.scale(1, Math.cos(f * TAU * 6 + i)); c.fillStyle = cols[i % 4]; i % 4 === 3 ? (c.beginPath(), c.arc(0, 0, z * .7, 0, TAU), c.fill()) : c.fillRect(-z, -z * .45, z * 2, z * .9); c.restore(); } }, 3),
      A('x-twinkle', 'Искры мерцают по кадру', (c, W, H, S, tt) => { const R = rnd(19), s = Math.min(W, H); for (let i = 0; i < 26; i++) { const x = R() * W, y = R() * H, ph = R(), z = s * (.015 + R() * .03), a = Math.pow(Math.max(0, Math.sin((tt / 3 + ph) * TAU * 2)), 3);
        if (a < .02) continue; c.save(); c.globalAlpha = a; c.translate(x, y); c.rotate(ph * 3); c.fillStyle = i % 3 ? '#fff' : S.c1; c.shadowColor = S.c1; c.shadowBlur = z; c.beginPath(); g.star(c, 0, 0, z * (.6 + a * .4), 4, .2); c.fill(); c.restore(); } }, 3),
      A('x-bokeh', 'Боке в цветах стиля', (c, W, H, S, tt) => { const R = rnd(23), s = Math.max(W, H), cols = [S.c1, S.c2, S.c3]; c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 22; i++) { const ph = R() * TAU, x = R() * W + Math.cos(tt / 3 * TAU + ph) * W * .04, y = R() * H + Math.sin(tt / 3 * TAU + ph) * H * .03, r = s * (.03 + R() * .07);
        const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, hexA(cols[i % 3], .55)); gr.addColorStop(.7, hexA(cols[i % 3], .3)); gr.addColorStop(1, hexA(cols[i % 3], 0)); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); } c.globalCompositeOperation = 'source-over'; }, 3),
      A('x-leak', 'Засветка в цветах стиля', (c, W, H, S, tt) => L.leak(c, W, H, tt, { colors: [hexA(S.c1, .85), hexA(S.c3, .6), hexA(S.c2, .65)], loop: 3 }), 3),
      A('x-frame', 'Бегущая рамка', (c, W, H, S, tt) => { const b = Math.min(W, H) * .045; c.strokeStyle = S.c1; c.lineWidth = b * .35; c.setLineDash([b * 1.4, b * .9]); c.lineDashOffset = -tt * b * 8; if (TH[sid].mode === 'neon') { c.shadowColor = S.c1; c.shadowBlur = 20; } c.strokeRect(b, b, W - b * 2, H - b * 2); c.setLineDash([]); c.shadowBlur = 0;
        const L2 = b * 3; c.lineWidth = b * .5; c.strokeStyle = S.c2; [[b * .4, b * .4, 1, 1], [W - b * .4, b * .4, -1, 1], [b * .4, H - b * .4, 1, -1], [W - b * .4, H - b * .4, -1, -1]].forEach(([x, y, dx, dy]) => { const pl = L2 * (.8 + .2 * Math.sin(tt * 4)); c.beginPath(); c.moveTo(x, y + dy * pl); c.lineTo(x, y); c.lineTo(x + dx * pl, y); c.stroke(); }); }, 3)
    ];
    st.ov = st.ov.concat(ovs.filter(x => !st.ov.some(y => y.id === x.id))).slice(0, 10);

    /* переходы: +4 */
    const trs = [
      A('x-icon', 'Иконка стиля на весь кадр', (c, W, H, S, p) => { const ic = icons[0], R = Math.hypot(W, H) * 3.2, k = p < .5 ? E.inOut(p / .5) : 1 - E.inOut((p - .5) / .5), m = { mode: 'mono', a: S.c1, b: S.c1, c: S.c1, d: S.c1, l: S.c1, w: S.c1 };
        c.save(); c.translate(W / 2, H / 2); c.rotate((p - .5) * .6); icon(c, ic, R * k, m, 0, { fg: S.c1, bg: S.c1 }); c.restore(); if (k > .97) { c.fillStyle = S.c1; c.fillRect(0, 0, W, H); } }, 1),
      A('x-brush', 'Мазки кистью', (c, W, H, S, p) => { const cols = [S.c1, S.c2, S.ink], D = Math.hypot(W, H); for (let i = 0; i < 3; i++) { const a = p < .5 ? E.inOut(E.clamp((p - i * .06) / .3)) : 1, b = p < .5 ? 0 : E.inOut(E.clamp((p - .5 - i * .06) / .3));
        if (a <= b) continue; const y0 = -H * .1 + i * H * .4, y1 = y0 + H * .5, R = rnd(i + 3); c.strokeStyle = cols[i]; c.lineCap = 'round'; c.lineWidth = Math.max(W, H) * .55; c.beginPath(); const n = 30; for (let q = Math.round(b * n); q <= Math.round(a * n); q++) { const f = q / n; c.lineTo(-W * .3 + f * W * 1.6, y0 + (y1 - y0) * f + (R() - .5) * H * .02); } c.stroke(); } }, 1),
      A('x-dots', 'Точки заполняют кадр', (c, W, H, S, p) => { const s = Math.min(W, H) / 7, k = p < .5 ? E.inOut(p / .5) : 1 - E.inOut((p - .5) / .5); c.fillStyle = S.c1; for (let y = 0; y < H + s; y += s) for (let x = 0; x < W + s; x += s) { const d = Math.hypot(x - W / 2, y - H / 2) / Math.hypot(W, H), r = s * .75 * E.clamp(k * 1.6 - d * .8); if (r > 0) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); } } }, 1),
      A('x-split', 'Две шторки по диагонали', (c, W, H, S, p) => { const k = p < .5 ? E.inOut(p / .5) : 1 - E.inOut((p - .5) / .5), D = Math.hypot(W, H); c.save(); c.translate(W / 2, H / 2); c.rotate(-.5); c.fillStyle = S.c1; c.fillRect(-D, -D, D, D * 2 * 1); c.restore();
        c.clearRect(0, 0, W, H); c.save(); c.translate(W / 2, H / 2); c.rotate(-.5); c.fillStyle = S.c1; c.fillRect(-D - D * (1 - k), -D, D, D * 2); c.fillStyle = S.c2; c.fillRect(D * (1 - k), -D, D, D * 2); c.restore(); }, 1)
    ];
    st.tr = st.tr.concat(trs.filter(x => !st.tr.some(y => y.id === x.id))).slice(0, 10);
  }
  // светлый ли стиль (для фонов)
  function m0(sid) { return { light: ['ios', 'romance', 'doodle', 'scrap', 'lux', 'expert', 'eco', 'y2k'].includes(sid) }; }

  Object.keys(TH).forEach(extend);

  /* ---------- текстуры: +4 живых, итого 10 ---------- */
  const tex = ST.tex;
  if (tex) {
    const more = [
      A('flicker', 'Плёнка: мерцание и виньетка', (c, W, H, S, tt) => { const R = rnd(Math.floor(tt * 24) + 5), a = .1 + R() * .12; c.fillStyle = `rgba(255,240,220,${a})`; c.fillRect(0, 0, W, H); const gr = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.hypot(W, H) * .6); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); c.fillStyle = gr; c.fillRect(0, 0, W, H); L.noise(c, W, H, tt, { n: W * H / 260, alpha: .35 }); }, 3),
      A('chroma', 'Цветной шум', (c, W, H, S, tt) => { const R = rnd(Math.floor(tt * 30) + 9), cols = ['#ff3050', '#30ff90', '#3070ff']; for (let i = 0; i < W * H / 60; i++) { c.globalAlpha = .25 + R() * .75; c.fillStyle = cols[i % 3]; const s = 1.5 + R() * 2.5; c.fillRect(R() * W, R() * H, s, s); } c.globalAlpha = 1; }, 3),
      A('halftone', 'Полутон пульсирует', (c, W, H, S, tt) => { const s = Math.min(W, H) / 46; c.fillStyle = '#fff'; for (let y = 0; y < H + s; y += s) for (let x = (Math.round(y / s) % 2) * s / 2; x < W + s; x += s) { const v = .5 + .5 * Math.sin(x / W * 6 + y / H * 4 + tt / 3 * TAU), r = s * .42 * v; if (r > .6) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); } } }, 3),
      A('crt', 'Экран ЭЛТ: маска и строки', (c, W, H, S, tt) => { const s = 6; for (let x = 0; x < W; x += s) { c.fillStyle = ['rgba(255,40,40,.35)', 'rgba(40,255,80,.35)', 'rgba(40,90,255,.35)'][(x / s) % 3]; c.fillRect(x, 0, s - 2, H); } c.fillStyle = 'rgba(0,0,0,.55)'; for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 2);
        const by = ((tt / 3) % 1) * H; const gr = c.createLinearGradient(0, by - H * .08, 0, by + H * .08); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, by - H * .08, W, H * .16); }, 3)
    ];
    tex.ov = tex.ov.concat(more.filter(x => !tex.ov.some(y => y.id === x.id)));
  }
  G.KK_TH = TH;
})(window);

/* ---- styles5.js ---- */
/* Расширение «Текстур» до 50 фактур (bg) и 50 живых текстур (ov). Универсальные: кладутся поверх любого видео
   с режимом наложения («Перекрытие», «Умножение», «Экран»). Живые на чёрном — для «Экрана» (список KK_SCREEN). */
(function (G) {
  const { L, rnd, TAU } = G.KKL;
  const ST = G.KKSTYLES, tex = ST.tex; if (!tex) return;
  const P = (id, name, draw) => ({ id, name, draw });
  const A = (id, name, draw, dur = 3) => ({ id, name, draw, dur });
  const fill = (c, W, H, col) => { c.fillStyle = col; c.fillRect(0, 0, W, H); };
  const noise = (c, W, H, col, a, size, seed, n) => L.noise(c, W, H, 0, { color: col, alpha: a, size, seed, n: n || Math.round(W * H / 500) });
  // облачная неровность: шум крупной сетки, растянутый со сглаживанием
  const cloud = (c, W, H, rgb, a, seed, scale = .12) => { const R = rnd(seed); [scale, scale / 2, scale / 4].forEach((sc, o) => { const step = Math.max(4, Math.round(Math.max(W, H) * sc)), w = Math.ceil(W / step) + 2, h = Math.ceil(H / step) + 2, t = document.createElement('canvas'); t.width = w; t.height = h;
    const x = t.getContext('2d'), d = x.createImageData(w, h); for (let i = 0; i < w * h; i++) { d.data[i * 4] = rgb[0]; d.data[i * 4 + 1] = rgb[1]; d.data[i * 4 + 2] = rgb[2]; d.data[i * 4 + 3] = Math.pow(R(), 2) * 255 * a / (o + 1); } x.putImageData(d, 0, 0);
    c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(t, -step, -step, w * step, h * step); c.restore(); }); };
  const fibers = (c, W, H, col, n, seed, len = 30) => { const R = rnd(seed); c.strokeStyle = col; for (let i = 0; i < n; i++) { const x = R() * W, y = R() * H, a = R() * TAU, l = 6 + R() * len; c.lineWidth = .6 + R(); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); } };
  const folds = (c, W, H, n, seed, light = .35, dark = .12) => { const R = rnd(seed); for (let i = 0; i < n; i++) { const x0 = R() * W, y0 = R() * H, a = R() * TAU, len = Math.max(W, H) * (.3 + R() * .6), x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
    c.lineWidth = 2 + R() * 3; c.strokeStyle = `rgba(255,255,255,${light})`; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.strokeStyle = `rgba(0,0,0,${dark})`; c.beginPath(); c.moveTo(x0 + 3, y0 + 3); c.lineTo(x1 + 3, y1 + 3); c.stroke(); } };
  const grad = (c, W, H, stops, ang = .9) => { const g = c.createLinearGradient(0, 0, W * Math.cos(ang), H * Math.sin(ang)); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); c.fillStyle = g; c.fillRect(0, 0, W, H); };
  const rg = (c, x, y, r, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
  const grainGrad = (cols, seed) => (c, W, H) => { const R = rnd(seed); fill(c, W, H, cols[0]); cols.slice(1).forEach((col, i) => rg(c, W * (.2 + R() * .6), H * (.15 + R() * .7), Math.max(W, H) * (.45 + R() * .3), col)); noise(c, W, H, '#fff', .2, 1.6, seed + 1, W * H / 90); noise(c, W, H, '#000', .18, 1.6, seed + 2, W * H / 90); };

  const bg = [
    P('aged', 'Старая бумага', (c, W, H) => { fill(c, W, H, '#e8d9b5'); cloud(c, W, H, [150, 110, 50], .5, 101); rg(c, W / 2, H / 2, Math.hypot(W, H) * .6, 'rgba(0,0,0,0)'); const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.hypot(W, H) * .6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(90,55,15,.45)'); c.fillStyle = g; c.fillRect(0, 0, W, H); noise(c, W, H, '#5a3a10', .18, 1.6, 102); }),
    P('parchment', 'Пергамент', (c, W, H) => { fill(c, W, H, '#efdcb0'); cloud(c, W, H, [180, 130, 60], .7, 103, .08); fibers(c, W, H, 'rgba(120,80,30,.12)', 1500, 104); noise(c, W, H, '#6b4a1a', .16, 1.8, 105); }),
    P('rice', 'Рисовая бумага', (c, W, H) => { fill(c, W, H, '#f7f4ec'); fibers(c, W, H, 'rgba(160,150,130,.25)', 4000, 106, 60); cloud(c, W, H, [210, 200, 180], .3, 107); noise(c, W, H, '#8a7a5a', .08, 1.4, 108); }),
    P('watercolor', 'Акварельная бумага', (c, W, H) => { fill(c, W, H, '#fbf9f4'); cloud(c, W, H, [190, 180, 160], .35, 109, .03); noise(c, W, H, '#000', .1, 3, 110, W * H / 200); }),
    P('black-paper', 'Чёрная бумага', (c, W, H) => { fill(c, W, H, '#151414'); cloud(c, W, H, [60, 60, 60], .35, 111); fibers(c, W, H, 'rgba(255,255,255,.05)', 1500, 112); noise(c, W, H, '#fff', .1, 1.5, 113); }),
    P('pink-paper', 'Розовая бумага', (c, W, H) => { fill(c, W, H, '#f6c9cf'); cloud(c, W, H, [220, 150, 160], .35, 114); fibers(c, W, H, 'rgba(160,80,100,.12)', 1500, 115); noise(c, W, H, '#7a3040', .1, 1.5, 116); }),
    P('blue-paper', 'Голубая бумага', (c, W, H) => { fill(c, W, H, '#bcd6ee'); cloud(c, W, H, [120, 160, 200], .35, 117); fibers(c, W, H, 'rgba(40,70,110,.12)', 1500, 118); noise(c, W, H, '#20304a', .1, 1.5, 119); }),
    P('tracing', 'Калька', (c, W, H) => { fill(c, W, H, '#eef0ef'); cloud(c, W, H, [255, 255, 255], .6, 120, .2); noise(c, W, H, '#888', .06, 1.2, 121); }),
    P('crumpled-black', 'Мятая чёрная бумага', (c, W, H) => { fill(c, W, H, '#1a1a1a'); cloud(c, W, H, [80, 80, 80], .4, 122, .05); folds(c, W, H, 50, 123, .12, .4); noise(c, W, H, '#fff', .08, 1.5, 124); }),
    P('kraft-dark', 'Тёмный крафт', (c, W, H) => { fill(c, W, H, '#8a6440'); cloud(c, W, H, [50, 30, 10], .4, 125); fibers(c, W, H, 'rgba(40,25,10,.3)', 2500, 126); noise(c, W, H, '#2a1a08', .22, 2, 127); }),
    P('foil-silver', 'Мятая фольга', (c, W, H) => { grad(c, W, H, ['#8d9198', '#e9ecf0', '#7c8088', '#f4f6f8', '#9a9ea6']); folds(c, W, H, 120, 128, .55, .35); noise(c, W, H, '#fff', .15, 1.4, 129); }),
    P('foil-gold', 'Золотая фольга', (c, W, H) => { grad(c, W, H, ['#8a6420', '#f7d77a', '#a87a24', '#fff0b0', '#9a6c1c']); folds(c, W, H, 120, 130, .5, .35); noise(c, W, H, '#fff', .12, 1.4, 131); }),
    P('holo', 'Голограмма', (c, W, H) => { grad(c, W, H, ['#ffc6f0', '#b6f0ff', '#d8c6ff', '#c6ffe0', '#ffe6b6', '#ffc6f0'], .6); folds(c, W, H, 40, 132, .5, .1); noise(c, W, H, '#fff', .25, 1.5, 133); }),
    P('chalkboard', 'Грифельная доска', (c, W, H) => { fill(c, W, H, '#2c3330'); cloud(c, W, H, [200, 210, 200], .12, 134, .15); noise(c, W, H, '#fff', .08, 1.6, 135); }),
    P('brick', 'Кирпичная стена', (c, W, H) => { fill(c, W, H, '#c9c2b6'); const bw = Math.round(Math.min(W, H) * .2), bh = Math.round(bw * .36), R = rnd(136); for (let y = 0, r = 0; y < H; y += bh, r++) for (let x = (r % 2) * -bw / 2; x < W; x += bw) { const t = 150 + R() * 40; c.fillStyle = `rgb(${t},${t * .42},${t * .3})`; c.fillRect(x + 3, y + 3, bw - 6, bh - 6); } cloud(c, W, H, [40, 20, 10], .35, 137, .06); noise(c, W, H, '#000', .2, 2, 138); }),
    P('wood', 'Дерево', (c, W, H) => { fill(c, W, H, '#b58553'); const R = rnd(139); for (let i = 0; i < 160; i++) { const y0 = R() * H; c.strokeStyle = `rgba(80,45,15,${.08 + R() * .18})`; c.lineWidth = 1 + R() * 4; c.beginPath(); for (let x = 0; x <= W; x += 20) c.lineTo(x, y0 + Math.sin(x / W * 6 + i) * 18 * R()); c.stroke(); } noise(c, W, H, '#3a2008', .15, 1.6, 140); }),
    P('cork', 'Пробковая доска', (c, W, H) => { fill(c, W, H, '#b88a57'); const R = rnd(141); for (let i = 0; i < W * H / 120; i++) { c.fillStyle = R() > .5 ? 'rgba(90,55,25,.5)' : 'rgba(230,190,140,.45)'; c.beginPath(); c.arc(R() * W, R() * H, .8 + R() * 3, 0, TAU); c.fill(); } }),
    P('leather', 'Кожа', (c, W, H) => { fill(c, W, H, '#5a3420'); cloud(c, W, H, [20, 10, 5], .5, 142, .015); cloud(c, W, H, [140, 90, 60], .25, 143, .08); noise(c, W, H, '#000', .2, 1.5, 144); }),
    P('terrazzo', 'Терраццо', (c, W, H) => { fill(c, W, H, '#efe9e1'); const R = rnd(145), cols = ['#e07a5f', '#3d405b', '#81b29a', '#f2cc8f', '#9a8c98']; for (let i = 0; i < 420; i++) { c.fillStyle = cols[i % cols.length]; c.save(); c.translate(R() * W, R() * H); c.rotate(R() * TAU); const s = 4 + R() * 22; c.beginPath(); c.moveTo(-s, 0); c.lineTo(0, -s * .6); c.lineTo(s * .8, s * .2); c.lineTo(-s * .2, s * .7); c.closePath(); c.fill(); c.restore(); } noise(c, W, H, '#555', .08, 1.5, 146); }),
    P('sand', 'Песок', (c, W, H) => { fill(c, W, H, '#dcc49a'); noise(c, W, H, '#7a5a30', .35, 1.6, 147, W * H / 30); noise(c, W, H, '#fff4d8', .3, 1.4, 148, W * H / 40); cloud(c, W, H, [150, 110, 60], .25, 149, .2); }),
    P('rust', 'Ржавчина', (c, W, H) => { fill(c, W, H, '#7a3c1e'); cloud(c, W, H, [200, 100, 40], .55, 150, .05); cloud(c, W, H, [40, 20, 10], .5, 151, .02); noise(c, W, H, '#000', .25, 1.8, 152); }),
    P('asphalt', 'Асфальт', (c, W, H) => { fill(c, W, H, '#3a3a3a'); noise(c, W, H, '#000', .5, 2, 153, W * H / 25); noise(c, W, H, '#9a9a9a', .35, 1.6, 154, W * H / 40); }),
    P('photocopy', 'Ксерокопия', (c, W, H) => { fill(c, W, H, '#f2f2f2'); cloud(c, W, H, [0, 0, 0], .25, 155, .04); noise(c, W, H, '#000', .55, 1.4, 156, W * H / 60); }),
    P('negative', 'Старый негатив', (c, W, H) => { fill(c, W, H, '#2a1a10'); cloud(c, W, H, [180, 110, 60], .25, 157, .1); const R = rnd(158); c.strokeStyle = 'rgba(255,230,200,.25)'; for (let i = 0; i < 60; i++) { c.lineWidth = .5 + R(); const x = R() * W; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (R() - .5) * 40, H); c.stroke(); } noise(c, W, H, '#fff', .12, 1.6, 159); }),
    P('gg-peach', 'Зернистый градиент · персик', grainGrad(['#ffd6c0', 'rgba(255,140,120,.9)', 'rgba(255,220,150,.8)', 'rgba(255,170,200,.7)'], 160)),
    P('gg-mint', 'Зернистый градиент · мята', grainGrad(['#c9f5e4', 'rgba(110,220,200,.9)', 'rgba(170,230,255,.8)', 'rgba(220,255,200,.7)'], 164)),
    P('gg-lilac', 'Зернистый градиент · лаванда', grainGrad(['#e2d4ff', 'rgba(170,140,255,.9)', 'rgba(255,190,240,.8)', 'rgba(190,220,255,.7)'], 168)),
    P('gg-sunset', 'Зернистый градиент · закат', grainGrad(['#2a1240', 'rgba(255,90,90,.9)', 'rgba(255,170,60,.85)', 'rgba(120,60,200,.8)'], 172)),
    P('gg-night', 'Зернистый градиент · ночь', grainGrad(['#05060f', 'rgba(40,60,180,.85)', 'rgba(130,40,160,.7)', 'rgba(0,160,200,.5)'], 176)),
    P('wet-glass', 'Мокрое стекло', (c, W, H) => { grad(c, W, H, ['#5a6c80', '#9ab0c4', '#4c5a6a']); const R = rnd(180); for (let i = 0; i < 700; i++) { const x = R() * W, y = R() * H, r = 2 + Math.pow(R(), 3) * 26; const g = c.createRadialGradient(x - r * .3, y - r * .3, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(.6, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(0,0,0,.25)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); } }),
    P('frosted', 'Матовое стекло', (c, W, H) => { grad(c, W, H, ['#d8e4ec', '#f2f6f8', '#c4d2dc']); noise(c, W, H, '#fff', .5, 1.4, 181, W * H / 20); noise(c, W, H, '#7a8a96', .25, 1.4, 182, W * H / 40); }),
    P('bubblewrap', 'Пупырчатая плёнка', (c, W, H) => { fill(c, W, H, '#dfe6ea'); const s = Math.round(Math.min(W, H) * .045); for (let y = 0, r = 0; y < H + s; y += s * 1.75, r++) for (let x = (r % 2) * s; x < W + s; x += s * 2) { const g = c.createRadialGradient(x - s * .3, y - s * .3, 0, x, y, s * .8); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(120,140,150,.35)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, s * .8, 0, TAU); c.fill(); } }),
    P('carbon', 'Карбон', (c, W, H) => { fill(c, W, H, '#111'); const s = 14; for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) { const k = ((x / s) + (y / s)) % 2; const g = c.createLinearGradient(x, y, x + s, y + s); g.addColorStop(0, k ? '#2a2a2a' : '#1a1a1a'); g.addColorStop(1, k ? '#0e0e0e' : '#262626'); c.fillStyle = g; c.fillRect(x, y, s, s); } }),
    P('blueprint', 'Синька (чертёж)', (c, W, H) => { fill(c, W, H, '#123a7a'); c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1; for (let x = 0; x < W; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } for (let y = 0; y < H; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); } c.strokeStyle = 'rgba(255,255,255,.28)'; for (let x = 0; x < W; x += 200) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } cloud(c, W, H, [255, 255, 255], .08, 183); }),
    P('felt', 'Фетр', (c, W, H) => { fill(c, W, H, '#4a6b5a'); fibers(c, W, H, 'rgba(255,255,255,.08)', 9000, 184, 14); fibers(c, W, H, 'rgba(0,0,0,.12)', 9000, 185, 14); })
  ];
  tex.bg = tex.bg.concat(bg.filter(x => !tex.bg.some(y => y.id === x.id)));

  const SCREEN = [];
  const ovS = (id, name, draw, dur) => { SCREEN.push(id); return A(id, name, draw, dur); };
  const ov = [
    ovS('grain-fine', 'Зерно мелкое', (c, W, H, S, t) => L.noise(c, W, H, t, { color: '#fff', alpha: .8, size: 2, n: Math.round(W * H / 55) })),
    ovS('grain-coarse', 'Зерно крупное', (c, W, H, S, t) => L.noise(c, W, H, t, { color: '#fff', alpha: .95, size: 5.5, n: Math.round(W * H / 150) })),
    ovS('grain-color', 'Цветное зерно', (c, W, H, S, t) => { const R = rnd(Math.floor(t * 24) + 7), cols = ['#ff6060', '#60ff90', '#6090ff', '#ffffff']; for (let i = 0; i < W * H / 75; i++) { c.globalAlpha = .2 + R() * .8; c.fillStyle = cols[i % 4]; const s = 2 + R() * 2.6; c.fillRect(R() * W, R() * H, s, s); } c.globalAlpha = 1; }),
    ovS('grain-8mm', 'Зерно 8 мм', (c, W, H, S, t) => { L.noise(c, W, H, t, { color: '#fff', alpha: .6, size: 3.6, n: Math.round(W * H / 380) }); const R = rnd(Math.floor(t * 18) + 3); c.fillStyle = `rgba(255,240,210,${.04 + R() * .08})`; c.fillRect(0, 0, W, H); }),
    ovS('dust-heavy', 'Много пыли', (c, W, H, S, t) => { const R = rnd(Math.floor(t * 12) + 70); c.fillStyle = '#fff'; for (let i = 0; i < 160; i++) { c.globalAlpha = .3 + R() * .7; c.beginPath(); c.arc(R() * W, R() * H, .6 + Math.pow(R(), 3) * 7, 0, TAU); c.fill(); } c.globalAlpha = 1; }),
    ovS('hair', 'Волоски на плёнке', (c, W, H, S, t) => { const R = rnd(Math.floor(t * 6) + 90); c.strokeStyle = '#fff'; for (let i = 0; i < 4; i++) { if (R() > .7) continue; c.globalAlpha = .5 + R() * .4; c.lineWidth = 1 + R() * 1.6; let x = R() * W, y = R() * H; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (R() - .5) * 60; y += (R() - .3) * 50; c.lineTo(x, y); } c.stroke(); } c.globalAlpha = 1; }),
    ovS('leak-warm', 'Тёплая засветка', (c, W, H, S, t) => L.leak(c, W, H, t, { colors: ['rgba(255,140,40,.9)', 'rgba(255,60,40,.6)', 'rgba(255,210,120,.7)'], loop: 3 })),
    ovS('leak-cool', 'Холодная засветка', (c, W, H, S, t) => L.leak(c, W, H, t, { colors: ['rgba(60,140,255,.85)', 'rgba(120,60,255,.6)', 'rgba(80,220,255,.7)'], loop: 3 })),
    ovS('leak-rainbow', 'Радужная засветка', (c, W, H, S, t) => L.leak(c, W, H, t, { colors: ['rgba(255,60,120,.8)', 'rgba(255,200,60,.7)', 'rgba(60,200,255,.7)'], loop: 3 })),
    ovS('leak-pink', 'Розовая засветка', (c, W, H, S, t) => L.leak(c, W, H, t, { colors: ['rgba(255,90,180,.85)', 'rgba(255,170,200,.7)', 'rgba(200,120,255,.6)'], loop: 3 })),
    ovS('flicker-strong', 'Сильное мерцание кинопроектора', (c, W, H, S, t) => { const R = rnd(Math.floor(t * 24) + 11), v = R(), a = v < .22 ? .65 + R() * .3 : v < .5 ? .3 + R() * .25 : .08 + R() * .18; c.fillStyle = `rgba(255,236,200,${a})`; c.fillRect(0, 0, W, H); rg(c, W * (.45 + R() * .1), H * (.42 + R() * .1), Math.hypot(W, H) * .45, `rgba(255,246,225,${a * .9})`); if (R() < .3) { const x = R() * W; c.fillStyle = `rgba(255,255,255,${.25 + R() * .4})`; c.fillRect(x, 0, 2 + R() * 3, H); } }),
    ovS('vhs-tracking', 'VHS-трекинг', (c, W, H, S, t) => { const y = ((t / 3) % 1) * H * 1.4 - H * .2, R = rnd(Math.floor(t * 30) + 5); for (let i = 0; i < 26; i++) { c.globalAlpha = .2 + R() * .5; c.fillStyle = '#fff'; c.fillRect(0, y + i * 3 + (R() - .5) * 6, W * (.4 + R() * .6), 1 + R() * 2); } c.globalAlpha = 1; L.noise(c, W, H, t, { color: '#fff', alpha: .2, size: 1.6, n: Math.round(W * H / 900) }); }),
    ovS('tv-static', 'Телевизионный снег', (c, W, H, S, t) => L.noise(c, W, H, t, { color: '#fff', alpha: .9, size: 2.2, n: Math.round(W * H / 25) })),
    ovS('scanlines', 'Строки развёртки', (c, W, H, S, t) => { c.fillStyle = 'rgba(255,255,255,.12)'; for (let y = ((t * 30) % 6); y < H; y += 6) c.fillRect(0, y, W, 2); const by = ((t / 3) % 1) * H; const g = c.createLinearGradient(0, by - 80, 0, by + 80); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.15)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, by - 80, W, 160); }),
    ovS('rain-lens', 'Капли на объективе', (c, W, H, S, t) => { const R = rnd(190); for (let i = 0; i < 120; i++) { const x = R() * W, y0 = R() * H, r = 3 + Math.pow(R(), 2) * 18, sp = R() * .4, y = (y0 + t / 3 * H * sp) % H; const g = c.createRadialGradient(x - r * .3, y - r * .3, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); } }),
    ovS('snow-fine', 'Мелкий снег', (c, W, H, S, t) => L.particles(c, W, H, S, t, { n: 200, size: .004, colors: ['#ffffff'], loop: 3, seed: 191 })),
    ovS('bokeh-warm', 'Тёплое боке', (c, W, H, S, t) => { const R = rnd(192); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 24; i++) { const x = R() * W + Math.cos(t / 3 * TAU + i) * 30, y = R() * H + Math.sin(t / 3 * TAU + i) * 20, r = Math.max(W, H) * (.03 + R() * .06); rg(c, x, y, r, `rgba(255,${150 + R() * 80},80,.5)`); } c.globalCompositeOperation = 'source-over'; }),
    ovS('bokeh-cool', 'Холодное боке', (c, W, H, S, t) => { const R = rnd(193); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 24; i++) { const x = R() * W + Math.cos(t / 3 * TAU + i) * 30, y = R() * H + Math.sin(t / 3 * TAU + i) * 20, r = Math.max(W, H) * (.03 + R() * .06); rg(c, x, y, r, `rgba(90,${140 + R() * 80},255,.5)`); } c.globalCompositeOperation = 'source-over'; }),
    ovS('sparkle-gold', 'Золотые искры', (c, W, H, S, t) => L.particles(c, W, H, S, t, { shape: 'spark', n: 50, size: .014, colors: ['#ffd27a', '#fff1c2'], twinkle: 1, dir: 'up', loop: 3, seed: 194 })),
    ovS('glitter-silver', 'Серебряные блёстки', (c, W, H, S, t) => L.particles(c, W, H, S, t, { shape: 'spark', n: 80, size: .009, colors: ['#ffffff', '#d8e4ff'], twinkle: 1, loop: 3, seed: 195 })),
    ovS('motes', 'Пылинки в луче света', (c, W, H, S, t) => { const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, 'rgba(255,235,190,.18)'); g.addColorStop(.5, 'rgba(255,235,190,.05)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); L.particles(c, W, H, S, t, { n: 90, size: .003, colors: ['#fff6e0'], twinkle: 1, loop: 3, dir: 'up', seed: 196 }); }),
    ovS('fog', 'Дымка', (c, W, H, S, t) => { const R = rnd(197); for (let i = 0; i < 10; i++) { const x = ((R() * W + t / 3 * W * .2 * (1 + R())) % (W * 1.4)) - W * .2, y = R() * H; rg(c, x, y, Math.max(W, H) * (.25 + R() * .2), 'rgba(255,255,255,.12)'); } }),
    ovS('smoke', 'Дым снизу', (c, W, H, S, t) => { const R = rnd(198); for (let i = 0; i < 14; i++) { const ph = (t / 3 + R()) % 1, x = R() * W, y = H - ph * H * .7; rg(c, x + Math.sin(ph * 6 + i) * 40, y, Math.max(W, H) * (.12 + ph * .2), `rgba(220,220,220,${.16 * (1 - ph)})`); } }),
    ovS('lens-dirt', 'Грязь на объективе', (c, W, H, S, t) => { const R = rnd(199); const k = .6 + .4 * Math.sin(t / 3 * TAU); for (let i = 0; i < 40; i++) rg(c, R() * W, R() * H, Math.max(W, H) * (.01 + R() * .05), `rgba(255,240,220,${.12 * k})`); }),
    ovS('fireflies', 'Светлячки', (c, W, H, S, t) => { const R = rnd(200); for (let i = 0; i < 40; i++) { const x = R() * W + Math.sin(t * 1.3 + i) * 30, y = R() * H + Math.cos(t + i * 2) * 30, a = .5 + .5 * Math.sin(t * 3 + i); rg(c, x, y, 14, `rgba(220,255,120,${a})`); } }),
    ovS('embers', 'Искры от костра', (c, W, H, S, t) => L.particles(c, W, H, S, t, { n: 70, size: .005, colors: ['#ff8a3d', '#ffcf6b', '#ff4d2d'], twinkle: 1, dir: 'up', loop: 3, seed: 201 })),
    ovS('stars', 'Мерцающие звёзды', (c, W, H, S, t) => { const R = rnd(202); for (let i = 0; i < 160; i++) { const x = R() * W, y = R() * H, a = Math.max(0, Math.sin((t / 3 + R()) * TAU * 2)); c.globalAlpha = a; c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, .8 + R() * 1.8, 0, TAU); c.fill(); } c.globalAlpha = 1; }),
    ovS('confetti-white', 'Белое конфетти', (c, W, H, S, t) => L.particles(c, W, H, S, t, { n: 60, size: .01, colors: ['#ffffff', '#f2f2f2'], loop: 3, seed: 203 })),
    ovS('rays-spin', 'Вращающиеся лучи', (c, W, H, S, t) => { c.globalAlpha = .25; L.rays(c, W, H, S, t, { color: '#fff', n: 28, speed: .3 }); c.globalAlpha = 1; }),
    ovS('prism', 'Призма (радуга)', (c, W, H, S, t) => { const x = W * (.2 + .6 * (.5 + .5 * Math.sin(t / 3 * TAU))); const g = c.createLinearGradient(x - W * .25, 0, x + W * .25, H * .3); ['rgba(255,0,0,0)', 'rgba(255,60,60,.35)', 'rgba(255,200,60,.35)', 'rgba(60,255,120,.35)', 'rgba(60,140,255,.35)', 'rgba(170,60,255,.35)', 'rgba(170,60,255,0)'].forEach((s, i, a) => g.addColorStop(i / (a.length - 1), s)); c.fillStyle = g; c.fillRect(0, 0, W, H); }),
    ovS('binary-rain', 'Цифровой дождь', (c, W, H, S, t) => { const R = rnd(204), s = Math.round(Math.min(W, H) / 40); c.font = `${s}px monospace`; c.fillStyle = '#7dffb0'; for (let x = 0; x < W; x += s) { const sp = .5 + R(), off = R() * H; for (let k = 0; k < 12; k++) { const y = (off + t * H * .3 * sp + k * s) % H; c.globalAlpha = k / 12 * .7; c.fillText(R() > .5 ? '1' : '0', x, y); } } c.globalAlpha = 1; }),
    ovS('glitch-blocks', 'Глитч-блоки', (c, W, H, S, t) => { const R = rnd(Math.floor(t * 12) + 13); for (let i = 0; i < 14; i++) { if (R() > .5) continue; c.fillStyle = ['rgba(255,0,90,.5)', 'rgba(0,255,200,.5)', 'rgba(255,255,255,.4)'][i % 3]; c.fillRect(R() * W, R() * H, W * (.05 + R() * .4), H * (.005 + R() * .03)); } }),
    ovS('noise-bars', 'Полосы помех', (c, W, H, S, t) => { const R = rnd(Math.floor(t * 20) + 17); for (let i = 0; i < 7; i++) { if (R() > .6) continue; const y = R() * H, h = 14 + R() * 90; c.fillStyle = `rgba(255,255,255,${.08 + R() * .14})`; c.fillRect(0, y, W, h); for (let k = 0; k < W / 1.2; k++) { c.fillStyle = `rgba(255,255,255,${.3 + R() * .7})`; c.fillRect(R() * W, y + R() * h, 3 + R() * 40, 1 + R() * 2.5); } } }),
    ovS('vignette-pulse', 'Пульсирующая виньетка-свет', (c, W, H, S, t) => { const k = .5 + .5 * Math.sin(t / 3 * TAU * 2); rg(c, W / 2, H / 2, Math.hypot(W, H) * (.35 + .1 * k), `rgba(255,240,220,${.18 + .1 * k})`); }),
    ovS('cross-shimmer', 'Мерцание-перекрестия', (c, W, H, S, t) => { const R = rnd(205); c.strokeStyle = '#fff'; c.lineWidth = 2; for (let i = 0; i < 30; i++) { const x = R() * W, y = R() * H, a = Math.max(0, Math.sin((t / 3 + R()) * TAU * 2)), s = 6 + R() * 18; c.globalAlpha = a; c.beginPath(); c.moveTo(x - s, y); c.lineTo(x + s, y); c.moveTo(x, y - s); c.lineTo(x, y + s); c.stroke(); } c.globalAlpha = 1; }),
    ovS('god-rays', 'Лучи сверху', (c, W, H, S, t) => { const R = rnd(206); for (let i = 0; i < 9; i++) { const x = W * (R() * 1.2 - .1) + Math.sin(t / 3 * TAU + i) * 30, w = W * (.04 + R() * .08), a = .08 + .08 * (.5 + .5 * Math.sin(t / 3 * TAU * 2 + i * 1.7)); const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(255,246,220,${a})`); g.addColorStop(1, 'rgba(255,246,220,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + w, 0); c.lineTo(x + w * 3 + W * .2, H); c.lineTo(x + W * .2, H); c.closePath(); c.fill(); } }),
    ovS('rain-streaks', 'Дождь', (c, W, H, S, t) => { const R = rnd(207); c.strokeStyle = 'rgba(220,230,255,.5)'; c.lineWidth = 2; for (let i = 0; i < 220; i++) { const x = R() * W, sp = .6 + R() * .8, l = 30 + R() * 50, y = (R() * H + t / 3 * H * 3 * sp) % (H + l) - l; c.beginPath(); c.moveTo(x, y); c.lineTo(x - l * .15, y + l); c.stroke(); } }),
    ovS('snow-big', 'Крупный снег', (c, W, H, S, t) => L.particles(c, W, H, S, t, { n: 70, size: .012, colors: ['#ffffff', '#eef4ff'], loop: 3, seed: 208 })),
    A('film-gate', 'Кадр плёнки с перфорацией', (c, W, H, S, t) => { const R = rnd(Math.floor(t * 24) + 1), j = (R() - .5) * 6, s = Math.min(W, H) * .06; c.fillStyle = '#0b0b0b'; c.fillRect(0, 0, s * 1.6, H); c.fillRect(W - s * 1.6, 0, s * 1.6, H); c.globalCompositeOperation = 'destination-out'; const off = (t * 24 % 1) * s * 1.8; for (let y = -s * 2 + off + j; y < H + s; y += s * 1.8) { c.fillRect(s * .4, y, s * .8, s * 1.1); c.fillRect(W - s * 1.2, y, s * .8, s * 1.1); } c.globalCompositeOperation = 'source-over'; }),
    A('sprocket', 'Бегущая плёнка сбоку', (c, W, H, S, t) => { const s = Math.min(W, H) * .05; c.fillStyle = 'rgba(20,14,10,.85)'; c.fillRect(0, 0, s * 1.8, H); c.globalCompositeOperation = 'destination-out'; for (let y = -(t * H * .5 % (s * 1.8)); y < H; y += s * 1.8) c.fillRect(s * .45, y, s * .9, s * 1.1); c.globalCompositeOperation = 'source-over'; }),
    ovS('light-sweep', 'Проход света', (c, W, H, S, t) => { const x = ((t / 3) % 1) * W * 1.6 - W * .3; const g = c.createLinearGradient(x - W * .25, 0, x + W * .25, H * .4); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,250,235,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }),
    A('frame-burn', 'Горящие края кадра', (c, W, H, S, t) => { const k = .6 + .4 * Math.sin(t / 3 * TAU); const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.hypot(W, H) * .6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.7, `rgba(255,120,30,${.3 * k})`); g.addColorStop(1, `rgba(120,20,0,${.85 * k})`); c.fillStyle = g; c.fillRect(0, 0, W, H); })
  ];
  tex.ov = tex.ov.concat(ov.filter(x => !tex.ov.some(y => y.id === x.id)));
  G.KK_SCREEN = (G.KK_SCREEN || []).concat(SCREEN);
})(window);

/* ---- styles6.js ---- */
/* «Футажи (для любого стиля)» — универсальный набор анимаций (an, 1024×1024): кнопки соцсетей, опросы, экраны,
   счётчики, пиксель-арт, указатели. Прозрачный MOV для Premiere + MP4 на зелёном для CapCut.
   Зелёный #00B140 — цвет хромакея, поэтому в футажах нет зелёных деталей, кроме «зелёных экранов» телефона и браузера
   (в CapCut экран вырезается вместе с фоном — под ним видно твоё видео).
   В конце файла — iOS: анимации ai-* на настоящих иконках Apple (icons/ios/*.png). */
(function (G) {
  const { E, TAU } = G.KKL;
  const ST = G.KKSTYLES;
  const READY = G.KK_READY = G.KK_READY || [];
  const cl = E.clamp, eo = E.out, eio = E.inOut, ein = x => x * x * x, lerp = (a, b, k) => a + (b - a) * k;
  const ss = x => (x = cl(x), x * x * (3 - 2 * x));
  const KEY = '#00B140';
  const FN = { b: 'Inter-Bold', m: 'Inter-Medium', k: 'Montserrat-Black', x: 'Montserrat-ExtraBold' };

  /* ---------- движение ---------- */
  // пружина iOS: 0 → 1 с перелётом; x — секунды от старта
  function spr(x, f = 14, z = .42) { if (x <= 0) return 0; const q = Math.sqrt(1 - z * z), wd = f * q; return 1 - Math.exp(-z * f * x) * (Math.cos(wd * x) + z / q * Math.sin(wd * x)); }
  // появление пружиной в t0 и уход в последние out секунд
  function env(t, dur, t0 = 0, out = .3) { const o = ein(cl((t - (dur - out)) / out)); return { k: Math.max(0, spr(t - t0) * (1 - .3 * o)), a: cl((t - t0) / .06) * (1 - o) }; }
  function wk(c, cx, cy, e, fn) { if (e.a <= .002 || e.k <= .002) return; c.save(); c.globalAlpha *= cl(e.a); c.translate(cx, cy); if (e.r) c.rotate(e.r); c.scale(e.k, e.ky || e.k); c.translate(-cx, -cy); fn(); c.restore(); }
  // нажатие: 0 → 1 → 0 вокруг момента tc
  function prs(t, tc) { const d = t - tc; return d < -.07 || d > .2 ? 0 : d < 0 ? ss((d + .07) / .07) : 1 - ss((d - .03) / .17); }
  // путь по ключам [[t, x, y], …]
  function track(t, K) { if (t <= K[0][0]) return [K[0][1], K[0][2]]; for (let i = 1; i < K.length; i++) if (t <= K[i][0]) { const k = eio((t - K[i - 1][0]) / (K[i][0] - K[i - 1][0])); return [lerp(K[i - 1][1], K[i][1], k), lerp(K[i - 1][2], K[i][2], k)]; } const L = K[K.length - 1]; return [L[1], L[2]]; }

  /* ---------- рисование ---------- */
  function rr(c, x, y, w, h, r) { w = Math.max(0, w); h = Math.max(0, h); c.beginPath(); c.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); }
  function T(c, s, x, y, px, col, f = 'b', al = 'center') { c.font = `${px}px "${FN[f]}"`; c.fillStyle = col; c.textAlign = al; c.textBaseline = 'middle'; c.fillText(s, x, y + px * .04); }
  function TW(c, s, px, f = 'b') { c.font = `${px}px "${FN[f]}"`; return c.measureText(s).width; }
  function sh(c, k = 1) { c.shadowColor = `rgba(0,0,0,${.2 * Math.min(k, 1.5)})`; c.shadowBlur = 44 * k; c.shadowOffsetY = 18 * k; }
  function nosh(c) { c.shadowColor = 'rgba(0,0,0,0)'; c.shadowBlur = 0; c.shadowOffsetY = 0; }
  function card(c, x, y, w, h, r, fill = '#fff', k = 1) { c.save(); c.fillStyle = fill; if (k) sh(c, k); rr(c, x, y, w, h, r); c.fill(); c.restore(); }
  function circ(c, x, y, r, fill) { c.beginPath(); c.arc(x, y, Math.max(0, r), 0, TAU); if (fill) { c.fillStyle = fill; c.fill(); } }
  function grad(c, x0, y0, x1, y1, cols) { const g = c.createLinearGradient(x0, y0, x1, y1); cols.forEach((s, i) => g.addColorStop(i / (cols.length - 1), s)); return g; }
  const nb = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // значки 24×24 (контуры из открытых наборов Material)
  const IC = {
    heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    thumb: 'M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z',
    bell: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
    bookmark: 'M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z',
    send: 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z',
    check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
    person: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
    phone: 'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z',
    link: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
    eye: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
    star: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
    play: 'M8 5v14l11-7z',
    plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
    down: 'M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z',
    close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z'
  };
  const P2 = {}, path2 = n => P2[n] || (P2[n] = new Path2D(IC[n]));
  // lw — рисовать контуром (толщина в единицах 24×24)
  function ic(c, n, x, y, s, col, lw, rot) { if (G.KKX && G.KKX.icon && G.KKX.icon(c, n, x, y, s, rot)) return; c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.translate(-s / 2, -s / 2); c.scale(s / 24, s / 24);
    if (lw) { c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = col; c.stroke(path2(n)); } else { c.fillStyle = col; c.fill(path2(n)); } c.restore(); }
  // круглая «аватарка» без людей: градиент + силуэт или буквы
  function avatar(c, x, y, r, c1, c2, letters) { c.save(); circ(c, x, y, r); c.fillStyle = grad(c, x - r, y - r, x + r, y + r, [c1, c2]); c.fill();
    if (letters) T(c, letters, x, y, r * .78, '#fff', 'b'); else { c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip(); ic(c, 'person', x, y + r * .16, r * 1.7, 'rgba(255,255,255,.92)'); } c.restore(); }
  // курсор мыши (стрелка): кончик в (x, y)
  function cursor(c, x, y, pr = 0, s = 1.15) { c.save(); c.translate(x, y); const k = s * (1 - .14 * pr); c.scale(k, k); c.beginPath();
    [[0, 0], [0, 74], [18, 57], [30, 86], [42, 81], [30, 53], [53, 53]].forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
    c.lineJoin = 'round'; c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 16; c.shadowOffsetY = 6; c.lineWidth = 11; c.strokeStyle = '#fff'; c.stroke(); nosh(c); c.fillStyle = '#111'; c.fill(); c.restore(); }
  function ripple(c, x, y, t, tc, rgb = '255,255,255', R = 70, a = .6) { const k = (t - tc) / .5; if (k < 0 || k > 1) return; c.save(); c.globalAlpha *= (1 - k) * a; circ(c, x, y, R * (.4 + eo(k)), `rgb(${rgb})`); c.restore(); }
  // касание пальцем (как индикатор касаний в записи экрана iPhone)
  function touch(c, x, y, t, tc, R = 50) { const a = cl((t - tc + .32) / .14) * (1 - cl((t - tc - .18) / .2)); if (a <= 0) return; const p = prs(t, tc), ap = cl((t - tc + .32) / .3);
    c.save(); c.globalAlpha *= a; sh(c, .5); circ(c, x, y, R * (1.25 - .25 * eo(ap)) * (1 - .2 * p), 'rgba(255,255,255,.62)'); nosh(c); c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.16)'; c.stroke(); c.restore(); ripple(c, x, y, t, tc, '255,255,255', R * 1.6, .5); }
  // взрыв частиц
  function burst(c, x, y, t, tc, o = {}) { const k = (t - tc) / (o.d || .6); if (k <= 0 || k >= 1) return; const n = o.n || 10, R = o.R || 170, cols = o.cols || ['#FF3040', '#FF9500', '#FF2D96'];
    c.save(); if (o.ring !== false) { c.strokeStyle = cols[0]; c.lineWidth = (o.lw || 16) * (1 - k); c.beginPath(); c.arc(x, y, R * .7 * eo(k), 0, TAU); if (c.lineWidth > .5) c.stroke(); }
    for (let i = 0; i < n; i++) { const a = i / n * TAU + (o.rot ?? -.3), d = R * (.5 + .55 * eo(k)) * (i % 2 ? .82 : 1), s = (o.s || 13) * (1 - ein(k)) * (i % 2 ? .75 : 1);
      if (o.lines) { c.strokeStyle = cols[i % cols.length]; c.lineCap = 'round'; c.lineWidth = s * .9; c.beginPath(); c.moveTo(x + Math.cos(a) * d * .78, y + Math.sin(a) * d * .78); c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); c.stroke(); }
      else circ(c, x + Math.cos(a) * d, y + Math.sin(a) * d, s, cols[i % cols.length]); } c.restore(); }
  // конфетти (детерминированно)
  function confetti(c, x, y, t, tc, n = 26, spread = 420) { const k = t - tc; if (k <= 0 || k > 1.6) return; const cols = ['#FF3B30', '#FFCC00', '#0A84FF', '#AF52DE', '#FF9500', '#FF2D55'];
    c.save(); c.globalAlpha *= 1 - cl((k - 1.1) / .5); for (let i = 0; i < n; i++) { const s1 = Math.sin(i * 12.9898) * 43758.5453, r1 = s1 - Math.floor(s1), s2 = Math.sin(i * 78.233) * 12543.123, r2 = s2 - Math.floor(s2);
      const a = -Math.PI / 2 + (r1 - .5) * 2.4, v = spread * (.55 + r2 * .6), px = x + Math.cos(a) * v * eo(cl(k / .9)), py = y + Math.sin(a) * v * eo(cl(k / .9)) + 260 * k * k;
      c.save(); c.translate(px, py); c.rotate(k * (4 + r1 * 6) + i); c.fillStyle = cols[i % cols.length]; c.fillRect(-9, -5, 18, 10); c.restore(); } c.restore(); }
  function wrap(c, s, px, f, maxW) { const L = []; let cur = ''; for (const w of s.split(' ')) { const tst = cur ? cur + ' ' + w : w; if (cur && TW(c, tst, px, f) > maxW) { L.push(cur); cur = w; } else cur = tst; } if (cur) L.push(cur); return L; }
  // кнопка с двумя состояниями: плавная смена ширины, цвета и надписи (m — 0..1)
  function morphBtn(c, cx, cy, h, r, A, B, m, pr = 0) { const ga0 = c.globalAlpha, f = ss(m * 3), w = lerp(A.w, B.w, cl(m)); c.save(); c.translate(cx, cy); c.scale(1 - .06 * pr, 1 - .06 * pr);
    if (A.sh || B.sh) { c.save(); sh(c, .6); rr(c, -w / 2, -h / 2, w, h, r); c.fillStyle = f < .5 ? A.bg : B.bg; c.fill(); c.restore(); }
    rr(c, -w / 2, -h / 2, w, h, r); c.fillStyle = A.bg; c.globalAlpha = ga0 * (1 - f); c.fill(); c.globalAlpha = ga0 * (f); c.fillStyle = B.bg; c.fill();
    if (B.line) { c.lineWidth = 3; c.strokeStyle = B.line; c.stroke(); }
    c.globalAlpha = ga0 * (1 - f); A.draw(c, w, h); c.globalAlpha = ga0 * (f); B.draw(c, w, h); c.restore(); }

  const items = [];
  // A(id, имя, группа, длительность, рисунок(c, t, dur)) — рисуем в координатах 1024×1024
  const A = (id, name, group, dur, draw) => items.push({ id, name, group, dur, draw: (c, W, H, S, t) => { c.save(); c.scale(W / 1024, H / 1024); draw(c, t, dur); c.restore(); } });

  /* =====================================================================
     1. Кнопки соцсетей и действия
     ===================================================================== */
  A('f-yt-sub', 'YouTube: «Подписаться» + колокольчик', 'Соцсети', 4, (c, t, D) => {
    const e = env(t, D), X = 92, Y = 412, Wc = 840, Hc = 200, t1 = 1.45, t2 = 2.6, on = t >= t1;
    const wA = TW(c, 'Подписаться', 32) + 76, wB = TW(c, 'Вы подписаны', 28) + 136, m = spr(t - t1, 15, .7);
    const w = lerp(wA, wB, cl(m)), bcx = X + Wc - 28 - w / 2, bcy = Y + Hc / 2, bellX = X + Wc - 28 - wB + 42;
    wk(c, 512, 512, e, () => {
      card(c, X, Y, Wc, Hc, 40);
      avatar(c, X + 84, Y + 100, 54, '#FF5F6D', '#FFC371');
      T(c, 'Твой канал', X + 160, Y + 78, 38, '#0F0F0F', 'b', 'left');
      T(c, (on ? '12,5' : '12,4') + ' тыс. подписчиков', X + 160, Y + 126, 24, '#606060', 'm', 'left');
      const ring = t > t2 ? Math.sin((t - t2) * 30) * .55 * Math.exp(-(t - t2) * 3.2) : 0;
      morphBtn(c, bcx, bcy, 84, 42,
        { w: wA, bg: '#FF0000', draw: (c) => T(c, 'Подписаться', 0, 0, 32, '#fff') },
        { w: wB, bg: '#F2F2F2', draw: (c, w) => { const bx = -w / 2 + 42; c.save(); c.translate(bx, -20); c.rotate(ring); c.translate(-bx, 20); ic(c, 'bell', bx, 0, 36, '#0F0F0F'); c.restore();
          if (t > t2) { c.save(); c.globalAlpha *= cl((t - t2) / .15); c.strokeStyle = '#0F0F0F'; c.lineWidth = 3; c.lineCap = 'round'; [-1, 1].forEach(d => { c.beginPath(); c.arc(bx, -2, 25, d < 0 ? Math.PI * .8 : -Math.PI * .2, d < 0 ? Math.PI * 1.2 : Math.PI * .2); c.stroke(); }); c.restore(); }
          T(c, 'Вы подписаны', bx + 30, 0, 28, '#0F0F0F', 'b', 'left'); ic(c, 'down', w / 2 - 30, 2, 34, '#0F0F0F'); } }, m, prs(t, t1));
      ripple(c, bcx, bcy, t, t1, '255,255,255', 80, .5); ripple(c, bellX, bcy, t, t2, '0,0,0', 60, .12);
      const [cx, cy] = track(t, [[.3, 1080, 1000], [1.3, bcx + 10, bcy + 8], [2.3, bcx + 10, bcy + 8], [2.5, bellX + 6, bcy + 10], [3.25, bellX + 6, bcy + 10], [3.75, 1100, 1000]]);
      cursor(c, cx, cy, prs(t, t1) + prs(t, t2));
    });
  });

  A('f-yt-like', 'YouTube: лайк', 'Соцсети', 3, (c, t, D) => {
    const e = env(t, D), tc = 1.25, on = t >= tc, h = 120, cy = 512;
    const wTxt = Math.max(TW(c, '9 999', 40), TW(c, '10 тыс.', 40)), wL = 44 + 56 + 22 + wTxt + 34, wR = 116, w = wL + wR, x0 = 512 - w / 2, tx = x0 + 44 + 28;
    wk(c, 512, 512, e, () => {
      card(c, x0, cy - h / 2, w, h, h / 2, '#F2F2F2', .8);
      c.fillStyle = '#D9D9D9'; c.fillRect(x0 + wL, cy - 34, 3, 68);
      const k = on ? 1 + .35 * Math.sin(Math.PI * cl((t - tc) / .35)) : 1 - .1 * prs(t, tc);
      c.save(); c.translate(tx, cy); c.rotate(on ? -.25 * Math.sin(Math.PI * cl((t - tc) / .35)) : 0); c.scale(k, k);
      if (on) ic(c, 'thumb', 0, -2, 56, '#0F0F0F'); else ic(c, 'thumb', 0, -2, 52, '#0F0F0F', 1.9); c.restore();
      burst(c, tx, cy - 4, t, tc + .05, { n: 8, R: 70, s: 6, ring: false, lines: true, cols: ['#0F0F0F'] });
      // счётчик перекатывается вверх
      const r = ss((t - tc - .05) / .3); c.save(); rr(c, tx + 40, cy - 34, wTxt + 20, 68, 0); c.clip();
      T(c, '9 999', tx + 50, cy - r * 60, 40, '#0F0F0F', 'b', 'left'); T(c, '10 тыс.', tx + 50, cy + (1 - r) * 60, 40, '#0F0F0F', 'b', 'left'); c.restore();
      c.save(); c.translate(x0 + wL + wR / 2 - 2, cy + 4); c.scale(1, -1); ic(c, 'thumb', 0, 0, 52, '#0F0F0F', 1.9); c.restore();
      const [px, py] = track(t, [[.25, 1060, 980], [1.1, tx + 6, cy + 10], [2.2, tx + 6, cy + 10], [2.7, 1100, 1000]]);
      cursor(c, px, py, prs(t, tc));
    });
  });

  A('f-yt-bell', 'YouTube: колокольчик «Все уведомления»', 'Соцсети', 2.5, (c, t, D) => {
    const e = env(t, D), t1 = .55, rot = t > t1 ? Math.sin((t - t1) * 26) * .5 * Math.exp(-(t - t1) * 2.2) : 0;
    wk(c, 512, 470, e, () => {
      card(c, 512 - 150, 470 - 150, 300, 300, 150, '#fff', 1);
      c.save(); c.translate(512, 360); c.rotate(rot); c.translate(-512, -360); ic(c, 'bell', 512, 470, 170, '#0F0F0F'); c.restore();
      const wv = cl((t - t1) / .2); if (wv > 0) { c.save(); const ga0 = c.globalAlpha; c.strokeStyle = '#0F0F0F'; c.lineCap = 'round'; c.lineWidth = 11; [[-1, 112], [-1, 150], [1, 112], [1, 150]].forEach(([d, r], i) => { c.globalAlpha = ga0 * (wv * (.55 + .45 * Math.sin(t * 10 - i % 2))); c.beginPath(); c.arc(512, 462, r, d < 0 ? Math.PI * .82 : -Math.PI * .18, d < 0 ? Math.PI * 1.18 : Math.PI * .18); c.stroke(); }); c.restore(); }
      const lk = spr(t - .8, 14, .55), lw = TW(c, 'Все уведомления', 40) + 70;
      wk(c, 512, 720, { k: lk, a: cl((t - .8) / .1) }, () => { card(c, 512 - lw / 2, 720 - 42, lw, 84, 42, '#0F0F0F', .7); T(c, 'Все уведомления', 512, 720, 40, '#fff'); });
    });
  });

  A('f-ig-follow', 'Instagram: «Подписаться»', 'Соцсети', 3, (c, t, D) => {
    const e = env(t, D), tc = 1.3, wA = TW(c, 'Подписаться', 46) + 120, wB = TW(c, 'Вы подписаны', 46) + 150;
    wk(c, 512, 512, e, () => {
      morphBtn(c, 512, 512, 116, 26,
        { w: wA, bg: '#0095F6', sh: 1, draw: c => T(c, 'Подписаться', 0, 0, 46, '#fff') },
        { w: wB, bg: '#EFEFEF', sh: 1, draw: (c, w) => { T(c, 'Вы подписаны', -22, 0, 46, '#000'); ic(c, 'down', w / 2 - 48, 2, 44, '#000'); } }, spr(t - tc, 15, .7), prs(t, tc));
      touch(c, 560, 528, t, tc);
    });
  });

  A('f-ig-heart', 'Instagram: сердце с взрывом', 'Соцсети', 2.5, (c, t, D) => {
    const e = env(t, D), tc = 1.0, on = t >= tc, k = on ? .55 + .45 * spr(t - tc, 16, .32) : 1 - .1 * prs(t, tc);
    wk(c, 512, 512, e, () => {
      burst(c, 512, 512, t, tc + .02, { n: 12, R: 300, s: 18, lw: 22, cols: ['#FF3040', '#FF8A00', '#FF2D96', '#FFC400'] });
      c.save(); c.translate(512, 512); c.scale(k, k); sh(c, .8);
      if (on) ic(c, 'heart', 0, 0, 440, '#FF3040'); else ic(c, 'heart', 0, 0, 420, '#fff', 1.7); c.restore();
      touch(c, 540, 560, t, tc, 56);
    });
  });

  A('f-ig-profile', 'Instagram: профиль и «Подписаться»', 'Соцсети', 3.5, (c, t, D) => {
    const e = env(t, D), tc = 1.6, on = t >= tc, X = 92, Y = 290, Wc = 840, Hc = 444;
    wk(c, 512, 512, e, () => {
      card(c, X, Y, Wc, Hc, 44);
      const ax = X + 130, ay = Y + 128; const g = c.createConicGradient(-Math.PI / 2, ax, ay); ['#FEDA75', '#FA7E1E', '#D62976', '#962FBF', '#4F5BD5', '#FEDA75'].forEach((s, i) => g.addColorStop(i / 5, s));
      circ(c, ax, ay, 86); c.fillStyle = g; c.fill(); circ(c, ax, ay, 78, '#fff'); circ(c, ax, ay, 72, '#DBDBDB'); c.save(); circ(c, ax, ay, 72); c.clip(); ic(c, 'person', ax, ay + 12, 124, '#fff'); c.restore();
      [['128', 'публикации'], [on ? '12,6 тыс.' : '12,5 тыс.', 'подписчики'], ['310', 'подписки']].forEach(([n, l], i) => { const x = X + 345 + i * 175; T(c, n, x, Y + 108, 38, '#000'); T(c, l, x, Y + 152, 25, '#000', 'm'); });
      T(c, 'твой_ник', X + 48, Y + 262, 32, '#000', 'b', 'left'); T(c, 'Монтаж · Рилс · Влоги', X + 48, Y + 304, 28, '#000', 'm', 'left');
      const bw = Wc - 96;
      morphBtn(c, X + Wc / 2, Y + 374, 76, 18,
        { w: bw, bg: '#0095F6', draw: c => T(c, 'Подписаться', 0, 0, 32, '#fff') },
        { w: bw, bg: '#EFEFEF', draw: () => { T(c, 'Вы подписаны', -14, 0, 32, '#000'); ic(c, 'down', TW(c, 'Вы подписаны', 32) / 2 + 12, 2, 34, '#000'); } }, spr(t - tc, 15, .7), prs(t, tc) * .5);
      touch(c, X + Wc / 2 + 60, Y + 384, t, tc);
    });
  });

  A('f-tt-follow', 'TikTok: аватар с «+» подписки', 'Соцсети', 2.5, (c, t, D) => {
    const e = env(t, D), tc = 1.0, on = t >= tc, bx = 512, by = 512 + 170;
    wk(c, 512, 512, e, () => {
      c.save(); sh(c, 1); circ(c, 512, 512, 182, '#fff'); c.restore(); avatar(c, 512, 512, 170, '#25F4EE', '#FE2C55');
      const gone = cl((t - 1.75) / .25), r = 48 * (1 - ein(gone)) * (1 - .15 * prs(t, tc)), rot = on ? Math.PI * cl(spr(t - tc, 13, .6)) : 0, f = ss((t - tc) / .2);
      if (r > .5) { c.save(); const ga0 = c.globalAlpha; c.translate(bx, by); c.rotate(rot); sh(c, .6); circ(c, 0, 0, r, f < .5 ? '#FE2C55' : '#fff'); nosh(c);
        c.globalAlpha = ga0 * (1 - f); ic(c, 'plus', 0, 0, r * 1.25, '#fff'); c.globalAlpha = ga0 * (f); ic(c, 'check', 0, 0, r * 1.2, '#FE2C55', 0, Math.PI); c.restore(); }
      touch(c, bx + 6, by + 10, t, tc, 46);
    });
  });

  A('f-tt-like', 'TikTok: лайк и счётчик', 'Соцсети', 2.5, (c, t, D) => {
    const e = env(t, D), tc = .95, on = t >= tc, k = on ? .5 + .5 * spr(t - tc, 15, .35) : 1 - .1 * prs(t, tc);
    wk(c, 512, 470, e, () => {
      burst(c, 512, 430, t, tc, { n: 10, R: 230, s: 15, ring: false, cols: ['#FE2C55', '#FF7A9A', '#25F4EE'] });
      c.save(); c.translate(512, 430); c.scale(k, k); sh(c, .9); ic(c, 'heart', 0, 0, 330, on ? '#FE2C55' : '#fff'); c.restore();
      c.save(); sh(c, .6); T(c, on ? '12,5K' : '12,4K', 512, 660, 64, '#fff'); c.restore();
      touch(c, 530, 450, t, tc, 56);
    });
  });

  A('f-tg-sub', 'Telegram: «Подписаться на канал»', 'Соцсети', 3.5, (c, t, D) => {
    const e = env(t, D), tc = 1.55, on = t >= tc, X = 112, Y = 322, Wc = 800, Hc = 380;
    wk(c, 512, 512, e, () => {
      card(c, X, Y, Wc, Hc, 40);
      avatar(c, X + 110, Y + 116, 70, '#6FD3FF', '#2A9EF1', 'МК');
      T(c, 'Мой канал', X + 210, Y + 92, 42, '#000', 'b', 'left'); T(c, (on ? '2 451' : '2 450') + ' подписчиков', X + 210, Y + 142, 28, '#8E8E93', 'm', 'left');
      const bw = Wc - 80;
      morphBtn(c, X + Wc / 2, Y + 296, 96, 24,
        { w: bw, bg: '#2AABEE', draw: c => T(c, 'Подписаться на канал', 0, 0, 36, '#fff') },
        { w: bw, bg: '#E8F4FC', draw: () => { const w2 = TW(c, 'Вы подписаны', 36); ic(c, 'check', -w2 / 2 - 14, 0, 40, '#2AABEE'); T(c, 'Вы подписаны', 14, 0, 36, '#2AABEE'); } }, spr(t - tc, 15, .7), prs(t, tc) * .5);
      touch(c, X + Wc / 2 + 80, Y + 306, t, tc);
    });
  });

  A('f-vk-sub', 'ВКонтакте: «Подписаться»', 'Соцсети', 3, (c, t, D) => {
    const e = env(t, D), tc = 1.45, on = t >= tc, X = 92, Y = 402, Wc = 840, Hc = 220;
    const wA = TW(c, 'Подписаться', 32) + 72, wB = TW(c, 'Вы подписаны', 32) + 110, m = spr(t - tc, 15, .7), w = lerp(wA, wB, cl(m)), bcx = X + Wc - 40 - w / 2, bcy = Y + Hc / 2;
    wk(c, 512, 512, e, () => {
      card(c, X, Y, Wc, Hc, 36);
      avatar(c, X + 106, Y + 110, 66, '#A393FF', '#0077FF', 'С');
      T(c, 'Сообщество', X + 200, Y + 88, 40, '#000', 'b', 'left'); T(c, (on ? '12 001' : '12 000') + ' подписчиков', X + 200, Y + 136, 27, '#818C99', 'm', 'left');
      morphBtn(c, bcx, bcy, 80, 18,
        { w: wA, bg: '#0077FF', draw: c => T(c, 'Подписаться', 0, 0, 32, '#fff') },
        { w: wB, bg: '#EBEDF0', draw: (c, w) => { ic(c, 'check', -w / 2 + 40, 0, 34, '#2C2D2E'); T(c, 'Вы подписаны', 18, 0, 32, '#2C2D2E'); } }, m, prs(t, tc));
      ripple(c, bcx, bcy, t, tc, '255,255,255', 70, .5);
      const [px, py] = track(t, [[.3, 1080, 1000], [1.3, bcx + 12, bcy + 8], [2.3, bcx + 12, bcy + 8], [2.75, 1100, 1000]]); cursor(c, px, py, prs(t, tc));
    });
  });

  A('f-pin-save', 'Pinterest: «Сохранить»', 'Соцсети', 3, (c, t, D) => {
    const e = env(t, D), tc = 1.5, X = 232, Y = 132, Wc = 560, Hc = 760;
    const wA = TW(c, 'Сохранить', 34) + 66, wB = TW(c, 'Сохранено', 34) + 66, m = spr(t - tc, 15, .7), w = lerp(wA, wB, cl(m)), bcx = X + Wc - 28 - w / 2, bcy = Y + 28 + 42;
    wk(c, 512, 512, e, () => {
      c.save(); sh(c, 1); rr(c, X, Y, Wc, Hc, 44); c.fillStyle = grad(c, X, Y, X + Wc, Y + Hc, ['#FFD3E0', '#FBC2EB', '#A6C1EE']); c.fill(); nosh(c); c.clip();
      circ(c, X + Wc * .68, Y + Hc * .36, 92, 'rgba(255,240,200,.95)');
      c.fillStyle = 'rgba(160,120,220,.55)'; c.beginPath(); c.moveTo(X, Y + Hc * .72); c.bezierCurveTo(X + Wc * .3, Y + Hc * .55, X + Wc * .55, Y + Hc * .8, X + Wc, Y + Hc * .62); c.lineTo(X + Wc, Y + Hc); c.lineTo(X, Y + Hc); c.fill();
      c.fillStyle = 'rgba(255,150,160,.6)'; c.beginPath(); c.moveTo(X, Y + Hc * .84); c.bezierCurveTo(X + Wc * .35, Y + Hc * .74, X + Wc * .7, Y + Hc * .92, X + Wc, Y + Hc * .8); c.lineTo(X + Wc, Y + Hc); c.lineTo(X, Y + Hc); c.fill();
      c.fillStyle = `rgba(0,0,0,${.22 * ss((t - .5) / .3)})`; c.fillRect(X, Y, Wc, Hc); c.restore();
      const ba = ss((t - .55) / .25); c.save(); c.globalAlpha *= ba;
      morphBtn(c, bcx, bcy, 84, 42, { w: wA, bg: '#E60023', draw: c => T(c, 'Сохранить', 0, 0, 34, '#fff') }, { w: wB, bg: '#111', draw: c => T(c, 'Сохранено', 0, 0, 34, '#fff') }, m, prs(t, tc)); c.restore();
      ripple(c, bcx, bcy, t, tc, '255,255,255', 70, .5);
      const [px, py] = track(t, [[.3, 1080, 1000], [1.35, bcx + 10, bcy + 10], [2.3, bcx + 10, bcy + 10], [2.75, 1100, 1000]]); cursor(c, px, py, prs(t, tc));
    });
  });

  // белая «таблетка» с иконкой и призывом
  function cta(c, label, px, icon) { const w = TW(c, label, px) + 210, h = 160, x = 512 - w / 2; card(c, x, 512 - h / 2, w, h, h / 2, '#fff', 1); T(c, label, x + 160, 512, px, '#111', 'b', 'left'); return x + 92; }
  A('f-like', '«Поставь лайк»', 'Соцсети', 3, (c, t, D) => {
    const e = env(t, D), tc = 1.25, on = t >= tc, pulse = on ? 1 + .05 * Math.sin(Math.PI * cl((t - tc) / .3)) : 1;
    wk(c, 512, 512, { k: e.k * pulse, a: e.a }, () => { const ix = cta(c, 'Поставь лайк', 60);
      burst(c, ix, 512, t, tc, { n: 10, R: 110, s: 9, lw: 10 });
      const k = on ? .5 + .5 * spr(t - tc, 16, .35) : 1 - .12 * prs(t, tc); c.save(); c.translate(ix, 512); c.scale(k, k); if (on) ic(c, 'heart', 0, 0, 96, '#FF3040'); else ic(c, 'heart', 0, 0, 90, '#FF3040', 2.2); c.restore();
      touch(c, ix + 14, 528, t, tc, 44); });
  });
  A('f-save', '«Сохрани себе»', 'Соцсети', 3, (c, t, D) => {
    const e = env(t, D), tc = 1.25, on = t >= tc;
    wk(c, 512, 512, e, () => { const ix = cta(c, 'Сохрани себе', 60), dy = on ? -26 * Math.sin(Math.PI * cl((t - tc) / .3)) : 0;
      c.save(); c.translate(ix, 512 + dy); const k = 1 - .12 * prs(t, tc); c.scale(k, on ? 1 + .12 * Math.sin(Math.PI * cl((t - tc - .3) / .2)) * (t > tc + .3 ? 1 : 0) : k);
      if (on) ic(c, 'bookmark', 0, 0, 96, '#111'); else ic(c, 'bookmark', 0, 0, 90, '#111', 2.1); c.restore();
      touch(c, ix + 14, 528, t, tc, 44); });
  });
  A('f-share', '«Поделись с другом»', 'Соцсети', 3, (c, t, D) => {
    const e = env(t, D), tc = 1.2;
    wk(c, 512, 512, e, () => { const ix = cta(c, 'Поделись с другом', 56), fl = cl((t - tc) / .55), back = spr(t - tc - .75, 14, .5);
      c.save(); rr(c, ix - 80, 512 - 80, 160, 160, 80); c.clip();
      if (t < tc) { const k = 1 - .12 * prs(t, tc); ic(c, 'send', ix, 512, 86 * k, '#111', 0, -.35); }
      else { if (fl < 1) { c.save(); c.globalAlpha *= 1 - fl; ic(c, 'send', ix + 220 * ein(fl), 512 - 160 * ein(fl), 86, '#111', 0, -.35); c.restore(); } if (back > 0) ic(c, 'send', ix, 512, 86 * Math.max(0, back), '#0A84FF', 0, -.35); }
      c.restore();
      if (t >= tc && fl < 1) { c.save(); c.globalAlpha *= (1 - fl) * .5; c.strokeStyle = '#111'; c.lineWidth = 5; c.setLineDash([2, 14]); c.lineCap = 'round'; c.beginPath(); c.moveTo(ix, 512); c.lineTo(ix + 220 * ein(fl), 512 - 160 * ein(fl)); c.stroke(); c.restore(); }
      touch(c, ix + 10, 526, t, tc, 44); });
  });
  A('f-comment', '«Напиши комментарий»', 'Соцсети', 3.5, (c, t, D) => {
    const e = env(t, D), tc = 1.1;
    wk(c, 512, 560, e, () => { c.save(); c.translate(0, 70); const ix = cta(c, 'Напиши комментарий', 54);
      c.save(); c.translate(ix, 512); const k = 1 - .12 * prs(t, tc); c.scale(k, k); c.lineWidth = 9; c.strokeStyle = '#111'; c.lineJoin = 'round';
      c.beginPath(); c.arc(0, -4, 38, Math.PI * .72, Math.PI * .62 + TAU); c.lineTo(-38, 36); c.closePath(); c.stroke(); c.restore();
      touch(c, ix + 12, 526, t, tc, 44); c.restore();
      const bk = spr(t - tc - .1, 14, .55), bw = 300, bx = ix - 30, by = 340;
      wk(c, bx, by + 120, { k: bk, a: cl((t - tc - .1) / .1) }, () => { card(c, bx, by, bw, 120, 44, '#fff', .9);
        if (t < 2.3) for (let i = 0; i < 3; i++) circ(c, bx + bw / 2 - 50 + i * 50, by + 60, 14, `rgba(60,60,67,${.35 + .45 * Math.max(0, Math.sin(t * 9 - i * .9))})`);
        else { const k2 = spr(t - 2.3, 16, .5); c.save(); c.translate(bx + bw / 2, by + 60); c.scale(k2, k2); T(c, '🔥🔥🔥', 0, 0, 58, '#111'); c.restore(); } });
    });
  });
  A('f-bell', 'Колокольчик уведомлений со счётчиком', 'Соцсети', 2.5, (c, t, D) => {
    const e = env(t, D), rot = Math.sin(t * 22) * .38 * Math.exp(-((t - .5) % 1 + 1) % 1 * 2.5) * (t > .35 ? 1 : 0);
    wk(c, 512, 512, e, () => { card(c, 512 - 170, 512 - 170, 340, 340, 90, '#fff', 1);
      c.save(); c.translate(512, 400); c.rotate(rot); c.translate(-512, -400); ic(c, 'bell', 512, 516, 210, '#111'); c.restore();
      const n = t < 1.1 ? 1 : t < 1.6 ? 2 : 3, tn = n === 1 ? .5 : n === 2 ? 1.1 : 1.6, k = spr(t - .5, 15, .4) * (1 + .25 * Math.sin(Math.PI * cl((t - tn) / .25)) * (n > 1 ? 1 : 0));
      if (k > 0) { c.save(); c.translate(512 + 128, 512 - 128); c.scale(k, k); sh(c, .5); circ(c, 0, 0, 60, '#FF3B30'); nosh(c); c.lineWidth = 8; c.strokeStyle = '#fff'; c.stroke(); T(c, String(n), 0, 2, 64, '#fff'); c.restore(); } });
  });
  A('f-cursor-click', 'Курсор нажимает кнопку', 'Соцсети', 3, (c, t, D) => {
    const e = env(t, D), tc = 1.4, pr = prs(t, tc), fl = Math.max(0, 1 - Math.abs(t - tc - .05) / .25);
    wk(c, 512, 512, e, () => { c.save(); c.translate(512, 512); c.scale(1 - .06 * pr, 1 - .06 * pr); sh(c, 1); rr(c, -230, -70, 460, 140, 70); c.fillStyle = grad(c, -230, -70, 230, 70, ['#3A9BFF', '#0A6CFF']); c.fill(); nosh(c);
      c.fillStyle = `rgba(255,255,255,${.25 * fl})`; c.fill(); T(c, 'Нажми', 0, 0, 58, '#fff'); c.restore();
      ripple(c, 540, 530, t, tc, '255,255,255', 90, .55); burst(c, 540, 530, t, tc + .02, { n: 3, R: 95, s: 9, ring: false, lines: true, rot: -2.1, cols: ['#fff'] });
      const [px, py] = track(t, [[.3, 1080, 1000], [1.25, 540, 530], [2.3, 540, 530], [2.75, 1100, 1000]]); cursor(c, px, py, pr);
    });
  });
  A('f-tap', 'Касание пальцем (двойной тап)', 'Соцсети', 2, (c, t) => { touch(c, 512, 512, t, .55, 80); touch(c, 512, 512, t, .95, 80); });
  A('f-actions', 'Ряд: лайк, комментарий, отправить, сохранить', 'Соцсети', 3.5, (c, t, D) => {
    const e = env(t, D), t1 = 1.6, t2 = 2.5, xs = [210, 365, 520, 814], y = 512;
    xs.forEach((x, i) => { const k = spr(t - .1 * i, 15, .45) * (1 - .3 * ein(cl((t - (D - .3)) / .3))), a = cl((t - .1 * i) / .06) * (1 - ein(cl((t - (D - .3)) / .3)));
      wk(c, x, y, { k, a }, () => { c.save(); sh(c, .7);
        if (i === 0) { const on = t >= t1, kk = on ? .55 + .45 * spr(t - t1, 16, .35) : 1 - .12 * prs(t, t1); c.translate(x, y); c.scale(kk, kk); if (on) ic(c, 'heart', 0, 0, 130, '#FF3040'); else ic(c, 'heart', 0, 0, 124, '#fff', 1.9); }
        else if (i === 1) { c.lineWidth = 11; c.strokeStyle = '#fff'; c.lineJoin = 'round'; c.beginPath(); c.arc(x, y - 4, 50, Math.PI * .72, Math.PI * .62 + TAU); c.lineTo(x - 50, y + 46); c.closePath(); c.stroke(); }
        else if (i === 2) ic(c, 'send', x, y, 116, '#fff', 1.8, -.35);
        else { const on = t >= t2; if (on) ic(c, 'bookmark', x, y, 126, '#fff'); else ic(c, 'bookmark', x, y, 120, '#fff', 1.9); }
        c.restore(); }); });
    burst(c, xs[0], y, t, t1, { n: 10, R: 120, s: 9, lw: 10 }); touch(c, xs[0] + 14, y + 16, t, t1, 46); touch(c, xs[3] + 10, y + 16, t, t2, 46);
  });

  /* =====================================================================
     2. Вопросы и опросы
     ===================================================================== */
  function qSticker(c, typed, t) { const X = 172, Y = 332, w = 680, h = 360;
    card(c, X, Y, w, h, 44); c.save(); rr(c, X, Y, w, h, 44); c.clip(); c.fillStyle = grad(c, X, Y, X + w, Y + 190, ['#833AB4', '#FD1D1D', '#FCB045']); c.fillRect(X, Y, w, 190); c.restore();
    T(c, 'Задай мне вопрос', X + w / 2, Y + 116, 50, '#fff');
    rr(c, X + 40, Y + 226, w - 80, 96, 26); c.fillStyle = '#F0F0F0'; c.fill();
    if (typed == null) T(c, 'Напиши ответ…', X + w / 2, Y + 274, 34, '#9A9A9A', 'm');
    else { T(c, typed, X + 72, Y + 274, 34, '#111', 'm', 'left'); if (Math.floor(t * 2.5) % 2 === 0 || typed.length && typed.length < 25) { const cw = TW(c, typed, 34, 'm'); c.fillStyle = '#FD1D1D'; c.fillRect(X + 76 + cw, Y + 252, 4, 44); } }
    circ(c, X + w / 2, Y, 62, '#fff'); avatar(c, X + w / 2, Y, 52, '#C13584', '#F77737'); }
  A('f-q-sticker', 'Стикер «Задай мне вопрос»', 'Вопросы и опросы', 3, (c, t, D) => { const e = env(t, D); e.r = Math.sin(t * 2.6) * .025 * cl(t * 2); wk(c, 512, 512, e, () => qSticker(c, null, t)); });
  A('f-q-answer', 'Вопрос печатается в стикере', 'Вопросы и опросы', 4, (c, t, D) => { const e = env(t, D), s = 'Как монтировать быстрее?', n = Math.floor(cl((t - .9) / 1.6) * s.length); wk(c, 512, 512, e, () => qSticker(c, t < .9 ? null : s.slice(0, n), t)); });

  A('f-poll', 'Опрос: два варианта заполняются', 'Вопросы и опросы', 3.5, (c, t, D) => {
    const e = env(t, D), tc = 1.35, X = 152, Y = 262, w = 720, h = 500, f = eo(cl((t - tc - .05) / .9));
    wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 44); T(c, 'Что снимаем дальше?', X + w / 2, Y + 92, 46, '#111');
      [['Рилс', .68, Y + 172], ['Влог', .32, Y + 312]].forEach(([s, v, y], i) => { const ox = X + 44, ow = w - 88, oh = 112;
        rr(c, ox, y, ow, oh, 30); c.fillStyle = '#F2F2F7'; c.fill();
        const bw = ow * v * f; if (bw > 1) { c.save(); rr(c, ox, y, ow, oh, 30); c.clip(); rr(c, ox, y, bw, oh, 30); c.fillStyle = i ? '#D8D8E0' : grad(c, ox, 0, ox + ow * .7, 0, ['#7B61FF', '#2F80FF']); c.fill(); c.restore(); }
        const wc = !i && f > .25; T(c, s, ox + 40, y + oh / 2, 40, wc ? '#fff' : '#111', 'b', 'left');
        if (f > 0) { c.save(); c.globalAlpha *= cl(f * 3); T(c, Math.round(v * 100 * f) + '%', ox + ow - 36, y + oh / 2, 40, '#111', 'b', 'right'); c.restore(); }
        if (!i && t >= tc) { const k = spr(t - tc, 16, .5); c.save(); c.translate(ox + 40 + TW(c, s, 40) + 40, y + oh / 2); c.scale(k, k); circ(c, 0, 0, 22, '#fff'); ic(c, 'check', 0, 0, 30, '#2F80FF'); c.restore(); } });
      touch(c, X + 260, Y + 228, t, tc, 46); });
  });

  A('f-quiz', 'Викторина: верный ответ', 'Вопросы и опросы', 3.5, (c, t, D) => {
    const e = env(t, D), tc = 1.4, on = t >= tc, X = 152, Y = 222, w = 720, h = 580, opts = ['Вариант А', 'Вариант Б', 'Вариант В'], good = 1;
    wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 44); T(c, 'Какой вариант верный?', X + w / 2, Y + 90, 44, '#111');
      opts.forEach((s, i) => { const y = Y + 160 + i * 132, ox = X + 44, ow = w - 88, oh = 108, isG = i === good, f = on ? ss((t - tc) / .25) : 0, shake = 0;
        c.save(); c.globalAlpha *= isG ? 1 : 1 - .45 * f;
        const k = isG && on ? 1 + .06 * Math.sin(Math.PI * cl((t - tc) / .3)) : 1; c.translate(ox + ow / 2 + shake, y + oh / 2); c.scale(k, k);
        rr(c, -ow / 2, -oh / 2, ow, oh, 30); c.fillStyle = '#F2F2F7'; c.fill(); if (isG && f > 0) { c.save(); c.globalAlpha *= f; c.fillStyle = grad(c, -ow / 2, 0, ow / 2, 0, ['#2F80FF', '#7B61FF']); c.fill(); c.restore(); }
        circ(c, -ow / 2 + 56, 0, 26, isG && f > .5 ? '#fff' : '#fff'); c.lineWidth = 4; c.strokeStyle = isG && f > .5 ? '#fff' : '#C7C7CC'; c.stroke();
        if (isG && f > .5) ic(c, 'check', -ow / 2 + 56, 0, 36, '#2F80FF');
        T(c, s, -ow / 2 + 104, 0, 38, isG && f > .5 ? '#fff' : '#111', 'b', 'left'); c.restore(); });
      confetti(c, 512, Y + 160 + good * 132 + 54, t, tc + .05, 28, 420);
      touch(c, X + 300, Y + 160 + good * 132 + 60, t, tc, 46); });
  });

  A('f-slider', 'Слайдер-эмодзи «Насколько полезно?»', 'Вопросы и опросы', 3, (c, t, D) => {
    const e = env(t, D), X = 152, Y = 342, w = 720, h = 340, x0 = X + 70, x1 = X + w - 70, p = .88 * eio(cl((t - .8) / 1.1)), drag = t > .7 && t < 2.05 ? 1 : 0, dk = ss((t - .7) / .15) * (1 - ss((t - 1.9) / .2));
    wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 44); T(c, 'Насколько полезно?', X + w / 2, Y + 96, 46, '#111');
      const ty = Y + 222; rr(c, x0, ty - 11, x1 - x0, 22, 11); c.fillStyle = '#E5E5EA'; c.fill(); const tx = lerp(x0, x1, p);
      rr(c, x0, ty - 11, tx - x0, 22, 11); c.fillStyle = grad(c, x0, 0, x1, 0, ['#FFB800', '#FF6A3D', '#FF2D55']); c.fill();
      c.save(); c.translate(tx, ty - 6); c.scale(1 + .4 * dk, 1 + .4 * dk); c.rotate(Math.sin(t * 9) * .12 * dk); T(c, '😍', 0, 0, 104, '#000'); c.restore(); void drag; });
  });

  A('f-yesno', '«ДА / НЕТ»', 'Вопросы и опросы', 3, (c, t, D) => {
    const tc = 1.45, on = t >= tc, f = ss((t - tc) / .25);
    [['ДА', 300, '#2F80FF', 0], ['НЕТ', 724, '#FF3B30', .12]].forEach(([s, x, col, d], i) => { const e = env(t, D, d); let k = e.k, a = e.a;
      if (on) { if (i === 0) k *= 1 + .1 * spr(t - tc, 14, .4); else { k *= 1 - .12 * f; a *= 1 - .6 * f; } }
      wk(c, x, 512, { k: k * (1 - (i === 0 ? .06 * prs(t, tc) : 0)), a }, () => { c.save(); sh(c, 1); rr(c, x - 170, 512 - 90, 340, 180, 90); c.fillStyle = col; c.fill(); c.restore();
        if (i === 0 && on) { const k2 = spr(t - tc - .05, 16, .5), w2 = TW(c, s, 84, 'k'); T(c, s, x + 22 * Math.min(1, k2), 512, 84, '#fff', 'k'); c.save(); c.translate(x - w2 / 2 - 22, 512); c.scale(k2, k2); ic(c, 'check', 0, 0, 56, '#fff'); c.restore(); }
        else T(c, s, x, 512, 84, '#fff', 'k'); }); });
    burst(c, 300, 512, t, tc + .02, { n: 10, R: 240, s: 12, lw: 12, ring: false, cols: ['#2F80FF', '#7B61FF', '#FFCC00'] });
    const e = env(t, D); c.save(); c.globalAlpha *= e.a; const [px, py] = track(t, [[.3, 1080, 1000], [1.3, 320, 540], [2.3, 320, 540], [2.75, 1100, 1000]]); cursor(c, px, py, prs(t, tc)); c.restore();
  });

  A('f-rating', 'Оценка: пять звёзд', 'Вопросы и опросы', 2.5, (c, t, D) => {
    const e = env(t, D);
    wk(c, 512, 512, e, () => { card(c, 92, 412, 840, 200, 100, '#fff', 1);
      for (let i = 0; i < 5; i++) { const x = 212 + i * 150, tc = .55 + i * .16, on = t >= tc, k = on ? .6 + .4 * spr(t - tc, 17, .38) : 1;
        c.save(); c.translate(x, 512); c.scale(k, k); ic(c, 'star', 0, 0, 128, on ? '#FFC400' : '#E5E5EA'); c.restore(); burst(c, x, 512, t, tc, { n: 6, R: 85, s: 6, ring: false, lines: true, cols: ['#FFC400'] }); } });
  });

  A('f-vs', '«Или / или»: выбор из двух', 'Вопросы и опросы', 3, (c, t, D) => {
    const e1 = env(t, D, 0), e2 = env(t, D, .1), slideA = 1 - eo(cl(t / .5)), slideB = 1 - eo(cl((t - .1) / .5));
    wk(c, 300 - 300 * slideA, 512, Object.assign(e1, { r: -.06 }), () => { c.save(); c.translate(-300 * slideA, 0); card(c, 300 - 180, 512 - 240, 360, 480, 50, grad(c, 120, 272, 480, 752, ['#5E9BFF', '#2F5BFF']), 1); T(c, 'А', 300, 500, 230, '#fff', 'k'); c.restore(); });
    wk(c, 724 + 300 * slideB, 512, Object.assign(e2, { r: .06 }), () => { c.save(); c.translate(300 * slideB, 0); card(c, 724 - 180, 512 - 240, 360, 480, 50, grad(c, 544, 272, 904, 752, ['#FF7A59', '#FF2D55']), 1); T(c, 'Б', 724, 500, 230, '#fff', 'k'); c.restore(); });
    const e3 = env(t, D, .55); e3.k *= 1 + .07 * Math.max(0, Math.sin((t - .9) * 7)); wk(c, 512, 512, e3, () => { c.save(); sh(c, 1); circ(c, 512, 512, 96, '#fff'); c.restore(); T(c, 'или', 512, 506, 56, '#111', 'k'); });
  });

  /* =====================================================================
     3. Экраны
     ===================================================================== */
  function phone(c, cx, cy, h, land) { c.save(); c.translate(cx, cy); if (land) c.rotate(-Math.PI / 2); const w = h * .49, r = w * .19;
    sh(c, 1.1); rr(c, -w / 2, -h / 2, w, h, r); c.fillStyle = grad(c, -w / 2, 0, w / 2, 0, ['#6a6c72', '#2b2c30', '#232427', '#2b2c30', '#6a6c72']); c.fill(); nosh(c);
    c.fillStyle = '#3a3b40'; [[-1, -.29, .05], [-1, -.2, .09], [-1, -.08, .09], [1, -.18, .13]].forEach(([s, y, hh]) => { rr(c, s < 0 ? -w / 2 - 6 : w / 2 - 1, h * y, 7, h * hh, 3); c.fill(); });
    const b = w * .022; rr(c, -w / 2 + b, -h / 2 + b, w - 2 * b, h - 2 * b, r - b); c.fillStyle = '#050505'; c.fill();
    const s = w * .052; rr(c, -w / 2 + s, -h / 2 + s, w - 2 * s, h - 2 * s, r - s); c.fillStyle = KEY; c.fill();
    rr(c, -w * .16, -h / 2 + s + h * .016, w * .32, h * .037, h * .0185); c.fillStyle = '#000'; c.fill();
    rr(c, -w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3, r); c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 2.5; c.stroke(); c.restore(); }
  A('f-phone', 'Телефон с зелёным экраном', 'Экраны', 3, (c, t, D) => { const e = env(t, D); wk(c, 512, 512, e, () => phone(c, 512, 512 + Math.sin(t * 2.2) * 8, 920)); });
  A('f-phone-in', 'Телефон с зелёным экраном влетает', 'Экраны', 3, (c, t, D) => { const k = spr(t, 9, .55), o = ein(cl((t - (D - .35)) / .35));
    c.save(); c.globalAlpha = cl(t / .1) * (1 - o); c.translate(512, 512 + (1 - k) * 900 + o * 900); c.rotate((1 - k) * -.5 + o * .4); phone(c, 0, 0, 920); c.restore(); });
  A('f-phone-h', 'Телефон горизонтально с зелёным экраном', 'Экраны', 3, (c, t, D) => { const e = env(t, D); e.r = (1 - cl(spr(t, 10, .6))) * .2; wk(c, 512, 512, e, () => phone(c, 512, 512 + Math.sin(t * 2.2) * 6, 940, true)); });

  A('f-browser', 'Окно браузера с зелёным экраном', 'Экраны', 3, (c, t, D) => {
    const e = env(t, D), X = 62, Y = 192, w = 900, h = 640;
    wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 24, '#F2F2F7', 1.1); c.save(); rr(c, X, Y, w, h, 24); c.clip(); c.fillStyle = KEY; c.fillRect(X, Y + 76, w, h - 76); c.restore();
      [0, 1, 2].forEach(i => circ(c, X + 38 + i * 30, Y + 38, 10, ['#FF5F57', '#FEBC2E', '#C7C7CC'][i]));
      rr(c, X + w / 2 - 240, Y + 18, 480, 42, 12); c.fillStyle = '#fff'; c.fill(); ic(c, 'lock', X + w / 2 - 106, Y + 39, 20, '#8E8E93'); T(c, 'твой-сайт.рф', X + w / 2 + 10, Y + 39, 22, '#3C3C43', 'm'); });
  });

  A('f-chat', 'Чат: сообщения и «печатает…»', 'Экраны', 4.5, (c, t, D) => {
    const e = env(t, D), X = 212, Y = 92, w = 600, h = 840;
    wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 60, '#fff', 1);
      avatar(c, X + 80, Y + 76, 36, '#FF9A8B', '#FF6A88', 'А'); T(c, 'Аня', X + 132, Y + 62, 32, '#111', 'b', 'left'); T(c, 'в сети', X + 132, Y + 98, 22, '#8E8E93', 'm', 'left');
      c.fillStyle = '#E5E5EA'; c.fillRect(X, Y + 146, w, 2);
      const msgs = [[.35, 0, 'Привет! Видела новый ролик?'], [1.05, 1, 'Да! Монтаж просто огонь 🔥'], [2.45, 0, 'Научишь так же? 🙏'], [3.15, 1, 'Конечно! Скину урок 😉']];
      let y = Y + 186; const px = 36, pad = 30, lh = 46;
      const bubble = (mine, lines, k) => { const bw = Math.max(...lines.map(l => TW(c, l, px, 'm'))) + pad * 2, bh = lines.length * lh + 34, bx = mine ? X + w - 30 - bw : X + 30;
        wk(c, mine ? bx + bw : bx, y + bh, { k, a: cl(k * 4) }, () => { rr(c, bx, y, bw, bh, 30); c.fillStyle = mine ? '#0A84FF' : '#E9E9EB'; c.fill(); lines.forEach((l, i) => T(c, l, bx + pad, y + 17 + lh * (i + .5), px, mine ? '#fff' : '#111', 'm', 'left')); }); return bh; };
      msgs.forEach(([tm, mine, s], i) => { if (i === 2 && t > 1.6 && t < tm) { const k = spr(t - 1.6, 15, .55); wk(c, X + 30, y + 74, { k, a: cl(k * 4) }, () => { rr(c, X + 30, y, 150, 74, 30); c.fillStyle = '#E9E9EB'; c.fill(); for (let j = 0; j < 3; j++) circ(c, X + 30 + 42 + j * 33, y + 37, 10, `rgba(60,60,67,${.3 + .5 * Math.max(0, Math.sin(t * 9 - j * .9))})`); }); }
        if (t < tm) return; const lines = wrap(c, s, px, 'm', 420); y += bubble(mine, lines, spr(t - tm, 15, .55)) + 20; }); });
  });

  // баннер уведомления в стиле iOS
  function banner(c, x, y, w, ico, title, body, time = 'сейчас') { const h = 168; card(c, x, y, w, h, 44, 'rgba(255,255,255,.97)', .9);
    rr(c, x + 30, y + 38, 92, 92, 22); c.fillStyle = grad(c, x + 30, y + 38, x + 122, y + 130, ico[0]); c.fill(); ic(c, ico[1], x + 76, y + 84, 54, '#fff');
    T(c, title, x + 148, y + 64, 32, '#111', 'b', 'left'); T(c, body, x + 148, y + 108, 28, '#3C3C43', 'm', 'left'); T(c, time, x + w - 34, y + 64, 23, '#8E8E93', 'm', 'right'); return h; }
  A('f-notif', 'Уведомление падает сверху', 'Экраны', 3, (c, t, D) => {
    const k = spr(t - .1, 11, .6), o = ein(cl((t - (D - .4)) / .4)), y = lerp(180, 428, k) - o * 260;
    c.save(); c.globalAlpha = cl((t - .1) / .15) * (1 - o); banner(c, 72, y, 880, [['#FF5E7E', '#FF9500'], 'person'], 'Новый подписчик', 'На тебя подписались ещё 120 человек'); c.restore();
  });
  A('f-notif-stack', 'Стопка уведомлений', 'Экраны', 3.5, (c, t, D) => {
    const L = [[.2, [['#FF5E7E', '#FF2D55'], 'heart'], 'Лайки', 'Твой рилс набрал 1 000 лайков'], [.85, [['#5AC8FA', '#0A84FF'], 'send'], 'Комментарии', 'Аня: Это шедевр 😍'], [1.5, [['#BF5AF2', '#5E5CE6'], 'person'], 'Подписчики', '+250 новых подписчиков']];
    const o = ein(cl((t - (D - .35)) / .35)), top = 512 - (3 * 168 + 2 * 22) / 2;
    c.save(); c.globalAlpha = 1 - o; c.translate(0, -o * 120);
    L.forEach(([tm, ico, ti, b], i) => { if (t < tm) return; let slot = 0; for (let j = i + 1; j < L.length; j++) slot += spr(t - L[j][0], 12, .7); const k = spr(t - tm, 12, .62);
      const y = top + slot * 190 - (1 - k) * 90; c.save(); c.globalAlpha *= cl((t - tm) / .15); const s = .94 + .06 * k; c.translate(512, y + 84); c.scale(s, s); c.translate(-512, -(y + 84)); banner(c, 72, y, 880, ico, ti, b, i === 2 ? 'сейчас' : (L.length - 1 - i) + ' мин'); c.restore(); });
    c.restore();
  });

  A('f-call', 'Входящий вызов', 'Экраны', 3.5, (c, t, D) => {
    const e = env(t, D), X = 222, Y = 72, w = 580, h = 880, ans = 2.3, kn = t < ans ? 18 * Math.max(0, Math.sin((t - .6) * 5)) * (t > .6 ? 1 : 0) : 0, slide = eio(cl((t - ans) / .35)), on = t > ans + .35;
    wk(c, 512, 512, e, () => { c.save(); sh(c, 1.1); rr(c, X, Y, w, h, 70); c.fillStyle = grad(c, X, Y, X + w, Y + h, ['#3A4A6B', '#1E2233', '#121420']); c.fill(); c.restore();
      T(c, on ? '00:0' + Math.min(9, Math.floor((t - ans - .35) * 1.5 + 1)) : 'мобильный', X + w / 2, Y + 140, 30, 'rgba(255,255,255,.7)', 'm'); T(c, 'Клиент', X + w / 2, Y + 200, 66, '#fff');
      const ay = Y + 420; for (let i = 0; i < 2; i++) { const p = ((t * .8 + i * .5) % 1); if (!on) { c.save(); c.globalAlpha *= (1 - p) * .35; c.lineWidth = 4; c.strokeStyle = '#fff'; circ(c, X + w / 2, ay, 112 + p * 90); c.stroke(); c.restore(); } }
      avatar(c, X + w / 2, ay, 112, '#A1A1AA', '#5B5B66', 'К');
      const tx = X + 50, tw = w - 100, ty = Y + 720, th = 124; c.save(); c.globalAlpha *= 1 - ss((t - ans - .3) / .2); rr(c, tx, ty, tw, th, th / 2); c.fillStyle = 'rgba(255,255,255,.16)'; c.fill();
      c.save(); rr(c, tx, ty, tw, th, th / 2); c.clip(); c.font = `30px "${FN.m}"`; c.textAlign = 'center'; c.textBaseline = 'middle'; const gx = tx + ((t * .7) % 1) * tw * 1.6 - tw * .3, g = c.createLinearGradient(gx - 120, 0, gx + 120, 0); g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(.5, '#fff'); g.addColorStop(1, 'rgba(255,255,255,.45)'); c.fillStyle = g; c.font = `27px "${FN.m}"`; c.fillText('смахни, чтобы ответить', tx + 124 + (tw - 124) / 2 - 6, ty + th / 2 + 2); c.restore();
      const kx = tx + 62 + kn + slide * (tw - 124); circ(c, kx, ty + th / 2, 52, '#fff'); ic(c, 'phone', kx, ty + th / 2, 50, '#1C1C1E'); c.restore(); });
  });

  A('f-loading', 'Загрузка видео до 100%', 'Экраны', 3, (c, t, D) => {
    const e = env(t, D), X = 132, Y = 382, w = 760, h = 260, q = cl((t - .35) / 1.9), p = q < .4 ? eo(q / .4) * .42 : q < .55 ? .42 : q < .85 ? .42 + eio((q - .55) / .3) * .45 : .87 + eo((q - .85) / .15) * .13, done = t > 2.35;
    wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 44); const f = ss((t - 2.35) / .2);
      c.save(); c.globalAlpha *= 1 - f; T(c, 'Загрузка видео…', X + 54, Y + 90, 40, '#111', 'b', 'left'); T(c, Math.round(p * 100) + '%', X + w - 54, Y + 90, 40, '#0A84FF', 'b', 'right'); c.restore();
      if (done) { c.save(); c.globalAlpha *= f; T(c, 'Готово!', X + 54, Y + 90, 40, '#111', 'b', 'left'); const k = spr(t - 2.35, 16, .45); c.translate(X + w - 84, Y + 90); c.scale(k, k); circ(c, 0, 0, 32, '#0A84FF'); ic(c, 'check', 0, 0, 42, '#fff'); c.restore(); }
      rr(c, X + 54, Y + 160, w - 108, 26, 13); c.fillStyle = '#E5E5EA'; c.fill(); rr(c, X + 54, Y + 160, (w - 108) * p, 26, 13); c.fillStyle = grad(c, X + 54, 0, X + w - 54, 0, ['#0A84FF', '#5E5CE6']); c.fill(); });
  });

  // ретро-окно ошибки
  function errWin(c, x, y) { const w = 600, h = 290; c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 0; c.shadowOffsetX = 10; c.shadowOffsetY = 10; c.fillStyle = '#C3C3C3'; c.fillRect(x, y, w, h); c.restore();
    c.fillStyle = '#fff'; c.fillRect(x, y, w, 3); c.fillRect(x, y, 3, h); c.fillStyle = '#5A5A5A'; c.fillRect(x, y + h - 3, w, 3); c.fillRect(x + w - 3, y, 3, h);
    c.fillStyle = grad(c, x + 6, 0, x + w - 6, 0, ['#000A80', '#1484D4']); c.fillRect(x + 6, y + 6, w - 12, 46); T(c, 'Ошибка', x + 22, y + 30, 26, '#fff', 'b', 'left');
    c.fillStyle = '#C3C3C3'; c.fillRect(x + w - 48, y + 12, 34, 32); c.fillStyle = '#fff'; c.fillRect(x + w - 48, y + 12, 34, 2); c.fillRect(x + w - 48, y + 12, 2, 32); c.fillStyle = '#5A5A5A'; c.fillRect(x + w - 48, y + 42, 34, 2); c.fillRect(x + w - 16, y + 12, 2, 32); ic(c, 'close', x + w - 31, y + 28, 26, '#000');
    circ(c, x + 74, y + 128, 38, '#E81123'); ic(c, 'close', x + 74, y + 128, 50, '#fff');
    T(c, 'Ошибка 404', x + 138, y + 110, 34, '#000', 'b', 'left'); T(c, 'Страница не найдена', x + 138, y + 152, 27, '#000', 'm', 'left');
    const bx = x + w - 186, by = y + h - 76; c.fillStyle = '#C3C3C3'; c.fillRect(bx, by, 160, 52); c.fillStyle = '#fff'; c.fillRect(bx, by, 160, 3); c.fillRect(bx, by, 3, 52); c.fillStyle = '#5A5A5A'; c.fillRect(bx, by + 49, 160, 3); c.fillRect(bx + 157, by, 3, 52); T(c, 'ОК', bx + 80, by + 27, 26, '#000'); }
  A('f-error', 'Окна «Ошибка 404» сыплются', 'Экраны', 3, (c, t, D) => { const o = cl((t - (D - .2)) / .2);
    for (let i = 0; i < 5; i++) { const tm = .15 + i * .22; if (t < tm || o >= 1) continue; const k = t - tm < .05 ? .92 : 1, sx = i === 4 && t > 1.5 && t < 2.1 ? Math.sin(t * 70) * 10 * (1 - (t - 1.5) / .6) : 0, x = 110 + i * 42 + sx, y = 150 + i * 70;
      c.save(); c.translate(x + 300, y + 145); c.scale(k, k); c.translate(-(x + 300), -(y + 145)); errWin(c, x, y); c.restore(); } });

  /* =====================================================================
     4. Счётчики и таймеры
     ===================================================================== */
  // «одометр»: цифры перекатываются; v — дробное значение, n — сколько цифр в итоге; рисуется от x влево направо
  function odo(c, v, x, y, px, col, n, f = 'k') { n = Math.min(n, String(Math.floor(v)).length); const dw = TW(c, '0', px, f) * 1.04, gap = dw * .32; let cx = x;
    c.save(); c.beginPath(); c.rect(x - 20, y - px * .62, n * dw + 4 * gap + 40, px * 1.24); c.clip();
    for (let i = n - 1; i >= 0; i--) { const pl = Math.pow(10, i), p = v / pl, d = Math.floor(p) % 10, fr = p - Math.floor(p), roll = i < n - 2 ? 0 : i === 0 ? ss((fr - .5) / .5 + .5) : ss(fr * pl - (pl - 1)), lead = Math.floor(p) === 0 && i > 0;
      [[d, -roll], [(d + 1) % 10, 1 - roll]].forEach(([dd, off], j) => { if (Math.abs(off) >= .999 || (lead && j === 0)) return; c.save(); c.globalAlpha *= 1 - Math.abs(off) * .5; T(c, String(dd), cx + dw / 2, y + off * px * 1.05, px, col, f); c.restore(); });
      cx += dw; if (i % 3 === 0 && i > 0) cx += gap; }
    c.restore(); return cx - x; }
  const odoW = (c, n, px, f = 'k') => { const dw = TW(c, '0', px, f) * 1.04; return n * dw + Math.floor((n - 1) / 3) * dw * .32; };
  function counter(id, name, dur, label, icon, colors, max, n) {
    A(id, name, 'Счётчики и таймеры', dur, (c, t, D) => { const e = env(t, D), px = n > 6 ? 100 : 116, ow = odoW(c, n, px), w = Math.max(640, ow + 300), X = 512 - w / 2, Y = 362, h = 300, v = max * (1 - Math.pow(1 - cl((t - .35) / (D - 1.3)), 4)), end = t > D - .95;
      wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 56);
        const bk = 1 + .12 * Math.max(0, Math.sin(t * 9)) * (end ? 0 : 1) + (end ? .2 * Math.sin(Math.PI * cl((t - (D - .95)) / .3)) : 0); c.save(); c.translate(X + 120, Y + h / 2); c.scale(bk, bk); circ(c, 0, 0, 66, grad(c, -66, -66, 66, 66, colors)); ic(c, icon, 0, 2, 70, '#fff'); c.restore();
        T(c, label, X + 222, Y + 88, 32, '#8E8E93', 'm', 'left'); odo(c, Math.min(max, end ? max : v), X + 222, Y + 186, px, '#111', n); });
      burst(c, 512 - w / 2 + 120, 512, t, D - .95, { n: 12, R: 170, s: 11, lw: 12, cols: colors.concat(['#FFCC00']) }); confetti(c, 512, 380, t, D - .95, 22, 380); });
  }
  counter('f-cnt-subs', 'Счётчик подписчиков до 10 000', 3.5, 'Подписчики', 'person', ['#FF5E7E', '#FF9500'], 10000, 5);
  counter('f-cnt-likes', 'Счётчик лайков до 1 000', 3, 'Лайки', 'heart', ['#FF5E7E', '#FF2D55'], 1000, 4);
  counter('f-cnt-views', 'Счётчик просмотров до 1 000 000', 3.5, 'Просмотры', 'eye', ['#5AC8FA', '#5E5CE6'], 1000000, 7);

  A('f-countdown', 'Обратный отсчёт 3-2-1', 'Счётчики и таймеры', 3, (c, t) => {
    const i = Math.min(2, Math.floor(t)), fr = t - i, n = 3 - i, R = 300;
    c.save(); c.globalAlpha = 1 - cl((t - 2.72) / .26); sh(c, .8); c.lineWidth = 26; c.strokeStyle = 'rgba(255,255,255,.3)'; circ(c, 512, 512, R); c.stroke();
    c.strokeStyle = '#fff'; c.lineCap = 'round'; c.beginPath(); c.arc(512, 512, R, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(.002, 1 - eio(fr))); c.stroke();
    const k = spr(fr, 15, .45) * (1 - .3 * ein(cl((fr - .8) / .2))), a = cl(fr / .05) * (1 - cl((fr - .85) / .15)); c.globalAlpha = a; c.translate(512, 512); c.scale(k, k); T(c, String(n), 0, -6, 400, '#fff', 'k'); c.restore();
  });

  A('f-timer', 'Секундомер', 'Счётчики и таймеры', 3.5, (c, t, D) => {
    const e = env(t, D), tt = Math.max(0, t - .3), X = 102, Y = 397, w = 820, h = 230;
    wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 115, 'rgba(22,22,24,.94)', 1); circ(c, X + 110, Y + h / 2, 24, `rgba(255,59,48,${.45 + .55 * (Math.floor(t * 2) % 2 ? 1 : .3)})`);
      const s = Math.floor(tt), cs = Math.floor((tt - s) * 100), str = '00:0' + s + ',' + String(cs).padStart(2, '0'), cw = TW(c, '0', 112, 'b') * 1.02; let x = X + 175;
      for (const ch of str) { const ww = ch === ':' || ch === ',' ? cw * .45 : cw; T(c, ch, x + ww / 2, Y + h / 2, 112, '#fff', 'b'); x += ww; } });
  });

  A('f-ring', 'Кольцо процентов до 100%', 'Счётчики и таймеры', 3, (c, t, D) => {
    const e = env(t, D), p = eo(cl((t - .3) / 1.7)), done = t > 2.05, f = ss((t - 2.05) / .2);
    wk(c, 512, 512, e, () => { c.save(); sh(c, 1); circ(c, 512, 512, 270, '#fff'); c.restore();
      c.lineWidth = 44; c.strokeStyle = '#EEEEF2'; circ(c, 512, 512, 196); c.stroke();
      c.lineCap = 'round'; c.strokeStyle = grad(c, 316, 316, 708, 708, ['#2F80FF', '#7B61FF', '#FF2D96']); c.beginPath(); c.arc(512, 512, 196, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(.003, p)); c.stroke();
      c.save(); c.globalAlpha *= 1 - f; T(c, Math.round(p * 100) + '%', 512, 512, 118, '#111', 'k'); c.restore();
      if (done) { const k = spr(t - 2.05, 16, .45); c.save(); c.globalAlpha *= f; c.translate(512, 512); c.scale(k, k); ic(c, 'check', 0, 0, 200, '#7B61FF'); c.restore(); } });
  });

  /* =====================================================================
     5. Пиксель-арт (1 бит: чёрные пиксели с белой обводкой — видно на любом фоне)
     ===================================================================== */
  const F5 = {
    'А': ['  #  ', ' # # ', '#   #', '#   #', '#####', '#   #', '#   #'], 'Б': ['#####', '#    ', '#    ', '#### ', '#   #', '#   #', '#### '], 'В': ['#### ', '#   #', '#   #', '#### ', '#   #', '#   #', '#### '],
    'Г': ['#####', '#    ', '#    ', '#    ', '#    ', '#    ', '#    '], 'Е': ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#####'], 'Ж': ['# # #', '# # #', ' ### ', '  #  ', ' ### ', '# # #', '# # #'],
    'З': [' ### ', '#   #', '    #', '  ## ', '    #', '#   #', ' ### '], 'И': ['#   #', '#   #', '#  ##', '# # #', '##  #', '#   #', '#   #'], 'К': ['#   #', '#  # ', '# #  ', '##   ', '# #  ', '#  # ', '#   #'],
    'Л': ['  ###', ' #  #', ' #  #', ' #  #', ' #  #', '#   #', '#   #'], 'М': ['#   #', '## ##', '# # #', '#   #', '#   #', '#   #', '#   #'], 'Н': ['#   #', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
    'О': [' ### ', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '], 'П': ['#####', '#   #', '#   #', '#   #', '#   #', '#   #', '#   #'], 'Р': ['#### ', '#   #', '#   #', '#### ', '#    ', '#    ', '#    '],
    'С': [' ### ', '#   #', '#    ', '#    ', '#    ', '#   #', ' ### '], 'Т': ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '  #  '], 'У': ['#   #', '#   #', '#   #', ' ####', '    #', '#   #', ' ### '],
    '0': [' ### ', '#   #', '#  ##', '# # #', '##  #', '#   #', ' ### '], '1': ['  #  ', ' ##  ', '  #  ', '  #  ', '  #  ', '  #  ', ' ### '], '2': [' ### ', '#   #', '    #', '   # ', '  #  ', ' #   ', '#####'],
    '3': [' ### ', '#   #', '    #', '  ## ', '    #', '#   #', ' ### '], '4': ['   # ', '  ## ', ' # # ', '#  # ', '#####', '   # ', '   # '], '5': ['#####', '#    ', '#### ', '    #', '    #', '#   #', ' ### '],
    '6': ['  ## ', ' #   ', '#    ', '#### ', '#   #', '#   #', ' ### '], '7': ['#####', '    #', '   # ', '  #  ', ' #   ', ' #   ', ' #   '], '8': [' ### ', '#   #', '#   #', ' ### ', '#   #', '#   #', ' ### '],
    '9': [' ### ', '#   #', '#   #', ' ####', '    #', '   # ', ' ##  '], '%': ['##   ', '##  #', '   # ', '  #  ', ' #   ', '#  ##', '   ##'], '?': [' ### ', '#   #', '    #', '   # ', '  #  ', '     ', '  #  '],
    '!': ['  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '     ', '  #  '], '.': ['     ', '     ', '     ', '     ', '     ', '     ', '  #  ']
  };
  function PG(n) { const g = new Uint8Array(n * n); const P = { n, g,
    set(x, y, v = 1) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < n && y < n) g[y * n + x] = v; },
    line(x0, y0, x1, y1, v = 1) { x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let er = dx + dy;
      for (let k = 0; k < 400; k++) { P.set(x0, y0, v); if (x0 === x1 && y0 === y1) break; const e2 = 2 * er; if (e2 >= dy) { er += dy; x0 += sx; } if (e2 <= dx) { er += dx; y0 += sy; } } },
    disc(cx, cy, r, v = 1) { for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) P.set(x, y, v); },
    rect(x, y, w, h, v = 1) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.set(x + i, y + j, v); },
    box(x, y, w, h, v = 1) { for (let i = 0; i < w; i++) { P.set(x + i, y, v); P.set(x + i, y + h - 1, v); } for (let j = 0; j < h; j++) { P.set(x, y + j, v); P.set(x + w - 1, y + j, v); } },
    bmp(rows, x, y, map = { '#': 1, 'B': 1, 'W': 2 }) { rows.forEach((r, j) => [...r].forEach((ch, i) => { if (map[ch] !== undefined) P.set(x + i, y + j, map[ch]); })); },
    text(s, x, y, v = 1) { [...s].forEach((ch, k) => { const gl = F5[ch]; if (gl) gl.forEach((r, j) => [...r].forEach((q, i) => { if (q === '#') P.set(x + k * 7 + i, y + j, v); })); }); },
    textC(s, y, v = 1) { P.text(s, Math.round((n - (s.length * 7 - 2)) / 2), y, v); } }; return P; }
  // 1 — чернила (чёрный), 2 — бумага (белый); вокруг чернил — белая обводка в 1 пиксель
  function pgDraw(c, P, ink = '#000', paper = '#fff') { const { n, g } = P, cell = Math.floor(1024 / n), o = Math.floor((1024 - cell * n) / 2);
    c.fillStyle = paper; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = g[y * n + x]; if (v === 2) { c.fillRect(o + x * cell, o + y * cell, cell, cell); continue; } if (v) continue;
      let near = false; for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < n && yy < n && g[yy * n + xx] === 1) { near = true; break; } }
      if (near) c.fillRect(o + x * cell, o + y * cell, cell, cell); }
    c.fillStyle = ink; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (g[y * n + x] === 1) c.fillRect(o + x * cell, o + y * cell, cell, cell); }
  const q12 = t => Math.floor(t * 12) / 12; // пиксель-арт живёт на 12 кадрах в секунду
  const D2R = Math.PI / 180;
  // человечек-палочка: углы от вертикали вниз (90 — вправо, 180 — вверх)
  function stick(P, pose, ox = 0, oy = 0) { const hip = [20 + ox, 27 + oy], neck = [hip[0] + (pose.lean || 0), hip[1] - 10], sh = [neck[0], neck[1] + 1], head = [neck[0] + (pose.hx || 0), neck[1] - 3.6];
    P.disc(head[0], head[1], 3.1); P.line(neck[0], neck[1], hip[0], hip[1]);
    const limb = (o, a1, a2, l1, l2) => { const e = [o[0] + Math.sin(a1 * D2R) * l1, o[1] + Math.cos(a1 * D2R) * l1], h = [e[0] + Math.sin(a2 * D2R) * l2, e[1] + Math.cos(a2 * D2R) * l2]; P.line(o[0], o[1], e[0], e[1]); P.line(e[0], e[1], h[0], h[1]); return h; };
    return { head, hl: limb(sh, ...pose.aL, 5, 4.6), hr: limb(sh, ...pose.aR, 5, 4.6), fl: limb(hip, ...pose.lL, 5, 5), fr: limb(hip, ...pose.lR, 5, 5) }; }
  const IDLE = { aL: [-22, -10], aR: [22, 10], lL: [-14, -6], lR: [14, 6] };
  const sparkle = (P, x, y, big) => { P.set(x, y); if (big) { P.set(x - 1, y); P.set(x + 1, y); P.set(x, y - 1); P.set(x, y + 1); P.set(x - 2, y); P.set(x + 2, y); P.set(x, y - 2); P.set(x, y + 2); } else { P.set(x - 1, y); P.set(x + 1, y); P.set(x, y - 1); P.set(x, y + 1); } };
  const PX = 'Пиксель-арт';
  A('f-px-wave', 'Пиксельный человечек машет «ПРИВЕТ»', PX, 3, (c, t) => { const tq = q12(t), P = PG(46);
    stick(P, Object.assign({}, IDLE, { aR: [125, 160 + 35 * Math.sin(tq * TAU * 2.2)] }), 3, 3);
    if (tq > .4 && Math.floor(tq * 3) % 4 !== 3) P.textC('ПРИВЕТ', 2); pgDraw(c, P); });
  A('f-px-walk', 'Пиксельный человечек идёт', PX, 3, (c, t) => { const tq = q12(t), P = PG(40), f = tq * TAU * 1.5, s = Math.sin(f), cs = Math.cos(f);
    stick(P, { aL: [-24 * s, -24 * s + 28], aR: [24 * s, 24 * s + 28], lL: [26 * s, 26 * s - 34 * Math.max(0, cs)], lR: [-26 * s, -26 * s - 34 * Math.max(0, -cs)] }, 0, Math.abs(s) > .7 ? -1 : 0);
    const off = Math.floor(tq * 12) % 6; for (let x = -6; x < 46; x += 6) { P.set(x - off + 1, 37); P.set(x - off + 2, 37); P.set(x - off + 3, 37); } pgDraw(c, P); });
  A('f-px-point', 'Пиксельный человечек показывает', PX, 3, (c, t) => { const tq = q12(t), P = PG(40), b = Math.floor(tq * 4) % 2;
    stick(P, { aL: [-50, 45], aR: [88, 90], lL: [-14, -6], lR: [14, 6] }, -6);
    const ax = 27 + b; P.bmp(['  #  ', '   # ', '#####', '   # ', '  #  '].map(r => r), ax, 16); pgDraw(c, P); });
  A('f-px-thumb', 'Пиксельный человечек: палец вверх «КЛАСС»', PX, 3, (c, t) => { const tq = q12(t), P = PG(40), k = cl(tq / .35);
    const r = stick(P, Object.assign({}, IDLE, { aR: [lerp(22, 60, k), lerp(10, 178, k)] }));
    if (k >= 1) { const [hx, hy] = r.hr; P.rect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 3); P.rect(Math.round(hx) - 1, Math.round(hy) - 4, 1, 3);
      const bl = Math.floor(tq * 6) % 2; sparkle(P, Math.round(hx) + 4, Math.round(hy) - 5, bl); sparkle(P, Math.round(hx) - 5, Math.round(hy) - 3, !bl); P.textC('КЛАСС', 2); }
    pgDraw(c, P); });
  A('f-px-dance', 'Пиксельный человечек танцует', PX, 3, (c, t) => { const tq = q12(t), P = PG(40), b = Math.floor(tq * 4) % 4;
    const poses = [{ aL: [-120, -165], aR: [120, 165], lL: [-24, -10], lR: [24, 10] }, { aL: [-60, -100], aR: [120, 170], lL: [-10, -30], lR: [30, 10], lean: 1 },
      { aL: [-100, -40], aR: [100, 40], lL: [-30, 10], lR: [30, -10] }, { aL: [-120, -170], aR: [60, 100], lL: [-30, -10], lR: [10, 30], lean: -1 }];
    stick(P, poses[b], b === 1 ? 1 : b === 3 ? -1 : 0, b === 2 ? 1 : 0);
    const nt = ['  ##', '  # ', '  # ', '###', '## ']; P.bmp(nt.map(r => r.replace(/#/g, '#')), b % 2 ? 6 : 31, b % 2 ? 6 : 9); P.bmp(nt, b % 2 ? 31 : 6, b % 2 ? 10 : 5); pgDraw(c, P); });
  A('f-px-jump', 'Пиксельный человечек прыгает', PX, 2.4, (c, t) => { const tq = q12(t), P = PG(40), s = (tq % 1.2) / 1.2;
    let pose, oy = 0; if (s < .22 || s > .82) { pose = { aL: [-45, -15], aR: [45, 15], lL: [-45, 5], lR: [45, -5] }; oy = 2; }
    else { const k = (s - .22) / .6; oy = -Math.round(Math.sin(k * Math.PI) * 9); pose = { aL: [-120, -150], aR: [120, 150], lL: [-25, 5], lR: [25, -5] }; }
    stick(P, pose, 0, oy); const sw = oy < -4 ? 3 : 5; for (let x = 20 - sw; x <= 20 + sw; x++) P.set(x, 38); pgDraw(c, P); });
  A('f-px-think', 'Пиксельный человечек думает «?»', PX, 3, (c, t) => { const tq = q12(t), P = PG(40);
    stick(P, Object.assign({}, IDLE, { aR: [35, -168] }));
    const b = Math.floor(tq * 3) % 2; P.text('?', 25, 2 + b); if (Math.floor(tq * 6) % 3) { P.set(24, 11); P.set(26, 9 + b); } pgDraw(c, P); });
  const HEART = ['  ##   ##  ', ' #### #### ', '###########', '###########', '###########', ' ######### ', '  #######  ', '   #####   ', '    ###    ', '     #     '];
  A('f-px-heart', 'Пиксельное сердце бьётся', PX, 2, (c, t) => { const tq = q12(t), ph = tq % 1, big = ph < .12 || (ph > .25 && ph < .37), P = PG(big ? 17 : 19);
    P.bmp(HEART, Math.floor((P.n - 11) / 2), Math.floor((P.n - 10) / 2)); P.set(Math.floor((P.n - 11) / 2) + 2, Math.floor((P.n - 10) / 2) + 2, 2); pgDraw(c, P); });
  const CUR = ['B', 'BB', 'BWB', 'BWWB', 'BWWWB', 'BWWWWB', 'BWWWWWB', 'BWWWWWWB', 'BWWWWWWWB', 'BWWWWWWWWB', 'BWWWWWBBBBB', 'BWWBWWB', 'BWB BWWB', 'BB  BWWB', 'B    BWWB', '     BWWB', '      BB'];
  A('f-px-cursor', 'Пиксельный курсор жмёт «ОК»', PX, 3, (c, t) => { const tq = q12(t), P = PG(40), tc = 1.5, down = tq >= tc && tq < tc + .34;
    P.box(7, 13, 26, 17); P.box(8, 14, 24, 15); if (down) { P.rect(9, 15, 22, 13); P.text('ОК', 14, 18, 2); } else P.text('ОК', 14, 18);
    const k = eio(cl((tq - .3) / 1.0)), x = Math.round(lerp(36, 22, k)), y = Math.round(lerp(38, 24, k)) + (down ? 1 : 0); P.bmp(CUR, x, y);
    if (tq >= tc && tq < tc + .5) { const r = Math.floor((tq - tc) * 12 / 2) + 2; [[-1, -1], [1, -1], [-1, 1]].forEach(([dx, dy]) => P.set(x + dx * r, y + dy * r)); }
    pgDraw(c, P); });
  A('f-px-loading', 'Пиксельная загрузка «ГОТОВО!»', PX, 3.5, (c, t) => { const tq = q12(t), P = PG(62), seg = Math.min(10, Math.floor(cl((tq - .2) / 2.3) * 10.99)), done = seg >= 10 && tq > 2.6;
    if (done) { if (Math.floor(tq * 4) % 2 === 0) P.textC('ГОТОВО!', 16); } else if (Math.floor(tq * 3) % 3) P.textC('ЗАГРУЗКА', 16);
    P.box(5, 28, 53, 11); for (let i = 0; i < seg; i++) P.rect(7 + i * 5, 30, 4, 7); P.textC(seg * 10 + '%', 43); pgDraw(c, P); });
  A('f-px-sparkle', 'Пиксельные искры мерцают', PX, 2, (c, t) => { const tq = q12(t), P = PG(32), pts = [[8, 9], [23, 7], [16, 16], [6, 23], [25, 22], [14, 27]];
    pts.forEach(([x, y], i) => { const ph = Math.floor(tq * 8 + i * 3) % 6; if (ph < 4) sparkle(P, x, y, ph === 1 || ph === 2); }); pgDraw(c, P); });
  A('f-px-arrow', 'Пиксельная стрелка «ЖМИ»', PX, 2, (c, t) => { const tq = q12(t), P = PG(40), b = [0, 1, 2, 1][Math.floor(tq * 8) % 4];
    P.textC('ЖМИ', 5); P.bmp(['   #####   ', '   #####   ', '   #####   ', '   #####   ', '   #####   ', '###########', ' ######### ', '  #######  ', '   #####   ', '    ###    ', '     #     '], 15, 16 + b); pgDraw(c, P); });

  /* =====================================================================
     6. Указатели
     ===================================================================== */
  const PT = 'Указатели';
  function bigArrow(c, col) { c.beginPath(); c.moveTo(-50, -230); c.lineTo(50, -230); c.lineTo(50, -20); c.lineTo(140, -20); c.lineTo(0, 170); c.lineTo(-140, -20); c.lineTo(-50, -20); c.closePath(); c.lineJoin = 'round'; c.lineWidth = 34; c.strokeStyle = col; c.fillStyle = col; c.stroke(); c.fill(); }
  A('f-arrow-bounce', 'Стрелка прыгает (вниз)', PT, 2.5, (c, t, D) => { const e = env(t, D), ph = (t * 1.8) % 1, up = Math.abs(Math.sin(ph * Math.PI)), sq = ph < .12 || ph > .88 ? .08 : 0;
    wk(c, 512, 512, e, () => { c.save(); c.translate(512, 470 - up * 90); c.scale(1 + sq, 1 - sq); sh(c, 1); bigArrow(c, '#FFD60A'); c.restore(); }); });
  A('f-arrow-draw', 'Стрелка рисуется маркером', PT, 2.5, (c, t) => { const p = eio(cl((t - .15) / .8)), hp = eo(cl((t - .9) / .25)), o = 1 - cl((t - 2.25) / .25);
    const B = s => { const u = 1 - s; return [u * u * u * 200 + 3 * u * u * s * 260 + 3 * u * s * s * 620 + s * s * s * 820, u * u * u * 800 + 3 * u * u * s * 380 + 3 * u * s * s * 300 + s * s * s * 260]; };
    c.save(); c.globalAlpha = o; sh(c, .6); c.strokeStyle = '#fff'; c.lineWidth = 26; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); for (let i = 0; i <= 60; i++) { const [x, y] = B(p * i / 60); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
    if (hp > 0) { const [x1, y1] = B(1), [x0, y0] = B(.96), a = Math.atan2(y1 - y0, x1 - x0), L = 130 * hp; c.beginPath(); c.moveTo(x1 - Math.cos(a - .55) * L, y1 - Math.sin(a - .55) * L); c.lineTo(x1, y1); c.lineTo(x1 - Math.cos(a + .55) * L, y1 - Math.sin(a + .55) * L); c.stroke(); } c.restore(); });
  A('f-chevrons', 'Шевроны бегут вправо', PT, 2, (c, t, D) => { const e = env(t, D, 0, .25);
    wk(c, 512, 512, e, () => { for (let i = 0; i < 3; i++) { const a = .3 + .7 * Math.max(0, Math.sin((t * 2.2 - i * .18) * TAU)), x = 330 + i * 180; c.save(); c.globalAlpha *= a; sh(c, .7); c.strokeStyle = '#fff'; c.lineWidth = 46; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x - 60, 400); c.lineTo(x + 60, 512); c.lineTo(x - 60, 624); c.stroke(); c.restore(); } }); });
  A('f-press-here', '«Жми сюда» с прыгающей стрелкой', PT, 3, (c, t, D) => { const e = env(t, D), beat = 1 + .05 * Math.max(0, Math.sin(t * 7)) * (t > .5 ? 1 : 0);
    wk(c, 512, 512, { k: e.k * beat, a: e.a }, () => { const w = TW(c, 'Жми сюда', 70) + 140; c.save(); sh(c, 1); rr(c, 512 - w / 2, 600, w, 160, 80); c.fillStyle = grad(c, 0, 600, 0, 760, ['#FF4F7B', '#FF1F4B']); c.fill(); nosh(c); c.clip();
      const sx = ((t * .9) % 1.4) * (w + 400) - 200 + 512 - w / 2, g = c.createLinearGradient(sx - 80, 0, sx + 80, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(512 - w / 2, 600, w, 160); c.restore();
      T(c, 'Жми сюда', 512, 680, 70, '#fff'); });
    const ea = env(t, D, .25), b = Math.abs(Math.sin(t * 5)) * 50; wk(c, 512, 380, ea, () => { c.save(); c.translate(512, 360 + b); c.scale(.62, .62); sh(c, 1.4); bigArrow(c, '#fff'); c.restore(); }); });
  A('f-swipe-up', '«Свайп вверх»', PT, 3, (c, t, D) => { const e = env(t, D), bob = -Math.abs(Math.sin(t * 3)) * 26;
    wk(c, 512, 512, e, () => { c.save(); c.translate(0, bob); for (let i = 0; i < 3; i++) { const a = .25 + .75 * Math.max(0, Math.sin((t * 1.8 + i * .18) * TAU)), y = 520 - i * 95; c.save(); c.globalAlpha *= a; sh(c, .7); c.strokeStyle = '#fff'; c.lineWidth = 34; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(422, y + 50); c.lineTo(512, y - 30); c.lineTo(602, y + 50); c.stroke(); c.restore(); }
      c.save(); sh(c, .8); T(c, 'Свайп вверх', 512, 690, 76, '#fff'); c.restore(); c.restore(); }); });
  A('f-link', '«Ссылка в описании»', PT, 3, (c, t, D) => { const e = env(t, D), b = Math.abs(Math.sin(t * 4.5)) * 34;
    wk(c, 512, 512, e, () => { const w = TW(c, 'Ссылка в описании', 54) + 200, x = 512 - w / 2; card(c, x, 360, w, 150, 75, '#fff', 1); circ(c, x + 84, 435, 46, '#0A84FF'); ic(c, 'link', x + 84, 435, 60, '#fff', 0, -.6); T(c, 'Ссылка в описании', x + 150, 435, 54, '#111', 'b', 'left');
      c.save(); c.translate(512, 640 + b); c.scale(.42, .42); sh(c, 1.6); bigArrow(c, '#fff'); c.restore(); }); });
  A('f-circle', 'Обводка маркером по кругу', PT, 2.5, (c, t) => { const p = eio(cl((t - .1) / .9)) * 1.12, o = 1 - cl((t - 2.25) / .25);
    c.save(); c.globalAlpha = o; c.strokeStyle = '#FF3B30'; c.lineWidth = 20; c.lineCap = 'round'; c.beginPath();
    for (let i = 0; i <= 120 * p; i++) { const a = -2.2 + i / 120 * TAU, rx = 380 + 16 * Math.sin(i / 120 * 9), ry = 220 + 12 * Math.cos(i / 120 * 7), x = 512 + Math.cos(a) * rx * (1 + .04 * i / 120), y = 512 + Math.sin(a) * ry - i * .25; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.restore(); });

  ST.foot = { name: 'Футажи (для любого стиля)', key: KEY, S: { c1: '#ffffff', c2: '#0A84FF', c3: '#FF3B30', ink: '#111111', font: 'Inter-Bold', fontBody: 'Inter-Medium', lw: 10, rough: 0, glow: 0 },
    png: [], tr: [], ov: [], bg: [], tx: [], an: items };
  // общие инструменты футажей — ими рисуют новые категории в styles7*.js
  G.KKFOOT = { A, items, KEY, FN, cl, eo, eio, ein, lerp, ss, TAU, spr, env, wk, prs, track, rr, T, TW, sh, nosh, card, circ, grad, nb, IC, ic, avatar, cursor, ripple, touch, burst, confetti, wrap, morphBtn,
    cta, qSticker, phone, banner, errWin, odo, odoW, counter, PG, pgDraw, stick, IDLE, sparkle, HEART, CUR, bigArrow };

  /* =====================================================================
     iOS: анимации ai-* на настоящих иконках Apple (те же id, те же движения)
     ===================================================================== */
  const ios = ST.ios;
  if (ios) {
    const MAP = { camera: ['camera', 'Камера'], chat: ['messages', 'Сообщения'], phone: ['phone', 'Телефон'], mail: ['mail', 'Почта'], calendar: ['calendar', 'Календарь'], clock: ['clock', 'Часы'], note: ['music', 'Музыка'],
      magnifier: ['safari', 'Safari'], bell: ['reminders', 'Напоминания'], lock: ['health', 'Здоровье'], wifi: ['settings', 'Настройки'], battery: ['photos', 'Фото'], folder: ['files', 'Файлы'], play: ['facetime', 'FaceTime'] };
    const IMG = {}; for (const k in MAP) { const im = new Image(); if (G.KK_BASE) im.crossOrigin = 'anonymous'; im.src = (G.KK_BASE || '') + 'icons/ios/' + MAP[k][0] + '.png'; IMG[k] = im; READY.push(im.decode().catch(() => {})); }
    const S0 = 560; // размер иконки в кадре 1024
    function iconAt(c, im, k = 1, rot = 0, dx = 0, dy = 0, shk = 1) { if (!im.naturalWidth || k <= 0) return; c.save(); c.translate(512 + dx, 512 + dy); c.rotate(rot); c.scale(k, k);
      c.shadowColor = `rgba(0,0,0,${.26 * shk})`; c.shadowBlur = 60; c.shadowOffsetY = 26; c.imageSmoothingQuality = 'high'; c.drawImage(im, -S0 / 2, -S0 / 2, S0, S0); c.restore(); }
    const MOT = {
      'выскакивает': (c, im, t) => { const k = spr(t, 12, .38), fl = Math.sin((t - .6) * 2.6) * 10 * cl((t - .5) * 2); iconAt(c, im, k, (1 - cl(k)) * -.25 + Math.sin(t * 2.2) * .02 * cl(t - .5), 0, fl); },
      'качается': (c, im, t) => { const k = spr(t, 13, .45); c.save(); c.translate(512, 512 - S0 * .55); c.rotate(Math.sin(t * 7) * .11 * cl(t * 2.5)); c.translate(-512, -(512 - S0 * .55)); iconAt(c, im, k); c.restore(); },
      'пульсирует': (c, im, t) => { const beat = t > .45 ? (x => Math.exp(-x * 9) * Math.sin(x * 20))((t - .45) % .8) : 0; iconAt(c, im, spr(t, 13, .45) * (1 + .1 * Math.max(0, beat)), 0, 0, 0); },
      'влетает с поворотом': (c, im, t) => { const k = spr(t, 9, .6); iconAt(c, im, .3 + .7 * Math.max(0, k), (1 - k) * -Math.PI, (1 - k) * -560, (1 - k) * 380); },
      'бьёт печатью': (c, im, t) => { const p = cl(t / .26), k = 1 + 1.5 * Math.pow(1 - p, 2.2), sh = t > .26 && t < .55 ? Math.sin(t * 95) * 14 * (1 - (t - .26) / .29) : 0;
        if (t > .26 && t < .9) { const q = (t - .26) / .64; c.save(); c.globalAlpha = (1 - q) * .55; c.strokeStyle = '#fff'; c.lineWidth = 18 * (1 - q); rr(c, 512 - S0 * (.5 + .25 * eo(q)), 512 - S0 * (.5 + .25 * eo(q)), S0 * (1 + .5 * eo(q)), S0 * (1 + .5 * eo(q)), S0 * .3); c.stroke(); c.restore(); }
        c.save(); c.globalAlpha = cl(p * 2.5); iconAt(c, im, k, -.22 * (1 - p), sh, 0, p); c.restore(); }
    };
    ios.an = ios.an.map(it => { const m = /^ai-(.+)$/.exec(it.id), mp = m && MAP[m[1]]; if (!mp) return it; const verb = Object.keys(MOT).find(v => it.name.endsWith(v)) || 'выскакивает';
      return { id: it.id, name: `Иконка «${mp[1]}» ${verb}`, dur: it.dur, draw: (c, W, H, S, t) => { c.save(); c.scale(W / 1024, H / 1024); MOT[verb](c, IMG[m[1]], t); c.restore(); } }; });
  }
})(window);

/* ---- styles7a.js ---- */
/* Футажи: новые категории (часть a) — рисуют инструментами window.KKFOOT из styles6.js
   «Вопросы и опросы» (+12, f-q2-*), «Соцсети» (+1, f-soc2-*), «Списки и шаги» (+20, f-ls-*) */
(function (G) {
  const F = G.KKFOOT; if (!F) return;
  const { A, cl, eo, eio, ein, lerp, ss, TAU, spr, env, wk, prs, rr, sh, nosh, card, circ, grad, ic, avatar, touch, burst, confetti, cta } = F;

  /* ---------- свои инструменты ---------- */
  const FF = { b: 'Inter-Bold', m: 'Inter-Medium', k: 'Montserrat-Black', x: 'Montserrat-ExtraBold', u: 'Unbounded-ExtraBold', mn: 'Manrope-SemiBold', cv: 'Caveat-Bold', j: 'JetBrainsMono-Bold', pf: 'PlayfairDisplay-Bold', rm: 'RubikMonoOne' };
  const fam = f => FF[f] || f;
  // текст; maxW — ужать кегль, если не влезает
  function TT(c, s, x, y, px, col, f = 'b', al = 'center', maxW) { c.font = `${px}px "${fam(f)}"`; if (maxW) { const w = c.measureText(s).width; if (w > maxW) { px *= maxW / w; c.font = `${px}px "${fam(f)}"`; } }
    c.fillStyle = col; c.textAlign = al; c.textBaseline = 'middle'; c.fillText(s, x, y + px * .04); }
  function TWW(c, s, px, f = 'b') { c.font = `${px}px "${fam(f)}"`; return c.measureText(s).width; }
  function wrapC(c, s, px, f, maxW) { const L = []; let cur = ''; for (const w of s.split(' ')) { const tst = cur ? cur + ' ' + w : w; if (cur && TWW(c, tst, px, f) > maxW) { L.push(cur); cur = w; } else cur = tst; } if (cur) L.push(cur); return L; }
  // появление отдельного элемента пружиной
  const pe = (t, t0, f = 15, z = .55) => ({ k: spr(t - t0, f, z), a: cl((t - t0) / .08) });
  // галочка рисуется (p 0..1), s — ширина
  function chk(c, x, y, s, p, col, lw) { if (p <= 0) return; p = cl(p); const P = [[-.42, .02], [-.13, .3], [.44, -.3]], L1 = Math.hypot(.29, .28), L2 = Math.hypot(.57, .6), d = p * (L1 + L2);
    c.save(); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x + P[0][0] * s, y + P[0][1] * s);
    if (d <= L1) { const k = d / L1; c.lineTo(x + lerp(P[0][0], P[1][0], k) * s, y + lerp(P[0][1], P[1][1], k) * s); }
    else { const k = (d - L1) / L2; c.lineTo(x + P[1][0] * s, y + P[1][1] * s); c.lineTo(x + lerp(P[1][0], P[2][0], k) * s, y + lerp(P[1][1], P[2][1], k) * s); } c.stroke(); c.restore(); }
  // крестик рисуется (p 0..1)
  function xmark(c, x, y, s, p, col, lw) { if (p <= 0) return; const h = s / 2, a = cl(p * 2), b = cl(p * 2 - 1); c.save(); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.beginPath();
    c.moveTo(x - h, y - h); c.lineTo(x - h + s * a, y - h + s * a); if (b > 0) { c.moveTo(x + h, y - h); c.lineTo(x + h - s * b, y - h + s * b); } c.stroke(); c.restore(); }
  // плюс / минус в кружке
  function pm(c, x, y, r, bg, plus) { circ(c, x, y, r, bg); c.save(); c.strokeStyle = '#fff'; c.lineWidth = r * .22; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - r * .45, y); c.lineTo(x + r * .45, y); if (plus) { c.moveTo(x, y - r * .45); c.lineTo(x, y + r * .45); } c.stroke(); c.restore(); }
  // стрелка вправо
  function arrowR(c, x, y, s, col, lw) { c.save(); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x - s / 2, y); c.lineTo(x + s / 2, y); c.moveTo(x + s * .12, y - s * .36); c.lineTo(x + s / 2, y); c.lineTo(x + s * .12, y + s * .36); c.stroke(); c.restore(); }
  // четырёхлучевая искра
  function star4(c, x, y, r, col) { c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.fillStyle = col; c.fill(); }
  // корона (центр основания в x, y)
  function crown(c, x, y, s) { const P = [[-.5, 0], [-.56, -.62], [-.24, -.34], [0, -.78], [.24, -.34], [.56, -.62], [.5, 0]]; c.save(); sh(c, .6); c.beginPath(); P.forEach((p, i) => i ? c.lineTo(x + p[0] * s, y + p[1] * s) : c.moveTo(x + p[0] * s, y + p[1] * s)); c.closePath(); c.lineJoin = 'round'; c.lineWidth = s * .08;
    c.fillStyle = grad(c, 0, y - s * .8, 0, y, ['#FFE45C', '#FF9F0A']); c.strokeStyle = '#FFB800'; c.stroke(); c.fill(); nosh(c); [[-.56, -.62], [0, -.78], [.56, -.62]].forEach(p => circ(c, x + p[0] * s, y + p[1] * s, s * .08, '#FFE45C')); c.restore(); }
  // огонь (основание в x, y; s — высота)
  function flame(c, x, y, s, t) { const fl = k => { const h = s * k, w = s * .36 * k, tp = Math.sin(t * 11 + k * 4) * s * .05;
      c.beginPath(); c.moveTo(x + tp, y - h); c.bezierCurveTo(x + w * .35 + tp * .5, y - h * .72, x + w * 1.05, y - h * .5, x + w, y - h * .26);
      c.bezierCurveTo(x + w * .98, y - h * .02, x + w * .5, y, x, y); c.bezierCurveTo(x - w * .5, y, x - w * .98, y - h * .02, x - w, y - h * .26);
      c.bezierCurveTo(x - w * 1.05, y - h * .5, x - w * .35 + tp * .5, y - h * .72, x + tp, y - h); c.closePath(); };
    c.save(); sh(c, .5); fl(1); c.fillStyle = grad(c, 0, y - s, 0, y, ['#FF9500', '#FF3B30']); c.fill(); nosh(c);
    fl(.7); c.fillStyle = grad(c, 0, y - s * .7, 0, y, ['#FFD60A', '#FF9500']); c.fill(); fl(.38); c.fillStyle = '#FFF4B8'; c.fill(); c.restore(); }
  // значок «репост»: две стрелки по кругу (центр 0,0)
  function repostIc(c, x, y, s, col, rot = 0) { const u = s / 24; c.save(); c.translate(x, y); c.rotate(rot); c.scale(u, u); c.strokeStyle = col; c.lineWidth = 2.5; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-8, 3); c.lineTo(-8, -2); c.arcTo(-8, -6, -4, -6, 4); c.lineTo(8, -6); c.moveTo(4.5, -9.5); c.lineTo(8.5, -6); c.lineTo(4.5, -2.5);
    c.moveTo(8, -3); c.lineTo(8, 2); c.arcTo(8, 6, 4, 6, 4); c.lineTo(-8, 6); c.moveTo(-4.5, 2.5); c.lineTo(-8.5, 6); c.lineTo(-4.5, 9.5); c.stroke(); c.restore(); }
  // облачко комментария контуром
  function bubbleIc(c, x, y, r, col, lw) { c.save(); c.lineWidth = lw; c.strokeStyle = col; c.lineJoin = 'round'; c.beginPath(); c.arc(x, y - r * .1, r, Math.PI * .72, Math.PI * .62 + TAU); c.lineTo(x - r, y + r * .95); c.closePath(); c.stroke(); c.restore(); }
  // метка карты (кончик в x, y)
  function pin(c, x, y, col, label) { c.save(); sh(c, .6); c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x - 16, y - 22, x - 38, y - 40, x - 38, y - 66); c.arc(x, y - 66, 38, Math.PI, 0); c.bezierCurveTo(x + 38, y - 40, x + 16, y - 22, x, y); c.closePath(); c.fillStyle = col; c.fill(); nosh(c);
    circ(c, x, y - 66, 24, '#fff'); TT(c, label, x, y - 66, 26, col, 'k'); c.restore(); }
  const BL = ['#3A9BFF', '#0A6CFF'], VI = ['#8E6BFF', '#5E3BFF'], OR = ['#FF9F0A', '#FF2D55'];

  /* =====================================================================
     Вопросы и опросы (+12)
     ===================================================================== */
  const Q = 'Вопросы и опросы';

  A('f-q2-scale', 'Голосование 1–5: столбики с процентами', Q, 3.5, (c, t, D) => {
    const e = env(t, D), x0 = 132, Y = 242, w = 760, h = 540, vals = [4, 7, 15, 29, 45], base = Y + 430, mh = 240, tw = 1.75;
    wk(c, 512, 512, e, () => { card(c, x0, Y, w, h, 48); TT(c, 'Оцени ролик от 1 до 5', 512, Y + 84, 44, '#111');
      vals.forEach((v, i) => { const cx = x0 + 124 + i * 128, f = eo(cl((t - .7 - i * .09) / .9)), win = i === 4, pk = win && t > tw ? 1 + .08 * Math.sin(Math.PI * cl((t - tw) / .3)) : 1, bh = Math.max(20, mh * v / 45 * f);
        rr(c, cx - 46, base - mh, 92, mh, 24); c.fillStyle = '#F4F4F7'; c.fill();
        c.save(); c.translate(cx, base); c.scale(pk, pk); rr(c, -46, -bh, 92, bh, 24); c.fillStyle = win ? grad(c, 0, -mh, 0, 0, OR) : '#D5D5DC'; c.fill(); c.restore();
        if (f > 0) { c.save(); c.globalAlpha *= cl(f * 3); TT(c, Math.round(v * f) + '%', cx, base - bh * pk - 28, 30, win ? '#FF2D55' : '#636366', win ? 'k' : 'b'); c.restore(); }
        circ(c, cx, base + 52, 30, win && t > tw ? '#111' : '#F4F4F7'); TT(c, String(i + 1), cx, base + 52, 32, win && t > tw ? '#fff' : '#111'); });
      burst(c, x0 + 636, base - mh - 20, t, tw, { n: 8, R: 90, s: 7, ring: false, lines: true, cols: ['#FF9F0A', '#FF2D55'] }); });
  });

  A('f-q2-guess', 'Угадай ответ: таймер и разгадка', Q, 4.5, (c, t, D) => {
    const e = env(t, D), x0 = 152, Y = 232, w = 720, h = 560, cy = Y + 330, t0 = .7, tr = 3.7, el = t - t0, out = ss((t - tr) / .18);
    wk(c, 512, 512, e, () => { card(c, x0, Y, w, h, 48);
      const cw = TWW(c, 'УГАДАЙ ОТВЕТ', 28, 'k') + 70; c.save(); sh(c, .5); rr(c, 512 - cw / 2, Y - 32, cw, 64, 32); c.fillStyle = grad(c, 512 - cw / 2, 0, 512 + cw / 2, 0, OR); c.fill(); c.restore(); TT(c, 'УГАДАЙ ОТВЕТ', 512, Y, 28, '#fff', 'k');
      wrapC(c, 'Сколько секунд длится идеальный рилс?', 44, 'b', 600).forEach((l, i) => TT(c, l, 512, Y + 106 + i * 56, 44, '#111'));
      if (out < 1) { const k = 1 - out; c.save(); c.globalAlpha *= k; c.translate(512, cy); c.scale(k, k);
        c.lineWidth = 16; c.strokeStyle = '#F2F2F7'; circ(c, 0, 0, 90); c.stroke(); const left = 1 - cl(el / 3), last = el > 2;
        c.lineCap = 'round'; c.strokeStyle = last ? '#FF3B30' : grad(c, -90, -90, 90, 90, OR); c.beginPath(); c.arc(0, 0, 90, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(.003, left)); c.stroke();
        const n = el < 0 ? 3 : Math.max(1, 3 - Math.floor(el)), fr = el < 0 ? 1 : el - Math.floor(el), nk = .55 + .45 * spr(fr, 16, .45); c.scale(nk, nk); TT(c, String(n), 0, -2, 96, last ? '#FF3B30' : '#111', 'k'); c.restore(); }
      if (t > tr) { const p = pe(t, tr + .08, 14, .5), s = '7–15 секунд', bw = TWW(c, s, 50, 'x') + 110;
        wk(c, 512, cy, p, () => { TT(c, 'Правильный ответ', 512, cy - 96, 28, '#8E8E93', 'm'); c.save(); sh(c, .6); rr(c, 512 - bw / 2, cy - 56, bw, 112, 56); c.fillStyle = grad(c, 512 - bw / 2, 0, 512 + bw / 2, 0, OR); c.fill(); c.restore(); TT(c, s, 512, cy, 50, '#fff', 'x'); }); }
      TT(c, 'Пиши свой вариант в комментариях', 512, Y + h - 62, 28, '#8E8E93', 'm'); });
    confetti(c, 512, cy, t, tr + .1, 26, 380);
  });

  A('f-q2-input', 'Поле «Твой вариант?»: печать и отправка', Q, 4, (c, t, D) => {
    const e = env(t, D), x0 = 132, Y = 322, w = 760, h = 380, s = 'Монтаж за 5 минут', ts = .9, te = 2.2, tc = 2.65, sent = t >= tc;
    const typed = s.slice(0, Math.floor(cl((t - ts) / (te - ts)) * s.length)), fx = x0 + 40, fy = Y + 228, fw = w - 80, fh = 108, bx = fx + fw - 56, by = fy + fh / 2;
    wk(c, 512, 512, e, () => { card(c, x0, Y, w, h, 48, '#1C1C1E', 1.1);
      TT(c, 'Твой вариант?', x0 + 56, Y + 88, 54, '#fff', 'b', 'left'); TT(c, 'Как бы ты назвал(а) этот ролик?', x0 + 56, Y + 150, 30, '#8E8E93', 'm', 'left');
      rr(c, fx, fy, fw, fh, 54); c.fillStyle = '#2C2C2E'; c.fill();
      if (!sent) { if (!typed) TT(c, 'Напиши ответ…', fx + 42, by, 36, '#6C6C70', 'm', 'left');
        else { TT(c, typed, fx + 42, by, 36, '#fff', 'm', 'left'); if (t < te || Math.floor(t * 3) % 2 === 0) { c.fillStyle = '#FF9F0A'; c.fillRect(fx + 46 + TWW(c, typed, 36, 'm'), by - 22, 4, 44); } } }
      else { const k = cl((t - tc) / .45); if (k < 1) { c.save(); c.globalAlpha *= 1 - ss((k - .4) / .6); TT(c, s, fx + 42, by - 170 * eo(k), 36, '#fff', 'm', 'left'); c.restore(); }
        if (k >= 1) TT(c, 'Напиши ответ…', fx + 42, by, 36, '#6C6C70', 'm', 'left'); }
      const act = typed.length > 0 && !(sent && t > tc + .5), pk = 1 - .12 * prs(t, tc); c.save(); c.translate(bx, by); c.scale(pk, pk);
      circ(c, 0, 0, 38, act ? grad(c, -38, -38, 38, 38, OR) : '#3A3A3C'); c.strokeStyle = '#fff'; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(0, 15); c.lineTo(0, -15); c.moveTo(-13, -2); c.lineTo(0, -16); c.lineTo(13, -2); c.stroke(); c.restore();
      touch(c, bx + 6, by + 8, t, tc, 44);
      if (sent) { const p = pe(t, tc + .3, 15, .55), tw = TWW(c, 'Отправлено', 32) + 120; wk(c, 512, Y - 70, p, () => { card(c, 512 - tw / 2, Y - 116, tw, 92, 46, '#fff', .8);
        circ(c, 512 - tw / 2 + 52, Y - 70, 22, grad(c, 0, Y - 92, 0, Y - 48, OR)); chk(c, 512 - tw / 2 + 52, Y - 70, 26, cl((t - tc - .4) / .25), '#fff', 5); TT(c, 'Отправлено', 512 - tw / 2 + 90, Y - 70, 32, '#111', 'b', 'left'); }); } });
  });

  A('f-q2-poll4', 'Опрос: четыре варианта с процентами', Q, 4, (c, t, D) => {
    const e = env(t, D), tc = 1.35, x0 = 142, Y = 162, w = 740, h = 700, f = eo(cl((t - tc - .05) / 1)), O = [['А', 'Рилс', .46], ['Б', 'Сторис', .21], ['В', 'Длинные видео', .24], ['Г', 'Подкасты', .09]];
    wk(c, 512, 512, e, () => { card(c, x0, Y, w, h, 48); TT(c, 'Какой формат ты любишь?', 512, Y + 86, 44, '#111', 'b', 'center', w - 100);
      O.forEach(([L, s, v], i) => { const ox = x0 + 44, ow = w - 88, oh = 100, y = Y + 160 + i * 120, win = i === 0, bw = ow * v * f;
        rr(c, ox, y, ow, oh, 30); c.fillStyle = '#F4F4F7'; c.fill();
        if (bw > 1) { c.save(); rr(c, ox, y, ow, oh, 30); c.clip(); rr(c, ox, y, Math.max(bw, 60), oh, 30); c.fillStyle = win ? grad(c, ox, 0, ox + ow * .5, 0, OR) : '#E2E2E8'; c.fill(); c.restore(); }
        const wc = win && f > .3; circ(c, ox + 50, y + oh / 2, 26, wc ? 'rgba(255,255,255,.95)' : '#fff'); TT(c, L, ox + 50, y + oh / 2, 26, win && f > .3 ? '#FF2D55' : '#636366', 'k');
        TT(c, s, ox + 96, y + oh / 2, 36, wc ? '#fff' : '#111', 'b', 'left');
        if (f > 0) { c.save(); c.globalAlpha *= cl(f * 3); TT(c, Math.round(v * 100 * f) + '%', ox + ow - 34, y + oh / 2, 36, win ? '#FF2D55' : '#636366', 'b', 'right'); c.restore(); } });
      touch(c, x0 + 300, Y + 220, t, tc, 46); TT(c, t > tc ? '1 248 голосов' : 'Нажми, чтобы ответить', 512, Y + h - 40, 26, '#8E8E93', 'm'); });
  });

  A('f-q2-myth', 'Правда или миф: штамп «МИФ»', Q, 4, (c, t, D) => {
    const e = env(t, D), x0 = 152, Y = 252, w = 720, h = 520, tc = 1.6, ts = 2.0, hit = ts + .2, sk = t > hit ? Math.sin((t - hit) * 55) * 10 * Math.exp(-(t - hit) * 7) : 0;
    wk(c, 512, 512, e, () => { c.save(); c.translate(sk, 0); card(c, x0, Y, w, h, 48);
      const lw = TWW(c, 'ПРАВДА ИЛИ МИФ?', 26, 'k') + 56; rr(c, 512 - lw / 2, Y + 44, lw, 56, 28); c.fillStyle = '#FFF0F3'; c.fill(); TT(c, 'ПРАВДА ИЛИ МИФ?', 512, Y + 72, 26, '#FF2D55', 'k');
      const L = wrapC(c, '«Чем длиннее ролик, тем больше охватов»', 50, 'pf', 610); L.forEach((l, i) => TT(c, l, 512, Y + 200 - (L.length - 1) * 31 + i * 62, 50, '#111', 'pf'));
      const bw = (w - 88 - 24) / 2, byy = Y + 378, on = t >= tc, f = ss((t - tc) / .2);
      [['Правда', '#EAF3FF', '#0A84FF'], ['Миф', '#FFEBEF', '#FF2D55']].forEach(([s, bg, col], i) => { const bx = x0 + 44 + i * (bw + 24), pk = i ? 1 - .06 * prs(t, tc) : 1;
        c.save(); c.translate(bx + bw / 2, byy + 50); c.scale(pk, pk); rr(c, -bw / 2, -50, bw, 100, 30); c.fillStyle = bg; c.fill();
        if (i && on) { c.save(); c.globalAlpha *= f; c.fillStyle = col; c.fill(); c.restore(); } if (!i && on) c.globalAlpha *= 1 - .5 * f;
        TT(c, s, 0, 0, 40, i && f > .5 ? '#fff' : col); c.restore(); });
      touch(c, x0 + 44 + bw * 1.5 + 24, byy + 58, t, tc, 46); c.restore();
      if (t > ts) { const p = cl((t - ts) / .2), k = 1 + 1.3 * (1 - eo(p)), sw = TWW(c, 'МИФ', 104, 'rm') + 90; c.save(); c.globalAlpha *= cl(p * 2.5); c.translate(512, Y + 200); c.rotate(-.16); c.scale(k, k);
        rr(c, -sw / 2, -78, sw, 156, 26); c.fillStyle = 'rgba(255,255,255,.9)'; c.fill(); c.lineWidth = 12; c.strokeStyle = '#FF2D55'; c.stroke(); rr(c, -sw / 2 + 16, -62, sw - 32, 124, 16); c.lineWidth = 4; c.stroke();
        TT(c, 'МИФ', 0, 2, 104, '#FF2D55', 'rm'); c.restore(); } });
  });

  A('f-q2-fire', 'Слайдер-огонь «Насколько горячая тема?»', Q, 3.5, (c, t, D) => {
    const e = env(t, D), x0 = 152, Y = 332, w = 720, h = 360, ty = Y + 262, xa = x0 + 80, xb = x0 + w - 80, p = .9 * eio(cl((t - .7) / 1.3)), tx = lerp(xa, xb, p), tr = 2.05;
    wk(c, 512, 512, e, () => { card(c, x0, Y, w, h, 48); TT(c, 'Насколько горячая тема?', 512, Y + 84, 42, '#111');
      rr(c, xa, ty - 12, xb - xa, 24, 12); c.fillStyle = '#EEEEF2'; c.fill(); rr(c, xa, ty - 12, Math.max(24, tx - xa), 24, 12); c.fillStyle = grad(c, xa, 0, xb, 0, ['#FFD60A', '#FF9500', '#FF3B30']); c.fill();
      for (let i = 0; i < 6; i++) { const ph = (t * .9 + i / 6) % 1, ex = tx + Math.sin(i * 2.7 + t * 3) * 22 * (1 + p), ey = ty - 30 - ph * (60 + 120 * p); if (p < .1) break;
        c.save(); c.globalAlpha *= (1 - ph) * cl(p * 2); circ(c, ex, ey, 5 * (1 - ph) + 2, i % 2 ? '#FFB800' : '#FF6A00'); c.restore(); }
      const s = lerp(76, 140, p) * (1 + .12 * Math.sin(Math.PI * cl((t - tr) / .3)) * (t > tr ? 1 : 0)); flame(c, tx, ty + 24, s, t);
      burst(c, tx, ty - 50, t, tr, { n: 9, R: 110, s: 7, ring: false, lines: true, cols: ['#FF9500', '#FF3B30', '#FFD60A'] });
      TT(c, 'холодно', xa, ty + 60, 24, '#AEAEB2', 'm', 'left'); TT(c, 'огонь', xb, ty + 60, 24, '#FF3B30', 'b', 'right'); });
  });

  A('f-q2-follower', 'Карточка «Вопрос от подписчика»', Q, 4, (c, t, D) => {
    const e = env(t, D), x0 = 112, Y = 297, w = 800, h = 430, q = 'Как ты придумываешь идеи для роликов каждый день?';
    e.r = (1 - cl(spr(t, 9, .55))) * -.06;
    wk(c, 512, 512, e, () => { card(c, x0, Y, w, h, 48); avatar(c, x0 + 96, Y + 96, 48, '#FF9A8B', '#A86BFF', 'К');
      TT(c, '@katya.edit', x0 + 166, Y + 78, 34, '#111', 'b', 'left'); TT(c, 'спрашивает', x0 + 166, Y + 118, 26, '#8E8E93', 'm', 'left');
      const cw = TWW(c, 'Вопрос', 26) + 50; rr(c, x0 + w - 52 - cw, Y + 68, cw, 54, 27); c.fillStyle = '#F1ECFF'; c.fill(); TT(c, 'Вопрос', x0 + w - 52 - cw / 2, Y + 95, 26, '#6E4BFF');
      const L = wrapC(c, q, 46, 'b', w - 112); let j = 0; c.font = '46px "Inter-Bold"';
      L.forEach((l, li) => { let xx = x0 + 56; const sp = TWW(c, ' ', 46); l.split(' ').forEach(wd => { const tw = .7 + j * .08, a = cl((t - tw) / .18), dy = (1 - eo(cl((t - tw) / .35))) * 18; j++;
        if (a > 0) { c.save(); c.globalAlpha *= a; TT(c, wd, xx, Y + 206 + li * 58 + dy, 46, '#111', 'b', 'left'); c.restore(); } xx += TWW(c, wd, 46) + sp; }); });
      c.fillStyle = '#EEEEF2'; c.fillRect(x0 + 56, Y + h - 112, w - 112, 2);
      const ra = cl((t - 1.9) / .2), bob = Math.abs(Math.sin(t * 4.5)) * 8; c.save(); c.globalAlpha *= ra; TT(c, 'Отвечаю в этом ролике', x0 + 56, Y + h - 56, 32, '#6E4BFF', 'b', 'left');
      ic(c, 'down', x0 + 56 + TWW(c, 'Отвечаю в этом ролике', 32) + 32, Y + h - 54 + bob, 44, '#6E4BFF'); c.restore(); });
  });

  A('f-q2-word', '«Напиши в комменты слово ХОЧУ»', Q, 3.5, (c, t, D) => {
    const e1 = env(t, D), e2 = env(t, D, .35), e3 = env(t, D, 1.5), wd = 'ХОЧУ', n = Math.min(wd.length, Math.floor(cl((t - .75) / .5) * (wd.length + .99))), tp = .75 + .5, done = t > tp + .05;
    wk(c, 512, 380, e1, () => { const s = 'Напиши в комментарии', w = TWW(c, s, 44) + 170; card(c, 512 - w / 2, 380 - 64, w, 128, 64, '#fff', 1); bubbleIc(c, 512 - w / 2 + 78, 380, 26, '#111', 7); TT(c, s, 512 - w / 2 + 128, 380, 44, '#111', 'b', 'left'); });
    const pk = done ? 1 + .08 * Math.sin(Math.PI * cl((t - tp) / .3)) : 1; e2.k *= pk;
    wk(c, 512, 580, e2, () => { const fw = TWW(c, wd, 116, 'u') + 150, cw = TWW(c, wd.slice(0, n), 116, 'u'); c.save(); sh(c, 1); rr(c, 512 - fw / 2, 580 - 100, fw, 200, 56); c.fillStyle = grad(c, 512 - fw / 2, 480, 512 + fw / 2, 680, OR); c.fill(); c.restore();
      TT(c, wd.slice(0, n), 512 - fw / 2 + 75, 580, 116, '#fff', 'u', 'left'); if (!done || Math.floor(t * 3) % 2 === 0) { c.fillStyle = '#fff'; c.fillRect(512 - fw / 2 + 82 + cw, 580 - 56, 7, 112); } });
    if (done) [[250, 470, 26, 0], [790, 500, 20, .15], [760, 690, 30, .3], [270, 680, 18, .45]].forEach(([x, y, r, d]) => { const k = spr(t - tp - d, 14, .5) * (.75 + .25 * Math.sin(t * 7 + d * 9)) * (1 - ein(cl((t - (D - .3)) / .3))); if (k > 0) { c.save(); sh(c, .4); star4(c, x, y, r * k * 1.6, '#FFD60A'); c.restore(); } });
    wk(c, 512, 760, e3, () => { c.save(); sh(c, .8); TT(c, 'и получи гайд бесплатно', 512, 760, 44, '#fff'); c.restore(); });
  });

  A('f-q2-123', '«Выбери 1, 2 или 3»: плитки', Q, 3.5, (c, t, D) => {
    const e0 = env(t, D), xs = [272, 512, 752], cols = [BL, VI, OR], fx = 272 + 240 * cl(spr(t - 1.8, 13, .62)) + 240 * cl(spr(t - 2.4, 13, .62)), fa = cl((t - 1.2) / .15) * (1 - ein(cl((t - (D - .3)) / .3)));
    wk(c, 512, 300, e0, () => { const s = 'Выбери: 1, 2 или 3?', w = TWW(c, s, 46) + 100; card(c, 512 - w / 2, 300 - 56, w, 112, 56, '#fff', 1); TT(c, s, 512, 300, 46, '#111'); });
    xs.forEach((x, i) => { const e = env(t, D, .2 + i * .12), wf = fa * Math.max(0, 1 - Math.abs(fx - x) / 240), y = 550 - 22 * wf; e.k *= 1 + .05 * wf;
      wk(c, x, y, e, () => { c.save(); sh(c, 1 + .3 * wf); rr(c, x - 96, y - 124, 192, 248, 46); c.fillStyle = grad(c, x - 96, y - 124, x + 96, y + 124, cols[i]); c.fill(); c.restore();
        c.save(); rr(c, x - 96, y - 124, 192, 248, 46); c.clip(); c.fillStyle = 'rgba(255,255,255,.14)'; c.beginPath(); c.ellipse(x - 40, y - 144, 170, 90, -.3, 0, TAU); c.fill(); c.restore();
        TT(c, String(i + 1), x, y - 4, 150, '#fff', 'k'); if (wf > .02) { c.save(); c.globalAlpha *= wf; c.lineWidth = 8; c.strokeStyle = '#fff'; rr(c, x - 110, y - 138, 220, 276, 58); c.stroke(); c.restore(); } }); });
  });

  A('f-q2-ab', '«Что лучше?»: A против B с итогом', Q, 4, (c, t, D) => {
    const e0 = env(t, D), Y = 330, tb = 1.9, tw = 2.6, sp = .5 - .12 * cl(spr(t - tb - .1, 10, .7));
    wk(c, 512, 220, e0, () => { const s = 'Что лучше?', w = TWW(c, s, 46) + 100; card(c, 512 - w / 2, 220 - 54, w, 108, 54, '#fff', 1); TT(c, s, 512, 220, 46, '#111'); });
    [[132, 'Утро', ['#FFB547', '#FF6A3D'], 0], [552, 'Вечер', ['#6E5BFF', '#2B1B8F'], 1]].forEach(([x, s, g, i]) => { const e = env(t, D, .15 + i * .12); e.r = i ? .03 : -.03; const pk = i && t > tw ? 1 + .05 * Math.sin(Math.PI * cl((t - tw) / .3)) : 1; e.k *= pk;
      wk(c, x + 170, Y + 150, e, () => { c.save(); sh(c, 1); rr(c, x, Y, 340, 300, 48); const gg = grad(c, x, Y, x + 340, Y + 300, g); c.fillStyle = gg; c.fill(); c.restore();
        const ix = x + 170, iy = Y + 118;
        if (!i) { c.save(); c.translate(ix, iy); c.rotate(t * .6); c.strokeStyle = '#FFF4D6'; c.lineWidth = 10; c.lineCap = 'round'; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; c.beginPath(); c.moveTo(Math.cos(a) * 58, Math.sin(a) * 58); c.lineTo(Math.cos(a) * 76, Math.sin(a) * 76); c.stroke(); } c.restore(); circ(c, ix, iy, 42, '#FFF4D6'); }
        else { circ(c, ix, iy, 52, '#F3EEFF'); circ(c, ix + 26, iy - 18, 46, gg); [[-70, -40, 6], [64, 30, 5], [-50, 52, 4]].forEach(([dx, dy, r]) => star4(c, ix + dx, iy + dy, r * 2.2, '#F3EEFF')); }
        TT(c, s, ix, Y + 232, 50, '#fff', 'x'); }); });
    const ev = env(t, D, .5); ev.k *= 1 + .06 * Math.max(0, Math.sin((t - .9) * 7)); wk(c, 512, Y + 150, ev, () => { c.save(); sh(c, 1); circ(c, 512, Y + 150, 58, '#111'); c.restore(); c.lineWidth = 6; c.strokeStyle = '#fff'; circ(c, 512, Y + 150, 58); c.stroke(); TT(c, 'VS', 512, Y + 150, 40, '#fff', 'k'); });
    const eb = env(t, D, tb); wk(c, 512, 726, eb, () => { const bx = 132, bw = 760, sx = bx + bw * sp; c.save(); sh(c, .7); rr(c, bx, 684, bw, 84, 42); c.fillStyle = '#fff'; c.fill(); c.restore();
      c.save(); rr(c, bx + 7, 691, bw - 14, 70, 35); c.clip(); c.fillStyle = grad(c, bx, 0, sx, 0, ['#FFB547', '#FF6A3D']); c.fillRect(bx, 691, sx - bx - 3, 70); c.fillStyle = grad(c, sx, 0, bx + bw, 0, ['#6E5BFF', '#2B1B8F']); c.fillRect(sx + 3, 691, bx + bw - sx, 70); c.restore();
      const pa = cl((t - tb - .2) / .2); c.save(); c.globalAlpha *= pa; TT(c, Math.round(sp * 100) + '%', bx + 44, 726, 38, '#fff', 'k', 'left'); TT(c, Math.round(100 - sp * 100) + '%', bx + bw - 44, 726, 38, '#fff', 'k', 'right'); c.restore(); });
    if (t > tw) { const p = pe(t, tw, 14, .45); p.a *= 1 - ein(cl((t - (D - .3)) / .3)); p.r = .32; wk(c, 870, 330, p, () => crown(c, 870, 330, 110)); burst(c, 870, 300, t, tw + .05, { n: 8, R: 120, s: 8, ring: false, cols: ['#FFD60A', '#FF9F0A'] }); }
  });

  A('f-q2-wrong', 'Тест: ошибка, затем верный ответ', Q, 4, (c, t, D) => {
    const e = env(t, D), x0 = 152, Y = 222, w = 720, h = 580, t1 = 1.2, t2 = 2.35, O = ['60 кадров', '24 кадра', '30 кадров'];
    wk(c, 512, 512, e, () => { card(c, x0, Y, w, h, 48); wrapC(c, 'Сколько кадров в секунду снимают в кино?', 42, 'b', 600).forEach((l, i) => TT(c, l, 512, Y + 86 + i * 54, 42, '#111'));
      O.forEach((s, i) => { const ox = x0 + 44, ow = w - 88, oh = 100, y = Y + 210 + i * 118, bad = i === 0, good = i === 1, fb = bad ? ss((t - t1) / .15) : 0, fg = good ? ss((t - t2) / .2) : 0;
        const dx = bad && t > t1 ? Math.sin((t - t1) * 48) * 16 * Math.exp(-(t - t1) * 5) : 0, dim = !good && t > t2 ? .45 * ss((t - t2) / .2) : 0, pk = good && t > t2 ? 1 + .05 * Math.sin(Math.PI * cl((t - t2) / .3)) : 1;
        c.save(); c.globalAlpha *= 1 - dim; c.translate(ox + ow / 2 + dx, y + oh / 2); c.scale(pk, pk); rr(c, -ow / 2, -oh / 2, ow, oh, 30); c.fillStyle = '#F4F4F7'; c.fill();
        if (fb > 0) { c.save(); c.globalAlpha *= fb; c.fillStyle = '#FF3B30'; c.fill(); c.restore(); } if (fg > 0) { c.save(); c.globalAlpha *= fg; c.fillStyle = grad(c, -ow / 2, 0, ow / 2, 0, BL); c.fill(); c.restore(); }
        const lit = fb > .5 || fg > .5; circ(c, -ow / 2 + 54, 0, 26, '#fff'); if (!lit) { c.lineWidth = 4; c.strokeStyle = '#C7C7CC'; c.stroke(); }
        if (bad && t > t1) xmark(c, -ow / 2 + 54, 0, 20, cl((t - t1 - .05) / .25), '#FF3B30', 6); if (good && t > t2) chk(c, -ow / 2 + 54, 0, 32, cl((t - t2 - .05) / .25), '#0A6CFF', 6);
        TT(c, s, -ow / 2 + 104, 0, 38, lit ? '#fff' : '#111', 'b', 'left');
        if (good && t > t2) { const p = spr(t - t2 - .15, 15, .5); c.save(); c.translate(ow / 2 - 90, 0); c.scale(p, p); rr(c, -62, -28, 124, 56, 28); c.fillStyle = 'rgba(255,255,255,.95)'; c.fill(); TT(c, 'Верно', 0, 0, 28, '#0A6CFF'); c.restore(); }
        if (bad && t > t1 + .1 && t < t2) { const p = spr(t - t1 - .1, 15, .5); c.save(); c.translate(ow / 2 - 90, 0); c.scale(p, p); rr(c, -62, -28, 124, 56, 28); c.fillStyle = 'rgba(255,255,255,.95)'; c.fill(); TT(c, 'Мимо', 0, 0, 28, '#FF3B30'); c.restore(); }
        c.restore(); });
      touch(c, x0 + 300, Y + 268, t, t1, 46); touch(c, x0 + 300, Y + 386, t, t2, 46); });
  });

  A('f-q2-qday', '«Вопрос дня» с большим знаком вопроса', Q, 3, (c, t, D) => {
    const e = env(t, D); e.r = (1 - cl(spr(t, 10, .5))) * -.35 + Math.sin(t * 3) * .03; const bob = Math.sin(t * 4) * 10;
    wk(c, 512, 450, e, () => { c.save(); sh(c, 1.2); rr(c, 512 - 180, 450 - 180, 360, 360, 90); c.fillStyle = grad(c, 332, 270, 692, 630, ['#8E6BFF', '#FF2D55']); c.fill(); c.restore();
      c.save(); rr(c, 332, 270, 360, 360, 90); c.clip(); c.fillStyle = 'rgba(255,255,255,.14)'; c.beginPath(); c.ellipse(430, 260, 260, 130, -.4, 0, TAU); c.fill(); c.restore();
      c.save(); c.translate(512, 450 + bob); c.rotate(Math.sin(t * 5) * .06); sh(c, .5); TT(c, '?', 0, 0, 290, '#fff', 'k'); c.restore(); });
    [[290, 300, 28, .4], [740, 360, 22, .55], [720, 600, 32, .7], [300, 590, 18, .85]].forEach(([x, y, r, d]) => { const k = spr(t - d, 14, .5) * (.7 + .3 * Math.sin(t * 6 + d * 8)) * (1 - ein(cl((t - (D - .3)) / .3))); if (k > 0) { c.save(); sh(c, .4); star4(c, x, y, r * k * 1.5, '#FFD60A'); c.restore(); } });
    const e2 = env(t, D, .3); wk(c, 512, 730, e2, () => { const s = 'Вопрос дня', w = TWW(c, s, 52, 'x') + 110; card(c, 512 - w / 2, 730 - 60, w, 120, 60, '#fff', 1); TT(c, s, 512, 730, 52, '#111', 'x'); });
  });

  /* =====================================================================
     Соцсети (+1)
     ===================================================================== */
  A('f-soc2-repost', '«Сделай репост»: стрелки кружатся', 'Соцсети', 3, (c, t, D) => {
    const e = env(t, D), tc = 1.2, on = t >= tc, pulse = on ? 1 + .05 * Math.sin(Math.PI * cl((t - tc) / .3)) : 1;
    wk(c, 512, 512, { k: e.k * pulse, a: e.a }, () => { const ix = cta(c, 'Сделай репост', 60), r = on ? Math.PI * spr(t - tc, 11, .55) : 0, k = 1 - .12 * prs(t, tc);
      if (on) { const f = ss((t - tc) / .2); c.save(); c.globalAlpha *= f; circ(c, ix, 512, 56 * spr(t - tc, 15, .5), '#EAF3FF'); c.restore(); }
      c.save(); c.translate(ix, 512); c.scale(k, k); repostIc(c, 0, 0, 96, on && t > tc + .1 ? '#0A84FF' : '#111', r); c.restore();
      if (on) { const p = cl((t - tc - .1) / .9); if (p > 0 && p < 1) { c.save(); c.globalAlpha *= 1 - ss((p - .6) / .4); const s = .6 + .4 * spr(t - tc - .1, 15, .5); c.translate(ix + 40, 400 - 70 * eo(p)); c.scale(s, s);
        rr(c, -46, -30, 92, 60, 30); c.fillStyle = '#0A84FF'; c.fill(); TT(c, '+1', 0, 0, 34, '#fff', 'k'); c.restore(); } }
      touch(c, ix + 14, 528, t, tc, 44); });
  });

  /* =====================================================================
     Списки и шаги (20)
     ===================================================================== */
  const L = 'Списки и шаги';

  A('f-ls-check', 'Чек-лист: галочки по очереди', L, 4, (c, t, D) => {
    const e = env(t, D), x0 = 152, Y = 232, w = 720, h = 560, I = ['Хук в первые 3 секунды', 'Субтитры', 'Обложка', 'Трендовый звук'], ti = i => .9 + i * .5;
    wk(c, 512, 512, e, () => { card(c, x0, Y, w, h, 48); TT(c, 'Перед публикацией', x0 + 56, Y + 86, 42, '#111', 'b', 'left');
      const nd = I.filter((_, i) => t >= ti(i)).length, nk = nd ? .7 + .3 * spr(t - ti(nd - 1), 16, .45) : 1; c.save(); c.translate(x0 + w - 56, Y + 86); c.scale(nk, nk); TT(c, nd + '/' + I.length, 0, 0, 40, nd === I.length ? '#FF2D55' : '#0A84FF', 'k', 'right'); c.restore();
      c.fillStyle = '#EEEEF2'; c.fillRect(x0 + 56, Y + 140, w - 112, 2);
      I.forEach((s, i) => { const y = Y + 202 + i * 100, tc = ti(i), on = t >= tc, fl = on ? 1 - cl((t - tc) / .7) : 0;
        if (fl > 0) { c.save(); c.globalAlpha *= fl * .9; rr(c, x0 + 28, y - 44, w - 56, 88, 26); c.fillStyle = '#EAF3FF'; c.fill(); c.restore(); }
        const k = on ? .7 + .3 * spr(t - tc, 17, .4) : 1; c.save(); c.translate(x0 + 88, y); c.scale(k, k);
        if (on) { circ(c, 0, 0, 26, grad(c, -26, -26, 26, 26, BL)); chk(c, 0, 0, 30, cl((t - tc) / .22), '#fff', 6); } else { circ(c, 0, 0, 24); c.lineWidth = 4; c.strokeStyle = '#C7C7CC'; c.stroke(); } c.restore();
        TT(c, s, x0 + 138, y, 36, on ? '#111' : '#8E8E93', on ? 'b' : 'm', 'left'); }); });
  });

  A('f-ls-steps', 'Шаги 1–2–3 с линией прогресса', L, 3.5, (c, t, D) => {
    const e = env(t, D), x0 = 72, Y = 352, w = 880, h = 320, xs = [232, 512, 792], cy = Y + 120, td = [.7, 1.5, 2.3], S = ['Снять', 'Смонтировать', 'Выложить'];
    wk(c, 512, 512, e, () => { card(c, x0, Y, w, h, 56);
      for (let i = 0; i < 2; i++) { const a = xs[i] + 74, b = xs[i + 1] - 74, p = eio(cl((t - td[i] - .1) / (td[i + 1] - td[i] - .15)));
        rr(c, a, cy - 5, b - a, 10, 5); c.fillStyle = '#EEEEF2'; c.fill(); if (p > 0) { rr(c, a, cy - 5, (b - a) * p, 10, 5); c.fillStyle = grad(c, a, 0, b, 0, BL); c.fill(); } }
      xs.forEach((x, i) => { const on = t >= td[i], k = on ? .75 + .25 * spr(t - td[i], 16, .4) : 1; c.save(); c.translate(x, cy); c.scale(k, k);
        if (on) { c.save(); sh(c, .5); circ(c, 0, 0, 62, grad(c, -62, -62, 62, 62, BL)); c.restore(); chk(c, 0, 0, 58, cl((t - td[i]) / .25), '#fff', 10); }
        else { circ(c, 0, 0, 58, '#fff'); c.lineWidth = 6; c.strokeStyle = '#E5E5EA'; c.stroke(); TT(c, String(i + 1), 0, 0, 52, '#AEAEB2', 'k'); } c.restore();
        TT(c, S[i], x, Y + 250, 34, on ? '#111' : '#AEAEB2', 'b'); TT(c, 'Шаг ' + (i + 1), x, Y + 290, 22, on ? '#0A84FF' : '#C7C7CC', 'm'); }); });
  });

  A('f-ls-stages', 'Прогресс-бар этапов', L, 4, (c, t, D) => {
    const e = env(t, D), x0 = 92, Y = 377, w = 840, h = 270, S = ['Идея', 'Съёмка', 'Монтаж', 'Публикация'], gap = 12, sw = (w - 112 - gap * 3) / 4, fp = i => eio(cl((t - .6 - i * .62) / .55));
    wk(c, 512, 512, e, () => { card(c, x0, Y, w, h, 48); TT(c, 'Прогресс проекта', x0 + 56, Y + 76, 38, '#111', 'b', 'left');
      let sum = 0; S.forEach((_, i) => sum += fp(i)); const pc = Math.round(sum * 25), dn = pc >= 100, pk = dn ? 1 + .15 * Math.sin(Math.PI * cl((t - (.6 + 3 * .62 + .55)) / .3)) : 1;
      c.save(); c.translate(x0 + w - 56, Y + 76); c.scale(pk, pk); TT(c, pc + '%', 0, 0, 44, dn ? '#FF2D55' : '#111', 'k', 'right'); c.restore();
      S.forEach((s, i) => { const x = x0 + 56 + i * (sw + gap), y = Y + 136, p = fp(i);
        rr(c, x, y, sw, 30, 15); c.fillStyle = '#EEEEF2'; c.fill(); if (p > 0) { rr(c, x, y, Math.max(30, sw * p), 30, 15); c.fillStyle = grad(c, x0, 0, x0 + w, 0, ['#FFB547', '#FF2D55']); c.fill(); }
        const on = p >= 1; if (on) { const k = spr(t - (.6 + i * .62 + .55), 16, .5); c.save(); c.translate(x + 14, y + 80); c.scale(k, k); circ(c, 0, 0, 13, '#FF2D55'); chk(c, 0, 0, 15, 1, '#fff', 3.5); c.restore(); }
        TT(c, s, x + (on ? 36 : 0), y + 80, 26, p > 0 ? '#111' : '#AEAEB2', 'b', 'left', sw - 36); }); });
  });

  A('f-ls-top5', 'Топ-5: строки выезжают по очереди', L, 4, (c, t, D) => {
    const I = ['Сильный хук', 'Субтитры', 'Динамичный монтаж', 'Трендовый звук', 'Яркая обложка'], et = env(t, D);
    wk(c, 512, 150, et, () => { c.save(); sh(c, .9); TT(c, 'ТОП-5', 512, 150, 78, '#fff', 'u'); c.restore(); });
    I.forEach((s, i) => { const t0 = .35 + i * .2, e = env(t, D, t0), y = 284 + i * 116, sl = (1 - cl(spr(t - t0, 11, .7))) * -140; c.save(); c.translate(sl, 0);
      wk(c, 512, y, e, () => { card(c, 172, y - 52, 680, 104, 52, '#fff', .8); const gold = i === 0; circ(c, 236, y, 38, gold ? grad(c, 198, y - 38, 274, y + 38, ['#FFE45C', '#FF9F0A']) : '#F2F2F7');
        TT(c, String(i + 1), 236, y, 38, gold ? '#fff' : '#111', 'k'); TT(c, s, 300, y, 38, '#111', 'b', 'left', 520); }); c.restore(); });
  });

  A('f-ls-before', 'Было → Стало', L, 4, (c, t, D) => {
    const Y = 282, h = 460, Lb = ['2 часа на ролик', 'Скучные склейки', '300 просмотров'], Ls = ['20 минут', 'Живой ритм', '50 000 просмотров'];
    const side = (x, title, items, good, t0) => { const e = env(t, D, t0); if (good) e.k *= 1 + .02 * cl(spr(t - t0, 10, .6));
      wk(c, x + 195, Y + h / 2, e, () => { card(c, x, Y, 390, h, 44, good ? '#fff' : '#F2F2F7', good ? 1.2 : .7);
        const cw = TWW(c, title, 30) + 56; rr(c, x + 36, Y + 40, cw, 60, 30); c.fillStyle = good ? grad(c, x + 36, 0, x + 36 + cw, 0, ['#3A9BFF', '#7B61FF']) : '#E3E3E8'; c.fill(); TT(c, title, x + 36 + cw / 2, Y + 70, 30, good ? '#fff' : '#636366');
        items.forEach((s, i) => { const ti = t0 + .35 + i * .2, p = pe(t, ti), y = Y + 170 + i * 96;
          wk(c, x + 60, y, p, () => { if (good) { circ(c, x + 60, y, 20, grad(c, x + 40, y - 20, x + 80, y + 20, ['#3A9BFF', '#7B61FF'])); chk(c, x + 60, y, 24, cl((t - ti) / .25), '#fff', 4.5); }
            else { circ(c, x + 60, y, 20, '#FFE3E1'); xmark(c, x + 60, y, 14, cl((t - ti) / .25), '#FF3B30', 4.5); }
            TT(c, s, x + 96, y, 30, good ? '#111' : '#8E8E93', good ? 'b' : 'm', 'left', 270);
            if (!good) { const sp = cl((t - ti - .25) / .3); if (sp > 0) { c.fillStyle = 'rgba(142,142,147,.8)'; c.fillRect(x + 96, y - 1, Math.min(270, TWW(c, s, 30, 'm')) * sp, 3); } } }); }); }); };
    side(82, 'Было', Lb, false, 0); side(552, 'Стало', Ls, true, 1.45);
    const ea = env(t, D, 1.15); wk(c, 512, 512, ea, () => { c.save(); sh(c, .8); circ(c, 512, 512, 42, '#111'); c.restore(); arrowR(c, 512 + 4 * Math.sin(t * 6), 512, 36, '#fff', 7); });
  });

  A('f-ls-proscons', 'Плюсы и минусы: две колонки', L, 4, (c, t, D) => {
    const e = env(t, D), x0 = 92, Y = 282, w = 840, h = 460, P = ['Быстро', 'Бесплатно', 'Без опыта'], M = ['Мало шаблонов', 'Нужен интернет', 'Есть реклама'];
    wk(c, 512, 512, e, () => { card(c, x0, Y, w, h, 48); const dv = ss((t - .3) / .5); c.fillStyle = '#EEEEF2'; c.fillRect(511, Y + 40, 2, (h - 80) * dv);
      pm(c, x0 + 76, Y + 84, 28, '#0A84FF', true); TT(c, 'Плюсы', x0 + 122, Y + 84, 42, '#111', 'b', 'left'); pm(c, 512 + 64, Y + 84, 28, '#FF3B30', false); TT(c, 'Минусы', 512 + 110, Y + 84, 42, '#111', 'b', 'left');
      [P, M].forEach((A2, j) => A2.forEach((s, i) => { const ti = .7 + i * .5 + j * .25, p = pe(t, ti, 14, .6), x = j ? 512 + 64 : x0 + 76, y = Y + 190 + i * 92, dx = (1 - cl(spr(t - ti, 12, .7))) * (j ? 40 : -40);
        c.save(); c.translate(dx, 0); wk(c, x, y, p, () => { rr(c, x - 30, y - 38, 340, 76, 24); c.fillStyle = j ? '#FFF1F0' : '#EEF5FF'; c.fill(); pm(c, x, y, 15, j ? '#FF3B30' : '#0A84FF', !j); TT(c, s, x + 32, y, 32, '#111', 'm', 'left', 260); }); c.restore(); })); });
  });

  A('f-ls-timeline', 'Таймлайн: точки по вертикали', L, 4, (c, t, D) => {
    const ys = [250, 420, 590, 760], cols = ['#0A84FF', '#7B61FF', '#FF9500', '#FF2D55'], I = [['2023', 'первый ролик'], ['2024', '10 000 подписчиков'], ['2025', 'свой курс'], ['2026', '1 миллион просмотров']], lx = 240;
    const lp = eio(cl((t - .25) / 2.1)), ly = lerp(ys[0], ys[3], lp), o = 1 - ein(cl((t - (D - .3)) / .3));
    c.save(); c.globalAlpha *= o; c.save(); sh(c, .5); c.strokeStyle = '#fff'; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(lx, ys[0]); c.lineTo(lx, Math.max(ys[0] + .1, ly)); c.stroke(); c.restore(); c.restore();
    ys.forEach((y, i) => { const ti = .25 + 2.1 * (i / 3) - .05, e = env(t, D, ti), dx = (1 - cl(spr(t - ti - .05, 11, .7))) * 60;
      wk(c, lx, y, e, () => { c.save(); sh(c, .6); circ(c, lx, y, 26, '#fff'); c.restore(); circ(c, lx, y, 13, cols[i]); });
      const e2 = env(t, D, ti + .08); c.save(); c.translate(dx, 0); wk(c, 300, y, e2, () => { card(c, 300, y - 60, 620, 120, 34, '#fff', .8); TT(c, I[i][0], 342, y - 22, 34, cols[i], 'k', 'left'); TT(c, I[i][1], 342, y + 24, 32, '#3C3C43', 'm', 'left', 540); }); c.restore(); });
  });

  A('f-ls-save', '«Сохрани, чтобы не потерять»: список', L, 4, (c, t, D) => {
    const e = env(t, D), x0 = 152, Y = 202, w = 720, h = 620, tb = 2.85, I = ['Приложения для монтажа', 'Где брать музыку', 'Шрифты для субтитров', 'Идеи для хуков'];
    wk(c, 512, 512, e, () => { card(c, x0, Y, w, h, 48); c.save(); rr(c, x0, Y, w, h, 48); c.clip(); c.fillStyle = grad(c, x0, Y, x0 + w, Y + 170, ['#8E6BFF', '#FF2D55']); c.fillRect(x0, Y, w, 170); c.restore();
      TT(c, 'Сохрани, чтобы', x0 + 56, Y + 62, 44, '#fff', 'b', 'left'); TT(c, 'не потерять', x0 + 56, Y + 114, 44, '#fff', 'b', 'left');
      const on = t >= tb, bk = on ? 1 + .25 * Math.sin(Math.PI * cl((t - tb) / .3)) : 1 - .12 * prs(t, tb), bx = x0 + w - 96, by = Y + 86; c.save(); c.translate(bx, by); c.scale(bk, bk); circ(c, 0, 0, 52, 'rgba(255,255,255,.22)');
      if (on) ic(c, 'bookmark', 0, 0, 62, '#fff'); else ic(c, 'bookmark', 0, 0, 58, '#fff', 2.2); c.restore();
      burst(c, bx, by, t, tb, { n: 8, R: 90, s: 7, ring: false, lines: true, cols: ['#fff'] }); touch(c, bx + 8, by + 12, t, tb, 44);
      I.forEach((s, i) => { const ti = .6 + i * .32, p = pe(t, ti, 14, .6), y = Y + 238 + i * 96; wk(c, x0 + 90, y, p, () => { rr(c, x0 + 66, y - 26, 52, 52, 16); c.fillStyle = '#F3EEFF'; c.fill(); TT(c, String(i + 1), x0 + 92, y, 28, '#6E4BFF', 'k');
        TT(c, s, x0 + 144, y, 34, '#111', 'm', 'left', w - 200); if (i < I.length - 1) { c.fillStyle = '#F0F0F4'; c.fillRect(x0 + 144, y + 48, w - 200, 2); } }); }); });
  });

  A('f-ls-mistakes', '«3 ошибки» с крестиками', L, 3.5, (c, t, D) => {
    const I = ['Длинное вступление', 'Нет субтитров', 'Тихий звук'], et = env(t, D);
    wk(c, 512, 290, et, () => { const s1 = '3', s2 = 'ошибки новичка', w1 = 110, w2 = TWW(c, s2, 60, 'k'), W = w1 + 24 + w2, xl = 512 - W / 2; c.save(); sh(c, .8); circ(c, xl + w1 / 2, 290, 55, '#FF3B30'); c.restore();
      TT(c, s1, xl + w1 / 2, 290, 70, '#fff', 'k'); c.save(); sh(c, .8); TT(c, s2, xl + w1 + 24, 290, 60, '#fff', 'k', 'left'); c.restore(); });
    I.forEach((s, i) => { const ti = .45 + i * .45, e = env(t, D, ti), y = 440 + i * 130, tx = ti + .2, dx = t > tx + .25 ? Math.sin((t - tx - .25) * 50) * 8 * Math.exp(-(t - tx - .25) * 7) : 0;
      c.save(); c.translate(dx, 0); wk(c, 512, y, e, () => { card(c, 152, y - 55, 720, 110, 55, '#fff', .9); circ(c, 222, y, 34, '#FFE3E1'); xmark(c, 222, y, 24, cl((t - tx) / .25), '#FF3B30', 7); TT(c, s, 280, y, 40, '#111', 'b', 'left', 560); }); c.restore(); });
  });

  A('f-ls-todo', 'Заметка-todo: пункты вычёркиваются', L, 4, (c, t, D) => {
    const e = env(t, D), x0 = 192, Y = 192, w = 640, h = 640, I = ['снять 3 ролика', 'смонтировать', 'выложить рилс', 'ответить в комментах'], ink = '#3B2F0A'; e.r = -.035;
    wk(c, 512, 512, e, () => { card(c, x0, Y, w, h, 28, '#FFF4C2', 1); c.save(); rr(c, x0, Y, w, h, 28); c.clip(); c.fillStyle = '#FFE57F'; c.fillRect(x0, Y, w, 22); c.restore();
      c.fillStyle = 'rgba(190,160,60,.25)'; for (let i = 0; i < 5; i++) c.fillRect(x0 + 40, Y + 186 + i * 104 + 44, w - 80, 2);
      TT(c, 'План на день', x0 + 56, Y + 104, 74, ink, 'cv', 'left');
      I.forEach((s, i) => { const y = Y + 226 + i * 104, ti = .8 + i * .6, p = cl((t - ti) / .25), sp = cl((t - ti - .2) / .35);
        c.save(); c.strokeStyle = 'rgba(59,47,10,.7)'; c.lineWidth = 4; rr(c, x0 + 56, y - 22, 44, 44, 10); c.stroke(); c.restore(); chk(c, x0 + 82, y - 6, 54, p, '#FF3B30', 8);
        TT(c, s, x0 + 128, y, 56, p > 0 ? 'rgba(59,47,10,.55)' : ink, 'cv', 'left', w - 180);
        if (sp > 0) { const tw = Math.min(w - 180, TWW(c, s, 56, 'cv')); c.save(); c.strokeStyle = '#FF3B30'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); for (let k = 0; k <= 20 * sp; k++) { const xx = x0 + 122 + (tw + 12) * k / 20, yy = y + 2 + Math.sin(k * 1.3 + i) * 2.5; k ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke(); c.restore(); } }); });
  });

  A('f-ls-stepper', 'Степпер iOS: шаг 1 → 5', L, 3.5, (c, t, D) => {
    const e = env(t, D), x0 = 162, Y = 392, w = 700, h = 240, taps = [.9, 1.4, 1.9, 2.4], n = 1 + taps.filter(x => t >= x).length, lt = taps.filter(x => t >= x).pop(), r = lt ? ss((t - lt) / .28) : 1;
    const sx = x0 + w - 56 - 250, sy = Y + 100;
    wk(c, 512, 512, e, () => { card(c, x0, Y, w, h, 48); TT(c, 'Шаг', x0 + 56, Y + 64, 30, '#8E8E93', 'm', 'left');
      const nx = x0 + 56, ny = Y + 150, dw = TWW(c, '0', 96, 'k'); c.save(); c.beginPath(); c.rect(nx - 10, ny - 62, dw + 24, 124); c.clip();
      if (r < 1) { c.save(); c.globalAlpha *= 1 - r; TT(c, String(n - 1), nx, ny - 100 * eo(r), 96, '#111', 'k', 'left'); c.restore(); } c.save(); c.globalAlpha *= r; TT(c, String(n), nx, ny + 100 * (1 - eo(r)), 96, '#111', 'k', 'left'); c.restore(); c.restore();
      TT(c, 'из 5', nx + dw + 22, ny + 14, 36, '#8E8E93', 'b', 'left');
      rr(c, sx, sy - 48, 250, 96, 26); c.fillStyle = '#EFEFF4'; c.fill(); const pr = taps.reduce((m, x) => Math.max(m, prs(t, x)), 0);
      if (pr > 0) { c.save(); c.beginPath(); c.rect(sx + 125, sy - 48, 125, 96); c.clip(); rr(c, sx, sy - 48, 250, 96, 26); c.fillStyle = `rgba(0,0,0,${.08 * pr})`; c.fill(); c.restore(); }
      c.fillStyle = '#D1D1D6'; c.fillRect(sx + 124, sy - 26, 2, 52); c.strokeStyle = n > 1 ? '#111' : '#C7C7CC'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(sx + 44, sy); c.lineTo(sx + 82, sy); c.stroke();
      c.strokeStyle = n < 5 ? '#111' : '#C7C7CC'; c.beginPath(); c.moveTo(sx + 168, sy); c.lineTo(sx + 206, sy); c.moveTo(sx + 187, sy - 19); c.lineTo(sx + 187, sy + 19); c.stroke();
      for (let i = 0; i < 5; i++) { const on = i < n, k = on && i === n - 1 && lt ? 1 + .4 * Math.sin(Math.PI * cl((t - lt) / .3)) : 1; rr(c, sx + 125 - 2 * 28 + i * 28 - (on ? 9 : 6) * k, sy + 82 - 6, (on ? 18 : 12) * k, 12, 6); c.fillStyle = on ? '#0A84FF' : '#E0E0E6'; c.fill(); }
      taps.forEach(x => touch(c, sx + 190, sy + 8, t, x, 40)); });
  });

  A('f-ls-num', 'Пункт 01 → 02 → 03', L, 4, (c, t, D) => {
    const ch = [1.35, 2.55], I = ['Найди свой формат', 'Снимай каждый день', 'Смотри на цифры'], idx = ch.filter(x => t >= x).length, lt = ch[idx - 1], r = idx ? ss((t - lt) / .35) : 1, e = env(t, D), e2 = env(t, D, .2);
    wk(c, 512, 470, e, () => { c.save(); c.beginPath(); c.rect(0, 300, 1024, 340); c.clip(); const nm = i => '0' + (i + 1);
      if (r < 1) { c.save(); c.globalAlpha *= 1 - r; sh(c, .9); TT(c, nm(idx - 1), 512, 470 - 260 * eo(r), 230, '#fff', 'u'); c.restore(); }
      c.save(); c.globalAlpha *= r; sh(c, .9); TT(c, nm(idx), 512, 470 + 260 * (1 - eo(r)), 230, '#fff', 'u'); c.restore(); c.restore();
      const bw = 120 * (idx ? .4 + .6 * spr(t - lt, 14, .5) : spr(t - .3, 14, .5)); rr(c, 512 - bw / 2, 610, bw, 12, 6); c.fillStyle = grad(c, 452, 0, 572, 0, OR); c.fill(); });
    wk(c, 512, 730, e2, () => { const wA = idx ? TWW(c, I[idx - 1], 46) + 100 : 0, wB = TWW(c, I[idx], 46) + 100, pw = idx ? lerp(wA, wB, cl(spr(t - lt, 13, .7))) : wB;
      card(c, 512 - pw / 2, 730 - 60, pw, 120, 60, '#fff', 1); c.save(); rr(c, 512 - pw / 2, 670, pw, 120, 60); c.clip();
      if (idx && r < 1) { c.save(); c.globalAlpha *= 1 - r; TT(c, I[idx - 1], 512 - 120 * eo(r), 730, 46, '#111'); c.restore(); }
      c.save(); c.globalAlpha *= r; TT(c, I[idx], 512 + 120 * (1 - eo(r)), 730, 46, '#111'); c.restore(); c.restore(); });
  });

  A('f-ls-stories', 'Сегменты как в сторис: часть 1–4', L, 4, (c, t, D) => {
    const e = env(t, D), sp = i => cl((t - .35 - i * .75) / .75), x0 = 132, sw = (760 - 30) / 4, cur = Math.min(3, Math.floor(cl((t - .35) / 3) * 3.999)), ct = .35 + cur * .75;
    wk(c, 512, 470, e, () => { for (let i = 0; i < 4; i++) { const x = x0 + i * (sw + 10); c.save(); sh(c, .35); rr(c, x, 430, sw, 12, 6); c.fillStyle = 'rgba(255,255,255,.45)'; c.fill(); c.restore(); const p = sp(i); if (p > 0) { rr(c, x, 430, Math.max(12, sw * p), 12, 6); c.fillStyle = '#fff'; c.fill(); } }
      c.save(); sh(c, .5); circ(c, x0 + 34, 506, 36, '#fff'); c.restore(); avatar(c, x0 + 34, 506, 32, '#FF9A8B', '#8E6BFF', 'Я'); c.save(); sh(c, .6); TT(c, 'твой_ник', x0 + 86, 506, 32, '#fff', 'b', 'left'); TT(c, '2 ч', x0 + 98 + TWW(c, 'твой_ник', 32), 506, 30, 'rgba(255,255,255,.75)', 'm', 'left'); c.restore();
      const k = .8 + .2 * spr(t - ct, 16, .45), s = 'Часть ' + (cur + 1) + ' из 4', pw = TWW(c, s, 50) + 100; c.save(); c.translate(512, 650); c.scale(k, k); card(c, -pw / 2, -62, pw, 124, 62, '#fff', 1); TT(c, s, 0, 0, 50, '#111'); c.restore(); });
  });

  A('f-ls-podium', 'Пьедестал: 1-2-3 места', L, 3.5, (c, t, D) => {
    const base = 820, C = [[272, 230, 2, .55, ['#F2F2F7', '#AEAEB2'], 'М'], [512, 330, 1, .8, ['#FFE45C', '#FF9F0A'], 'А'], [752, 170, 3, .3, ['#FFC79A', '#D9822B'], 'К']], o = 1 - ein(cl((t - (D - .3)) / .3));
    c.save(); c.globalAlpha *= o;
    C.forEach(([x, H, n, t0, g, L2]) => { const hh = H * Math.max(0, spr(t - t0, 9, .62)); if (hh < 1) return; c.save(); sh(c, .9); c.beginPath(); c.roundRect(x - 110, base - hh, 220, hh, [28, 28, 8, 8]); c.fillStyle = grad(c, x - 110, 0, x + 110, 0, g); c.fill(); c.restore();
      c.save(); c.beginPath(); c.roundRect(x - 110, base - hh, 220, hh, [28, 28, 8, 8]); c.clip(); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x - 110, base - hh, 220, 16); TT(c, String(n), x, base - hh + 90, 110, '#fff', 'k'); c.restore();
      const p = pe(t, t0 + .45, 15, .5); wk(c, x, base - H - 70, p, () => { c.save(); sh(c, .6); circ(c, x, base - H - 70, 54, '#fff'); c.restore(); avatar(c, x, base - H - 70, 47, n === 1 ? '#FF9A8B' : n === 2 ? '#7FB5FF' : '#C79BFF', n === 1 ? '#FF2D55' : n === 2 ? '#5E5CE6' : '#8E6BFF', L2); }); });
    if (t > 1.9) { const p = pe(t, 1.9, 14, .45); p.r = -.12; wk(c, 512, base - 330 - 150, p, () => crown(c, 512, base - 330 - 128, 104)); } c.restore();
    confetti(c, 512, 430, t, 1.95, 28, 420);
  });

  A('f-ls-segment', 'Сегмент-переключатель iOS по шагам', L, 3.5, (c, t, D) => {
    const e = env(t, D), x0 = 132, Y = 332, w = 760, h = 360, taps = [1.1, 2.1], idx = taps.filter(x => t >= x).length, S = ['Шаг 1', 'Шаг 2', 'Шаг 3'], B = ['Сними исходник', 'Собери черновик', 'Добавь субтитры'];
    const tx = x0 + 40, tw = w - 80, sw = tw / 3, pos = cl(spr(t - taps[0], 13, .7)) + cl(spr(t - taps[1], 13, .7)), lt = taps[idx - 1], r = idx ? ss((t - lt) / .3) : 1;
    wk(c, 512, 512, e, () => { card(c, x0, Y, w, h, 48); rr(c, tx, Y + 40, tw, 96, 28); c.fillStyle = '#EFEFF4'; c.fill();
      c.save(); sh(c, .35); rr(c, tx + 6 + pos * sw, Y + 46, sw - 12, 84, 24); c.fillStyle = '#fff'; c.fill(); c.restore();
      S.forEach((s, i) => TT(c, s, tx + sw * (i + .5), Y + 88, 34, Math.abs(pos - i) < .5 ? '#111' : '#8E8E93', 'b'));
      if (idx && r < 1) { c.save(); c.globalAlpha *= 1 - r; TT(c, B[idx - 1], 512 - 60 * eo(r), Y + 228, 48, '#111'); c.restore(); }
      c.save(); c.globalAlpha *= r; TT(c, B[idx], 512 + (idx ? 60 * (1 - eo(r)) : 0), Y + 228, 48, '#111'); c.restore();
      for (let i = 0; i < 3; i++) { const on = i <= idx; rr(c, 512 - 50 + i * 36 - (i === idx ? 8 : 0), Y + 298, i === idx ? 32 : 16, 12, 6); c.fillStyle = on ? '#0A84FF' : '#E0E0E6'; c.fill(); }
      taps.forEach((x, i) => touch(c, tx + sw * (i + 1.5) + 10, Y + 98, t, x, 40)); });
  });

  A('f-ls-chips', '«Что понадобится»: чипсы-теги', L, 3.5, (c, t, D) => {
    const I = [['Телефон', '#0A84FF'], ['Свет', '#FFB800'], ['Микрофон', '#FF2D55'], ['Штатив', '#7B61FF'], ['Приложение', '#FF9500'], ['Идея', '#FF3B30']], px = 40, pad = 34, gap = 18, maxW = 840;
    const et = env(t, D); wk(c, 512, 330, et, () => { c.save(); sh(c, .9); TT(c, 'Что понадобится:', 512, 330, 64, '#fff', 'x'); c.restore(); });
    const ws = I.map(([s]) => TWW(c, s, px) + pad * 2 + 30), rows = [[]]; let cw = 0; ws.forEach((w, i) => { if (cw + w > maxW && rows[rows.length - 1].length) { rows.push([]); cw = 0; } rows[rows.length - 1].push(i); cw += w + gap; });
    rows.forEach((row, ri) => { const tot = row.reduce((s, i) => s + ws[i], 0) + gap * (row.length - 1); let x = 512 - tot / 2; const y = 480 + ri * 120;
      row.forEach(i => { const w = ws[i], cx = x + w / 2, e = env(t, D, .35 + i * .16); e.r = (i % 2 ? 1 : -1) * .05 * (1 - cl(spr(t - .35 - i * .16, 12, .5)));
        wk(c, cx, y, e, () => { card(c, x, y - 48, w, 96, 48, '#fff', .8); circ(c, x + pad + 6, y, 11, I[i][1]); TT(c, I[i][0], x + pad + 30, y, px, '#111', 'b', 'left'); }); x += w + gap; }); });
  });

  A('f-ls-focus', 'Список: подсветка переходит по пунктам', L, 4, (c, t, D) => {
    const e = env(t, D), x0 = 152, Y = 232, w = 720, h = 560, I = ['Цель ролика', 'Сценарий', 'Съёмка', 'Монтаж'], ts = [.6, 1.4, 2.2, 3.0], rh = 86, gp = 16, y0 = Y + 150;
    const pos = cl(spr(t - ts[1], 12, .68)) + cl(spr(t - ts[2], 12, .68)) + cl(spr(t - ts[3], 12, .68)), ha = cl((t - ts[0]) / .2), cur = Math.round(pos);
    wk(c, 512, 512, e, () => { card(c, x0, Y, w, h, 48, '#1C1C1E', 1.1); TT(c, 'План ролика', x0 + 56, Y + 82, 42, '#fff', 'b', 'left');
      if (ha > 0) { const hy = y0 + pos * (rh + gp), k = .9 + .1 * spr(t - ts[0], 14, .5); c.save(); c.globalAlpha *= ha; c.translate(512, hy + rh / 2); c.scale(k, k); sh(c, .6); rr(c, -(w - 72) / 2, -rh / 2, w - 72, rh, 26); c.fillStyle = grad(c, -(w - 72) / 2, 0, (w - 72) / 2, 0, OR); c.fill(); c.restore(); }
      I.forEach((s, i) => { const y = y0 + i * (rh + gp) + rh / 2, on = ha > .5 && i === cur, done = ha > .5 && i < cur;
        TT(c, '0' + (i + 1), x0 + 76, y, 30, on ? 'rgba(255,255,255,.8)' : '#636366', 'j', 'left'); TT(c, s, x0 + 150, y, 38, on ? '#fff' : done ? '#8E8E93' : '#E5E5EA', 'b', 'left');
        if (done) chk(c, x0 + w - 84, y, 30, 1, '#FF9F0A', 5); if (on) { c.save(); c.globalAlpha *= ss((Math.abs(pos - cur) < .15 ? 1 : 0)); arrowR(c, x0 + w - 84, y, 30, '#fff', 5); c.restore(); } }); });
  });

  A('f-ls-accordion', 'Аккордеон: пункт раскрывается', L, 4, (c, t, D) => {
    const e = env(t, D), x0 = 152, w = 720, tc = 1.1, ex = cl(spr(t - tc - .05, 12, .75)), eh = 150 * ex, rh = 108, H = 32 + rh * 3 + eh, Hm = 32 + rh * 3 + 150, Y = 512 - Hm / 2, I = ['Как начать вести блог?', 'Сколько это стоит?', 'Где учиться?'];
    wk(c, 512, 512, e, () => { card(c, x0, Y, w, H, 44); let y = Y + 16;
      I.forEach((s, i) => { const open = i === 0, hl = open ? prs(t, tc) : 0; if (hl > 0) { c.save(); rr(c, x0 + 12, y + 4, w - 24, rh - 8, 30); c.fillStyle = `rgba(0,0,0,${.05 * hl})`; c.fill(); c.restore(); }
        TT(c, s, x0 + 52, y + rh / 2, 38, '#111', 'b', 'left', w - 160); ic(c, 'down', x0 + w - 70, y + rh / 2, 48, open && ex > 0 ? '#0A84FF' : '#8E8E93', 0, open ? Math.PI * ex : 0);
        y += rh; if (open && eh > 1) { c.save(); c.beginPath(); c.rect(x0, y, w, eh); c.clip(); c.globalAlpha *= cl((ex - .3) / .5);
          const L2 = wrapC(c, 'Сними первый ролик на телефон уже сегодня — идеальный момент не наступит.', 32, 'm', w - 120); L2.forEach((l, j) => TT(c, l, x0 + 52, y + 26 + j * 44, 32, '#636366', 'm', 'left')); c.restore(); y += eh; }
        if (i < 2) { c.fillStyle = '#EEEEF2'; c.fillRect(x0 + 52, y - 1, w - 104, 2); } });
      touch(c, x0 + 420, Y + 16 + rh / 2 + 6, t, tc, 44); });
  });

  A('f-ls-ring', 'Задачи с кольцом прогресса', L, 4, (c, t, D) => {
    const e = env(t, D), x0 = 132, Y = 332, w = 760, h = 360, I = ['Сценарий', 'Съёмка', 'Монтаж'], ts = [1.0, 1.65, 2.3], rx = x0 + 190, ry = Y + h / 2;
    const nd = ts.filter(x => t >= x).length, p = ts.reduce((s, x) => s + cl(spr(t - x, 11, .7)), 0) / 3, all = nd === 3;
    wk(c, 512, 512, e, () => { card(c, x0, Y, w, h, 52, '#1C1C1E', 1.1);
      c.lineWidth = 22; c.strokeStyle = '#2C2C2E'; circ(c, rx, ry, 110); c.stroke(); if (p > 0) { c.lineCap = 'round'; c.strokeStyle = grad(c, rx - 110, ry - 110, rx + 110, ry + 110, ['#FFB547', '#FF2D55']); c.beginPath(); c.arc(rx, ry, 110, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(.003, Math.min(1.02, p))); c.stroke(); }
      const nk = nd ? .8 + .2 * spr(t - ts[nd - 1], 16, .45) : 1; c.save(); c.translate(rx, ry - 12); c.scale(nk, nk); TT(c, nd + '/3', 0, 0, 60, '#fff', 'k'); c.restore(); TT(c, all ? 'готово' : 'задачи', rx, ry + 42, 24, all ? '#FF9F0A' : '#8E8E93', 'm');
      I.forEach((s, i) => { const y = Y + 92 + i * 88, on = t >= ts[i], k = on ? .75 + .25 * spr(t - ts[i], 17, .4) : 1; c.save(); c.translate(x0 + 400, y); c.scale(k, k);
        if (on) { circ(c, 0, 0, 26, grad(c, -26, -26, 26, 26, ['#FFB547', '#FF2D55'])); chk(c, 0, 0, 30, cl((t - ts[i]) / .22), '#fff', 6); } else { circ(c, 0, 0, 24); c.lineWidth = 4; c.strokeStyle = '#48484A'; c.stroke(); } c.restore();
        TT(c, s, x0 + 452, y, 38, on ? '#fff' : '#8E8E93', 'b', 'left'); }); });
    burst(c, rx, ry, t, ts[2] + .1, { n: 12, R: 170, s: 8, ring: false, lines: true, cols: ['#FFB547', '#FF2D55', '#FFD60A'] });
  });

  // дорожная карта: точки пути (Catmull-Rom)
  const RP = [[160, 740], [400, 540], [640, 650], [850, 400]], ROAD = (() => { const P = [RP[0], ...RP, RP[3]], out = [];
    for (let i = 1; i < P.length - 2; i++) for (let k = 0; k < 40; k++) { const s = k / 40, [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]], f = (a, b, c2, d) => .5 * (2 * b + (-a + c2) * s + (2 * a - 5 * b + 4 * c2 - d) * s * s + (-a + 3 * b - 3 * c2 + d) * s * s * s); out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]); }
    out.push(RP[3]); return out; })();
  A('f-ls-road', 'Дорожная карта: путь с отметками', L, 4.5, (c, t, D) => {
    const p = eio(cl((t - .3) / 2.4)), n = Math.floor(p * (ROAD.length - 1)), o = 1 - ein(cl((t - (D - .3)) / .3)), cols = ['#0A84FF', '#7B61FF', '#FF9500', '#FF2D55'], lab = ['Старт', '1 000', '10 000', '100 000'];
    c.save(); c.globalAlpha *= o; if (n > 0) { c.save(); sh(c, .5); c.strokeStyle = '#fff'; c.lineWidth = 15; c.lineCap = 'round'; c.lineJoin = 'round'; c.setLineDash([2, 30]); c.beginPath(); for (let i = 0; i <= n; i++) i ? c.lineTo(ROAD[i][0], ROAD[i][1]) : c.moveTo(ROAD[i][0], ROAD[i][1]); c.stroke(); c.restore(); } c.restore();
    RP.forEach(([x, y], i) => { const ti = .3 + 2.4 * [0, .3, .62, 1][i] * .92, e = env(t, D, ti), dy = (1 - cl(spr(t - ti, 12, .5))) * -60, last = i === 3;
      c.save(); c.translate(0, dy); wk(c, x, y, e, () => { c.save(); c.translate(x, y); c.scale(1.4, 1.4); c.translate(-x, -y); if (last) { c.save(); sh(c, .6); c.fillStyle = '#fff'; c.fillRect(x - 4, y - 120, 8, 120); c.restore(); c.beginPath(); c.moveTo(x + 4, y - 120); c.quadraticCurveTo(x + 50, y - 108 + Math.sin(t * 6) * 6, x + 96, y - 118); c.lineTo(x + 96, y - 64); c.quadraticCurveTo(x + 50, y - 54 + Math.sin(t * 6 + 1) * 6, x + 4, y - 66); c.closePath(); c.fillStyle = grad(c, x, 0, x + 96, 0, OR); c.fill(); star4(c, x + 50, y - 91, 14, '#fff'); }
        else pin(c, x, y, cols[i], String(i + 1)); c.restore(); }); c.restore();
      const e2 = env(t, D, ti + .15), lw = TWW(c, lab[i], 36, 'k') + 56, ly = last ? y - 222 : i === 1 ? y - 192 : y + 88; wk(c, x, ly, e2, () => { card(c, x - lw / 2, ly - 34, lw, 68, 34, '#fff', .7); TT(c, lab[i], x, ly, 36, '#111', 'k'); }); });
    if (t > 2.6) confetti(c, RP[3][0], RP[3][1] - 100, t, 2.65, 18, 300);
  });
})(window);

/* ---- styles7b.js ---- */
/* Футажи: новые категории (часть b) — рисуют инструментами window.KKFOOT из styles6.js
   «Экраны и интерфейсы» (+10, f-ui-*) и «Камера и запись» (20, f-cam-*). Без зелёного: это цвет хромакея. */
(function (G) {
  const F = G.KKFOOT; if (!F) return;
  const { A, cl, eo, eio, ein, lerp, ss, TAU, spr, env, wk, prs, track, rr, T, TW, sh, nosh, card, circ, grad, nb, ic, cursor, ripple, touch, burst } = F;
  const UI = 'Экраны и интерфейсы', CAM = 'Камера и запись', MONO = 'JetBrainsMono-Bold';

  /* ---------- свои помощники ---------- */
  const TX = (c, s, x, y, px, col, font, al = 'center') => { c.font = `${px}px "${font}"`; c.fillStyle = col; c.textAlign = al; c.textBaseline = 'middle'; c.fillText(s, x, y + px * .04); };
  const TXW = (c, s, px, font) => { c.font = `${px}px "${font}"`; return c.measureText(s).width; };
  const rnd = i => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
  const glass = (c, x, y, w, h, r, a = .66) => card(c, x, y, w, h, r, `rgba(20,20,22,${a})`, .7);
  const hudSh = c => { c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 16; c.shadowOffsetY = 3; };
  const outK = (t, D, o = .3) => ein(cl((t - (D - o)) / o));
  const fadeIn = (t, t0, d = .15) => cl((t - t0) / d);
  const fmt2 = n => String(n).padStart(2, '0');

  function icSearch(c, x, y, s, col) { c.save(); c.strokeStyle = col; c.lineWidth = s * .12; c.lineCap = 'round'; circ(c, x - s * .07, y - s * .07, s * .29); c.stroke(); c.beginPath(); c.moveTo(x + s * .15, y + s * .15); c.lineTo(x + s * .38, y + s * .38); c.stroke(); c.restore(); }
  function icCam(c, x, y, s, col, bg) { c.save(); c.fillStyle = col; rr(c, x - s / 2, y - s * .28, s, s * .64, s * .14); c.fill(); rr(c, x - s * .17, y - s * .4, s * .34, s * .2, s * .06); c.fill();
    circ(c, x, y + s * .04, s * .2, bg); circ(c, x, y + s * .04, s * .12, col); c.restore(); }
  function icSpk(c, x, y, s, col) { c.save(); c.translate(x, y); c.scale(s / 100, s / 100); c.fillStyle = col; c.strokeStyle = col; c.lineJoin = 'round'; c.lineWidth = 8;
    c.beginPath(); c.moveTo(-40, -16); c.lineTo(-18, -16); c.lineTo(8, -40); c.lineTo(8, 40); c.lineTo(-18, 16); c.lineTo(-40, 16); c.closePath(); c.stroke(); c.fill(); c.restore(); }
  function icMic(c, x, y, s, col) { c.save(); c.translate(x, y); c.scale(s / 100, s / 100); c.fillStyle = col; rr(c, -17, -46, 34, 62, 17); c.fill();
    c.strokeStyle = col; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.arc(0, -6, 31, 0, Math.PI); c.stroke(); c.beginPath(); c.moveTo(0, 26); c.lineTo(0, 44); c.moveTo(-17, 44); c.lineTo(17, 44); c.stroke(); c.restore(); }
  function icPause(c, x, y, s, col) { c.fillStyle = col; rr(c, x - s * .3, y - s * .36, s * .2, s * .72, s * .05); c.fill(); rr(c, x + s * .1, y - s * .36, s * .2, s * .72, s * .05); c.fill(); }
  function battery(c, x, y, w, h, lvl, col, fillCol) { c.save(); c.lineWidth = h * .11; c.strokeStyle = col; rr(c, x, y, w, h, h * .28); c.stroke();
    rr(c, x + w + h * .1, y + h * .3, h * .13, h * .4, h * .06); c.fillStyle = col; c.fill();
    const p = h * .2; if (lvl > .001) { rr(c, x + p, y + p, (w - 2 * p) * Math.min(1, lvl), h - 2 * p, h * .12); c.fillStyle = fillCol || col; c.fill(); } c.restore(); }
  // «фото»: закат с холмами (без зелени)
  function photoArt(c, x, y, w, h, r) { c.save(); rr(c, x, y, w, h, r); c.clip(); c.fillStyle = grad(c, 0, y, 0, y + h, ['#FFC48C', '#FF7E8A', '#B06AB3']); c.fillRect(x, y, w, h);
    circ(c, x + w * .62, y + h * .44, Math.min(w, h) * .16, 'rgba(255,244,214,.96)');
    c.fillStyle = 'rgba(110,70,160,.78)'; c.beginPath(); c.moveTo(x, y + h * .72); c.bezierCurveTo(x + w * .3, y + h * .56, x + w * .55, y + h * .82, x + w, y + h * .62); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.fill();
    c.fillStyle = 'rgba(52,32,92,.9)'; c.beginPath(); c.moveTo(x, y + h * .86); c.bezierCurveTo(x + w * .4, y + h * .74, x + w * .7, y + h * .96, x + w, y + h * .8); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.fill(); c.restore(); }
  // столбики эквалайзера
  function eqBars(c, cx, cy, n, bw, gap, H, t, col, sp = 1) { const W = n * bw + (n - 1) * gap; for (let i = 0; i < n; i++) { const k = .28 + .72 * Math.abs(Math.sin(t * (5.3 + i * 1.7) * sp + i * 1.9)), hh = H * k;
    rr(c, cx - W / 2 + i * (bw + gap), cy - hh / 2, bw, hh, bw / 2); c.fillStyle = col; c.fill(); } }
  // цифра-перекат: из a в b около момента tc
  function rollTxt(c, a, b, tc, t, x, y, px, col, font, al = 'center', clipW = 200) { const r = ss((t - tc) / .32); c.save(); c.beginPath(); c.rect(al === 'left' ? x - 6 : al === 'right' ? x - clipW : x - clipW / 2, y - px * .66, clipW + 6, px * 1.32); c.clip();
    if (r < 1) { c.save(); c.globalAlpha *= 1 - r; TX(c, a, x, y - r * px * 1.1, px, col, font, al); c.restore(); } if (r > 0) { c.save(); c.globalAlpha *= r; TX(c, b, x, y + (1 - r) * px * 1.1, px, col, font, al); c.restore(); } c.restore(); }

  /* =====================================================================
     Экраны и интерфейсы (+10)
     ===================================================================== */
  A('f-ui-search', 'Поиск: печатается запрос и подсказки', UI, 4, (c, t, D) => {
    const e = env(t, D), X = 112, Y = 270, w = 800, h = 112, q = 'как монтировать рилс', tq = .75, n = Math.floor(cl((t - tq) / 1.25) * q.length + 1e-4), typed = q.slice(0, n), foc = ss((t - .42) / .2);
    const sugg = ['на телефоне', 'в CapCut', 'с музыкой'], t2 = 2.15, dk = spr(t - t2, 13, .7), dy = Y + h + 22, dh = 3 * 96 + 24;
    wk(c, 512, 512, e, () => {
      card(c, X, Y, w, h, h / 2, '#fff', 1);
      if (foc > 0) { c.save(); c.globalAlpha *= foc; c.lineWidth = 5; c.strokeStyle = 'rgba(10,132,255,.5)'; rr(c, X - 7, Y - 7, w + 14, h + 14, h / 2 + 7); c.stroke(); c.restore(); }
      icSearch(c, X + 62, Y + h / 2, 46, '#8E8E93');
      if (!typed) T(c, 'Поиск', X + 112, Y + h / 2, 38, '#AEAEB2', 'm', 'left'); else T(c, typed, X + 112, Y + h / 2, 38, '#111', 'm', 'left');
      if (foc > 0 && ((t > tq && n < q.length) || Math.floor(t * 2.4) % 2 === 0)) { const cw = typed ? TW(c, typed, 38, 'm') : 0; c.fillStyle = '#0A84FF'; c.fillRect(X + 114 + cw, Y + 32, 4, h - 64); }
      if (n > 0) { const ka = spr(t - tq, 16, .6); c.save(); c.translate(X + w - 60, Y + h / 2); c.scale(ka, ka); circ(c, 0, 0, 22, '#C7C7CC'); ic(c, 'close', 0, 0, 28, '#fff'); c.restore(); }
      if (t > t2) wk(c, 512, dy, { k: 1, ky: Math.max(0, .75 + .25 * dk), a: cl((t - t2) / .12) }, () => { card(c, X, dy, w, dh, 40, '#fff', .9);
        sugg.forEach((s, i) => { const ry = dy + 12 + i * 96, a = cl((t - t2 - .07 * i) / .18), sel = i === 0 ? ss((t - 3.05) / .1) * (1 - ss((t - 3.4) / .2)) : 0;
          c.save(); c.globalAlpha *= a; c.translate(0, (1 - eo(a)) * 14);
          if (sel > 0) { c.save(); c.globalAlpha *= sel; rr(c, X + 12, ry, w - 24, 96, 30); c.fillStyle = '#F2F2F7'; c.fill(); c.restore(); }
          icSearch(c, X + 62, ry + 48, 34, '#C7C7CC'); T(c, q, X + 112, ry + 48, 32, '#8E8E93', 'm', 'left'); T(c, s, X + 112 + TW(c, q + ' ', 32, 'm'), ry + 48, 32, '#111', 'b', 'left');
          if (i < 2) { c.fillStyle = '#EFEFF4'; c.fillRect(X + 112, ry + 95, w - 150, 2); } c.restore(); }); });
      touch(c, X + 420, Y + h / 2 + 10, t, .42, 44); touch(c, X + 380, dy + 70, t, 3.12, 44);
    });
  });

  A('f-ui-island', 'Dynamic Island раскрывается', UI, 4, (c, t, D) => {
    const e = env(t, D), m = spr(t - .9, 11, .62) - spr(t - 3.0, 12, .78), W0 = 250, H0 = 74, W1 = 820, H1 = 240;
    const w = Math.max(170, lerp(W0, W1, m)), h = Math.max(56, lerp(H0, H1, m)), r = Math.min(h / 2, lerp(37, 66, cl(m))), x = 512 - w / 2, y0 = 392;
    const ca = ss((m - .72) / .28), cc = 1 - ss(m / .3), p = .36 + .1 * cl((t - .9) / 2.5);
    wk(c, 512, y0 + H0 / 2, e, () => {
      c.save(); sh(c, .8); rr(c, x, y0, w, h, r); c.fillStyle = '#000'; c.fill(); c.restore();
      c.save(); rr(c, x, y0, w, h, r); c.clip(); const ga = c.globalAlpha;
      if (cc > 0) { c.globalAlpha = ga * cc; rr(c, x + 18, y0 + h / 2 - 22, 44, 44, 12); c.fillStyle = grad(c, x + 18, y0, x + 62, y0 + 60, ['#FF9F0A', '#FF375F', '#BF5AF2']); c.fill(); eqBars(c, x + w - 48, y0 + h / 2, 4, 6, 5, 30, t, '#FF9F0A'); }
      if (ca > 0) { c.globalAlpha = ga * ca; const L = 512 - W1 / 2, dyc = (1 - ca) * -10;
        c.save(); c.translate(0, dyc);
        rr(c, L + 36, y0 + 34, 116, 116, 26); c.fillStyle = grad(c, L + 36, y0 + 34, L + 152, y0 + 150, ['#FFB36B', '#FF375F', '#8E5BFF']); c.fill(); circ(c, L + 94, y0 + 92, 26, 'rgba(255,255,255,.28)'); circ(c, L + 94, y0 + 92, 9, 'rgba(0,0,0,.35)');
        T(c, 'Сейчас играет', L + 180, y0 + 66, 26, '#8E8E93', 'm', 'left'); T(c, 'Твой трек', L + 180, y0 + 112, 40, '#fff', 'b', 'left');
        eqBars(c, L + W1 - 92, y0 + 90, 5, 9, 7, 54, t, '#FF9F0A');
        const by = y0 + 192, bx0 = L + 120, bx1 = L + W1 - 120; T(c, '1:' + fmt2(12 + Math.floor((t - .9) * .9 > 0 ? (t - .9) * .9 : 0)), L + 40, by, 22, '#8E8E93', 'm', 'left'); T(c, '-2:03', L + W1 - 40, by, 22, '#8E8E93', 'm', 'right');
        rr(c, bx0, by - 5, bx1 - bx0, 10, 5); c.fillStyle = '#3A3A3C'; c.fill(); rr(c, bx0, by - 5, (bx1 - bx0) * p, 10, 5); c.fillStyle = '#fff'; c.fill(); c.restore(); }
      c.restore();
    });
  });

  A('f-ui-alert', 'Окно «Разрешить доступ?» — нажимают «Разрешить»', UI, 3.5, (c, t, D) => {
    const tc = 1.75, out = ss((t - tc - .22) / .22), e0 = env(t, D), w = 620, H = 480, X = 512 - w / 2, Y = 512 - H / 2, by = Y + H - 104;
    wk(c, 512, 512, { k: e0.k * (1 - .1 * out), a: e0.a * (1 - out) }, () => {
      card(c, X, Y, w, H, 40, 'rgba(246,246,248,.98)', 1);
      rr(c, 512 - 50, Y + 40, 100, 100, 24); c.fillStyle = grad(c, 0, Y + 40, 0, Y + 140, ['#8E8E93', '#48484A']); c.fill(); icCam(c, 512, Y + 92, 60, '#fff', '#68686C');
      T(c, 'Разрешить доступ', 512, Y + 188, 36, '#111'); T(c, 'к камере?', 512, Y + 232, 36, '#111');
      T(c, 'Приложение сможет снимать', 512, Y + 290, 26, '#6C6C70', 'm'); T(c, 'фото и видео', 512, Y + 324, 26, '#6C6C70', 'm');
      const hl = Math.max(prs(t, tc), t > tc && t < tc + .3 ? 1 : 0); if (hl > 0) { c.save(); rr(c, X, Y, w, H, 40); c.clip(); c.fillStyle = `rgba(0,0,0,${.08 * hl})`; c.fillRect(512, by, w / 2, 104); c.restore(); }
      c.fillStyle = 'rgba(60,60,67,.2)'; c.fillRect(X, by, w, 2); c.fillRect(511, by, 2, 104);
      T(c, 'Запретить', X + w / 4, by + 53, 32, '#0A84FF', 'm'); T(c, 'Разрешить', X + w * .75, by + 53, 32, '#0A84FF', 'b');
    });
    touch(c, X + w * .75 + 12, by + 62, t, tc, 44);
    const pk = spr(t - tc - .38, 14, .6), o = outK(t, D), pw = TW(c, 'Доступ разрешён', 40) + 150;
    wk(c, 512, 512, { k: pk * (1 - .3 * o), a: cl((t - tc - .38) / .1) * (1 - o) }, () => { card(c, 512 - pw / 2, 456, pw, 112, 56, 'rgba(22,22,24,.9)', .8);
      circ(c, 512 - pw / 2 + 62, 512, 30, '#0A84FF'); ic(c, 'check', 512 - pw / 2 + 62, 512, 40, '#fff'); T(c, 'Доступ разрешён', 512 - pw / 2 + 108, 512, 40, '#fff', 'b', 'left'); });
  });

  A('f-ui-toggle', 'Переключатели включаются по очереди', UI, 3.5, (c, t, D) => {
    const e = env(t, D), X = 142, w = 740, rh = 128, rows = [['Уведомления', ['#FF6B6B', '#FF3B30'], 'bell', .8], ['Автосохранение', ['#5AC8FA', '#0A84FF'], 'bookmark', 1.35], ['Субтитры', ['#C77DFF', '#7B61FF'], 'play', 1.9]], H = rows.length * rh, Y = 512 - H / 2;
    wk(c, 512, 512, e, () => { card(c, X, Y, w, H, 40);
      rows.forEach(([s, g, icn, tc], i) => { const y = Y + i * rh, cy = y + rh / 2, tw = 124, th = 74, tx = X + w - 36 - tw, ty = cy - th / 2, m = spr(t - tc, 16, .6), f = ss((t - tc) / .18), pr = prs(t, tc);
        rr(c, X + 36, cy - 36, 72, 72, 18); c.fillStyle = grad(c, X + 36, cy - 36, X + 108, cy + 36, g); c.fill(); ic(c, icn, X + 72, cy, 44, '#fff');
        T(c, s, X + 134, cy, 38, '#111', 'b', 'left');
        rr(c, tx, ty, tw, th, th / 2); c.fillStyle = '#E9E9EB'; c.fill(); if (f > 0) { c.save(); c.globalAlpha *= f; c.fillStyle = '#0A84FF'; c.fill(); c.restore(); }
        const kw = 64 + 14 * pr, kx = lerp(tx + 5, tx + tw - 5 - kw, m); c.save(); c.shadowColor = 'rgba(0,0,0,.22)'; c.shadowBlur = 10; c.shadowOffsetY = 4; rr(c, kx, ty + 5, kw, th - 10, (th - 10) / 2); c.fillStyle = '#fff'; c.fill(); c.restore();
        if (i < rows.length - 1) { c.fillStyle = '#E5E5EA'; c.fillRect(X + 134, y + rh - 1, w - 134, 2); }
        touch(c, tx + tw / 2 + 10, cy + 10, t, tc, 40); }); });
  });

  function cloudPath(c, x, y, s) { const k = s / 100; c.beginPath(); c.roundRect(x - 150 * k, y + 10 * k, 300 * k, 100 * k, 50 * k);
    c.moveTo(x - 10 * k, y + 30 * k); c.arc(x - 80 * k, y + 30 * k, 70 * k, 0, TAU); c.moveTo(x + 115 * k, y - 10 * k); c.arc(x + 20 * k, y - 10 * k, 95 * k, 0, TAU); c.moveTo(x + 167 * k, y + 45 * k); c.arc(x + 105 * k, y + 45 * k, 62 * k, 0, TAU); }
  A('f-ui-upload', 'Загрузка в облако: облако наполняется', UI, 3.5, (c, t, D) => {
    const e = env(t, D), cx = 506, cy = 420, s = 145, k = s / 100, p = eio(cl((t - .5) / 1.9)), td = 2.45, done = t > td, f = ss((t - td) / .2), bnc = done ? 1 + .06 * Math.sin(Math.PI * cl((t - td) / .3)) : 1;
    const top = cy - 105 * k, bot = cy + 110 * k, lv = lerp(bot + 4, top - 14, p), wave = () => { c.beginPath(); c.moveTo(cx - 320, bot + 20); for (let xx = -320; xx <= 320; xx += 10) c.lineTo(cx + xx, lv + Math.sin(xx / 38 + t * 7) * 9 * (1 - p * .7)); c.lineTo(cx + 320, bot + 20); c.closePath(); };
    const arrow = (col, dy) => { c.save(); c.strokeStyle = col; c.lineWidth = 17; c.lineCap = 'round'; c.lineJoin = 'round'; c.globalAlpha *= 1 - f; c.beginPath(); c.moveTo(cx + 6, cy + 62 + dy); c.lineTo(cx + 6, cy - 36 + dy); c.moveTo(cx - 34, cy + 4 + dy); c.lineTo(cx + 6, cy - 38 + dy); c.lineTo(cx + 46, cy + 4 + dy); c.stroke(); c.restore(); };
    const ady = done ? 0 : -10 * Math.sin(t * 6);
    wk(c, 512, 512, e, () => {
      c.save(); c.translate(cx, cy + 40); c.scale(bnc, bnc); c.translate(-cx, -cy - 40);
      c.save(); sh(c, 1); cloudPath(c, cx, cy, s); c.fillStyle = '#fff'; c.fill(); c.restore();
      c.save(); cloudPath(c, cx, cy, s); c.clip(); arrow('#0A84FF', ady); wave(); c.fillStyle = grad(c, 0, top, 0, bot, ['#6FD0FF', '#0A84FF']); c.fill(); wave(); c.clip(); arrow('#fff', ady); c.restore();
      if (done) { const kk = spr(t - td, 15, .45); c.save(); c.globalAlpha *= f; c.translate(cx + 6, cy + 16); c.scale(kk, kk); ic(c, 'check', 0, 0, 150, '#fff'); c.restore(); }
      c.restore();
      const Y2 = 650, w2 = 620, X2 = 512 - w2 / 2; card(c, X2, Y2, w2, 120, 36);
      rr(c, X2 + 32, Y2 + 26, 54, 68, 10); c.fillStyle = '#E8F2FF'; c.fill(); ic(c, 'play', X2 + 59, Y2 + 61, 34, '#0A84FF');
      T(c, 'видео_финал.mp4', X2 + 108, Y2 + 44, 32, '#111', 'b', 'left');
      c.save(); c.globalAlpha *= 1 - f; T(c, Math.round(248 * p) + ' из 248 МБ', X2 + 108, Y2 + 84, 25, '#8E8E93', 'm', 'left'); T(c, Math.round(p * 100) + '%', X2 + w2 - 36, Y2 + 60, 36, '#0A84FF', 'b', 'right'); c.restore();
      if (f > 0) { c.save(); c.globalAlpha *= f; T(c, 'Загружено в облако', X2 + 108, Y2 + 84, 25, '#0A84FF', 'm', 'left'); const kk = spr(t - td, 16, .45); c.translate(X2 + w2 - 62, Y2 + 60); c.scale(kk, kk); circ(c, 0, 0, 26, '#0A84FF'); ic(c, 'check', 0, 0, 34, '#fff'); c.restore(); }
    });
  });

  A('f-ui-player', 'Видеоплеер: нажали «плей», бежит прогресс', UI, 4, (c, t, D) => {
    const e = env(t, D), tc = 1.05, on = t >= tc, X = 112, w = 800, by = 640, bh = 128, el = on ? (t - tc) * 1.15 : 0, tot = 8, p = .015 + el / tot;
    const bk = on ? 1 + .3 * eo(cl((t - tc - .05) / .45)) : 1 - .08 * prs(t, tc), ba = on ? 1 - ss((t - tc - .1) / .4) : 1;
    wk(c, 512, 512, e, () => {
      if (ba > 0) { c.save(); c.globalAlpha *= ba; c.translate(512, 400); c.scale(bk, bk); c.save(); sh(c, .7); circ(c, 0, 0, 110, 'rgba(20,20,22,.6)'); c.restore(); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.25)'; c.stroke();
        if (!on) ic(c, 'play', 10, 0, 130, '#fff'); else icPause(c, 0, 0, 110, '#fff'); c.restore(); }
      glass(c, X, by, w, bh, 40, .74);
      const cy = by + bh / 2; if (on) icPause(c, X + 64, cy, 46, '#fff'); else ic(c, 'play', X + 66, cy, 58, '#fff');
      T(c, '0:' + fmt2(Math.floor(el)) + ' / 0:' + fmt2(tot), X + 116, cy, 28, '#fff', 'b', 'left');
      const x0 = X + 318, x1 = X + w - 128, px = lerp(x0, x1, p); rr(c, x0, cy - 5, x1 - x0, 10, 5); c.fillStyle = 'rgba(255,255,255,.28)'; c.fill();
      rr(c, x0, cy - 5, px - x0, 10, 5); c.fillStyle = '#FF3B30'; c.fill(); circ(c, px, cy, 15, '#fff');
      icSpk(c, X + w - 74, cy, 40, '#fff'); c.save(); c.strokeStyle = '#fff'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.arc(X + w - 74, cy, 22, -.7, .7); c.stroke(); c.restore();
    });
    touch(c, 530, 420, t, tc, 50);
  });

  A('f-ui-voice', 'Голосовое сообщение проигрывается', UI, 4, (c, t, D) => {
    const e = env(t, D), tc = 1.0, on = t >= tc, w = 680, h = 150, X = 512 - w / 2, Y = 512 - h / 2, N = 30, p = on ? cl((t - tc) / 2.6) : 0, wx0 = X + 160, wx1 = X + w - 120;
    wk(c, X + w, Y + h, e, () => {
      c.save(); sh(c, 1); c.fillStyle = grad(c, X, Y, X + w, Y + h, ['#3A9BFF', '#0A6CFF']); rr(c, X, Y, w, h, 75); c.fill();
      c.beginPath(); c.moveTo(X + w - 70, Y + h - 4); c.quadraticCurveTo(X + w - 10, Y + h + 2, X + w + 20, Y + h + 4); c.quadraticCurveTo(X + w - 6, Y + h - 22, X + w - 18, Y + h - 70); c.closePath(); c.fill(); c.restore();
      const bk = 1 - .1 * prs(t, tc); c.save(); c.translate(X + 82, Y + h / 2); c.scale(bk, bk); circ(c, 0, 0, 48, '#fff'); if (on && p < 1) icPause(c, 0, 0, 44, '#0A6CFF'); else ic(c, 'play', 4, 0, 58, '#0A6CFF'); c.restore();
      const step = (wx1 - wx0) / N; for (let i = 0; i < N; i++) { const hh = 14 + 66 * (.25 + .75 * rnd(i * 3.1)) * (.55 + .45 * Math.sin(i * .45 + 1)), played = i / N < p, cur = on && Math.abs(i / N - p) < 1.5 / N ? 1.12 : 1;
        rr(c, wx0 + i * step, Y + h / 2 - hh * cur / 2, step * .55, hh * cur, step * .3); c.fillStyle = played ? '#fff' : 'rgba(255,255,255,.42)'; c.fill(); }
      T(c, '0:0' + (on ? Math.min(7, Math.floor(p * 7.99)) : 7), X + w - 42, Y + h / 2, 30, '#fff', 'b', 'right');
    });
    touch(c, X + 90, Y + h / 2 + 8, t, tc, 44);
  });

  A('f-ui-keyboard', 'Клавиатура печатает «привет всем»', UI, 4, (c, t, D) => {
    const e = env(t, D), msg = 'привет всем', t0 = .8, dt = .17, R3 = ['йцукенгшщзх', 'фывапролджэ', 'ячсмитьбю'], KX = 72, KW = 880, kbY = 382, kh = 90, kw = 66, gap = (KW - 40 - 11 * kw) / 10, rs = 106;
    const n = t < t0 ? 0 : Math.min(msg.length, Math.floor((t - t0) / dt) + 1), typed = msg.slice(0, n), shown = typed ? typed[0].toUpperCase() + typed.slice(1) : '';
    const curI = t >= t0 && t < t0 + msg.length * dt ? Math.floor((t - t0) / dt) : -1, pressOn = curI >= 0 && (t - t0 - curI * dt) < .13, curCh = pressOn ? msg[curI] : null;
    const keyRect = ch => { for (let r = 0; r < 3; r++) { const i = R3[r].indexOf(ch); if (i < 0) continue; const rw = R3[r].length * kw + (R3[r].length - 1) * gap, x = KX + KW / 2 - rw / 2 + i * (kw + gap); return [x, kbY + 20 + r * rs, kw, kh]; } return null; };
    const key = (x, y, w, h, fill, lbl, px = 40, col = '#111', f = 'm') => { rr(c, x, y + 3, w, h, 12); c.fillStyle = 'rgba(0,0,0,.22)'; c.fill(); rr(c, x, y, w, h, 12); c.fillStyle = fill; c.fill(); if (lbl) T(c, lbl, x + w / 2, y + h / 2, px, col, f); };
    wk(c, 512, 560, e, () => {
      const FY = 160; card(c, KX, FY, KW, 100, 50, '#fff', 1); T(c, shown || 'Сообщение', KX + 44, FY + 50, 40, shown ? '#111' : '#AEAEB2', 'm', 'left');
      if (pressOn || Math.floor(t * 2.4) % 2 === 0) { const cw = shown ? TW(c, shown, 40, 'm') : 0; c.fillStyle = '#0A84FF'; c.fillRect(KX + 46 + cw, FY + 28, 4, 44); }
      const sf = ss(n / 1); circ(c, KX + KW - 52, FY + 50, 32, sf > .5 ? '#0A84FF' : '#C7C7CC'); c.save(); c.strokeStyle = '#fff'; c.lineWidth = 6; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(KX + KW - 52, FY + 66); c.lineTo(KX + KW - 52, FY + 34); c.moveTo(KX + KW - 66, FY + 47); c.lineTo(KX + KW - 52, FY + 33); c.lineTo(KX + KW - 38, FY + 47); c.stroke(); c.restore();
      card(c, KX, kbY, KW, 4 * rs + 26, 36, '#D3D5DB', 1);
      R3.forEach((row, r) => [...row].forEach(ch => { const [x, y] = keyRect(ch); key(x, y, kw, kh, ch === curCh ? '#BFC2CA' : '#fff', ch === curCh ? '' : ch); }));
      const y3 = kbY + 20 + 2 * rs, rw3 = 9 * kw + 8 * gap, sw = (KW - 40 - rw3 - 2 * 16) / 2;
      key(KX + 20, y3, sw, kh, '#ABAFB9'); c.save(); c.strokeStyle = '#111'; c.lineWidth = 4; c.lineJoin = 'round'; const sx = KX + 20 + sw / 2, sy = y3 + kh / 2; c.beginPath(); c.moveTo(sx, sy - 18); c.lineTo(sx + 17, sy); c.lineTo(sx + 8, sy); c.lineTo(sx + 8, sy + 16); c.lineTo(sx - 8, sy + 16); c.lineTo(sx - 8, sy); c.lineTo(sx - 17, sy); c.closePath(); c.stroke(); c.restore();
      const bx = KX + KW - 20 - sw; key(bx, y3, sw, kh, '#ABAFB9'); c.save(); c.strokeStyle = '#111'; c.lineWidth = 4; c.lineJoin = 'round'; const qx = bx + sw / 2, qy = y3 + kh / 2; c.beginPath(); c.moveTo(qx - 22, qy); c.lineTo(qx - 10, qy - 14); c.lineTo(qx + 20, qy - 14); c.lineTo(qx + 20, qy + 14); c.lineTo(qx - 10, qy + 14); c.closePath(); c.stroke(); c.lineCap = 'round'; c.beginPath(); c.moveTo(qx - 2, qy - 6); c.lineTo(qx + 10, qy + 6); c.moveTo(qx + 10, qy - 6); c.lineTo(qx - 2, qy + 6); c.stroke(); c.restore();
      const y4 = kbY + 20 + 3 * rs, w123 = 150, wEnt = 180, wSp = KW - 40 - w123 - wEnt - 2 * gap;
      key(KX + 20, y4, w123, kh, '#ABAFB9', '123', 32); key(KX + 20 + w123 + gap, y4, wSp, kh, curCh === ' ' ? '#BFC2CA' : '#fff', 'пробел', 32); key(KX + KW - 20 - wEnt, y4, wEnt, kh, '#ABAFB9', 'ввод', 32);
      if (curCh && curCh !== ' ') { const [x, y] = keyRect(curCh), bw = kw + 40, bh2 = kh + 34, k = .85 + .15 * eo(cl((t - t0 - curI * dt) / .05)); c.save(); c.translate(x + kw / 2, y); c.scale(k, k);
        const hw = kw / 2, top = -bh2 + 4, nk = 26; c.save(); c.shadowColor = 'rgba(0,0,0,.28)'; c.shadowBlur = 16; c.shadowOffsetY = 5; c.beginPath(); c.moveTo(-bw / 2 + 18, top); c.lineTo(bw / 2 - 18, top); c.quadraticCurveTo(bw / 2, top, bw / 2, top + 18); c.lineTo(bw / 2, -nk); c.bezierCurveTo(bw / 2, -6, hw, -10, hw, 12); c.lineTo(hw, kh - 12); c.quadraticCurveTo(hw, kh, hw - 12, kh); c.lineTo(-hw + 12, kh); c.quadraticCurveTo(-hw, kh, -hw, kh - 12); c.lineTo(-hw, 12); c.bezierCurveTo(-hw, -10, -bw / 2, -6, -bw / 2, -nk); c.lineTo(-bw / 2, top + 18); c.quadraticCurveTo(-bw / 2, top, -bw / 2 + 18, top); c.closePath(); c.fillStyle = '#fff'; c.fill(); c.restore(); T(c, curCh, 0, top + (bh2 - nk) / 2 + 4, 60, '#111', 'm'); c.restore(); }
    });
  });

  A('f-ui-tabs', 'Браузер: открываются новые вкладки', UI, 4, (c, t, D) => {
    const e = env(t, D), X = 92, Y = 232, w = 840, h = 560, TB = [['Монтаж', 0, '#0A84FF', 'монтаж'], ['Идеи', .85, '#FF375F', 'идеи'], ['Музыка', 1.6, '#FF9F0A', 'музыка'], ['Шрифты', 2.35, '#BF5AF2', 'шрифты']];
    const g = TB.map(([, tm]) => tm === 0 ? 1 : Math.max(0, Math.min(1.08, spr(t - tm, 14, .75)))), act = TB.reduce((a, b, i) => t >= b[1] ? i : a, 0), sx0 = X + 120, sx1 = X + w - 80, unit = Math.min(200, (sx1 - sx0) / g.reduce((a, b) => a + b, 0));
    const ca = act === 0 ? 1 : ss((t - TB[act][1]) / .3), plusX = X + w - 44, plusY = Y + 42;
    wk(c, 512, 512, e, () => {
      card(c, X, Y, w, h, 26, '#fff', 1.1); c.save(); rr(c, X, Y, w, h, 26); c.clip(); c.fillStyle = '#E8E8ED'; c.fillRect(X, Y, w, 72);
      [0, 1, 2].forEach(i => circ(c, X + 34 + i * 28, Y + 38, 9, ['#FF5F57', '#FEBC2E', '#C7C7CC'][i]));
      let x = sx0; TB.forEach(([s, tm, col], i) => { const tw = unit * g[i]; if (tw < 2) return; const isA = i === act, ia = isA ? ca : (i === act - 1 ? 1 - ca : 0);
        c.save(); c.beginPath(); c.rect(x, Y + 10, tw, 62); c.clip();
        if (ia > 0) { c.save(); c.globalAlpha *= ia; c.beginPath(); c.roundRect(x + 2, Y + 14, tw - 4, 70, [16, 16, 0, 0]); c.fillStyle = '#fff'; c.fill(); c.restore(); }
        c.globalAlpha *= cl(g[i] * 1.5); circ(c, x + 26, Y + 44, 11, col); T(c, s[0], x + 26, Y + 44, 13, '#fff'); T(c, s, x + 46, Y + 44, 21, isA ? '#111' : '#6C6C70', 'm', 'left'); c.restore();
        if (!isA && i !== act - 1 && i < TB.length - 1 && g[i + 1] > .5) { c.fillStyle = '#C7C7CC'; c.fillRect(x + tw - 1, Y + 30, 2, 28); } x += tw; });
      const pp = Math.max(...TB.slice(1).map(b => prs(t, b[1]))); c.save(); c.translate(plusX, plusY); c.scale(1 - .15 * pp, 1 - .15 * pp); circ(c, 0, 0, 22, pp > .1 ? '#D1D1D6' : 'rgba(0,0,0,0)'); ic(c, 'plus', 0, 0, 32, '#3C3C43'); c.restore();
      c.fillStyle = '#fff'; c.fillRect(X, Y + 72, w, 70); ic(c, 'down', X + 40, Y + 107, 34, '#8E8E93', 0, Math.PI / 2); ic(c, 'down', X + 80, Y + 107, 34, '#C7C7CC', 0, -Math.PI / 2);
      rr(c, X + 120, Y + 84, w - 160, 46, 14); c.fillStyle = '#F2F2F7'; c.fill(); ic(c, 'lock', X + 148, Y + 107, 20, '#8E8E93'); T(c, 'твой-сайт.рф/' + TB[act][3], X + 168, Y + 107, 22, '#3C3C43', 'm', 'left');
      c.fillStyle = '#E5E5EA'; c.fillRect(X, Y + 142, w, 2);
      const drawPage = (i, a) => { if (a <= 0) return; c.save(); c.globalAlpha *= a; c.translate(0, (1 - a) * 16); const col = TB[i][2];
        rr(c, X + 40, Y + 176, w - 80, 190, 22); c.fillStyle = grad(c, X + 40, Y + 176, X + w - 40, Y + 366, [col, '#ffffff']); c.fill();
        rr(c, X + 40, Y + 392, 320, 26, 13); c.fillStyle = '#D1D1D6'; c.fill(); [0, 1].forEach(j => { rr(c, X + 40, Y + 440 + j * 40, w - 80 - j * 180, 18, 9); c.fillStyle = '#E5E5EA'; c.fill(); }); c.restore(); };
      if (act > 0 && ca < 1) drawPage(act - 1, 1 - ca); drawPage(act, ca); c.restore();
    });
    const [px, py] = track(t, [[.2, 1100, 1000], [.75, plusX + 6, plusY + 8], [2.6, plusX + 6, plusY + 8], [3.2, 1120, 1000]]); c.save(); c.globalAlpha *= e.a; cursor(c, px, py, Math.max(...TB.slice(1).map(b => prs(t, b[1]))), .95); c.restore();
  });

  A('f-ui-saved', '«Сохранено в Фото»: снимок улетает в плашку', UI, 3.2, (c, t, D) => {
    const o = outK(t, D), t1 = 1.05, fl = eio(cl((t - t1) / .5)), pk = spr(t - 1.2, 14, .6), pw = TW(c, 'Сохранено в Фото', 38) + 200, px0 = 512 - pw / 2, py = 700, ph = 112;
    const sx = px0 + 64, sy = py + ph / 2, ak = spr(t, 12, .55), cxp = lerp(512, sx, fl), cyp = lerp(420, sy, fl) - Math.sin(Math.PI * fl) * 60, pwp = lerp(340, 62, fl), php = lerp(430, 62, fl), bd = lerp(14, 0, fl);
    c.save(); c.globalAlpha *= 1 - o;
    wk(c, 512, sy, { k: pk, a: cl((t - 1.2) / .1) }, () => { card(c, px0, py, pw, ph, ph / 2, 'rgba(22,22,24,.9)', .8); T(c, 'Сохранено в Фото', px0 + 112, sy, 38, '#fff', 'b', 'left');
      const ck = spr(t - 1.65, 16, .45); c.save(); c.translate(px0 + pw - 54, sy); c.scale(ck, ck); circ(c, 0, 0, 24, '#0A84FF'); ic(c, 'check', 0, 0, 32, '#fff'); c.restore(); });
    c.save(); c.globalAlpha *= cl(t / .08); c.translate(cxp, cyp); const k0 = fl > 0 ? 1 : Math.max(0, ak); c.scale(k0, k0); c.rotate(lerp(-.04, 0, fl));
    card(c, -pwp / 2 - bd, -php / 2 - bd, pwp + 2 * bd, php + 2 * bd, lerp(34, 16, fl), '#fff', lerp(1, .2, fl)); photoArt(c, -pwp / 2, -php / 2, pwp, php, lerp(22, 14, fl));
    const fla = 1 - ss((t - .3) / .45); if (fla > 0 && t > .22) { c.globalAlpha *= fla; rr(c, -pwp / 2, -php / 2, pwp, php, 22); c.fillStyle = '#fff'; c.fill(); } c.restore();
    c.restore();
  });

  /* =====================================================================
     Камера и запись (20)
     ===================================================================== */
  const TC = (t, s0 = 12) => { const fr = Math.floor(t * 24), s = s0 + Math.floor(fr / 24); return '00:00:' + fmt2(s) + ':' + fmt2(fr % 24); };
  const blink = (t, per = 1, on = .62) => (t % per) / per < on;

  A('f-cam-rec', 'REC: мигающая точка и таймкод', CAM, 3, (c, t, D) => {
    const e = env(t, D), tw = TXW(c, '00:00:00:00', 42, MONO), w = 64 + 26 + 18 + TW(c, 'REC', 44) + 36 + tw + 50, X = 512 - w / 2, h = 112;
    wk(c, 512, 512, e, () => { glass(c, X, 512 - h / 2, w, h, h / 2, .6);
      const da = blink(t) ? 1 : .18; c.save(); c.globalAlpha *= da; c.shadowColor = 'rgba(255,59,48,.8)'; c.shadowBlur = 18 * da; circ(c, X + 58, 512, 18, '#FF3B30'); c.restore();
      T(c, 'REC', X + 94, 512, 44, '#fff', 'b', 'left'); c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(X + 108 + TW(c, 'REC', 44), 512 - 28, 3, 56);
      TX(c, TC(t), X + 130 + TW(c, 'REC', 44), 512, 42, '#fff', MONO, 'left'); });
  });

  A('f-cam-frame', 'Видоискатель: уголки, REC и заряд', CAM, 3.5, (c, t, D) => {
    const o = outK(t, D), k = spr(t, 10, .6), M = 96, L = 124;
    c.save(); c.globalAlpha = cl(t / .1) * (1 - o); hudSh(c); c.strokeStyle = '#fff'; c.lineWidth = 10; c.lineCap = 'round'; c.lineJoin = 'round';
    [[M, M, 1, 1], [1024 - M, M, -1, 1], [M, 1024 - M, 1, -1], [1024 - M, 1024 - M, -1, -1]].forEach(([x, y, sx, sy]) => { const xx = x - sx * (1 - k) * 60, yy = y - sy * (1 - k) * 60; c.beginPath(); c.moveTo(xx, yy + sy * L); c.lineTo(xx, yy); c.lineTo(xx + sx * L, yy); c.stroke(); });
    const ca = fadeIn(t, .35, .2); c.globalAlpha *= ca; c.lineWidth = 4; c.beginPath(); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => { c.moveTo(512 + dx * 14, 512 + dy * 14); c.lineTo(512 + dx * 42, 512 + dy * 42); }); c.stroke();
    const ga = c.globalAlpha; c.globalAlpha = ga * fadeIn(t, .45); circ(c, M + 52, M + 62, 13, blink(t) ? '#FF3B30' : 'rgba(255,59,48,.25)'); T(c, 'REC', M + 76, M + 62, 34, '#fff', 'b', 'left');
    c.globalAlpha = ga * fadeIn(t, .55); battery(c, 1024 - M - 112, M + 46, 76, 34, .72, '#fff'); T(c, '4K · 60', 1024 - M - 136, M + 62, 30, '#fff', 'b', 'right');
    c.globalAlpha = ga * fadeIn(t, .65); TX(c, TC(t, 4), M + 34, 1024 - M - 58, 32, '#fff', MONO, 'left');
    c.globalAlpha = ga * fadeIn(t, .75); T(c, 'ISO 400 · 1/50', 1024 - M - 34, 1024 - M - 58, 30, '#fff', 'b', 'right');
    c.restore();
  });

  A('f-cam-focus', 'Фокус-квадрат щёлкает', CAM, 3, (c, t, D) => {
    const o = outK(t, D), t0 = .42, cx = 512, cy = 540, sp = spr(t - t0, 13, .55), s = 270 * (1 + .6 * (1 - sp)), flick = t > .95 && t < 1.25 ? (Math.floor((t - .95) / .075) % 2 ? .3 : 1) : 1, Y = '#FFD60A';
    touch(c, cx, cy, t, t0, 46);
    c.save(); c.globalAlpha = cl((t - t0) / .08) * (1 - o); hudSh(c);
    c.save(); c.globalAlpha *= flick; c.strokeStyle = Y; c.lineWidth = 5; c.strokeRect(cx - s / 2, cy - s / 2, s, s); c.beginPath();
    [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => { c.moveTo(cx + dx * s / 2, cy + dy * s / 2); c.lineTo(cx + dx * (s / 2 - 20), cy + dy * (s / 2 - 20)); }); c.stroke(); c.restore();
    const sa = fadeIn(t, 1.3, .2); if (sa > 0) { c.save(); c.globalAlpha *= sa; const lx = cx + s / 2 + 52, sy2 = cy + lerp(50, -64, eio(cl((t - 1.4) / .8))); c.strokeStyle = Y; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(lx, cy - s / 2); c.lineTo(lx, sy2 - 32); c.moveTo(lx, sy2 + 32); c.lineTo(lx, cy + s / 2); c.stroke(); circ(c, lx, sy2, 11, Y); c.lineWidth = 4; c.beginPath();
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; c.moveTo(lx + Math.cos(a) * 17, sy2 + Math.sin(a) * 17); c.lineTo(lx + Math.cos(a) * 24, sy2 + Math.sin(a) * 24); } c.stroke(); c.restore(); }
    nosh(c); const lk = spr(t - 1.95, 15, .55); if (lk > 0) { const lw = TW(c, 'БЛОКИРОВКА АЭ/АФ', 28) + 44; c.save(); c.translate(cx, cy - s / 2 - 74); c.scale(lk, lk); rr(c, -lw / 2, -27, lw, 54, 12); c.fillStyle = Y; c.fill(); T(c, 'БЛОКИРОВКА АЭ/АФ', 0, 0, 28, '#111'); c.restore(); }
    c.restore();
  });

  A('f-cam-params', 'Параметры камеры: ISO, выдержка, диафрагма', CAM, 3.5, (c, t, D) => {
    const e = env(t, D), w = 800, h = 170, X = 512 - w / 2, Y = 512 - h / 2, cw = w / 4;
    const P = [['ISO', [['100', 0], ['400', .9], ['800', 2.1]]], ['ВЫДЕРЖКА', [['1/50', 0], ['1/100', 1.5]]], ['ДИАФРАГМА', [['f/2,8', 0], ['f/1,8', 1.2]]], ['БАЛАНС', [['5600K', 0], ['4300K', 2.5]]]];
    wk(c, 512, 512, e, () => { glass(c, X, Y, w, h, 44, .72);
      P.forEach(([lbl, vs], i) => { const x = X + cw * i + cw / 2; if (i) { c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(X + cw * i - 1, Y + 34, 2, h - 68); }
        T(c, lbl, x, Y + 52, 22, 'rgba(255,255,255,.6)', 'b'); let j = 0; for (let q = 1; q < vs.length; q++) if (t >= vs[q][1] - .0001) j = q;
        const hot = j > 0 ? 1 - ss((t - vs[j][1] - .6) / .4) : 0, col = hot > .5 ? '#FFD60A' : '#fff';
        if (j > 0 && t < vs[j][1] + .4) rollTxt(c, vs[j - 1][0], vs[j][0], vs[j][1], t, x, Y + 112, 46, col, MONO, 'center', cw - 20); else TX(c, vs[j][0], x, Y + 112, 46, col, MONO);
        if (hot > 0) { c.save(); c.globalAlpha *= hot; c.fillStyle = '#FFD60A'; rr(c, x - 24, Y + h - 22, 48, 5, 3); c.fill(); c.restore(); } }); });
  });

  A('f-cam-live', '«LIVE»: зрители растут, летят сердца', CAM, 4, (c, t, D) => {
    const e = env(t, D), v = 1204 + Math.floor(176 * eo(cl((t - .5) / 3))), bw = 210, bh = 96, pw = 64 + 26 + TW(c, '8 888', 40) + 42, gap = 18, x0 = 512 - (bw + gap + pw) / 2, y = 690;
    for (let i = 0; i < 14; i++) { const ts = .55 + i * .2, k = (t - ts) / 1.7; if (k <= 0 || k >= 1) continue; const hx = x0 + bw + gap + pw - 70 + Math.sin(k * 4 + i * 1.7) * 46 * k + (rnd(i) - .5) * 120, hy = y - 70 - 430 * k, sc = Math.max(0, spr(t - ts, 14, .5)) * (.7 + rnd(i + 7) * .5);
      c.save(); c.globalAlpha *= (1 - ss((k - .55) / .45)) * (1 - outK(t, D)); c.translate(hx, hy); c.rotate(Math.sin(k * 6 + i) * .25); c.scale(sc, sc); c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 10; c.shadowOffsetY = 4; ic(c, 'heart', 0, 0, 72, ['#FF375F', '#FF9F0A', '#FF2D96', '#BF5AF2', '#FF453A'][i % 5]); c.restore(); }
    wk(c, 512, y, e, () => { const pulse = 1 + .04 * Math.max(0, Math.sin(t * 6));
      c.save(); c.translate(x0 + bw / 2, y); c.scale(pulse, pulse); c.save(); sh(c, .7); rr(c, -bw / 2, -bh / 2, bw, bh, 22); c.fillStyle = grad(c, -bw / 2, 0, bw / 2, 0, ['#FF2D55', '#FF3B30']); c.fill(); c.restore();
      circ(c, -bw / 2 + 40, 0, 11, blink(t, .8, .6) ? '#fff' : 'rgba(255,255,255,.35)'); T(c, 'LIVE', 22, 0, 46, '#fff', 'k'); c.restore();
      const px = x0 + bw + gap; glass(c, px, y - bh / 2, pw, bh, 22, .62); ic(c, 'eye', px + 46, y, 40, '#fff'); T(c, nb(v), px + 82, y, 40, '#fff', 'b', 'left'); });
  });

  A('f-cam-grid', 'Сетка 3×3 рисуется', CAM, 3, (c, t, D) => {
    const o = outK(t, D), X0 = 112, S = 800, L = [[1, 0, 0], [1, 1, .1], [0, 0, .2], [0, 1, .3]];
    c.save(); c.globalAlpha = 1 - o; hudSh(c); c.strokeStyle = 'rgba(255,255,255,.92)'; c.lineWidth = 4; c.lineCap = 'round';
    L.forEach(([v, j, d]) => { const p = eio(cl((t - .15 - d) / .6)), pos = X0 + S * (j + 1) / 3, half = S / 2 * p; if (p <= 0) return; c.beginPath(); if (v) { c.moveTo(pos, 512 - half); c.lineTo(pos, 512 + half); } else { c.moveTo(512 - half, pos); c.lineTo(512 + half, pos); } c.stroke(); });
    const fa = fadeIn(t, .7, .3); if (fa > 0) { c.save(); c.globalAlpha *= fa * .45; c.lineWidth = 3; rr(c, X0, X0, S, S, 30); c.stroke(); c.restore(); }
    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([a, b], i) => { const tm = 1.05 + i * .1, x = X0 + S * (a + 1) / 3, y = X0 + S * (b + 1) / 3, k = spr(t - tm, 15, .45); if (k <= 0) return;
      circ(c, x, y, 10 * k, '#fff'); ripple(c, x, y, t, tm, '255,255,255', 46, .7); }); c.restore();
  });

  A('f-cam-level', 'Уровень горизонта выравнивается', CAM, 3, (c, t, D) => {
    const o = outK(t, D), t0 = .35, ang = t < t0 ? -.15 : -.15 * Math.exp(-(t - t0) * 2.1) * Math.cos((t - t0) * 5.2), al = ss((t - 1.75) / .15), Y = '#FFD60A', col = al > .5 ? Y : '#fff', a0 = fadeIn(t, 0, .2);
    c.save(); c.globalAlpha = a0 * (1 - o); hudSh(c); c.lineCap = 'round'; c.lineWidth = 6; c.strokeStyle = col;
    const gap = al * 34; c.beginPath(); c.moveTo(232, 512); c.lineTo(372 + gap, 512); c.moveTo(652 - gap, 512); c.lineTo(792, 512); c.stroke();
    c.save(); c.translate(512, 512); c.rotate(al > .99 ? 0 : ang); c.beginPath(); c.moveTo(-128, 0); c.lineTo(128, 0); c.stroke(); c.restore();
    const deg = Math.round(ang * 180 / Math.PI), sk = al > 0 ? 1 + .25 * Math.sin(Math.PI * cl((t - 1.75) / .3)) : 1; c.save(); c.translate(512, 600); c.scale(sk, sk); T(c, (al > .5 ? 0 : deg) + '°', 0, 0, 46, col, 'b'); c.restore();
    c.restore();
  });

  A('f-cam-shutter', 'Затвор: щелчок и вспышка на снимке', CAM, 2.8, (c, t, D) => {
    const e = env(t, D), tc = 1.0, bx = 624, ty = 512, tx = 336, pr = prs(t, tc), tk = spr(t - tc - .05, 13, .5);
    wk(c, 512, 512, e, () => {
      c.save(); sh(c, .7); c.lineWidth = 12; c.strokeStyle = '#fff'; circ(c, bx, ty, 118); c.stroke(); circ(c, bx, ty, 98 * (1 - .14 * pr), '#fff'); c.restore();
      ripple(c, bx, ty, t, tc, '255,255,255', 170, .7); burst(c, bx, ty, t, tc + .02, { n: 10, R: 190, s: 9, ring: false, lines: true, cols: ['#fff'] });
      if (tk > 0) { c.save(); c.translate(tx, ty); c.scale(tk, tk); c.rotate(-.05 * (1 - cl(tk))); card(c, -80, -80, 160, 160, 30, '#fff', .8); photoArt(c, -72, -72, 144, 144, 24);
        const fla = 1 - ss((t - tc - .1) / .5); if (fla > 0) { c.globalAlpha *= fla; rr(c, -72, -72, 144, 144, 24); c.fillStyle = '#fff'; c.fill(); } c.restore(); }
    });
  });

  A('f-cam-iris', 'Диафрагма закрывается и открывается', CAM, 2.8, (c, t, D) => {
    const e = env(t, D), R = 250, cx = 512, cy = 470, N = 7, cls = eio(cl((t - .5) / .45)), opn = Math.max(0, spr(t - 1.25, 11, .5)), ap = Math.min(1.04, 1 - .93 * cls + .93 * opn), rO = R * .88 * ap, rot = (1 - ap) * 1.2 + .3;
    const V = []; for (let i = 0; i < N; i++) { const a = rot + i / N * TAU; V.push([cx + Math.cos(a) * rO, cy + Math.sin(a) * rO]); }
    const dir = i => { const a = V[i % N], b = V[(i + 1) % N], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
    wk(c, 512, 512, e, () => {
      c.save(); sh(c, 1); c.beginPath(); c.arc(cx, cy, R + 40, 0, TAU); c.arc(cx, cy, R - 2, 0, TAU, true); c.fillStyle = grad(c, cx - R, cy - R, cx + R, cy + R, ['#5A5A60', '#1E1E21', '#3A3A3E']); c.fill(); c.restore();
      c.save(); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.25)'; circ(c, cx, cy, R + 38); c.stroke(); c.restore();
      c.save(); circ(c, cx, cy, R); c.clip(); const B = 900;
      for (let i = 0; i < N; i++) { const p1 = V[(i + 1) % N], p2 = V[(i + 2) % N], d1 = dir(i), d2 = dir(i + 1);
        c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p1[0] + d1[0] * B, p1[1] + d1[1] * B); c.lineTo(p2[0] + d2[0] * B, p2[1] + d2[1] * B); c.lineTo(p2[0], p2[1]); c.closePath();
        c.fillStyle = grad(c, p1[0], p1[1], p1[0] + d1[0] * 300, p1[1] + d1[1] * 300, i % 2 ? ['#47474C', '#1C1C1F'] : ['#3C3C41', '#161618']); c.fill(); c.lineWidth = 2.5; c.strokeStyle = 'rgba(255,255,255,.14)'; c.stroke(); }
      c.restore();
      const fn = lerp(16, 1.8, cl((ap - .07) / .93)), s = 'f/' + (fn < 9.95 ? fn.toFixed(1).replace('.', ',') : Math.round(fn)); c.save(); hudSh(c); T(c, s, cx, cy + R + 104, 54, '#fff', 'b'); c.restore();
    });
  });

  A('f-cam-polaroid', 'Полароид проявляется (окно прозрачное)', CAM, 4, (c, t, D) => {
    const o = outK(t, D), k = spr(t, 9, .62), w = 500, h = 610, x = 512 - w / 2, y = 512 - h / 2 - 8, wx = x + 30, wy = y + 30, ws = w - 60, dev = ss((t - .8) / 2.0);
    c.save(); c.globalAlpha = cl(t / .12) * (1 - o); c.translate(512, 512 + (1 - k) * -220); c.rotate(-.05 + (1 - k) * .2 + Math.sin(t * 1.6) * .01); c.translate(-512, -512);
    const a1 = 1 - dev; if (a1 > .002) { const r0 = lerp(20, 150, cl(dev * 1.4)), g0 = lerp(18, 110, cl(dev * 1.4)), b0 = lerp(26, 80, cl(dev * 1.4)); c.fillStyle = `rgba(${r0 | 0},${g0 | 0},${b0 | 0},${a1})`; c.fillRect(wx, wy, ws, ws); }
    c.save(); sh(c, 1); c.beginPath(); c.roundRect(x, y, w, h, 10); c.rect(wx, wy, ws, ws); c.fillStyle = '#FAF9F5'; c.fill('evenodd'); c.restore();
    c.save(); c.strokeStyle = 'rgba(0,0,0,.08)'; c.lineWidth = 2; c.strokeRect(wx, wy, ws, ws); c.restore();
    const cp = eio(cl((t - 2.0) / .9)), cw = TXW(c, 'лучший день', 62, 'Caveat-Bold'); if (cp > 0) { c.save(); c.beginPath(); c.rect(512 - cw / 2 - 10, y + h - 110, (cw + 20) * cp, 100); c.clip(); TX(c, 'лучший день', 512, y + h - 64, 62, '#2A2A2E', 'Caveat-Bold'); c.restore(); }
    c.restore();
  });

  A('f-cam-clapper', 'Хлопушка «Сцена 1, дубль 3»', CAM, 3, (c, t, D) => {
    const e = env(t, D), w = 520, X = 512 - w / 2, by = 460, bh = 330, barH = 70, tcl = 1.2, opn = .42 * eo(cl((t - .25) / .45)), close = ein(cl((t - (tcl - .13)) / .13)), reb = t > tcl ? .07 * Math.exp(-(t - tcl) * 9) * Math.abs(Math.sin((t - tcl) * 22)) : 0;
    const ang = t < tcl ? opn * (1 - close) : reb, shk = t > tcl ? Math.sin((t - tcl) * 60) * 7 * Math.exp(-(t - tcl) * 10) : 0;
    const stripes = (x, y, ww, hh, dir) => { c.save(); rr(c, x, y, ww, hh, 10); c.fillStyle = '#1C1C1E'; c.fill(); c.clip(); c.fillStyle = '#F4F4F2'; for (let i = -2; i < ww / 64 + 2; i++) { const sx = x + i * 64; c.beginPath(); c.moveTo(sx, y + hh); c.lineTo(sx + 32, y + hh); c.lineTo(sx + 32 + dir * 40, y); c.lineTo(sx + dir * 40, y); c.closePath(); c.fill(); } c.restore(); };
    wk(c, 512, by + bh / 2, e, () => { c.save(); c.translate(shk, Math.abs(shk) * .5);
      c.save(); sh(c, 1); rr(c, X, by, w, bh, 22); c.fillStyle = '#1C1C1E'; c.fill(); c.restore();
      c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 3; c.beginPath(); c.moveTo(X + 24, by + 112); c.lineTo(X + w - 24, by + 112); c.moveTo(X + 24, by + 222); c.lineTo(X + w - 24, by + 222); c.moveTo(512, by + 112); c.lineTo(512, by + 222); c.stroke();
      const lb = (s, x, y) => T(c, s, x, y, 20, 'rgba(255,255,255,.55)', 'b', 'left'), hv = (s, x, y, px = 64) => TX(c, s, x, y, px, '#fff', 'Caveat-Bold', 'left');
      lb('ПРОЕКТ', X + 30, by + 30); hv('Мой рилс', X + 30, by + 74, 56); lb('СЦЕНА', X + 30, by + 138); hv('1', X + 40, by + 182, 70); lb('ДУБЛЬ', 512 + 24, by + 138); hv('3', 512 + 34, by + 182, 70);
      lb('ДАТА', X + 30, by + 248); hv('30.10', X + 30, by + 292, 54); lb('КАМЕРА', 512 + 24, by + 248); hv('А', 512 + 34, by + 292, 54);
      stripes(X, by - barH - 2, w, barH, 1);
      c.save(); c.translate(X + 8, by - barH - 4); c.rotate(-ang); stripes(-8, -barH, w, barH, -1); c.restore();
      circ(c, X + 30, by - barH - 4, 12, '#8E8E93'); c.restore(); });
    burst(c, X + w + 8, by - barH, t, tcl, { n: 7, R: 120, s: 10, ring: false, lines: true, rot: -1.9, cols: ['#FFD60A'] });
  });

  A('f-cam-sound', '«Включи звук»: значок оживает', CAM, 3, (c, t, D) => {
    const e = env(t, D), tc = 1.2, on = t >= tc, w = TW(c, 'Включи звук', 62) + 230, x = 512 - w / 2, ix = x + 96, pulse = on ? 1 + .05 * Math.sin(Math.PI * cl((t - tc) / .3)) : 1;
    wk(c, 512, 512, { k: e.k * pulse, a: e.a }, () => { card(c, x, 432, w, 160, 80, '#fff', 1);
      const ik = 1 - .1 * prs(t, tc); c.save(); c.translate(ix, 512); c.scale(ik, ik); circ(c, 0, 0, 60, '#111'); icSpk(c, -14, 0, 76, '#fff');
      const xk = 1 - ss((t - tc) / .18); if (xk > 0) { c.save(); c.globalAlpha *= xk; c.strokeStyle = '#FF453A'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(14, -13); c.lineTo(36, 13); c.moveTo(36, -13); c.lineTo(14, 13); c.stroke(); c.restore(); }
      if (on) { c.strokeStyle = '#fff'; c.lineWidth = 6; c.lineCap = 'round'; [[22, 0], [36, .25]].forEach(([r, d]) => { const a = ss((t - tc - .1 - d) / .2) * (.55 + .45 * Math.max(0, Math.sin((t - tc) * 7 - d * 8))); if (a <= 0) return; c.save(); c.globalAlpha *= a; c.beginPath(); c.arc(-8, 0, r, -.75, .75); c.stroke(); c.restore(); }); }
      c.restore(); T(c, 'Включи звук', x + 182, 512, 62, '#111', 'b', 'left'); touch(c, ix + 12, 526, t, tc, 46); });
  });

  A('f-cam-meter', 'Уровень звука: L и R прыгают', CAM, 3, (c, t, D) => {
    const e = env(t, D), w = 780, h = 250, X = 512 - w / 2, Y = 512 - h / 2, NS = 28, sx0 = X + 96, sx1 = X + w - 46, gp = 6, sw = (sx1 - sx0 - (NS - 1) * gp) / NS;
    const lv = (tt, ch) => cl(.55 + .22 * Math.sin(tt * 7.3 + ch) + .15 * Math.sin(tt * 13.1 + ch * 2.1) + .12 * Math.sin(tt * 23.7 + ch * .7)) * ss((tt - .3) / .3);
    wk(c, 512, 512, e, () => { glass(c, X, Y, w, h, 44, .74);
      [0, 1].forEach(ch => { const y = Y + 70 + ch * 74, v = lv(t, ch); let pk = 0; for (let k = 0; k < 30; k++) pk = Math.max(pk, lv(t - k * .025, ch) - k * .006);
        T(c, ch ? 'R' : 'L', X + 52, y, 32, '#fff', 'b');
        for (let i = 0; i < NS; i++) { const r = (i + .5) / NS, col = r > .86 ? '#FF453A' : r > .68 ? '#FFD60A' : '#64D2FF', lit = r <= v, isPk = Math.abs(r - pk) < .5 / NS;
          rr(c, sx0 + i * (sw + gp), y - 21, sw, 42, 5); c.fillStyle = lit || isPk ? col : 'rgba(255,255,255,.12)'; c.fill(); } });
      [['-40', 0], ['-20', .4], ['-12', .58], ['-6', .74], ['-3', .86], ['0', 1]].forEach(([s, r]) => T(c, s, lerp(sx0 + sw / 2, sx1 - sw / 2, r), Y + h - 40, 22, 'rgba(255,255,255,.55)', 'm')); });
  });

  A('f-cam-vhs', 'VHS: «PLAY ▶» и дата', CAM, 3.5, (c, t, D) => {
    const o = outK(t, D), fl = t < .3 ? (Math.floor(t * 30) % 3 ? 1 : .2) : 1, F = 'RubikMonoOne', jit = (q => q === 3 || q === 11 ? 12 : q === 4 ? -8 : 0)(Math.floor(t * 12) % 19);
    const vt = (s, x, y, px, al = 'left') => { c.save(); c.globalAlpha *= .75; TX(c, s, x - 4, y, px, '#FF2D55', F, al); TX(c, s, x + 4, y, px, '#2D7CFF', F, al); c.restore(); c.save(); c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 10; TX(c, s, x, y, px, '#fff', F, al); c.restore(); };
    c.save(); c.globalAlpha = fl * (1 - o); c.translate(jit, 0);
    vt('PLAY', 96, 128, 58); const pw = TXW(c, 'PLAY', 58, F), tx = 96 + pw + 30; [['#FF2D55', -4], ['#2D7CFF', 4], ['#fff', 0]].forEach(([col, dx]) => { c.save(); if (dx) c.globalAlpha *= .75; c.fillStyle = col; c.beginPath(); c.moveTo(tx + dx, 128 - 26); c.lineTo(tx + 44 + dx, 128); c.lineTo(tx + dx, 128 + 26); c.closePath(); c.fill(); c.restore(); });
    const s = 7 + Math.floor(t); vt('21:47:' + fmt2(s), 96, 850, 40); vt('30 ОКТ 1998', 96, 912, 40);
    c.restore();
  });

  A('f-cam-film', 'Плёнка бежит, номера кадров', CAM, 3, (c, t, D) => {
    const o = outK(t, D), a0 = fadeIn(t, 0, .25), y0 = 300, H = 320, pitch = 300, spd = 220, off = t * spd, fw = 262;
    c.save(); c.globalAlpha = a0 * (1 - o);
    c.save(); c.beginPath(); c.rect(-20, y0, 1064, H); const first = Math.floor((off - 200) / pitch);
    for (let i = first; i < first + 6; i++) { const fx = i * pitch - off + 512 - fw / 2; c.roundRect(fx, y0 + 74, fw, 172, 10); }
    for (let x = -((off) % 50) - 50; x < 1080; x += 50) { c.roundRect(x, y0 + 36, 24, 30, 6); c.roundRect(x, y0 + 254, 24, 30, 6); }
    c.fillStyle = '#1B1813'; sh(c, .8); c.fill('evenodd'); nosh(c);
    for (let i = first; i < first + 6; i++) { const fx = i * pitch - off + 512; TX(c, String(100 + i), fx - 60, y0 + 18, 20, '#FF9F0A', MONO); TX(c, (100 + i) + 'A', fx + 90, y0 + 18, 20, '#FF9F0A', MONO); TX(c, '▸', fx - 140, y0 + H - 16, 18, '#FF9F0A', MONO); }
    c.restore();
    c.save(); c.globalCompositeOperation = 'destination-out'; const gL = c.createLinearGradient(40, 0, 260, 0); gL.addColorStop(0, 'rgba(0,0,0,1)'); gL.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gL; c.fillRect(-20, y0 - 10, 280, H + 20);
    const gR = c.createLinearGradient(764, 0, 984, 0); gR.addColorStop(0, 'rgba(0,0,0,0)'); gR.addColorStop(1, 'rgba(0,0,0,1)'); c.fillStyle = gR; c.fillRect(764, y0 - 10, 280, H + 20); c.restore();
    const fr = 100 + Math.floor(t * 24), lbl = 'КАДР ' + String(fr).padStart(4, '0') + ' · 24 к/с', lw = TXW(c, lbl, 40, MONO) + 80, k = spr(t - .3, 14, .6);
    c.save(); c.translate(512, 720); c.scale(k, k); glass(c, -lw / 2, -46, lw, 92, 46, .7); TX(c, lbl, 0, 0, 40, '#fff', MONO); c.restore();
    c.restore();
  });

  A('f-cam-battery', 'Заряд камеры садится', CAM, 3.5, (c, t, D) => {
    const e = env(t, D), lv = t < .6 ? .82 : t < 1.1 ? lerp(.82, .55, eo(cl((t - .6) / .25))) : t < 1.6 ? lerp(.55, .3, eo(cl((t - 1.1) / .25))) : lerp(.3, .06, eo(cl((t - 1.6) / .3))), low = lv < .12, bl = !low || blink(t, .5, .55);
    const col = lv < .12 ? '#FF3B30' : lv < .33 ? '#FFD60A' : '#fff', pc = Math.round(lv * 100);
    wk(c, 512, 430, e, () => { c.save(); hudSh(c); battery(c, 512 - 210 - 16, 330, 420, 190, bl ? lv : 0, '#fff', col); c.restore();
      c.save(); hudSh(c); T(c, pc + '%', 512, 600, 84, low ? (bl ? '#FF453A' : 'rgba(255,69,58,.4)') : '#fff', 'k'); c.restore(); });
    const pk = spr(t - 2.0, 14, .55), o = outK(t, D), pw = TW(c, 'Батарея разряжена', 38) + 120, shk = t > 2.0 ? Math.sin((t - 2.0) * 40) * 8 * Math.exp(-(t - 2.0) * 5) : 0;
    wk(c, 512, 740, { k: pk * (1 - .3 * o), a: cl((t - 2.0) / .1) * (1 - o) }, () => { c.save(); c.translate(shk, 0); card(c, 512 - pw / 2, 690, pw, 100, 50, '#fff', .9); circ(c, 512 - pw / 2 + 52, 740, 13, '#FF3B30'); T(c, 'Батарея разряжена', 512 - pw / 2 + 82, 740, 38, '#111', 'b', 'left'); c.restore(); });
  });

  A('f-cam-slide', '«Слайд 1/5»: точки карусели', CAM, 4, (c, t, D) => {
    const e = env(t, D), ST = [1.0, 1.9, 2.8], idx = ST.filter(s => t >= s).length, w = 330, h = 104, Y = 430;
    let pos = 0; ST.forEach(s => pos += Math.max(0, spr(t - s, 13, .7)));
    wk(c, 512, 512, e, () => { glass(c, 512 - w / 2, Y - h / 2, w, h, h / 2, .66);
      T(c, 'Слайд', 512 - 40, Y, 42, '#fff', 'm', 'right'); const last = ST[idx - 1]; if (idx > 0 && t < last + .4) rollTxt(c, String(idx), String(idx + 1), last, t, 512 - 6, Y, 46, '#fff', 'Inter-Bold', 'center', 50); else TX(c, String(idx + 1), 512 - 6, Y, 46, '#fff', 'Inter-Bold');
      T(c, '/ 5', 512 + 20, Y, 42, 'rgba(255,255,255,.65)', 'm', 'left');
      const dy = 560, sp = 46, x0 = 512 - 2 * sp; c.save(); hudSh(c); for (let i = 0; i < 5; i++) circ(c, x0 + i * sp, dy, 10, 'rgba(255,255,255,.55)'); c.restore();
      const vel = ST.reduce((a, s) => a + Math.max(0, Math.sin(Math.PI * cl((t - s) / .35))), 0), ax = x0 + pos * sp, aw = 20 + 26 * vel; rr(c, ax - aw / 2, dy - 10, aw, 20, 10); c.fillStyle = '#fff'; c.fill(); });
  });

  A('f-cam-zoom', 'Зум камеры: 1× → 0,5× → 3×', CAM, 3.5, (c, t, D) => {
    const e = env(t, D), SW = [[1, 0], [0, 1.1], [2, 2.2]], cur = SW.reduce((a, s) => t >= s[1] ? s[0] : a, 1), xs = [512 - 128, 512, 512 + 128], Y = 600, IN = ['.5', '1', '3'], AC = ['0,5×', '1×', '3×'];
    const act = i => { let a = i === 1 ? 1 : 0; SW.slice(1).forEach(([j, s]) => { const f = ss((t - s) / .2); a = i === j ? lerp(a, 1, f) : lerp(a, 0, f); }); return a; };
    wk(c, 512, Y, e, () => { glass(c, 512 - 214, Y - 62, 428, 124, 62, .55);
      xs.forEach((x, i) => { const a = act(i), r = lerp(34, 50, a) * (1 - .1 * prs(t, SW[i === 0 ? 1 : i === 2 ? 2 : 0][1])); circ(c, x, Y, r, 'rgba(10,10,12,.62)');
        c.save(); c.globalAlpha *= 1 - a; T(c, IN[i], x, Y, 28, '#fff', 'b'); c.restore(); c.save(); c.globalAlpha *= a; T(c, AC[i], x, Y, 30, '#FFD60A', 'b'); c.restore(); });
      SW.slice(1).forEach(([j, s]) => { const k = (t - s); if (k < 0 || k > .9) return; const a = cl(k / .1) * (1 - ss((k - .6) / .3)), kk = spr(k, 14, .5); c.save(); c.globalAlpha *= a; c.translate(512, Y - 190); c.scale(kk, kk); hudSh(c); T(c, AC[j], 0, 0, 120, '#fff', 'k'); c.restore(); }); });
    touch(c, xs[0] + 6, Y + 10, t, 1.1, 40); touch(c, xs[2] + 6, Y + 10, t, 2.2, 40);
    void cur;
  });

  A('f-cam-modes', 'Режимы камеры: Фото → Видео, запись', CAM, 3.5, (c, t, D) => {
    const e = env(t, D), w = 780, h = 330, X = 512 - w / 2, Y = 392, M = ['ЗАМЕДЛЕННО', 'ВИДЕО', 'ФОТО', 'ПОРТРЕТ', 'ПАНОРАМА'], ts = 1.0, tr = 2.0, sw = spr(t - ts, 12, .75), px = 28, gp = 54;
    c.font = `${px}px "Inter-Bold"`; const ws = M.map(s => c.measureText(s).width), cxs = []; let acc = 0; ws.forEach((ww, i) => { cxs.push(acc + ww / 2); acc += ww + gp; });
    const actF = lerp(2, 1, sw), shift = 512 - lerp(cxs[2], cxs[1], sw), red = ss((t - ts) / .3), rec = ss((t - tr) / .25), pr = prs(t, tr), bx = 512, by = Y + 218;
    wk(c, 512, 512, e, () => { glass(c, X, Y, w, h, 64, .7); c.save(); rr(c, X, Y, w, h, 64); c.clip();
      M.forEach((s, i) => { const x = cxs[i] + shift, d = Math.abs(i - actF), a = Math.max(0, 1 - d * .35) * (1 - ss((Math.abs(x - 512) - 270) / 90)); if (a <= 0) return; c.save(); c.globalAlpha *= a; T(c, s, x, Y + 70, px, d < .5 ? '#FFD60A' : '#fff', 'b'); c.restore(); });
      c.restore();
      c.lineWidth = 9; c.strokeStyle = '#fff'; circ(c, bx, by, 80); c.stroke();
      const sz = lerp(132, 62, rec) * (1 - .08 * pr), rd = lerp(66, 14, rec); rr(c, bx - sz / 2, by - sz / 2, sz, sz, rd); c.fillStyle = red > .5 ? '#FF3B30' : '#fff'; c.fill(); if (red > 0 && red < 1) { c.save(); c.globalAlpha *= red; c.fillStyle = '#FF3B30'; c.fill(); c.restore(); } });
    const tk = spr(t - tr - .1, 14, .6), o = outK(t, D), tw = TXW(c, '00:00:00', 38, MONO) + 70;
    wk(c, 512, Y - 70, { k: tk * (1 - .3 * o), a: cl((t - tr - .1) / .1) * (1 - o) }, () => { rr(c, 512 - tw / 2, Y - 70 - 34, tw, 68, 18); c.fillStyle = '#FF3B30'; c.fill(); TX(c, '00:00:' + fmt2(Math.floor(Math.max(0, t - tr - .1) * 1.6)), 512, Y - 70, 38, '#fff', MONO); });
    touch(c, bx + 8, by + 10, t, tr, 46);
    if (t > .6 && t < 1.25) { const k = cl((t - .6) / .65), x = lerp(640, 420, eio(k)); c.save(); c.globalAlpha *= Math.sin(Math.PI * k) * e.a; c.save(); sh(c, .5); circ(c, x, Y + 70, 38, 'rgba(255,255,255,.55)'); c.restore(); c.restore(); }
  });

  A('f-cam-voice', 'Запись голоса: микрофон и волна', CAM, 3.5, (c, t, D) => {
    const e = env(t, D), w = 800, h = 220, X = 512 - w / 2, Y = 512 - h / 2, mx = X + 112, xl = X + 218, xr = X + w - 196, spd = 75, sp = 15;
    wk(c, 512, 512, e, () => { glass(c, X, Y, w, h, 60, .74);
      for (let i = 0; i < 2; i++) { const p = ((t * .9 + i * .5) % 1); c.save(); c.globalAlpha *= (1 - p) * .5; c.lineWidth = 4; c.strokeStyle = '#FF453A'; circ(c, mx, 512, 66 + p * 40); c.stroke(); c.restore(); }
      c.save(); c.shadowColor = 'rgba(255,59,48,.6)'; c.shadowBlur = 24; circ(c, mx, 512, 64, '#FF3B30'); c.restore(); icMic(c, mx, 514, 78, '#fff');
      circ(c, xl + 8, Y + 50, 9, blink(t) ? '#FF3B30' : 'rgba(255,59,48,.3)'); T(c, 'Идёт запись', xl + 28, Y + 50, 26, 'rgba(255,255,255,.7)', 'm', 'left');
      c.save(); c.beginPath(); c.rect(xl - 4, Y + 70, xr - xl + 8, 120); c.clip(); const nMax = Math.floor((t - .2) * spd / sp);
      for (let j = Math.max(0, nMax - 40); j <= nMax; j++) { const x = xr - ((t - .2) * spd - j * sp); if (x < xl - 10) continue; const hh = 8 + 74 * Math.abs(Math.sin(j * .9)) * (.3 + .7 * rnd(j)), a = cl((x - xl) / 60);
        c.save(); c.globalAlpha *= a; rr(c, x - 4, Y + 132 - hh / 2, 8, hh, 4); c.fillStyle = '#fff'; c.fill(); c.restore(); } c.restore();
      TX(c, '0:' + fmt2(Math.floor(Math.max(0, t - .2))), X + w - 44, 512, 46, '#fff', MONO, 'right'); });
  });
})(window);

/* ---- styles7c.js ---- */
/* Футажи: новые категории (часть c) — рисуют инструментами window.KKFOOT из styles6.js
   «Счётчики и таймеры» (+14, f-cnt-*) и «Продажи и акции» (20, f-sale-*). */
(function (G) {
  const F = G.KKFOOT; if (!F) return;
  const { A, cl, eo, eio, ein, lerp, ss, TAU, spr, env, wk, prs, track, rr, T, TW, sh, nosh, card, circ, grad, nb, ic, avatar, cursor, ripple, touch, burst, confetti, wrap, morphBtn, odo } = F;
  const GC = 'Счётчики и таймеры', GS = 'Продажи и акции';
  const PI = Math.PI;

  /* ---------- свои инструменты ---------- */
  // текст любым шрифтом из списка (ls — межбуквенный интервал, px)
  function TF(c, s, x, y, px, col, font = 'Inter-Bold', al = 'center', ls = 0) { c.font = `${px}px "${font}"`; c.fillStyle = col; c.textAlign = al; c.textBaseline = 'middle'; if (ls) c.letterSpacing = ls + 'px'; c.fillText(s, x, y + px * .04); if (ls) c.letterSpacing = '0px'; }
  function TFW(c, s, px, font = 'Inter-Bold', ls = 0) { c.font = `${px}px "${font}"`; if (ls) c.letterSpacing = ls + 'px'; const w = c.measureText(s).width; if (ls) c.letterSpacing = '0px'; return w; }
  const pop = (t, t0, f = 15, z = .5) => ({ k: Math.max(0, spr(t - t0, f, z)), a: cl((t - t0) / .08) });
  const rnd = i => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
  const hx = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const lc = (a, b, k) => { const A1 = hx(a), B1 = hx(b); return `rgb(${A1.map((v, i) => Math.round(lerp(v, B1[i], cl(k)))).join(',')})`; };
  const plural = (n, a, b, m) => { const d = n % 10, h = n % 100; return d === 1 && h !== 11 ? a : d >= 2 && d <= 4 && (h < 12 || h > 14) ? b : m; };
  // свои значки 24×24 (Material)
  const IP = {
    cart: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0020 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
    fire: 'M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z',
    bolt: 'M7 2v11h3v9l7-12h-4l4-8z',
    copy: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
    trend: 'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z',
    up: 'M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z',
    gift: 'M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z'
  };
  const PP = {}, pth = n => PP[n] || (PP[n] = new Path2D(IP[n]));
  function icp(c, n, x, y, s, col, rot) { c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.translate(-s / 2, -s / 2); c.scale(s / 24, s / 24); c.fillStyle = col; c.fill(pth(n)); c.restore(); }
  // блик, пробегающий по уже обрезанной (clip) области
  function shine(c, x, y, w, h, t, sp = .8, per = 1.7, a = .45) { const sx = x - 200 + ((t * sp) % per) / per * (w + 400), g = c.createLinearGradient(sx - 90, 0, sx + 90, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x, y, w, h); }
  // смена значения «барабаном»: старое уезжает вниз, новое приходит сверху (клип делает вызывающий)
  function roll(c, a, b, k, x, y, px, col, font, al = 'center') { if (k < 1) { c.save(); c.globalAlpha *= 1 - k; TF(c, a, x, y + k * px * .9, px, col, font, al); c.restore(); } if (k > 0) { c.save(); c.globalAlpha *= k; TF(c, b, x, y - (1 - k) * px * .9, px, col, font, al); c.restore(); } }
  // какое значение показывать по ключам смены: [prev, cur, k]
  function stepVal(t, ticks, seq, d = .32) { let i = 0; while (i < ticks.length && t >= ticks[i]) i++; if (!i) return [seq[0], seq[0], 1]; return [seq[i - 1], seq[i], ss((t - ticks[i - 1]) / d)]; }
  // 4-лучевая искра
  function star4(c, x, y, s, col) { if (s <= .5) return; c.save(); c.translate(x, y); c.beginPath(); c.moveTo(0, -s); c.quadraticCurveTo(s * .16, -s * .16, s, 0); c.quadraticCurveTo(s * .16, s * .16, 0, s); c.quadraticCurveTo(-s * .16, s * .16, -s, 0); c.quadraticCurveTo(-s * .16, -s * .16, 0, -s); c.fillStyle = col; c.fill(); c.restore(); }
  // галочка штрихом (p — сколько нарисовано)
  function checkStroke(c, x, y, s, p, col, lw) { if (p <= 0) return; const P = [[-.42, .02], [-.12, .32], [.44, -.3]], L1 = Math.hypot(.3, .3), L2 = Math.hypot(.56, .62), tot = L1 + L2, d = p * tot;
    c.save(); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x + P[0][0] * s, y + P[0][1] * s);
    if (d <= L1) { const k = d / L1; c.lineTo(x + lerp(P[0][0], P[1][0], k) * s, y + lerp(P[0][1], P[1][1], k) * s); }
    else { c.lineTo(x + P[1][0] * s, y + P[1][1] * s); const k = (d - L1) / L2; c.lineTo(x + lerp(P[1][0], P[2][0], k) * s, y + lerp(P[1][1], P[2][1], k) * s); } c.stroke(); c.restore(); }
  // диагональные полосы внутри обрезанной области (живой прогресс-бар)
  function stripes(c, x, y, w, h, t, a = .18) { c.save(); c.fillStyle = `rgba(255,255,255,${a})`; const off = (t * 60) % 56; for (let sx = x - h - 56 + off; sx < x + w + h; sx += 56) { c.beginPath(); c.moveTo(sx, y + h); c.lineTo(sx + 26, y + h); c.lineTo(sx + 26 + h, y); c.lineTo(sx + h, y); c.closePath(); c.fill(); } c.restore(); }
  // монета с рублём анфас (sx — сжатие по горизонтали при вращении)
  function coinFace(c, x, y, r, sx = 1) { c.save(); c.translate(x, y); c.scale(Math.max(.08, sx), 1); sh(c, .5); circ(c, 0, 0, r, '#D99000'); nosh(c);
    circ(c, 0, -r * .04, r * .96, grad(c, -r, -r, r, r, ['#FFE9A0', '#FFC93C', '#F0A800'])); c.lineWidth = r * .07; c.strokeStyle = 'rgba(170,105,0,.45)'; circ(c, 0, -r * .04, r * .74); c.stroke();
    TF(c, '₽', 0, -r * .02, r * 1.05, '#B87400', 'Montserrat-Black'); c.restore(); }
  // монета в стопке (вид сбоку): y — верхняя грань
  function coinDisk(c, x, y, rx, ry, th) { c.beginPath(); c.ellipse(x, y + th, rx, ry, 0, 0, PI); c.lineTo(x - rx, y); c.lineTo(x + rx, y); c.closePath(); c.fillStyle = grad(c, x - rx, 0, x + rx, 0, ['#C98200', '#F5B800', '#D99000']); c.fill();
    c.strokeStyle = 'rgba(140,85,0,.35)'; c.lineWidth = 2; for (let i = -6; i <= 6; i++) { const xx = x + i * rx / 7; c.beginPath(); c.moveTo(xx, y + 2); c.lineTo(xx, y + th + ry * Math.sqrt(Math.max(0, 1 - (i / 7) ** 2)) - 3); c.stroke(); }
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fillStyle = grad(c, x - rx, y - ry, x + rx, y + ry, ['#FFEFB0', '#FFC93C', '#F0A800']); c.fill();
    c.beginPath(); c.ellipse(x, y, rx * .72, ry * .72, 0, 0, TAU); c.strokeStyle = 'rgba(170,105,0,.4)'; c.lineWidth = 3; c.stroke(); }
  // звезда-взрыв (стикер «−50 %»)
  function starburst(c, n, R, r, seed = 0) { c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU - PI / 2, rad = i % 2 ? r : R * (.92 + .08 * rnd(i + seed)); i ? c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : c.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); } c.closePath(); }
  // печать с волнистым краем
  function scallop(c, n, R, d) { c.beginPath(); for (let i = 0; i <= n; i++) { const a = i / n * TAU - PI / 2, am = (i - .5) / n * TAU - PI / 2; if (!i) c.moveTo(Math.cos(a) * R, Math.sin(a) * R); else c.quadraticCurveTo(Math.cos(am) * (R + d), Math.sin(am) * (R + d), Math.cos(a) * R, Math.sin(a) * R); } c.closePath(); }
  // купон с вырезами по бокам
  function coupon(c, x, y, w, h, r, nr) { const cy = y + h / 2; c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r); c.lineTo(x + w, cy - nr); c.arc(x + w, cy, nr, -PI / 2, PI / 2, true);
    c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r); c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r); c.lineTo(x, cy + nr); c.arc(x, cy, nr, PI / 2, -PI / 2, true); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath(); }

  /* =====================================================================
     Счётчики и таймеры (+14)
     ===================================================================== */

  // 1. Обратный отсчёт до старта: дни · часы · минуты · секунды
  A('f-cnt-launch', 'Отсчёт до старта: дни, часы, минуты, секунды', GC, 4, (c, t, D) => {
    const e = env(t, D), X = 92, Y = 302, w = 840, h = 420, ticks = [.7, 1.5, 2.3, 3.1];
    const vals = [[['02'], ['02']], [['14'], ['14']], [['37', '37', '37', '37', '36']], [['03', '02', '01', '00', '59']]];
    wk(c, 512, 512, e, () => {
      card(c, X, Y, w, h, 56, 'rgba(20,20,24,.95)', 1);
      const live = .55 + .45 * Math.abs(Math.sin(t * 3.2)); circ(c, X + 66, Y + 76, 13, `rgba(255,69,58,${live})`); c.save(); c.globalAlpha *= .3 * live; circ(c, X + 66, Y + 76, 24, '#FF453A'); c.restore();
      TF(c, 'До старта курса', X + 98, Y + 76, 40, '#fff', 'Inter-Bold', 'left');
      const tw = 170, gap = 26, x0 = X + (w - 4 * tw - 3 * gap) / 2, ty = Y + 128, th = 190, labels = ['дней', 'часов', 'минут', 'секунд'];
      for (let i = 0; i < 4; i++) { const x = x0 + i * (tw + gap), seq = vals[i][0], [a, b, k] = seq.length > 1 ? stepVal(t, ticks, seq) : [seq[0], seq[0], 1];
        rr(c, x, ty, tw, th, 30); c.fillStyle = grad(c, 0, ty, 0, ty + th, ['#34343C', '#24242A']); c.fill();
        c.save(); rr(c, x, ty, tw, th, 30); c.clip(); if (a === b) TF(c, b, x + tw / 2, ty + th / 2, 104, '#fff', 'Montserrat-ExtraBold'); else roll(c, a, b, k, x + tw / 2, ty + th / 2, 104, '#fff', 'Montserrat-ExtraBold');
        c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(x, ty + th / 2 - 1.5, tw, 3); c.restore();
        if (i === 3 && a !== b && k < 1) { c.save(); c.globalAlpha *= (1 - k) * .5; c.strokeStyle = '#FF453A'; c.lineWidth = 4; rr(c, x, ty, tw, th, 30); c.stroke(); c.restore(); }
        TF(c, labels[i], x + tw / 2, ty + th + 44, 26, 'rgba(255,255,255,.55)', 'Inter-Medium'); }
    });
  });

  // 2. Табло с перекидными цифрами
  function flipHalf(c, x, y, w, h, d, top, sy, shade) { c.save(); c.translate(x + w / 2, y + h / 2); c.scale(1, Math.max(.001, sy)); c.beginPath(); if (top) c.rect(-w / 2 - 2, -h / 2 - 2, w + 4, h / 2); else c.rect(-w / 2 - 2, 2, w + 4, h / 2 + 2); c.clip();
    rr(c, -w / 2, -h / 2, w, h, 24); c.fillStyle = top ? '#2E2E34' : '#26262C'; c.fill(); TF(c, d, 0, -4, h * .74, '#F5F5F7', 'Montserrat-ExtraBold');
    if (shade) { rr(c, -w / 2, -h / 2, w, h, 24); c.fillStyle = `rgba(0,0,0,${shade})`; c.fill(); } c.restore(); }
  function flipDigit(c, x, y, w, h, o, n, p) { c.save(); sh(c, .7); rr(c, x, y, w, h, 24); c.fillStyle = '#26262C'; c.fill(); c.restore();
    if (p <= 0 || o === n) { flipHalf(c, x, y, w, h, o === n || p <= 0 ? o : n, true, 1); flipHalf(c, x, y, w, h, o === n || p <= 0 ? o : n, false, 1); }
    else if (p >= 1) { flipHalf(c, x, y, w, h, n, true, 1); flipHalf(c, x, y, w, h, n, false, 1); }
    else { flipHalf(c, x, y, w, h, n, true, 1, .25 * (1 - p)); flipHalf(c, x, y, w, h, o, false, 1, .3 * p);
      if (p < .5) flipHalf(c, x, y, w, h, o, true, Math.cos(p * PI), .35 * p * 2); else flipHalf(c, x, y, w, h, n, false, -Math.cos(p * PI), .3 * (1 - p) * 2); }
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(x, y + h / 2 - 2, w, 4); [x - 3, x + w - 5].forEach(sx => { rr(c, sx, y + h / 2 - 12, 8, 24, 3); c.fillStyle = '#4A4A52'; c.fill(); }); }
  A('f-cnt-flip', 'Табло: перекидные цифры 09:59 → 10:00', GC, 3.5, (c, t, D) => {
    const e = env(t, D), seq = ['0959', '1000', '1001'], ticks = [1.0, 2.3], w = 150, h = 230, y = 512 - h / 2, gp = 14, col = 64, x0 = 512 - (4 * w + 2 * gp + col) / 2;
    let i = 0; while (i < ticks.length && t >= ticks[i]) i++; const cur = seq[i], prev = seq[Math.max(0, i - 1)], tk = i ? ticks[i - 1] : -9;
    wk(c, 512, 512, e, () => {
      for (let j = 0; j < 4; j++) { const x = x0 + j * w + (j > 0 ? gp : 0) + (j > 1 ? col : 0) + (j > 2 ? gp : 0), p = cl((t - tk - j * .07) / .42); flipDigit(c, x, y, w, h, prev[j], cur[j], i ? eio(p) : 1); }
      const cx = x0 + 2 * w + gp + col / 2, bl = .55 + .45 * (Math.floor(t * 2) % 2); c.save(); sh(c, .5); [-42, 42].forEach(dy => circ(c, cx, 512 + dy, 13, `rgba(255,255,255,${bl})`)); c.restore();
    });
  });

  // 3. Песочные часы
  A('f-cnt-hourglass', 'Песочные часы пересыпаются и переворачиваются', GC, 4, (c, t, D) => {
    const e = env(t, D), p = cl((t - .35) / 2.5), fl = eio(cl((t - 3.0) / .55)), W = 150, H = 250, n = 13;
    const glass = () => { c.beginPath(); c.moveTo(-W, -H); c.bezierCurveTo(-W, -H * .38, -n, -H * .16, -n, 0); c.bezierCurveTo(-n, H * .16, -W, H * .38, -W, H); c.lineTo(W, H); c.bezierCurveTo(W, H * .38, n, H * .16, n, 0); c.bezierCurveTo(n, -H * .16, W, -H * .38, W, -H); c.closePath(); };
    const sand = () => grad(c, -W, -H, W, H, ['#FFD98A', '#F5B04A', '#E08A20']);
    wk(c, 512, 512, e, () => { c.save(); c.translate(512, 512); c.rotate(fl * PI);
      c.save(); sh(c, .8); glass(); c.fillStyle = 'rgba(255,255,255,.22)'; c.fill(); c.restore();
      c.save(); glass(); c.clip();
      const top = (H - 70) * (1 - p), dip = 26 * Math.min(1, p * 8) * (1 - p);
      if (top > 1) { c.beginPath(); c.moveTo(-W, -top); c.quadraticCurveTo(0, -top + dip * 2, W, -top); c.lineTo(W, 2); c.lineTo(-W, 2); c.closePath(); c.fillStyle = sand(); c.fill(); }
      const hb = 165 * Math.pow(p, .85); if (hb > 1) { c.beginPath(); c.moveTo(-W, H); c.lineTo(-W, H - hb * .55); c.quadraticCurveTo(0, H - hb * 1.45, W, H - hb * .55); c.lineTo(W, H); c.closePath(); c.fillStyle = sand(); c.fill(); }
      if (p > 0 && p < 1) { c.fillStyle = '#F0A63C'; c.fillRect(-3.5, -2, 7, H - hb * 1.0 + 4); for (let k = 0; k < 4; k++) { const yy = ((t * 600 + k * 60) % (H - hb)); circ(c, (k % 2 ? 4 : -4), yy, 3, '#FFD98A'); } }
      c.restore();
      glass(); c.lineWidth = 7; c.strokeStyle = 'rgba(255,255,255,.92)'; c.stroke();
      c.save(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(-W + 26, -H + 30); c.bezierCurveTo(-W + 26, -H * .5, -60, -H * .26, -40, -H * .14); c.stroke(); c.restore();
      [-1, 1].forEach(s => { c.save(); sh(c, .6); rr(c, -W - 54, s < 0 ? -H - 44 : H, 2 * W + 108, 44, 18); c.fillStyle = grad(c, 0, -H - 44, 0, H + 44, ['#4A4A52', '#2A2A30']); c.fill(); c.restore(); });
      [-1, 1].forEach(s => { rr(c, s * (W + 32) - 8, -H, 16, 2 * H, 8); c.fillStyle = '#3A3A40'; c.fill(); });
      c.restore(); });
  });

  // 4. Круговой таймер 10 секунд
  A('f-cnt-ring10', 'Круговой таймер 10 → 0', GC, 4, (c, t, D) => {
    const e = env(t, D), p = cl((t - .3) / 3), n = Math.max(0, 10 - Math.floor((t - .3) / .3)), tc = .3 + (10 - n) * .3, end = n === 0;
    wk(c, 512, 512, e, () => {
      c.save(); sh(c, 1); circ(c, 512, 512, 320, 'rgba(20,20,24,.95)'); c.restore();
      const hot = n <= 3; for (let i = 0; i < 60; i++) { const a = -PI / 2 + i / 60 * TAU, on = i / 60 >= p - 1e-6 && !end, r0 = i % 5 ? 252 : 240, r1 = 282;
        c.strokeStyle = on ? (hot ? '#FF453A' : '#FF9F0A') : 'rgba(255,255,255,.14)'; c.lineWidth = i % 5 ? 8 : 11; c.lineCap = 'round'; c.beginPath(); c.moveTo(512 + Math.cos(a) * r0, 512 + Math.sin(a) * r0); c.lineTo(512 + Math.cos(a) * r1, 512 + Math.sin(a) * r1); c.stroke(); }
      if (!end && p > 0) { const a = -PI / 2 + p * TAU; circ(c, 512 + Math.cos(a) * 304, 512 + Math.sin(a) * 304, 9, hot ? '#FF453A' : '#FF9F0A'); }
      const k = 1 + .14 * (1 - ss((t - tc) / .22)) * (t > .3 ? 1 : 0); c.save(); c.translate(512, 492); c.scale(k, k); TF(c, String(n), 0, 0, 250, end ? '#FF453A' : '#fff', 'Inter-Bold'); c.restore();
      TF(c, 'секунд', 512, 650, 34, 'rgba(255,255,255,.55)', 'Inter-Medium');
      if (end) { const q = cl((t - 3.3) / .5); c.save(); c.globalAlpha *= 1 - q; c.strokeStyle = '#FF453A'; c.lineWidth = 16 * (1 - q); circ(c, 512, 512, 320 + 60 * eo(q)); c.stroke(); c.restore(); }
    });
  });

  // 5. Счётчик дохода в рублях
  A('f-cnt-money', 'Счётчик дохода до 1 250 000 ₽', GC, 3.5, (c, t, D) => {
    const e = env(t, D), X = 112, Y = 302, w = 800, h = 420, max = 1250000, q = cl((t - .35) / (D - 1.3)), v = max * (1 - Math.pow(1 - q, 4)), end = t > D - .95;
    const hs = [.22, .3, .26, .38, .35, .5, .46, .6, .56, .72, .8, 1];
    wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 52);
      TF(c, 'Доход за месяц', X + 60, Y + 70, 32, '#8E8E93', 'Inter-Medium', 'left');
      const bk = pop(t, D - .95, 15, .5); if (end) wk(c, X + w - 120, Y + 70, bk, () => { const bw = 150; rr(c, X + w - 60 - bw, Y + 44, bw, 52, 26); c.fillStyle = '#E8F1FF'; c.fill(); icp(c, 'trend', X + w - 60 - bw + 34, Y + 70, 30, '#0A84FF'); TF(c, '+38 %', X + w - 60 - bw + 54, Y + 70, 26, '#0A84FF', 'Inter-Bold', 'left'); });
      const ww = odo(c, end ? max : Math.min(max, v), X + 60, Y + 160, 100, '#111', 7); TF(c, '₽', X + 60 + ww + 26, Y + 160, 92, '#111', 'Montserrat-Black', 'left');
      const bx = X + 60, bw2 = w - 120, n = hs.length, gp = 12, bwi = (bw2 - gp * (n - 1)) / n, by = Y + h - 50;
      hs.forEach((hh, i) => { const k = eo(cl((t - .35 - i * .09) / .6)), bh = 175 * hh * k; if (bh < 1) return; rr(c, bx + i * (bwi + gp), by - bh, bwi, bh, 10); c.fillStyle = i === n - 1 ? grad(c, 0, by - bh, 0, by, ['#FF2D96', '#FF7AB8']) : grad(c, 0, by - 175, 0, by, ['#8F7BFF', '#D6CEFF']); c.fill(); });
    });
  });

  // 6. График растёт, цифра в плашке
  const CH = (() => { const K = [[0, .06], [.14, .15], [.28, .11], [.42, .3], [.56, .26], [.7, .5], [.84, .6], [1, .92]], out = [];
    for (let i = 0; i < K.length - 1; i++) { const p0 = K[Math.max(0, i - 1)], p1 = K[i], p2 = K[i + 1], p3 = K[Math.min(K.length - 1, i + 2)];
      for (let s = 0; s < 16; s++) { const u = s / 16, u2 = u * u, u3 = u2 * u, f = (a, b, cc, d) => .5 * (2 * b + (-a + cc) * u + (2 * a - 5 * b + 4 * cc - d) * u2 + (-a + 3 * b - 3 * cc + d) * u3); out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]); } }
    out.push(K[K.length - 1]); return out; })();
  A('f-cnt-chart', 'График растёт, процент в плашке', GC, 3.5, (c, t, D) => {
    const e = env(t, D), X = 112, Y = 232, w = 800, h = 560, x0 = X + 60, x1 = X + w - 60, yT = Y + 190, yB = Y + h - 60, p = eio(cl((t - .3) / 1.9));
    wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 52);
      TF(c, 'Охваты', X + 60, Y + 72, 42, '#111', 'Inter-Bold', 'left'); TF(c, 'за 30 дней', X + 60, Y + 118, 28, '#8E8E93', 'Inter-Medium', 'left');
      c.save(); c.strokeStyle = '#ECECF0'; c.lineWidth = 2; c.setLineDash([6, 10]); for (let i = 0; i < 4; i++) { const y = lerp(yT, yB, i / 3); c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); } c.restore();
      const P = CH.filter(q => q[0] <= p), hd = (() => { let i = CH.findIndex(q => q[0] > p); if (i <= 0) return CH[i < 0 ? CH.length - 1 : 0]; const a = CH[i - 1], b = CH[i], k = (p - a[0]) / (b[0] - a[0]); return [p, lerp(a[1], b[1], k)]; })();
      const pts = P.concat([hd]).map(q => [lerp(x0, x1, q[0]), lerp(yB, yT, q[1] / .92)]);
      if (pts.length > 1 && p > 0) { c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.lineTo(pts[pts.length - 1][0], yB); c.lineTo(pts[0][0], yB); c.closePath();
        const g = c.createLinearGradient(0, yT, 0, yB); g.addColorStop(0, 'rgba(123,97,255,.35)'); g.addColorStop(1, 'rgba(123,97,255,0)'); c.fillStyle = g; c.fill();
        c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.strokeStyle = grad(c, x0, 0, x1, 0, ['#5E9BFF', '#7B61FF', '#FF2D96']); c.lineWidth = 9; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke();
        const [hx2, hy] = pts[pts.length - 1], pu = .5 + .5 * Math.sin(t * 7); c.save(); c.globalAlpha *= .25 * pu; circ(c, hx2, hy, 30, '#FF2D96'); c.restore(); circ(c, hx2, hy, 15, '#fff'); c.lineWidth = 7; c.strokeStyle = '#FF2D96'; c.stroke();
        const val = Math.max(0, Math.round(312 * (hd[1] - .06) / .86)), s = '+' + val + ' %', bw = TFW(c, s, 34, 'Inter-Bold') + 44, bh = 62, bx = cl(hx2, x0 + bw / 2, x1 - bw / 2 + 20), by = hy - 64;
        c.save(); sh(c, .5); rr(c, bx - bw / 2, by - bh / 2, bw, bh, 20); c.fillStyle = '#111'; c.fill(); nosh(c); c.beginPath(); c.moveTo(hx2 - 11, by + bh / 2 - 1); c.lineTo(hx2 + 11, by + bh / 2 - 1); c.lineTo(hx2, by + bh / 2 + 12); c.fill(); c.restore();
        TF(c, s, bx, by, 34, '#fff', 'Inter-Bold'); }
    });
  });

  // 7. Осталось мест: места занимаются
  A('f-cnt-seats', 'Осталось мест: 10 → 3', GC, 3.5, (c, t, D) => {
    const e = env(t, D), X = 152, Y = 302, w = 720, h = 420, times = [0, 1, 2, 3, 4, 5, 6].map(i => .7 + i * .28), seq = [10, 9, 8, 7, 6, 5, 4, 3];
    const [a, b, k] = stepVal(t, times, seq, .25), taken = times.filter(x => t >= x).length, order = [3, 7, 0, 5, 9, 1, 6];
    wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 52);
      TF(c, 'Осталось мест:', X + 60, Y + 74, 44, '#111', 'Inter-Bold', 'left');
      c.save(); c.beginPath(); c.rect(X + w - 200, Y + 74 - 48, 150, 96); c.clip(); roll(c, String(a), String(b), a === b ? 1 : k, X + w - 60, Y + 74, 84, '#FF3B30', 'Montserrat-Black', 'right'); c.restore();
      const S = 96, gp = 24, sx = X + (w - 5 * S - 4 * gp) / 2;
      for (let i = 0; i < 10; i++) { const r = Math.floor(i / 5), x = sx + (i % 5) * (S + gp), y = Y + 150 + r * (S + gp), oi = order.indexOf(i), tk = oi >= 0 && oi < taken, tt = oi >= 0 ? times[oi] : 99;
        const f = ss((t - tt) / .18), bump = oi >= 0 ? Math.sin(PI * cl((t - tt) / .3)) : 0, pul = !tk && t > 2.6 ? .05 * Math.max(0, Math.sin((t - 2.6) * 9)) : 0, kk = 1 - .18 * bump + pul;
        c.save(); c.translate(x + S / 2, y + S / 2); c.scale(kk, kk); rr(c, -S / 2, -S / 2, S, S, 28); c.fillStyle = grad(c, -S / 2, -S / 2, S / 2, S / 2, ['#5E9BFF', '#7B61FF']); c.fill();
        if (f > 0) { c.save(); c.globalAlpha *= f; c.fillStyle = '#E5E5EA'; c.fill(); c.restore(); } ic(c, 'person', 0, 4, 60, f > .5 ? '#B4B4BC' : '#fff'); c.restore(); }
    });
  });

  // 8. Прогресс до цели 80 %
  A('f-cnt-goal', 'Прогресс до цели: 80 %', GC, 3.5, (c, t, D) => {
    const e = env(t, D), X = 112, Y = 342, w = 800, h = 340, p = .8 * eo(cl((t - .4) / 1.6)), bx = X + 50, bw = w - 100, by = Y + 150, bh = 58;
    wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 52);
      TF(c, 'До цели', X + 50, Y + 76, 42, '#111', 'Inter-Bold', 'left'); TF(c, 'Цель: 1 000 000 ₽', X + w - 50, Y + 76, 34, '#8E8E93', 'Inter-Bold', 'right');
      rr(c, bx, by, bw, bh, bh / 2); c.fillStyle = '#EEEEF2'; c.fill();
      const fw = Math.max(bh, bw * p); c.save(); rr(c, bx, by, fw, bh, bh / 2); c.clip(); c.fillStyle = grad(c, bx, 0, bx + bw, 0, ['#FF9F0A', '#FF375F']); c.fillRect(bx, by, fw, bh); stripes(c, bx, by, fw, bh, t); c.restore();
      const hx2 = bx + fw - bh / 2; circ(c, hx2, by + bh / 2, 15, '#fff');
      const s = Math.round(p * 100) + ' %', tw = TFW(c, s, 32, 'Inter-Bold') + 40, ty = by + bh + 52; c.save(); rr(c, hx2 - tw / 2, ty - 28, tw, 56, 18); c.fillStyle = '#111'; c.fill(); c.beginPath(); c.moveTo(hx2 - 10, ty - 27); c.lineTo(hx2 + 10, ty - 27); c.lineTo(hx2, ty - 39); c.fill(); c.restore();
      TF(c, s, hx2, ty, 32, '#fff', 'Inter-Bold');
      const fx = bx + bw - 6; c.save(); c.strokeStyle = '#111'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(fx, by - 6); c.lineTo(fx, by - 54); c.stroke(); c.beginPath(); c.moveTo(fx, by - 54); c.lineTo(fx - 38, by - 43); c.lineTo(fx, by - 32); c.closePath(); c.fillStyle = '#FF375F'; c.fill(); c.restore();
    });
  });

  // 9. Отрывной календарь листается до даты
  A('f-cnt-calendar', 'Отрывной календарь листается до даты старта', GC, 4, (c, t, D) => {
    const e = env(t, D), X = 302, Y = 262, w = 420, h = 500, hh = 124, dates = ['10', '11', '12', '13', '14'], wd = ['вторник', 'среда', 'четверг', 'пятница', 'суббота'], tears = [.6, 1.1, 1.6, 2.1];
    const idx = tears.filter(x => t >= x).length;
    const body = (i) => { c.save(); c.beginPath(); c.moveTo(X, Y + hh); c.lineTo(X + w, Y + hh); c.lineTo(X + w, Y + h - 36); c.arcTo(X + w, Y + h, X + w - 36, Y + h, 36); c.lineTo(X + 36, Y + h); c.arcTo(X, Y + h, X, Y + h - 36, 36); c.closePath(); c.fillStyle = '#fff'; c.fill();
      TF(c, dates[i], X + w / 2, Y + hh + 170, 210, '#111', 'Montserrat-Black'); const sf = i === dates.length - 1 ? ss((t - 2.55) / .2) : 0; c.save(); c.globalAlpha *= 1 - sf; TF(c, wd[i], X + w / 2, Y + h - 60, 34, '#8E8E93', 'Inter-Medium'); c.restore();
      if (sf > 0) { const k = .6 + .4 * Math.min(1.08, spr(t - 2.55, 15, .45)), pw = TFW(c, 'Старт курса', 32, 'Inter-Bold') + 56; c.save(); c.globalAlpha *= sf; c.translate(X + w / 2, Y + h - 62); c.scale(k, k); rr(c, -pw / 2, -30, pw, 60, 30); c.fillStyle = '#FF3B30'; c.fill(); TF(c, 'Старт курса', 0, 0, 32, '#fff', 'Inter-Bold'); c.restore(); } c.restore(); };
    wk(c, 512, 512, e, () => {
      c.save(); sh(c, 1); rr(c, X, Y, w, h, 36); c.fillStyle = '#fff'; c.fill(); c.restore();
      c.save(); c.strokeStyle = '#E5E5EA'; c.lineWidth = 3; [10, 18].forEach(d => { c.beginPath(); c.moveTo(X + 30, Y + h + d - 14); c.lineTo(X + w - 30, Y + h + d - 14); c.stroke(); }); c.restore();
      body(Math.min(idx, dates.length - 1));
      c.save(); rr(c, X, Y, w, hh + 36, 36); c.clip(); c.fillStyle = grad(c, 0, Y, 0, Y + hh, ['#FF5A4E', '#E0262B']); c.fillRect(X, Y, w, hh); c.restore();
      TF(c, 'НОЯБРЬ', X + w / 2, Y + hh / 2 + 10, 44, '#fff', 'Inter-Bold', 'center', 6);
      [X + 100, X + w - 100].forEach(rx => { rr(c, rx - 14, Y - 30, 28, 70, 14); c.fillStyle = grad(c, rx - 14, 0, rx + 14, 0, ['#55555C', '#2A2A30', '#55555C']); c.fill(); });
      for (let j = 0; j < idx; j++) { const q = cl((t - tears[j]) / .38); if (q >= 1) continue; const sy = Math.cos(eio(q) * PI / 2); if (sy < .02) continue; c.save(); c.translate(512, Y + hh); c.scale(1 - .04 * q, sy); c.translate(-512, -(Y + hh)); body(j); c.fillStyle = `rgba(0,0,0,${.18 * q})`; c.fillRect(X, Y + hh, w, h - hh - 36); c.restore(); }
    });
  });

  // 10. Спидометр
  A('f-cnt-speed', 'Спидометр: стрелка уходит в красную зону', GC, 3.5, (c, t, D) => {
    const e = env(t, D), cx = 512, cy = 540, R = 250, a0 = .75 * PI, sw = 1.5 * PI, v = .92 * cl(spr(t - .4, 6.5, .38), 0, 1.07), shake = t > 1.2 ? Math.sin(t * 60) * .006 : 0;
    wk(c, 512, 512, e, () => { c.save(); sh(c, 1); circ(c, 512, 512, 340, '#fff'); c.restore();
      c.lineCap = 'round'; c.lineWidth = 34; c.strokeStyle = '#EEEEF2'; c.beginPath(); c.arc(cx, cy, R, a0, a0 + sw); c.stroke();
      const g = c.createConicGradient(a0, cx, cy); [[0, '#2F80FF'], [.36, '#7B61FF'], [.58, '#FF9F0A'], [.75, '#FF3B30'], [.88, '#FF3B30'], [1, '#2F80FF']].forEach(([o, s]) => g.addColorStop(o, s));
      if (v > .003) { c.strokeStyle = g; c.beginPath(); c.arc(cx, cy, R, a0, a0 + sw * Math.min(1, v)); c.stroke(); }
      for (let i = 0; i <= 10; i++) { const a = a0 + sw * i / 10, r0 = i % 5 ? 214 : 204; c.strokeStyle = '#C7C7CC'; c.lineWidth = i % 5 ? 4 : 6; c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * 226, cy + Math.sin(a) * 226); c.stroke();
        if (i % 2 === 0) TF(c, String(i * 10), cx + Math.cos(a) * 172, cy + Math.sin(a) * 172, 26, '#8E8E93', 'Inter-Medium'); }
      const na = a0 + sw * v + shake; c.save(); c.translate(cx, cy); c.rotate(na); sh(c, .4); c.beginPath(); c.moveTo(0, -11); c.lineTo(205, -2); c.lineTo(205, 2); c.lineTo(0, 11); c.closePath(); c.fillStyle = '#111'; c.fill(); c.restore();
      circ(c, cx, cy, 28, '#111'); circ(c, cx, cy, 9, '#fff');
      TF(c, String(Math.round(Math.min(1, v) * 100)), cx, cy + 128, 84, '#111', 'Montserrat-Black'); TF(c, 'охват, %', cx, cy + 186, 26, '#8E8E93', 'Inter-Medium');
    });
  });

  // 11. Рейтинг 4,9
  A('f-cnt-rating', 'Рейтинг 4,9: цифра и звёзды заполняются', GC, 3, (c, t, D) => {
    const e = env(t, D), X = 232, Y = 322, w = 560, h = 380, v = 4.9 * eo(cl((t - .3) / 1.4)), done = t > 1.75;
    wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 52);
      const k = done ? 1 + .1 * Math.sin(PI * cl((t - 1.75) / .3)) : 1; c.save(); c.translate(512, Y + 122); c.scale(k, k); TF(c, v.toFixed(1).replace('.', ','), 0, 0, 150, '#111', 'Montserrat-Black'); c.restore();
      for (let i = 0; i < 5; i++) { const x = 512 + (i - 2) * 94, y = Y + 252, f = cl(v - i); ic(c, 'star', x, y, 86, '#E5E5EA'); if (f > 0) { c.save(); c.beginPath(); c.rect(x - 43, y - 43, 86 * f, 86); c.clip(); ic(c, 'star', x, y, 86, '#FFB800'); c.restore(); } }
      TF(c, '1 248 отзывов', 512, Y + 324, 28, '#8E8E93', 'Inter-Medium');
    });
  });

  // 12. Кольца активности: шаги, калории, минуты
  A('f-cnt-steps', 'Кольца активности: шаги и калории', GC, 3.5, (c, t, D) => {
    const e = env(t, D), X = 92, Y = 292, w = 840, h = 440, cx = 300, cy = 512, Rs = [158, 114, 70], tg = [1, .84, .95];
    const cols = [['#FF2D55', '#FF7A9A'], ['#FF9F0A', '#FFD60A'], ['#32ADE6', '#5E5CE6']], rows = [['Шаги', 10000, 'шагов'], ['Калории', 540, 'ккал'], ['Активность', 45, 'мин']];
    wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 56, 'rgba(20,20,24,.96)', 1);
      Rs.forEach((R, i) => { const p = tg[i] * eo(cl((t - .3 - i * .14) / 1.7)), col = cols[i]; c.lineCap = 'round'; c.lineWidth = 36;
        c.strokeStyle = col[0] + '38'; circ(c, cx, cy, R); c.stroke();
        if (p > .004) { c.strokeStyle = grad(c, cx - R, cy - R, cx + R, cy + R, col); c.beginPath(); c.arc(cx, cy, R, -PI / 2, -PI / 2 + TAU * p); c.stroke(); } });
      rows.forEach(([l, max, u], i) => { const p = eo(cl((t - .3 - i * .14) / 1.7)), y = 410 + i * 104; TF(c, l, 530, y - 26, 26, 'rgba(255,255,255,.55)', 'Inter-Medium', 'left');
        const s = nb(max * p * tg[i] / (i === 0 ? 1 : tg[i])), vw = TFW(c, s, 52, 'Inter-Bold'); TF(c, s, 530, y + 18, 52, cols[i][0], 'Inter-Bold', 'left'); TF(c, u, 530 + vw + 12, y + 24, 28, 'rgba(255,255,255,.55)', 'Inter-Medium', 'left'); });
    });
  });

  // 13. Челлендж 30 дней
  A('f-cnt-days', 'Челлендж: дни 1 → 30 закрашиваются', GC, 4, (c, t, D) => {
    const e = env(t, D), X = 152, Y = 232, w = 720, h = 560, ti = i => .4 + i * .085, n = Math.min(30, Math.floor(cl((t - .4) / .085 + 1, 0, 30))), done = t > ti(29) + .15;
    wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 52);
      TF(c, 'Челлендж', X + 56, Y + 74, 42, '#111', 'Inter-Bold', 'left');
      const f = ss((t - ti(29) - .15) / .2); c.save(); c.globalAlpha *= 1 - f; TF(c, 'День ' + Math.max(1, n) + ' из 30', X + w - 56, Y + 74, 34, '#8E8E93', 'Inter-Bold', 'right'); c.restore();
      if (done) { const s = pop(t, ti(29) + .15, 16, .5); c.save(); c.globalAlpha *= f; TF(c, 'Пройден!', X + w - 56, Y + 74, 34, '#FF375F', 'Inter-Bold', 'right'); c.restore(); void s; }
      const cw = 104, sx = X + (w - 6 * cw) / 2 + cw / 2;
      for (let i = 0; i < 30; i++) { const x = sx + (i % 6) * cw, y = Y + 160 + Math.floor(i / 6) * 84, on = t >= ti(i), k = on ? .6 + .4 * spr(t - ti(i), 18, .45) : 1;
        c.save(); c.translate(x, y); c.scale(k, k); if (on) { circ(c, 0, 0, 34, grad(c, -34, -34, 34, 34, ['#FF9F0A', '#FF2D55'])); ic(c, 'check', 0, 1, 40, '#fff'); } else { circ(c, 0, 0, 34, '#F2F2F7'); TF(c, String(i + 1), 0, 0, 24, '#AEAEB2', 'Inter-Medium'); } c.restore(); }
    });
    confetti(c, 512, 300, t, ti(29) + .15, 26, 420);
  });

  // 14. Батарея заряжается
  A('f-cnt-battery', 'Батарея заряжается до 100 %', GC, 3.5, (c, t, D) => {
    const e = env(t, D), X = 242, Y = 382, w = 500, h = 230, p = eio(cl((t - .3) / 2.1)), full = p >= 1;
    const col = p < .5 ? lc('#FF453A', '#FF9F0A', p / .5) : lc('#FF9F0A', '#FFD60A', (p - .5) / .5), fc = full ? lc('#FFD60A', '#0A84FF', ss((t - 2.4) / .25)) : col;
    wk(c, 512, 512, e, () => {
      c.save(); sh(c, .9); rr(c, X, Y, w, h, 62); c.lineWidth = 16; c.strokeStyle = '#fff'; c.stroke(); rr(c, X + w + 18, Y + h / 2 - 42, 30, 84, 13); c.fillStyle = '#fff'; c.fill(); c.restore();
      const ix = X + 24, iy = Y + 24, iw = w - 48, ih = h - 48; if (p > .005) { c.save(); rr(c, ix, iy, iw, ih, 42); c.clip(); c.fillStyle = fc; c.fillRect(ix, iy, iw * p, ih); shine(c, ix, iy, iw * p, ih, t, .9, 1.4, .35); c.restore(); }
      const bk = 1 + (full ? .18 * Math.sin(PI * cl((t - 2.4) / .3)) : .05 * Math.sin(t * 8)); c.save(); c.translate(X + w / 2, Y + h / 2); c.scale(bk, bk); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 18; icp(c, 'bolt', 0, 0, 150, '#fff'); c.restore();
      c.save(); sh(c, .6); TF(c, Math.round(p * 100) + ' %', 512, Y + h + 100, 84, '#fff', 'Montserrat-Black'); c.restore();
      if (full) { const q = cl((t - 2.4) / .6); c.save(); c.globalAlpha *= (1 - q) * .8; c.strokeStyle = '#0A84FF'; c.lineWidth = 10 * (1 - q); rr(c, X - 30 * eo(q), Y - 30 * eo(q), w + 60 * eo(q), h + 60 * eo(q), 62 + 30 * eo(q)); c.stroke(); c.restore(); }
    });
  });

  /* =====================================================================
     Продажи и акции (20)
     ===================================================================== */

  // 1. «−50 %» стикер-взрыв
  A('f-sale-50', '«−50 %»: стикер-взрыв', GS, 3, (c, t, D) => {
    const e = env(t, D), e2 = env(t, D, .1); e.r = -.5 * (1 - cl(spr(t, 9, .5))) + .03 * Math.sin(t * 2); e2.r = .2 - .6 * (1 - cl(spr(t - .1, 9, .5))) + .03 * Math.sin(t * 2 + 1);
    const pu = 1 + .09 * Math.sin(PI * cl((t - 1.4) / .3)); e.k *= pu; e2.k *= pu;
    burst(c, 512, 512, t, .2, { n: 14, R: 400, s: 16, lw: 18, lines: true, cols: ['#FFD60A', '#FF3B30', '#fff'] });
    wk(c, 512, 512, e2, () => { c.save(); c.translate(512, 512); sh(c, .8); starburst(c, 16, 350, 300, 7); c.fillStyle = '#FFD60A'; c.fill(); c.restore(); });
    wk(c, 512, 512, e, () => { c.save(); c.translate(512, 512); sh(c, 1); starburst(c, 18, 318, 268, 3); c.fillStyle = grad(c, -300, -300, 300, 300, ['#FF5A4E', '#FF2D55', '#E0103A']); c.fill(); nosh(c);
      c.rotate(-.1); let px = 190; const tw = TFW(c, '−50%', px, 'Montserrat-Black'); if (tw > 440) px *= 440 / tw; c.shadowColor = 'rgba(120,0,20,.45)'; c.shadowBlur = 0; c.shadowOffsetY = 8; TF(c, '−50%', 0, 0, px, '#fff', 'Montserrat-Black'); c.restore(); });
  });

  // 2. Ценник: старая цена зачёркивается
  A('f-sale-price', 'Цена: старая зачёркивается, новая выскакивает', GS, 3.5, (c, t, D) => {
    const e = env(t, D), X = 192, Y = 302, w = 640, h = 420, ts = .9, tn = 1.35, ls = eio(cl((t - ts) / .3)), f = ss((t - ts) / .3);
    wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 52);
      TF(c, 'Цена курса', 512, Y + 70, 32, '#8E8E93', 'Inter-Medium');
      const oy = Y + 165 - 10 * f, ok = 1 - .25 * f, ow = TFW(c, '9 990 ₽', 96, 'Inter-Bold') * ok; c.save(); c.translate(512, oy); c.scale(ok, ok); TF(c, '9 990 ₽', 0, 0, 96, lc('#111111', '#AEAEB2', f), 'Inter-Bold'); c.restore();
      if (ls > 0) { const x0 = 512 - ow / 2 - 20, x1 = 512 + ow / 2 + 20; c.save(); c.strokeStyle = '#FF3B30'; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, oy + 14); c.lineTo(lerp(x0, x1, ls), oy + 14 - 28 * ls); c.stroke(); c.restore(); }
      const s = pop(t, tn, 14, .42); wk(c, 512, Y + 305, s, () => TF(c, '4 990 ₽', 512, Y + 305, 132, '#FF2D55', 'Montserrat-Black'));
      const b = pop(t, tn + .3, 15, .45); b.r = .14; wk(c, X + w - 40, Y + 10, b, () => { const bw = TFW(c, '−50 %', 34, 'Inter-Bold') + 44; c.save(); sh(c, .6); rr(c, X + w - 40 - bw / 2, Y + 10 - 32, bw, 64, 32); c.fillStyle = '#FF3B30'; c.fill(); c.restore(); TF(c, '−50 %', X + w - 40, Y + 10, 34, '#fff', 'Inter-Bold'); });
    });
    burst(c, X + w - 40, Y + 10, t, tn + .32, { n: 8, R: 90, s: 7, ring: false, lines: true, cols: ['#FF3B30'] });
  });

  // 3. Лента «Скидка до пятницы»
  A('f-sale-friday', 'Лента «Скидка до пятницы» разворачивается', GS, 3, (c, t, D) => {
    const e = env(t, D), cy = 512, bh = 150; let px = 62; const tw0 = TFW(c, 'Скидка до пятницы', px, 'Montserrat-ExtraBold'); if (tw0 > 580) px *= 580 / tw0;
    const bw = TFW(c, 'Скидка до пятницы', px, 'Montserrat-ExtraBold') + 120, x0 = 512 - bw / 2, ux = cl(spr(t, 11, .62), 0, 1.05), tl = eo(cl((t - .25) / .35));
    wk(c, 512, 512, e, () => {
      [-1, 1].forEach(s => { if (tl <= 0) return; const ex = s < 0 ? x0 : x0 + bw, L = 120 * tl, top = cy - bh / 2 + 38, bot = cy + bh / 2 + 38, xo = ex - s * 34, xf = ex + s * L - s * 10;
        c.save(); sh(c, .6); c.beginPath(); c.moveTo(xo, top); c.lineTo(xf, top); c.lineTo(xf - s * 44 * tl, (top + bot) / 2); c.lineTo(xf, bot); c.lineTo(xo, bot); c.closePath(); c.fillStyle = '#B5122F'; c.fill(); c.restore();
        c.beginPath(); c.moveTo(ex, cy + bh / 2); c.lineTo(xo, cy + bh / 2); c.lineTo(xo, bot); c.closePath(); c.fillStyle = '#7A0A1F'; c.fill(); });
      c.save(); c.translate(512, cy); c.scale(Math.max(.001, ux), 1); c.translate(-512, -cy); sh(c, 1); rr(c, x0, cy - bh / 2, bw, bh, 10); c.fillStyle = grad(c, 0, cy - bh / 2, 0, cy + bh / 2, ['#FF4D5E', '#E0193A']); c.fill(); nosh(c); c.clip(); shine(c, x0, cy - bh / 2, bw, bh, t, .7, 1.8, .35); c.restore();
      c.save(); c.globalAlpha *= ss((t - .2) / .2); TF(c, 'Скидка до пятницы', 512, cy, px, '#fff', 'Montserrat-ExtraBold'); c.restore();
      const b = pop(t, .55, 14, .45); b.r = -.16; wk(c, x0 + 30, cy - bh / 2 - 34, b, () => { const bx = x0 + 30, by = cy - bh / 2 - 34; c.save(); sh(c, .6); rr(c, bx - 54, by - 58, 108, 116, 22); c.fillStyle = '#fff'; c.fill(); nosh(c); c.beginPath(); c.rect(bx - 54, by - 58, 108, 36); c.clip(); rr(c, bx - 54, by - 58, 108, 116, 22); c.fillStyle = '#111'; c.fill(); c.restore(); TF(c, 'ПТ', bx, by + 20, 44, '#111', 'Montserrat-Black'); });
    });
  });

  // 4. «Запись открыта»: замок открывается
  A('f-sale-open', '«Запись открыта»: замок открывается', GS, 3, (c, t, D) => {
    const e = env(t, D), h = 170, px = 60, full = TFW(c, 'Запись открыта', px, 'Inter-Bold') + 300, ex = eio(cl((t - 1.1) / .45)), w = lerp(h, full, ex), x = 512 - w / 2, op = eo(cl((t - .8) / .3)), sk = .9 * spr(t - .8, 16, .4);
    wk(c, 512, 512, e, () => { card(c, x, 512 - h / 2, w, h, h / 2, '#fff', 1);
      const ix = x + h / 2; circ(c, ix, 512, 64, grad(c, ix - 64, 448, ix + 64, 576, ['#7B61FF', '#2F80FF']));
      c.save(); c.translate(ix, 520); const kk = 1 + .1 * Math.sin(PI * cl((t - .8) / .3)); c.scale(kk, kk);
      c.save(); c.translate(-17, -4 - 14 * op); c.rotate(-.55 * Math.min(1, sk)); c.strokeStyle = '#fff'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 6); c.lineTo(0, -20); c.arc(17, -20, 17, PI, 0); c.lineTo(34, 6 - 10 * op); c.stroke(); c.restore();
      rr(c, -30, -6, 60, 46, 10); c.fillStyle = '#fff'; c.fill(); circ(c, 0, 12, 6, '#5E7BFF'); c.fillStyle = '#5E7BFF'; c.fillRect(-2.5, 12, 5, 13); c.restore();
      if (ex > 0) { c.save(); rr(c, x, 512 - h / 2, w, h, h / 2); c.clip(); c.globalAlpha *= ss((ex - .3) / .7); TF(c, 'Запись открыта', x + h + 4, 512, px, '#111', 'Inter-Bold', 'left'); const pu = .5 + .5 * Math.abs(Math.sin(t * 3.5)); circ(c, x + w - 72, 512, 13, '#FF3B30'); c.globalAlpha *= .35 * pu; circ(c, x + w - 72, 512, 25, '#FF3B30'); c.restore(); }
    });
  });

  // 5. «Осталось 3 места»: шкала продаж
  A('f-sale-seats', '«Осталось 3 места»: шкала продаж заполняется', GS, 3.5, (c, t, D) => {
    const e = env(t, D), X = 132, Y = 342, w = 760, h = 340, p = eo(cl((t - .4) / 1.8)), sold = Math.round(47 * p), rem = 50 - sold, done = t > 2.2, pu = done ? 1 + .05 * Math.sin(PI * cl((t - 2.2) / .3)) + .02 * Math.max(0, Math.sin((t - 2.5) * 8)) * (t > 2.5 ? 1 : 0) : 1;
    wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 52);
      c.save(); c.translate(X + 56, Y + 82); c.scale(pu, pu); icp(c, 'fire', 34, 0, 64, '#FF6A00');
      const a = 'Осталось ', b = rem + ' ' + plural(rem, 'место', 'места', 'мест'), aw = TFW(c, a, 48, 'Inter-Bold'); TF(c, a, 80, 0, 48, '#111', 'Inter-Bold', 'left'); TF(c, b, 80 + aw, 0, 48, rem <= 5 ? '#FF3B30' : '#111', 'Inter-Bold', 'left'); c.restore();
      const bx = X + 56, bw = w - 112, by = Y + 160, bh = 48; rr(c, bx, by, bw, bh, 24); c.fillStyle = '#F0F0F4'; c.fill();
      if (p > 0) { const fw = Math.max(bh, bw * p * .94); c.save(); rr(c, bx, by, fw, bh, 24); c.clip(); c.fillStyle = grad(c, bx, 0, bx + bw, 0, ['#FF9F0A', '#FF3B30']); c.fillRect(bx, by, fw, bh); stripes(c, bx, by, fw, bh, t, .2); c.restore(); }
      TF(c, 'Продано ' + sold + ' из 50', bx, Y + 270, 30, '#8E8E93', 'Inter-Medium', 'left'); TF(c, Math.round(p * 94) + ' %', bx + bw, Y + 270, 30, '#111', 'Inter-Bold', 'right');
    });
  });

  // 6. «Хит продаж»: медаль
  A('f-sale-hit', '«Хит продаж»: медаль влетает с вращением', GS, 3, (c, t, D) => {
    const e = env(t, D), cy = 470; e.r = -.9 * (1 - cl(spr(t, 9, .55)));
    wk(c, 512, cy, e, () => { c.save(); c.translate(512, cy);
      [-1, 1].forEach(s => { c.save(); c.rotate(s * .32); sh(c, .6); c.beginPath(); c.moveTo(s * 30 - 46, 120); c.lineTo(s * 30 + 46, 120); c.lineTo(s * 30 + 46, 330); c.lineTo(s * 30, 292); c.lineTo(s * 30 - 46, 330); c.closePath(); c.fillStyle = s < 0 ? '#E0263B' : '#C81E33'; c.fill(); c.restore(); });
      c.save(); sh(c, 1); scallop(c, 30, 214, 22); c.fillStyle = grad(c, -230, -230, 230, 230, ['#FFE08A', '#F5B030', '#E07B00']); c.fill(); nosh(c); c.clip(); shine(c, -260, -260, 520, 520, t - .9, .6, 1.8, .5); c.restore();
      c.save(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 4; c.setLineDash([3, 11]); c.lineCap = 'round'; circ(c, 0, 0, 180); c.stroke(); c.restore();
      icp(c, 'fire', 0, -104, 58, '#fff');
      c.shadowColor = 'rgba(140,70,0,.45)'; c.shadowOffsetY = 6; TF(c, 'ХИТ', 0, -8, 136, '#fff', 'Montserrat-Black'); TF(c, 'ПРОДАЖ', 0, 92, 42, '#fff', 'Inter-Bold', 'center', 6); c.restore(); });
  });

  // 7. «Новинка» с искрами
  A('f-sale-new', '«Новинка»: плашка с искрами', GS, 2.5, (c, t, D) => {
    const e = env(t, D), px = 76, w = TFW(c, 'Новинка', px, 'Unbounded-ExtraBold') + 130, h = 156, x = 512 - w / 2, y = 512 - h / 2; e.r = -.06;
    wk(c, 512, 512, e, () => { c.save(); sh(c, 1); rr(c, x, y, w, h, h / 2); c.fillStyle = grad(c, x, y, x + w, y + h, ['#7B61FF', '#C04BFF', '#FF2D96']); c.fill(); nosh(c); c.clip(); shine(c, x, y, w, h, t - .3, .9, 1.5, .4); c.restore();
      TF(c, 'Новинка', 512, 512, px, '#fff', 'Unbounded-ExtraBold');
      [[x - 10, y - 20, 46, .35], [x + w + 6, y + 10, 34, .55], [x + w - 70, y + h + 26, 40, .75], [x + 50, y + h + 18, 26, .95], [x + w * .55, y - 34, 24, 1.1]].forEach(([sx, sy, s, t0], i) => {
        const k = cl(spr(t - t0, 16, .45)) * (.7 + .3 * Math.sin((t - t0) * 6 + i)); star4(c, sx, sy, s * Math.max(0, k), i % 2 ? '#FFD60A' : '#fff'); });
    });
  });

  // 8. «Бесплатно»: буквы прыгают на плашке
  A('f-sale-free', '«Бесплатно»: буквы прыгают на жёлтой плашке', GS, 3, (c, t, D) => {
    const e = env(t, D), s = 'БЕСПЛАТНО'; let px = 96; const tw0 = TFW(c, s, px, 'Unbounded-ExtraBold'); if (tw0 > 700) px *= 700 / tw0; const tw = TFW(c, s, px, 'Unbounded-ExtraBold'), bw = tw + 110, wp = eo(cl((t - .05) / .4));
    wk(c, 512, 512, e, () => { c.save(); c.translate(512, 512); c.rotate(-.04);
      c.save(); sh(c, .9); rr(c, -bw / 2, -76, bw * wp, 152, 22); c.fillStyle = '#FFD60A'; c.fill(); c.restore();
      let x = -tw / 2; c.font = `${px}px "Unbounded-ExtraBold"`; for (let i = 0; i < s.length; i++) { const ch = s[i], cw = c.measureText(ch).width, ti = .3 + i * .06, k = spr(t - ti, 15, .45); if (t > ti) { c.save(); c.globalAlpha *= cl((t - ti) / .06);
        const wv = t > 1.4 ? Math.sin(t * 6 - i * .7) * 5 : 0; c.translate(x + cw / 2, (1 - Math.min(1, k)) * -90 + wv); c.scale(.4 + .6 * k, .4 + .6 * k); TF(c, ch, 0, 0, px, '#111', 'Unbounded-ExtraBold'); c.restore(); } x += cw; }
      c.restore();
      const b = pop(t, 1.2, 15, .45); b.r = .12; wk(c, 790, 640, b, () => { const w2 = TFW(c, '0 ₽', 52, 'Montserrat-Black') + 60; c.save(); sh(c, .6); rr(c, 790 - w2 / 2, 640 - 44, w2, 88, 44); c.fillStyle = '#111'; c.fill(); c.restore(); TF(c, '0 ₽', 790, 640, 52, '#fff', 'Montserrat-Black'); });
    });
  });

  // 9. «Подарок»: коробка открывается
  A('f-sale-gift', '«Подарок»: коробка трясётся и открывается', GS, 3.5, (c, t, D) => {
    const e = env(t, D), to = 1.55, q = cl((t - to) / .55), sk = t > .7 && t < to ? Math.sin((t - .7) * 42) * .07 * ((t - .7) / (to - .7)) : 0, hop = t > .7 && t < to ? -Math.abs(Math.sin((t - .7) * 21)) * 10 * ((t - .7) / (to - .7)) : 0;
    wk(c, 512, 600, e, () => {
      if (q > 0) { c.save(); c.globalAlpha *= ss(q * 2) * (.8 + .2 * Math.sin(t * 5)); c.translate(512, 560); for (let i = 0; i < 9; i++) { const a = PI + .14 + i / 8 * (PI - .48) + .08 * Math.sin(t * 1.3 + i * 1.7); c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 440 * eo(q), a, a + .2); c.closePath(); const g = c.createRadialGradient(0, 0, 0, 0, 0, 440); g.addColorStop(0, 'rgba(255,220,120,.75)'); g.addColorStop(1, 'rgba(255,220,120,0)'); c.fillStyle = g; c.fill(); } c.restore(); }
      c.save(); c.translate(512, 790 + hop); c.rotate(sk); c.translate(-512, -790);
      c.save(); sh(c, 1); rr(c, 352, 540, 320, 250, 26); c.fillStyle = grad(c, 352, 540, 672, 790, ['#FF4D6D', '#D6153E']); c.fill(); c.restore();
      c.fillStyle = '#FFCF4A'; c.fillRect(484, 540, 56, 250); c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(352, 540, 320, 14);
      const lx = 512 + 200 * eo(q), ly = 512 - 275 * eo(q) + (q >= 1 ? Math.sin((t - to) * 3) * 8 : 0), lr = .5 * eo(q);
      c.save(); c.translate(lx, ly); c.rotate(lr + sk); sh(c, .7); rr(c, -180, -42, 360, 84, 22); c.fillStyle = grad(c, -180, -42, 180, 42, ['#FF6A85', '#E62550']); c.fill(); nosh(c); c.fillStyle = '#FFD65A'; c.fillRect(-28, -42, 56, 84);
      [-1, 1].forEach(s => { c.save(); c.translate(s * 42, -58); c.rotate(s * .45); c.beginPath(); c.ellipse(0, 0, 50, 28, 0, 0, TAU); c.fillStyle = '#FFCF4A'; c.fill(); c.beginPath(); c.ellipse(s * 4, 0, 26, 12, 0, 0, TAU); c.fillStyle = '#E8A800'; c.fill(); c.restore(); });
      circ(c, 0, -50, 22, '#F5B800'); c.restore();
      c.restore();
      const p = pop(t, to + .15, 13, .5); if (t > to + .15) { const py = lerp(560, 380, Math.min(1, p.k)); wk(c, 512, py, p, () => { const w2 = TFW(c, 'Подарок', 66, 'Montserrat-Black') + 100; c.save(); sh(c, .8); rr(c, 512 - w2 / 2, py - 52, w2, 104, 52); c.fillStyle = '#fff'; c.fill(); c.restore(); TF(c, 'Подарок', 512, py, 66, '#E62550', 'Montserrat-Black'); }); }
    });
    confetti(c, 512, 540, t, to + .05, 30, 460);
  });

  // 10. Промокод копируется
  A('f-sale-promo', 'Промокод: копируется по нажатию', GS, 4, (c, t, D) => {
    const e = env(t, D), X = 132, Y = 352, w = 760, h = 300, tc = 1.55, m = spr(t - tc, 15, .7), bx = X + w - 170, by = Y + 100, bw = 120, bh = 150, fl = Math.max(0, 1 - Math.abs(t - tc - .1) / .35);
    wk(c, 512, 512, e, () => {
      c.save(); sh(c, 1); coupon(c, X, Y, w, h, 40, 30); c.fillStyle = '#fff'; c.fill(); c.restore();
      TF(c, 'ПРОМОКОД', X + 50, Y + 58, 26, '#8E8E93', 'Inter-Bold', 'left', 4); TF(c, 'скидка 20 %', X + w - 50, Y + 58, 28, '#FF3B30', 'Inter-Bold', 'right');
      const cx0 = X + 50, cw = bx - 20 - cx0; rr(c, cx0, by, cw, bh, 26); c.fillStyle = lc('#F6F6F9', '#E3EEFF', fl); c.fill(); c.save(); c.setLineDash([12, 10]); c.lineWidth = 4; c.strokeStyle = lc('#C7C7CC', '#0A84FF', fl); c.stroke(); c.restore();
      TF(c, 'КРЕАТОР20', cx0 + cw / 2, by + bh / 2, 62, '#111', 'JetBrainsMono-Bold');
      const pr = prs(t, tc); c.save(); c.translate(bx + bw / 2, by + bh / 2); c.scale(1 - .08 * pr, 1 - .08 * pr); rr(c, -bw / 2, -bh / 2, bw, bh, 28); c.fillStyle = lc('#0A84FF', '#111111', ss(m * 3)); c.fill();
      const f = ss(m * 3); c.save(); c.globalAlpha *= 1 - f; icp(c, 'copy', 0, 0, 58, '#fff'); c.restore(); c.save(); c.globalAlpha *= f; ic(c, 'check', 0, 0, 62 * Math.min(1.1, m), '#fff'); c.restore(); c.restore();
      ripple(c, bx + bw / 2, by + bh / 2, t, tc, '255,255,255', 80, .5);
      const ts = pop(t, tc + .2, 14, .55); if (t > tc + .2) { const ty = Y + h + 80 - 20 * (1 - Math.min(1, ts.k)); wk(c, 512, ty, ts, () => { const s = 'Промокод скопирован', tw = TFW(c, s, 34, 'Inter-Bold') + 120; c.save(); sh(c, .7); rr(c, 512 - tw / 2, ty - 40, tw, 80, 40); c.fillStyle = 'rgba(28,28,30,.96)'; c.fill(); c.restore();
        circ(c, 512 - tw / 2 + 48, ty, 20, '#0A84FF'); ic(c, 'check', 512 - tw / 2 + 48, ty, 28, '#fff'); TF(c, s, 512 - tw / 2 + 82, ty, 34, '#fff', 'Inter-Bold', 'left'); }); }
      const [px, py] = track(t, [[.3, 1080, 1000], [1.35, bx + bw / 2 + 8, by + bh / 2 + 10], [2.6, bx + bw / 2 + 8, by + bh / 2 + 10], [3.2, 1100, 1000]]); cursor(c, px, py, pr);
    });
  });

  // 11. Кнопка «Купить»: товар летит в корзину
  A('f-sale-buy', 'Кнопка «Купить»: товар летит в корзину', GS, 3.5, (c, t, D) => {
    const e = env(t, D), tc = 1.3, cx = 790, cy = 300, bw = 520, by = 600, fq = cl((t - tc) / .55), ar = tc + .55, bump = t > ar ? Math.sin(PI * cl((t - ar) / .3)) : 0;
    wk(c, 512, 512, e, () => {
      const ce = pop(t, .2, 14, .5); ce.k *= 1 + .18 * bump; wk(c, cx, cy, ce, () => { card(c, cx - 76, cy - 76, 152, 152, 76, '#fff', .9); icp(c, 'cart', cx - 2, cy + 2, 80, '#111');
        if (t > ar) { const b = pop(t, ar, 16, .45); wk(c, cx + 52, cy - 52, b, () => { circ(c, cx + 52, cy - 52, 30, '#FF3B30'); c.lineWidth = 5; c.strokeStyle = '#fff'; c.stroke(); TF(c, '1', cx + 52, cy - 52, 34, '#fff', 'Inter-Bold'); }); } });
      morphBtn(c, 512, by, 150, 75,
        { w: bw, bg: '#FF2D55', sh: 1, draw: (c) => { const tw = TFW(c, 'Купить', 62, 'Montserrat-ExtraBold'); icp(c, 'cart', -tw / 2 - 26, 2, 60, '#fff'); TF(c, 'Купить', 26, 0, 62, '#fff', 'Montserrat-ExtraBold'); } },
        { w: bw, bg: '#111', sh: 1, draw: (c) => { const tw = TFW(c, 'В корзине', 56, 'Montserrat-ExtraBold'); ic(c, 'check', -tw / 2 - 24, 0, 60, '#fff'); TF(c, 'В корзине', 26, 0, 56, '#fff', 'Montserrat-ExtraBold'); } }, spr(t - tc, 15, .7), prs(t, tc));
      if (fq > 0 && fq < 1) { const u = eio(fq), x = (1 - u) * (1 - u) * 512 + 2 * (1 - u) * u * 700 + u * u * cx, y = (1 - u) * (1 - u) * by + 2 * (1 - u) * u * 220 + u * u * cy; c.save(); sh(c, .5); circ(c, x, y, 30 - 12 * u, grad(c, x - 30, y - 30, x + 30, y + 30, ['#FFB340', '#FF2D55'])); c.restore(); }
      ripple(c, 512, by, t, tc, '255,255,255', 110, .45);
      const [px, py] = track(t, [[.3, 1080, 1000], [1.15, 560, by + 14], [2.3, 560, by + 14], [2.85, 1100, 1000]]); cursor(c, px, py, prs(t, tc));
    });
  });

  // 12. «Чёрная пятница»: неоновая вывеска
  A('f-sale-bf', '«Чёрная пятница»: неоновая вывеска', GS, 3.5, (c, t, D) => {
    const e = env(t, D), X = 132, Y = 292, w = 760, h = 440;
    const on = (t0) => { const q = t - t0; return q < 0 ? 0 : q < .07 ? 1 : q < .13 ? .15 : q < .25 ? 1 : q < .3 ? .3 : 1; };
    wk(c, 512, 512, e, () => { c.save(); sh(c, 1.1); rr(c, X, Y, w, h, 48); c.fillStyle = '#0B0B10'; c.fill(); c.restore();
      c.save(); rr(c, X, Y, w, h, 48); c.clip(); const g = c.createRadialGradient(512, 480, 0, 512, 480, 420); g.addColorStop(0, `rgba(255,45,150,${.22 * on(.3)})`); g.addColorStop(1, 'rgba(255,45,150,0)'); c.fillStyle = g; c.fillRect(X, Y, w, h); c.restore();
      rr(c, X + 1, Y + 1, w - 2, h - 2, 47); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.12)'; c.stroke();
      let px = 96; const tw = Math.max(TFW(c, 'ЧЁРНАЯ', px, 'Unbounded-ExtraBold'), TFW(c, 'ПЯТНИЦА', px, 'Unbounded-ExtraBold')); if (tw > 640) px *= 640 / tw;
      [['ЧЁРНАЯ', Y + 150, .3], ['ПЯТНИЦА', Y + 270, .45]].forEach(([s, y, t0]) => { const a = on(t0); if (a <= 0) return; c.save(); c.globalAlpha *= .25 + .75 * a;
        if (a > .5) { c.shadowColor = '#FF2D96'; c.shadowBlur = 50; TF(c, s, 512, y, px, '#FF7AC0', 'Unbounded-ExtraBold'); c.shadowBlur = 18; } TF(c, s, 512, y, px, a > .5 ? '#fff' : '#5A2A45', 'Unbounded-ExtraBold'); c.restore(); });
      c.save(); c.globalAlpha *= ss((t - .9) / .3); TF(c, 'только 3 дня', 512, Y + 368, 32, 'rgba(255,255,255,.6)', 'Inter-Medium'); c.restore();
      const b = pop(t, 1.3, 14, .45); b.r = -.12; wk(c, X + w - 80, Y + h - 10, b, () => { const s = '−70 %', bw = TFW(c, s, 70, 'Montserrat-Black') + 70, x = X + w - 80, y = Y + h - 10; c.save(); sh(c, .8); rr(c, x - bw / 2, y - 56, bw, 112, 30); c.fillStyle = '#FFD60A'; c.fill(); c.restore(); TF(c, s, x, y, 70, '#111', 'Montserrat-Black'); });
    });
    burst(c, X + w - 80, Y + h - 10, t, 1.32, { n: 10, R: 150, s: 9, ring: false, lines: true, cols: ['#FFD60A', '#FF2D96'] });
  });

  // 13. «Ссылка в шапке профиля»
  A('f-sale-bio', '«Ссылка в шапке профиля»: ссылка выделяется', GS, 3.5, (c, t, D) => {
    const e = env(t, D), X = 112, Y = 232, w = 800, h = 420, hl = eo(cl((t - 1.0) / .4));
    wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 48);
      const ax = X + 112, ay = Y + 112, gr = c.createConicGradient(-PI / 2, ax, ay); ['#FEDA75', '#FA7E1E', '#D62976', '#962FBF', '#4F5BD5', '#FEDA75'].forEach((s, i) => gr.addColorStop(i / 5, s));
      circ(c, ax, ay, 76); c.fillStyle = gr; c.fill(); circ(c, ax, ay, 69, '#fff'); avatar(c, ax, ay, 63, '#FFB199', '#FF6A88');
      TF(c, 'твой_ник', X + 222, Y + 88, 40, '#111', 'Inter-Bold', 'left'); TF(c, '128 публикаций · 12,5 тыс. подписчиков', X + 222, Y + 136, 25, '#8E8E93', 'Inter-Medium', 'left');
      TF(c, 'Эксперт по монтажу · учу снимать Reels', X + 50, Y + 250, 30, '#111', 'Inter-Medium', 'left');
      const ly = Y + 326, lt = 'твой-сайт.рф/курс', lw = TFW(c, lt, 34, 'Inter-Bold') + 94;
      if (hl > 0) { rr(c, X + 36, ly - 34, lw * hl, 68, 16); c.fillStyle = 'rgba(255,214,10,.55)'; c.fill(); }
      ic(c, 'link', X + 74, ly, 42, '#0A6CFF', 0, -.6); TF(c, lt, X + 106, ly, 34, '#0A6CFF', 'Inter-Bold', 'left');
      if (t > 1.3) { const q = eio(cl((t - 1.3) / .4)); c.save(); c.strokeStyle = '#FF3B30'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); for (let i = 0; i <= 50 * q; i++) { const a = -2.6 + i / 50 * TAU * 1.05, x = X + 36 + lw / 2 + Math.cos(a) * (lw / 2 + 24), y = ly + Math.sin(a) * 50 - i * .2; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.restore(); }
      const p = pop(t, 1.6, 14, .5), bob = t > 1.6 ? -Math.abs(Math.sin((t - 1.6) * 4)) * 10 : 0; wk(c, 512, 770, p, () => { const s = 'Ссылка в шапке профиля', tw = TFW(c, s, 42, 'Inter-Bold') + 140, y = 770 + bob; c.save(); sh(c, .8); rr(c, 512 - tw / 2, y - 48, tw, 96, 48); c.fillStyle = '#111'; c.fill(); c.restore();
        circ(c, 512 - tw / 2 + 52, y, 26, '#fff'); icp(c, 'up', 512 - tw / 2 + 52, y - 2, 46, '#111'); TF(c, s, 512 - tw / 2 + 94, y, 42, '#fff', 'Inter-Bold', 'left'); });
    });
  });

  // 14. «Предзапись»: лист ожидания растёт
  A('f-sale-prereg', '«Предзапись»: лист ожидания растёт', GS, 3.5, (c, t, D) => {
    const e = env(t, D), X = 172, Y = 312, w = 680, h = 400, tc = 2.5, n = Math.round(128 * eo(cl((t - .6) / 1.4))) + (t >= tc ? 1 : 0);
    const AV = [['#FF9A8B', '#FF6A88', 'А'], ['#A18CD1', '#7B61FF', 'М'], ['#5AC8FA', '#0A84FF', 'К'], ['#FFC371', '#FF7A45', 'Д'], ['#F78CA0', '#C04BFF', 'Е']];
    wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 52);
      const bt = 'ПРЕДЗАПИСЬ', bw = TFW(c, bt, 22, 'Inter-Bold', 3) + 40; rr(c, X + 50, Y + 42, bw, 44, 22); c.fillStyle = '#F0EBFF'; c.fill(); TF(c, bt, X + 50 + bw / 2, Y + 64, 22, '#7B61FF', 'Inter-Bold', 'center', 3);
      TF(c, 'Лист ожидания', X + 50, Y + 130, 46, '#111', 'Inter-Bold', 'left');
      const ay = Y + 222, ax = X + 94;
      for (let i = AV.length - 1; i >= -1; i--) { const ti = .45 + (i < 0 ? 5 : i) * .1, k = spr(t - ti, 15, .5), x = ax + (i < 0 ? 5 : i) * 64 + (1 - Math.min(1, k)) * 60; if (t < ti) continue;
        c.save(); c.globalAlpha *= cl((t - ti) / .1); circ(c, x, ay, 47, '#fff'); if (i >= 0) avatar(c, x, ay, 42, AV[i][0], AV[i][1], AV[i][2]); else { circ(c, x, ay, 42, '#F2F2F7'); TF(c, '+' + n, x, ay, n > 99 ? 24 : 28, '#111', 'Inter-Bold'); } c.restore(); }
      c.save(); c.globalAlpha *= ss((t - 1.0) / .3); TF(c, 'уже в списке', ax + 5 * 64 + 66, ay, 28, '#8E8E93', 'Inter-Medium', 'left'); c.restore();
      morphBtn(c, 512, Y + 320, 84, 24,
        { w: w - 100, bg: '#7B61FF', draw: c => TF(c, 'Записаться', 0, 0, 36, '#fff', 'Inter-Bold') },
        { w: w - 100, bg: '#F0EBFF', draw: c => { const tw = TFW(c, 'Ты в списке', 36, 'Inter-Bold'); ic(c, 'check', -tw / 2 - 12, 0, 40, '#7B61FF'); TF(c, 'Ты в списке', 18, 0, 36, '#7B61FF', 'Inter-Bold'); } }, spr(t - tc, 15, .7), prs(t, tc) * .5);
      touch(c, 560, Y + 330, t, tc, 46);
    });
  });

  // 15. «Последний день»: будильник звенит
  A('f-sale-lastday', '«Последний день»: будильник звенит', GS, 3, (c, t, D) => {
    const e = env(t, D), ring = t > .5 ? cl((t - .5) / .2) : 0, rot = Math.sin(t * 52) * .075 * ring, cx = 512, cy = 410;
    wk(c, 512, 512, e, () => {
      if (ring > 0) { c.save(); c.strokeStyle = '#fff'; c.lineCap = 'round'; c.lineWidth = 10; sh(c, .4); [-1, 1].forEach(s => [215, 255].forEach((r, i) => { c.globalAlpha = e.a * ring * (.45 + .55 * Math.abs(Math.sin(t * 9 + i + s))); c.beginPath(); c.arc(cx, cy, r, s < 0 ? PI * .86 : -PI * .14, s < 0 ? PI * 1.14 : PI * .14); c.stroke(); })); c.restore(); }
      c.save(); c.translate(cx, cy + 150); c.rotate(rot); c.translate(-cx, -(cy + 150));
      [-1, 1].forEach(s => { c.save(); c.translate(cx + s * 98, cy + 150); c.rotate(s * -.5); rr(c, -11, -10, 22, 56, 11); c.fillStyle = '#2A2A30'; c.fill(); c.restore(); });
      const hm = Math.sin(t * 52) * 34 * ring; c.save(); c.strokeStyle = '#2A2A30'; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx, cy - 162); c.lineTo(cx + hm * .5, cy - 196); c.stroke(); circ(c, cx + hm * .5, cy - 200, 14, '#2A2A30'); c.restore();
      [-1, 1].forEach(s => { c.save(); c.translate(cx + s * 112, cy - 128); c.rotate(s * .62); c.beginPath(); c.arc(0, 0, 62, PI, 0); c.closePath(); c.fillStyle = grad(c, -62, -62, 62, 0, ['#FF7A70', '#E0262B']); c.fill(); rr(c, -16, -2, 32, 26, 6); c.fillStyle = '#2A2A30'; c.fill(); c.restore(); });
      c.save(); sh(c, 1); circ(c, cx, cy, 160, grad(c, cx - 160, cy - 160, cx + 160, cy + 160, ['#FF6A60', '#D81E2B'])); c.restore();
      circ(c, cx, cy, 126, '#fff');
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r0 = i % 3 ? 108 : 98; c.strokeStyle = i % 3 ? '#C7C7CC' : '#111'; c.lineWidth = i % 3 ? 4 : 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * 116, cy + Math.sin(a) * 116); c.stroke(); }
      const hand = (a, L, lw, col) => { c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.sin(a) * L, cy - Math.cos(a) * L); c.stroke(); };
      hand(-.06, 62, 12, '#111'); hand(-.52, 92, 8, '#111'); hand(t * 4, 100, 4, '#FF3B30'); circ(c, cx, cy, 11, '#111'); circ(c, cx, cy, 4, '#FF3B30');
      c.restore();
      const p = pop(t, .35, 14, .5); wk(c, 512, 720, p, () => { const s = 'Последний день'; let px = 60; const tw = TFW(c, s, px, 'Montserrat-ExtraBold'), bw = tw + 120; c.save(); sh(c, .8); rr(c, 512 - bw / 2, 720 - 56, bw, 112, 56); c.fillStyle = '#111'; c.fill(); c.restore(); TF(c, s, 512, 720, px, '#fff', 'Montserrat-ExtraBold'); });
    });
  });

  // 16. Монеты с рублём падают в стопки
  A('f-sale-coins', 'Монеты падают в стопки, «+150 000 ₽»', GS, 3.5, (c, t, D) => {
    const e = env(t, D), xs = [340, 512, 684], base = 820, th = 24, rx = 82, ry = 26, seq = [1, 0, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 0, 2, 1], L = i => .45 + i * .11, fall = .42;
    const lvl = seq.map((s, i) => seq.slice(0, i).filter(x => x === s).length);
    wk(c, 512, 600, e, () => {
      xs.forEach((x, si) => { const f0 = seq.indexOf(si); c.save(); c.globalAlpha *= .25 * cl((t - L(f0) + .05) / .15); c.beginPath(); c.ellipse(x, base + 6, rx * 1.15, ry * 1.1, 0, 0, TAU); c.fillStyle = '#000'; c.fill(); c.restore(); });
      seq.forEach((s, i) => { if (t < L(i)) return; const y = base - th - lvl[i] * th, sq = Math.sin(PI * cl((t - L(i)) / .15)) * 4; coinDisk(c, xs[s], y + sq, rx, ry, th); });
      seq.forEach((s, i) => { const t0 = L(i) - fall; if (t < t0 || t >= L(i)) return; const q = (t - t0) / fall, yL = base - th - lvl[i] * th - 30, y = lerp(150, yL, q * q); c.save(); c.globalAlpha *= cl(q / .2); coinFace(c, xs[s], y, 58, Math.abs(Math.cos(q * 7 + i))); c.restore(); });
      const p = pop(t, 2.15, 14, .5); wk(c, 512, 330, p, () => { const s = '+150 000 ₽', tw = TFW(c, s, 70, 'Montserrat-Black') + 100; c.save(); sh(c, .9); rr(c, 512 - tw / 2, 330 - 60, tw, 120, 60); c.fillStyle = '#fff'; c.fill(); c.restore(); TF(c, s, 512, 330, 70, '#111', 'Montserrat-Black'); });
      [[300, 260, .0], [740, 300, .2], [690, 200, .4]].forEach(([x, y, d], i) => { const k = t > 2.2 + d ? Math.sin(PI * cl((t - 2.2 - d) / .6)) : 0; star4(c, x, y, 26 * k, i % 2 ? '#fff' : '#FFD60A'); });
    });
  });

  // 17. Отзыв клиента со звёздами
  A('f-sale-review', 'Отзыв клиента: звёзды и текст печатается', GS, 4, (c, t, D) => {
    const e = env(t, D), X = 132, Y = 342, w = 760, h = 340, s = 'Окупила курс за неделю. Теперь монтирую в 3 раза быстрее!', n = Math.floor(cl((t - 1.25) / 1.7) * s.length);
    wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 48);
      TF(c, '”', X + w - 80, Y + 110, 230, '#EEE9FF', 'PlayfairDisplay-Bold');
      avatar(c, X + 100, Y + 100, 52, '#FFB199', '#FF6A88', 'М'); TF(c, 'Марина К.', X + 176, Y + 78, 36, '#111', 'Inter-Bold', 'left');
      for (let i = 0; i < 5; i++) { const x = X + 196 + i * 46, y = Y + 124, ti = .5 + i * .11, on = t >= ti, k = on ? .6 + .4 * spr(t - ti, 17, .4) : 1; c.save(); c.translate(x, y); c.scale(k, k); ic(c, 'star', 0, 0, 42, on ? '#FFB800' : '#E5E5EA'); c.restore(); }
      const lines = wrap(c, s, 36, 'm', w - 120); let left = n; lines.forEach((l, i) => { const part = l.slice(0, Math.max(0, left)); left -= l.length + 1; if (part) TF(c, part, X + 60, Y + 230 + i * 54, 36, '#111', 'Inter-Medium', 'left');
        if (left < 0 && left > -l.length - 2 && n < s.length && part.length < l.length && Math.floor(t * 3) % 2 === 0) { const cw = TFW(c, part, 36, 'Inter-Medium'); c.fillStyle = '#7B61FF'; c.fillRect(X + 64 + cw, Y + 210 + i * 54, 4, 42); left = -999; } });
    });
  });

  // 18. «Оплата прошла»
  A('f-sale-paid', '«Оплата прошла»: галочка и сумма', GS, 3.5, (c, t, D) => {
    const e = env(t, D), X = 212, Y = 232, w = 600, h = 560, cx = 512, cy = Y + 160, td = 1.0, f = ss((t - td) / .2);
    wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 52);
      if (t < td + .2) { c.save(); c.globalAlpha *= 1 - f; c.lineWidth = 12; c.strokeStyle = '#E8F1FF'; circ(c, cx, cy, 86); c.stroke(); c.strokeStyle = '#0A84FF'; c.lineCap = 'round'; c.beginPath(); c.arc(cx, cy, 86, t * 7, t * 7 + 1.6); c.stroke(); c.restore(); }
      if (t >= td) { const k = spr(t - td, 15, .45); c.save(); c.translate(cx, cy); c.scale(k, k); circ(c, 0, 0, 92, grad(c, -92, -92, 92, 92, ['#3A9BFF', '#5E5CE6'])); c.restore(); checkStroke(c, cx, cy + 4, 110, eo(cl((t - td - .08) / .3)), '#fff', 17); }
      c.save(); c.globalAlpha *= 1 - f; TF(c, 'Обработка платежа…', 512, Y + 330, 34, '#8E8E93', 'Inter-Medium'); c.restore();
      const a = pop(t, td + .15, 14, .6); if (t > td + .15) { c.save(); c.globalAlpha *= a.a; TF(c, 'Оплата прошла', 512, Y + 330 + 16 * (1 - Math.min(1, a.k)), 44, '#111', 'Inter-Bold'); c.restore(); }
      const b = pop(t, td + .3, 14, .5); wk(c, 512, Y + 425, b, () => TF(c, '+4 990 ₽', 512, Y + 425, 88, '#111', 'Montserrat-Black'));
      c.save(); c.globalAlpha *= ss((t - td - .45) / .3); TF(c, 'Курс «Монтаж с нуля»', 512, Y + 500, 28, '#8E8E93', 'Inter-Medium'); c.restore();
    });
    burst(c, 512, 232 + 160, t, td + .05, { n: 12, R: 135, s: 7, ring: false, lines: true, cols: ['#0A84FF', '#5E5CE6', '#FFD60A'] });
  });

  // 19. Ценник «−30 %» качается на нитке
  A('f-sale-tag', 'Ценник «−30 %» качается на нитке', GS, 3, (c, t, D) => {
    const e = env(t, D), px0 = 512, py0 = 190, ang = .5 * Math.exp(-1.5 * t) * Math.cos(5.4 * t) + .015 * Math.sin(t * 3);
    wk(c, px0, py0, e, () => {
      c.save(); c.translate(px0, py0); c.rotate(ang);
      c.strokeStyle = 'rgba(255,255,255,.92)'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 150); c.stroke();
      const W = 150, top = 110, bot = 560; c.beginPath(); c.moveTo(-W, top + 80); c.lineTo(-W + 80, top); c.lineTo(W - 80, top); c.lineTo(W, top + 80); c.lineTo(W, bot - 30); c.arcTo(W, bot, W - 30, bot, 30); c.lineTo(-W + 30, bot); c.arcTo(-W, bot, -W, bot - 30, 30); c.closePath();
      c.save(); sh(c, 1); c.lineJoin = 'round'; c.lineWidth = 24; c.strokeStyle = '#FFC21A'; c.stroke(); c.fillStyle = grad(c, -W, top, W, bot, ['#FFE14D', '#FFC21A']); c.fill(); c.restore();
      circ(c, 0, 158, 20, '#fff'); c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,.12)'; c.stroke();
      TF(c, 'СКИДКА', 0, 262, 40, '#111', 'Inter-Bold', 'center', 5); let px = 108; const tw = TFW(c, '−30%', px, 'Montserrat-Black'); if (tw > 270) px *= 270 / tw; TF(c, '−30%', 0, 360, px, '#111', 'Montserrat-Black');
      c.save(); c.setLineDash([8, 10]); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 3; c.beginPath(); c.moveTo(-W + 30, 440); c.lineTo(W - 30, 440); c.stroke(); c.restore();
      TF(c, 'до 15 ноября', 0, 494, 30, '#111', 'Inter-Medium'); c.restore();
      c.save(); sh(c, .5); circ(c, px0, py0, 15, grad(c, px0 - 15, py0 - 15, px0 + 15, py0 + 15, ['#8A8A92', '#2A2A30'])); c.restore(); circ(c, px0 - 4, py0 - 4, 4, 'rgba(255,255,255,.7)');
    });
  });

  // 20. Тариф: пункты отмечаются, кнопка «Купить»
  A('f-sale-plan', 'Карточка тарифа: пункты отмечаются, кнопка «Купить»', GS, 4, (c, t, D) => {
    const e = env(t, D), X = 262, Y = 162, w = 500, h = 700, tc = 3.0, items = ['Все уроки курса', 'Обратная связь', 'Чат с креаторами', 'Сертификат'];
    wk(c, 512, 512, e, () => { card(c, X, Y, w, h, 52);
      const bt = 'Выгодно', bw = TFW(c, bt, 28, 'Inter-Bold') + 56; c.save(); sh(c, .5); rr(c, 512 - bw / 2, Y - 28, bw, 56, 28); c.fillStyle = grad(c, 512 - bw / 2, 0, 512 + bw / 2, 0, ['#FF7A45', '#FF2D96']); c.fill(); c.restore(); TF(c, bt, 512, Y, 28, '#fff', 'Inter-Bold');
      TF(c, 'Тариф PRO', 512, Y + 92, 44, '#111', 'Inter-Bold');
      TF(c, '14 990 ₽', 512, Y + 180, 82, '#111', 'Montserrat-Black');
      const ow = TFW(c, '19 990 ₽', 30, 'Inter-Medium'); TF(c, '19 990 ₽', 512, Y + 244, 30, '#AEAEB2', 'Inter-Medium'); c.strokeStyle = '#FF3B30'; c.lineWidth = 4; c.beginPath(); c.moveTo(512 - ow / 2 - 6, Y + 247); c.lineTo(512 + ow / 2 + 6, Y + 243); c.stroke();
      c.fillStyle = '#ECECF0'; c.fillRect(X + 50, Y + 292, w - 100, 2);
      items.forEach((s, i) => { const ti = .6 + i * .24, y = Y + 352 + i * 66, k = spr(t - ti, 16, .5), a = cl((t - ti) / .12); if (t < ti) { circ(c, X + 74, y, 20, '#F2F2F7'); c.save(); c.globalAlpha *= .35; TF(c, s, X + 112, y, 31, '#111', 'Inter-Medium', 'left'); c.restore(); return; }
        c.save(); c.translate(X + 74, y); c.scale(k, k); circ(c, 0, 0, 20, grad(c, -20, -20, 20, 20, ['#3A9BFF', '#7B61FF'])); ic(c, 'check', 0, 1, 28, '#fff'); c.restore();
        c.save(); c.globalAlpha *= .35 + .65 * a; TF(c, s, X + 112 + 14 * (1 - eo(a)), y, 31, '#111', 'Inter-Medium', 'left'); c.restore(); });
      const pr = prs(t, tc), by = Y + h - 82; c.save(); c.translate(512, by); c.scale(1 - .05 * pr, 1 - .05 * pr); sh(c, .6); rr(c, -(w - 100) / 2, -40, w - 100, 80, 40); c.fillStyle = grad(c, -200, 0, 200, 0, ['#2F80FF', '#7B61FF']); c.fill(); nosh(c); c.clip(); shine(c, -(w - 100) / 2, -40, w - 100, 80, t, .8, 1.6, .4); c.restore();
      TF(c, 'Купить', 512, by, 38, '#fff', 'Inter-Bold');
      touch(c, 548, by + 10, t, tc, 46);
    });
  });
})(window);

/* ---- styles7d.js ---- */
/* Футажи: новые категории (часть d) — рисуют инструментами window.KKFOOT из styles6.js
   «Стрелки и указатели» (+13, f-ar-*) и «Выделение маркером» (20, f-mk-*). */
(function (G) {
  const F = G.KKFOOT; if (!F) return;
  const { A, cl, eo, eio, ein, lerp, ss, TAU, spr, env, wk, prs, track, rr, T, TW, sh, nosh, card, circ, grad, ic, ripple, burst } = F;

  /* ---------- общие инструменты части d ---------- */
  // текст любым шрифтом из списка
  function TF(c, s, x, y, px, col, font, al = 'center') { c.font = `${px}px "${font}"`; c.fillStyle = col; c.textAlign = al; c.textBaseline = 'middle'; c.fillText(s, x, y + px * .04); }
  // детерминированный шум: hsh — 0..1, nz — плавный -1..1
  const hsh = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const nz = (x, sd = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hsh(i + sd * 17.31), hsh(i + 1 + sd * 17.31), u) * 2 - 1; };
  // уход в конце: альфа 1 → 0 за out секунд
  const fo = (t, D, out = .3) => 1 - ein(cl((t - (D - out)) / out));
  // мягкая тень маркера (чтобы читалось на любом видео)
  const ms = (c, k = 1) => { c.shadowColor = `rgba(0,0,0,${.3 * k})`; c.shadowBlur = 18 * k; c.shadowOffsetY = 6 * k; };
  // сплайн Катмулла — Рома через опорные точки
  function cr(P, per = 14) { const o = []; for (let i = 0; i < P.length - 1; i++) { const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let j = 0; j < per; j++) { const s = j / per, s2 = s * s, s3 = s2 * s; o.push([0, 1].map(k => .5 * (2 * p1[k] + (-p0[k] + p2[k]) * s + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * s2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * s3))); } }
    o.push(P[P.length - 1].slice()); return o; }
  const seg = (x0, y0, x1, y1, n = 30) => { const o = []; for (let i = 0; i <= n; i++) o.push([lerp(x0, x1, i / n), lerp(y0, y1, i / n)]); return o; };
  // рука дрожит: смещение точек по нормали плавным шумом
  function wob(P, amp, freq = 1, sd = 0) { let acc = 0; return P.map((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    if (i) acc += Math.hypot(p[0] - P[i - 1][0], p[1] - P[i - 1][1]); const d = nz(acc / 100 * freq, sd) * amp; return [p[0] - dy / l * d, p[1] + dx / l * d]; }); }
  function lens(P) { const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return L; }
  // точка и направление на доле u пути
  function at(P, u, L = lens(P)) { const tot = L[L.length - 1], s = cl(u) * tot; let i = 1; while (i < L.length - 1 && L[i] < s) i++;
    const k = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1), a = P[i - 1], b = P[i]; return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), Math.atan2(b[1] - a[1], b[0] - a[0])]; }
  // кисть-маркер: лента переменной толщины от доли a до b, круглые концы, нажим тоньше в начале и в конце
  function brush(c, P, a, b, w, col, o = {}) { if (b - a <= .001) return; const L = lens(P), tot = L[L.length - 1], s0 = a * tot, s1 = b * tot;
    const Q = []; const push = (x, y, s) => { const q = Q[Q.length - 1]; if (!q || Math.hypot(x - q[0], y - q[1]) > .6) Q.push([x, y, s]); };
    const p0 = at(P, a, L); push(p0[0], p0[1], s0); for (let i = 1; i < P.length - 1; i++) if (L[i] > s0 && L[i] < s1) push(P[i][0], P[i][1], L[i]); const p1 = at(P, b, L); push(p1[0], p1[1], s1);
    if (Q.length < 2) return;
    const ta = o.ta ?? .1, tb = o.tb ?? .14, wf = s => { const u = s / tot; return w * (.5 + .5 * Math.min(1, u / ta)) * (.45 + .55 * Math.min(1, (1 - u) / tb)) * (1 + .08 * nz(u * 6, o.sd || 0)); };
    const Lp = [], Rp = [], ang = [];
    for (let i = 0; i < Q.length; i++) { const p = Q[Math.max(0, i - 1)], n = Q[Math.min(Q.length - 1, i + 1)], an = Math.atan2(n[1] - p[1], n[0] - p[0]), r = wf(Q[i][2]) / 2;
      ang.push(an); Lp.push([Q[i][0] - Math.sin(an) * r, Q[i][1] + Math.cos(an) * r]); Rp.push([Q[i][0] + Math.sin(an) * r, Q[i][1] - Math.cos(an) * r]); }
    const e = Q.length - 1; c.beginPath(); c.moveTo(Lp[0][0], Lp[0][1]); for (let i = 1; i <= e; i++) c.lineTo(Lp[i][0], Lp[i][1]);
    if (o.flat) { for (let i = e; i >= 0; i--) c.lineTo(Rp[i][0], Rp[i][1]); }
    else { c.arc(Q[e][0], Q[e][1], wf(Q[e][2]) / 2, ang[e] + Math.PI / 2, ang[e] - Math.PI / 2, true); for (let i = e; i >= 0; i--) c.lineTo(Rp[i][0], Rp[i][1]); c.arc(Q[0][0], Q[0][1], wf(Q[0][2]) / 2, ang[0] - Math.PI / 2, ang[0] + Math.PI / 2, true); }
    c.closePath(); c.fillStyle = col; c.fill(); }
  // мазок с тенью
  function mk(c, P, a, b, w, col, o = {}) { c.save(); if (o.sh !== false) ms(c, o.shk || 1); brush(c, P, a, b, w, col, o); c.restore(); }
  // наконечник стрелки «рукой»: два штриха к острию; p — 0..1
  function head(c, P, p, len, w, col, sp = .52) { if (p <= 0) return; const L = lens(P), [x, y] = at(P, 1, L), [bx, by] = at(P, 1 - Math.min(.2, 40 / L[L.length - 1]), L), a = Math.atan2(y - by, x - bx);
    const w1 = [x - Math.cos(a - sp) * len, y - Math.sin(a - sp) * len], w2 = [x - Math.cos(a + sp) * len * .94, y - Math.sin(a + sp) * len * .94];
    mk(c, wob(seg(w1[0], w1[1], x, y, 12), 3, 1, 3), 0, eio(cl(p * 2)), w, col, { ta: .3, tb: .05 }); mk(c, wob(seg(x, y, w2[0], w2[1], 12), 3, 1, 5), 0, eio(cl(p * 2 - 1)), w, col, { ta: .05, tb: .3 }); }
  // прогресс рисования мазка от t0 длительностью d
  const dr = (t, t0, d) => eio(cl((t - t0) / d));

  // рука-курсор «указательный палец» (как курсор-ладонь в macOS): кончик пальца в (x, y), палец смотрит вверх, rot — поворот
  const HAND = (() => { const p = new Path2D(); p.roundRect(-24, 0, 48, 180, 24); p.roundRect(-28, 112, 168, 160, 46); p.roundRect(20, 94, 46, 92, 23); p.roundRect(62, 104, 44, 84, 22); p.roundRect(102, 120, 38, 72, 19);
    const th = new Path2D(); th.roundRect(-22, -96, 44, 112, 22); p.addPath(th, new DOMMatrix().translate(-6, 214).rotate(-52)); p.roundRect(-4, 252, 130, 46, 14); return p; })();
  function hand(c, x, y, s = 1, rot = 0, pr = 0) { c.save(); c.translate(x, y); c.rotate(rot); const k = s * (1 - .06 * pr); c.scale(k, k); c.translate(0, 8 * pr);
    c.lineJoin = 'round'; c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 30; c.shadowOffsetY = 12; c.lineWidth = 18; c.strokeStyle = '#141416'; c.stroke(HAND); c.restore();
    c.fillStyle = '#fff'; c.fill(HAND); c.strokeStyle = '#141416'; c.lineWidth = 6; c.lineCap = 'round';
    [[64, 118, 150], [104, 126, 162]].forEach(([lx, y0, y1]) => { c.beginPath(); c.moveTo(lx, y0); c.lineTo(lx, y1); c.stroke(); });
    c.beginPath(); c.moveTo(4, 252); c.lineTo(120, 252); c.stroke(); c.restore(); }

  // сплошная стрелка вправо, острие в (0, 0)
  function arrowPath(c, L, sw, hw, hl) { c.beginPath(); c.moveTo(0, 0); c.lineTo(-hl, -hw); c.lineTo(-hl, -sw); c.lineTo(-L, -sw); c.lineTo(-L, sw); c.lineTo(-hl, sw); c.lineTo(-hl, hw); c.closePath(); }
  function solidArrow(c, L, sw, hw, hl, col, lw = 18) { arrowPath(c, L, sw, hw, hl); c.lineJoin = 'round'; c.lineWidth = lw; c.strokeStyle = col; c.fillStyle = col; c.stroke(); c.fill(); }

  /* =====================================================================
     Стрелки и указатели (+13)
     ===================================================================== */
  const AR = 'Стрелки и указатели';

  A('f-ar-squiggle', 'Стрелка-каракуля рисуется', AR, 2.5, (c, t, D) => {
    const P = wob(cr([[170, 760], [290, 640], [400, 690], [500, 560], [610, 610], [700, 450], [800, 330]], 16), 5, 1.2, 1);
    c.save(); c.globalAlpha = fo(t, D); mk(c, P, 0, dr(t, .1, .85), 26, '#fff'); head(c, P, cl((t - .9) / .35), 110, 24, '#fff'); c.restore();
  });

  A('f-ar-loop', 'Стрелка-петля', AR, 2.8, (c, t, D) => {
    const P = wob(cr([[150, 690], [290, 700], [430, 650], [530, 540], [500, 420], [400, 420], [380, 530], [470, 610], [620, 600], [760, 480], [850, 340]], 16), 4, 1, 2);
    c.save(); c.globalAlpha = fo(t, D); mk(c, P, 0, dr(t, .1, 1.1), 24, '#FFD60A'); head(c, P, cl((t - 1.15) / .35), 105, 22, '#FFD60A'); c.restore();
  });

  A('f-ar-four', 'Четыре стрелки сходятся к центру', AR, 3, (c, t, D) => {
    const o = fo(t, D);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, k = spr(t - i * .08, 11, .55), beat = t > .8 ? Math.abs(Math.sin((t - .8) * 4.2)) : 0, d = 236 + (1 - k) * 140 - 30 * beat;
      c.save(); c.globalAlpha = cl((t - i * .08) / .1) * o; c.translate(512 - Math.cos(a) * d, 512 - Math.sin(a) * d); c.rotate(a); sh(c, .8); solidArrow(c, 160, 26, 72, 84, '#fff', 18); c.restore(); }
  });

  A('f-ar-hand', 'Рука-указатель тычет пальцем', AR, 3, (c, t, D) => {
    const e = env(t, D), poke = t > .7 ? Math.pow(Math.abs(Math.sin((t - .7) * 4.4)), 3) : 0, x = 660 + 60 * poke - (1 - cl(spr(t, 10, .6))) * 300, y = 470;
    wk(c, 560, 512, e, () => { hand(c, x, y, 1.3, Math.PI / 2, 0);
      c.save(); c.globalAlpha *= cl(poke * 1.6); c.strokeStyle = '#fff'; c.lineCap = 'round'; c.lineWidth = 13; ms(c, .7);
      [-1, 0, 1].forEach(j => { const a = j * .6, r0 = 46, r1 = 46 + 56 * poke; c.beginPath(); c.moveTo(x + 20 + Math.cos(a) * r0, y + Math.sin(a) * r0); c.lineTo(x + 20 + Math.cos(a) * r1, y + Math.sin(a) * r1); c.stroke(); }); c.restore(); });
  });

  A('f-ar-look', '«Смотри сюда» с лупой', AR, 3.5, (c, t, D) => {
    const e = env(t, D), tc = 1.5, [lx, ly] = track(t, [[0, 330, 600], [.6, 640, 380], [1.1, 470, 300], [tc, 512, 430]]), hov = t > tc ? Math.sin((t - tc) * 3) * 6 : 0, zk = t > tc ? 1 + .12 * Math.sin(Math.PI * cl((t - tc) / .35)) : 1;
    wk(c, 512, 512, e, () => {
      ripple(c, lx, ly + hov, t, tc + .05, '255,255,255', 170, .35);
      c.save(); c.translate(lx, ly + hov); c.scale(zk, zk);
      c.save(); c.rotate(Math.PI / 4); sh(c, .8); rr(c, 118, -24, 150, 48, 24); c.fillStyle = grad(c, 0, -24, 0, 24, ['#3A3A3F', '#151517']); c.fill(); nosh(c); rr(c, 104, -16, 30, 32, 8); c.fillStyle = '#C7C7CC'; c.fill(); c.restore();
      c.save(); ms(c, 1); circ(c, 0, 0, 118); c.lineWidth = 26; c.strokeStyle = '#fff'; c.stroke(); c.restore();
      circ(c, 0, 0, 104, 'rgba(255,255,255,.14)'); c.save(); c.lineWidth = 12; c.lineCap = 'round'; c.strokeStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(0, 0, 76, Math.PI * 1.08, Math.PI * 1.42); c.stroke(); c.restore();
      c.restore();
      const lk = spr(t - tc - .1, 14, .55), w = TW(c, 'Смотри сюда', 52) + 150;
      wk(c, 512, 720, { k: lk, a: cl((t - tc - .1) / .08) }, () => { card(c, 512 - w / 2, 720 - 56, w, 112, 56, '#fff', .9); ic(c, 'eye', 512 - w / 2 + 70, 720, 56, '#0A84FF'); T(c, 'Смотри сюда', 512 - w / 2 + 116, 720, 52, '#111', 'b', 'left'); });
    });
  });

  A('f-ar-target', 'Прицел наводится и фиксирует', AR, 3, (c, t, D) => {
    const o = fo(t, D), k = spr(t - .05, 8, .62), R = 150 + 260 * (1 - k), rot = (1 - k) * 1.6, lock = 1.15, lk = spr(t - lock, 16, .45), a0 = cl((t - .05) / .12) * o;
    c.save(); c.globalAlpha = a0; c.translate(512, 512);
    c.save(); c.rotate(rot); ms(c, .8); c.strokeStyle = '#fff'; c.lineWidth = 14; c.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .22; c.beginPath(); c.arc(0, 0, R, a, a + Math.PI / 2 - .44); c.stroke(); }
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; c.beginPath(); c.moveTo(Math.cos(a) * (R - 46), Math.sin(a) * (R - 46)); c.lineTo(Math.cos(a) * (R + 46), Math.sin(a) * (R + 46)); c.stroke(); }
    c.restore();
    c.save(); ms(c, .6); circ(c, 0, 0, 20 + 8 * (t > lock ? Math.sin(Math.PI * cl((t - lock) / .3)) : 0), '#FF3B30'); c.restore();
    if (t > lock) { const g = 250 - 50 * Math.min(1.1, lk), L = 70; c.save(); c.globalAlpha *= cl((t - lock) / .08); ms(c, .7); c.strokeStyle = '#FF3B30'; c.lineWidth = 16; c.lineCap = 'round'; c.lineJoin = 'round';
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => { c.beginPath(); c.moveTo(sx * g, sy * (g - L)); c.lineTo(sx * g, sy * g); c.lineTo(sx * (g - L), sy * g); c.stroke(); }); c.restore();
      ripple(c, 0, 0, t, lock, '255,59,48', 220, .35); }
    c.restore();
  });

  A('f-ar-boomerang', 'Стрелка-бумеранг: туда и обратно', AR, 3, (c, t, D) => {
    const P = []; for (let i = 0; i <= 24; i++) P.push([lerp(200, 600, i / 24), 660]); for (let i = 1; i <= 40; i++) { const a = Math.PI / 2 - i / 40 * Math.PI; P.push([600 + Math.cos(a) * 150, 510 + Math.sin(a) * 150]); }
    for (let i = 1; i <= 20; i++) P.push([lerp(600, 380, i / 20), 360]);
    const p = eio(cl((t - .1) / 1.0)), L = lens(P), [hx, hy, ha] = at(P, p, L), pk = t > 1.1 ? spr(t - 1.1, 15, .4) : 0, o = fo(t, D), nud = t > 1.4 ? -Math.max(0, Math.sin((t - 1.4) * 5)) * 18 : 0;
    if (p <= .001) return; c.save(); c.globalAlpha = o * cl((t - .1) / .08); c.translate(nud, 0);
    const Q = [], s1 = p * L[L.length - 1]; for (let i = 0; i < P.length && L[i] <= s1; i++) Q.push(P[i]); Q.push([hx, hy]);
    c.save(); sh(c, .8); c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 62; c.strokeStyle = grad(c, 200, 0, 750, 0, ['#7B61FF', '#2F80FF']); c.beginPath(); Q.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke(); c.restore();
    c.save(); c.globalAlpha *= .35; c.lineCap = 'round'; c.lineWidth = 10; c.strokeStyle = '#fff'; c.beginPath(); Q.forEach((q, i) => i ? c.lineTo(q[0], q[1] - 14) : c.moveTo(q[0], q[1] - 14)); c.stroke(); c.restore();
    const hk = .55 + .45 * Math.max(pk, cl(p * 1.2)); c.save(); c.translate(hx, hy); c.rotate(ha); c.scale(hk, hk); c.translate(70, 0); sh(c, .6); arrowPath(c, 70, 0, 78, 92); c.lineJoin = 'round'; c.lineWidth = 22; c.strokeStyle = c.fillStyle = '#2F80FF'; c.stroke(); c.fill(); c.restore();
    c.restore();
  });

  A('f-ar-path', 'Пунктирный маршрут со стрелкой', AR, 3, (c, t, D) => {
    const P = cr([[170, 780], [300, 640], [470, 700], [560, 560], [500, 420], [620, 300], [800, 290]], 18), L = lens(P), tot = L[L.length - 1], p = eio(cl((t - .2) / 1.3)), o = fo(t, D);
    c.save(); c.globalAlpha = o * cl(t / .1);
    c.save(); ms(c, .8); circ(c, 170, 780, 26, '#fff'); circ(c, 170, 780, 11, '#0A84FF'); c.restore();
    c.save(); ms(c, .7); for (let s = 52; s < p * tot - 40; s += 34) { const [x, y] = at(P, s / tot, L); circ(c, x, y, 9, '#fff'); } c.restore();
    const ek = spr(t - 1.45, 14, .45);
    if (t > 1.45) { ripple(c, 830, 290, t, 1.5, '255,59,48', 110, .4); c.save(); c.translate(830, 290); c.scale(ek, ek); ms(c, 1); circ(c, 0, 0, 40, '#fff'); nosh(c); circ(c, 0, 0, 22, '#FF3B30'); c.restore(); }
    if (p > .06 && p < .999) { const [x, y, a] = at(P, Math.min(p, .93), L); c.save(); c.globalAlpha *= ss((p - .06) / .06) * (1 - ss((p - .9) / .09)); c.translate(x, y); c.rotate(a); ms(c, .8); c.strokeStyle = '#fff'; c.lineWidth = 16; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(-34, -34); c.lineTo(0, 0); c.lineTo(-34, 34); c.stroke(); c.restore(); }
    c.restore();
  });

  A('f-ar-pin', 'Пин «Тут!» падает и пружинит', AR, 3, (c, t, D) => {
    const gy = 720, o = fo(t, D), k = spr(t - .1, 10, .38), y = gy - 560 * (1 - k), land = t > .32 ? Math.max(0, Math.sin((t - .32) * 14)) * Math.exp(-(t - .32) * 6) : 0, sq = 1 - .14 * land;
    c.save(); c.globalAlpha = o * cl((t - .1) / .08);
    c.save(); c.globalAlpha *= .35 * cl(k); c.fillStyle = '#000'; c.filter = 'blur(10px)'; c.beginPath(); c.ellipse(512, gy + 6, 70 * (.5 + .5 * cl(k)), 18, 0, 0, TAU); c.fill(); c.restore();
    ripple(c, 512, gy, t, .34, '255,255,255', 120, .35);
    if (t > .34) { const q = cl((t - .34) / .7); c.save(); c.globalAlpha *= (1 - q) * .7; c.strokeStyle = '#fff'; c.lineWidth = 6; c.beginPath(); c.ellipse(512, gy, 60 + 160 * eo(q), 16 + 42 * eo(q), 0, 0, TAU); c.stroke(); c.restore(); }
    c.save(); c.translate(512, Math.min(gy, y)); c.scale(1 / Math.sqrt(sq), sq); sh(c, 1);
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-34, -54, -126, -120, -126, -210); c.arc(0, -210, 126, Math.PI, 0); c.bezierCurveTo(126, -120, 34, -54, 0, 0); c.closePath();
    c.fillStyle = grad(c, -126, -336, 126, 0, ['#FF6A5E', '#E3172C']); c.fill(); nosh(c);
    circ(c, 0, -210, 92, '#fff'); TF(c, 'Тут!', 4, -212, 64, '#E3172C', 'Montserrat-Black'); c.restore();
    c.restore();
  });

  A('f-ar-neon', 'Неоновая стрелка загорается', AR, 3, (c, t, D) => {
    const fl = t < .12 ? 0 : t < .18 ? 1 : t < .26 ? .15 : t < .31 ? 1 : t < .36 ? .3 : t < 1.9 || t > 1.98 ? 1 : .45, o = fo(t, D), nud = Math.max(0, Math.sin(t * 4.5)) * 22;
    const path = () => { c.beginPath(); c.moveTo(250, 450); c.lineTo(560, 450); c.lineTo(560, 360); c.lineTo(780, 512); c.lineTo(560, 664); c.lineTo(560, 574); c.lineTo(250, 574); c.closePath(); };
    c.save(); c.globalAlpha = o; c.translate(nud, 0); c.lineJoin = 'round'; c.lineCap = 'round';
    c.save(); c.globalAlpha *= .22; c.strokeStyle = '#FF7AC6'; c.lineWidth = 14; path(); c.stroke(); c.restore();
    c.save(); c.globalAlpha *= fl; c.shadowColor = '#FF2D96'; c.shadowBlur = 60; c.strokeStyle = '#FF2D96'; c.lineWidth = 22; path(); c.stroke(); c.shadowBlur = 26; c.stroke();
    c.shadowBlur = 10; c.shadowColor = '#FFB3DD'; c.strokeStyle = '#FFE3F2'; c.lineWidth = 8; path(); c.stroke(); c.restore();
    c.restore();
  });

  A('f-ar-3d', '3D-стрелка поворачивается', AR, 3.5, (c, t, D) => {
    const e = env(t, D), sp = spr(t - .05, 6, .5), th = (1 - sp) * Math.PI * 1.5 + Math.sin(t * 2.4) * .32 * cl(t - .9), ph = .32 + Math.sin(t * 1.7) * .06, dep = 70;
    const poly = [[230, 0], [40, -170], [40, -72], [-230, -72], [-230, 72], [40, 72], [40, 170]];
    const pr = (x, y, z) => { const x1 = x * Math.cos(th) + z * Math.sin(th), z1 = -x * Math.sin(th) + z * Math.cos(th), y1 = y * Math.cos(ph) - z1 * Math.sin(ph), z2 = y * Math.sin(ph) + z1 * Math.cos(ph), f = 1200 / (1200 + z2); return [512 + x1 * f, 512 + y1 * f, z2]; };
    wk(c, 512, 512, e, () => { const N = 22, front = Math.cos(th) * Math.cos(ph) >= 0 ? -1 : 1, layers = [];
      for (let i = 0; i <= N; i++) layers.push(front * (-dep / 2 + dep * i / N));
      layers.forEach((z, i) => { const pts = poly.map(([x, y]) => pr(x, y, z)), last = i === N; c.save(); if (i === 0) sh(c, 1.1); c.beginPath(); pts.forEach((p, j) => j ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.lineJoin = 'round';
        if (last) { const xs = pts.map(p => p[0]); c.fillStyle = grad(c, Math.min(...xs), 300, Math.max(...xs), 700, ['#FFC83D', '#FF8A00', '#FF5E00']); c.fill(); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke(); }
        else { const sh2 = lerp(.55, .8, i / N); c.fillStyle = `rgb(${Math.round(210 * sh2 + 30)},${Math.round(90 * sh2)},${Math.round(10 * sh2)})`; c.fill(); c.lineWidth = 6; c.strokeStyle = c.fillStyle; c.stroke(); } c.restore(); }); });
  });

  A('f-ar-tap', '«Нажми»: палец жмёт большую кнопку', AR, 3.5, (c, t, D) => {
    const e = env(t, D), t1 = 1.3, t2 = 2.1, pr = Math.max(prs(t, t1), prs(t, t2)), h = 46 * (1 - .75 * pr), bx = 512, by = 640, rx = 200, ry = 70;
    wk(c, 512, 560, e, () => {
      c.save(); sh(c, 1); c.beginPath(); c.ellipse(bx, by + 30, rx + 46, ry + 22, 0, 0, TAU); c.fillStyle = grad(c, 0, by - 40, 0, by + 100, ['#4A4A50', '#18181B']); c.fill(); c.restore();
      c.beginPath(); c.ellipse(bx, by + 14, rx + 18, ry + 8, 0, 0, TAU); c.fillStyle = '#0E0E10'; c.fill();
      c.beginPath(); c.ellipse(bx, by, rx, ry, 0, 0, Math.PI); c.lineTo(bx - rx, by - h); c.ellipse(bx, by - h, rx, ry, 0, Math.PI, 0, true); c.closePath(); c.fillStyle = grad(c, bx - rx, 0, bx + rx, 0, ['#B3121F', '#E2283A', '#B3121F']); c.fill();
      c.beginPath(); c.ellipse(bx, by - h, rx, ry, 0, 0, TAU); c.fillStyle = grad(c, 0, by - h - ry, 0, by - h + ry, ['#FF6B6B', '#FF3347']); c.fill();
      c.save(); c.globalAlpha *= .35; c.beginPath(); c.ellipse(bx - 40, by - h - 24, rx * .55, ry * .32, -.08, 0, TAU); c.fillStyle = '#fff'; c.fill(); c.restore();
      ripple(c, bx, by - h, t, t1, '255,255,255', 150, .18); ripple(c, bx, by - h, t, t2, '255,255,255', 150, .18);
      const lk = spr(t - .25, 14, .5), w = TW(c, 'Нажми', 64) + 100;
      wk(c, 512, 330, { k: lk * (1 + .06 * pr), a: cl((t - .25) / .08) }, () => { card(c, 512 - w / 2, 330 - 60, w, 120, 60, '#fff', .9); T(c, 'Нажми', 512, 330, 64, '#111'); });
      const [fx, fy] = track(t, [[0, 900, 1060], [1.05, bx + 30, by - h - 6], [2.6, bx + 30, by - h - 6], [3.1, 940, 1080]]), dy = 26 * pr;
      hand(c, fx, fy - 20 + dy, 1.05, -.42, pr);
    });
  });

  A('f-ar-swipe', '«Листай»: свайп влево', AR, 3.5, (c, t, D) => {
    const e = env(t, D), cyc = [.5, 1.7], y = 560;
    wk(c, 512, 512, e, () => {
      const w = TW(c, 'Листай', 60) + 200; card(c, 512 - w / 2, 250, w, 116, 58, '#fff', .9); T(c, 'Листай', 512, 308, 60, '#111');
      c.save(); c.strokeStyle = '#111'; c.lineWidth = 9; c.lineCap = 'round'; c.lineJoin = 'round'; const sx = Math.sin(t * 6) * 5;
      c.beginPath(); c.moveTo(512 - w / 2 + 66 - sx, 286); c.lineTo(512 - w / 2 + 46 - sx, 308); c.lineTo(512 - w / 2 + 66 - sx, 330); c.stroke();
      c.beginPath(); c.moveTo(512 + w / 2 - 66 + sx, 286); c.lineTo(512 + w / 2 - 46 + sx, 308); c.lineTo(512 + w / 2 - 66 + sx, 330); c.stroke(); c.restore();
      const idx = (t > cyc[0] + .5 ? 1 : 0) + (t > cyc[1] + .5 ? 1 : 0);
      for (let i = 0; i < 3; i++) { const on = i === idx, ww = on ? 46 : 18; c.save(); ms(c, .5); rr(c, 512 - 54 + i * 40 - (on ? 14 : 0) + (i > idx ? 28 : 0) - 14, 412, ww, 18, 9); c.fillStyle = on ? '#fff' : 'rgba(255,255,255,.55)'; c.fill(); c.restore(); }
      let fx = 700, a = 1;
      cyc.forEach(c0 => { const k = t - c0; if (k > -.25 && k < .95) { const m = eio(cl(k / .6)); fx = lerp(720, 330, m); a = k < 0 ? 1 : 1 - ss((k - .65) / .3);
        if (k > 0 && k < .9) { const tr = cl(m), tail = cl((k - .2) / .6); c.save(); c.globalAlpha *= 1 - ss((k - .55) / .35); brush(c, seg(720, y, 330, y, 30), eio(tail) * tr * .9, tr, 16, 'rgba(255,255,255,.85)', { ta: .02, tb: .02 }); c.restore(); } } });
      if (t < cyc[0] - .25) fx = 720; else if (t > cyc[0] + .95 && t < cyc[1] - .25) { fx = 720; a = ss((t - cyc[0] - .95) / .25); } else if (t > cyc[1] + .95) { fx = 720; a = ss((t - cyc[1] - .95) / .25); }
      c.save(); c.globalAlpha *= a; hand(c, fx, y, 1, -.18, 0); c.restore();
    });
  });

  /* =====================================================================
     Выделение маркером (20)
     ===================================================================== */
  const MK = 'Выделение маркером';
  const RED = '#FF3B30', YEL = '#FFD60A', PINK = '#FF2D96', BLUE = '#0A84FF', ORG = '#FF9500';

  A('f-mk-underline', 'Подчёркивание маркером', MK, 2.5, (c, t, D) => {
    const P = wob(cr([[220, 612], [420, 600], [640, 596], [810, 580]], 20), 5, 1.4, 11);
    c.save(); c.globalAlpha = fo(t, D); mk(c, P, 0, dr(t, .15, .5), 30, RED); c.restore();
  });

  A('f-mk-double', 'Двойное подчёркивание', MK, 2.5, (c, t, D) => {
    const P1 = wob(cr([[210, 580], [520, 570], [820, 560]], 20), 5, 1.3, 12), P2 = wob(cr([[260, 632], [520, 628], [770, 618]], 20), 5, 1.3, 13);
    c.save(); c.globalAlpha = fo(t, D); mk(c, P1, 0, dr(t, .12, .42), 24, ORG); mk(c, P2, 0, dr(t, .5, .38), 22, ORG); c.restore();
  });

  A('f-mk-wavy', 'Волнистое подчёркивание', MK, 2.5, (c, t, D) => {
    const P = []; for (let i = 0; i <= 160; i++) { const u = i / 160; P.push([lerp(200, 824, u), 600 - u * 10 + Math.sin(u * TAU * 5.5) * 18]); }
    c.save(); c.globalAlpha = fo(t, D); mk(c, wob(P, 3, 1, 14), 0, dr(t, .12, .75), 18, PINK); c.restore();
  });

  A('f-mk-hl-yellow', 'Хайлайтер: жёлтая полоса', MK, 2.5, (c, t, D) => {
    const P = wob(seg(196, 520, 830, 504, 40), 4, 1, 15), p = eo(cl((t - .15) / .5));
    c.save(); c.globalAlpha = fo(t, D) * .58; brush(c, P, 0, p, 112, '#FFE02E', { flat: true, ta: .01, tb: .01, sd: 2 }); c.restore();
  });

  A('f-mk-hl-pink', 'Хайлайтер: две строки розовым', MK, 3, (c, t, D) => {
    const P1 = wob(seg(170, 440, 850, 432, 40), 4, 1, 16), P2 = wob(seg(170, 572, 640, 566, 30), 4, 1, 17);
    c.save(); c.globalAlpha = fo(t, D) * .55; brush(c, P1, 0, eo(cl((t - .12) / .5)), 96, '#FF5FB0', { flat: true, ta: .01, tb: .01, sd: 3 }); brush(c, P2, 0, eo(cl((t - .62) / .4)), 96, '#FF5FB0', { flat: true, ta: .01, tb: .01, sd: 4 }); c.restore();
  });

  A('f-mk-box', 'Прямоугольник от руки', MK, 2.5, (c, t, D) => {
    const P = wob(cr([[250, 344], [520, 334], [780, 330], [796, 340], [800, 520], [790, 686], [776, 694], [520, 700], [242, 690], [232, 680], [228, 500], [238, 352], [262, 336], [420, 322]], 10), 6, 1.2, 18);
    c.save(); c.globalAlpha = fo(t, D); mk(c, P, 0, dr(t, .1, 1.0), 18, RED); c.restore();
  });

  A('f-mk-cloud', 'Облачко-обводка', MK, 2.8, (c, t, D) => {
    const P = []; for (let i = 0; i <= 260; i++) { const u = i / 260, a = -Math.PI * .62 + u * TAU * 1.04, b = 1 + .1 * Math.abs(Math.sin(a * 5.5)); P.push([512 + Math.cos(a) * 330 * b, 512 + Math.sin(a) * 210 * b * (1 + .03 * u)]); }
    c.save(); c.globalAlpha = fo(t, D); mk(c, wob(P, 3, 1, 19), 0, dr(t, .1, 1.1), 14, '#fff'); c.restore();
  });

  A('f-mk-strike', 'Зачёркивание двумя линиями', MK, 2.5, (c, t, D) => {
    const P1 = wob(cr([[200, 512], [520, 498], [830, 482]], 20), 3, 1, 20), P2 = wob(cr([[240, 566], [520, 552], [796, 534]], 20), 3, 1, 21);
    c.save(); c.globalAlpha = fo(t, D); mk(c, P1, 0, dr(t, .15, .35), 22, RED); mk(c, P2, 0, dr(t, .5, .3), 18, RED); c.restore();
  });

  A('f-mk-scribble', 'Зачёркивание каракулями', MK, 2.8, (c, t, D) => {
    const K = []; for (let i = 0; i <= 12; i++) K.push([lerp(230, 790, i / 12) + (i % 2 ? 40 : 0), i % 2 ? 430 + hsh(i) * 20 : 600 - hsh(i + 9) * 20]);
    const P = wob(cr(K, 10), 3, 1, 22), p = dr(t, .1, 1.1);
    c.save(); c.globalAlpha = fo(t, D); c.save(); ms(c, .6); brush(c, P, 0, p, 30, '#fff', { ta: .02, tb: .02 }); c.restore(); brush(c, P, 0, p, 16, '#141416', { ta: .02, tb: .02 }); c.restore();
  });

  A('f-mk-cross', 'Крестик маркером', MK, 2.5, (c, t, D) => {
    const P1 = wob(cr([[330, 330], [520, 520], [700, 700]], 14), 6, 1, 23), P2 = wob(cr([[700, 330], [512, 510], [320, 700]], 14), 6, 1, 24), pop = t > .85 ? 1 + .05 * Math.sin(Math.PI * cl((t - .85) / .25)) : 1;
    c.save(); c.globalAlpha = fo(t, D); c.translate(512, 512); c.scale(pop, pop); c.translate(-512, -512); mk(c, P1, 0, dr(t, .12, .35), 34, RED); mk(c, P2, 0, dr(t, .5, .35), 34, RED); c.restore();
  });

  A('f-mk-check', 'Галочка рисуется', MK, 2.5, (c, t, D) => {
    const P = wob(cr([[330, 520], [400, 590], [460, 660], [560, 520], [700, 360], [760, 300]], 12), 4, 1, 25), pop = t > .8 ? 1 + .06 * Math.sin(Math.PI * cl((t - .8) / .25)) : 1;
    c.save(); c.globalAlpha = fo(t, D); c.translate(512, 512); c.scale(pop, pop); c.translate(-512, -512); mk(c, P, 0, dr(t, .12, .65), 40, YEL); c.restore();
    burst(c, 760, 300, t, .8, { n: 5, R: 90, s: 7, ring: false, lines: true, rot: -2.4, cols: [YEL] });
  });

  // звёздочка-искра от руки: два скрещённых мазка
  function spark(c, x, y, s, k, rot, col, sd) { if (k <= 0) return; c.save(); c.translate(x, y); c.rotate(rot); c.scale(k, k);
    const a = wob(cr([[0, -s], [2, -s * .2], [0, s]], 8), 2, 1, sd), b = wob(cr([[-s, 0], [-s * .2, -2], [s, 0]], 8), 2, 1, sd + 1);
    mk(c, a, 0, 1, s * .22, col, { shk: .7 }); mk(c, b, 0, 1, s * .22, col, { shk: .7 }); c.restore(); }
  A('f-mk-stars', 'Звёздочки-акценты вокруг', MK, 3, (c, t, D) => {
    const S = [[250, 330, 56], [790, 300, 70], [850, 560, 44], [700, 760, 58], [300, 720, 46], [170, 520, 38], [520, 230, 40]];
    c.save(); c.globalAlpha = fo(t, D);
    S.forEach(([x, y, s], i) => { const t0 = .1 + i * .12, k = spr(t - t0, 14, .4) * (1 + .12 * Math.sin(t * 5 + i * 1.7) * cl(t - t0 - .4)); spark(c, x, y, s, Math.max(0, k), Math.sin(t * 1.5 + i) * .15, i % 3 === 1 ? '#fff' : YEL, 30 + i * 3); });
    c.restore();
  });

  A('f-mk-lasso', 'Обводка-каракуля в два круга', MK, 2.8, (c, t, D) => {
    const P = []; for (let i = 0; i <= 280; i++) { const u = i / 280, a = -2.3 + u * TAU * 1.85, r = 1 + .06 * Math.sin(u * 7) - .05 * u; P.push([512 + Math.cos(a) * 340 * r + u * 18, 512 + Math.sin(a) * 200 * r - u * 22]); }
    c.save(); c.globalAlpha = fo(t, D); mk(c, wob(P, 4, 1, 40), 0, dr(t, .1, 1.1), 15, '#FF375F'); c.restore();
  });

  A('f-mk-bang', '«!!» маркером с акцентами', MK, 2.5, (c, t, D) => {
    const o = fo(t, D), pop = t > .9 ? 1 + .07 * Math.sin(Math.PI * cl((t - .9) / .25)) : 1;
    c.save(); c.globalAlpha = o; c.translate(512, 512); c.scale(pop, pop); c.rotate(.12); c.translate(-512, -512);
    [[430, 0], [600, .3]].forEach(([x, d], i) => { const P = wob(cr([[x + 6, 300], [x + 2, 450], [x - 4, 600]], 10), 3, 1, 41 + i); mk(c, P, 0, dr(t, .1 + d, .3), 64, RED, { ta: .02, tb: .5 });
      const k = spr(t - .42 - d, 16, .45); if (k > 0) { c.save(); ms(c); c.beginPath(); c.ellipse(x - 6, 688, 36 * k, 33 * k, .3, 0, TAU); c.fillStyle = RED; c.fill(); c.restore(); } });
    [-.95, -.45, .05].forEach((a, i) => { const ox = 640, oy = 380, P = wob(seg(ox + Math.cos(a) * 90, oy + Math.sin(a) * 90, ox + Math.cos(a) * 170, oy + Math.sin(a) * 170, 10), 2, 1, 45 + i);
      mk(c, P, 0, dr(t, .95 + i * .07, .2), 16, RED, { shk: .7 }); });
    [Math.PI + .95, Math.PI + .45, Math.PI - .05].forEach((a, i) => { const ox = 400, oy = 380, P = wob(seg(ox + Math.cos(a) * 90, oy + Math.sin(a) * 90, ox + Math.cos(a) * 170, oy + Math.sin(a) * 170, 10), 2, 1, 48 + i);
      mk(c, P, 0, dr(t, 1.0 + i * .07, .2), 16, RED, { shk: .7 }); });
    c.restore();
  });

  A('f-mk-braces', 'Фигурные скобки по бокам', MK, 2.8, (c, t, D) => {
    const br = (x, s, sd) => wob(cr([[x + s * 40, 300], [x + s * 4, 320], [x + s * 8, 450], [x - s * 30, 512], [x + s * 8, 574], [x + s * 4, 704], [x + s * 40, 724]], 12), 2, 1, sd);
    c.save(); c.globalAlpha = fo(t, D); mk(c, br(250, 1, 50), 0, dr(t, .1, .6), 22, '#fff'); mk(c, br(774, -1, 51), 0, dr(t, .3, .6), 22, '#fff'); c.restore();
  });

  A('f-mk-rays', 'Лучики-акценты «важно»', MK, 2.8, (c, t, D) => {
    const o = fo(t, D), beat = t > 1 ? Math.max(0, Math.sin((t - 1) * 5)) * 14 : 0;
    c.save(); c.globalAlpha = o;
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i / 10 * TAU + (hsh(i) - .5) * .18, r0 = 250 + hsh(i + 3) * 30 + beat, r1 = r0 + 90 + hsh(i + 7) * 40, P = wob(seg(512 + Math.cos(a) * r0, 512 + Math.sin(a) * r0 * .78, 512 + Math.cos(a) * r1, 512 + Math.sin(a) * r1 * .78, 10), 3, 1, 60 + i);
      mk(c, P, 0, dr(t, .1 + i * .045, .22), 20, i % 2 ? YEL : '#fff', { shk: .8 }); }
    c.restore();
  });

  A('f-mk-heart', 'Сердечко-обводка', MK, 3, (c, t, D) => {
    const P = []; for (let i = 0; i <= 220; i++) { const u = i / 220, a = Math.PI + u * TAU * 1.06, x = 16 * Math.pow(Math.sin(a), 3), y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)); P.push([512 + x * 21 + u * 10, 500 + y * 19 + u * 6]); }
    const beat = t > 1.3 ? 1 + .045 * Math.max(0, Math.sin((t - 1.3) * 7)) : 1;
    c.save(); c.globalAlpha = fo(t, D); c.translate(512, 512); c.scale(beat, beat); c.translate(-512, -512); mk(c, wob(P, 4, 1, 70), 0, dr(t, .1, 1.1), 18, '#FF2D55'); c.restore();
  });

  A('f-mk-arrow-label', 'Стрелка и подпись «ВАЖНО»', MK, 3, (c, t, D) => {
    const o = fo(t, D), wp = eio(cl((t - .1) / .5)), P = wob(cr([[330, 400], [350, 500], [440, 600], [600, 660]], 16), 3, 1, 80);
    c.save(); c.globalAlpha = o; c.font = '150px "Caveat-Bold"'; const tw = c.measureText('ВАЖНО').width;
    c.save(); c.translate(330, 300); c.rotate(-.08); c.beginPath(); c.rect(-tw / 2 - 30, -110, (tw + 60) * wp, 220); c.clip(); ms(c, .9); TF(c, 'ВАЖНО', 0, 0, 150, RED, 'Caveat-Bold'); c.restore();
    mk(c, P, 0, dr(t, .55, .5), 20, RED); head(c, P, cl((t - 1.05) / .3), 76, 19, RED);
    c.restore();
  });

  A('f-mk-bracket', 'Скобка и «это главное»', MK, 3, (c, t, D) => {
    const o = fo(t, D), P = wob(cr([[430, 300], [482, 308], [498, 380], [498, 640], [482, 712], [430, 720]], 14), 3, 1, 90), wp = eio(cl((t - .7) / .7));
    c.save(); c.globalAlpha = o; mk(c, P, 0, dr(t, .1, .6), 20, YEL);
    c.save(); c.beginPath(); c.rect(520, 330, 480 * wp, 360); c.clip(); ms(c, .9); TF(c, 'это', 545, 440, 124, YEL, 'Caveat-Bold', 'left'); TF(c, 'главное', 545, 570, 124, YEL, 'Caveat-Bold', 'left'); c.restore();
    c.restore();
  });

  A('f-mk-corners', 'Рамка-уголки от руки', MK, 2.8, (c, t, D) => {
    const X0 = 230, Y0 = 320, X1 = 794, Y1 = 704, L = 120, br = t > 1 ? 1 + .02 * Math.sin((t - 1) * 4) : 1;
    const C = [[[X0, Y0 + L], [X0 + 2, Y0 + 6], [X0 + 10, Y0], [X0 + L, Y0 - 2]], [[X1 - L, Y0], [X1 - 8, Y0 + 2], [X1, Y0 + 10], [X1 + 2, Y0 + L]], [[X1, Y1 - L], [X1 - 2, Y1 - 8], [X1 - 10, Y1], [X1 - L, Y1 + 2]], [[X0 + L, Y1], [X0 + 8, Y1 - 2], [X0, Y1 - 10], [X0 - 2, Y1 - L]]];
    c.save(); c.globalAlpha = fo(t, D); c.translate(512, 512); c.scale(br, br); c.translate(-512, -512);
    C.forEach((K, i) => mk(c, wob(cr(K, 10), 2, 1, 100 + i), 0, dr(t, .1 + i * .15, .3), 22, '#fff')); c.restore();
  });
})(window);

/* ---- styles7e.js ---- */
/* Футажи: новые категории (часть e) — «Плашки и подписи» и «Праздник и конфетти».
   Рисуют инструментами window.KKFOOT из styles6.js. Без зелёного (цвет хромакея). */
(function (G) {
  const F = G.KKFOOT; if (!F) return;
  const { A, cl, eo, eio, ein, lerp, ss, TAU, spr, env, wk, rr, sh, nosh, card, circ, grad, ic, avatar, burst, confetti, odo, odoW } = F;
  const LT = 'Плашки и подписи', PA = 'Праздник и конфетти';
  const NM = 'Анна Смирнова', RL = 'эксперт по маркетингу';

  /* ---------- свои инструменты ---------- */
  // псевдослучайность 0..1 (детерминированно)
  const H = (i, s = 0) => { const v = Math.sin((i + 1) * 12.9898 + (s + 1) * 78.233 + s * s * 3.17) * 43758.5453; return v - Math.floor(v); };
  // текст любым шрифтом из списка (по умолчанию — от левого края, по центру строки)
  function TX(c, s, x, y, px, col, font = 'Inter-Bold', al = 'left', ls = 0) { c.font = `${px}px "${font}"`; c.letterSpacing = ls + 'px'; c.fillStyle = col; c.textAlign = al; c.textBaseline = 'middle'; c.fillText(s, x, y + px * .04); c.letterSpacing = '0px'; }
  function TWX(c, s, px, font = 'Inter-Bold', ls = 0) { c.font = `${px}px "${font}"`; c.letterSpacing = ls + 'px'; const w = c.measureText(s).width; c.letterSpacing = '0px'; return w; }
  function wrapX(c, s, px, font, maxW) { const L = []; let cur = ''; for (const w of s.split(' ')) { const tst = cur ? cur + ' ' + w : w; if (cur && TWX(c, tst, px, font) > maxW) { L.push(cur); cur = w; } else cur = tst; } if (cur) L.push(cur); return L; }
  const tsh = (c, a = .35, b = 16, y = 4) => { c.shadowColor = `rgba(0,0,0,${a})`; c.shadowBlur = b; c.shadowOffsetY = y; };
  // полёт с сопротивлением воздуха и гравитацией
  const fly = (k, vx, vy, dr, g) => { const e = (1 - Math.exp(-dr * k)) / dr; return [vx * e, vy * e + g / dr * (k - e)]; };
  const PAL = ['#FF3B30', '#FFCC00', '#0A84FF', '#AF52DE', '#FF9500', '#FF2D55', '#5AC8FA', '#FFFFFF'];
  const GOLD = ['#B8860B', '#FFE58A', '#FFC93C', '#B07A12'];
  // четырёхлучевая звёздочка-блёстка
  function star4(c, x, y, r, col, rot = 0) { if (r <= .3) return; c.save(); c.translate(x, y); c.rotate(rot); c.beginPath();
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 - Math.PI / 2, b = a + Math.PI / 4, a2 = a + Math.PI / 2; if (!k) c.moveTo(Math.cos(a) * r, Math.sin(a) * r); c.quadraticCurveTo(Math.cos(b) * r * .16, Math.sin(b) * r * .16, Math.cos(a2) * r, Math.sin(a2) * r); }
    c.closePath(); c.fillStyle = col; c.fill(); c.restore(); }
  // кусочек конфетти: 0 — прямоугольник, 1 — кружок, 2 — завиток, 3 — звёздочка; flip — переворот в 3D
  function piece(c, x, y, s, rot, flip, kind, col) { if (s <= .3) return; const fy = Math.cos(flip); c.save(); c.translate(x, y); c.rotate(rot); c.scale(1, Math.max(.14, Math.abs(fy)));
    const shape = (fill) => { c.fillStyle = fill; c.strokeStyle = fill;
      if (kind === 1) circ(c, 0, 0, s * .62, fill);
      else if (kind === 2) { c.lineWidth = s * .5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-s * 1.3, 0); c.bezierCurveTo(-s * .5, -s * 1.1, s * .3, s * 1.1, s * 1.3, 0); c.stroke(); }
      else if (kind === 3) ic(c, 'star', 0, 0, s * 2.1, fill);
      else c.fillRect(-s, -s * .5, s * 2, s); };
    shape(col); if (fy < 0) shape('rgba(0,0,0,.2)'); c.restore(); }
  // объёмная лента-баннер с хвостами; m — насколько развернулась (0..1)
  function ribbon(c, cx, cy, w, h, m, c1, c2, dark, fold) { const ww = w * Math.max(0, m), tm = cl((m - .8) / .2);
    if (tm > 0) { const drop = h * .3, tw = h * .95 * tm, yt = cy - h / 2 + drop, yb = cy + h / 2 + drop;
      [-1, 1].forEach(d => { const ex = cx + d * w / 2, xa = ex - d * h * .38, xb = ex + d * tw;
        c.beginPath(); c.moveTo(xa, yt); c.lineTo(xb, yt); c.lineTo(xb - d * h * .3 * tm, cy + drop); c.lineTo(xb, yb); c.lineTo(xa, yb); c.closePath(); c.fillStyle = dark; c.fill();
        c.beginPath(); c.moveTo(xa, cy + h / 2); c.lineTo(ex, cy + h / 2); c.lineTo(ex, yb); c.closePath(); c.fillStyle = fold; c.fill(); }); }
    if (ww > 1) { rr(c, cx - ww / 2, cy - h / 2, ww, h, 8); c.fillStyle = grad(c, cx - w / 2, 0, cx + w / 2, 0, [c1, c2]); c.fill();
      c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(cx - ww / 2 + 8, cy - h / 2 + 8, Math.max(0, ww - 16), 4); } }
  // блик, пробегающий по фигуре (вызывать внутри clip)
  function shine(c, x, y, w, h, p, a = .4) { if (p <= 0 || p >= 1) return; const sx = x - 160 + (w + 320) * eio(p), g = c.createLinearGradient(sx - 90, 0, sx + 90, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.save(); c.transform(1, 0, -.4, 1, (y + h / 2) * .4, 0); c.fillStyle = g; c.fillRect(x - 200, y, w + 400, h); c.restore(); }
  // метка карты: кончик в (x, y)
  function pin(c, x, y, s, col) { const r = s * .42, cy = y - s * .62; c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x - r * .35, y - s * .18, x - r, cy + r * .55, x - r, cy); c.arc(x, cy, r, Math.PI, 0); c.bezierCurveTo(x + r, cy + r * .55, x + r * .35, y - s * .18, x, y); c.closePath(); c.fillStyle = col; c.fill(); circ(c, x, cy, r * .42, '#fff'); }
  // синяя «галочка» верификации
  function verified(c, x, y, r) { c.save(); c.fillStyle = '#0A84FF'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; circ(c, x + Math.cos(a) * r * .62, y + Math.sin(a) * r * .62, r * .4, '#0A84FF'); } circ(c, x, y, r * .7, '#0A84FF'); ic(c, 'check', x, y + 1, r * 1.15, '#fff'); c.restore(); }
  // микрофон
  function mic(c, x, y, col = '#fff') { c.save(); c.translate(x, y); rr(c, -13, -34, 26, 44, 13); c.fillStyle = col; c.fill(); c.strokeStyle = col; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.arc(0, -10, 22, .1 * Math.PI, .9 * Math.PI); c.stroke(); c.beginPath(); c.moveTo(0, 12); c.lineTo(0, 26); c.moveTo(-11, 26); c.lineTo(11, 26); c.stroke(); c.restore(); }
  // плашка «раскрывается из круга»: ширина h → wf по пружине, уход — обратно в круг
  function pillOpen(t, D, t0, h, wf) { const o = ein(cl((t - (D - .75)) / .45)), m = spr(t - t0, 11, .78) * (1 - o); return { m, w: lerp(h, wf, m), ta: cl((m - .5) / .4) }; }

  /* =====================================================================
     Плашки и подписи (lower thirds) — нижняя половина кадра, ширина от 60 %
     ===================================================================== */
  A('f-lt-name', 'Имя и должность: плашка раскрывается из аватарки', LT, 4, (c, t, D) => {
    const X = 96, Y = 714, h = 150, wf = Math.max(680, h + 40 + Math.max(TWX(c, NM, 50), TWX(c, RL, 30, 'Inter-Medium')) + 60), { w, ta } = pillOpen(t, D, .3, h, wf), e = env(t, D, 0, .25);
    wk(c, X + h / 2, Y + h / 2, e, () => {
      card(c, X, Y, w, h, h / 2, '#fff', 1);
      if (ta > 0) { c.save(); rr(c, X, Y, w, h, h / 2); c.clip(); c.globalAlpha *= ta; const dx = (1 - ta) * -24;
        TX(c, NM, X + h + 8 + dx, Y + 58, 50, '#111'); TX(c, RL, X + h + 8 + dx, Y + 104, 30, '#8E8E93', 'Inter-Medium'); c.restore(); }
      avatar(c, X + h / 2, Y + h / 2, h / 2 - 16, '#7B61FF', '#2F80FF', 'АС');
    });
  });

  A('f-lt-line', 'Минимализм: линия, имя выезжает из-под неё', LT, 4, (c, t, D) => {
    const X = 112, Y = 772, L = 720, p = eio(cl((t - .1) / .55)), o = eio(cl((t - (D - .55)) / .45)), x0 = X + L * o, x1 = X + L * p, so = ein(cl((t - (D - 1)) / .4));
    const offA = (1 - spr(t - .4, 12, .75) + so) * 120, offB = (1 - spr(t - .55, 12, .75) + so) * 80;
    c.save(); c.beginPath(); c.rect(X - 30, Y - 150, L + 60, 146); c.clip(); tsh(c, .35, 18, 4); TX(c, NM, X, Y - 54 + offA, 72, '#fff'); c.restore();
    c.save(); c.beginPath(); c.rect(X - 30, Y + 4, L + 60, 110); c.clip(); tsh(c, .35, 14, 3); TX(c, RL, X + 2, Y + 44 - offB, 36, 'rgba(255,255,255,.94)', 'Inter-Medium'); c.restore();
    if (x1 - x0 > .5) { c.save(); tsh(c, .3, 12, 3); rr(c, x0, Y - 3, x1 - x0, 6, 3); c.fillStyle = '#fff'; c.fill(); nosh(c); rr(c, x0, Y - 3, Math.min(64, x1 - x0), 6, 3); c.fillStyle = '#FFD60A'; c.fill(); c.restore(); }
  });

  A('f-lt-glass', 'Стеклянная плашка с именем', LT, 4, (c, t, D) => {
    const X = 112, Y = 692, w = 740, h = 176, r = 56, e = env(t, D, .1, .35), up = (1 - spr(t - .1, 10, .78)) * 60;
    wk(c, 512, Y + h / 2, e, () => { c.save(); c.translate(0, up);
      c.save(); c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = 40; c.shadowOffsetY = 16; rr(c, X, Y, w, h, r); c.fillStyle = grad(c, X, Y, X + w * .6, Y + h * 1.6, ['rgba(255,255,255,.42)', 'rgba(255,255,255,.2)', 'rgba(40,40,60,.24)']); c.fill(); c.restore();
      c.save(); rr(c, X, Y, w, h, r); c.clip(); c.fillStyle = grad(c, 0, Y, 0, Y + h * .5, ['rgba(255,255,255,.3)', 'rgba(255,255,255,0)']); c.fillRect(X, Y, w, h * .5); shine(c, X, Y, w, h, cl((t - 1.1) / .8), .35); c.restore();
      rr(c, X + 1, Y + 1, w - 2, h - 2, r - 1); c.lineWidth = 2.5; c.strokeStyle = grad(c, X, Y, X + w, Y + h, ['rgba(255,255,255,.95)', 'rgba(255,255,255,.2)', 'rgba(255,255,255,.7)']); c.stroke();
      const ax = X + 94, ay = Y + h / 2; circ(c, ax, ay, 60, 'rgba(255,255,255,.55)'); avatar(c, ax, ay, 53, '#FF8A5C', '#FF2D96', 'АС');
      const q = eo(cl((t - .35) / .5)); c.save(); c.globalAlpha *= q; tsh(c, .3, 12, 2); TX(c, NM, X + 182 + (1 - q) * 20, Y + 70, 50, '#fff'); TX(c, RL, X + 182 + (1 - q) * 20, Y + 116, 30, 'rgba(255,255,255,.92)', 'Inter-Medium'); c.restore();
      c.restore(); });
  });

  A('f-lt-nick', 'Ник @username с аватаркой и галочкой', LT, 3.5, (c, t, D) => {
    const nick = '@username', h = 128, tw = TWX(c, nick, 46), bw = TWX(c, 'Подписаться', 26) + 48, tx0 = h + 6, bx0 = tx0 + tw + 18 + 44 + 34;
    const wf = Math.max(680, bx0 + bw + 22), X = 512 - wf / 2, Y = 742, { w } = pillOpen(t, D, .3, h, wf), e = env(t, D, 0, .25);
    wk(c, X + h / 2, Y + h / 2, e, () => {
      card(c, X, Y, w, h, h / 2, '#fff', 1);
      c.save(); rr(c, X, Y, w, h, h / 2); c.clip();
      const n = Math.floor(cl((t - .55) / .5) * nick.length + .001), tx = X + tx0, str = nick.slice(0, n);
      if (n > 0) TX(c, str, tx, Y + h / 2, 46, '#111');
      if (t > .5 && t < 1.3 && Math.floor(t * 6) % 2 === 0) { c.fillStyle = '#0A84FF'; c.fillRect(tx + TWX(c, str, 46) + 4, Y + h / 2 - 24, 4, 48); }
      const bk = spr(t - 1.15, 15, .45); if (bk > 0) { c.save(); c.translate(tx + tw + 18 + 22, Y + h / 2); c.scale(bk, bk); verified(c, 0, 0, 22); c.restore(); }
      const pk = spr(t - 1.4, 13, .6); if (pk > 0) { const bx = X + bx0; c.save(); c.globalAlpha *= cl((t - 1.4) / .12); c.translate(bx + bw / 2, Y + h / 2); c.scale(pk, pk); rr(c, -bw / 2, -30, bw, 60, 30); c.fillStyle = '#0A84FF'; c.fill(); TX(c, 'Подписаться', 0, 0, 26, '#fff', 'Inter-Bold', 'center'); c.restore(); }
      c.restore();
      const ax = X + h / 2, ay = Y + h / 2, g = c.createConicGradient(-Math.PI / 2 + t * 1.5, ax, ay); ['#FEDA75', '#FA7E1E', '#D62976', '#962FBF', '#4F5BD5', '#FEDA75'].forEach((s, i) => g.addColorStop(i / 5, s));
      circ(c, ax, ay, 52); c.fillStyle = g; c.fill(); circ(c, ax, ay, 46, '#fff'); avatar(c, ax, ay, 41, '#FFB86B', '#FF5E7E');
    });
  });

  A('f-lt-geo', 'Геометка «Москва»: метка падает на плашку', LT, 3.5, (c, t, D) => {
    const X = 172, Y = 716, h = 150, wf = 680, { w, ta } = pillOpen(t, D, .5, h, wf), e = env(t, D, 0, .25), cx = X + h / 2, cy = Y + h / 2;
    wk(c, cx, cy, e, () => {
      card(c, X, Y, w, h, h / 2, '#fff', 1); circ(c, cx, cy, 54, '#FFEDEC');
      if (ta > 0) { c.save(); rr(c, X, Y, w, h, h / 2); c.clip(); c.globalAlpha *= ta; const dx = (1 - ta) * -24;
        TX(c, 'Москва', X + h + 6 + dx, Y + 58, 54, '#111'); TX(c, 'Россия, Красная площадь', X + h + 8 + dx, Y + 106, 28, '#8E8E93', 'Inter-Medium');
        circ(c, X + wf - 76, cy, 44, '#F2F2F7'); ic(c, 'send', X + wf - 74, cy + 2, 40, '#0A84FF', 0, -Math.PI / 4); c.restore(); }
      const dk = spr(t - .12, 13, .45), dy = (1 - dk) * -230, ty = cy + 32;
      c.save(); c.globalAlpha *= .25 * cl(dk); c.fillStyle = '#FF3B30'; c.beginPath(); c.ellipse(cx, ty, 18 * cl(dk), 6 * cl(dk), 0, 0, TAU); c.fill(); c.restore();
      const rk = (t - .3) / .6; if (rk > 0 && rk < 1) { c.save(); c.globalAlpha *= 1 - rk; c.strokeStyle = '#FF3B30'; c.lineWidth = 3; c.beginPath(); c.ellipse(cx, ty, 18 + 34 * eo(rk), 6 + 12 * eo(rk), 0, 0, TAU); c.stroke(); c.restore(); }
      c.save(); c.globalAlpha *= cl((t - .12) / .1); pin(c, cx, ty + dy, 74, '#FF3B30'); c.restore();
    });
  });

  A('f-lt-date', 'Дата и время: листок календаря', LT, 3.5, (c, t, D) => {
    const X = 152, Y = 706, w = 720, h = 164, e = env(t, D, 0, .3), sl = (1 - spr(t, 11, .75)) * -90;
    wk(c, X + 90, Y + h / 2, e, () => { c.save(); c.translate(sl, 0);
      card(c, X, Y, w, h, 40, '#fff', 1);
      const tx = X + 24, ty = Y + 24, ts = 116, ga = c.globalAlpha;
      c.save(); rr(c, tx, ty, ts, ts, 26); c.fillStyle = '#F2F2F7'; c.fill(); c.clip(); c.fillStyle = '#FF3B30'; c.fillRect(tx, ty, ts, 36); c.restore();
      TX(c, 'ОКТ', tx + ts / 2, ty + 18, 20, '#fff', 'Inter-Bold', 'center', 2);
      const f = eio(cl((t - .9) / .35)); c.save(); c.beginPath(); c.rect(tx, ty + 36, ts, ts - 36); c.clip();
      c.globalAlpha = ga * (1 - f); TX(c, '29', tx + ts / 2, ty + 78 - f * 64, 54, '#111', 'Inter-Bold', 'center');
      c.globalAlpha = ga * f; TX(c, '30', tx + ts / 2, ty + 78 + (1 - f) * 64, 54, '#111', 'Inter-Bold', 'center'); c.restore(); c.globalAlpha = ga;
      const q = eo(cl((t - .3) / .45)); c.save(); c.globalAlpha *= q; c.translate((1 - q) * -20, 0);
      TX(c, 'пятница, 30 октября', X + 172, Y + 62, 42, '#111');
      const kx = X + 190, ky = Y + 114; c.strokeStyle = '#8E8E93'; c.lineWidth = 3.5; circ(c, kx, ky, 15); c.stroke(); c.lineCap = 'round';
      const ma = t * 2.2 - Math.PI / 2; c.beginPath(); c.moveTo(kx, ky); c.lineTo(kx + Math.cos(ma) * 10, ky + Math.sin(ma) * 10); c.moveTo(kx, ky); c.lineTo(kx + 6, ky - 4); c.stroke();
      const pre = '18:4', pw = TWX(c, pre, 32, 'Inter-Medium'), g2 = eio(cl((t - 1.7) / .3)); TX(c, pre, kx + 28, ky, 32, '#8E8E93', 'Inter-Medium');
      c.save(); c.beginPath(); c.rect(kx + 28 + pw - 2, ky - 24, 40, 48); c.clip(); const ga2 = c.globalAlpha;
      c.globalAlpha = ga2 * (1 - g2); TX(c, '4', kx + 28 + pw, ky - g2 * 36, 32, '#8E8E93', 'Inter-Medium'); c.globalAlpha = ga2 * g2; TX(c, '5', kx + 28 + pw, ky + (1 - g2) * 36, 32, '#8E8E93', 'Inter-Medium'); c.restore();
      c.restore(); c.restore(); });
  });

  A('f-lt-episode', '«Эпизод 3»: номер и название выпуска', LT, 4, (c, t, D) => {
    const X = 112, Y = 692, S = 176, ttl = 'Как набрать первую тысячу', cw = TWX(c, ttl, 38) + 100, cx0 = X + S - 40, cy0 = Y + 22, ch = S - 44;
    const o = ein(cl((t - (D - .75)) / .45)), m = spr(t - .45, 11, .8) * (1 - o), e = env(t, D, 0, .3);
    if (m > .002) { c.save(); c.globalAlpha *= e.a; c.beginPath(); c.rect(X + S / 2, Y - 60, 1024, S + 140); c.clip(); const off = (1 - m) * -(cw + 20);
      card(c, cx0 + off, cy0, cw, ch, 32, '#fff', .9); TX(c, ttl, cx0 + off + 74, cy0 + 48, 38, '#111'); TX(c, 'Сезон 1 · 12 минут', cx0 + off + 74, cy0 + 92, 26, '#8E8E93', 'Inter-Medium'); c.restore(); }
    e.r = (1 - cl(spr(t, 12, .6))) * -.35;
    wk(c, X + S / 2, Y + S / 2, e, () => { c.save(); sh(c, 1); rr(c, X, Y, S, S, 44); c.fillStyle = grad(c, X, Y, X + S, Y + S, ['#7B61FF', '#FF2D96']); c.fill(); c.restore();
      TX(c, 'ЭПИЗОД', X + S / 2 + 1, Y + 42, 19, 'rgba(255,255,255,.85)', 'Inter-Bold', 'center', 3); TX(c, '3', X + S / 2, Y + 108, 100, '#fff', 'Unbounded-ExtraBold', 'center'); });
  });

  A('f-lt-topic', '«Тема»: название печатается', LT, 4, (c, t, D) => {
    const X = 112, Y = 704, w = 760, h = 172, s = 'Как снимать рилс на телефон', e = env(t, D, 0, .35), up = (1 - spr(t, 11, .75)) * 50;
    wk(c, 512, Y + h, e, () => { c.save(); c.translate(0, up);
      card(c, X, Y, w, h, 40, 'rgba(22,22,26,.94)', 1);
      const ck = spr(t - .3, 14, .55), cw = TWX(c, 'ТЕМА', 18, 'Inter-Bold', 3) + 40;
      if (ck > 0) { c.save(); c.translate(X + 36, Y + 52); c.scale(ck, ck); rr(c, 0, -20, cw, 40, 20); c.fillStyle = grad(c, 0, 0, cw, 0, ['#FF9500', '#FF5E3A']); c.fill(); TX(c, 'ТЕМА', 20, 0, 18, '#fff', 'Inter-Bold', 'left', 3); c.restore(); }
      const n = Math.floor(cl((t - .6) / 1.3) * s.length + .001), str = s.slice(0, n);
      TX(c, str, X + 36, Y + 116, 42, '#fff');
      if (t > .5 && (n < s.length || Math.floor(t * 2.5) % 2 === 0)) { c.fillStyle = '#FF9500'; c.fillRect(X + 40 + TWX(c, str, 42), Y + 92, 4, 50); }
      c.restore(); });
  });

  A('f-lt-sticker', 'Стикер iOS с именем шлёпается в кадр', LT, 3.5, (c, t, D) => {
    const cx = 512, cy = 772, w = 660, h = 160, o = ein(cl((t - (D - .35)) / .35)), k0 = spr(t - .05, 12, .5), k = (1.35 - .35 * k0) * (1 - .3 * o), a = cl((t - .05) / .1) * (1 - o);
    const wig = t > 1.6 ? Math.sin((t - 1.6) * 16) * .05 * Math.exp(-(t - 1.6) * 4) : 0, rot = lerp(-.25, -.05, cl(k0)) + wig, lift = 1 - cl(k0);
    if (a <= 0) return;
    c.save(); c.globalAlpha *= a; c.translate(cx, cy); c.rotate(rot); c.scale(k, k);
    c.save(); c.shadowColor = `rgba(0,0,0,${.2 + .12 * lift})`; c.shadowBlur = 30 + 40 * lift; c.shadowOffsetY = 10 + 26 * lift; rr(c, -w / 2 - 10, -h / 2 - 10, w + 20, h + 20, 50); c.fillStyle = '#fff'; c.fill(); c.restore();
    rr(c, -w / 2, -h / 2, w, h, 40); c.fillStyle = grad(c, -w / 2, -h / 2, w / 2, h / 2, ['#FFE14D', '#FF9F0A']); c.fill();
    c.save(); rr(c, -w / 2, -h / 2, w, h, 40); c.clip(); c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.ellipse(-w * .1, -h * .78, w * .75, h * .55, 0, 0, TAU); c.fill(); c.restore();
    TX(c, NM, -w / 2 + 54, -20, 56, '#1C1C1E', 'Nunito-Bold'); TX(c, RL, -w / 2 + 56, 36, 32, 'rgba(28,28,30,.7)', 'Nunito-Bold');
    c.restore();
    const k2 = spr(t - .55, 14, .45); if (k2 > 0) { c.save(); c.globalAlpha *= a; c.translate(cx + 300, cy - 84); c.rotate(.22 + wig * 1.5); c.scale(k2 * (1 - .3 * o), k2 * (1 - .3 * o)); sh(c, .5); circ(c, 0, 0, 54, '#fff'); nosh(c); circ(c, 0, 0, 45, grad(c, -45, -45, 45, 45, ['#FF6B95', '#FF2D55'])); ic(c, 'heart', 0, 3, 50, '#fff'); c.restore(); }
  });

  A('f-lt-mag', 'Журнальная подпись: интервью (Playfair)', LT, 4, (c, t, D) => {
    const X = 112, Y = 652, w = 740, h = 232, p = eio(cl((t - .1) / .6)), o = eio(cl((t - (D - .6)) / .5)), xl = X + w * o, xr = X + w * p;
    if (xr - xl <= .5) return;
    c.save(); c.shadowColor = 'rgba(0,0,0,.2)'; c.shadowBlur = 36; c.shadowOffsetY = 14; c.fillStyle = '#F6F0E6'; c.fillRect(xl, Y, xr - xl, h); c.restore();
    c.save(); c.beginPath(); c.rect(xl, Y, xr - xl, h); c.clip(); const ga = c.globalAlpha;
    const it = t0 => { const q = eo(cl((t - t0) / .5)); c.globalAlpha = ga * q; return (1 - q) * 18; };
    let d = it(.45); TX(c, 'ИНТЕРВЬЮ', X + 52, Y + 50 + d, 19, '#9C6B3C', 'Inter-Bold', 'left', 5); TX(c, '№ 12', X + w - 52, Y + 50 + d, 26, '#9C6B3C', 'PlayfairDisplay-Bold', 'right');
    d = it(.6); TX(c, NM, X + 50, Y + 112 + d, 64, '#151515', 'PlayfairDisplay-Bold');
    c.globalAlpha = ga; c.fillStyle = 'rgba(21,21,21,.5)'; c.fillRect(X + 52, Y + 160, (w - 104) * eio(cl((t - .8) / .6)), 1.5);
    d = it(.9); TX(c, RL, X + 52, Y + 194 + d, 30, '#4A4A4A', 'PTSerif');
    c.restore();
  });

  A('f-lt-brutal', 'Брутализм: жёлтая плашка с жёсткой тенью', LT, 3.5, (c, t, D) => {
    const tq = Math.floor(t * 12) / 12, X = 112, Y = 684, w = 780, h = 132, ow = cl((tq - (D - .42)) / .3), ww = w * Math.max(0, spr(tq - .05, 16, .5)) * (1 - ein(ow));
    if (ww < 2) return;
    const so = 14 * cl((tq - .3) / .25);
    c.fillStyle = '#111'; c.fillRect(X + so, Y + so, ww, h); c.fillStyle = '#FFE500'; c.fillRect(X, Y, ww, h); c.lineWidth = 6; c.strokeStyle = '#111'; c.strokeRect(X + 3, Y + 3, ww - 6, h - 6);
    c.save(); c.beginPath(); c.rect(X, Y, ww, h); c.clip(); TX(c, 'АННА СМИРНОВА', X + 40, Y + h / 2, 44, '#111', 'Unbounded-ExtraBold');
    c.strokeStyle = '#111'; c.lineWidth = 9; c.lineCap = 'square'; const ax = X + w - 52, ay = Y + h / 2; c.beginPath(); c.moveTo(ax - 54, ay); c.lineTo(ax, ay); c.moveTo(ax - 22, ay - 24); c.lineTo(ax, ay); c.lineTo(ax - 22, ay + 24); c.stroke(); c.restore();
    const sk = spr(tq - .55, 18, .45), lab = 'ЭКСПЕРТ ПО МАРКЕТИНГУ', sw = TWX(c, lab, 22, 'RubikMonoOne') + 48;
    if (sk > 0 && ow <= 0 && ww > w * .9) { c.save(); c.translate(X + 48, Y + h - 12); c.rotate(-.025); c.translate(0, (1 - sk) * -40); c.globalAlpha *= cl(sk * 3); c.fillStyle = '#111'; c.fillRect(0, 0, sw, 62); TX(c, lab, 24, 31, 22, '#FFE500', 'RubikMonoOne'); c.restore(); }
  });

  A('f-lt-hand', 'Рукописная подпись с подчёркиванием маркером', LT, 4, (c, t, D) => {
    const X = 150, Y = 744, o = ein(cl((t - (D - .5)) / .5)), nw = TWX(c, NM, 116, 'Caveat-Bold');
    c.save(); c.globalAlpha *= 1 - o; c.translate(0, -o * 20);
    const p = eio(cl((t - .1) / 1.0));
    if (p > 0) { c.save(); c.beginPath(); c.rect(X - 20, Y - 110, (nw + 40) * p, 190); c.clip(); tsh(c, .4, 16, 4); TX(c, NM, X, Y, 116, '#fff', 'Caveat-Bold'); c.restore(); }
    const up = eo(cl((t - 1.0) / .45)); if (up > 0) { c.save(); tsh(c, .25, 10, 3); c.strokeStyle = '#FFD60A'; c.lineWidth = 12; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
      const N = 40; for (let i = 0; i <= N * up; i++) { const s = i / N, x = X - 6 + (nw + 80) * s, y = Y + 64 + Math.sin(s * 3.4) * 7 - s * 12; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.restore(); }
    const rq = eo(cl((t - 1.25) / .5)); if (rq > 0) { c.save(); c.globalAlpha *= rq; tsh(c, .4, 14, 3); TX(c, RL, X + 4, Y + 128 + (1 - rq) * 16, 56, '#fff', 'Caveat-Bold'); c.restore(); }
    const dp = eo(cl((t - 1.5) / .35)); if (dp > 0) { const sx = X + nw + 30, sy = Y - 64; c.save(); tsh(c, .25, 8, 2); c.strokeStyle = '#FFD60A'; c.lineWidth = 8; c.lineCap = 'round';
      [-2.4, -1.6, -.8].forEach((a, i) => { const q = cl(dp * 1.4 - i * .2); if (q <= 0) return; c.beginPath(); c.moveTo(sx + Math.cos(a) * 14, sy + 40 + Math.sin(a) * 14); c.lineTo(sx + Math.cos(a) * (14 + 38 * q), sy + 40 + Math.sin(a) * (14 + 38 * q)); c.stroke(); }); c.restore(); }
    c.restore();
  });

  A('f-lt-tip', 'Плашка-тег «#совет» с подсказкой', LT, 4, (c, t, D) => {
    const X = 112, Y = 718, w = 760, h = 156, s = 'Снимай у окна — свет мягче', e = env(t, D, 0, .35), up = (1 - spr(t, 11, .75)) * 50;
    wk(c, 512, Y + h, e, () => { c.save(); c.translate(0, up);
      card(c, X, Y, w, h, 38, '#fff', 1);
      let x = X + 44; s.split(' ').forEach((wd, i) => { const q = eo(cl((t - .55 - i * .07) / .35)); if (q > 0) { c.save(); c.globalAlpha *= q; TX(c, wd, x, Y + 98 + (1 - q) * 14, 42, '#111'); c.restore(); } x += TWX(c, wd + ' ', 42); });
      const tg = '#совет', tw = TWX(c, tg, 34) + 70, tt = t - .2, sw = tt > 0 ? -.6 * Math.exp(-tt * 3.4) * Math.cos(tt * 9) : -.6, tk = spr(t - .2, 14, .5);
      if (tk > 0) { c.save(); c.translate(X + 70, Y); c.rotate(sw); c.scale(tk, tk); sh(c, .6); rr(c, -30, -30, tw, 60, 18); c.fillStyle = grad(c, -30, 0, tw - 30, 0, ['#7B61FF', '#B05CFF']); c.fill(); nosh(c);
        circ(c, 0, 0, 7, '#fff'); TX(c, tg, 18, 0, 34, '#fff'); c.restore(); }
      c.restore(); });
  });

  A('f-lt-podcast', '«Подкаст»: микрофон и звуковая волна', LT, 4, (c, t, D) => {
    const X = 112, Y = 704, wf = 780, h = 170, cx = X + 85, cy = Y + h / 2, { w, ta } = pillOpen(t, D, .3, h, wf), e = env(t, D, 0, .25);
    wk(c, cx, cy, e, () => {
      card(c, X, Y, w, h, h / 2, '#141418', 1);
      if (ta > 0) { c.save(); rr(c, X, Y, w, h, h / 2); c.clip(); c.globalAlpha *= ta;
        TX(c, 'ПОДКАСТ · ВЫПУСК 12', X + 176, Y + 62, 20, '#FF9F0A', 'Inter-Bold', 'left', 3); TX(c, 'Код креатора', X + 176, Y + 110, 46, '#fff');
        const n = 14, gap = 14, wx0 = X + wf - 64 - n * gap, on = cl((t - .7) / .3); c.globalAlpha *= cl((t - .6) / .2);
        for (let i = 0; i < n; i++) { const a = .15 + .85 * Math.abs(Math.sin(t * 6.3 + i * .9) * Math.sin(t * 3.1 + i * 1.7 + 1)), hh = 8 + 74 * a * on; rr(c, wx0 + i * gap, cy - hh / 2, 7, hh, 3.5); c.fillStyle = grad(c, 0, cy - 40, 0, cy + 40, ['#FF9500', '#FF2D55']); c.fill(); }
        c.restore(); }
      const pu = .5 + .5 * Math.sin(t * 7); c.save(); c.globalAlpha *= .25 * cl((t - .7) / .3) * pu; circ(c, cx, cy, 62 + 10 * pu, '#FF5E3A'); c.restore();
      circ(c, cx, cy, 62, grad(c, cx - 62, cy - 62, cx + 62, cy + 62, ['#FF9500', '#FF2D55'])); mic(c, cx, cy + 2);
    });
  });

  A('f-lt-quote', '«Цитата» в кавычках с автором', LT, 4.5, (c, t, D) => {
    const X = 112, w = 780, s = 'Делай контент, который хочется досмотреть до конца', lines = wrapX(c, s, 42, 'PlayfairDisplay-Bold', w - 130), lh = 56, h = 100 + lines.length * lh + 64, Y = Math.min(600, 930 - h);
    const e = env(t, D, 0, .35), up = (1 - spr(t, 11, .78)) * 50;
    wk(c, 512, Y + h, e, () => { c.save(); c.translate(0, up); card(c, X, Y, w, h, 40, '#fff', 1);
      lines.forEach((l, i) => { const q = eo(cl((t - .45 - i * .14) / .5)), ly = Y + 100 + i * lh; c.save(); c.beginPath(); c.rect(X, ly - lh / 2 - 4, w, lh + 8); c.clip(); TX(c, l, X + 60, ly + (1 - q) * lh, 42, '#141414', 'PlayfairDisplay-Bold'); c.restore(); });
      const aq = eo(cl((t - (.6 + lines.length * .14)) / .5)); if (aq > 0) { c.save(); c.globalAlpha *= aq; c.fillStyle = '#7B61FF'; c.fillRect(X + 62, Y + h - 50, 34 * aq, 3); TX(c, NM + ', ' + RL, X + 110, Y + h - 49, 26, '#8E8E93', 'Inter-Medium'); c.restore(); }
      const bk = spr(t - .2, 13, .45); if (bk > 0) { c.save(); c.translate(X + 78, Y); c.rotate((1 - cl(bk)) * -.6); c.scale(bk, bk); sh(c, .6); circ(c, 0, 0, 46, grad(c, -46, -46, 46, 46, ['#7B61FF', '#B05CFF'])); nosh(c); TX(c, '“', 0, 26, 120, '#fff', 'PlayfairDisplay-Bold', 'center'); c.restore(); }
      c.restore(); });
  });

  A('f-lt-guest', '«Гость выпуска»: ярлык и карточка', LT, 4, (c, t, D) => {
    const X = 112, Y = 724, w = 740, h = 164, e = env(t, D, 0, .35), sl = (1 - spr(t - .05, 11, .78)) * -100;
    wk(c, X + w / 2, Y + h / 2, e, () => {
      c.save(); c.translate(sl, 0); c.globalAlpha *= cl((t - .05) / .15);
      card(c, X, Y, w, h, 38, '#fff', 1); avatar(c, X + 92, Y + 94, 50, '#5AC8FA', '#5E5CE6');
      const q = eo(cl((t - .4) / .45)); c.save(); c.globalAlpha *= q; TX(c, NM, X + 170, Y + 76 + (1 - q) * 12, 46, '#111'); TX(c, 'основатель студии «Кадр»', X + 170, Y + 122 + (1 - q) * 12, 28, '#8E8E93', 'Inter-Medium'); c.restore();
      c.restore();
      const lk = spr(t - .35, 13, .5), lw = TWX(c, 'ГОСТЬ ВЫПУСКА', 22, 'Inter-Bold', 3) + 84;
      if (lk > 0) { c.save(); c.translate(X + 28, Y + (1 - lk) * -50); c.rotate((1 - cl(lk)) * -.15); c.globalAlpha *= cl((t - .35) / .1); sh(c, .5); rr(c, 0, -27, lw, 54, 27); c.fillStyle = grad(c, 0, 0, lw, 0, ['#FF2D55', '#FF7A3D']); c.fill(); nosh(c);
        ic(c, 'star', 32, 0, 30, '#fff', 0, TAU * eo(cl((t - .45) / .8))); TX(c, 'ГОСТЬ ВЫПУСКА', 56, 0, 22, '#fff', 'Inter-Bold', 'left', 3); c.restore(); }
    });
  });

  A('f-lt-review', '«Отзыв клиента» со звёздами', LT, 4, (c, t, D) => {
    const X = 112, Y = 650, w = 760, h = 240, e = env(t, D, 0, .35), up = (1 - spr(t, 11, .78)) * 50;
    wk(c, 512, Y + h, e, () => { c.save(); c.translate(0, up); card(c, X, Y, w, h, 40, '#fff', 1);
      TX(c, 'ОТЗЫВ КЛИЕНТА', X + 44, Y + 52, 19, '#8E8E93', 'Inter-Bold', 'left', 4);
      for (let i = 0; i < 5; i++) { const sx = X + w - 62 - (4 - i) * 44, tc = .55 + i * .12, on = t >= tc, k = on ? .6 + .4 * spr(t - tc, 17, .38) : 1; c.save(); c.translate(sx, Y + 50); c.scale(k, k); ic(c, 'star', 0, 0, 42, on ? '#FFB800' : '#E5E5EA'); c.restore(); }
      const q = eo(cl((t - .4) / .5)); c.save(); c.globalAlpha *= q; TX(c, '«Охваты выросли в три раза!»', X + 44, Y + 120 + (1 - q) * 14, 40, '#111'); c.restore();
      const q2 = eo(cl((t - .7) / .5)); c.save(); c.globalAlpha *= q2; avatar(c, X + 72, Y + 186, 28, '#FFB86B', '#FF5E7E', 'М'); TX(c, 'Мария, владелица кофейни', X + 116, Y + 186, 27, '#3C3C43', 'Inter-Medium'); c.restore();
      c.restore(); });
  });

  A('f-lt-case', '«Кейс»: результат в цифрах и график', LT, 4, (c, t, D) => {
    const X = 112, Y = 690, w = 760, h = 200, e = env(t, D, 0, .35), up = (1 - spr(t, 11, .78)) * 50;
    wk(c, 512, Y + h, e, () => { c.save(); c.translate(0, up);
      card(c, X, Y, w, h, 40, grad(c, X, Y, X + w, Y + h, ['#1E2142', '#33205A']), 1);
      const ck = spr(t - .25, 14, .55), cw = TWX(c, 'КЕЙС', 18, 'Inter-Bold', 3) + 40;
      if (ck > 0) { c.save(); c.translate(X + 40, Y + 44); c.scale(ck, ck); rr(c, 0, -19, cw, 38, 19); c.fillStyle = '#FFD60A'; c.fill(); TX(c, 'КЕЙС', 20, 0, 18, '#111', 'Inter-Bold', 'left', 3); c.restore(); }
      const v = Math.round(300 * eo(cl((t - .5) / 1.3))); TX(c, '+' + v + '%', X + 38, Y + 108, 74, '#fff', 'Montserrat-Black');
      TX(c, 'охвата за месяц', X + 42, Y + 160, 26, 'rgba(255,255,255,.65)', 'Inter-Medium');
      const gx0 = X + w - 300, gx1 = X + w - 48, gy0 = Y + 160, gy1 = Y + 46, P = [0, .12, .08, .3, .24, .52, .46, 1], p = eio(cl((t - .55) / 1.2)) * (P.length - 1);
      const pt = i => [lerp(gx0, gx1, i / (P.length - 1)), lerp(gy0, gy1, P[i])], pts = []; for (let i = 0; i <= Math.floor(p); i++) pts.push(pt(i));
      if (p % 1 > 0 && p < P.length - 1) { const a = pt(Math.floor(p)), b = pt(Math.floor(p) + 1), f = p % 1; pts.push([lerp(a[0], b[0], f), lerp(a[1], b[1], f)]); }
      if (pts.length > 1) { c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); const L = pts[pts.length - 1]; c.lineTo(L[0], gy0 + 6); c.lineTo(gx0, gy0 + 6); c.closePath(); c.fillStyle = grad(c, 0, gy1, 0, gy0, ['rgba(255,214,10,.35)', 'rgba(255,214,10,0)']); c.fill();
        c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.strokeStyle = '#FFD60A'; c.lineWidth = 6; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke();
        const pu = .5 + .5 * Math.sin(t * 8); c.save(); c.globalAlpha *= .35 * pu; circ(c, L[0], L[1], 18, '#FFD60A'); c.restore(); circ(c, L[0], L[1], 9, '#fff'); }
      c.restore(); });
  });

  A('f-lt-bar', 'Цветная полоса выезжает и открывает плашку', LT, 4, (c, t, D) => {
    const X = 112, Y = 716, W = 740, Hh = 156, a1 = eio(cl((t - .1) / .4)), a2 = eio(cl((t - .55) / .45)), tE = D - .95, b1 = eio(cl((t - tE) / .35)), b2 = eio(cl((t - tE - .45) / .4));
    let L = X, R, plate = a1;
    if (t < tE) R = t < .55 ? X + W * a1 : X + 18 + (W - 18) * (1 - a2); else { R = X + 18 + (W - 18) * b1; L = X + W * b2; if (b2 > 0) plate = 0; }
    if (plate > 0) { c.save(); c.shadowColor = 'rgba(0,0,0,.22)'; c.shadowBlur = 36; c.shadowOffsetY = 14; c.fillStyle = '#fff'; c.fillRect(X, Y, W * plate, Hh); c.restore();
      c.save(); c.beginPath(); c.rect(X, Y, W * plate, Hh); c.clip(); const q = eo(cl((t - .7) / .5)), dx = (1 - q) * -40; c.globalAlpha *= q; TX(c, NM, X + 54 + dx, Y + 60, 52, '#111'); TX(c, RL, X + 54 + dx, Y + 108, 30, '#6E6E73', 'Inter-Medium'); c.restore(); }
    if (R - L > .5) { c.fillStyle = grad(c, X, 0, X + W, 0, ['#FF2D55', '#FF9500']); c.fillRect(L, Y, R - L, Hh); }
  });

  A('f-lt-news', 'ТВ-подпись: «Эфир», имя и бегущая строка', LT, 4.5, (c, t, D) => {
    const X = 112, Y = 684, wp = (t0, i) => eio(cl((t - t0) / .4)) * (1 - eio(cl((t - (D - .65 + (3 - i) * .06)) / .35)));
    const row = (k, x, y, w, h, fill, fn) => { if (k <= 0) return; c.save(); c.beginPath(); c.rect(x, y, w * k, h); c.clip(); c.fillStyle = fill; c.fillRect(x, y, w, h); fn(); c.restore(); };
    row(wp(.1, 0), X, Y, 150, 84, '#E5252A', () => { circ(c, X + 34, Y + 42, 9, `rgba(255,255,255,${Math.floor(t * 2.2) % 2 ? 1 : .35})`); TX(c, 'ЭФИР', X + 54, Y + 42, 28, '#fff', 'Inter-Bold', 'left', 1); });
    row(wp(.25, 1), X + 150, Y, 590, 84, '#fff', () => TX(c, NM, X + 182, Y + 42, 44, '#111'));
    row(wp(.4, 2), X, Y + 84, 560, 58, '#0A5BD9', () => TX(c, RL, X + 32, Y + 113, 28, '#fff', 'Inter-Medium'));
    row(wp(.55, 3), X, Y + 142, 740, 48, 'rgba(18,18,22,.94)', () => { const str = 'Главное за неделю   •   Новые тренды Reels   •   Как снимать на телефон   •   ', sw = TWX(c, str, 24, 'Inter-Medium'), off = (t * 110) % sw;
      TX(c, str, X + 24 - off, Y + 166, 24, 'rgba(255,255,255,.9)', 'Inter-Medium'); TX(c, str, X + 24 - off + sw, Y + 166, 24, 'rgba(255,255,255,.9)', 'Inter-Medium'); });
  });

  /* =====================================================================
     Праздник и конфетти (без зелёного)
     ===================================================================== */
  A('f-party-burst', 'Конфетти-взрыв из центра', PA, 3, (c, t, D) => {
    const x0 = 512, y0 = 540, tc = .22, k = t - tc, fade = 1 - ss((t - (D - .6)) / .6);
    if (k < 0) { const pk = spr(t, 16, .5); circ(c, x0, y0, 16 * pk * (1 + .25 * Math.sin(t * 40)), '#FFD60A'); return; }
    if (k < .4) { const q = k / .4; c.save(); c.globalAlpha *= 1 - q; c.strokeStyle = '#fff'; c.lineWidth = 18 * (1 - q); circ(c, x0, y0, 40 + 240 * eo(q)); c.stroke(); c.restore(); }
    burst(c, x0, y0, t, tc, { n: 14, R: 230, s: 9, lines: true, ring: false, cols: ['#FFD60A', '#FF2D55', '#0A84FF'] });
    c.save(); c.globalAlpha *= fade;
    for (let i = 0; i < 90; i++) { const a = H(i, 1) * TAU, sp = 480 + H(i, 2) * 760, [dx, dy] = fly(k, Math.cos(a) * sp, Math.sin(a) * sp - 300, 3, 400), s = (9 + H(i, 3) * 9) * cl(k / .08);
      piece(c, x0 + dx, y0 + dy, s, H(i, 4) * TAU + k * (2 + H(i, 5) * 5) * (H(i, 6) > .5 ? 1 : -1), k * (5 + H(i, 7) * 9) + i, i % 5 === 4 ? 2 : i % 5 === 3 ? 1 : i % 11 === 0 ? 3 : 0, PAL[i % PAL.length]); }
    c.restore();
  });

  function popper(c) { c.save(); c.beginPath(); c.moveTo(-12, 0); c.lineTo(-84, -230); c.lineTo(84, -230); c.lineTo(12, 0); c.closePath(); sh(c, .8); c.fillStyle = '#FF2D55'; c.fill(); nosh(c); c.clip();
    c.fillStyle = '#FFD60A'; for (let i = -2; i < 8; i++) { c.beginPath(); c.moveTo(-120, -i * 48); c.lineTo(120, -i * 48 - 60); c.lineTo(120, -i * 48 - 84); c.lineTo(-120, -i * 48 - 24); c.closePath(); c.fill(); }
    c.fillStyle = grad(c, -84, 0, 84, 0, ['rgba(0,0,0,.2)', 'rgba(255,255,255,.2)', 'rgba(0,0,0,.25)']); c.fillRect(-90, -240, 180, 250); c.restore();
    c.beginPath(); c.ellipse(0, -230, 84, 22, 0, 0, TAU); c.fillStyle = grad(c, -84, 0, 84, 0, GOLD); c.fill(); c.beginPath(); c.ellipse(0, -230, 70, 15, 0, 0, TAU); c.fillStyle = '#4A1028'; c.fill();
    rr(c, -18, -8, 36, 24, 9); c.fillStyle = grad(c, -18, 0, 18, 0, GOLD); c.fill(); }
  A('f-party-popper', 'Хлопушка стреляет конфетти и серпантином', PA, 3, (c, t, D) => {
    const tc = .75, bx = 250, by = 840, th0 = Math.PI / 4, k = t - tc, fade = 1 - ss((t - (D - .5)) / .5), e = env(t, D, 0, .35);
    const shake = t < tc ? Math.sin(t * 52) * .035 * ss((t - .25) / .35) : 0, back = t > tc ? 34 * Math.sin(Math.PI * cl(k / .28)) : 0, mx = bx + 230 * Math.sin(th0), my = by - 230 * Math.cos(th0);
    if (k > 0) { c.save(); c.globalAlpha *= fade;
      for (let i = 0; i < 6; i++) { const a = -th0 + (H(i, 31) - .5) * .7, sp = 700 + H(i, 32) * 500, col = PAL[(i + 2) % 7]; c.strokeStyle = col; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); let st = false;
        for (let j = 0; j <= 16; j++) { const kk = k - j * .028; if (kk < 0) break; const [dx, dy] = fly(kk, Math.cos(a) * sp, Math.sin(a) * sp, 2.4, 520), wv = 16 * Math.sin(j * .9 + i + k * 9), x = mx + dx - Math.sin(a) * wv, y = my + dy + Math.cos(a) * wv; st ? c.lineTo(x, y) : (c.moveTo(x, y), st = true); } c.stroke(); }
      for (let i = 0; i < 64; i++) { const a = -th0 + (H(i, 11) - .5) * .8, sp = 600 + H(i, 12) * 820, [dx, dy] = fly(k, Math.cos(a) * sp, Math.sin(a) * sp, 2.4, 520), s = (8 + H(i, 13) * 8) * cl(k / .06);
        piece(c, mx + dx, my + dy, s, H(i, 14) * TAU + k * (3 + H(i, 15) * 5), k * (6 + H(i, 16) * 8) + i, i % 4 === 3 ? 1 : i % 9 === 0 ? 3 : 0, PAL[i % PAL.length]); }
      c.restore(); }
    burst(c, mx, my, t, tc, { n: 7, R: 110, s: 9, lines: true, ring: false, rot: -th0 - .9, cols: ['#fff'] });
    wk(c, bx, by, e, () => { c.save(); c.translate(bx - back * Math.sin(th0), by + back * Math.cos(th0)); c.rotate(th0 + shake); popper(c); c.restore(); });
  });

  A('f-party-salute', 'Салют: три залпа в небе', PA, 3.5, (c, t, D) => {
    const fade = 1 - ss((t - (D - .5)) / .5); c.save(); c.globalAlpha *= fade; const ga = c.globalAlpha;
    [[.1, 320, 330, ['#FFD60A', '#FFE9A0', '#FF9500']], [.55, 700, 280, ['#FF2D55', '#FF8AB8', '#FFFFFF']], [1.0, 520, 440, ['#5AC8FA', '#0A84FF', '#FFFFFF']]].forEach(([t0, x, yb, cols], si) => {
      const rt = t - t0, rise = .5; if (rt < 0) return;
      if (rt < rise) { for (let j = 0; j < 10; j++) { const q = eo(cl((rt - j * .025) / rise)); c.globalAlpha = ga * (1 - j / 10) * .9; circ(c, x + Math.sin(q * 6 + si) * 6, lerp(960, yb, q), 5.5 - j * .45, '#FFE2B0'); } c.globalAlpha = ga; return; }
      const k = rt - rise;
      if (k < .3) { const g = c.createRadialGradient(x, yb, 0, x, yb, 110); g.addColorStop(0, `rgba(255,255,255,${.85 * (1 - k / .3)})`); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x - 110, yb - 110, 220, 220); }
      for (let i = 0; i < 54; i++) { const a = i / 54 * TAU + H(si, i) * .1, sp = 400 * (.8 + .4 * H(i, si + 3)), q = k / 1.8; if (q >= 1) continue;
        const pos = kk => fly(kk, Math.cos(a) * sp, Math.sin(a) * sp, 1.8, 240), [x1, y1] = pos(k), [x2, y2] = pos(Math.max(0, k - .16)), col = cols[i % 3];
        c.globalAlpha = ga * Math.pow(1 - q, 1.3); c.strokeStyle = col; c.lineWidth = 7 * (1 - q * .6); c.lineCap = 'round'; c.beginPath(); c.moveTo(x + x2, yb + y2); c.lineTo(x + x1, yb + y1); c.stroke();
        if (q < .55 || Math.floor(t * 20 + i) % 3) circ(c, x + x1, yb + y1, 6 * (1 - q * .5), col); }
      c.globalAlpha = ga; });
    c.restore();
  });

  A('f-party-firework', 'Фейерверк: золотая ива', PA, 3.5, (c, t, D) => {
    const x = 512, yb = 400, t0 = .05, rise = .5, rt = t - t0, fade = 1 - ss((t - (D - .45)) / .45); if (rt < 0) return;
    c.save(); c.globalAlpha *= fade; const ga = c.globalAlpha;
    if (rt < rise) { for (let j = 0; j < 12; j++) { const q = eo(cl((rt - j * .025) / rise)); c.globalAlpha = ga * (1 - j / 12); circ(c, x, lerp(960, yb, q), 6 - j * .4, '#FFE2B0'); } c.restore(); return; }
    const k = rt - rise;
    if (k < .35) { const g = c.createRadialGradient(x, yb, 0, x, yb, 160); g.addColorStop(0, `rgba(255,240,200,${.9 * (1 - k / .35)})`); g.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = g; c.fillRect(x - 160, yb - 160, 320, 320); }
    const life = D - t0 - rise, q = k / life; c.lineCap = 'round';
    for (let i = 0; i < 60; i++) { const a = i / 60 * TAU + H(i, 9) * .08, sp = 500 * (.85 + .3 * H(i, 8)), pos = kk => fly(kk, Math.cos(a) * sp, Math.sin(a) * sp, 2.2, 330);
      let prev = pos(k); for (let m = 1; m <= 12; m++) { const kk = Math.max(0, k - m * .06), p2 = pos(kk); c.globalAlpha = ga * (1 - m / 12) * (1 - q * .7); c.strokeStyle = m < 3 ? '#FFF1C2' : '#FFC94D'; c.lineWidth = 4.5 - m * .3; c.beginPath(); c.moveTo(x + prev[0], yb + prev[1]); c.lineTo(x + p2[0], yb + p2[1]); c.stroke(); prev = p2; if (kk <= 0) break; }
      const hp = pos(k); c.globalAlpha = ga * (1 - q * .5); circ(c, x + hp[0], yb + hp[1], 3.8, '#FFF6D8');
      if (k > 1.1 && H(i, Math.floor(t * 15)) > .62) star4(c, x + hp[0], yb + hp[1], 11, '#fff', i); }
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU + .13, sp = 230, pos = kk => fly(kk, Math.cos(a) * sp, Math.sin(a) * sp, 2.4, 200), p1 = pos(k), p2 = pos(Math.max(0, k - .08)), qq = cl(k / 1.3); if (qq >= 1) continue;
      c.globalAlpha = ga * (1 - qq); c.strokeStyle = '#fff'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(x + p2[0], yb + p2[1]); c.lineTo(x + p1[0], yb + p1[1]); c.stroke(); }
    c.restore();
  });

  const BAL = [['#FF7A73', '#FF3B30', '#B3201A'], ['#FFE680', '#FFCC00', '#C79A00'], ['#7CC4FF', '#0A84FF', '#0050B0'], ['#D9A2F5', '#AF52DE', '#7A2BA8'], ['#FF8FB0', '#FF2D55', '#B8143A'], ['#FFC880', '#FF9500', '#B86200']];
  function balloon(c, x, y, r, cols, sway) { const ry = r * 1.18;
    c.save(); c.strokeStyle = 'rgba(255,255,255,.9)'; c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 4; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x, y + ry + 10); c.bezierCurveTo(x - sway * 30 + 14, y + ry + 80, x + sway * 30 - 14, y + ry + 150, x - sway * 20, y + ry + 230); c.stroke(); c.restore();
    c.beginPath(); c.moveTo(x, y + ry - 4); c.lineTo(x - 11, y + ry + 13); c.lineTo(x + 11, y + ry + 13); c.closePath(); c.fillStyle = cols[2]; c.fill();
    c.save(); sh(c, .5); c.beginPath(); c.moveTo(x, y - ry); c.bezierCurveTo(x + r * 1.08, y - ry, x + r * 1.02, y + ry * .45, x, y + ry); c.bezierCurveTo(x - r * 1.02, y + ry * .45, x - r * 1.08, y - ry, x, y - ry); c.closePath();
    const g = c.createRadialGradient(x - r * .35, y - ry * .4, r * .1, x, y, ry * 1.1); g.addColorStop(0, cols[0]); g.addColorStop(.5, cols[1]); g.addColorStop(1, cols[2]); c.fillStyle = g; c.fill(); c.restore();
    c.save(); c.globalAlpha *= .6; c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x - r * .4, y - ry * .38, r * .14, r * .28, .45, 0, TAU); c.fill(); c.restore(); }
  A('f-party-balloons', 'Воздушные шарики улетают вверх', PA, 3.5, (c, t, D) => {
    const B = [[230, .0, 78], [380, .25, 90], [530, .1, 84], [680, .35, 92], [820, .18, 76], [455, .5, 70]].map((b, i) => ({ x: b[0], t0: b[1], r: b[2], i })).sort((a, b) => a.r - b.r);
    B.forEach(({ x, t0, r, i }) => { const v = 280 + H(i, 3) * 80, y = 1150 - 380 * eo(cl((t - t0) / 1.0)) - v * Math.max(0, t - t0), s = Math.sin(t * 1.7 + i * 1.3); if (y > 1180 || y < -420) return;
      balloon(c, x + 24 * s, y, r, BAL[i], Math.cos(t * 1.7 + i * 1.3)); });
  });

  A('f-party-streamers', 'Серпантин падает и кружится', PA, 3, (c, t, D) => {
    const fade = cl(t / .15) * (1 - ss((t - (D - .5)) / .5)), cols = [['#FF2D55', '#B8143A'], ['#FFCC00', '#C79A00'], ['#0A84FF', '#0050B0'], ['#AF52DE', '#7A2BA8'], ['#FF9500', '#B86200'], ['#5AC8FA', '#2A8CC0']];
    c.save(); c.globalAlpha *= fade; c.lineCap = 'round';
    for (let i = 0; i < 9; i++) { const x0 = 110 + i * 100 + (H(i, 1) - .5) * 40, ts = H(i, 2) * .5, v = 380 + H(i, 3) * 160, L = 340 + H(i, 4) * 200, Am = 26 + H(i, 5) * 22, ph = H(i, 6) * TAU, [c1, c2] = cols[i % 6], hy = 120 + v * (t - ts);
      let prev = null; for (let j = 0; j <= 46; j++) { const s = j / 46 * L, y = hy - s, x = x0 + Am * Math.sin(s * .028 + ph + t * 3.2), tw = Math.cos(s * .045 + ph * 2 + t * 5);
        if (prev) { c.strokeStyle = tw > 0 ? c1 : c2; c.lineWidth = 3 + 13 * Math.abs(tw); c.beginPath(); c.moveTo(prev[0], prev[1]); c.lineTo(x, y); c.stroke(); } prev = [x, y]; } }
    for (let i = 0; i < 26; i++) { const ts = H(i, 21) * .8, v = 300 + H(i, 22) * 200, k = t - ts; if (k < 0) continue; piece(c, 60 + H(i, 23) * 904 + Math.sin(t * 2 + i) * 30, -20 + v * k, 9 + H(i, 24) * 6, k * 3 + i, k * 7 + i, i % 3 === 2 ? 1 : 0, PAL[i % 7]); }
    c.restore();
  });

  // слово по буквам с пружинкой
  function popWord(c, s, cx, y, px, font, t, t0, col, shCol, step = .045) { const tw = TWX(c, s, px, font); let x = cx - tw / 2;
    for (let i = 0; i < s.length; i++) { const cw = TWX(c, s.slice(0, i + 1), px, font) - TWX(c, s.slice(0, i), px, font), k = spr(t - t0 - i * step, 14, .45);
      if (k > 0 && s[i] !== ' ') { c.save(); c.translate(x + cw / 2, y + px * .3); c.scale(k, k); c.translate(-(x + cw / 2), -(y + px * .3)); c.globalAlpha *= cl((t - t0 - i * step) / .08);
        if (shCol) TX(c, s[i], x + 6, y + 8, px, shCol, font); c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 20; c.shadowOffsetY = 8; TX(c, s[i], x, y, px, col, font); c.restore(); }
      x += cw; } }
  A('f-party-hb', '«С днём рождения!» и гирлянда флажков', PA, 3.5, (c, t, D) => {
    const o = ein(cl((t - (D - .35)) / .35)), gk = spr(t, 9, .55), FC = ['#FF2D55', '#FFCC00', '#0A84FF', '#AF52DE', '#FF9500'];
    c.save(); c.globalAlpha *= 1 - o;
    c.save(); c.translate(0, (1 - gk) * -380); const P0 = [110, 230], P1 = [512, 380], P2 = [914, 230], B = s => [(1 - s) * (1 - s) * P0[0] + 2 * (1 - s) * s * P1[0] + s * s * P2[0], (1 - s) * (1 - s) * P0[1] + 2 * (1 - s) * s * P1[1] + s * s * P2[1]];
    c.save(); tsh(c, .3, 8, 2); c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.moveTo(P0[0], P0[1]); c.quadraticCurveTo(P1[0], P1[1], P2[0], P2[1]); c.stroke(); c.restore();
    for (let f = 0; f < 9; f++) { const s = (f + .5) / 9, [x, y] = B(s), [x2, y2] = B(s + .01), a = Math.atan2(y2 - y, x2 - x) + Math.sin(t * 3 + f) * .07 * (1 + 2 * (1 - cl(gk)));
      c.save(); c.translate(x, y); c.rotate(a); sh(c, .35); c.beginPath(); c.moveTo(-36, 0); c.lineTo(36, 0); c.lineTo(0, 88); c.closePath(); c.fillStyle = FC[f % 5]; c.fill(); nosh(c); c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.moveTo(-36, 0); c.lineTo(36, 0); c.lineTo(30, 10); c.lineTo(-30, 10); c.closePath(); c.fill(); c.restore(); }
    c.restore();
    popWord(c, 'С днём', 512, 540, 128, 'Lobster', t, .45, '#fff', '#FF2D55'); popWord(c, 'рождения!', 512, 690, 128, 'Lobster', t, .7, '#fff', '#FF2D55');
    c.restore();
    confetti(c, 512, 640, t, 1.3, 30, 460);
  });

  A('f-party-hooray', '«УРА!» прыгает по буквам с лучами', PA, 3, (c, t, D) => {
    const o = ein(cl((t - (D - .35)) / .35)), s = 'УРА!', f = 'Unbounded-ExtraBold'; let px = 230; const tw0 = TWX(c, s, px, f); if (tw0 > 620) px *= 620 / tw0; const tw = TWX(c, s, px, f);
    c.save(); c.globalAlpha *= 1 - o; c.translate(512, 512); c.scale(1 - .3 * o, 1 - .3 * o); c.translate(-512, -512);
    const rk = spr(t - .45, 10, .6); if (rk > 0) { c.lineCap = 'round'; for (let i = 0; i < 20; i++) { const a = i / 20 * TAU + t * .25, len = (50 + 30 * Math.sin(t * 6 + i)) * cl(rk), rx = 410 + (i % 2) * 22, ry = 250 + (i % 2) * 22, ca = Math.cos(a), sa = Math.sin(a);
      c.strokeStyle = ['#FFD60A', '#FF2D55', '#0A84FF', '#FF9500'][i % 4]; c.lineWidth = 13; c.beginPath(); c.moveTo(512 + ca * rx, 512 + sa * ry); c.lineTo(512 + ca * (rx + len), 512 + sa * (ry + len)); c.stroke(); } }
    let x = 512 - tw / 2; c.font = `${px}px "${f}"`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    for (let i = 0; i < s.length; i++) { const cw = TWX(c, s.slice(0, i + 1), px, f) - TWX(c, s.slice(0, i), px, f), k = spr(t - .1 - i * .09, 13, .4), jump = t > .9 ? Math.max(0, Math.sin((t - .9 - i * .12) * 5.5)) : 0, sq = 1 + .08 * (1 - jump) * (t > .9 ? 1 : 0);
      if (k > 0) { c.save(); c.translate(x + cw / 2, 512 + px * .45 - jump * 46); c.scale(k / sq, k * sq); c.translate(-(x + cw / 2), -(512 + px * .45)); c.font = `${px}px "${f}"`;
        c.save(); tsh(c, .3, 24, 10); c.lineWidth = 18; c.strokeStyle = '#fff'; c.strokeText(s[i], x, 512); c.restore();
        c.fillStyle = grad(c, 0, 512 - px * .5, 0, 512 + px * .5, ['#FFE14D', '#FF9500', '#FF2D55']); c.fillText(s[i], x, 512); c.restore(); }
      x += cw; }
    [[200, 300], [830, 310], [250, 730], [790, 720], [512, 250]].forEach(([sx, sy], i) => { const tw2 = Math.max(0, Math.sin((t * 1.6 + i * .37) * TAU)) * cl((t - .6 - i * .08) / .2); star4(c, sx, sy, 26 * tw2, i % 2 ? '#FFD60A' : '#fff'); });
    c.restore();
    confetti(c, 512, 470, t, .55, 30, 440);
  });

  A('f-party-congrats', 'Лента «Поздравляем!» разворачивается', PA, 3.5, (c, t, D) => {
    const o = ein(cl((t - (D - .35)) / .35)), m = spr(t - .1, 9, .7), cy = 512, w = 740, h = 132;
    c.save(); c.globalAlpha *= 1 - o; c.translate(512, cy); c.scale(1 - .2 * o, 1 - .2 * o); c.translate(-512, -cy);
    c.save(); sh(c, .7); ribbon(c, 512, cy, w, h, m, '#FF4D6D', '#E0193F', '#B3123A', '#7E0B28'); c.restore();
    const ww = w * Math.max(0, Math.min(1, m)); c.save(); c.beginPath(); c.rect(512 - ww / 2, cy - h / 2, ww, h); c.clip(); const tq = eo(cl((t - .35) / .4));
    c.save(); c.globalAlpha *= tq; TX(c, 'Поздравляем!', 512, cy + (1 - tq) * 30, 68, '#fff', 'Montserrat-ExtraBold', 'center'); c.restore(); shine(c, 512 - w / 2, cy - h / 2, w, h, cl((t - 1.2) / .8), .45); c.restore();
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + .3, sx = 512 + Math.cos(a) * (430 + H(i, 2) * 40), sy = cy + Math.sin(a) * (170 + H(i, 3) * 50), k = spr(t - .8 - i * .06, 14, .5), tw2 = .6 + .4 * Math.sin(t * 7 + i * 2);
      if (k > 0) star4(c, sx, sy, (16 + H(i, 4) * 16) * k * tw2, i % 3 ? '#FFD60A' : '#fff', t * .8); }
    c.restore();
    confetti(c, 512, cy - 40, t, .7, 30, 440);
  });

  function tier(c, x, y, w, h, body, cream, seed) { c.save(); sh(c, .5); rr(c, x, y, w, h, 26); c.fillStyle = body; c.fill(); c.restore();
    c.save(); rr(c, x, y, w, h, 26); c.clip();
    for (let i = 0; i < 14; i++) { const sx = x + 24 + H(i, seed + 10) * (w - 48), sy = y + h * .62 + H(i, seed + 20) * (h * .3); c.save(); c.translate(sx, sy); c.rotate(H(i, seed + 30) * TAU); rr(c, -9, -3, 18, 6, 3); c.fillStyle = ['#FF3B30', '#FFCC00', '#0A84FF', '#AF52DE', '#FF9500'][i % 5]; c.fill(); c.restore(); }
    const hb = h * .24, n = Math.round(w / 48), st = w / n; c.beginPath(); c.moveTo(x - 2, y - 2); c.lineTo(x + w + 2, y - 2); c.lineTo(x + w + 2, y + hb);
    for (let k = n - 1; k >= 0; k--) { const xm = x + (k + .5) * st, d = hb + 12 + H(k, seed) * 30, rw = st * .3; c.lineTo(xm + rw, y + hb); c.lineTo(xm + rw, y + d); c.arc(xm, y + d, rw, 0, Math.PI); c.lineTo(xm - rw, y + hb); }
    c.lineTo(x - 2, y + hb); c.closePath(); c.fillStyle = cream; c.fill();
    c.fillStyle = grad(c, x, 0, x + w, 0, ['rgba(0,0,0,.1)', 'rgba(0,0,0,0)', 'rgba(255,255,255,.08)', 'rgba(0,0,0,.12)']); c.fillRect(x, y, w, h); c.restore(); }
  A('f-party-cake', 'Торт: свечу задувают', PA, 3.5, (c, t, D) => {
    const e = env(t, D, 0, .35), tb = 2.0;
    wk(c, 512, 800, e, () => {
      c.save(); sh(c, .7); c.beginPath(); c.ellipse(512, 800, 285, 34, 0, 0, TAU); c.fillStyle = '#E5E5EA'; c.fill(); c.restore(); c.beginPath(); c.ellipse(512, 795, 258, 24, 0, 0, TAU); c.fillStyle = '#fff'; c.fill();
      tier(c, 292, 612, 440, 182, '#FFF3E8', '#FF8FB1', 1); tier(c, 362, 478, 300, 140, '#FFE1EA', '#FF4D85', 2);
      c.save(); rr(c, 500, 372, 24, 108, 7); c.fillStyle = '#fff'; c.fill(); c.clip(); c.fillStyle = '#5AC8FA'; for (let j = 0; j < 7; j++) { c.beginPath(); c.moveTo(498, 372 + j * 22); c.lineTo(526, 362 + j * 22); c.lineTo(526, 372 + j * 22); c.lineTo(498, 382 + j * 22); c.closePath(); c.fill(); } c.restore();
      c.strokeStyle = '#3A3A3C'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(512, 372); c.lineTo(512, 358); c.stroke();
      if (t < tb + .3) { const bt = cl((t - tb) / .3), fl = 1 + .08 * Math.sin(t * 31) + .05 * Math.sin(t * 17), sc = 1 - ein(bt);
        c.save(); const g = c.createRadialGradient(512, 330, 0, 512, 330, 90); g.addColorStop(0, `rgba(255,200,90,${.45 * sc})`); g.addColorStop(1, 'rgba(255,200,90,0)'); c.fillStyle = g; c.fillRect(420, 240, 184, 184);
        c.translate(512, 356); c.rotate(bt * .9 + Math.sin(t * 9) * .04); c.scale(sc * fl, sc / fl);
        c.beginPath(); c.moveTo(0, -60); c.bezierCurveTo(24, -30, 22, 0, 0, 3); c.bezierCurveTo(-22, 0, -24, -30, 0, -60); c.fillStyle = grad(c, 0, -60, 0, 3, ['#FFE36B', '#FFB020', '#FF6A1A']); c.fill();
        c.beginPath(); c.moveTo(0, -30); c.bezierCurveTo(10, -16, 9, -2, 0, 0); c.bezierCurveTo(-9, -2, -10, -16, 0, -30); c.fillStyle = 'rgba(255,255,240,.9)'; c.fill(); c.restore(); }
      if (t > tb + .15) { const sk = t - tb - .15; c.save(); c.globalAlpha *= cl(1 - sk / 1.2) * .75; c.strokeStyle = '#D1D1D6'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath();
        for (let j = 0; j <= 30; j++) { const s = j / 30, y = 352 - s * 190 * cl(sk / .8 + .1), x = 512 + Math.sin(s * 7 - t * 4) * 16 * s; j ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.restore(); }
    });
    confetti(c, 512, 400, t, tb + .2, 30, 420);
  });

  function flute(c, t, seed) { const bowl = new Path2D(); bowl.moveTo(-46, -300); bowl.lineTo(46, -300); bowl.bezierCurveTo(44, -200, 30, -122, 5, -108); bowl.lineTo(-5, -108); bowl.bezierCurveTo(-30, -122, -44, -200, -46, -300); bowl.closePath();
    c.save(); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(0, 0, 54, 12, 0, 0, TAU); c.fill(); c.fillRect(-4, -110, 8, 110); c.restore();
    c.fillStyle = 'rgba(255,255,255,.16)'; c.fill(bowl);
    c.save(); c.clip(bowl); const ly = -250; c.fillStyle = grad(c, 0, ly, 0, -108, ['#FFE38A', '#F5B83D']); c.fillRect(-60, ly, 120, 200); c.fillStyle = 'rgba(255,255,255,.65)'; c.fillRect(-60, ly - 3, 120, 6);
    for (let b = 0; b < 10; b++) { const ph = (t * (.6 + H(b, seed) * .5) + H(b, seed + 1)) % 1, by = lerp(-116, ly + 8, ph), hw = lerp(6, 40, (-108 - by) / 190); circ(c, (H(b, seed + 2) - .5) * 1.4 * hw, by, 2.5 + H(b, seed + 3) * 2.5, 'rgba(255,255,255,.8)'); }
    c.restore();
    c.save(); c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,.92)'; c.stroke(bowl); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(-30, -280); c.bezierCurveTo(-30, -220, -24, -172, -14, -142); c.stroke(); c.restore(); }
  A('f-party-cheers', 'Бокалы чокаются с искрами', PA, 3, (c, t, D) => {
    const tc = .75, e = env(t, D, 0, .35), a = t < tc ? lerp(-.35, .2, eio(cl((t - .12) / (tc - .12)))) : .2 - .1 * Math.sin((t - tc) * 12) * Math.exp(-(t - tc) * 4);
    wk(c, 512, 840, e, () => {
      c.save(); tsh(c, .3, 20, 8); c.save(); c.translate(403, 840); c.rotate(a); flute(c, t, 1); c.restore(); c.save(); c.translate(621, 840); c.scale(-1, 1); c.rotate(a); flute(c, t, 5); c.restore(); c.restore();
      burst(c, 512, 552, t, tc, { n: 10, R: 130, s: 8, lines: true, ring: false, cols: ['#FFD60A', '#fff'] });
      const k = t - tc; if (k > 0 && k < 1) { for (let i = 0; i < 9; i++) { const an = -Math.PI / 2 + (H(i, 3) - .5) * 2.2, sp = 260 + H(i, 4) * 240, [dx, dy] = fly(k, Math.cos(an) * sp, Math.sin(an) * sp, 1.2, 1100); c.save(); c.globalAlpha *= 1 - k; circ(c, 512 + dx, 552 + dy, 5 + H(i, 5) * 4, '#FFD45A'); c.restore(); }
        [[440, 470], [590, 460], [512, 410]].forEach(([sx, sy], i) => { const q = cl((k - i * .08) / .6); if (q > 0 && q < 1) star4(c, sx, sy, 34 * Math.sin(Math.PI * q), '#fff', q * 2); }); }
    });
  });

  A('f-party-sparkler', 'Бенгальский огонь искрит', PA, 3.5, (c, t, D) => {
    const a0 = cl(t / .25) * (1 - ss((t - (D - .4)) / .4)); if (a0 <= 0) return;
    const bx = 330, by = 900, rot = .45 + Math.sin(t * 2.2) * .1, tipL = 560 - 300 * (t / D), sr = Math.sin(rot), cr = Math.cos(rot), P = l => [bx + l * sr, by - l * cr], [tx, ty] = P(tipL);
    c.save(); c.globalAlpha *= a0; c.lineCap = 'round';
    c.strokeStyle = '#A1A1A6'; c.lineWidth = 6; c.beginPath(); c.moveTo(...P(0)); c.lineTo(...P(200)); c.stroke();
    c.strokeStyle = '#5A5A5E'; c.lineWidth = 13; c.beginPath(); c.moveTo(...P(200)); c.lineTo(...P(tipL)); c.stroke();
    c.save(); c.globalAlpha *= .6; c.strokeStyle = '#3A3A3C'; c.lineWidth = 3; c.beginPath(); c.moveTo(...P(tipL)); c.lineTo(...P(560)); c.stroke(); c.restore();
    const fl = .85 + .15 * Math.sin(t * 37), g = c.createRadialGradient(tx, ty, 0, tx, ty, 110 * fl); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.15, 'rgba(255,240,190,.9)'); g.addColorStop(.45, 'rgba(255,190,80,.3)'); g.addColorStop(1, 'rgba(255,170,60,0)'); c.fillStyle = g; c.fillRect(tx - 120, ty - 120, 240, 240);
    const fr = Math.floor(t * 24);
    [[fr, 1], [fr - 1, .45]].forEach(([f, al]) => { for (let i = 0; i < 30; i++) { const hh = j => H(i + f * 37, j), an = hh(1) * TAU, len = 40 + hh(2) * 150, r0 = 10 + hh(3) * 18, ca = Math.cos(an), sa = Math.sin(an), x1 = tx + ca * r0, y1 = ty + sa * r0, x2 = tx + ca * (r0 + len), y2 = ty + sa * (r0 + len);
      const lg = c.createLinearGradient(x1, y1, x2, y2); lg.addColorStop(0, `rgba(255,255,255,${al})`); lg.addColorStop(.6, `rgba(255,214,120,${al * .9})`); lg.addColorStop(1, 'rgba(255,170,60,0)'); c.strokeStyle = lg; c.lineWidth = 2.6; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      if (hh(4) > .6) { c.strokeStyle = `rgba(255,230,160,${al * .8})`; c.lineWidth = 2; [-.6, .6].forEach(d => { c.beginPath(); c.moveTo(x2 - ca * 8, y2 - sa * 8); c.lineTo(x2 - ca * 8 + Math.cos(an + d) * 20, y2 - sa * 8 + Math.sin(an + d) * 20); c.stroke(); }); } } });
    for (let i = 0; i < 14; i++) { const p = (t * 1.4 + H(i, 5)) % 1, vx = (H(i, 6) - .5) * 260; circ(c, tx + vx * p, ty - 60 * p + 420 * p * p, 3 * (1 - p), `rgba(255,220,140,${1 - p})`); }
    c.restore();
  });

  A('f-party-glitter', 'Звёздочки-блёстки мерцают', PA, 2.5, (c, t, D) => {
    const fade = cl(t / .2) * (1 - ss((t - (D - .35)) / .35)), SC = ['#FFFFFF', '#FFE08A', '#FFC2E0', '#BDE3FF'];
    c.save(); c.globalAlpha *= fade;
    for (let i = 0; i < 22; i++) { const a = H(i, 1) * TAU, rad = 90 + H(i, 2) * 300, x = 512 + Math.cos(a) * rad * 1.15, y = 512 + Math.sin(a) * rad * .95, r0 = 24 + H(i, 3) * 46, f = 1.1 + H(i, 4) * 1.3;
      const tw = Math.pow(Math.max(0, Math.sin((t * f + H(i, 5)) * TAU)), 1.5), ap = cl(spr(t - H(i, 6) * .5, 14, .5)), s = r0 * (.2 + .8 * tw) * ap, col = SC[i % 4];
      c.save(); c.shadowColor = col; c.shadowBlur = 22; star4(c, x, y, s, col, t * .6 * (i % 2 ? 1 : -1)); c.restore(); circ(c, x, y, s * .12, '#fff'); }
    c.restore();
  });

  function flake(c, x, y, r, rot, lw) { c.save(); c.translate(x, y); c.rotate(rot); c.lineWidth = lw; c.lineCap = 'round'; c.beginPath();
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, ca = Math.cos(a), sa = Math.sin(a); c.moveTo(0, 0); c.lineTo(ca * r, sa * r); [[.5, .32], [.78, .2]].forEach(([p, bl]) => { const bx = ca * r * p, by = sa * r * p; [-.75, .75].forEach(d => { c.moveTo(bx, by); c.lineTo(bx + Math.cos(a + d) * r * bl, by + Math.sin(a + d) * r * bl); }); }); }
    c.stroke(); c.restore(); }
  A('f-party-newyear', '«С Новым годом!» и снежинки', PA, 3.5, (c, t, D) => {
    const fade = cl(t / .3) * (1 - ss((t - (D - .4)) / .4)), o = ein(cl((t - (D - .35)) / .35));
    c.save(); c.globalAlpha *= fade; c.strokeStyle = '#fff'; c.shadowColor = 'rgba(120,190,255,.85)'; c.shadowBlur = 12;
    for (let i = 0; i < 24; i++) { const r = 12 + H(i, 1) * 26, v = 70 + H(i, 2) * 90 + r * 2, y = ((H(i, 3) * 1200 + v * t) % 1200) - 90, x = 60 + H(i, 4) * 904 + Math.sin(t * 1.3 + i) * 26; flake(c, x, y, r, t * (.4 + H(i, 5)) * (i % 2 ? 1 : -1), Math.max(2.2, r * .13)); }
    c.restore();
    ['С Новым', 'годом!'].forEach((s, j) => { const t0 = .3 + j * .18, k = spr(t - t0, 12, .5); if (k <= 0) return; c.save(); c.globalAlpha *= cl((t - t0) / .1) * (1 - o); c.translate(512, 440 + j * 150); c.scale(k * (1 - .2 * o), k * (1 - .2 * o));
      c.shadowColor = 'rgba(90,170,255,.9)'; c.shadowBlur = 34; TX(c, s, 0, 0, 140, '#fff', 'Lobster', 'center'); c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 14; c.shadowOffsetY = 6; TX(c, s, 0, 0, 140, '#fff', 'Lobster', 'center'); c.restore(); });
  });

  A('f-party-gift', 'Подарок: крышка с бантом взлетает', PA, 3.5, (c, t, D) => {
    const tp = 1.55, e = env(t, D, 0, .35), dk = spr(t, 10, .5), dy = (1 - dk) * -520, w1 = Math.sin(Math.PI * cl((t - .75) / .3)), w2 = Math.sin(Math.PI * cl((t - 1.15) / .3)), wig = t < tp ? Math.sin(t * 40) * .05 * (w1 + w2) : 0;
    const lk = spr(t - tp, 10, .55), ly = -230 * lk, lr = -.35 * cl(lk), gold = x0 => grad(c, x0 - 22, 0, x0 + 22, 0, GOLD);
    wk(c, 512, 800, e, () => { c.save(); c.translate(0, dy); c.translate(512, 800); c.rotate(wig); c.translate(-512, -800);
      if (t > tp) { const rk = eo(cl((t - tp) / .4)); c.save(); c.globalAlpha *= rk * .9; for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * .2 + Math.sin(t * 1.5 + i) * .03, L = 400 * rk; c.beginPath(); c.moveTo(512, 562); c.lineTo(512 + Math.cos(a - .06) * L, 562 + Math.sin(a - .06) * L); c.lineTo(512 + Math.cos(a + .06) * L, 562 + Math.sin(a + .06) * L); c.closePath();
        const g = c.createRadialGradient(512, 562, 0, 512, 562, Math.max(1, L)); g.addColorStop(0, 'rgba(255,240,180,.95)'); g.addColorStop(1, 'rgba(255,240,180,0)'); c.fillStyle = g; c.fill(); } c.restore(); }
      c.save(); sh(c, .9); rr(c, 352, 560, 320, 240, 18); c.fillStyle = grad(c, 352, 0, 672, 0, ['#FF5A4F', '#E8302A', '#C9221D']); c.fill(); c.restore();
      c.fillStyle = gold(512); c.fillRect(490, 560, 44, 240); if (t > tp) { c.fillStyle = 'rgba(90,10,10,.55)'; c.fillRect(356, 560, 312, 16); }
      c.save(); c.translate(512, 560 + ly); c.rotate(lr); sh(c, .7); rr(c, -180, -70, 360, 74, 16); c.fillStyle = grad(c, -180, 0, 180, 0, ['#FF6A5F', '#F03A33', '#D42A24']); c.fill(); nosh(c); c.fillStyle = gold(0); c.fillRect(-22, -70, 44, 74);
      c.translate(0, -70); [-1, 1].forEach(d => { c.beginPath(); c.ellipse(d * 52, -26, 58, 30, d * -.5, 0, TAU); c.fillStyle = grad(c, d * 52 - 58, 0, d * 52 + 58, 0, GOLD); c.fill(); c.beginPath(); c.ellipse(d * 50, -26, 28, 11, d * -.5, 0, TAU); c.fillStyle = 'rgba(140,90,0,.4)'; c.fill(); });
      circ(c, 0, -14, 22, '#FFC93C'); circ(c, -6, -20, 7, 'rgba(255,255,255,.5)'); c.restore();
      c.restore(); });
    burst(c, 512, 520, t, tp, { n: 14, R: 260, s: 10, lines: true, ring: false, cols: ['#FFD60A', '#FF2D55', '#fff'] }); confetti(c, 512, 520, t, tp + .05, 34, 460);
  });

  A('f-party-cup', 'Кубок «Победа!» с лучами', PA, 3.5, (c, t, D) => {
    const e = env(t, D, 0, .35), G2 = (x0, x1) => grad(c, x0, 0, x1, 0, GOLD), rk = eo(cl((t - .35) / .5)) * e.a;
    if (rk > 0) { c.save(); c.globalAlpha *= rk; c.translate(512, 430); c.rotate(t * .25); const g = c.createRadialGradient(0, 0, 0, 0, 0, 400); g.addColorStop(0, 'rgba(255,214,10,.45)'); g.addColorStop(1, 'rgba(255,214,10,0)'); c.fillStyle = g;
      for (let i = 0; i < 16; i += 2) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 400, i / 16 * TAU, (i + 1) / 16 * TAU); c.closePath(); c.fill(); } c.restore(); }
    wk(c, 512, 720, e, () => {
      c.save(); c.lineWidth = 22; c.lineCap = 'round'; c.strokeStyle = G2(310, 714); [-1, 1].forEach(d => { c.beginPath(); c.moveTo(512 + d * 104, 344); c.bezierCurveTo(512 + d * 200, 340, 512 + d * 196, 470, 512 + d * 70, 486); c.stroke(); }); c.restore();
      const bowl = new Path2D(); bowl.moveTo(392, 312); bowl.lineTo(632, 312); bowl.bezierCurveTo(632, 460, 590, 540, 512, 548); bowl.bezierCurveTo(434, 540, 392, 460, 392, 312); bowl.closePath();
      c.save(); sh(c, .8); c.fillStyle = G2(392, 632); c.fill(bowl); c.restore();
      ic(c, 'star', 512, 422, 100, 'rgba(150,95,0,.4)'); ic(c, 'star', 512, 418, 100, '#FFF1B0');
      c.save(); c.clip(bowl); shine(c, 392, 312, 240, 240, cl((t - .9) / .7), .7); c.restore();
      rr(c, 380, 298, 264, 28, 14); c.fillStyle = grad(c, 380, 0, 644, 0, ['#C8961E', '#FFF1B0', '#FFD45A', '#C08A14']); c.fill();
      c.fillStyle = G2(494, 530); c.fillRect(494, 546, 36, 60); rr(c, 466, 598, 92, 24, 12); c.fillStyle = G2(466, 558); c.fill();
      c.beginPath(); c.moveTo(452, 620); c.lineTo(572, 620); c.lineTo(600, 678); c.lineTo(424, 678); c.closePath(); c.fillStyle = G2(424, 600); c.fill();
      c.save(); sh(c, .6); rr(c, 402, 676, 220, 52, 10); c.fillStyle = '#3A2A20'; c.fill(); c.restore(); rr(c, 452, 689, 120, 26, 6); c.fillStyle = G2(452, 572); c.fill();
    });
    const m = spr(t - .6, 10, .7); if (m > 0) { c.save(); c.globalAlpha *= e.a; c.translate(512, 816); c.scale(e.k > 1 ? 1 : Math.max(0, e.k), e.k > 1 ? 1 : Math.max(0, e.k)); c.translate(-512, -816); sh(c, .6);
      ribbon(c, 512, 816, 500, 92, m, '#FF3B5C', '#D91A3D', '#A8102F', '#6E0A1F'); nosh(c); const ww = 500 * cl(m); c.beginPath(); c.rect(512 - ww / 2, 770, ww, 92); c.clip(); TX(c, 'ПОБЕДА!', 512, 816, 48, '#FFF1B0', 'Unbounded-ExtraBold', 'center'); c.restore(); }
    [[300, 300], [730, 280], [250, 560], [780, 540], [690, 180]].forEach(([sx, sy], i) => { const tw2 = Math.max(0, Math.sin((t * 1.3 + i * .29) * TAU)) * cl((t - .7 - i * .1) / .2) * e.a; star4(c, sx, sy, 28 * tw2, i % 2 ? '#FFE58A' : '#fff', t); });
  });

  A('f-party-1k', '«1 000 подписчиков!» с конфетти', PA, 4, (c, t, D) => {
    const e = env(t, D, 0, .35), tr = 1.9, v = 1000 * (1 - Math.pow(1 - cl((t - .35) / (tr - .35)), 3)), done = t >= tr, pulse = done ? 1 + .08 * Math.sin(Math.PI * cl((t - tr) / .3)) : 1;
    const k = t - tr; if (k > 0) { c.save(); c.globalAlpha *= 1 - ss((t - (D - .5)) / .5);
      for (let i = 0; i < 80; i++) { const a = -Math.PI / 2 + (H(i, 5) - .5) * 2.9, sp = 820 + H(i, 7) * 520, [dx, dy] = fly(k, Math.cos(a) * sp, Math.sin(a) * sp, 2.4, 640);
        piece(c, 512 + dx, 500 + dy, (8 + H(i, 9) * 8) * cl(k / .06), H(i, 2) * TAU + k * 4, k * (6 + H(i, 3) * 6) + i, i % 5 === 4 ? 2 : i % 4 === 3 ? 1 : i % 13 === 0 ? 3 : 0, PAL[i % PAL.length]); }
      c.restore(); }
    burst(c, 512, 500, t, tr, { n: 14, R: 470, s: 13, lw: 14, ring: false, cols: ['#FFD60A', '#FF2D55', '#0A84FF', '#AF52DE'] });
    wk(c, 512, 512, { k: e.k * pulse, a: e.a }, () => {
      card(c, 152, 360, 720, 310, 60, '#fff', 1);
      c.save(); sh(c, .5); circ(c, 512, 360, 62, '#fff'); c.restore(); circ(c, 512, 360, 52, grad(c, 460, 308, 564, 412, ['#FF5E7E', '#FF9500'])); ic(c, 'person', 512, 362, 60, '#fff');
      const px = 150, vv = done ? 1000 : Math.min(999.99, v), nd = String(Math.floor(vv)).length, ow = odoW(c, nd, px); odo(c, vv, 512 - ow / 2, 498, px, '#111', nd);
      TX(c, 'подписчиков!', 512, 606, 50, '#FF2D55', 'Inter-Bold', 'center');
    });
  });

  A('f-party-surprise', 'Лента «Сюрприз!» разматывается', PA, 3.5, (c, t, D) => {
    const o = ein(cl((t - (D - .35)) / .35)), p = eio(cl((t - .25) / .8)), w = 780, h = 140, x0 = -w / 2, xr = x0 + w * p, tl = spr(t - .1, 12, .6), tr2 = spr(t - 1.05, 12, .6);
    if (t < .1) return;
    c.save(); c.globalAlpha *= cl((t - .1) / .1) * (1 - o); c.translate(512, 540); c.rotate(-.07); c.scale(1 - .15 * o, 1 - .15 * o);
    const tail = (d, k) => { if (k <= 0) return; const ex = d * w / 2, xa = ex - d * 46, xb = ex + d * 96 * k, yt = -h / 2 + 30, yb = h / 2 + 30; c.beginPath(); c.moveTo(xa, yt); c.lineTo(xb, yt); c.lineTo(xb - d * 34 * cl(k), 30); c.lineTo(xb, yb); c.lineTo(xa, yb); c.closePath(); c.fillStyle = d < 0 ? '#6C2BD9' : '#C21F75'; c.fill();
      c.beginPath(); c.moveTo(xa, h / 2); c.lineTo(ex, h / 2); c.lineTo(ex, yb); c.closePath(); c.fillStyle = d < 0 ? '#45179A' : '#86124F'; c.fill(); };
    tail(-1, tl); if (p >= 1) tail(1, tr2);
    c.save(); sh(c, .7); rr(c, x0, -h / 2, Math.max(1, xr - x0), h, 10); c.fillStyle = grad(c, x0, 0, x0 + w, 0, ['#8E5CFF', '#FF3D9A']); c.fill(); c.restore();
    c.save(); c.beginPath(); c.rect(x0, -h / 2, xr - x0, h); c.clip(); c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(x0, -h / 2 + 10, w, 4); c.fillRect(x0, h / 2 - 14, w, 4);
      TX(c, 'СЮРПРИЗ!', 0, 0, 84, '#fff', 'Montserrat-Black', 'center', 2); shine(c, x0, -h / 2, w, h, cl((t - 1.3) / .8), .45); c.restore();
    if (p < 1) { const rw = 30 * (1 - p) + 16; c.save(); sh(c, .5); rr(c, xr - rw / 2, -h / 2 - 8, rw, h + 16, rw / 2); c.fillStyle = grad(c, xr - rw / 2, 0, xr + rw / 2, 0, ['#C79BFF', '#FF6BB5', '#A82A6E']); c.fill(); c.restore(); }
    c.restore();
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + .4, k = spr(t - 1.1 - i * .06, 14, .5), tw2 = .6 + .4 * Math.sin(t * 7 + i * 2); if (k > 0) star4(c, 512 + Math.cos(a) * 440, 540 + Math.sin(a) * 160 - Math.cos(a) * 30, 22 * k * tw2 * (1 - o), i % 2 ? '#FFD60A' : '#fff', t); }
  });

  A('f-party-hearts', 'Сердца-салют', PA, 3.5, (c, t, D) => {
    const fade = 1 - ss((t - (D - .45)) / .45); c.save(); c.globalAlpha *= fade; const ga = c.globalAlpha;
    [[.1, 330, 360, ['#FF2D55', '#FF8AAE']], [.5, 700, 300, ['#FF3B30', '#FFB0BA']], [.9, 520, 440, ['#FF5FA2', '#FFC2D6']]].forEach(([t0, x, yb, cols], si) => {
      const rt = t - t0, rise = .55; if (rt < 0) return;
      if (rt < rise) { for (let j = 6; j >= 1; j--) { const qq = eo(cl((rt - j * .04) / rise)); c.globalAlpha = ga * (1 - j / 7); circ(c, x + Math.sin(qq * 9) * 14 * (1 - qq), lerp(980, yb, qq), 9 - j * 1.1, cols[1]); }
        const q = eo(rt / rise); c.globalAlpha = ga; ic(c, 'heart', x + Math.sin(q * 9) * 14 * (1 - q), lerp(980, yb, q), 62, cols[0]); return; }
      const k = rt - rise, q = k / 1.6; if (q >= 1) return;
      if (k < .3) { c.globalAlpha = ga * (1 - k / .3); c.strokeStyle = cols[1]; c.lineWidth = 10 * (1 - k / .3); circ(c, x, yb, 30 + 150 * eo(k / .3)); c.stroke(); }
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + si, sp = 420 * (.85 + .3 * H(i, si + 7)), [dx, dy] = fly(k, Math.cos(a) * sp, Math.sin(a) * sp, 2, 300);
        c.globalAlpha = ga * Math.pow(1 - q, 1.2); ic(c, 'heart', x + dx, yb + dy, (40 + 18 * H(i, si)) * (1 - q * .4), cols[i % 2], 0, (H(i, si + 2) - .5) * .7); }
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + .3 + si, [dx, dy] = fly(k, Math.cos(a) * 200, Math.sin(a) * 200, 2.4, 260); c.globalAlpha = ga * (1 - q); circ(c, x + dx, yb + dy, 4, '#fff'); }
      c.globalAlpha = ga; });
    c.restore();
  });

  A('f-party-rain', 'Конфетти-дождь сверху', PA, 3.5, (c, t, D) => {
    const fade = 1 - ss((t - (D - .5)) / .5); c.save(); c.globalAlpha *= fade;
    for (let i = 0; i < 80; i++) { const ts = H(i, 1) * 1.3, v = 260 + H(i, 2) * 240, k = t - ts; if (k < 0) continue; const y = -30 + v * k, x = 40 + H(i, 3) * 944 + Math.sin(t * (1.5 + H(i, 4)) + i) * 36; if (y > 1060) continue;
      piece(c, x, y, 9 + H(i, 5) * 8, H(i, 6) * TAU + k * (1.5 + H(i, 7) * 3), k * (4 + H(i, 8) * 7) + i, i % 6 === 5 ? 2 : i % 6 === 4 ? 1 : i % 13 === 0 ? 3 : 0, PAL[i % PAL.length]); }
    c.restore();
  });
})(window);

/* ---- styles7f.js ---- */
/* Футажи: новые категории (часть f) — рисуют инструментами window.KKFOOT из styles6.js
   «Эмодзи и реакции»: свои векторные смайлы (жёлтый градиент, мягкий блик, тень), сердца, огонь, реакции, надписи-реакции. */
(function (G) {
  const F = G.KKFOOT; if (!F) return;
  const { A, cl, eo, eio, ein, lerp, ss, TAU, spr, env, wk, prs, rr, T, TW, sh, nosh, circ, grad, burst, touch } = F;
  const GR = 'Эмодзи и реакции';
  const BRN = '#4A2810';
  const hash = (i, k) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };
  const blink = (t, ts) => { let b = 0; for (const tc of ts) b = Math.max(b, 1 - cl(Math.abs(t - tc) / .1)); return ss(b); };

  /* ---------- примитивы (координаты лица: радиус 100) ---------- */
  function ell(c, x, y, rx, ry, rot, fill) { c.beginPath(); c.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot || 0, 0, TAU); if (fill) { c.fillStyle = fill; c.fill(); } }
  function stk(c, w, col = BRN) { c.lineWidth = w; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); }
  function setF(c, px, f) { c.font = `${px}px "${f}"`; c.textAlign = 'center'; c.textBaseline = 'middle'; }

  // жёлтый смайл: x, y, R — центр и радиус в кадре; o: { r, kx, ky, red, clip }; feat(c) — черты лица в координатах ±100
  function face(c, x, y, R, o, feat) {
    o = o || {}; c.save(); c.translate(x, y); if (o.r) c.rotate(o.r); c.scale(R / 100 * (o.kx || 1), R / 100 * (o.ky || 1));
    if (o.clip) { c.beginPath(); o.clip(c); c.clip(); }
    c.save(); c.shadowColor = 'rgba(80,36,0,.32)'; c.shadowBlur = R * .2; c.shadowOffsetY = R * .07; circ(c, 0, 0, 100, '#F6A51E'); c.restore();
    const g = c.createRadialGradient(-30, -46, 4, -4, -8, 118); g.addColorStop(0, '#FFF5AE'); g.addColorStop(.36, '#FFDC4E'); g.addColorStop(.74, '#FFBD2D'); g.addColorStop(1, '#F29417');
    circ(c, 0, 0, 100); c.fillStyle = g; c.fill();
    c.save(); circ(c, 0, 0, 100); c.clip();
    if (o.red > 0) { const L = o.red, lg = c.createLinearGradient(0, 100, 0, -100); lg.addColorStop(0, 'rgba(226,36,30,.97)'); lg.addColorStop(cl(L - .32), 'rgba(240,58,40,.94)'); lg.addColorStop(cl(L), 'rgba(250,96,50,0)'); lg.addColorStop(1, 'rgba(250,96,50,0)'); c.fillStyle = lg; c.fillRect(-100, -100, 200, 200); }
    const g2 = c.createRadialGradient(0, -18, 60, 0, -10, 124); g2.addColorStop(0, 'rgba(255,170,0,0)'); g2.addColorStop(1, 'rgba(196,84,0,.4)'); c.fillStyle = g2; c.fillRect(-100, -100, 200, 200);
    ell(c, 0, 90, 56, 10, 0, 'rgba(255,240,170,.32)');
    c.restore();
    c.save(); c.translate(-36, -57); c.rotate(-.55); const hg = c.createLinearGradient(0, -22, 0, 22); hg.addColorStop(0, 'rgba(255,255,255,.88)'); hg.addColorStop(1, 'rgba(255,255,255,0)'); ell(c, 0, 0, 40, 19, 0, hg); c.restore();
    if (feat) feat(c);
    c.restore();
  }
  // глаз-овал (bl — моргание 0..1, lx/ly — сдвиг блика)
  function eye(c, x, y, rx, ry, bl = 0) {
    const h = ry * (1 - cl(bl)); if (h < 3) { c.beginPath(); c.moveTo(x - rx * 1.1, y); c.quadraticCurveTo(x, y + 4, x + rx * 1.1, y); stk(c, 5.5); return; }
    const g = c.createLinearGradient(0, y - h, 0, y + h); g.addColorStop(0, '#6E4220'); g.addColorStop(1, '#2C1506'); ell(c, x, y, rx, h, 0, g);
    ell(c, x - rx * .3, y - h * .42, rx * .34, Math.min(rx * .34, h * .3), 0, 'rgba(255,255,255,.92)');
  }
  // большой глаз с белком: s — размер белка, px/py — где зрачок
  function eyeW(c, x, y, rx, ry, pr, px = 0, py = 0) {
    const g = c.createLinearGradient(0, y - ry, 0, y + ry); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#E4E4EA'); ell(c, x, y, rx, ry, 0, g); c.lineWidth = 2.6; c.strokeStyle = 'rgba(110,60,10,.55)'; c.stroke();
    c.save(); ell(c, x, y, rx, ry); c.clip(); eye(c, x + px, y + py, pr, pr * 1.05); c.restore();
  }
  function arcUp(c, x, y, w, h, lw = 7.5) { c.beginPath(); c.moveTo(x - w, y + h * .5); c.quadraticCurveTo(x, y - h * 1.5, x + w, y + h * .5); stk(c, lw); }
  function mouthFill(c, y0, y1) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#702615'); g.addColorStop(1, '#320A04'); c.fillStyle = g; c.fill(); }
  // открытая улыбка-«D»: ширина w, верх y, глубина d
  function grin(c, w, y, d, o = {}) {
    const tc = o.tc ?? 8, th = o.th ?? 12;
    const P = () => { c.beginPath(); c.moveTo(-w, y); c.quadraticCurveTo(0, y + tc, w, y); c.bezierCurveTo(w * .95, y + d * 1.1, -w * .95, y + d * 1.1, -w, y); c.closePath(); };
    P(); mouthFill(c, y, y + d);
    c.save(); P(); c.clip();
    if (o.tongue !== false) { ell(c, 0, y + d * .98, w * .56, d * .42, 0, '#FF6676'); ell(c, -w * .12, y + d * .86, w * .22, d * .1, -.1, 'rgba(255,190,200,.55)'); }
    c.beginPath(); c.moveTo(-w - 2, y - 2); c.quadraticCurveTo(0, y + tc - 2, w + 2, y - 2); c.lineTo(w + 2, y + th); c.quadraticCurveTo(0, y + tc + th, -w - 2, y + th); c.closePath(); c.fillStyle = '#fff'; c.fill();
    if (o.bteeth) { c.beginPath(); c.moveTo(-w, y + d * 1.2); c.bezierCurveTo(-w * .7, y + d * .8, w * .7, y + d * .8, w, y + d * 1.2); c.lineTo(w, y + d * 1.4); c.lineTo(-w, y + d * 1.4); c.fillStyle = '#fff'; c.fill(); }
    c.restore();
  }
  // капля (кончик вверх)
  function drop(c, x, y, s, rot = 0, a = 1) {
    if (s <= .2 || a <= 0) return; c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha *= a;
    c.beginPath(); c.moveTo(0, -s * 1.5); c.bezierCurveTo(s * .55, -s * .7, s, -s * .1, s, s * .35); c.arc(0, s * .35, s, 0, Math.PI); c.bezierCurveTo(-s, -s * .1, -s * .55, -s * .7, 0, -s * 1.5); c.closePath();
    const g = c.createLinearGradient(-s, -s, s, s * 1.3); g.addColorStop(0, '#D4F1FF'); g.addColorStop(.5, '#7CC8FF'); g.addColorStop(1, '#2E8BFF'); c.fillStyle = g; c.fill();
    ell(c, -s * .38, s * .12, s * .2, s * .38, -.3, 'rgba(255,255,255,.85)'); c.restore();
  }
  // сердце: центр x,y, полуширина s
  function heartP(c, x, y, s) { c.beginPath(); for (let i = 0; i <= 72; i++) { const a = i / 72 * TAU, hx = 16 * Math.pow(Math.sin(a), 3), hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)); const X = x + hx * s / 16, Y = y + (hy - 2.5) * s / 16; i ? c.lineTo(X, Y) : c.moveTo(X, Y); } c.closePath(); }
  function heart(c, x, y, s, col = ['#FF8FA3', '#FF2D55', '#C8093A'], o = {}) {
    if (s <= .5) return;
    if (o.line) { heartP(c, x, y, s); c.lineWidth = o.line; c.strokeStyle = '#fff'; c.lineJoin = 'round'; if (o.sh) { c.save(); sh(c, o.sh); c.stroke(); c.restore(); } else c.stroke(); }
    else if (o.sh) { c.save(); sh(c, o.sh); heartP(c, x, y, s); c.fillStyle = col[1]; c.fill(); c.restore(); }
    const g = c.createRadialGradient(x - s * .35, y - s * .5, s * .05, x, y, s * 1.35); g.addColorStop(0, col[0]); g.addColorStop(.5, col[1]); g.addColorStop(1, col[2]);
    heartP(c, x, y, s); c.fillStyle = g; c.fill();
    ell(c, x - s * .47, y - s * .4, s * .25, s * .13, -.65, 'rgba(255,255,255,.78)');
  }
  // четырёхлучевая искра
  function spark(c, x, y, s, col = '#FFE14D', rot = 0) {
    if (s <= .5) return; c.save(); c.translate(x, y); c.rotate(rot); c.beginPath(); c.moveTo(0, -s); c.quadraticCurveTo(0, 0, s, 0); c.quadraticCurveTo(0, 0, 0, s); c.quadraticCurveTo(0, 0, -s, 0); c.quadraticCurveTo(0, 0, 0, -s); c.closePath();
    c.fillStyle = col; c.fill(); c.restore();
  }
  // рука: список фигур ['r', x, y, w, h, r] или ['l', x1, y1, x2, y2, толщина]; сначала контур, потом заливка
  function limb(c, shapes, g, ow = 5) {
    for (const pass of [0, 1]) for (const s of shapes) {
      if (s[0] === 'r') { rr(c, s[1], s[2], s[3], s[4], s[5]); if (pass) { c.fillStyle = g; c.fill(); } else { c.lineWidth = ow; c.strokeStyle = 'rgba(196,112,8,.85)'; c.lineJoin = 'round'; c.stroke(); } }
      else { c.beginPath(); c.moveTo(s[1], s[2]); c.lineTo(s[3], s[4]); c.lineCap = 'round'; c.lineWidth = s[5] + (pass ? 0 : ow); c.strokeStyle = pass ? g : 'rgba(196,112,8,.85)'; c.stroke(); }
    }
  }
  const skin = (c, x0, y0, x1, y1) => grad(c, x0, y0, x1, y1, ['#FFE877', '#FFC93A', '#F29C1A']);

  // черты «смех до слёз»
  function lolFeat(c, t, jig) {
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(s * 62, -56); c.quadraticCurveTo(s * 44, -68, s * 22, -60); stk(c, 6);
      c.beginPath(); c.moveTo(s * 60, -38); c.lineTo(s * 30, -25); c.lineTo(s * 60, -12); stk(c, 8.5);
    }
    grin(c, 60, 8, 52 + 6 * jig, { tc: 3 });
    for (const s of [-1, 1]) { const sz = 15 * (1 + .07 * Math.sin(t * 14 + s)); drop(c, s * 82, -6, sz, s * -1.15); }
  }
  // огонь: основание (cx, by), ширина w, высота h
  function flame(c, cx, by, w, h, t, ph, cols, lean = 0) {
    const sway = Math.sin(t * 5.3 + ph) * w * .09 + Math.sin(t * 8.1 + ph * 2) * w * .04 + lean * w, hh = h * (1 + .07 * Math.sin(t * 7 + ph) + .03 * Math.sin(t * 13 + ph));
    const tx = cx + sway, ty = by - hh, r = w / 2, oy = by - r;
    c.beginPath(); c.moveTo(tx, ty);
    c.bezierCurveTo(tx + w * .12, ty + hh * .3, cx + r * 1.14, oy - hh * .34, cx + r, oy);
    c.arc(cx, oy, r, 0, Math.PI);
    c.bezierCurveTo(cx - r * 1.1, oy - hh * .3, tx - w * .38, ty + hh * .42, tx, ty); c.closePath();
    const g = c.createLinearGradient(0, by, 0, ty); cols.forEach((s, i) => g.addColorStop(i / (cols.length - 1), s)); c.fillStyle = g; c.fill();
  }
  const FL1 = ['#FF9A1F', '#FF5A1C', '#E8291E'], FL2 = ['#FFC93A', '#FF9A1F', '#FF7A1A'], FL3 = ['#FFFBD8', '#FFE680', '#FFC93A'];
  function fire(c, cx, by, w, h, t, glow = 0) {
    c.save(); if (glow) { c.shadowColor = 'rgba(255,90,20,.55)'; c.shadowBlur = glow; }
    flame(c, cx - w * .3, by - w * .08, w * .42, h * .52, t, 1.3, FL1, -.18); flame(c, cx + w * .3, by - w * .08, w * .36, h * .44, t, 2.4, FL1, .16);
    flame(c, cx, by, w, h, t, 0, FL1); c.restore();
    flame(c, cx, by - w * .03, w * .7, h * .66, t, .7, FL2);
    flame(c, cx, by - w * .06, w * .4, h * .36, t, 1.9, FL3);
  }
  function thumbUp(c, x, y, R) {
    c.save(); c.translate(x, y); c.scale(R / 30, R / 30); const g = skin(c, -18, -30, 18, 28);
    limb(c, [['l', -6, -2, -1, -24, 14], ['r', -16, -6, 34, 32, 10]], g, 3.5);
    c.strokeStyle = 'rgba(196,112,8,.75)'; c.lineWidth = 2.2; c.lineCap = 'round'; [3, 10, 17].forEach(yy => { c.beginPath(); c.moveTo(7, yy); c.lineTo(16, yy); c.stroke(); });
    c.restore();
  }

  /* =====================================================================
     Эмодзи и реакции
     ===================================================================== */
  A('f-emo-lol', 'Смех до слёз', GR, 3, (c, t, D) => {
    const e = env(t, D), on = cl((t - .35) / .25), jig = Math.sin(t * 30) * on;
    e.r = Math.sin(t * 7) * .12 * on;
    wk(c, 512, 512, e, () => {
      const y = 500 - Math.abs(Math.sin(t * 15)) * 14 * on;
      face(c, 512, y, 250, { ky: 1 + .025 * jig, kx: 1 - .015 * jig }, c => {
        lolFeat(c, t, jig);
        for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const q = (t - .45 - i * .17) * 1.5; if (q < 0) continue; const p = q % 1;
          drop(c, s * (96 + 62 * p), -6 - 46 * p + 150 * p * p, 8 * (1 - .35 * p), s * (-1.2 + 1.6 * p), Math.sin(Math.PI * p) * 1.2); }
      });
    });
  });

  A('f-emo-shock', 'Шок с открытым ртом', GR, 3, (c, t, D) => {
    const e = env(t, D), ts = .85, s = cl(spr(t - ts, 15, .5)), s2 = spr(t - ts, 15, .38), hit = t > ts ? Math.sin(Math.PI * cl((t - ts) / .28)) : 0;
    e.ky = e.k * (1 + .1 * hit); e.k *= 1 - .04 * hit;
    wk(c, 512, 540, e, () => {
      const la = cl((t - ts) / .05) * (1 - ss((t - ts - .9) / .3)), lk = eo(cl((t - ts) / .35));
      if (la > 0) { c.save(); c.globalAlpha *= la; sh(c, .4); c.lineCap = 'round';
        [-2.55, -2.1, -1.57, -1.04, -.59].forEach((a, i) => { const r0 = 300 + 24 * lk, r1 = r0 + (i % 2 ? 46 : 70) * lk; c.beginPath(); c.moveTo(512 + Math.cos(a) * r0, 540 + Math.sin(a) * r0); c.lineTo(512 + Math.cos(a) * r1, 540 + Math.sin(a) * r1); c.lineWidth = 16; c.strokeStyle = '#FFC930'; c.stroke(); });
        c.restore(); }
      face(c, 512, 540, 262, {}, c => {
        for (const sd of [-1, 1]) { const by = lerp(-56, -80, s2); c.beginPath(); c.moveTo(sd * 62, by + 4); c.quadraticCurveTo(sd * 42, by - 10, sd * 22, by); stk(c, 6.5); }
        const bl = blink(t, [.42]);
        for (const sd of [-1, 1]) { if (s > .02) { c.save(); c.globalAlpha *= cl(s * 3); eyeW(c, sd * 38, -22, lerp(12, 24, s), lerp(16, 30, s2), lerp(11, 7.5, s)); c.restore(); } if (s < .3) { c.save(); c.globalAlpha *= 1 - cl(s / .3); eye(c, sd * 38, -22, 11, 16, bl); c.restore(); } }
        const mrx = lerp(14, 30, s2), mry = lerp(6, 40, s2), my = lerp(42, 50, s);
        ell(c, 0, my, mrx, mry); mouthFill(c, my - mry, my + mry); c.save(); ell(c, 0, my, mrx, mry); c.clip(); ell(c, 0, my + mry * .95, mrx * .7, mry * .4, 0, '#FF6676'); c.restore();
      });
    });
  });

  A('f-emo-hearts', 'Глаза-сердечки', GR, 3, (c, t, D) => {
    const e = env(t, D), th = .5, hk = spr(t - th, 16, .4), x = (t - th - .25) % .9, pulse = t > th + .25 ? Math.exp(-Math.pow(x / .06, 2)) + .7 * Math.exp(-Math.pow((x - .2) / .06, 2)) : 0;
    wk(c, 512, 512, e, () => {
      for (let i = 0; i < 5; i++) { const q = (t - .8 - i * .32) / 1.4; if (q < 0 || q > 1) continue; const hx = 512 + [150, -170, 210, -110, 60][i] + Math.sin(q * 6 + i) * 22, hy = 300 - q * 230;
        c.save(); c.globalAlpha *= Math.sin(Math.PI * q) * 1.3 > 1 ? 1 : Math.sin(Math.PI * q) * 1.3; heart(c, hx, hy, (22 + i % 3 * 8) * spr(q * 1.4, 14, .5), undefined, { sh: .3 }); c.restore(); }
      face(c, 512, 530 + Math.sin(t * 5) * 6, 255, { r: Math.sin(t * 3) * .04 }, c => {
        grin(c, 50, 22, 34, { tc: 10, th: 10 });
        for (const sd of [-1, 1]) {
          if (hk < .5) { c.save(); c.globalAlpha *= 1 - cl(hk * 2); eye(c, sd * 38, -22, 11, 16); c.restore(); }
          const k = hk * (1 + .22 * pulse); c.save(); c.translate(sd * 38, -20); c.rotate(sd * .12); heart(c, 0, 0, 27 * k, ['#FF8FA3', '#FF2D55', '#C8093A']); c.restore();
        }
      });
      burst(c, 512 - 97, 470, t, th, { n: 8, R: 90, s: 6, ring: false, lines: true, cols: ['#FF2D55'] }); burst(c, 512 + 97, 470, t, th, { n: 8, R: 90, s: 6, ring: false, lines: true, cols: ['#FF2D55'] });
    });
  });

  A('f-emo-mindblown', 'Взрыв мозга', GR, 3.4, (c, t, D) => {
    const e = env(t, D), tb = 1.15, pre = cl((t - .25) / (tb - .25)), ex = t >= tb, X = 512, Y = 640, R = 210;
    const shk = !ex ? Math.sin(t * 70) * 7 * pre * pre : Math.sin(t * 50) * 6 * Math.exp(-(t - tb) * 6);
    const zig = c2 => { for (let i = 0; i <= 14; i++) { const x = -105 + i * 15, y = -38 + (i % 2 ? -9 : 9); i ? c2.lineTo(x, y) : c2.moveTo(x, y); } };
    const feat = c => {
      for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 62, -58); c.quadraticCurveTo(sd * 42, -72, sd * 22, -62); stk(c, 6.5); }
      const w = ex ? 1 : pre; for (const sd of [-1, 1]) eyeW(c, sd * 36, -12, lerp(17, 23, w), lerp(20, 27, w), lerp(10, 7.5, w));
      const mry = ex ? 30 : lerp(8, 22, pre); ell(c, 0, 48, 22, mry); mouthFill(c, 48 - mry, 48 + mry); c.save(); ell(c, 0, 48, 22, mry); c.clip(); ell(c, 0, 48 + mry, 16, mry * .45, 0, '#FF6676'); c.restore();
      if (!ex && t > tb - .3) { c.save(); c.globalAlpha *= cl((t - tb + .3) / .15); circ(c, 0, 0, 100); c.clip(); c.beginPath(); zig(c); stk(c, 4, '#7A3A06'); c.restore(); }
    };
    wk(c, X, Y, e, () => {
      if (ex) {
        burst(c, X, Y - R * .55, t, tb, { n: 14, R: 340, s: 13, ring: false, lines: true, cols: ['#FFC930', '#FF8A1F', '#FF5A3C'] });
        // облако
        const P = [[0, -64, 30, 0], [-6, -102, 34, .03], [6, -140, 38, .06], [0, -190, 54, .1], [-56, -176, 42, .12], [56, -176, 42, .13], [-32, -222, 42, .16], [34, -220, 44, .17], [-88, -200, 30, .19], [88, -202, 32, .2], [0, -244, 36, .22]];
        c.save(); c.translate(X + shk, Y); c.scale(R / 100, R / 100);
        const ks = P.map(([, , , d], i) => spr(t - tb - d, 11, .5) * (1 + .035 * Math.sin(t * 6 + i)));
        c.save(); c.shadowColor = 'rgba(120,40,0,.3)'; c.shadowBlur = 40; c.shadowOffsetY = 12; P.forEach(([x, y, r], i) => circ(c, x, y, (r + 4) * ks[i], '#F07A2E')); c.restore();
        P.forEach(([x, y, r], i) => { const rk = r * ks[i]; if (rk <= .5) return; const g = c.createRadialGradient(x - rk * .35, y - rk * .45, rk * .1, x, y, rk * 1.1); g.addColorStop(0, '#FFFCEB'); g.addColorStop(.55, '#FFD58C'); g.addColorStop(1, '#FF9944'); circ(c, x, y, rk, g); });
        c.restore();
        face(c, X + shk, Y, R, { clip: c2 => { zig(c2); c2.lineTo(120, 120); c2.lineTo(-120, 120); c2.closePath(); } }, feat);
        const q = cl((t - tb) / .7), la = 1 - cl((t - tb - .3) / .35);
        if (la > 0) { c.save(); c.globalAlpha *= la; c.translate(X - 120 * eo(q), Y - 360 * eo(q) + 260 * q * q); c.rotate(-1.4 * eo(q)); c.translate(-X, -Y);
          face(c, X, Y, R, { clip: c2 => { zig(c2); c2.lineTo(120, -120); c2.lineTo(-120, -120); c2.closePath(); } }, feat); c.restore(); }
        const fq = (t - tb) / .4; if (fq < 1) { const fr = 60 + 260 * eo(fq), fg = c.createRadialGradient(X, Y - R * .45, 0, X, Y - R * .45, fr); fg.addColorStop(0, `rgba(255,252,230,${.95 * (1 - fq)})`); fg.addColorStop(.5, `rgba(255,220,120,${.6 * (1 - fq)})`); fg.addColorStop(1, 'rgba(255,190,80,0)'); circ(c, X, Y - R * .45, fr, fg); }
      } else face(c, X + shk, Y, R, { red: .55 * pre * pre }, feat);
    });
  });

  A('f-emo-fire', 'Огонь горит', GR, 3, (c, t, D) => {
    const e = env(t, D);
    wk(c, 512, 860, e, () => {
      fire(c, 512, 860, 400, 640, t, 90);
      for (let i = 0; i < 12; i++) { const q = (t * .9 + hash(i, 1)) % 1, a = Math.sin(Math.PI * q) * cl((t - .25) / .3); if (a <= 0) continue;
        const x = 512 + (hash(i, 2) - .5) * 330 + Math.sin(t * 4 + i) * 22, y = 700 - q * 560; circ(c, x, y, 9 * (1 - q * .6) * (.6 + hash(i, 3) * .6), i % 2 ? `rgba(255,210,63,${a})` : `rgba(255,138,31,${a})`); }
    });
  });

  A('f-emo-100', '100 баллов', GR, 2.6, (c, t, D) => {
    const e = env(t, D), beat = t > 1.25 ? 1 + .05 * Math.max(0, Math.sin((t - 1.25) * 9)) * Math.exp(-(t - 1.25) * 2) : 1;
    wk(c, 512, 512, { k: e.k * beat, a: e.a }, () => {
      c.save(); c.translate(512, 480); c.rotate(-.1);
      const FNT = 'Montserrat-Black', px = 330; setF(c, px, FNT); const ws = ['1', '0', '0'].map(s => c.measureText(s).width), tot = ws[0] + ws[1] + ws[2] - 30; let x0 = -tot / 2;
      const xs = ws.map(w => { const x = x0 + w / 2; x0 += w - 15; return x; });
      const L = [[-tot / 2 - 10, 150, tot / 2 + 30, 128, .55], [-tot / 2 + 20, 205, tot / 2 + 10, 188, .72]];
      const line = (l, p) => { c.beginPath(); for (let i = 0; i <= 30 * p; i++) { const u = i / 30, x = lerp(l[0], l[2], u), y = lerp(l[1], l[3], u) + Math.sin(u * Math.PI) * 10; i ? c.lineTo(x, y) : c.moveTo(x, y); } };
      for (const pass of [0, 1]) {
        ['1', '0', '0'].forEach((s, i) => { const k = spr(t - .1 - i * .1, 16, .4); if (k <= .01) return; c.save(); c.translate(xs[i], 0); c.scale(k, k); c.transform(1, 0, -.2, 1, 0, 0); setF(c, px, FNT);
          if (!pass) { sh(c, .7); c.lineWidth = 26; c.lineJoin = 'round'; c.strokeStyle = '#fff'; c.strokeText(s, 0, 0); }
          else { c.fillStyle = grad(c, 0, -150, 0, 150, ['#FF5A4E', '#F2203A', '#C80F2E']); c.fillText(s, 0, 0); } c.restore(); });
        L.forEach(l => { const p = eio(cl((t - l[4]) / .3)); if (p <= 0) return; line(l, p); if (!pass) { c.save(); sh(c, .5); stk(c, 50, '#fff'); c.restore(); } else stk(c, 28, '#E8182F'); });
      }
      c.restore();
      [[230, 250, 34, 1.0], [800, 300, 26, 1.15], [780, 720, 30, 1.3], [250, 690, 22, 1.45]].forEach(([x, y, s, tc], i) => { const k = spr(t - tc, 14, .45) * (.75 + .25 * Math.sin(t * 8 + i * 2)); c.save(); sh(c, .3); spark(c, x, y, s * k, '#FFD43B', t * .8); c.restore(); spark(c, x, y, s * k * .45, '#fff', t * .8); });
    });
  });

  A('f-emo-cry', 'Плачет навзрыд', GR, 3.2, (c, t, D) => {
    const e = env(t, D), on = cl((t - .3) / .3), sob = Math.max(0, Math.sin(t * 9)) * on, grow = eo(cl((t - .35) / .7));
    wk(c, 512, 500, e, () => {
      face(c, 512, 480 - sob * 9, 250, { ky: 1 - .025 * sob, kx: 1 + .012 * sob }, c => {
        for (const sd of [-1, 1]) {
          c.beginPath(); c.moveTo(sd * 64, -48); c.quadraticCurveTo(sd * 44, -50, sd * 22, -64); stk(c, 6.5);
          c.beginPath(); c.moveTo(sd * 62, -20); c.quadraticCurveTo(sd * 42, -42, sd * 22, -20); stk(c, 8);
        }
        const mb = 66 + 7 * sob; c.beginPath(); c.moveTo(-30, 30); c.quadraticCurveTo(0, 18, 30, 30); c.quadraticCurveTo(40, mb - 6, 34, mb); c.quadraticCurveTo(0, mb + 10, -34, mb); c.quadraticCurveTo(-40, mb - 6, -30, 30); c.closePath();
        mouthFill(c, 20, mb); c.save(); c.clip(); ell(c, 0, mb + 2, 26, 14, 0, '#FF6676'); c.beginPath(); c.moveTo(-34, 22); c.quadraticCurveTo(0, 12, 34, 22); c.lineTo(34, 33); c.quadraticCurveTo(0, 23, -34, 33); c.fillStyle = '#fff'; c.fill(); c.restore();
        // ручьи слёз
        for (const sd of [-1, 1]) { const x0 = sd * 44, yEnd = lerp(-14, 92, grow); if (yEnd > -12) {
          c.save(); circ(c, 0, 0, 100); c.clip(); c.beginPath(); for (let y = -14; y <= yEnd; y += 4) { const x = x0 + sd * (y + 14) * .07 + Math.sin(y * .09 - t * 12) * 2.2; y === -14 ? c.moveTo(x, y) : c.lineTo(x, y); }
          c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 17; c.strokeStyle = grad(c, x0 - 9, 0, x0 + 9, 0, ['#9FDCFF', '#4DA6FF', '#2E86F5']); c.stroke(); c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,.65)'; c.stroke(); c.restore(); }
          for (let i = 0; i < 3; i++) { const q = (t - 1.0 - i * .22) / .66; if (q < 0) continue; const p = q % 1; drop(c, x0 + sd * 10 + sd * p * 12, 94 + p * p * 70, 7 * (1 - .3 * p), 0, 1 - p); }
        }
      });
    });
  });

  A('f-emo-angry', 'Злится и краснеет', GR, 3.2, (c, t, D) => {
    const e = env(t, D), red = 1.32 * eio(cl((t - .35) / 1.3)), tr = cl((t - .6) / 1.2), shx = Math.sin(t * 63) * 7 * tr, shy = Math.cos(t * 51) * 3 * tr;
    wk(c, 512, 540, e, () => {
      for (const sd of [-1, 1]) for (let j = 0; j < 3; j++) { const q = (t - 1.45 - j * .3) * 1.4; if (q < 0) continue; const p = q % 1, a = (1 - p) * .9 * cl(q * 4);
        const x = 512 + sd * (210 + 110 * p), y = 360 - 90 * p, r = 22 + 36 * p; c.save(); c.globalAlpha *= a;
        [[0, 0, 1], [-.7, .25, .7], [.7, .3, .65]].forEach(([dx, dy, k]) => { const g = c.createRadialGradient(x + dx * r - r * .3 * k, y + dy * r - r * .3 * k, 0, x + dx * r, y + dy * r, r * k); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, 'rgba(225,228,236,.9)'); circ(c, x + dx * r, y + dy * r, r * k, g); }); c.restore(); }
      face(c, 512 + shx, 540 + shy, 255, { red }, c => {
        for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 68, -60); c.lineTo(sd * 18, -36); stk(c, 11); eye(c, sd * 37, -16, 10.5, 13); }
        c.beginPath(); c.moveTo(-44, 50); c.quadraticCurveTo(0, 28, 44, 50); c.lineTo(44, 66); c.quadraticCurveTo(0, 46, -44, 66); c.closePath(); c.fillStyle = '#fff'; c.fill(); stk(c, 5, '#4A1A08');
        c.save(); c.clip(); c.beginPath(); c.moveTo(-44, 58); c.quadraticCurveTo(0, 37, 44, 58); for (const x of [-22, 0, 22]) { c.moveTo(x, 20); c.lineTo(x, 80); } stk(c, 3, 'rgba(74,26,8,.7)'); c.restore();
      });
      const vk = spr(t - 1.25, 15, .4) * (1 + .12 * Math.max(0, Math.sin(t * 10))); if (vk > .01) { c.save(); c.translate(512 + 190 + shx, 540 - 190); c.scale(vk, vk); c.rotate(.2);
        for (const pass of [0, 1]) for (let q = 0; q < 4; q++) { const a = q * Math.PI / 2 + Math.PI / 4, cx = Math.cos(a) * 36, cy = Math.sin(a) * 36; c.beginPath(); c.arc(cx, cy, 24, a + Math.PI - .85, a + Math.PI + .85); if (!pass) { c.save(); sh(c, .35); stk(c, 22, '#fff'); c.restore(); } else stk(c, 11, '#FF2A2A'); }
        c.restore(); }
    });
  });

  A('f-emo-eyeroll', 'Закатывает глаза', GR, 3, (c, t, D) => {
    const e = env(t, D), p = eio(cl((t - .6) / .85)), rd = ss((t - .5) / .2), a = Math.PI * .7 + p * Math.PI * .8, ix = Math.cos(a) * 9 * rd, iy = Math.sin(a) * 13 * rd;
    e.r = -.09 * eio(cl((t - .7) / .8));
    wk(c, 512, 512, e, () => {
      face(c, 512, 512, 260, {}, c => {
        c.beginPath(); c.moveTo(-60, -66 - 6 * p); c.quadraticCurveTo(-40, -76 - 8 * p, -20, -68 - 6 * p); stk(c, 6.5);
        c.beginPath(); c.moveTo(20, -64); c.quadraticCurveTo(40, -68, 60, -62); stk(c, 6.5);
        for (const sd of [-1, 1]) eyeW(c, sd * 37, -22, 21, 26, 11, ix, iy);
        c.beginPath(); c.moveTo(-30, 50); c.quadraticCurveTo(0, 46 - 4 * p, 32, 40 - 4 * p); stk(c, 7);
      });
    });
  });

  A('f-emo-think', 'Думает, рука у подбородка', GR, 3.4, (c, t, D) => {
    const e = env(t, D), hk = spr(t - .25, 12, .55), tap = Math.max(0, Math.sin((t - .9) * 13)) * cl((t - .9) / .2) * (t < 2.6 ? 1 : 0), look = ss((t - .5) / .3);
    wk(c, 480, 560, e, () => {
      face(c, 470, 570, 245, { r: -.05 }, c => {
        c.beginPath(); c.moveTo(-62, -60); c.quadraticCurveTo(-42, -80, -20, -72); stk(c, 6.5);
        c.beginPath(); c.moveTo(20, -58); c.quadraticCurveTo(40, -58, 60, -52); stk(c, 6.5);
        const bl = blink(t, [1.9]); eye(c, -38 + 5 * look, -26 - 6 * look, 10.5, 15, bl); eye(c, 38 + 5 * look, -24 - 6 * look, 10.5, 15, bl);
        c.beginPath(); c.moveTo(-24, 44); c.bezierCurveTo(-8, 38, 8, 50, 30, 38); stk(c, 7);
        // рука
        c.save(); c.globalAlpha *= cl((t - .25) / .12); c.translate(26 * (1 - hk), 36 * (1 - hk)); const g = skin(c, -60, 50, 30, 140);
        const fa = -2.05 - tap * .2, fx = -26, fy = 90;
        limb(c, [['l', fx, fy, fx + Math.cos(fa) * 40, fy + Math.sin(fa) * 40, 18], ['r', -40, 84, 70, 50, 22]], g, 4.5);
        limb(c, [['l', -22, 100, 12, 96, 16]], g, 3.5);
        c.strokeStyle = 'rgba(196,112,8,.7)'; c.lineWidth = 2.6; c.lineCap = 'round'; [-6, 10].forEach(xx => { c.beginPath(); c.moveTo(xx, 110); c.lineTo(xx, 128); c.stroke(); });
        c.restore();
      });
      const bk = spr(t - .85, 13, .5); if (bk > .01) {
        const bx = 790, by = 230;
        [[680, 360, 13, 0], [722, 318, 20, .06]].forEach(([x, y, r, d]) => { const k = spr(t - .75 - d, 14, .5); c.save(); sh(c, .35); circ(c, x, y, r * k, '#fff'); c.restore(); });
        c.save(); c.translate(bx, by); c.scale(bk, bk); c.save(); sh(c, .6); [[0, 0, 82], [-62, 18, 54], [62, 18, 56], [-30, -40, 52], [34, -42, 54]].forEach(([x, y, r]) => circ(c, x, y, r, '#fff')); c.restore();
        [[0, 0, 82], [-62, 18, 54], [62, 18, 56], [-30, -40, 52], [34, -42, 54]].forEach(([x, y, r]) => circ(c, x, y, r, '#fff'));
        const qb = Math.sin(t * 5) * 6; setF(c, 104, 'Montserrat-Black'); c.fillStyle = grad(c, 0, -50, 0, 50, ['#8B6CFF', '#5B3DF5']); c.fillText('?', 0, 2 + qb); c.restore(); }
    });
  });

  A('f-emo-wink', 'Подмигивает', GR, 2.8, (c, t, D) => {
    const e = env(t, D), tw = 1.0, w = ss((t - tw) / .08) * (1 - ss((t - 2.05) / .1));
    e.r = .11 * spr(t - tw, 12, .4) * (1 - ss((t - 2.0) / .35));
    wk(c, 512, 512, e, () => {
      face(c, 512, 512, 260, {}, c => {
        for (const sd of [-1, 1]) ell(c, sd * 60, 22, 17, 9, 0, `rgba(255,96,110,${.18 + .2 * w})`);
        c.beginPath(); c.moveTo(-60, -58); c.quadraticCurveTo(-42, -70, -22, -62); stk(c, 6.5);
        c.beginPath(); c.moveTo(22, -60 + 8 * w); c.quadraticCurveTo(42, -70 + 10 * w, 62, -58 + 8 * w); stk(c, 6.5);
        eye(c, -38, -22, 11, 16, blink(t, [.45]));
        if (w < .5) eye(c, 38, -22, 11, 16, w * 2); else { c.beginPath(); c.moveTo(22, -18); c.quadraticCurveTo(38, -34, 56, -20); stk(c, 7.5); }
        c.beginPath(); c.moveTo(-36, 34); c.quadraticCurveTo(4, 64 + 4 * w, 42, 28 - 4 * w); stk(c, 7.5);
        c.beginPath(); c.moveTo(38, 22 - 4 * w); c.quadraticCurveTo(46, 28 - 4 * w, 44, 36 - 4 * w); stk(c, 5);
      });
      const sk = spr(t - tw - .02, 14, .45) * (1 - ss((t - 1.9) / .3)); if (sk > .01) { const x = 512 + 205, y = 512 - 150;
        c.save(); sh(c, .35); spark(c, x, y, 58 * sk, '#FFD43B', t * 1.5); spark(c, x + 70, y + 70, 26 * sk, '#FFD43B', -t * 1.5); c.restore(); spark(c, x, y, 26 * sk, '#fff', t * 1.5); }
    });
  });

  A('f-emo-sweat', 'Неловко: смайл с капелькой пота', GR, 3, (c, t, D) => {
    const e = env(t, D), jit = Math.sin(t * 42) * 2.5 * cl((t - .6) / .3);
    wk(c, 512, 512, e, () => {
      face(c, 512 + jit, 520, 255, {}, c => {
        for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 62, -52); c.quadraticCurveTo(sd * 44, -58, sd * 22, -68); stk(c, 6.5); arcUp(c, sd * 38, -24, 19, 11, 8); }
        grin(c, 58, 14, 44, { tc: 6, th: 13 });
        const dk = spr(t - .55, 13, .45), slide = eio(cl((t - 1.1) / 1.4)); drop(c, 72 + 8 * slide, -58 + 34 * slide, 17 * dk, -.15);
      });
    });
  });

  A('f-emo-eyes', 'Глаза бегают', GR, 2.6, (c, t, D) => {
    const e = env(t, D);
    const K = [[0, 0], [.5, 0], [.58, -1], [.95, -1], [1.03, 1], [1.4, 1], [1.48, -.8], [1.8, -.8], [1.88, 0]];
    let lx = 0; for (let i = 1; i < K.length; i++) if (t >= K[i - 1][0]) lx = t >= K[i][0] ? K[i][1] : lerp(K[i - 1][1], K[i][1], ss((t - K[i - 1][0]) / (K[i][0] - K[i - 1][0])));
    const bl = blink(t, [1.2, 2.1]);
    wk(c, 512, 512, e, () => {
      for (const sd of [-1, 1]) { const x = 512 + sd * 128, y = 512, rx = 120, ry = 168 * (1 - .92 * bl);
        c.save(); sh(c, .8); ell(c, x, y, rx, ry, 0, '#fff'); c.restore();
        const g = c.createRadialGradient(x - 30, y - 60, 20, x, y, 190); g.addColorStop(0, '#FFFFFF'); g.addColorStop(.7, '#F1F1F5'); g.addColorStop(1, '#C9CAD3'); ell(c, x, y, rx, ry, 0, g);
        c.lineWidth = 4; c.strokeStyle = 'rgba(40,30,30,.18)'; c.stroke();
        c.save(); ell(c, x, y, rx, ry); c.clip(); const px = x + lx * 58, py = y + 34 - Math.abs(lx) * 6, pr = 58;
        const pg = c.createRadialGradient(px - 14, py - 18, 4, px, py, pr); pg.addColorStop(0, '#5A3A22'); pg.addColorStop(1, '#1A0D05'); ell(c, px, py, pr * .92, pr, 0, pg);
        ell(c, px - 20, py - 24, 17, 15, 0, 'rgba(255,255,255,.95)'); ell(c, px + 18, py + 22, 7, 6, 0, 'rgba(255,255,255,.55)'); c.restore();
        c.save(); c.translate(x - 30, y - 100 * (1 - .92 * bl)); c.rotate(-.5); ell(c, 0, 0, 34, 14 * (1 - bl), 0, 'rgba(255,255,255,.75)'); c.restore(); }
    });
  });

  A('f-emo-facepalm', 'Фейспалм рукой', GR, 3.2, (c, t, D) => {
    const e = env(t, D), ti = .78, hk = spr(t - .3, 11, .6), hit = t > ti ? Math.exp(-(t - ti) * 7) * Math.sin((t - ti) * 30) : 0, sad = ss((t - ti) / .2);
    e.ky = e.k * (1 - .05 * hit); e.r = t > 1.3 ? Math.sin((t - 1.3) * 4.5) * .06 * (1 - ss((t - 2.6) / .3)) : 0;
    wk(c, 512, 540, e, () => {
      face(c, 512, 540, 250, {}, c => {
        for (const sd of [-1, 1]) { c.save(); ell(c, sd * 38, -20, 12, 16); c.clip(); eye(c, sd * 38, -20, 12, 16, sad * .9); c.fillStyle = '#FFC93A'; c.fillRect(sd * 38 - 14, -40, 28, 18 + 4 * (1 - sad)); c.restore(); c.beginPath(); c.moveTo(sd * 38 - 14, -22 + 2 * (1 - sad)); c.lineTo(sd * 38 + 14, -22 + 2 * (1 - sad)); stk(c, 5); }
        c.beginPath(); c.moveTo(-28, 52 + 4 * sad); c.quadraticCurveTo(0, 50 - 8 * sad, 28, 52 + 4 * sad); stk(c, 7.5);
        // ладонь
        c.save(); c.globalAlpha *= cl((t - .3) / .12); c.translate(14 + 60 * (1 - hk), -38 + 80 * (1 - hk)); c.rotate(-.55 + .35 * (1 - hk)); const g = skin(c, 0, -110, 0, 90);
        limb(c, [['r', -28, 20, 56, 90, 24], ['l', 40, 10, 66, -16, 21], ['r', -46, -32, 92, 70, 28], ['l', -33, -24, -35, -74, 20], ['l', -11, -26, -11, -84, 20], ['l', 11, -26, 12, -82, 20], ['l', 32, -24, 34, -68, 19]], g, 5);
        c.restore();
      });
      const la = cl((t - ti) / .04) * (1 - cl((t - ti - .35) / .2)), lk = eo(cl((t - ti) / .3)); if (la > 0) { c.save(); c.globalAlpha *= la; c.lineCap = 'round';
        [-1.25, -.85, -.45].forEach((a, i) => { const ox = 512 + 120, oy = 540 - 120, r0 = 210, r1 = r0 + (i === 1 ? 70 : 50) * lk; c.beginPath(); c.moveTo(ox + Math.cos(a) * r0, oy + Math.sin(a) * r0); c.lineTo(ox + Math.cos(a) * r1, oy + Math.sin(a) * r1); c.save(); sh(c, .3); c.lineWidth = 14; c.strokeStyle = '#fff'; c.stroke(); c.restore(); });
        c.restore(); }
    });
  });

  A('f-emo-heartbreak', 'Сердце разбивается и склеивается', GR, 3.6, (c, t, D) => {
    const e = env(t, D), X = 512, Y = 500, S = 240, tc = .35, ts = .85, tj = 1.95;
    const Z = [[0, -122], [-30, -64], [24, -14], [-26, 42], [20, 100], [-8, 160], [0, 230]];
    const zig = (c2, p = 1) => { const n = (Z.length - 1) * p; c2.moveTo(X + Z[0][0], Y + Z[0][1]); for (let i = 1; i <= Math.ceil(n); i++) { const k = Math.min(1, n - (i - 1)); c2.lineTo(X + lerp(Z[i - 1][0], Z[i][0], k), Y + lerp(Z[i - 1][1], Z[i][1], k)); } };
    const open = (t >= ts ? spr(t - ts, 10, .5) : 0) - (t >= tj ? spr(t - tj, 13, .55) : 0), beat = t > 2.5 ? 1 + .06 * Math.max(0, Math.sin((t - 2.5) * 10)) * Math.exp(-(t - 2.5) * 2.5) : 1;
    wk(c, X, Y, { k: e.k * beat, a: e.a }, () => {
      for (const sd of [-1, 1]) { c.save(); c.translate(X + sd * 34 * open, Y + 230); c.rotate(sd * .26 * open); c.translate(-X, -(Y + 230));
        c.beginPath(); zig(c); c.lineTo(X + sd * 400, Y + 300); c.lineTo(X + sd * 400, Y - 300); c.closePath(); c.clip();
        c.save(); sh(c, .8); heartP(c, X, Y, S); c.fillStyle = '#C8093A'; c.fill(); c.restore();
        heart(c, X, Y, S); c.restore(); }
      if (t > tc && open < .05) { const p = eio(cl((t - tc) / .45)); c.save(); c.beginPath(); zig(c, p); stk(c, t > tj ? 6 : 9, t > tj ? 'rgba(122,0,24,.45)' : '#7A0018'); c.restore(); }
      for (let i = 0; i < 6; i++) { const q = (t - ts) / .7; if (q <= 0 || q >= 1) continue; const a = -Math.PI / 2 + (i - 2.5) * .45 + (hash(i, 4) - .5) * .3, d = 60 + 200 * eo(q), x = X + Math.cos(a) * d * (i % 2 ? .9 : 1), y = Y - 20 + Math.sin(a) * d * .7 + 260 * q * q;
        c.save(); c.globalAlpha *= 1 - q; c.translate(x, y); c.rotate(q * 6 + i); c.beginPath(); c.moveTo(0, -12); c.lineTo(11, 8); c.lineTo(-10, 9); c.closePath(); c.fillStyle = i % 2 ? '#FF2D55' : '#C8093A'; c.fill(); c.restore(); }
      const bk = spr(t - 2.2, 14, .45); if (bk > .01) { c.save(); c.translate(X - 2, Y + 10); c.rotate(-.62); c.scale(bk * (1.25 - .25 * cl(bk)), bk * (1.25 - .25 * cl(bk)));
        c.save(); sh(c, .45); rr(c, -125, -40, 250, 80, 40); c.fillStyle = '#F5D2A6'; c.fill(); c.restore();
        rr(c, -125, -40, 250, 80, 40); c.fillStyle = grad(c, 0, -40, 0, 40, ['#FBE2C0', '#EFC292']); c.fill();
        rr(c, -38, -34, 76, 68, 12); c.fillStyle = grad(c, 0, -34, 0, 34, ['#F2D3B0', '#DDAE80']); c.fill();
        for (const sx of [-1, 1]) for (let a = 0; a < 2; a++) for (let b = 0; b < 3; b++) circ(c, sx * (62 + a * 22), -18 + b * 18, 3.4, 'rgba(176,122,74,.55)');
        c.restore(); }
      [[X - 230, Y - 200, 30, 2.35], [X + 250, Y - 160, 24, 2.45], [X + 210, Y + 160, 20, 2.55]].forEach(([x, y, s, tq], i) => { const k = spr(t - tq, 14, .45) * (.75 + .25 * Math.sin(t * 9 + i)); c.save(); sh(c, .3); spark(c, x, y, s * k, '#FFD43B', t); c.restore(); spark(c, x, y, s * k * .45, '#fff', t); });
    });
  });

  A('f-emo-heartstream', 'Поток сердечек как в эфире', GR, 3.5, (c, t, D) => {
    const PAL = [['#FF8FA3', '#FF2D55', '#C8093A'], ['#FFB3D0', '#FF5FA2', '#D61F78'], ['#FFD08A', '#FF9500', '#E0640A'], ['#D9A8FF', '#AF52DE', '#7E2DB8'], ['#A8E4FF', '#3AA8FF', '#1B6FE0'], ['#FFE98A', '#FFC400', '#E89A00']];
    const life = 1.7, step = .1, N = Math.floor((D - life - .05) / step) + 1;
    for (let i = N - 1; i >= 0; i--) { const age = t - i * step; if (age < 0 || age > life) continue; const p = age / life;
      const x = 512 + (hash(i, 1) - .5) * 110 + Math.sin(age * 3.2 + hash(i, 2) * 6) * (36 + 80 * p), y = 890 - 720 * (1 - Math.pow(1 - p, 1.5));
      const k = spr(age, 14, .45) * (.75 + hash(i, 3) * .55) * (1 - .25 * p), a = 1 - ss((p - .68) / .32);
      c.save(); c.globalAlpha *= a; c.translate(x, y); c.rotate(Math.sin(age * 2.4 + hash(i, 5) * 5) * .28); heart(c, 0, 0, 54 * k, PAL[i % PAL.length], { line: 9, sh: .35 }); c.restore(); }
  });

  A('f-emo-tg', 'Реакции Telegram с цифрами', GR, 3.6, (c, t, D) => {
    const e = env(t, D), tc = 1.7, sel = ss((t - tc) / .15);
    const R = [{ n: 'thumb', v: 24, up: [1.05, 2.35] }, { n: 'heart', v: 57, up: [tc] }, { n: 'fire', v: 18, up: [1.4, 2.7] }, { n: 'lol', v: 9, up: [2.0] }];
    const PX = 46, H = 120, EM = 35, gap = 20;
    const ws = R.map(r => 22 + EM * 2 + 14 + TW(c, String(r.v + r.up.length), PX) + 32), tot = ws.reduce((a, b) => a + b, 0) + gap * (R.length - 1); let x = 512 - tot / 2;
    R.forEach((r, i) => { const w = ws[i], x0 = x; x += w + gap; const k = spr(t - .1 - i * .09, 15, .5) * (1 - .3 * ein(cl((t - (D - .3)) / .3))), a = cl((t - .1 - i * .09) / .06) * (1 - ein(cl((t - (D - .3)) / .3)));
      const isSel = i === 1, pr = isSel ? prs(t, tc) : 0;
      wk(c, x0 + w / 2, 512, { k: k * (1 - .06 * pr), a }, () => {
        c.save(); sh(c, .6); rr(c, x0, 512 - H / 2, w, H, H / 2); c.fillStyle = '#fff'; c.fill(); c.restore();
        if (isSel && sel > 0) { c.save(); c.globalAlpha *= sel; rr(c, x0, 512 - H / 2, w, H, H / 2); c.fillStyle = grad(c, x0, 0, x0 + w, 0, ['#3D9BF5', '#2A7FE0']); c.fill(); c.restore(); }
        const ex = x0 + 22 + EM, upd = r.up.filter(u => t >= u), bump = upd.length ? Math.max(0, Math.sin(Math.PI * cl((t - upd[upd.length - 1]) / .35))) : 0, ek = 1 + (isSel ? .4 : .14) * bump;
        c.save(); c.translate(ex, 512); c.scale(ek, ek); c.translate(-ex, -512);
        if (r.n === 'thumb') thumbUp(c, ex, 514, EM); else if (r.n === 'heart') heart(c, ex, 514, EM * .95); else if (r.n === 'fire') fire(c, ex, 512 + EM * .95, EM * 1.25, EM * 1.95, t); else face(c, ex, 512, EM * .86, { r: Math.sin(t * 7) * .1 }, cc => lolFeat(cc, t, 0));
        c.restore();
        // счётчик перекатывается
        const tx = ex + EM + 14, n0 = r.v + upd.length; let last = upd.length ? upd[upd.length - 1] : -9; const rp = ss((t - last) / .28);
        const col = isSel ? (sel > .5 ? '#fff' : '#2A86E8') : '#2A86E8';
        c.save(); rr(c, tx - 4, 512 - 40, w, 80, 0); c.clip();
        if (rp < 1 && upd.length) { T(c, String(n0 - 1), tx, 512 - rp * 62, PX, col, 'b', 'left'); T(c, String(n0), tx, 512 + (1 - rp) * 62, PX, col, 'b', 'left'); } else T(c, String(n0), tx, 512, PX, col, 'b', 'left');
        c.restore();
      });
      if (isSel) { const hx = x0 + 22 + EM; for (let j = 0; j < 6; j++) { const q = (t - tc - .02) / .8; if (q <= 0 || q >= 1) continue; const a2 = -Math.PI / 2 + (j - 2.5) * .42, d = 40 + 150 * eo(q);
        c.save(); c.globalAlpha *= 1 - ss((q - .5) / .5); heart(c, hx + Math.cos(a2) * d, 512 - 30 + Math.sin(a2) * d, 16 * (1 - .4 * q)); c.restore(); }
        touch(c, x0 + w / 2 + 10, 528, t, tc, 46); }
    });
  });

  A('f-emo-wow', '«WOW» с лучами', GR, 2.8, (c, t, D) => {
    const e = env(t, D);
    wk(c, 512, 512, e, () => {
      const rk = cl(spr(t, 8, .8)); c.save(); c.translate(512, 512); c.rotate(t * .45); for (let i = 0; i < 18; i++) { const a = i / 18 * TAU, R = 480 * rk; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, a - .075, a + .075); c.closePath();
        const g = c.createRadialGradient(0, 0, 60, 0, 0, Math.max(61, R)); g.addColorStop(0, 'rgba(255,214,10,.95)'); g.addColorStop(1, 'rgba(255,149,0,0)'); c.fillStyle = g; c.fill(); } c.restore();
      const bk = spr(t - .05, 12, .62); if (bk > .01) { c.save(); c.translate(512, 512); c.rotate(Math.sin(t * 3) * .03); c.scale(bk, bk); c.beginPath();
        for (let i = 0; i < 44; i++) { const a = i / 44 * TAU, r = (i % 2 ? 240 : 290) * (1 + .03 * Math.sin(i * 1.7)); const px = Math.cos(a) * r * 1.14, py = Math.sin(a) * r * .92; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath();
        c.save(); sh(c, 1); c.fillStyle = '#FF2E7E'; c.fill(); c.restore(); c.fillStyle = grad(c, 0, -300, 0, 300, ['#FF5C9A', '#FF2E7E', '#E0156A']); c.fill(); c.lineWidth = 12; c.strokeStyle = '#fff'; c.lineJoin = 'round'; c.stroke(); c.restore(); }
      const FNT = 'Unbounded-ExtraBold', px = 178; setF(c, px, FNT); const L = ['W', 'O', 'W'], ws = L.map(s => c.measureText(s).width), tot = ws[0] + ws[1] + ws[2] - 20; let x0 = 512 - tot / 2;
      L.forEach((s, i) => { const w = ws[i], x = x0 + w / 2; x0 += w - 10; const k = spr(t - .2 - i * .09, 15, .42), bob = Math.sin(t * 6 - i * .9) * 8 * cl((t - .9) / .3); if (k <= .01) return;
        c.save(); c.translate(x, 512 + bob); c.rotate([-.08, .04, .08][i] * (1 - cl(k))); c.scale(k, k); setF(c, px, FNT); c.lineJoin = 'round';
        c.lineWidth = 22; c.strokeStyle = '#fff'; c.save(); sh(c, .6); c.strokeText(s, 9, 11); c.restore(); c.strokeText(s, 0, 0);
        for (let j = 12; j > 0; j--) { c.fillStyle = '#B8340E'; c.fillText(s, j * .75, j * .95); }
        c.fillStyle = grad(c, 0, -90, 0, 90, ['#FFF59A', '#FFD21F', '#FF9A00']); c.fillText(s, 0, 0); c.restore(); });
      [[190, 250, 36, .7], [850, 290, 28, .85], [830, 760, 32, 1.0], [180, 740, 24, 1.1]].forEach(([x, y, s, tc], i) => { const k = spr(t - tc, 14, .45) * (.75 + .25 * Math.sin(t * 8 + i * 2)); c.save(); sh(c, .3); spark(c, x, y, s * k, '#fff', t); c.restore(); });
    });
  });

  A('f-emo-lol-text', '«ЛОЛ» со смайлом вместо «О»', GR, 2.8, (c, t, D) => {
    const e = env(t, D), on = cl((t - .7) / .2);
    wk(c, 512, 512, e, () => {
      const FNT = 'DelaGothicOne', px = 280;
      [-1, 1].forEach((sd, j) => { const i = j * 2, k = spr(t - .1 - i * .09, 15, .45); if (k <= .01) return; const by = -Math.max(0, Math.sin(t * 7 - i * 1.1)) * 42 * on;
        c.save(); c.translate(512 + sd * 270, 512 + by); c.scale(k, k); c.rotate(sd * .05); setF(c, px, FNT); c.lineJoin = 'round';
        c.lineWidth = 24; c.strokeStyle = '#fff'; c.save(); sh(c, .8); c.strokeText('Л', 0, 0); c.restore();
        c.fillStyle = grad(c, 0, -130, 0, 130, ['#FF7AB8', '#FF3D8F', '#8B5CFF']); c.fillText('Л', 0, 0); c.restore(); });
      const k = spr(t - .19, 14, .42), by = -Math.max(0, Math.sin(t * 7 - 1.1)) * 42 * on, jig = Math.sin(t * 30) * on;
      if (k > .01) { c.save(); c.translate(512, 512 + by); c.scale(k, k); c.translate(-512, -512); circ(c, 512, 512, 152, '#fff');
        face(c, 512, 512, 138, { r: Math.sin(t * 8) * .14 * on, ky: 1 + .03 * jig }, cc => lolFeat(cc, t, jig)); c.restore(); }
    });
  });

  A('f-emo-kiss', 'Воздушный поцелуй', GR, 3, (c, t, D) => {
    const e = env(t, D), tk = .8, w = ss((t - tk) / .1), lean = t > tk ? Math.sin(Math.PI * cl((t - tk) / .4)) : 0;
    wk(c, 512, 540, { k: e.k * (1 + .05 * lean), a: e.a }, () => {
      face(c, 470, 560, 250, { r: -.06 * w }, c => {
        for (const sd of [-1, 1]) ell(c, sd * 60, 24, 17, 9, 0, `rgba(255,96,110,${.2 + .22 * w})`);
        for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 62, -58); c.quadraticCurveTo(sd * 42, -70, sd * 22, -62); stk(c, 6.5); }
        if (w < .5) eye(c, -38, -22, 11, 16, w * 2); else arcUp(c, -38, -20, 17, 9, 7.5);
        eye(c, 38, -22, 11, 16, blink(t, [.4, 2.3]));
        c.save(); c.globalAlpha *= 1 - w; c.beginPath(); c.moveTo(-32, 38); c.quadraticCurveTo(0, 62, 32, 38); stk(c, 7.5); c.restore();
        c.save(); c.globalAlpha *= w; c.translate(4, 0); c.beginPath(); c.moveTo(-4, 28); c.bezierCurveTo(16, 26, 18, 40, 4, 42); c.bezierCurveTo(18, 44, 16, 58, -4, 56); stk(c, 7.5); c.restore();
      });
      [[tk + .05, 1], [tk + .8, .7]].forEach(([th, sc], i) => { const q = (t - th) / 1.3; if (q <= 0 || q >= 1) return; const x = 470 + 70 + 300 * eo(q) + Math.sin(q * 9) * 18, y = 560 + 110 - 470 * eo(q) - (i ? 40 : 0) * q;
        c.save(); c.globalAlpha *= 1 - ss((q - .7) / .3); c.translate(x, y); c.rotate(.25 * Math.sin(q * 7)); heart(c, 0, 0, 70 * sc * (.25 + .75 * spr(q * 1.3, 12, .5)), undefined, { line: 8, sh: .4 }); c.restore(); });
    });
  });
})(window);

/* ---- styles7g.js ---- */
/* Футажи: новые категории (часть g) — рисуют инструментами window.KKFOOT из styles6.js
   «Комикс и звуки» (f-cmx-*) и дополнение к «Пиксель-арт» (f-px2-*) */
(function (G) {
  const F = G.KKFOOT; if (!F) return;
  const { A, cl, eo, ein, lerp, ss, TAU, spr, env, wk, sh, nosh, circ, grad, burst, PG, pgDraw, HEART } = F;

  /* =====================================================================
     Комикс и звуки: жирная обводка, полутон, взрывы, пузыри
     ===================================================================== */
  const CG = 'Комикс и звуки', INK = '#17171F';
  const hs = (i, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7 + 1.3) * 43758.5453; return v - Math.floor(v); };
  // взрыв с неровными зубцами (sy — сплющить по вертикали)
  function jag(c, cx, cy, R, r, n, seed = 0, rot = 0, jit = .26, sy = 1) {
    c.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = rot + (i + (hs(i, seed) - .5) * .55) / (n * 2) * TAU, d = i % 2 ? r * (.9 + .2 * hs(i + 40, seed)) : R * (1 - jit * hs(i + 99, seed));
      c.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d * sy); }
    c.closePath(); }
  // заливка с жирной обводкой: сначала обводка всех частей, потом заливка — внутренние швы не видны
  function inkFill(c, paths, fill, lw = 14, shk = .6) { if (!Array.isArray(paths)) paths = [paths]; c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    if (shk) sh(c, shk); c.lineWidth = lw * 2; c.strokeStyle = INK; paths.forEach(p => { p(); c.stroke(); }); nosh(c); c.fillStyle = fill; paths.forEach(p => { p(); c.fill(); }); c.restore(); }
  // полутон: точки по сетке под 45°, растут к краю (inv — к центру); рисовать внутри clip
  function halftone(c, cx, cy, R, col, step = 24, maxR = 9, inv = false) { c.fillStyle = col; c.beginPath(); const ca = Math.SQRT1_2;
    for (let gy = -R * 1.5; gy <= R * 1.5; gy += step) for (let gx = -R * 1.5; gx <= R * 1.5; gx += step) { const x = (gx - gy) * ca, y = (gx + gy) * ca, d = Math.hypot(x, y) / R;
      if (d > 1.1) continue; const r = maxR * cl(inv ? 1.05 - d : d * 1.15 - .12); if (r < .7) continue; c.moveTo(cx + x + r, cy + y); c.arc(cx + x, cy + y, r, 0, TAU); }
    c.fill(); }
  // пышное облако из кругов
  function cloudPath(c, cx, cy, rx, ry, n, rb, seed, ph = 0) { c.beginPath(); c.moveTo(cx + rx, cy); c.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    for (let i = 0; i < n; i++) { const a = (i + hs(i, seed) * .4) / n * TAU, r = rb * (.78 + .44 * hs(i + 7, seed)) * (1 + .05 * Math.sin(ph + i * 2.1)), x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); } }
  function star5(c, x, y, R, rot = 0, ir = .46) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = rot - Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? R * ir : R; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } c.closePath(); }
  function spark4(c, x, y, R, col) { if (R <= .5) return; c.beginPath(); c.moveTo(x, y - R); c.quadraticCurveTo(x, y, x + R, y); c.quadraticCurveTo(x, y, x, y + R); c.quadraticCurveTo(x, y, x - R, y); c.quadraticCurveTo(x, y, x, y - R); c.fillStyle = col; c.fill(); }
  // комикс-надпись: заливка (цвет или [верх, низ]), жирная обводка, объёмная тень; edge — белая кайма вокруг (видно на тёмном видео)
  function ctext(c, s, x, y, px, font, fill, o = {}) {
    c.save(); c.font = `${px}px "${font}"`; if (o.maxW) { const w = c.measureText(s).width; if (w > o.maxW) { px *= o.maxW / w; c.font = `${px}px "${font}"`; } }
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.miterLimit = 2;
    const lw = o.lw ?? px * .13, ex = o.ex ?? px * .06, yy = y + px * .05;
    if (o.edge) { c.lineWidth = lw + px * .09; c.strokeStyle = '#fff'; sh(c, .45); c.strokeText(s, x + ex, yy + ex); nosh(c); c.strokeText(s, x, yy); }
    if (ex) { c.fillStyle = INK; c.strokeStyle = INK; c.lineWidth = lw; for (let k = 1; k <= 4; k++) { const d = ex * k / 4; c.strokeText(s, x + d, yy + d); c.fillText(s, x + d, yy + d); } }
    c.lineWidth = lw; c.strokeStyle = INK; c.strokeText(s, x, yy);
    c.fillStyle = Array.isArray(fill) ? grad(c, 0, yy - px * .42, 0, yy + px * .42, fill) : fill; c.fillText(s, x, yy);
    c.restore(); return px; }
  // по буквам с пружиной (step — задержка между буквами)
  function ctextPop(c, s, x, y, px, font, fill, t, t0, step = .08, o = {}) {
    const ch = [...s]; c.save(); c.font = `${px}px "${font}"`; let ws = ch.map(q => c.measureText(q).width), tr = o.track ?? px * .02, tot = ws.reduce((a, b) => a + b, 0) + tr * (ch.length - 1);
    if (o.maxW && tot > o.maxW) { const k = o.maxW / tot; px *= k; ws = ws.map(w => w * k); tr *= k; tot = o.maxW; } c.restore();
    let cx = x - tot / 2; ch.forEach((q, i) => { const k = spr(t - t0 - i * step, o.f || 16, o.z || .42), lx = cx + ws[i] / 2;
      if (k > .01) { c.save(); c.translate(lx, y + (o.dy ? o.dy(i) : 0)); if (o.rot) c.rotate(o.rot(i)); c.scale(k, k); ctext(c, q, 0, 0, px, font, Array.isArray(fill[0]) ? fill[i % fill.length] : fill, o); c.restore(); }
      cx += ws[i] + tr; }); }
  // слой: рисуем во внеэкранный холст и кладём с прозрачностью — при растворении не просвечивают обводки под заливкой
  const POOL = []; let depth = 0;
  function layer(c, a, fn) { if (a <= .002) return; if (a >= .998 || !c.canvas || !c.getTransform) { c.save(); fn(c); c.restore(); return; }
    const W = c.canvas.width, H = c.canvas.height; let o = POOL[depth]; if (!o || o.width !== W || o.height !== H) { o = POOL[depth] = document.createElement('canvas'); o.width = W; o.height = H; }
    const g = o.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalAlpha = 1; g.setTransform(c.getTransform()); depth++; try { fn(g); } finally { depth--; }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha *= a; c.drawImage(o, 0, 0); c.restore(); }
  function wkL(c, cx, cy, e, fn) { if (e.a <= .002 || e.k <= .002) return; layer(c, cl(e.a), g => { g.save(); g.translate(cx, cy); if (e.r) g.rotate(e.r); g.scale(e.k, e.ky || e.k); g.translate(-cx, -cy); fn(g); g.restore(); }); }
  // мягче пружина для крупных фигур (меньше перелёт — не упираются в края)
  const envC = (t, D, t0 = 0, out = .3) => { const o = ein(cl((t - (D - out)) / out)); return { k: Math.max(0, spr(t - t0, 13, .56) * (1 - .3 * o)), a: cl((t - t0) / .06) * (1 - o) }; };
  const shake = (t, t0, d = .4, amp = 12, f = 80) => t > t0 && t < t0 + d ? Math.sin((t - t0) * f) * amp * (1 - (t - t0) / d) : 0;

  A('f-cmx-bam', '«БАМ!» — взрыв с полутоном', CG, 2.5, (c, t, D) => {
    const e = envC(t, D), sk = shake(t, .02, .45, 14); e.r = -.07 + Math.sin(t * 2.4) * .02;
    wkL(c, 512 + sk, 512, e, c => {
      burst(c, 512, 512, t, .08, { n: 14, R: 370, s: 14, ring: false, cols: ['#FFD60A', '#FF3B30', '#FF9F0A'] });
      const rot = t * .12;
      inkFill(c, () => jag(c, 512, 512, 385, 285, 13, 1, rot), '#FF3B30', 15, .8);
      c.save(); jag(c, 512, 512, 316, 240, 13, 2, rot + .12); c.fillStyle = grad(c, 0, 250, 0, 780, ['#FFE45C', '#FFC300']); c.fill(); c.clip(); halftone(c, 512, 512, 340, 'rgba(255,120,0,.5)', 26, 10); c.restore();
      c.save(); jag(c, 512, 512, 316, 240, 13, 2, rot + .12); c.lineWidth = 7; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke(); c.restore();
      const tk = spr(t - .1, 15, .36); c.save(); c.translate(512, 512); c.scale(tk, tk);
      ctext(c, 'БАМ!', 0, 0, 150, 'RubikMonoOne', ['#FF6157', '#E0102A'], { maxW: 430 }); c.restore();
    });
  });

  A('f-cmx-boom', '«БУМ» — облако взрыва', CG, 2.8, (c, t, D) => {
    const e = envC(t, D), sk = shake(t, .05, .45, 10, 70), fo = 1 - cl((t - (D - .3)) / .3);
    wkL(c, 512 + sk, 520, e, c => {
      const pk = eo(cl((t - .12) / 1.5));
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + .2 + hs(i, 4) * .3, d = 280 + 110 * pk, r = 44 * (1 - .65 * pk) * cl((t - .1) / .1);
        if (r > 2) layer(c, (1 - pk * .6) * fo, c => inkFill(c, () => { c.beginPath(); c.arc(512 + Math.cos(a) * d, 520 + Math.sin(a) * d * .8, r, 0, TAU); }, i % 2 ? '#FF9F0A' : '#FFD60A', 8, .3)); }
      const L = [[222, 165, 11, 96, 3, '#FF453A', 0], [168, 124, 10, 75, 4, '#FF9F0A', .07], [114, 83, 9, 56, 5, '#FFD60A', .14]];
      L.forEach(([rx, ry, n, rb, sd, col, d0], j) => { const k = Math.max(0, spr(t - d0, 12, .62)); if (k < .01) return; c.save(); c.translate(512, 520); c.scale(k, k); c.translate(-512, -520);
        const P = () => cloudPath(c, 512, 520, rx, ry, n, rb, sd, t * 5 + j);
        if (j === 0) inkFill(c, P, col, 13, .8); else { P(); c.fillStyle = col; c.fill(); }
        if (j === 2) { c.save(); P(); c.clip(); halftone(c, 512, 520, 230, 'rgba(255,140,0,.55)', 22, 8); c.restore(); }
        c.restore(); });
      ctextPop(c, 'БУМ', 512, 520, 150, 'DelaGothicOne', ['#FFFFFF', '#FFE9D6'], t, .18, .09, { maxW: 420 });
    });
  });

  A('f-cmx-pof', '«ПОФ» — облачко рассыпается', CG, 2.5, (c, t, D) => {
    const e = envC(t, D, 0, .25), sp = eo(cl((t - 1.05) / 1.1)), km = 1 - ein(cl((t - 1.0) / .3));
    wkL(c, 512, 512, e, c => { const CF = grad(c, 0, 340, 0, 700, ['#FFFFFF', '#E6DAFF']);
      if (km > .01) { c.save(); c.translate(512, 520); c.scale(km, km); c.translate(-512, -520);
        inkFill(c, () => cloudPath(c, 512, 520, 205, 135, 10, 88, 8, t * 4), CF, 10, .6); c.restore(); }
      if (t > 1.05) for (let i = 0; i < 7; i++) { const a = i / 7 * TAU - .4 + hs(i, 2) * .4, d = 150 + 200 * sp, r = (60 + 20 * hs(i, 6)) * (1 - .7 * sp);
        const pk = spr(t - 1.02, 16, .5); if (pk > .01) layer(c, 1 - ein(sp), c => inkFill(c, () => cloudPath(c, 512 + Math.cos(a) * d, 500 + Math.sin(a) * d * .75 - 60 * sp, r * .55 * pk, r * .4 * pk, 5, r * .45 * pk, i), CF, 8, .4)); }
      const k = spr(t - .12, 14, .4); c.save(); c.translate(512, 520); c.scale(k, k); c.rotate(-.06 + .03 * Math.sin(t * 5));
      ctext(c, 'ПОФ', 0, 0, 170, 'Pangolin', ['#D69BFF', '#9F44D3'], { maxW: 380, edge: t > 1.05 }); c.restore();
    });
  });

  A('f-cmx-vzhuh', '«ВЖУХ» — пролёт со следом скорости', CG, 2.4, (c, t, D) => {
    const X = tt => lerp(-480, 512, spr(tt - .05, 11, .62)) + 700 * ein(cl((tt - (D - .45)) / .45));
    const x = X(t), v = cl(Math.abs(x - X(t - .04)) / 55), a = 1 - cl((t - (D - .2)) / .2);
    layer(c, a * cl(t / .06), c => { c.save();
    const Y = [[-118, .7], [-62, 1], [-8, .85], [48, 1], [104, .75], [150, .55]];
    c.lineCap = 'round'; Y.forEach(([dy, w], i) => { const len = (60 + 520 * v) * w * (.75 + .5 * hs(i, 1)), x1 = x - 300 - 30 * hs(i, 3), x0 = x1 - len; if (len < 30) return;
      c.strokeStyle = INK; c.lineWidth = 26; c.beginPath(); c.moveTo(x0, 512 + dy); c.lineTo(x1, 512 + dy); c.stroke();
      c.strokeStyle = i % 2 ? '#FFFFFF' : '#64D2FF'; c.lineWidth = 12; c.beginPath(); c.moveTo(x0, 512 + dy); c.lineTo(x1, 512 + dy); c.stroke(); });
    const sk = -.2 - .28 * v; c.translate(x, 512); c.transform(1, 0, sk, 1, 0, 0); c.scale(1 + .12 * v, 1 - .06 * v);
    ctext(c, 'ВЖУХ', 0, 0, 190, 'RussoOne', ['#A8EBFF', '#0A84FF'], { maxW: 560, edge: true });
    c.restore(); });
  });

  A('f-cmx-hryas', '«ХРЯСЬ» — надпись трескается', CG, 2.6, (c, t, D) => {
    const e = envC(t, D), tc = 1.0, cr = eo(cl((t - tc) / .22)), sk = shake(t, tc, .38, 13, 90); e.r = -.05;
    const Z = [[70, 470], [240, 545], [380, 468], [520, 566], [650, 478], [800, 552], [960, 498]];
    wkL(c, 512 + sk, 512, e, c => {
      inkFill(c, () => jag(c, 512, 512, 410, 250, 10, 5, .25, .3, .74), '#FFD60A', 14, .8);
      c.save(); jag(c, 512, 512, 410, 250, 10, 5, .25, .3, .74); c.clip(); halftone(c, 512, 512, 400, 'rgba(255,128,0,.5)', 26, 10);
      if (cr > 0) { const n = Math.ceil(cr * (Z.length - 1)); c.strokeStyle = INK; c.lineWidth = 9; c.lineJoin = 'round'; c.beginPath(); for (let i = 0; i <= n; i++) c.lineTo(Z[i][0], Z[i][1] + 8); c.stroke(); }
      c.restore();
      const half = (top) => { c.save(); c.beginPath(); Z.forEach(p => c.lineTo(p[0], p[1])); c.lineTo(1024, top ? -50 : 1100); c.lineTo(0, top ? -50 : 1100); c.closePath(); c.clip();
        const d = top ? -1 : 1; c.translate(512 + d * cr * 12, 512 + d * cr * 16); c.rotate(d * cr * .035); const k = spr(t - .1, 15, .38); c.scale(k, k);
        ctext(c, 'ХРЯСЬ', 0, 0, 150, 'DelaGothicOne', ['#FF6A5F', '#D70015'], { maxW: 600 }); c.restore(); };
      half(true); half(false);
      if (t > tc) for (let i = 0; i < 9; i++) { const k = cl((t - tc) / .7), p = Z[1 + i % 5], a = -Math.PI / 2 + (hs(i, 8) - .5) * 2.6 + (i % 2 ? Math.PI : 0), d = 40 + 230 * eo(k), s = 22 * (1 - k);
        if (s > 1) { c.save(); c.translate(p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d); c.rotate(k * 8 + i); inkFill(c, () => { c.beginPath(); c.moveTo(0, -s); c.lineTo(s * .9, s * .7); c.lineTo(-s * .8, s * .5); c.closePath(); }, '#FFFFFF', 4, 0); c.restore(); } }
    });
  });

  A('f-cmx-dzyn', '«ДЗЫНЬ» — звенит и вибрирует', CG, 2.5, (c, t, D) => {
    const e = env(t, D), hit = t0 => t > t0 ? Math.exp(-(t - t0) * 4.5) : 0, v = Math.min(1, hit(.2) + hit(1.25)), jx = Math.sin(t * 95) * 10 * v, jr = Math.sin(t * 70 + 1) * .05 * v;
    wkL(c, 512, 512, e, c => {
      c.lineCap = 'round';
      [-1, 1].forEach(sd => { for (let j = 0; j < 3; j++) { const al = cl(v * 1.6) * (.45 + .55 * Math.max(0, Math.sin(t * 22 - j * 1.2))); if (al < .02) continue;
        const r = 278 + j * 44, a0 = sd < 0 ? Math.PI : 0; layer(c, al, c => { c.lineCap = 'round';
        c.beginPath(); c.arc(512 + jx * .3, 512, r, a0 - .34, a0 + .34); c.strokeStyle = INK; c.lineWidth = 28; c.stroke(); c.strokeStyle = j === 1 ? '#FFD60A' : '#FFFFFF'; c.lineWidth = 14; c.stroke(); }); } });
      [[236, 292, 0], [792, 282, 1.7], [282, 744, 3.1], [770, 736, .9]].forEach(([x, y, p], i) => { const k = Math.max(0, Math.sin(t * 5 + p)) * cl((t - .25 - i * .1) / .2);
        spark4(c, x, y, 62 * k, '#FFFFFF'); spark4(c, x, y, 36 * k, '#FFD60A'); });
      c.save(); c.translate(512 + jx, 512); c.rotate(jr - .05);
      ctext(c, 'ДЗЫНЬ', 0, 0, 150, 'Montserrat-Black', ['#FFE96B', '#FF9F0A'], { maxW: 470, edge: true }); c.restore();
    });
  });

  A('f-cmx-ogo', '«ОГО!» — буквы выпрыгивают', CG, 2.6, (c, t, D) => {
    const e = envC(t, D), br = 1 + .03 * Math.sin((t - .8) * 6) * cl(t - .8);
    wkL(c, 512, 512, { k: e.k * br, a: e.a }, c => {
      const rot = -t * .1;
      inkFill(c, () => jag(c, 512, 512, 380, 300, 18, 7, rot, .2), '#FF2D96', 14, .8);
      c.save(); jag(c, 512, 512, 312, 252, 18, 8, rot + .09, .15); c.fillStyle = grad(c, 0, 200, 0, 820, ['#FF9ED2', '#FF4FAE']); c.fill(); c.clip();
      halftone(c, 512, 512, 330, 'rgba(255,255,255,.4)', 24, 9, true); c.restore();
      ctextPop(c, 'ОГО!', 512, 512, 170, 'RubikMonoOne', ['#FFF27A', '#FFC300'], t, .18, .12, { maxW: 500, track: 0, rot: i => (i % 2 ? .07 : -.07), dy: i => (i % 2 ? 8 : -8) });
    });
  });

  A('f-cmx-chto', '«ЧТО?!» — удивление с встряской', CG, 2.6, (c, t, D) => {
    const e = envC(t, D), t1 = .45; e.r = t > t1 ? .11 * Math.sin((t - t1) * 17) * Math.exp(-(t - t1) * 2.6) : 0;
    wkL(c, 512, 512, e, c => {
      burst(c, 512, 512, t, .05, { n: 10, R: 380, s: 12, ring: false, lines: true, cols: ['#FFFFFF', '#FFD60A'] });
      inkFill(c, () => jag(c, 512, 512, 395, 245, 9, 11, .3, .32, .82), '#5E5CE6', 14, .8);
      c.save(); jag(c, 512, 512, 395, 245, 9, 11, .3, .32, .82); c.clip(); c.fillStyle = grad(c, 0, 150, 0, 870, ['#8E8CFF', '#4B48D9']); c.fillRect(0, 0, 1024, 1024);
      halftone(c, 512, 512, 380, 'rgba(30,20,120,.35)', 24, 9); c.restore();
      const k = spr(t - .08, 15, .4), px = 150, f = 'DelaGothicOne'; c.save(); c.font = `${px}px "${f}"`; const w1 = c.measureText('ЧТО').width, w2 = c.measureText('?!').width, gap = 10, tot = w1 + w2 + gap; c.restore();
      c.save(); c.translate(512, 512); c.scale(k, k);
      ctext(c, 'ЧТО', -tot / 2 + w1 / 2, 0, px, f, ['#FFFFFF', '#E6E4FF']);
      c.translate(tot / 2 - w2 / 2, 0); c.rotate(.12 * Math.sin(t * 6)); ctext(c, '?!', 0, 0, px, f, ['#FFE45C', '#FF9F0A']); c.restore();
    });
  });

  A('f-cmx-haha', '«ХА-ХА» — смех прыгает', CG, 3, (c, t, D) => {
    const o = 1 - ein(cl((t - (D - .3)) / .3));
    const W = [['ХА', 330, 390, 200, -.16, .1], ['ХА', 690, 520, 220, .1, .3], ['ХА!', 420, 715, 160, -.06, .55]];
    W.forEach(([s, x, y, px, r, t0], i) => { const k = spr(t - t0, 14, .42) * (1 - .3 * (1 - o)); if (k < .01) return;
      const ph = Math.max(0, t - t0 - .3) * 7.5 + i * 1.3, b = Math.abs(Math.sin(ph)), sq = Math.max(0, 1 - b * 6) * .1 * cl(t - t0 - .3);
      layer(c, cl((t - t0) / .06) * o, c => { c.save(); c.translate(x, y - b * 34 * cl((t - t0 - .3) * 3)); c.rotate(r + .05 * Math.sin(ph)); c.scale(k * (1 + sq), k * (1 - sq));
      ctext(c, s, 0, 0, px, 'Pangolin', ['#FFE96B', '#FFB300'], { edge: true });
      c.lineCap = 'round'; const w = px * .75 * s.length / 2 + 30, al = cl(Math.sin(ph * 1.3) * 1.5);
      if (al > 0) layer(c, al, c => { c.lineCap = 'round'; [-.5, 0, .5].forEach(a => { const ca = Math.cos(a - .9), sa = Math.sin(a - .9); c.strokeStyle = INK; c.lineWidth = 16; c.beginPath(); c.moveTo(w * .9 * ca, px * .7 * sa); c.lineTo(w * 1.05 * ca, px * .9 * sa); c.stroke();
        c.strokeStyle = '#FFFFFF'; c.lineWidth = 7; c.stroke(); }); });
      c.restore(); }); });
  });

  // речевой пузырь: эллипс + хвостик одной линией
  function speechPath(c, cx, cy, rx, ry, tx, ty, wd = .2) { const a = Math.atan2((ty - cy) / ry, (tx - cx) / rx); c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, a + wd, a - wd + TAU);
    const ex = cx + Math.cos(a - wd) * rx, ey = cy + Math.sin(a - wd) * ry, sx = cx + Math.cos(a + wd) * rx, sy = cy + Math.sin(a + wd) * ry;
    c.quadraticCurveTo(lerp(ex, tx, .45) + 10, lerp(ey, ty, .55), tx, ty); c.quadraticCurveTo(lerp(sx, tx, .5), lerp(sy, ty, .4), sx, sy); c.closePath(); }
  A('f-cmx-speech', 'Речевой пузырь «Привет!»', CG, 3, (c, t, D) => {
    const e = envC(t, D), s = 'Привет!', n = Math.floor(cl((t - .45) / .75) * s.length + .0001), cx = 545, cy = 450;
    e.r = .03 * Math.sin(t * 3) * cl(t - .3);
    wkL(c, 300, 790, e, c => {
      inkFill(c, () => speechPath(c, cx, cy, 318, 200, 300, 790), grad(c, 0, 240, 0, 680, ['#FFFFFF', '#EEF1FF']), 10, .8);
      c.save(); c.font = '132px "Pangolin"'; const fw = c.measureText(s).width; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = INK;
      const k = n >= s.length ? 1 + .06 * Math.sin(Math.PI * cl((t - 1.2) / .3)) : 1; c.translate(cx, cy + 6); c.scale(k, k); c.fillText(s.slice(0, n), -fw / 2, 0);
      if (n < s.length && t > .3 && Math.floor(t * 6) % 2 === 0) { const w = c.measureText(s.slice(0, n)).width; c.fillRect(-fw / 2 + w + 6, -52, 8, 104); } c.restore();
    });
  });

  A('f-cmx-thought', 'Пузырь мыслей «Хм…»', CG, 3.2, (c, t, D) => {
    const o = 1 - cl((t - (D - .3)) / .3), ok = 1 - .3 * ein(1 - o), bob = Math.sin(t * 2.4) * 8, Fg = c => grad(c, 0, 280, 0, 700, ['#FFFFFF', '#EEF1FF']);
    [[218, 860, 18, .05], [268, 790, 28, .17], [338, 712, 40, .29]].forEach(([x, y, r, t0]) => wkL(c, x, y, { k: spr(t - t0, 16, .5) * ok, a: cl((t - t0) / .05) * o }, c =>
      inkFill(c, () => { c.beginPath(); c.arc(x, y + bob * .4, r, 0, TAU); }, Fg(c), 9, .5)));
    wkL(c, 420, 650, { k: spr(t - .4, 12, .58) * ok, a: cl((t - .4) / .06) * o }, c => {
      inkFill(c, () => cloudPath(c, 548, 440 + bob, 240, 145, 11, 80, 11, t * 3), Fg(c), 10, .8);
      c.save(); c.font = '150px "Pangolin"'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = INK; const w = c.measureText('Хм').width, x0 = 548 - (w + 116) / 2;
      c.fillText('Хм', x0, 448 + bob); const nd = t < .9 ? 0 : 1 + Math.floor((t - .9) * 3) % 3;
      for (let i = 0; i < 3; i++) { const k = i < nd ? spr(((t - .9) * 3 % 1) / 3 + (nd - 1 - i) / 3 + .1, 18, .5) : 0; if (k > .01) circ(c, x0 + w + 24 + i * 40, 486 + bob, 12.5 * Math.min(k, 1.2), INK); }
      c.restore();
    });
  });

  A('f-cmx-shout', 'Крик-пузырь с зубцами «ЭЙ!»', CG, 2.6, (c, t, D) => {
    const e = envC(t, D), sk = shake(t, .05, .55, 16, 85), pu = 1 + .045 * Math.max(0, Math.sin((t - .6) * 9)) * cl(t - .6);
    wkL(c, 300 + sk, 760, { k: e.k * pu, a: e.a }, c => {
      const B = () => jag(c, 520, 470, 365, 312, 24, 21, 0, .14, .74), Tl = () => { c.beginPath(); c.moveTo(330, 620); c.lineTo(236, 846); c.lineTo(450, 660); c.closePath(); };
      inkFill(c, [B, Tl], '#FFFFFF', 12, .8);
      c.save(); B(); c.clip(); halftone(c, 520, 470, 330, 'rgba(10,132,255,.22)', 24, 9); c.restore();
      const k = spr(t - .12, 16, .36); c.save(); c.translate(520 + sk * .5, 478); c.scale(k, k); c.rotate(-.06);
      ctext(c, 'ЭЙ!', 0, 0, 220, 'DelaGothicOne', ['#FF6157', '#E0102A'], { maxW: 470 }); c.restore();
    });
  });

  A('f-cmx-speed', 'Лучи скорости по краям кадра', CG, 3, (c, t, D) => {
    const a0 = cl(t / .2) * (1 - cl((t - (D - .3)) / .3)), gr = eo(cl(t / .35)), fr = Math.floor(t * 12), N = 88, H = 468;
    if (a0 <= 0) return; c.save(); c.globalAlpha = a0; c.fillStyle = '#FFFFFF'; c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 12; c.beginPath();
    for (let i = 0; i < N; i++) { const a = (i + hs(i, 3) * .7) / N * TAU, ca = Math.cos(a), sa = Math.sin(a), m = H / Math.max(Math.abs(ca), Math.abs(sa));
      const rin = lerp(m, (250 + 170 * hs(i + fr * 13, 5)) * (1 + .12 * Math.abs(ca)), gr), w = 4 + 13 * hs(i, 9); if (m - rin < 8) continue;
      const ox = 512 + ca * m, oy = 512 + sa * m; c.moveTo(ox - sa * w, oy + ca * w); c.lineTo(512 + ca * rin, 512 + sa * rin); c.lineTo(ox + sa * w, oy - ca * w); c.closePath(); }
    c.fill(); c.restore();
  });

  A('f-cmx-dots', 'Пузырь: «…» печатается', CG, 3, (c, t, D) => {
    const e = envC(t, D);
    wkL(c, 740, 690, e, c => {
      const Bp = () => { c.beginPath(); c.roundRect(252, 362, 520, 250, 125); }, Tl = () => { c.beginPath(); c.moveTo(610, 570); c.quadraticCurveTo(670, 660, 745, 690); c.quadraticCurveTo(705, 625, 700, 556); c.closePath(); };
      inkFill(c, [Bp, Tl], grad(c, 0, 362, 0, 612, ['#FFFFFF', '#EEF1FF']), 10, .8);
      const ph = t < .35 ? -1 : (t - .35) % 1.3;
      for (let i = 0; i < 3; i++) { if (ph < 0) break; const k = spr(ph - .16 * i, 18, .45) * (ph < 1.02 ? 1 : 1 - ss((ph - 1.02) / .16)), up = Math.max(0, Math.sin(cl((ph - .16 * i) / .3) * Math.PI)) * 16;
        if (k > .01) circ(c, 412 + i * 100, 487 - up, 30 * Math.min(k, 1.3), INK); }
    });
  });

  A('f-cmx-qex', '«?!» — знаки прыгают', CG, 2.6, (c, t, D) => {
    const e = env(t, D);
    wkL(c, 512, 560, e, c => {
      [['?', 395, 0, ['#FFE45C', '#FF9F0A']], ['!', 640, .5, ['#FF6A7A', '#FF2D55']]].forEach(([s, x, off, fill]) => {
        const p = ((Math.max(0, t - .25) + off * .7) % .7) / .7, hgt = t < .25 ? 0 : Math.sin(p * Math.PI) * 130, land = t < .25 ? 0 : Math.max(0, 1 - Math.min(p, 1 - p) / .12);
        const sx = 1 + .14 * land, sy = 1 - .14 * land + .08 * Math.sin(p * Math.PI) * (1 - land);
        c.save(); c.globalAlpha *= .3 * (1 - hgt / 260); c.fillStyle = '#000'; c.beginPath(); c.ellipse(x, 742, 95 * (1 - hgt / 330), 18 * (1 - hgt / 330), 0, 0, TAU); c.fill(); c.restore();
        c.save(); c.translate(x, 725 - hgt); c.scale(sx, sy); c.rotate((off ? .1 : -.1) * Math.sin(p * TAU)); ctext(c, s, 0, -128, 300, 'RubikMonoOne', fill, { edge: true }); c.restore(); });
    });
  });

  A('f-cmx-stars', 'Звёздочки кружат после удара', CG, 3, (c, t, D) => {
    const e = env(t, D), cx = 512, cy = 500, RX = 330, RY = 100;
    wkL(c, cx, cy, e, c => {
      const S = []; for (let i = 0; i < 5; i++) { const a = t * 3.1 + i / 5 * TAU; S.push({ x: cx + Math.cos(a) * RX, y: cy + Math.sin(a) * RY, z: Math.sin(a), i }); }
      const st = p => { const s = 76 * (.66 + .34 * (p.z + 1) / 2); layer(c, .55 + .45 * (p.z + 1) / 2, c => {
        inkFill(c, () => star5(c, p.x, p.y, s, t * 3 + p.i * 1.3, .5), p.i % 2 ? '#FF9F0A' : '#FFD60A', 7, .45); spark4(c, p.x - s * .22, p.y - s * .25, s * .2, 'rgba(255,255,255,.9)'); }); };
      S.filter(p => p.z < 0).forEach(st);
      c.save(); c.globalAlpha *= .55; c.setLineDash([2, 26]); c.lineCap = 'round'; c.lineWidth = 9; c.strokeStyle = '#FFFFFF'; c.lineDashOffset = -t * 120; c.beginPath(); c.ellipse(cx, cy, RX, RY, 0, 0, TAU); c.stroke(); c.restore();
      S.filter(p => p.z >= 0).sort((p, q) => p.z - q.z).forEach(st);
      [[290, 330, 0], [750, 340, 2], [700, 680, 4], [330, 680, 5]].forEach(([x, y, p]) => { const k = Math.max(0, Math.sin(t * 6 + p)); spark4(c, x, y, 40 * k, '#FFFFFF'); });
    });
  });

  A('f-cmx-zzz', '«Zzz» — сон', CG, 3.5, (c, t, D) => {
    const o = (1 - ein(cl((t - (D - .35)) / .35))) * cl(t / .1);
    for (let j = 0; j < 7; j++) { const t0 = j * .6 - .55, k = (t - t0) / 2.0; if (k <= 0 || k >= 1) continue;
      const x = 380 + k * 280 + Math.sin(k * 5 + j) * 36, y = 760 - k * 470, px = 100 + 150 * k, al = cl(k / .1) * (1 - ss((k - .72) / .28)), r = -.22 + .14 * Math.sin(k * 4 + j), sp = spr(k * 2, 14, .5);
      layer(c, al * o, c => { c.translate(x, y); c.rotate(r); c.scale(sp, sp); ctext(c, 'Z', 0, 0, px, 'RubikMonoOne', ['#D9B8FF', '#7D6BFF'], { edge: true }); }); }
  });

  // капля: кончик сверху, круглое дно в (0,0)
  function dropPath(c, R) { c.beginPath(); c.moveTo(0, -1.85 * R); c.bezierCurveTo(R * .3, -1.25 * R, R, -.8 * R, R, 0); c.arc(0, 0, R, 0, Math.PI); c.bezierCurveTo(-R, -.8 * R, -R * .3, -1.25 * R, 0, -1.85 * R); c.closePath(); }
  function drop(c, x, y, R, sq) { c.save(); c.translate(x, y); c.scale(1 + sq, 1 - sq); inkFill(c, () => dropPath(c, R), grad(c, 0, -1.8 * R, 0, R, ['#D4EEFF', '#3D9BFF']), Math.max(5, R * .08), .5);
    c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.ellipse(-R * .42, -R * .25, R * .14, R * .32, .35, 0, TAU); c.fill(); circ(c, -R * .5, R * .22, R * .08, 'rgba(255,255,255,.8)'); c.restore(); }
  A('f-cmx-sweat', 'Капля пота стекает', CG, 2.8, (c, t, D) => {
    const e = env(t, D), sl = ss((t - .7) / 1.5) * 110, sq = .07 * Math.sin(t * 10) * Math.exp(-t * 1.4) + .04 * Math.sin(t * 7) * cl((t - .7) * 2) * (1 - cl((t - 2) * 2));
    wkL(c, 560, 440, e, c => {
      c.lineCap = 'round'; [[-1, 0], [0, 1], [1, 2]].forEach(([d, i]) => { const al = cl(Math.sin(t * 9 - i) * 2 + .6); layer(c, al, c => { c.lineCap = 'round';
        const x0 = 360 + d * 10, y0 = 330 + d * 70, x1 = x0 - 70, y1 = y0 + d * 18; c.strokeStyle = INK; c.lineWidth = 22; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.strokeStyle = '#FFFFFF'; c.lineWidth = 10; c.stroke(); }); });
      drop(c, 570, 400 + sl, 112, sq);
      const k2 = spr(t - 1.25, 15, .45), f2 = ss((t - 1.6) / 1.0) * 90; if (k2 > .01) drop(c, 760, 560 + f2, 50 * k2, sq * 1.5);
    });
  });

  // «вена злости»: четыре изогнутых уголка, вершинами к центру
  function vein(c, x, y, s, rot = 0) { c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); const g = 32, L = 118;
    const P = () => { c.beginPath(); [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([a, b]) => { c.moveTo(a * g, b * L); c.quadraticCurveTo(a * g * .15, b * g * .15, a * L, b * g); }); };
    c.lineCap = 'round'; c.lineJoin = 'round'; sh(c, .5); P(); c.strokeStyle = INK; c.lineWidth = 50; c.stroke(); nosh(c); P(); c.strokeStyle = grad(c, 0, -L, 0, L, ['#FF6A5F', '#D70015']); c.lineWidth = 30; c.stroke();
    P(); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 8; c.translate(-4, -4); c.stroke(); c.restore(); }
  A('f-cmx-anger', 'Вена злости пульсирует', CG, 2.6, (c, t, D) => {
    const e = envC(t, D), beat = x => Math.pow(Math.max(0, Math.sin(x)), 6), p = beat((t - .3) * 9) * cl(t - .3);
    wkL(c, 490, 540, { k: e.k * (1 + .14 * p), a: e.a }, c => vein(c, 490, 540, 1.75, -.08));
    const e2 = env(t, D, 1.0); wkL(c, 800, 250, { k: e2.k * (1 + .18 * beat((t - 1.1) * 9 + 1)), a: e2.a }, c => vein(c, 800, 250, .8, .3));
  });

  A('f-cmx-impact', 'Ударные линии-акценты вокруг', CG, 2.5, (c, t, D) => {
    const fo = 1 - cl((t - (D - .3)) / .3), N = 16, cols = ['#FFD60A', '#FFFFFF', '#FF453A'];
    layer(c, fo, c => { c.save(); c.lineCap = 'round';
    [.1, .8, 1.5].forEach((t0, w) => { const k = (t - t0) / .8; if (k <= 0 || k >= 1) return;
      for (let i = 0; i < N; i++) { const a = (i + (w % 2 ? .5 : 0) + (hs(i, w) - .5) * .3) / N * TAU, r0 = 205 + 35 * hs(i + 3, w), len = 70 + 75 * hs(i + 5, w);
        const fr = r0 + (len + 50) * eo(cl(k / .45)), bk = r0 + (len + 50) * ss(cl((k - .2) / .8)), lw = 18 + 10 * hs(i + 8, w); if (fr - bk < 2) continue;
        const ca = Math.cos(a), sa = Math.sin(a); c.beginPath(); c.moveTo(512 + ca * bk, 512 + sa * bk); c.lineTo(512 + ca * fr, 512 + sa * fr);
        c.strokeStyle = INK; c.lineWidth = lw + 14; c.stroke(); c.strokeStyle = cols[i % 3]; c.lineWidth = lw; c.stroke(); }
      const rk = eo(cl(k / .6)); c.save(); c.globalAlpha *= (1 - rk) * .7; c.strokeStyle = '#FFFFFF'; c.lineWidth = 14 * (1 - rk); c.beginPath(); c.arc(512, 512, 150 + 120 * rk, 0, TAU); if (c.lineWidth > .5) c.stroke(); c.restore(); });
    c.restore(); });
  });

  /* =====================================================================
     Пиксель-арт (дополнение): тот же 1 бит — чёрные пиксели с белой обводкой
     ===================================================================== */
  const PXG = 'Пиксель-арт', q12 = t => Math.floor(t * 12) / 12;
  // латиница и знаки 5×7 для игровых надписей (кириллица — в P.text из styles6.js)
  const LX = {
    G: [' ### ', '#   #', '#    ', '# ###', '#   #', '#   #', ' ####'], A: [' ### ', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'], M: ['#   #', '## ##', '# # #', '# # #', '#   #', '#   #', '#   #'],
    E: ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#####'], O: [' ### ', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '], V: ['#   #', '#   #', '#   #', '#   #', '#   #', ' # # ', '  #  '],
    R: ['#### ', '#   #', '#   #', '#### ', '# #  ', '#  # ', '#   #'], L: ['#    ', '#    ', '#    ', '#    ', '#    ', '#    ', '#####'], U: ['#   #', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
    P: ['#### ', '#   #', '#   #', '#### ', '#    ', '#    ', '#    '], H: ['#   #', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'], I: ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '#####'],
    X: ['#   #', '#   #', ' # # ', '  #  ', ' # # ', '#   #', '#   #'], '!': ['  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '     ', '  #  '], '+': ['     ', '  #  ', '  #  ', '#####', '  #  ', '  #  ', '     '],
    '-': ['     ', '     ', '     ', '#####', '     ', '     ', '     '], '1': ['  #  ', ' ##  ', '  #  ', '  #  ', '  #  ', '  #  ', ' ### '], '3': [' ### ', '#   #', '    #', '  ## ', '    #', '#   #', ' ### ']
  };
  const ptext = (P, s, x, y, v = 1, adv = 6) => [...s].forEach((ch, k) => { const gl = LX[ch]; if (gl) gl.forEach((r, j) => [...r].forEach((q, i) => { if (q === '#') P.set(x + k * adv + i, y + j, v); })); });
  const ptextC = (P, s, y, v = 1, adv = 6) => ptext(P, s, Math.round((P.n - (s.length * adv - (adv - 5))) / 2), y, v, adv);
  const sparkle = (P, x, y, big) => { P.set(x, y); P.set(x - 1, y); P.set(x + 1, y); P.set(x, y - 1); P.set(x, y + 1); if (big) { P.set(x - 2, y); P.set(x + 2, y); P.set(x, y - 2); P.set(x, y + 2); } };
  const ink = (P, x, y) => x >= 0 && y >= 0 && x < P.n && y < P.n && P.g[y * P.n + x] === 1;

  A('f-px2-coin', 'Пиксельная монетка крутится «+1»', PXG, 2.5, (c, t) => { const tq = q12(t), P = PG(32), f = Math.floor(tq * 12) % 10;
    const a = [7, 7, 6, 4, 1, 1, 4, 6, 7, 7][f], b = 8, cx = 16, cy = 21 + [0, 0, 1, 1, 1, 0, 0, -1, -1, -1][Math.floor(tq * 6) % 10];
    for (let y = -b; y <= b; y++) for (let x = -a; x <= a; x++) { const e = (r1, r2) => (x / (r1 + .5)) ** 2 + (y / (r2 + .5)) ** 2 <= 1;
      if (!e(a, b)) continue; P.set(cx + x, cy + y, a > 2 && e(a - 1.4, b - 1.4) && !e(a - 2.8, b - 2.8) ? 2 : 1); }
    if (a >= 6) { P.rect(cx - 1, cy - 4, 1, 9, 2); P.rect(cx - 3, cy - 3, 1, 2, 2); } else if (a >= 4) P.rect(cx - 1, cy - 4, 1, 9, 2);
    const cyc = (tq % (10 / 12)) / (10 / 12), up = Math.floor(cyc * 4); if (cyc < .8) ptextC(P, '+1', 4 - up);
    if (a >= 7 && f < 2) { sparkle(P, cx + 8, cy - 7, f === 1); sparkle(P, cx - 9, cy + 5, f === 0); }
    pgDraw(c, P); });

  const STAR = ['       #       ', '      ###      ', '      ###      ', '     #####     ', '###############', ' ############# ', '  ####W#W####  ', '   ###W#W###   ', '   #########   ',
    '  ###########  ', '  ##### #####  ', ' ####     #### ', ' ###       ### ', ' #           # '];
  A('f-px2-star', 'Пиксельная звезда-бонус прыгает', PXG, 2.5, (c, t) => { const tq = q12(t), P = PG(34), ph = (tq % .75) / .75, hop = Math.round(Math.sin(ph * Math.PI) * 7);
    const x0 = 10, y0 = 15 - hop, flash = Math.floor(tq * 12) % 4 >= 2; P.bmp(STAR, x0, y0, flash ? { '#': 1 } : { '#': 1, 'W': 2 });
    if (flash) { const g = []; STAR.forEach((r, j) => [...r].forEach((q, i) => { const h = (ii, jj) => STAR[jj] && STAR[jj][ii] && STAR[jj][ii] !== ' '; if (q !== ' ' && h(i - 1, j) && h(i + 1, j) && h(i, j - 1) && h(i, j + 1)) g.push([i, j]); }));
      g.forEach(([i, j]) => P.set(x0 + i, y0 + j, 2)); P.set(x0 + 6, y0 + 6); P.set(x0 + 6, y0 + 7); P.set(x0 + 8, y0 + 6); P.set(x0 + 8, y0 + 7); }
    const sw = hop > 4 ? 3 : 5; for (let x = 17 - sw; x <= 17 + sw; x++) P.set(x, 31);
    [[5, 6], [28, 8], [4, 22], [29, 25]].forEach(([x, y], i) => { const s = Math.floor(tq * 8 + i * 2) % 5; if (s < 3) sparkle(P, x, y, s === 1); });
    pgDraw(c, P); });

  A('f-px2-gameover', 'Пиксельное «GAME OVER» и разбитое сердце', PXG, 3.5, (c, t) => { const tq = q12(t), P = PG(46), blink = tq > 2.3 && Math.floor(tq * 4) % 2 === 1;
    if (!blink) ['GAME', 'OVER'].forEach((w, r) => [...w].forEach((ch, i) => { const k = Math.floor((tq - .15 - (r * 4 + i) * .1) * 12); if (k < 0) return;
      const dy = [-4, -3, -1, 0, -1, 0][Math.min(k, 5)]; ptext(P, ch, 12 + i * 6, 6 + r * 10 + dy); }));
    const hx = 17, hy = 28, sp = tq < 1.75 ? 0 : Math.min(3, Math.floor((tq - 1.75) * 8) + 1), cut = [5, 5, 4, 5, 6, 5, 4, 5, 6, 5];
    HEART.forEach((row, j) => [...row].forEach((q, i) => { if (q !== '#') return; const L = i < cut[j], R = i > cut[j]; if (sp && !L && !R) return;
      P.set(hx + i + (L ? -sp : R ? sp : 0), hy + j + (sp && R ? Math.floor(sp / 2) : 0)); }));
    if (!sp && tq > 1.35) cut.forEach((x, j) => { if (HEART[j][x] === '#') P.set(hx + x, hy + j, 2); });
    else if (!sp) P.set(hx + 2, hy + 2, 2);
    pgDraw(c, P); });

  const UPA = ['    #    ', '   ###   ', '  #####  ', ' ####### ', '#########', '   ###   ', '   ###   ', '   ###   '];
  A('f-px2-levelup', 'Пиксельное «LEVEL UP!»', PXG, 3, (c, t) => { const tq = q12(t), P = PG(44);
    const ay = tq < .6 ? Math.round(lerp(40, 31, tq / .6)) : 31 - [0, 1, 2, 1][Math.floor(tq * 6) % 4]; P.bmp(UPA, 18, ay);
    if (tq > .55) { const fl = tq < 1.05 && Math.floor(tq * 12) % 2 === 1; if (fl) { P.box(5, 4, 34, 13); ptextC(P, 'LEVEL', 7); } else { P.rect(5, 4, 34, 13); ptextC(P, 'LEVEL', 7, 2); } }
    if (tq > 1.1) ptextC(P, 'UP!', 20 - (tq < 1.2 ? 1 : 0));
    if (tq > 1.1) [[6, 24], [37, 23], [8, 34], [35, 35], [13, 41], [30, 41]].forEach(([x, y], i) => { const s = Math.floor(tq * 8 + i * 3) % 6; if (s < 3) sparkle(P, x, y, s === 1); });
    pgDraw(c, P); });

  const HRT = [' ## ## ', '#######', '#######', ' ##### ', '  ###  ', '   #   '];
  A('f-px2-hp', 'Пиксельная полоска здоровья', PXG, 3.5, (c, t) => { const tq = q12(t), P = PG(56);
    const hits = [[.6, 8, 5], [1.3, 5, 2]], heal = tq > 2.0 ? Math.min(8, 2 + Math.floor((tq - 2.0) / .12)) : null;
    let hp = 8, blinkSeg = 0, ox = 0; hits.forEach(([th, a, b]) => { if (tq >= th) { hp = b; const d = tq - th; if (d < .34) { blinkSeg = Math.floor(d * 12) % 2 === 0 ? a : b; ox = [1, -1, 1, 0][Math.min(3, Math.floor(d * 12))]; } } });
    if (heal !== null) hp = heal; const shown = blinkSeg || hp;
    const low = hp <= 2 && heal === null && Math.floor(tq * 6) % 2 === 1; if (!low) P.bmp(HRT, 4 + ox, 25);
    ptext(P, 'HP', 13 + ox, 24); P.box(26 + ox, 22, 27, 10); for (let i = 0; i < shown; i++) P.rect(28 + ox + i * 3, 24, 2, 6);
    hits.forEach(([th]) => { const d = tq - th; if (d >= 0 && d < .6) ptext(P, '-3', 41, 13 - Math.floor(d * 8)); });
    if (heal !== null && tq < 3.0) for (let i = 0; i < 3; i++) { const k = ((tq - 2.0) * 12 + i * 4) % 12; ptext(P, '+', 30 + i * 8, 14 - Math.floor(k / 2)); }
    if (hp === 8 && heal !== null && tq > 3.0 && Math.floor(tq * 4) % 2 === 0) ptextC(P, 'MAX', 38);
    pgDraw(c, P); });

  A('f-px2-hi', 'Пиксельное облачко-диалог «HI!»', PXG, 3, (c, t) => { const tq = q12(t), P = PG(34);
    const st = tq < .1 ? 0 : tq < .2 ? 1 : tq < .3 ? 2 : 3, W = [0, 8, 16, 23][st], H = [0, 5, 10, 15][st], bob = st === 3 && Math.floor(tq * 2) % 2 ? 1 : 0;
    if (st) { const x = 17 - Math.floor(W / 2), y = 14 - Math.floor(H / 2) - bob; P.rect(x + 1, y, W - 2, H); P.rect(x, y + 1, W, H - 2); P.rect(x + 2, y + 2, W - 4, H - 4, 2);
      P.rect(x + 1, y + 1, 1, 1, 2); P.rect(x + W - 2, y + 1, 1, 1, 2); P.rect(x + 1, y + H - 2, 1, 1, 2); P.rect(x + W - 2, y + H - 2, 1, 1, 2);
      if (st === 3) { P.rect(x + 4, y + H, 4, 1); P.rect(x + 4, y + H + 1, 3, 1); P.rect(x + 4, y + H + 2, 2, 1); P.rect(x + 4, y + H + 3, 1, 1); P.rect(x + 5, y + H - 2, 2, 2, 2);
        const n = Math.min(3, Math.max(0, Math.floor((tq - .45) / .15) + 1)); ptext(P, 'HI!'.slice(0, n), x + 3, y + 4); } }
    pgDraw(c, P); });

  A('f-px2-cup', 'Пиксельный кубок с блеском', PXG, 3, (c, t) => { const tq = q12(t), P = PG(40), cx = 20, f = Math.floor(tq * 12);
    const dy = f < 2 ? null : [-14, -9, -5, -2, 0, -2, -1, 0][Math.min(f - 2, 7)], y0 = 11 + (dy || 0);
    if (dy !== null) { P.rect(cx - 7, y0, 15, 2); for (let j = 0; j < 9; j++) { const hw = 6 - Math.max(0, j - 4); P.rect(cx - hw, y0 + 2 + j, hw * 2 + 1, 1); }
      P.box(cx - 10, y0 + 2, 4, 5); P.box(cx + 7, y0 + 2, 4, 5); P.rect(cx - 1, y0 + 11, 3, 3); P.rect(cx - 4, y0 + 14, 9, 2); P.rect(cx - 5, y0 + 16, 11, 2);
      ptext(P, '1', cx - 2, y0 + 3, 2); P.rect(cx - 5, y0 + 3, 1, 3, 2);
      const s = f % 24 - 6; for (let y = y0 + 2; y < y0 + 11; y++) for (let x = cx - 7; x <= cx + 7; x++) { const d = (x - (cx - 7)) + (y - y0) - s * 2; if (d === 0 && ink(P, x, y)) P.set(x, y, 2); } }
    if (f > 9) [[7, 7], [33, 8], [5, 25], [35, 27], [20, 4]].forEach(([x, y], i) => { const s = Math.floor(tq * 8 + i * 2) % 5; if (s < 3) sparkle(P, x, y, s === 1); });
    pgDraw(c, P); });

  const RKT = ['    #    ', '   ###   ', '  #####  ', '  #####  ', '  ##W##  ', '  #WWW#  ', '  ##W##  ', '  #####  ', '  #####  ', ' ####### ', '## ### ##', '#  ###  #', '#   #   #'];
  A('f-px2-rocket', 'Пиксельная ракета взлетает', PXG, 2.8, (c, t) => { const tq = q12(t), P = PG(40), f = Math.floor(tq * 12), go = tq > .8 ? tq - .8 : 0;
    const top = 18 - Math.round(32 * go * go + 6 * go), sx = go ? 0 : (f % 2 ? 1 : 0) * (tq > .25 ? 1 : 0);
    P.bmp(RKT, 16 + sx, top); const fl = f % 2 ? [' BWWWB ', '  BWB  ', '   B   '] : [' BWWWB ', ' BWWWB ', '  BWB  ', '   B   ']; if (tq > .25) P.bmp(fl, 17 + sx, top + 13);
    if (go > .05 && top > -14) for (let i = 0; i < 3; i++) { const yy = top + 15 + ((f + i * 2) % 6); P.set(14, yy); P.set(26, yy + 2); }
    if (!go) P.line(9, 36, 31, 36);
    if (tq > .3) [[-1, 0], [1, 0], [-1, 1], [1, 1], [0, 2]].forEach(([d, k], i) => { const a = tq - .3 - k * .15; if (a < 0) return; const life = cl(a / 1.8), r = Math.round(1 + 3 * Math.min(1, a * 1.6) * (1 - life * .6));
      if (life >= 1 || r < 1) return; const x = 20 + d * Math.round(4 + 10 * Math.min(1, a * .9)), y = 35 - k - Math.round(a * 2); P.disc(x, y, r, 1); if (r >= 2) P.disc(x, y, r - 1, 2); });
    pgDraw(c, P); });
})(window);

/* ---- styles7z.js ---- */
/* Футажи: порядок категорий (как в приложении и плагинах) и переименование старых групп */
(function (G) {
  const ST = G.KKSTYLES; if (!ST || !ST.foot) return;
  const REN = { 'Экраны': 'Экраны и интерфейсы', 'Указатели': 'Стрелки и указатели' };
  const ORDER = ['Соцсети', 'Вопросы и опросы', 'Плашки и подписи', 'Выделение маркером', 'Стрелки и указатели', 'Эмодзи и реакции', 'Комикс и звуки', 'Экраны и интерфейсы',
    'Счётчики и таймеры', 'Списки и шаги', 'Продажи и акции', 'Камера и запись', 'Праздник и конфетти', 'Пиксель-арт'];
  const an = ST.foot.an; an.forEach(it => { if (REN[it.group]) it.group = REN[it.group]; });
  const pos = g => { const i = ORDER.indexOf(g); return i < 0 ? 99 : i; };
  const idx = new Map(an.map((it, i) => [it, i]));
  an.sort((a, b) => pos(a.group) - pos(b.group) || idx.get(a) - idx.get(b));
})(window);

/* ---- engine.js ---- */
/* Движок настроек наборов (KKE): рисует любую анимацию, переход, оверлей, фон или плашку набора со своими цветами,
   надписями, картинкой вместо значка и скоростью. Подключается после lib.js и styles*.js (сборка — make_engine.py).
   Ничего в самих стилях не переделываем: контекст canvas оборачивается, и цвета/тексты подменяются на лету.
   KKE.inspect(style, kind, id)       → { colors:[{key,hex,w}], texts:[...], icons:[{key,label}], dur, fmt }
   KKE.draw(ctx, style, kind, id, W, H, v, cfg) — один кадр; cfg = { colors:{key:'#hex'}, texts:{было:'стало'}, icons:{key:Image}, images:{src:Image} }
   KKE.frames(style, kind, id, fmt, speed) → { W, H, n, v(i) } — сколько кадров и какое время у кадра i (как в build.mjs) */
(function (G) {
  const FPS = 30, FMT = { v: [1080, 1920], h: [1920, 1080] };
  const ST = G.KKSTYLES, L = G.KKL.L;
  const KINDS = ['an', 'tr', 'ov', 'bg', 'tx'];
  function item(style, kind, id) { const st = ST[style]; return st && KINDS.includes(kind) && (st[kind] || []).find(x => x.id === id) || null; }

  /* ---------- цвета ---------- */
  const sc = document.createElement('canvas').getContext('2d'), NC = new Map();
  function parse(str) { // любой CSS-цвет → [r,g,b,a]
    if (typeof str !== 'string') return null; let r = NC.get(str); if (r !== undefined) return r;
    sc.fillStyle = '#000'; sc.fillStyle = str; const s = sc.fillStyle; let m;
    if (s[0] === '#') r = [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 1];
    else if ((m = /rgba?\(([^)]+)\)/.exec(s))) { const p = m[1].split(',').map(Number); r = [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; } else r = null;
    if (NC.size > 5000) NC.clear(); NC.set(str, r); return r;
  }
  function hsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
    if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; }
  function rgb(h, s, l) { h = ((h % 360) + 360) % 360 / 360; const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return s === 0 ? [l * 255, l * 255, l * 255] : [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]; }
  const hex = c => '#' + c.slice(0, 3).map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('').toUpperCase();
  // «семья» цвета: тёмные, светлые, серые — отдельно; яркие — по оттенку (12 секторов по 30°)
  function family(c) { const [h, s, l] = hsl(c); if (l < .13) return 'k'; if (l > .93) return 'w'; if (s < .14) return l < .4 ? 'k' : l > .75 ? 'w' : 'g'; return 'h' + Math.round(h / 30) % 12; }

  /* ---------- обёртка контекста ---------- */
  let CFG = null, REC = null, RP = null; // CFG — настройки при отрисовке, REC — сбор при разборе
  function mapColor(str) {
    const c = parse(str); if (!c) return str;
    const fam = family(c); if (REC) { const k = hex(c); const f = REC.colors[fam] || (REC.colors[fam] = { w: 0, by: {} }); f.w++; f.by[k] = (f.by[k] || 0) + 1; }
    const T = CFG && CFG.colors && CFG.colors[fam]; if (!T || (fam === 'k' && c[3] < .6)) return str; // полупрозрачный чёрный — это тени, их не красим
    const rep = CFG._rep[fam], t = parse(T); if (!rep || !t) return str;
    const [h, s, l] = hsl(c), [hr, sr, lr] = hsl(rep), [ht, st, lt] = hsl(t);
    const nh = sr < .14 ? ht : h + (ht - hr), ns = sr < .14 ? st : Math.min(1, s * st / Math.max(sr, .05)), nl = Math.max(0, Math.min(1, l + (lt - lr)));
    const o = rgb(nh, ns, nl); return c[3] < 1 ? `rgba(${o.map(Math.round).join(',')},${c[3]})` : hex(o);
  }
  function grad(g) { const add = g.addColorStop; g.addColorStop = (o, c) => add.call(g, o, mapColor(c)); return g; }
  function editable(s) { return typeof s === 'string' && /[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(s); }
  function mapText(ctx, s) {
    if (REC && editable(s)) REC.texts[s] = (REC.texts[s] || 0) + 1;
    const T = CFG && CFG.texts; if (!T || typeof s !== 'string') return s;
    if (T[s] !== undefined) return T[s];
    for (const k in T) if (k.length > 1 && s.length < k.length && k.startsWith(s) && s.length) return T[k].slice(0, Math.round(T[k].length * s.length / k.length)); // печатная машинка
    return s;
  }
  const SET = { fillStyle: 1, strokeStyle: 1, shadowColor: 1 };
  function wrap(ctx) {
    if (ctx.__kk) return ctx.__kk;
    const P = new Proxy(ctx, {
      get(t, k) {
        if (k === '__raw') return t;
        const v = t[k];
        if (typeof v !== 'function') return v;
        if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createConicGradient') return (...a) => grad(v.apply(t, a));
        if (k === 'fillText' || k === 'strokeText') return (s, x, y, mw) => { const n = mapText(t, s);
          if (n !== s && typeof s === 'string' && s.length) { const w0 = t.measureText(s).width, w1 = t.measureText(n).width; if (w1 > w0 * 1.02) mw = Math.min(mw || Infinity, Math.max(w0, 1)); } // длиннее — ужимаем в ширину оригинала
          return mw === undefined || mw === Infinity ? v.call(t, n, x, y) : v.call(t, n, x, y, mw); };
        if (k === 'drawImage') return (im, ...a) => { const src = im && im.src;
          if (src && REC) { const key = src.split('/').pop().split('?')[0]; REC.images[key] = 1; }
          const rep = src && CFG && CFG.images && CFG.images[src.split('/').pop().split('?')[0]];
          if (rep && a.length >= 4) { const [x, y, w, h] = a.length >= 8 ? a.slice(4) : a; return fitImg(t, rep, x + w / 2, y + h / 2, Math.max(w, h)); }
          if (rep && a.length === 2) return fitImg(t, rep, a[0] + im.naturalWidth / 2, a[1] + im.naturalHeight / 2, Math.max(im.naturalWidth, im.naturalHeight));
          return v.call(t, im, ...a); };
        return v.bind(t);
      },
      set(t, k, val) { t[k] = SET[k] ? mapColor(val) : val; return true; }
    });
    try { Object.defineProperty(ctx, '__kk', { value: P }); } catch (e) { }
    return P;
  }
  function fitImg(c, im, cx, cy, size, rot) { if (!im || !im.naturalWidth) return true; const k = size / Math.max(im.naturalWidth, im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k;
    const r = c.__raw || c; r.save(); r.translate(cx, cy); if (rot) r.rotate(rot); r.imageSmoothingQuality = 'high'; r.drawImage(im, -w / 2, -h / 2, w, h); r.restore(); return true; }

  /* ---------- значки: звёздочка, сердце, цветок… и иконки стилей ---------- */
  const SHAPES = { sparkle: 'Звёздочка', star: 'Звезда', heart: 'Сердце', flower: 'Цветок', bow: 'Бантик', knight: 'Конь', burst: 'Взрыв' };
  const SIZE = { sparkle: .9, star: .9, heart: .84, flower: .8, bow: .8, knight: .8, burst: .92 };
  const ORIG = {}; for (const k in SHAPES) ORIG[k] = L[k];
  for (const k in SHAPES) L[k] = function (ctx, W, H, S, p = 1, o = {}) {
    const key = 'L.' + k; if (REC) REC.icons[key] = SHAPES[k];
    const im = CFG && CFG.icons && CFG.icons[key];
    if (im) { const kk = p < 1 ? G.KKL.E.back(G.KKL.E.clamp(p)) : 1; return fitImg(ctx, im, W / 2, H / 2, Math.min(W, H) * SIZE[k] * kk * (o.scale ?? 1), o.rot); }
    return ORIG[k].apply(this, arguments);
  };
  const IC_NAMES = { star: 'Звезда', heart: 'Сердце', crown: 'Корона', fire: 'Огонь', camera: 'Камера', play: 'Плей', bell: 'Колокольчик', like: 'Лайк', thumb: 'Лайк', chat: 'Сообщение', comment: 'Комментарий', share: 'Поделиться', bookmark: 'Закладка', person: 'Человечек', lightning: 'Молния', sparkles: 'Искры', diamond: 'Бриллиант', trophy: 'Кубок', rocket: 'Ракета', gift: 'Подарок', cart: 'Корзина', tag: 'Ценник', music: 'Нота', mic: 'Микрофон', eye: 'Глаз', lock: 'Замок', check: 'Галочка', plus: 'Плюс', send: 'Отправить', search: 'Поиск', magnifier: 'Лупа', clock: 'Часы', calendar: 'Календарь', phone: 'Телефон', bulb: 'Лампочка', coin: 'Монета', flag: 'Флажок', target: 'Мишень', film: 'Плёнка', clapper: 'Хлопушка' };
  G.KKX = { icon(c, name, x, y, s, rot) {
    const key = 'i.' + name; if (REC) REC.icons[key] = IC_NAMES[name] || 'Значок «' + name + '»';
    const im = CFG && CFG.icons && CFG.icons[key]; return im ? fitImg(c, im, x, y, s, rot) : false; } };

  /* ---------- кадр ---------- */
  let HOOKED = false; const GC = HTMLCanvasElement.prototype.getContext;
  function hook(on) { // вспомогательные холсты внутри рисования тоже перекрашиваем
    if (on === HOOKED) return; HOOKED = on;
    HTMLCanvasElement.prototype.getContext = on ? function (t, o) { const r = GC.call(this, t, o); return t === '2d' && r ? wrap(r) : r; } : GC;
  }
  function draw(ctx, style, kind, id, W, H, v, cfg) {
    const it = item(style, kind, id); if (!it) return false;
    if (cfg && !cfg._rep) cfg._rep = rep(style, kind, id); // до CFG: разбор сам рисует кадры
    CFG = cfg || null;
    const raw = ctx.__raw || ctx, c = wrap(raw);
    hook(true); raw.save();
    try { it.draw(c, W, H, Object.assign({}, ST[style].S), v); } finally { raw.restore(); hook(false); CFG = null; }
    return true;
  }
  const REPS = {};
  function rep(style, kind, id) { const k = style + '/' + kind + '/' + id; if (!REPS[k]) { const r = inspect(style, kind, id); REPS[k] = {}; r.colors.forEach(x => REPS[k][x.key] = parse(x.hex)); } return REPS[k]; }
  function frames(style, kind, id, fmt, speed = 1) {
    const it = item(style, kind, id); if (!it) return null;
    const [W, H] = kind === 'an' ? [1024, 1024] : kind === 'tx' ? [1600, 600] : FMT[fmt || 'v'];
    if (kind === 'bg' || kind === 'tx') return { W, H, n: 1, v: () => kind === 'tx' ? 1 : 0, still: true };
    const dur = it.dur || 2;
    if (kind === 'tr') { const n = Math.max(6, Math.round(dur / speed * FPS)); return { W, H, n, v: i => i / (n - 1), dur: n / FPS }; }
    const n = Math.max(2, Math.round(dur / speed * FPS)); return { W, H, n, v: i => Math.min(dur, i * speed / FPS), dur: n / FPS };
  }
  const INS = {};
  function inspect(style, kind, id) {
    const key = style + '/' + kind + '/' + id; if (INS[key]) return INS[key];
    const it = item(style, kind, id); if (!it) return null;
    const F = frames(style, kind, id, 'v'), k = 360 / Math.max(F.W, F.H), W = Math.round(F.W * k), H = Math.round(F.H * k);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = GC.call(cv, '2d');
    REC = { colors: {}, texts: {}, icons: {}, images: {} }; const N = F.still ? 1 : 16;
    try { for (let i = 0; i < N; i++) { ctx.clearRect(0, 0, W, H); draw(ctx, style, kind, id, W, H, F.v(Math.round(i * (F.n - 1) / Math.max(1, N - 1))), null); } } catch (e) { console.warn('KKE', key, e); }
    const R = REC; REC = null;
    const colors = Object.entries(R.colors).map(([fam, f]) => { const top = Object.entries(f.by).sort((a, b) => b[1] - a[1])[0][0]; return { key: fam, hex: top, w: f.w }; })
      .sort((a, b) => b.w - a.w).slice(0, 6);
    let tx = Object.keys(R.texts); const num = s => /^[\d\s:.,%+\-−×x/$€₽]+$/.test(s);
    if (tx.filter(num).length > 3) tx = tx.filter(s => !num(s)); // счётчики: цифры меняются каждый кадр
    if (tx.filter(s => [...s].length === 1).length > 4) tx = tx.filter(s => [...s].length > 1); // буквы по одной
    tx = tx.filter(s => !tx.some(o => o !== s && o.length > s.length && o.startsWith(s))).slice(0, 8); // «печатная машинка» — берём целую строку
    const icons = Object.entries(R.icons).map(([k, label]) => ({ key: k, label })).slice(0, 4);
    Object.keys(R.images).filter(s => !/^data:/.test(s)).slice(0, 2).forEach(s => icons.push({ key: 'img:' + s, label: 'Картинка' }));
    return INS[key] = { colors, texts: tx, icons, dur: it.dur || 0, kind };
  }
  function cfgFrom(o) { // настройки из интерфейса → cfg для draw (картинки разводим по значкам и по drawImage)
    if (!o) return null; const c = { colors: o.colors || {}, texts: o.texts || {}, icons: {}, images: {} };
    for (const k in o.icons || {}) if (k.startsWith('img:')) c.images[k.slice(4)] = o.icons[k]; else c.icons[k] = o.icons[k];
    return c;
  }
  G.KKE = { FPS, FMT, KINDS, has: (s, k, id) => !!item(s, k, id), inspect, frames, cfgFrom, draw };
})(window);
