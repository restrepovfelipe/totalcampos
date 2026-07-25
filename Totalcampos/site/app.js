/* ============================================================
   Total Campos — scroll-scrub hero + interactions
   Canvas frame-sequence: instant scrub, no video decoder.
   ============================================================ */
(() => {
  'use strict';

  const N = 90;                          // frame count (f_001 … f_090)
  const pad3 = n => String(n).padStart(3, '0');
  const frameURL = i => `assets/frames_desktop/f_${pad3(i + 1)}.webp`;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  const canvas   = document.getElementById('scrub');
  const ctx      = canvas.getContext('2d', { alpha: false });
  const hero     = document.getElementById('top');
  const pin      = hero.querySelector('.hero__pin');
  const railFill = document.getElementById('railFill');
  const heroContent = document.getElementById('heroContent');
  const hint     = document.getElementById('hint');
  const nav      = document.getElementById('nav');
  const loader   = document.getElementById('loader');
  const loaderBar= document.getElementById('loaderBar');
  const loaderPct= document.getElementById('loaderPct');
  const stages   = Array.from(document.querySelectorAll('.stage'));

  const frames = new Array(N).fill(null);
  let loaded = 0;
  let ready = false;
  let drawn = -1;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  function sizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width  * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      drawn = -1;
    }
  }

  function drawFrame(idx) {
    const bmp = frames[idx];
    if (!bmp) return;
    const cw = canvas.width, ch = canvas.height;
    const iw = bmp.width, ih = bmp.height;
    const s = Math.max(cw / iw, ch / ih);
    const dw = iw * s, dh = ih * s;
    const dx = (cw - dw) / 2, dy = (ch - dh) / 2;
    ctx.drawImage(bmp, dx, dy, dw, dh);
    drawn = idx;
  }

  function progress() {
    const total = hero.offsetHeight - pin.offsetHeight;
    if (total <= 0) return 0;
    const scrolled = -hero.getBoundingClientRect().top;
    return clamp(scrolled / total, 0, 1);
  }

  let hintHidden = false;
  function render() {
    const p = progress();

    if (ready) {
      const idx = clamp(Math.round(p * (N - 1)), 0, N - 1);
      if (idx !== drawn && frames[idx]) drawFrame(idx);
    }

    railFill.style.width = (p * 100).toFixed(2) + '%';

    const heroFade = clamp(1 - p / 0.14, 0, 1);
    heroContent.style.opacity = heroFade.toFixed(3);
    heroContent.style.visibility = heroFade <= 0.01 ? 'hidden' : 'visible';

    for (const st of stages) {
      const from = parseFloat(st.dataset.from), to = parseFloat(st.dataset.to);
      st.classList.toggle('is-active', p >= from && p < to);
    }

    if (!hintHidden && p > 0.02) { hint.classList.add('is-hidden'); hintHidden = true; }
    if (hintHidden && p <= 0.02) { hint.classList.remove('is-hidden'); hintHidden = false; }

    const heroEnd = hero.offsetTop + hero.offsetHeight - pin.offsetHeight;
    nav.classList.toggle('is-solid', window.scrollY >= heroEnd - 4);
  }

  let dirty = true;
  const markDirty = () => { dirty = true; };
  function tick() {
    if (dirty) { dirty = false; render(); }
    requestAnimationFrame(tick);
  }
  window.addEventListener('scroll',  markDirty, { passive: true });
  window.addEventListener('resize', () => { sizeCanvas(); markDirty(); }, { passive: true });

  async function loadOne(i) {
    const res = await fetch(frameURL(i), { cache: 'force-cache' });
    if (!res.ok) throw new Error('frame ' + i);
    const blob = await res.blob();
    let bmp;
    if ('createImageBitmap' in window) {
      bmp = await createImageBitmap(blob);
    } else {
      bmp = await new Promise((ok, no) => {
        const img = new Image();
        img.onload = () => ok(img); img.onerror = no;
        img.src = URL.createObjectURL(blob);
      });
    }
    frames[i] = bmp;
    loaded++;
    if (i === 0) { sizeCanvas(); drawFrame(0); }
    const pct = Math.round(loaded / N * 100);
    loaderBar.style.width = pct + '%';
    loaderPct.textContent = 'Preparando la cancha · ' + pct + '%';
  }

  async function loadAll() {
    sizeCanvas();
    const order = Array.from({ length: N }, (_, i) => i);
    const CONC = 8;
    let cursor = 0;
    async function worker() {
      while (cursor < order.length) {
        const i = order[cursor++];
        try { await loadOne(i); }
        catch (e) { loaded++; }
      }
    }
    await Promise.all(Array.from({ length: CONC }, worker));

    ready = true;
    hero.classList.add('is-ready');
    loader.classList.add('is-done');
    sizeCanvas();
    markDirty();
  }

  function initReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      }
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => io.observe(e));
  }

  function initBA() {
    const stage = document.getElementById('ba');
    if (!stage) return;
    let dragging = false;
    const setSplit = (clientX) => {
      const r = stage.getBoundingClientRect();
      const pct = clamp((clientX - r.left) / r.width, 0, 1) * 100;
      stage.style.setProperty('--split', pct.toFixed(2) + '%');
    };
    stage.addEventListener('pointerdown', (e) => { dragging = true; stage.setPointerCapture(e.pointerId); setSplit(e.clientX); });
    stage.addEventListener('pointermove', (e) => { if (dragging) setSplit(e.clientX); });
    stage.addEventListener('pointerup',   () => { dragging = false; });
    stage.addEventListener('pointercancel', () => { dragging = false; });
  }

  initReveal();
  initBA();
  loadAll();
  requestAnimationFrame(tick);
})();
