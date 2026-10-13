/*
 * Youtorch Spark studio: the ui-opus "Studio Editor" prototype, ported as a mountable module.
 * The design ran as a single page script; here it is scoped to one root element so it opens
 * full screen for one Spark project and is removed cleanly when the route unmounts.
 *
 * NOT MOUNTED: real projects open in SparkEditorShell (spark-editor-shell.tsx), which shows
 * only server data. This prototype runs on demo data (scenes, avatars, media, plans, AI
 * replies) and stays as the design reference for the Spark plan (docs/plans/agentic-spark,
 * P02-05 and later), which ports its behaviour onto Composition.
 *
 * Port rules: queries are scoped to the root; overlays go to the .st-layer element; every
 * document/window listener, observer, timer and animation frame is released by dispose();
 * the theme button drives next-themes; responsive decisions use the studio's own size.
 */
/* eslint-disable -- generated port of the ui-opus design script; see the header above */
import { STUDIO_MARKUP } from './studio-markup'

export function mountStudio(root, opts = {}) {
  let disposed = false
  const disposers = []
  const timers = new Set()
  const frames = new Set()
  const on = (target, type, fn, options) => {
    target.addEventListener(type, fn, options)
    disposers.push(() => target.removeEventListener(type, fn, options))
  }
  const track = (observer) => {
    disposers.push(() => observer.disconnect())
    return observer
  }
  const outside = (e) => {
    const t = e.target
    return t instanceof Node && t !== document.body && t !== document.documentElement && !root.contains(t)
  }
  const setTimeout = (fn, ms, ...args) => {
    const id = window.setTimeout(() => { timers.delete(id); if (!disposed) fn(...args) }, ms)
    timers.add(id)
    return id
  }
  const clearTimeout = (id) => { timers.delete(id); window.clearTimeout(id) }
  const requestAnimationFrame = (fn) => {
    const id = window.requestAnimationFrame((ts) => { frames.delete(id); if (!disposed) fn(ts) })
    frames.add(id)
    return id
  }
  const cancelAnimationFrame = (id) => { frames.delete(id); window.cancelAnimationFrame(id) }
  const isDark = () => document.documentElement.classList.contains('dark')
  const studioW = () => root.clientWidth || window.innerWidth
  const studioH = () => root.clientHeight || window.innerHeight

  root.innerHTML = STUDIO_MARKUP
  const layer = root.querySelector('.st-layer')
  bindProject(root, opts, on)

  /* ======================= design script (ui-opus) ======================= */
  /* ================= helpers ================= */
  const $ = (s, r = root) => r.querySelector(s);
  const $$ = (s, r = root) => [...r.querySelectorAll(s)];
  const ic = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const strip = h => { const d = document.createElement('div'); d.innerHTML = String(h).replace(/<br\s*\/?>/gi, ' '); return d.textContent.replace(/\s+/g, ' ').trim(); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const fmt = s => { s = Math.max(0, s); const m = Math.floor(s / 60), r = Math.floor(s % 60); return `${m}:${String(r).padStart(2, '0')}`; };
  const fmtT = s => `${fmt(s)}.${Math.floor((s % 1) * 10)}`;
  const clone = o => JSON.parse(JSON.stringify(o));

  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.querySelector('span').textContent = msg;
    t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ================= avatars ================= */
  const AV = [
    { name: 'Oliver', meta: 'English · US', bg: ['#5a3f2c', '#1a120d'], shirt: ['#2c3342', '#12161e'], skin: '#c89f86', hair: '#35251b', tie: '#8f969f' },
    { name: 'Maya', meta: 'English · UK', bg: ['#2f5251', '#0e1c1d'], shirt: ['#dccfb9', '#a69679'], skin: '#b98a6c', hair: '#1d1310', long: true },
    { name: 'Daniel', meta: 'German · DE', bg: ['#3d3757', '#14121e'], shirt: ['#f0f0f2', '#b9b9c2'], skin: '#e0b9a0', hair: '#8a6a4a', tie: '#2c3a5c' },
    { name: 'Aisha', meta: 'English · US', bg: ['#62452f', '#231710'], shirt: ['#7a3232', '#3a1616'], skin: '#8d5f45', hair: '#140d0a', long: true },
    { name: 'Leo', meta: 'Spanish · ES', bg: ['#3a4b30', '#111a0e'], shirt: ['#24406a', '#0f1d31'], skin: '#d1a484', hair: '#2a1d14' },
    { name: 'Sofia', meta: 'Turkish · TR', bg: ['#533849', '#1d1119'], shirt: ['#1d1d21', '#0b0b0d'], skin: '#dcb095', hair: '#5a3a22', long: true },
  ];
  let uidN = 0;
  function avatarSVG(v) {
    const u = 'a' + (uidN++);
    return `<svg viewBox="0 0 600 720" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style="display:block">
    <defs>
      <radialGradient id="bg${u}" cx="30%" cy="22%" r="95%"><stop offset="0" stop-color="${v.bg[0]}"/><stop offset="1" stop-color="${v.bg[1]}"/></radialGradient>
      <linearGradient id="sh${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${v.shirt[0]}"/><stop offset="1" stop-color="${v.shirt[1]}"/></linearGradient>
      <radialGradient id="sk${u}" cx="38%" cy="35%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></radialGradient>
      <filter id="bl${u}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>
    </defs>
    <rect width="600" height="720" fill="url(#bg${u})"/>
    <g filter="url(#bl${u})">
      <circle cx="96" cy="118" r="30" fill="#ffd9a0" opacity=".55"/><circle cx="505" cy="86" r="20" fill="#ffe7c4" opacity=".6"/>
      <circle cx="548" cy="292" r="38" fill="#f2b872" opacity=".3"/><circle cx="58" cy="420" r="46" fill="#e8a868" opacity=".22"/>
      <rect x="0" y="560" width="600" height="160" fill="#000" opacity=".25"/>
    </g>
    ${v.long ? `<path d="M198 300 C186 430 196 500 226 540 L374 540 C404 500 414 430 402 300 Z" fill="${v.hair}"/>` : ''}
    <path d="M56 720 C66 574 168 514 262 490 L338 490 C432 514 534 574 544 720Z" fill="url(#sh${u})"/>
    <path d="M263 398 L337 398 L343 498 C320 522 280 522 257 498Z" fill="${v.skin}"/>
    <path d="M263 440 C290 462 312 462 337 440 L339 470 C312 490 288 490 261 470Z" fill="#000" opacity=".14"/>
    ${v.tie ? `<path d="M288 508 L312 508 L318 530 L306 640 L300 650 L294 640 L282 530Z" fill="${v.tie}"/><path d="M258 492 L300 540 L342 492 L356 506 L300 566 L244 506Z" fill="${v.shirt[0]}" opacity=".95"/>` : `<path d="M257 494 C280 530 320 530 343 494" stroke="${v.shirt[1]}" stroke-width="6" fill="none" opacity=".6"/>`}
    <ellipse cx="208" cy="326" rx="14" ry="26" fill="${v.skin}"/><ellipse cx="392" cy="326" rx="14" ry="26" fill="${v.skin}"/>
    <ellipse cx="300" cy="318" rx="92" ry="112" fill="${v.skin}"/>
    <ellipse cx="300" cy="318" rx="92" ry="112" fill="url(#sk${u})"/>
    <path d="M206 302 C198 208 250 178 305 180 C366 182 404 220 396 302 C388 262 358 234 300 236 C250 238 218 258 206 302Z" fill="${v.hair}"/>
    </svg>`;
  }

  /* ================= content model ================= */
  const DEF = {
    intro: { h: 'Stay <em>Secure.</em><br>Stay <em>Connected.</em>', sub: 'A two-minute guide to the habits<br>that keep our team safe online.', logo: 'northwind' },
    stat: { k: 'Why it matters', stat: '81%', body: 'of breaches start with a weak or reused password.' },
    habits: { h: 'Three habits that matter', c1: 'Use a password manager', c2: 'Turn on 2FA everywhere', c3: 'Think before you click' },
    recap: { h: 'You’re the first<br>line of defense.', cta: 'Take the 2-minute quiz' },
    phish: { h: 'Spot the phish.', sub: 'Three red flags. How fast can you find them?' },
    blank: { h: 'Click to edit headline', sub: 'Add a sub-headline — keep it under two lines' },
  };
  const NAMES = { h: 'Headline', sub: 'Sub-headline', k: 'Kicker', stat: 'Stat', body: 'Body', c1: 'Card 1', c2: 'Card 2', c3: 'Card 3', cta: 'Button', logo: 'Logo', av: 'Avatar', mail: 'Email mockup' };
  const PRIMARY = { intro: 'sub', stat: 'body', habits: 'h', recap: 'h', phish: 'h', blank: 'h' };
  const ALT = {
    'intro-h': ['Think <em>Twice.</em><br>Click <em>Once.</em>', 'Secure by <em>Habit.</em><br>Safe by <em>Default.</em>'],
    'intro-sub': ['Two minutes. Three habits.<br>One much safer team.', 'Small habits that stop<br>big security incidents.'],
    'stat-k': ['The hard truth', 'By the numbers'],
    'stat-stat': ['4 in 5', '81%'],
    'stat-body': ['of breaches begin with a password someone reused.', 'of breaches trace back to a single weak password.'],
    'habits-h': ['Three habits. Zero excuses.', 'Your security starter kit'],
    'habits-c1': ['Let a manager remember for you', 'One vault, zero reused passwords'],
    'habits-c2': ['Add a second lock with 2FA', 'Passwords + a code = safe'],
    'habits-c3': ['Unexpected link? Pause first.', 'Hover before you click'],
    'recap-h': ['Small habits.<br>Big protection.', 'Security starts<br>with you.'],
    'recap-cta': ['Start the quick quiz', 'Test yourself in 2 minutes'],
    'phish-h': ['Would you click this?', 'Trust, but verify.'],
    'phish-sub': ['Look at the sender, the urgency and the link.', 'Find all three red flags in 10 seconds.'],
    'blank-h': ['Spot the phish.', 'Pause before you click.'],
    'blank-sub': ['Most attacks start with a single click.', 'Three seconds of doubt can save a week.'],
  };
  const SCRIPTS = {
    en: {
      s1: [{ m: 'Headline' }, 'Welcome to Security Awareness. ', { m: 'Sub-headline' }, 'In the next two minutes, we’ll cover three simple habits that keep our team — and our customers — safe online.'],
      s2: [{ m: 'Stat' }, 'Here’s why this matters. Eighty-one percent of breaches start with a weak or reused password. It’s rarely a sophisticated attack — usually it’s just a door someone left open.'],
      s3: [{ m: 'Headline' }, 'So what can you do? ', { m: 'Cards' }, 'First, use a password manager. Second, turn on two-factor authentication everywhere. And third — pause before you click any link you weren’t expecting.'],
      s4: [{ m: 'Headline' }, 'That’s it. Three small habits, one much safer team. Remember: you’re our first line of defense. Thanks for watching.'],
    },
    tr: {
      s1: [{ m: 'Headline' }, 'Güvenlik Farkındalığı eğitimine hoş geldiniz. ', { m: 'Sub-headline' }, 'Önümüzdeki iki dakikada ekibimizi — ve müşterilerimizi — internette güvende tutan üç basit alışkanlığı ele alacağız.'],
      s2: [{ m: 'Stat' }, 'Bunun neden önemli olduğuna bakalım. İhlallerin yüzde seksen biri zayıf ya da tekrar kullanılan bir parolayla başlıyor. Çoğu zaman karmaşık bir saldırı değil — sadece açık bırakılmış bir kapı.'],
      s3: [{ m: 'Headline' }, 'Peki siz ne yapabilirsiniz? ', { m: 'Cards' }, 'Birincisi, bir parola yöneticisi kullanın. İkincisi, her yerde iki adımlı doğrulamayı açın. Üçüncüsü, beklemediğiniz bir bağlantıya tıklamadan önce durun.'],
      s4: [{ m: 'Headline' }, 'Hepsi bu. Üç küçük alışkanlık, çok daha güvenli bir ekip. Unutmayın: ilk savunma hattı sizsiniz. İzlediğiniz için teşekkürler.'],
    },
  };
  const SHORT = {
    en: {
      s1: [{ m: 'Headline' }, 'Welcome! ', { m: 'Sub-headline' }, 'Here are three habits that keep us safe online.'],
      s2: [{ m: 'Stat' }, '81% of breaches start with a weak or reused password.'],
      s3: [{ m: 'Headline' }, 'What can you do? ', { m: 'Cards' }, 'Use a password manager, turn on 2FA, and pause before you click.'],
      s4: [{ m: 'Headline' }, 'Three habits, one safer team. Thanks for watching.'],
    },
    tr: {
      s1: [{ m: 'Headline' }, 'Hoş geldiniz! ', { m: 'Sub-headline' }, 'İşte bizi internette güvende tutan üç alışkanlık.'],
      s2: [{ m: 'Stat' }, 'İhlallerin %81’i zayıf ya da tekrar kullanılan bir parolayla başlıyor.'],
      s3: [{ m: 'Headline' }, 'Ne yapabilirsiniz? ', { m: 'Cards' }, 'Parola yöneticisi kullanın, 2FA’yı açın ve tıklamadan önce durun.'],
      s4: [{ m: 'Headline' }, 'Üç alışkanlık, daha güvenli bir ekip. İzlediğiniz için teşekkürler.'],
    },
  };
  const PHISH_SCRIPT = {
    en: [{ m: 'Email mockup' }, 'Let’s practice. Look closely at this email — the sender, the urgency, the link. Three red flags, one very convincing trap.'],
    tr: [{ m: 'Email mockup' }, 'Hadi pratik yapalım. Bu e-postaya dikkatle bakın — gönderen, aciliyet, bağlantı. Üç uyarı işareti, çok ikna edici bir tuzak.'],
  };

  const state = {
    scenes: [
      { id: 's1', type: 'intro', name: 'Intro' },
      { id: 's2', type: 'stat', name: 'Why it matters' },
      { id: 's3', type: 'habits', name: 'Three habits' },
      { id: 's4', type: 'recap', name: 'Recap' },
    ],
    texts: {},
    scripts: clone(SCRIPTS),
    lang: 'en',
    avatar: 0,
    scene: 0,
    sel: null,
    t: 0,
    playing: false,
    tool: 'scenes',
    tab: 'assistant',
    alt: {},
    nextId: 5,
    geo: {},
    hidden: {},
    zoom: 'fit',
  };
  const cur = () => state.scenes[state.scene];
  const T = (sc, k) => state.texts[`${sc.id}-${k}`] ?? DEF[sc.type][k] ?? '';
  const words = parts => parts.filter(p => typeof p === 'string').join(' ').split(/\s+/).filter(Boolean).length;
  const scriptOf = sc => state.scripts[state.lang][sc.id] || [''];
  const dur = sc => Math.max(3, Math.round(words(scriptOf(sc)) / 2.5 * 10) / 10);
  const total = () => state.scenes.reduce((a, s) => a + dur(s), 0);
  const startOf = i => state.scenes.slice(0, i).reduce((a, s) => a + dur(s), 0);

  /* ================= history ================= */
  const hist = { past: [], future: [] };
  const snap = () => JSON.stringify({ scenes: state.scenes, texts: state.texts, scripts: state.scripts, lang: state.lang, avatar: state.avatar, scene: state.scene, geo: state.geo, hidden: state.hidden, extras: state.extras, nextX: state.nextX });
  function restore(s) {
    const o = JSON.parse(s);
    Object.assign(state, o);
    state.scene = Math.min(state.scene, state.scenes.length - 1);
    state.sel = null;
    state.t = startOf(state.scene);
    renderAll();
  }
  function pushHist(before) { hist.past.push(before); hist.future = []; updUndo(); markSaving(); }
  function undo() { if (!hist.past.length) return; hist.future.push(snap()); restore(hist.past.pop()); updUndo(); toast('Undone'); }
  function redo() { if (!hist.future.length) return; hist.past.push(snap()); restore(hist.future.pop()); updUndo(); toast('Redone'); }
  function updUndo() { $('#undo').disabled = !hist.past.length; $('#redo').disabled = !hist.future.length; }
  let saveT;
  function markSaving() {
    const s = $('#saved'); s.innerHTML = `<span class="spin" style="width:12px;height:12px;border-width:1.5px"></span><span>Saving…</span>`;
    clearTimeout(saveT); saveT = setTimeout(() => s.innerHTML = `${ic('check-c', 'sm')}<span>Saved</span>`, 700);
  }

  /* ================= scene templates ================= */
  const E = (sc, k, type, name) => `data-el="${sc.id}-${k}" data-key="${k}" data-type="${type}" data-name="${name || NAMES[k]}"`;
  const CARD_IC = ['key', 'shield', 'pointer'];
  const CARD_D = ['One strong, unique password for every account.', 'A code on your phone stops 99% of account takeovers.', 'Hover to check the link. When in doubt, report it.'];
  function sceneHTML(sc) {
    const av = AV[state.avatar];
    switch (sc.type) {
      case 'intro': return `<div class="sc t-intro"><div class="glow"></div>
        <div class="el av" ${E(sc, 'av', 'avatar', 'Avatar · ' + av.name)}>${avatarSVG(av)}</div>
        <div class="rule"></div>
        <div class="el h" ${E(sc, 'h', 'text')}>${T(sc, 'h')}</div>
        <div class="el sub" ${E(sc, 'sub', 'text')}>${T(sc, 'sub')}</div>
        <div class="el logo2" ${E(sc, 'logo', 'image')}><i></i>${T(sc, 'logo')}</div></div>`;
      case 'stat': return `<div class="sc t-stat">
        <div class="el k" ${E(sc, 'k', 'text')}>${T(sc, 'k')}</div>
        <div class="el stat" ${E(sc, 'stat', 'text')}>${T(sc, 'stat')}</div>
        <div class="el body" ${E(sc, 'body', 'text')}>${T(sc, 'body')}</div>
        <div class="src">Source: Northwind internal security review, 2026</div>
        <div class="el av" ${E(sc, 'av', 'avatar', 'Avatar · ' + av.name)}>${avatarSVG(av)}</div>
        <div class="bar"><i></i></div></div>`;
      case 'habits': return `<div class="sc t-habits">
        <div class="el h" ${E(sc, 'h', 'text')}>${T(sc, 'h')}</div>
        ${[1, 2, 3].map(n => `<div class="el card3" style="left:${88 + (n - 1) * 376}px" ${E(sc, 'c' + n, 'text')}>
          <div class="n">0${n}</div><div class="ic"><svg class="i"><use href="#i-${CARD_IC[n - 1]}"/></svg></div>
          <div class="t">${T(sc, 'c' + n)}</div><div class="d">${CARD_D[n - 1]}</div></div>`).join('')}</div>`;
      case 'recap': return `<div class="sc t-recap"><div class="sc-ring"></div>
        <div class="logo2"><i></i>northwind</div>
        <div class="el h" ${E(sc, 'h', 'text')}>${T(sc, 'h')}</div>
        <div class="el cta" ${E(sc, 'cta', 'text')}><span>${T(sc, 'cta')}</span><svg class="i" style="width:28px;height:28px"><use href="#i-arrow-right"/></svg></div></div>`;
      case 'phish': return `<div class="sc t-phish">
        <div class="el h" ${E(sc, 'h', 'text')}>${T(sc, 'h')}</div>
        <div class="el sub" ${E(sc, 'sub', 'text')}>${T(sc, 'sub')}</div>
        <div class="el mail" ${E(sc, 'mail', 'image')}>
          <div class="from"><div class="av3">IT</div><div><b>IT Support</b><small>it-supp0rt@northwlnd-help.co</small></div></div>
          <div class="subj">Action required: your password expires in 1 hour</div>
          <div class="ln" style="width:92%"></div><div class="ln" style="width:78%"></div><div class="ln" style="width:60%"></div>
          <div class="btn3">Verify account now</div>
          <div class="flag" style="left:420px;top:40px">1</div><div class="flag" style="left:660px;top:92px">2</div><div class="flag" style="left:290px;top:262px">3</div>
        </div>
        <div class="tips"><div><b>1</b>Look-alike sender domain</div><div><b>2</b>Artificial urgency</div><div><b>3</b>Link that asks for credentials</div></div></div>`;
      default: return `<div class="sc t-blank">
        <div class="el h" ${E(sc, 'h', 'text')}>${T(sc, 'h')}</div>
        <div class="el sub" ${E(sc, 'sub', 'text')}>${T(sc, 'sub')}</div></div>`;
    }
  }

  /* ================= canvas ================= */
  let scale = 1, fitScale = 1;
  const ZOOMS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4];
  function fit() {
    const vp = $('#viewport'), fr = $('#frame');
    const w = vp.clientWidth - 96, h = vp.clientHeight - 104;
    fitScale = Math.max(0.1, Math.min(w / 1280, h / 720));
    scale = state.zoom === 'fit' ? fitScale : state.zoom;
    fr.style.width = 1280 * scale + 'px'; fr.style.height = 720 * scale + 'px';
    const sr = $('#scene'); sr.style.transform = `scale(${scale})`; sr.style.setProperty('--inv', 1 / scale);
    $('#zoomLbl').textContent = state.zoom === 'fit' ? 'Fit' : Math.round(scale * 100) + '%';
    requestAnimationFrame(positionSel);
  }
  function setZoom(z, cx, cy) {
    const vp = $('#viewport'), r = vp.getBoundingClientRect(), fr = $('#frame').getBoundingClientRect();
    if (cx == null) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
    const px = (cx - fr.left) / scale, py = (cy - fr.top) / scale;
    state.zoom = z === 'fit' ? 'fit' : Math.min(4, Math.max(0.1, z));
    fit();
    const nf = $('#frame').getBoundingClientRect();
    vp.scrollLeft += nf.left + px * scale - cx;
    vp.scrollTop += nf.top + py * scale - cy;
    positionSel();
  }
  function zoomStep(dir) {
    const next = dir > 0 ? ZOOMS.find(z => z > scale + 0.001) : [...ZOOMS].reverse().find(z => z < scale - 0.001);
    if (next) setZoom(next);
  }

  /* per-element geometry overrides (position, size, font size, z-order) */
  const isBox = el => el.dataset.type === 'avatar' || el.classList.contains('card3') || el.classList.contains('mail') || el.classList.contains('x-box');
  function readGeo(el) {
    return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, fs: parseFloat(getComputedStyle(el).fontSize) };
  }
  function applyGeoEl(el) {
    const k = el.dataset.el, g = state.geo[k], st = el.style;
    if (state.hidden[k]) { st.display = 'none'; return; }
    if (!g) return;
    if (g.x != null) { st.left = g.x + 'px'; st.right = 'auto'; }
    if (g.y != null) { st.top = g.y + 'px'; st.bottom = 'auto'; }
    if (g.w != null) { st.width = g.w + 'px'; st.maxWidth = 'none'; }
    if (g.h != null) st.height = g.h + 'px';
    if (g.fs != null) st.fontSize = g.fs + 'px';
    if (g.wrap) st.whiteSpace = 'normal';
    if (g.z != null) st.zIndex = g.z;
  }
  const applyGeo = root => root.querySelectorAll('.el[data-el]').forEach(applyGeoEl);
  function setGeo(key, patch) { state.geo[key] = { ...(state.geo[key] || {}), ...patch }; }

  function renderCanvas() {
    $('#scene').innerHTML = sceneHTML(cur());
    applyGeo($('#scene'));
    $('#sceneLabel').innerHTML = `${ic('scenes', 'sm')}<span>Scene ${state.scene + 1}</span><span class="muted">·</span><span class="muted">${esc(cur().name)}</span>`;
    positionSel();
    renderPlayer();
  }
  const canvasEl = key => key && !state.hidden[key] && $(`#scene [data-el="${key}"]`);

  function positionSel() {
    const sel = $('#sel'), ftb = $('#ftb'), el = canvasEl(state.sel);
    $$('#scene .el.is-sel').forEach(n => n !== el && n.classList.remove('is-sel'));
    if (!el) { sel.style.display = 'none'; ftb.style.display = 'none'; return; }
    el.classList.add('is-sel');
    const s = $('#stage').getBoundingClientRect(), r = el.getBoundingClientRect();
    const x = r.left - s.left - 3, y = r.top - s.top - 3, w = r.width + 6, h = r.height + 6;
    Object.assign(sel.style, { display: 'block', left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    sel.classList.toggle('editing', !!el.dataset.editing);
    sel.classList.toggle('textmode', !isBox(el));
    const b = $('#badge'); b.style.left = x + w / 2 + 'px'; b.style.top = Math.min(y + h + 8, s.height - 70) + 'px';
    if (ftb.dataset.for !== state.sel) { ftb.innerHTML = toolbarHTML(el); ftb.dataset.for = state.sel; }
    ftb.style.display = 'flex';
    const tw = ftb.offsetWidth, th = ftb.offsetHeight;
    let top = y - th - 12; if (top < 8) top = y + h + 12;
    if (top + th > s.height - 52) top = Math.max(8, y + 8);
    const left = Math.min(Math.max(8, x + w / 2 - tw / 2), s.width - tw - 8);
    ftb.style.left = left + 'px'; ftb.style.top = top + 'px';
  }
  function toolbarHTML(el) {
    const type = el.dataset.type, name = el.dataset.name;
    const tag = `<div class="tag">${ic(type === 'text' ? 'type' : type === 'avatar' ? 'user' : 'image', 'sm')}${esc(name)}</div><div class="fsep"></div>`;
    const ask = `<div class="fsep"></div><button class="ask" data-act="ask">${ic('sparkles', 'sm')}Ask AI</button><button class="ib sm" data-act="menu" title="More">${ic('more')}</button>`;
    if (type === 'text') {
      const cs = getComputedStyle(el);
      const color = cs.color, size = Math.round(parseFloat(cs.fontSize));
      return tag + `<button class="dd" data-act="props">Instrument Sans${ic('down', 'sm')}</button>
        <button class="dd" data-act="props">${size}${ic('down', 'sm')}</button><div class="fsep"></div>
        <button class="ib sm" data-toast="Bold">${ic('bold')}</button><button class="ib sm" data-toast="Italic">${ic('italic')}</button>
        <button class="ib sm" data-toast="Align">${ic('al')}</button>
        <button class="ib sm" data-act="props" title="Color"><span class="swatch" style="background:${color}"></span></button>` + ask;
    }
    if (type === 'avatar') return tag + `<button class="dd" data-act="avatars">Change avatar</button><button class="dd" data-act="props">Voice${ic('down', 'sm')}</button>` + ask;
    return tag + `<button class="dd" data-toast="Pick a replacement from Media">Replace</button>` + ask;
  }

  function select(key) {
    if (state.sel === key) return;
    const ae = document.activeElement; if (ae && ae.closest && ae.closest('#scene')) ae.blur();
    state.sel = key; $('#ftb').dataset.for = '';
    positionSel(); renderCtx(); renderSugg(); renderProps();
    $('#rtabs').classList.toggle('has-sel', !!key);
  }

  /* drag to move · handles to resize · snapping guides */
  let drag = null, justDragged = false;
  function beginDrag(e, el, mode, dir) {
    drag = { mode, dir, el, key: el.dataset.el, sx: e.clientX, sy: e.clientY, g: readGeo(el), before: snap(), moved: false, box: isBox(el) };
    on(document, 'pointermove', onDrag);
    on(document, 'pointerup', endDrag, { once: true });
  }
  function snap1(cands, th) {
    let best = null;
    for (const [v, target] of cands) { const d = target - v; if (Math.abs(d) < th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: target }; }
    return best;
  }
  function showGuides(gd) {
    const s = $('#stage').getBoundingClientRect(), f = $('#frame').getBoundingClientRect();
    const gv = $('#gv'), gh = $('#gh');
    if (gd.v != null) Object.assign(gv.style, { display: 'block', left: f.left - s.left + gd.v * scale + 'px', top: f.top - s.top + 'px', height: f.height + 'px' });
    else gv.style.display = 'none';
    if (gd.h != null) Object.assign(gh.style, { display: 'block', top: f.top - s.top + gd.h * scale + 'px', left: f.left - s.left + 'px', width: f.width + 'px' });
    else gh.style.display = 'none';
  }
  function onDrag(e) {
    const d = drag; if (!d) return;
    const dx = (e.clientX - d.sx) / scale, dy = (e.clientY - d.sy) / scale;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return;
      d.moved = true; $('#stage').classList.add('dragging');
    }
    const g = d.g, guides = {}, patch = {};
    if (d.mode === 'move') {
      let nx = g.x + dx, ny = g.y + dy;
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) ny = g.y; else nx = g.x; }
      if (!e.ctrlKey && !e.metaKey) {
        const th = 6 / scale;
        const sx = snap1([[nx + g.w / 2, 640], [nx, 88], [nx + g.w, 1192]], th);
        if (sx) { nx += sx.d; guides.v = sx.at; }
        const sy = snap1([[ny + g.h / 2, 360], [ny, 72], [ny + g.h, 648]], th);
        if (sy) { ny += sy.d; guides.h = sy.at; }
      }
      patch.x = Math.round(nx); patch.y = Math.round(ny);
      $('#badge').textContent = `X ${patch.x}  ·  Y ${patch.y}`;
    } else {
      const dir = d.dir, E_ = dir.includes('e'), W_ = dir.includes('w'), N_ = dir.includes('n'), S_ = dir.includes('s');
      const corner = (E_ || W_) && (N_ || S_), k = e.altKey ? 2 : 1;
      let nw = g.w + (E_ ? dx : W_ ? -dx : 0) * k, nh = g.h + (S_ ? dy : N_ ? -dy : 0) * k, fs = g.fs;
      if (corner && (!d.box || !e.shiftKey)) {
        const rx = nw / g.w, ry = nh / g.h, r = Math.max(0.08, Math.abs(rx - 1) > Math.abs(ry - 1) ? rx : ry);
        nw = g.w * r; nh = g.h * r; if (!d.box) fs = g.fs * r;
      }
      nw = Math.max(24, nw); nh = Math.max(16, nh);
      let x = g.x, y = g.y;
      if (e.altKey) { x = g.x + (g.w - nw) / 2; y = g.y + (g.h - nh) / 2; }
      else { if (W_) x = g.x + g.w - nw; if (N_) y = g.y + g.h - nh; }
      Object.assign(patch, { x: Math.round(x), y: Math.round(y), w: Math.round(nw) });
      if (d.box) patch.h = Math.round(nh);
      else if (corner) patch.fs = Math.round(fs * 10) / 10;
      else patch.wrap = true;
      $('#badge').textContent = d.box ? `W ${patch.w}  ·  H ${patch.h}` : corner ? `${Math.round(fs)} px  ·  W ${patch.w}` : `W ${patch.w}`;
    }
    setGeo(d.key, patch);
    applyGeoEl(d.el); positionSel(); showGuides(guides);
  }
  function endDrag() {
    document.removeEventListener('pointermove', onDrag);
    const d = drag; drag = null;
    $('#stage').classList.remove('dragging'); showGuides({});
    if (!d || !d.moved) return;
    justDragged = true; setTimeout(() => justDragged = false, 0);
    pushHist(d.before);
    $('#ftb').dataset.for = ''; positionSel(); renderScenes(); renderProps();
  }
  function nudge(dx, dy) {
    const el = canvasEl(state.sel); if (!el) return;
    const before = snap(), g = readGeo(el);
    setGeo(state.sel, { x: g.x + dx, y: g.y + dy });
    applyGeoEl(el); positionSel(); pushHist(before); renderProps();
  }
  function centerSel(axis) {
    const el = canvasEl(state.sel); if (!el) return;
    const before = snap(), g = readGeo(el), p = {};
    if (axis.includes('h')) p.x = Math.round((1280 - g.w) / 2);
    if (axis.includes('v')) p.y = Math.round((720 - g.h) / 2);
    setGeo(state.sel, p); applyGeoEl(el); positionSel(); pushHist(before); renderScenes(); renderProps();
  }
  function zorder(front) {
    const k = state.sel, el = canvasEl(k); if (!el) return;
    const before = snap(), zs = $$('#scene .el').map(n => +(state.geo[n.dataset.el]?.z ?? 0));
    setGeo(k, { z: front ? Math.max(0, ...zs) + 1 : Math.min(0, ...zs) - 1 });
    applyGeoEl(el); pushHist(before); renderScenes(); toast(front ? 'Brought to front' : 'Sent to back');
  }
  function deleteSel() {
    const k = state.sel; if (!k) return;
    const before = snap(); state.hidden[k] = true;
    select(null); pushHist(before); renderCanvas(); renderScenes();
    toast('Element deleted — Ctrl+Z to undo');
  }
  function resetGeo() {
    const k = state.sel; if (!k || !state.geo[k]) return;
    const before = snap(); delete state.geo[k];
    pushHist(before); $('#ftb').dataset.for = ''; renderCanvas(); renderScenes(); renderProps();
  }

  /* context menu */
  function closeMenu() { $('#cmenu')?.remove(); }
  function openMenu(x, y, el) {
    closeMenu();
    const m = document.createElement('div'); m.className = 'cmenu'; m.id = 'cmenu';
    m.innerHTML = `${el.dataset.type === 'text' ? `<button data-m="edit">${ic('type')}Edit text<kbd>Enter</kbd></button>` : ''}
      <button data-m="ask">${ic('sparkles', 'spark')}Ask AI about this<kbd>Ctrl K</kbd></button><hr>
      <button data-m="front">${ic('front')}Bring to front<kbd>]</kbd></button>
      <button data-m="back">${ic('back')}Send to back<kbd>[</kbd></button>
      <button data-m="center">${ic('center-h')}Center on canvas</button>
      ${state.geo[el.dataset.el] ? `<button data-m="reset">${ic('refresh')}Reset position & size</button>` : ''}<hr>
      <button data-m="del" class="danger">${ic('trash')}Delete<kbd>Del</kbd></button>`;
    layer.appendChild(m);
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
    m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  }
  function menuAction(a) {
    const el = canvasEl(state.sel); closeMenu(); if (!el) return;
    if (a === 'edit') startEdit(el);
    if (a === 'ask') focusAsk();
    if (a === 'front') zorder(true);
    if (a === 'back') zorder(false);
    if (a === 'center') centerSel('hv');
    if (a === 'reset') resetGeo();
    if (a === 'del') deleteSel();
  }

  /* inline text editing */
  let editBefore = null;
  function startEdit(el) {
    if (el.dataset.type !== 'text') return;
    editBefore = snap();
    const target = el.querySelector('.t, span') || el;
    target.contentEditable = 'true';
    el.dataset.editing = '1';
    target.focus();
    const rg = document.createRange(); rg.selectNodeContents(target);
    const s = getSelection(); s.removeAllRanges(); s.addRange(rg);
    positionSel();
    target.addEventListener('blur', () => {
      target.contentEditable = 'false'; delete el.dataset.editing;
      const k = `${cur().id}-${el.dataset.key}`, html = target.innerHTML.trim();
      if (html !== T(cur(), el.dataset.key)) { state.texts[k] = html; pushHist(editBefore); renderScenes(); }
      positionSel();
    }, { once: true });
    target.addEventListener('keydown', e => { if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey && el.dataset.key !== 'h')) { e.preventDefault(); target.blur(); } });
  }

  /* ================= timeline ================= */
  function renderTrack() {
    const tot = total();
    $('#ttot').textContent = fmt(tot);
    $('#segs').innerHTML = state.scenes.map((sc, i) => `<div class="seg-b ${i === state.scene ? 'on' : ''}" data-i="${i}" style="flex:${dur(sc)} 1 0">
      <span class="n">${i + 1}</span><span class="nm">${esc(sc.name)}</span><span class="d">${fmt(dur(sc))}</span></div>`).join('');
    let tk = '';
    for (let s = 0; s <= Math.floor(tot); s++) {
      const p = s / tot * 100, major = s % 5 === 0;
      tk += `<span class="${major ? 'major' : ''}" style="left:${p}%"></span>`;
      if (major && s < tot - 1.5) tk += `<b style="left:${p}%">${fmt(s)}</b>`;
    }
    $('#ticks').innerHTML = tk;
    updPlayhead();
  }
  function updPlayhead() {
    $('#ph').style.left = (state.t / total() * 100) + '%';
    $('#tcur').textContent = fmtT(state.t);
    updPlayer();
  }
  function seek(t) {
    state.t = Math.max(0, Math.min(total(), t));
    const idx = sceneAt(state.t);
    if (idx !== state.scene) goScene(idx, false); else updPlayhead();
  }
  function sceneAt(t) { let a = 0; for (let i = 0; i < state.scenes.length; i++) { a += dur(state.scenes[i]); if (t < a) return i; } return state.scenes.length - 1; }
  let raf, last;
  function setPlaying(p) {
    state.playing = p;
    const icn = p ? 'pause' : 'play';
    $('#play').innerHTML = ic(icn); $('#plPlay').innerHTML = ic(icn);
    if (p) { if (state.t >= total() - 0.05) state.t = 0; select(null); last = performance.now(); raf = requestAnimationFrame(tick); }
    else cancelAnimationFrame(raf);
  }
  function tick(ts) {
    if (!state.playing) return;
    state.t += (ts - last) / 1000; last = ts;
    if (state.t >= total()) { state.t = total(); setPlaying(false); }
    const idx = sceneAt(state.t);
    if (idx !== state.scene) goScene(idx, false); else updPlayhead();
    raf = requestAnimationFrame(tick);
  }

  /* ================= script ================= */
  function renderScript() {
    const parts = scriptOf(cur());
    $('#script').innerHTML = parts.map(p => typeof p === 'string' ? esc(p)
      : `<span class="mk" contenteditable="false" data-m="${esc(p.m)}">${ic('enter')}${esc(p.m)}</span>`).join('');
    $('#scriptScene').innerHTML = `Scene ${state.scene + 1} · <b>${esc(cur().name)}</b>`;
    renderDur();
    const av = AV[state.avatar];
    $('#voiceFace').innerHTML = avatarSVG(av); $('#voiceName').textContent = av.name; $('#voiceLang').textContent = state.lang.toUpperCase();
  }
  function renderDur() { $('#scriptDur').innerHTML = `${ic('clock', 'sm')}${fmt(dur(cur()))}`; }
  function readScript() {
    const parts = [];
    $('#script').childNodes.forEach(n => {
      if (n.nodeType === 1 && n.classList.contains('mk')) parts.push({ m: n.dataset.m });
      else parts.push(n.textContent);
    });
    state.scripts[state.lang][cur().id] = parts;
  }

  /* ================= left drawer ================= */
  const TOOLS = {
    scenes: () => `<div class="dr-head"><h2>Scenes</h2><div>
        <button class="ib sm" title="Generate scenes with AI" data-ai="Add a scene with a phishing example">${ic('sparkles', 'spark')}</button>
        <button class="ib sm" title="Collapse" data-act="collapse">${ic('left')}</button></div></div>
      <div class="dr-body" id="scenesList"></div>`,
    avatar: () => `<div class="dr-head"><h2>Avatar</h2><button class="ib sm" data-act="collapse">${ic('left')}</button></div>
      <div class="dr-body">
        <div class="search">${ic('search', 'sm')}<input placeholder="Search avatars"></div>
        <div class="seg" style="margin-top:10px"><button class="on">Stock</button><button>My avatars</button></div>
        <div class="dr-label">Presenters <span>${AV.length}</span></div>
        <div class="grid2">${AV.map((a, i) => `<button class="av-card ${i === state.avatar ? 'on' : ''}" data-av="${i}">
          <div class="av-img">${avatarSVG(a)}</div><span class="av-check">${ic('check', 'sm')}</span>
          <div class="av-name">${a.name}</div><div class="av-sub">${a.meta}</div></button>`).join('')}
          <button class="av-create" data-toast="Avatar studio opens in a new tab">${ic('plus')}Create your<br>own avatar</button>
        </div></div>`,
    text: () => `<div class="dr-head"><h2>Text</h2><button class="ib sm" data-act="collapse">${ic('left')}</button></div>
      <div class="dr-body">
        <button class="txt-add" data-toast="Heading added"><div style="font:600 22px/1.2 var(--st-font-display);letter-spacing:-.02em">Add a heading</div></button>
        <button class="txt-add" data-toast="Subheading added"><div style="font:500 16px/1.3 var(--st-font-display)">Add a subheading</div></button>
        <button class="txt-add" data-toast="Body text added"><div style="font:400 13px/1.4 var(--st-font-ui);color:var(--st-text-2)">Add a little bit of body text</div></button>
        <div class="dr-label">Text styles</div>
        <div class="grid2">
          <div class="combo" style="background:#0a0c0b;color:#fff" data-toast="Style applied"><div style="font-size:17px;font-weight:500;line-height:1.05;letter-spacing:-.02em">Stay <span style="color:#a8e07f">Secure.</span></div><div style="font-size:9px;opacity:.6;margin-top:4px">Sub-headline goes here</div></div>
          <div class="combo" style="background:#f3f0e8;color:#121212" data-toast="Style applied"><div style="font-size:26px;font-weight:500;letter-spacing:-.05em;line-height:1">81%</div><div style="font-size:9px;margin-top:3px">of teams agree</div></div>
          <div class="combo" style="background:#a8e07f;color:#0b120c" data-toast="Style applied"><div style="font-size:15px;font-weight:500;line-height:1.05;letter-spacing:-.02em">First line of defense.</div></div>
          <div class="combo" style="background:#fff;color:#111;box-shadow:0 0 0 1px var(--st-border)" data-toast="Style applied"><div style="font-size:9px;letter-spacing:.14em;font-weight:600;color:#888">CHAPTER 02</div><div style="font-size:15px;font-weight:500;letter-spacing:-.02em">Three habits</div></div>
        </div></div>`,
    media: () => `<div class="dr-head"><h2>Media</h2><button class="ib sm" data-act="collapse">${ic('left')}</button></div>
      <div class="dr-body">
        <div class="ai-box">
          <textarea placeholder="Describe a clip — e.g. close-up of hands typing on a laptop, soft office light"></textarea>
          <div class="ai-box-bar"><span class="chipsel">${ic('video', 'sm')}Video${ic('down', 'sm')}</span><span class="chipsel">16:9</span><span class="grow"></span>
          <button class="btn primary sm" data-toast="Generating clip…">${ic('sparkles', 'sm')}Create</button></div>
        </div>
        <div class="dr-label">Browse</div>
        <div class="src-row"><button class="src on">Stock</button><button class="src">Library</button><button class="src">In this video</button><button class="src">GIFs</button></div>
        <div class="search" style="margin:10px 0">${ic('search', 'sm')}<input placeholder="Search stock video"></div>
        <div class="grid2">
          ${[['Team meeting', '#56657a,#2a3140', '0:12'], ['Typing on laptop', '#7a6456,#3a2a22', '0:08'], ['Server room', '#1f4a5a,#0c1d24', '0:15'], ['City at night', '#3b2d5c,#120d20', '0:10'], ['Phone 2FA code', '#4f6b4a,#1c2a1a', '0:06'], ['Open office', '#8a7a62,#4a3f30', '0:14']]
            .map(([n, g, d]) => `<div class="media-tile" style="background:linear-gradient(135deg,${g})" data-toast="Added “${n}” to scene"><em>${d}</em><span>${n}</span></div>`).join('')}
        </div></div>
      <div class="dr-foot"><button class="btn w100" data-toast="Choose files to upload">${ic('upload', 'sm')}Upload media</button></div>`,
    shape: () => `<div class="dr-head"><h2>Shape</h2><button class="ib sm" data-act="collapse">${ic('left')}</button></div>
      <div class="dr-body"><div class="dr-label">Basic</div><div class="grid4">
        ${['<rect x="3" y="3" width="18" height="18" rx="1"/>', '<rect x="3" y="3" width="18" height="18" rx="6"/>', '<circle cx="12" cy="12" r="9"/>', '<path d="M12 3 21 20H3z"/>', '<path d="M12 2 22 12 12 22 2 12z"/>', '<path d="m12 2 3 6.5 7 1-5 5 1.2 7L12 18l-6.2 3.5L7 14.5l-5-5 7-1z"/>', '<rect x="2" y="8" width="20" height="8" rx="4"/>', '<path d="M12 3 20.5 9v10h-17V9z"/>']
          .map(p => `<button class="shape" data-toast="Shape added"><svg viewBox="0 0 24 24" fill="currentColor">${p}</svg></button>`).join('')}
      </div><div class="dr-label">Lines & arrows</div><div class="grid4">
        ${['<path d="M3 12h18"/>', '<path d="M3 12h18" stroke-dasharray="3 3"/>', '<path d="M4 12h16M14 6l6 6-6 6"/>', '<path d="M4 20 20 4M12 4h8v8"/>']
          .map(p => `<button class="shape" data-toast="Line added"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg></button>`).join('')}
      </div></div>`,
    motion: () => `<div class="dr-head"><h2>Motion</h2><button class="ib sm" data-act="collapse">${ic('left')}</button></div>
      <div class="dr-body">
        <div class="ai-hint" style="margin:0 0 4px">${ic('sparkles')}<div>Select an element, then pick an animation. Or ask the assistant to animate the whole scene.<br><button data-ai="Animate this scene so it feels energetic">Animate this scene →</button></div></div>
        <div class="dr-label">Enter animations</div>
        <div class="grid2">${[['Fade', 'mo-fade'], ['Slide up', 'mo-up'], ['Pop', 'mo-pop'], ['Blur in', 'mo-blur'], ['Wipe', 'mo-wipe'], ['Slide in', 'mo-left']]
          .map(([n, a]) => `<button class="mo-tile" style="--anim:${a}" data-toast="${n} applied"><div class="mo-prev"><i></i></div><div class="mo-name">${n}</div></button>`).join('')}</div>
        <div class="dr-label">Scene transition</div>
        <div class="iseg"><button class="on">Cut</button><button>Fade</button><button>Slide</button><button>Zoom</button></div>
      </div>`,
    captions: () => `<div class="dr-head"><h2>Captions</h2><button class="ib sm" data-act="collapse">${ic('left')}</button></div>
      <div class="dr-body">
        <div class="tgl" style="padding:4px"><span>Show captions<small>Auto-generated from your script</small></span><button class="sw-t on"></button></div>
        <div class="dr-label">Style</div>
        <div class="grid2">
          <div class="cap-tile on"><span style="background:rgba(0,0,0,.75);color:#fff;font-size:10px;padding:2px 5px;border-radius:3px">Classic caption</span></div>
          <div class="cap-tile"><span style="color:#fff;font:700 12px var(--st-font-ui);text-shadow:0 1px 0 #000,0 0 6px #000">BOLD <span style="color:#fde047">POP</span></span></div>
          <div class="cap-tile"><span style="color:#fff;font-size:10.5px">Kara<span style="background:#4353ff;padding:0 2px;border-radius:2px">oke</span> style</span></div>
          <div class="cap-tile"><span style="color:rgba(255,255,255,.85);font-size:10px;letter-spacing:.02em">minimal lowercase</span></div>
        </div>
        <div class="dr-label">Position</div>
        <div class="iseg"><button>Top</button><button>Middle</button><button class="on">Bottom</button></div>
        <div class="dr-label">Languages</div>
        <button class="opt-row" data-ai="Translate the video to Turkish"><span class="opt-ic">${ic('globe')}</span><span><b>Add a caption language</b><small>AI translation, 120+ languages</small></span></button>
      </div>`,
    record: () => `<div class="dr-head"><h2>Record</h2><button class="ib sm" data-act="collapse">${ic('left')}</button></div>
      <div class="dr-body">
        <button class="opt-row" data-toast="Choose a screen to share"><span class="opt-ic">${ic('monitor')}</span><span><b>Screen</b><small>Record a tab, window or full screen</small></span></button>
        <button class="opt-row" data-toast="Camera permission requested"><span class="opt-ic">${ic('video')}</span><span><b>Camera</b><small>Record yourself as a presenter</small></span></button>
        <button class="opt-row" data-toast="Choose a screen to share"><span class="opt-ic">${ic('user')}</span><span><b>Screen + camera</b><small>Picture-in-picture walkthrough</small></span></button>
        <div class="dr-label">Audio</div>
        <button class="opt-row" data-toast="Microphone permission requested"><span class="opt-ic">${ic('mic')}</span><span><b>Record voiceover</b><small>Replace the AI voice with your own</small></span></button>
      </div>`,
    brand: () => `<div class="dr-head"><h2>Brand kit</h2><button class="ib sm" data-act="collapse">${ic('left')}</button></div>
      <div class="dr-body">
        <div class="dr-label">Colors</div>
        <div class="swatches">${['#0a0c0b', '#a8e07f', '#f3f0e8', '#15221a', '#ffffff', '#4353ff'].map(c => `<span style="background:${c}" title="${c}"></span>`).join('')}</div>
        <div class="dr-label">Fonts</div>
        <div class="opt-row" style="cursor:default"><span class="opt-ic" style="font:600 16px var(--st-font-display)">Aa</span><span><b>Instrument Sans</b><small>Headings · Medium</small></span></div>
        <div class="opt-row" style="cursor:default"><span class="opt-ic" style="font:500 14px var(--st-font-ui)">Aa</span><span><b>Inter</b><small>Body · Regular</small></span></div>
        <div class="dr-label">Logo</div>
        <div class="opt-row" style="cursor:default"><span class="opt-ic" style="background:#0a0c0b;color:#fff"><span class="logo2" style="display:block"><i style="width:14px;height:14px;background:#fff;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)"></i></span></span><span><b>northwind</b><small>SVG · light & dark</small></span></div>
      </div>`,
  };
  function renderDrawer() {
    $$('.rail-btn[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === state.tool && !$('#app').classList.contains('no-drawer')));
    $('#drawer').innerHTML = TOOLS[state.tool]();
    if (state.tool === 'scenes') renderScenes();
  }
  function renderScenes() {
    const list = $('#scenesList'); if (!list) return;
    list.innerHTML = state.scenes.map((sc, i) => `<div class="scene-item ${i === state.scene ? 'on' : ''}" data-i="${i}" draggable="true" title="Drag to reorder">
        <div class="si-num">${i + 1}</div>
        <div><div class="thumb"><div class="thumb-in" style="transform:scale(${204 / 1280})">${sceneHTML(sc)}</div></div>
        <div class="si-meta"><span class="si-name">${esc(sc.name)}</span><span class="si-dur">${fmt(dur(sc))}</span></div></div>
        <div class="si-tools"><button data-dup="${i}" title="Duplicate">${ic('dup', 'sm')}</button>${state.scenes.length > 1 ? `<button data-del="${i}" title="Delete">${ic('trash', 'sm')}</button>` : ''}</div>
      </div>`).join('') + `<button class="add-scene" data-act="add-scene">${ic('plus', 'sm')}Add scene</button>`;
    $$('.thumb-in', list).forEach(applyGeo);
  }
  function setTool(t) {
    const app = $('#app');
    if (state.tool === t && !app.classList.contains('no-drawer')) app.classList.add('no-drawer');
    else { state.tool = t; app.classList.remove('no-drawer'); }
    renderDrawer();
  }

  /* ================= properties ================= */
  function sec(label, body, extra = '') { return `<section class="pp-sec"><div class="pp-label">${label}${extra}</div>${body}</section>`; }
  const tgl = (label, on, sub = '') => `<div class="tgl"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><button class="sw-t ${on ? 'on' : ''}"></button></div>`;
  const fld = (inner, cls = '') => `<label class="field ${cls}">${inner}</label>`;
  const sel = (opts, v) => `<select>${opts.map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>${ic('down', 'sm')}`;
  const BG = { intro: '0A0C0B', stat: 'F3F0E8', habits: '0E1712', recap: 'A8E07F', phish: '111318', blank: '0F1011' };
  function geoSec(el) {
    const g = readGeo(el), box = isBox(el);
    const f = (k, v, dis) => fld(`<span class="unit">${k.toUpperCase()}</span><input data-geo="${k}" value="${Math.round(v)}" ${dis ? 'disabled title="Auto for text — drag a side handle to set width"' : ''}>`);
    return sec('Position & size', `<div class="row">${f('x', g.x)}${f('y', g.y)}</div><div class="row">${f('w', g.w)}${f('h', g.h, !box)}</div>
      <div class="iseg act"><button data-center="h" title="Center horizontally">${ic('center-h')}</button><button data-center="v" title="Center vertically">${ic('center-v')}</button><button data-z="front" title="Bring to front ( ] )">${ic('front')}</button><button data-z="back" title="Send to back ( [ )">${ic('back')}</button></div>`,
      state.geo[el.dataset.el] ? `<button class="btn ghost sm" data-act="reset-geo" style="height:22px;padding:0 6px;font-size:11.5px">Reset</button>` : '');
  }
  function renderProps() {
    const el = canvasEl(state.sel), sc = cur();
    let h;
    if (!el) {
      h = `<div class="pp-head"><span class="ic">${ic('scenes')}</span><div><b>Scene ${state.scene + 1}</b><small>${esc(sc.name)} · ${fmt(dur(sc))}</small></div></div>
        ${sec('Layout', `<button class="btn w100" data-toast="Layout picker">${ic('refresh', 'sm')}Replace layout</button>`)}
        ${sec('Background', fld(`<span class="sw" style="background:#${BG[sc.type]}"></span><input value="${BG[sc.type]}"><span class="unit">100%</span>`) + tgl('Background media', false) )}
        ${sec('Audio', tgl('Music', false, 'Adds a soft bed under the voice') + tgl('Avatar voice', true, AV[state.avatar].name + ' · ' + (state.lang === 'tr' ? 'Turkish' : 'English')))}
        ${sec('Transition', `<div class="row">${fld(sel(['Cut', 'Fade', 'Slide', 'Zoom'], 'Fade'))}${fld(`<input value="0.4"><span class="unit">s</span>`)}</div>`)}
        <div class="ai-hint">${ic('sparkles')}<div>Tip: click anything on the canvas to edit it, or ask the assistant — it always knows which scene you’re on.<br><button data-tab-go="assistant">Open assistant →</button></div></div>`;
    } else if (el.dataset.type === 'text') {
      const cs = getComputedStyle(el), size = Math.round(parseFloat(cs.fontSize));
      const rgb = cs.color.match(/\d+/g).slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('').toUpperCase();
      h = `<div class="pp-head"><span class="ic">${ic('type')}</span><div><b>${esc(el.dataset.name)}</b><small>Text · Scene ${state.scene + 1}</small></div><span class="grow"></span><button class="ib sm" title="Lock">${ic('lock')}</button></div>
        ${sec('Text', `${fld(sel(['Instrument Sans', 'Inter', 'Fraunces', 'JetBrains Mono'], 'Instrument Sans'))}
          <div class="row">${fld(sel(['Regular', 'Medium', 'Semibold', 'Bold'], 'Medium'))}${fld(`<input data-geo="fs" value="${size}"><span class="unit">px</span>`)}</div>
          <div class="row"><div class="iseg"><button class="on">${ic('al')}</button><button>${ic('ac')}</button><button>${ic('ar')}</button></div>
            ${fld(`<span class="unit">↕</span><input value="1.1">`)}</div>
          ${fld(`<span class="sw" style="background:#${rgb}"></span><input value="${rgb}"><span class="unit">100%</span>`)}`)}
        ${sec('Layer', `<div class="row"><input type="range" value="100" style="--v:100%"><span style="flex:0 0 38px;text-align:right;font-weight:500">100%</span></div>`, `<span class="muted">Opacity</span>`)}
        ${geoSec(el)}
        ${sec('Effects', tgl('Stroke', false) + tgl('Shadow', false))}
        ${sec('Animation', `<div class="anim"><div class="anim-h">${ic('enter', 'sm')}<b>Enter</b><span class="at">at “Welcome”</span></div><div class="anim-b">Move in from bottom${ic('down', 'sm muted')}</div></div>
          <div class="anim"><div class="anim-h">${ic('exit', 'sm')}<b>Exit</b><span class="at">at end</span></div><div class="anim-b">Instant${ic('down', 'sm muted')}</div></div>
          <button class="btn ghost sm" style="justify-self:start" data-toast="Pick an animation from Motion">${ic('plus', 'sm')}Add animation</button>`)}`;
    } else if (el.dataset.type === 'avatar') {
      const av = AV[state.avatar];
      h = `<div class="pp-head"><span class="ic">${ic('user')}</span><div><b>Avatar</b><small>Presenter · Scene ${state.scene + 1}</small></div></div>
        ${sec('Presenter', `<div class="av-mini"><div class="ph2">${avatarSVG(av)}</div><div><b>${av.name}</b><small>${av.meta}</small></div><span class="grow"></span><button class="btn sm" data-act="avatars">Change</button></div>`)}
        ${geoSec(el)}
        ${sec('Voice', `${fld(sel([av.name + ' · Natural', av.name + ' · Energetic', av.name + ' · Calm'], av.name + ' · Natural'))}
          <div class="row"><span class="muted" style="flex:0 0 44px">Speed</span><input type="range" value="50" style="--v:50%"><span style="flex:0 0 34px;text-align:right;font-weight:500">1.0×</span></div>`)}
        ${sec('Framing', `<div class="iseg"><button class="on">Full</button><button>Circle</button><button>Voice only</button></div>`)}
        ${sec('Behaviour', tgl('Natural gestures', true) + tgl('Look at camera', true))}`;
    } else {
      h = `<div class="pp-head"><span class="ic">${ic('image')}</span><div><b>${esc(el.dataset.name)}</b><small>Graphic · Scene ${state.scene + 1}</small></div></div>
        ${sec('Source', `<button class="btn w100" data-toast="Pick a replacement from Media">${ic('refresh', 'sm')}Replace</button>`)}
        ${geoSec(el)}
        ${sec('Layer', `<div class="row"><input type="range" value="100" style="--v:100%"><span style="flex:0 0 38px;text-align:right;font-weight:500">100%</span></div>`, `<span class="muted">Opacity</span>`)}`;
    }
    $('#props').innerHTML = h;
  }
  function setTab(t) {
    state.tab = t;
    $$('#rtabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    $$('.pane').forEach(p => p.hidden = p.dataset.pane !== t);
    if (t === 'props') renderProps();
  }

  /* ================= chat ================= */
  const msgs = () => $('#msgs');
  function scrollChat() { const m = msgs(); m.scrollTop = m.scrollHeight; }
  function aiWho(time) { const d = new Date(); time = time || `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; return `<div class="ai-who"><span class="orb">${ic('sparkles')}</span>Assistant<span class="muted">${time}</span></div>`; }
  function addUser(text, att) {
    $('.empty', msgs())?.remove();
    msgs().insertAdjacentHTML('beforeend', userHTML(text, att));
    scrollChat();
  }
  function md(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>'); }
  function cardHTML(c) {
    const list = c.rows ? `<ul class="card-list">${c.rows.map(r => `<li class="${r.go != null ? 'go' : ''}" ${r.go != null ? `data-go="${r.go}"` : ''}>${ic('check')}<span>${esc(r.l)}</span><span>${esc(r.r || '')}</span></li>`).join('')}</ul>` : '';
    const diff = c.diff ? `<div class="diff"><span class="lab">Before</span><span class="old">${esc(c.diff[0])}</span><span class="lab">After</span><span class="new">${esc(c.diff[1])}</span></div>` : '';
    return `<div class="card" ${c.id ? `data-card="${c.id}"` : ''}><div class="card-h"><span class="ic">${ic(c.icon || 'wand')}</span>${esc(c.title)}<span class="meta">${esc(c.meta || '')}</span></div>${list}${diff}
      <div class="card-f"><button class="btn sm" data-undo>${ic('undo', 'sm')}Undo</button><button class="btn ghost sm" data-review>Review</button></div></div>`;
  }
  const cards = {};
  async function addAI(text, card, opts = {}) {
    const wrap = document.createElement('div'); wrap.className = 'm-ai';
    wrap.innerHTML = aiWho() + `<div class="ai-text"></div>`;
    msgs().appendChild(wrap);
    const tx = wrap.querySelector('.ai-text');
    if (opts.instant) tx.innerHTML = md(text);
    else {
      const w = text.split(/(\s+)/); let acc = '';
      for (let i = 0; i < w.length; i++) { acc += w[i]; if (i % 2 === 0) { tx.innerHTML = md(acc); scrollChat(); await wait(14 + Math.random() * 16); } }
      tx.innerHTML = md(text);
    }
    if (card) { wrap.insertAdjacentHTML('beforeend', cardHTML(card)); }
    if (opts.html) wrap.insertAdjacentHTML('beforeend', opts.html);
    if (opts.after) wrap.insertAdjacentHTML('beforeend', `<div class="ai-text">${md(opts.after)}</div>`);
    wrap.insertAdjacentHTML('beforeend', actsHTML());
    scrollChat();
  }
  function addThinking() {
    const w = document.createElement('div'); w.className = 'm-ai';
    w.innerHTML = aiWho() + `<div class="steps"></div><div class="think"><span class="spin"></span><span class="txt"></span></div>`;
    msgs().appendChild(w); scrollChat();
    return {
      set(t) {
        const cur = w.querySelector('.think .txt');
        if (cur.textContent) w.querySelector('.steps').insertAdjacentHTML('beforeend', `<div>${ic('check')}${esc(cur.textContent)}</div>`);
        cur.textContent = t; scrollChat();
      },
      remove() { w.remove(); }
    };
  }

  function renderCtx() {
    const el = canvasEl(state.sel);
    $('#ctx').innerHTML = `<span class="chip">${ic('scenes')}Scene ${state.scene + 1}</span>` +
      (el ? `<span class="chip focus">${ic(el.dataset.type === 'text' ? 'type' : el.dataset.type === 'avatar' ? 'user' : 'image')}${esc(el.dataset.name)}<button data-act="desel" title="Remove">${ic('x', 'sm')}</button></span>` : '');
    $('#prompt').placeholder = el ? `Ask AI to change the ${el.dataset.name.split(' ·')[0].toLowerCase()}…` : `Ask AI to write, edit or generate…`;
  }
  function renderSugg() {
    const el = canvasEl(state.sel);
    const s = el && el.dataset.type === 'text'
      ? ['Make it punchier', 'Try another version', 'Translate the video to Turkish']
      : el && el.dataset.type === 'avatar' ? ['Switch to a female presenter', 'Make the voice more energetic']
      : [state.lang === 'en' ? 'Translate to Turkish' : 'Translate back to English', 'Shorten this scene', 'Plan a 60s vertical phishing video'];
    $('#sugg').innerHTML = s.map(t => `<button data-ai="${esc(t)}">${ic('sparkles')}${esc(t)}</button>`).join('');
  }

  let busy = false;
  function setBusy(b) {
    busy = b;
    const send = $('#send');
    send.innerHTML = ic(b ? 'stop' : 'up'); send.disabled = !b && !$('#prompt').value.trim();
    $('#sugg').style.display = b ? 'none' : '';
  }
  function flashEl(key) {
    requestAnimationFrame(() => { const e = canvasEl(key); if (e) { e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); } });
  }

  function plan(q) {
    const s = q.toLowerCase(), sc = cur(), el = canvasEl(state.sel);
    if (/translat|turk|türk|çevir|english|ingilizce/.test(s)) {
      const to = state.lang === 'en' ? 'tr' : 'en', L = to === 'tr' ? 'Turkish' : 'English';
      return {
        steps: [`Reading ${state.scenes.length} scenes`, `Translating script to ${L}`, `Switching ${AV[state.avatar].name}’s voice to ${to === 'tr' ? 'tr-TR' : 'en-US'}`],
        apply() {
          state.lang = to;
          state.scenes.forEach(x => { if (!state.scripts[to][x.id]) state.scripts[to][x.id] = x.type === 'phish' ? clone(PHISH_SCRIPT[to]) : ['']; });
          requestAnimationFrame(() => { const l = $('#voiceLang'); l.classList.add('flash'); setTimeout(() => l.classList.remove('flash'), 900); });
          return {
            text: `Translated all ${state.scenes.length} scenes to **${L}** and switched ${AV[state.avatar].name}’s voice to *${to === 'tr' ? 'tr-TR' : 'en-US'}*. Pacing stays close to the original, so your animation cues still line up.`,
            card: { icon: 'globe', title: 'Translated script', meta: to === 'tr' ? 'EN → TR' : 'TR → EN', rows: state.scenes.map((x, i) => ({ l: `Scene ${i + 1} · ${x.name}`, r: fmt(dur(x)), go: i })) },
          };
        }
      };
    }
    if (/short|kısa|kisalt|trim|concise/.test(s)) {
      const before = dur(sc);
      return {
        steps: [`Reading Scene ${state.scene + 1} script`, 'Cutting filler and repeated ideas', 'Re-timing animation cues'],
        apply() {
          const L = state.lang, curS = state.scripts[L][sc.id] || [''], short = SHORT[L][sc.id];
          if (short && JSON.stringify(short) !== JSON.stringify(curS)) state.scripts[L][sc.id] = clone(short);
          else {
            const txt = curS.filter(p => typeof p === 'string').join('').trim();
            const sent = txt.match(/[^.!?]+[.!?]+/g) || [txt];
            if (sent.length < 2) return { text: `Scene ${state.scene + 1} is already about as tight as it gets — one sentence, ${fmt(before)}. Want me to cut words from another scene instead?` };
            state.scripts[L][sc.id] = [...curS.filter(p => typeof p !== 'string').slice(0, 1), sent.slice(0, Math.max(1, sent.length - 1)).join('').trim()];
          }
          return {
            text: `Trimmed Scene ${state.scene + 1} from **${fmt(before)}** to **${fmt(dur(sc))}**. The key message and the animation cues are intact.`,
            card: { icon: 'wand', title: `Shortened Scene ${state.scene + 1}`, meta: `${fmt(before)} → ${fmt(dur(sc))}`, rows: [{ l: 'Removed filler & repeated ideas' }, { l: 'Kept animation cues in place' }] },
          };
        }
      };
    }
    if (/phish|scene|sahne|quiz|add|ekle/.test(s) && !(el && /punch|version|rewrite/.test(s))) {
      return {
        steps: ['Planning a practice scene', 'Writing script', 'Building layout from the Secure template'],
        apply() {
          const id = 's' + state.nextId++, at = state.scene + 1;
          state.scenes.splice(at, 0, { id, type: 'phish', name: 'Spot the phish' });
          state.scripts.en[id] = clone(PHISH_SCRIPT.en); state.scripts.tr[id] = clone(PHISH_SCRIPT.tr);
          state.scene = at; state.t = startOf(at);
          return {
            text: `Added a practice scene after Scene ${at}. It shows a realistic phishing email with **three red flags** — viewers get a moment to spot them before the answers appear.`,
            card: { icon: 'plus', title: `Added Scene ${at + 1}`, meta: 'Spot the phish', rows: [{ l: 'Layout · email mock + 3 red flags' }, { l: `Script · ${state.lang === 'tr' ? 'Turkish' : 'English'}`, r: fmt(dur(state.scenes[at])) }, { l: 'Voice · ' + AV[state.avatar].name }] },
            flash: `${id}-mail`,
          };
        }
      };
    }
    if (el && el.dataset.type === 'avatar') {
      return {
        steps: ['Browsing presenters', 'Matching voice & tone'],
        apply() {
          state.avatar = AV[state.avatar].long ? 2 : 1;
          return { text: `Switched the presenter to **${AV[state.avatar].name}** across all scenes. The voice was re-matched to keep the same pace.`, card: { icon: 'user', title: 'Changed presenter', meta: AV[state.avatar].name, rows: state.scenes.map((x, i) => ({ l: `Scene ${i + 1} · ${x.name}`, go: i })) }, flash: `${sc.id}-av` };
        }
      };
    }
    // rewrite selected text element, or the scene’s primary text
    const key = el && el.dataset.type === 'text' ? el.dataset.key : PRIMARY[sc.type];
    const name = NAMES[key];
    return {
      steps: [`Reading ${name.toLowerCase()} on Scene ${state.scene + 1}`, 'Drafting three options', 'Applying the strongest one'],
      apply() {
        const ak = `${sc.type}-${key}`, opts = ALT[ak] || [T(sc, key)];
        const n = state.alt[ak] = ((state.alt[ak] ?? -1) + 1) % opts.length;
        const old = T(sc, key); state.texts[`${sc.id}-${key}`] = opts[n];
        return {
          text: `Here’s a punchier ${name.toLowerCase()} — shorter, with a clearer rhythm. Ask for another version if it’s not quite right.`,
          card: { icon: 'wand', title: `Updated ${name}`, meta: `Scene ${state.scene + 1}`, diff: [strip(old), strip(opts[n])] },
          flash: `${sc.id}-${key}`,
        };
      }
    };
  }

  async function runAI(q) {
    q = q.trim(); if (!q || busy) return;
    if (state.tab !== 'assistant') setTab('assistant');
    if ($('#app').classList.contains('no-right')) toggleRight(); setBusy(true);
    addUser(q);
    const cv = conv(activeConv);
    if (cv && cv.title === 'New chat') { cv.title = q.length > 42 ? q.slice(0, 40) + '…' : q; setChatTitle(); }
    $('#prompt').value = ''; autoGrow();
    const p = plan(q), th = addThinking();
    for (const st of p.steps) { th.set(st); await wait(620 + Math.random() * 300); }
    th.remove();
    const before = snap();
    const res = p.apply();
    if (res.card) {
      pushHist(before);
      const id = 'c' + Date.now(); res.card.id = id; cards[id] = { before, after: snap() };
      renderAll();
      if (res.flash) flashEl(res.flash);
    }
    await addAI(res.text, res.card, { html: res.html });
    setBusy(false);
    if (res.after) res.after();
  }

  function emptyState() {
    msgs().innerHTML = `<div class="empty"><div class="big">${ic('sparkles')}</div><h3>What are we making?</h3><p>Describe a change, drop in a doc, or start from one of these.</p>
      <div class="tiles">
        <button class="tile" data-ai="Plan a 60-second vertical video about phishing">${ic('file')}<b>Plan a new video</b><small>Strategy, subjects and a shot script to approve</small></button>
        <button class="tile" data-ai="Translate the video to Turkish">${ic('globe')}<b>Translate video</b><small>Script, voice and captions</small></button>
        <button class="tile" data-ai="Rewrite the sub-headline so it’s punchier">${ic('wand')}<b>Polish the copy</b><small>Tighter headlines and script</small></button>
        <button class="tile" data-ai="Shorten this scene">${ic('clock')}<b>Make it shorter</b><small>Keep the message, lose the filler</small></button>
      </div></div>`;
  }
  function seedChat() {
    msgs().innerHTML = `<div class="day">Today</div>`;
    addUser('Turn this security memo into a short training video for the team. Friendly tone, under 45 seconds.', ['Security_memo_Q3.pdf', 'PDF · 2 pages']);
    addAI(`Done — I drafted **${state.scenes.length} scenes (${fmt(total())})** from your memo using the *Secure* template, with ${AV[state.avatar].name} presenting. I kept the tone friendly and direct.`,
      { icon: 'scenes', title: `Created ${state.scenes.length} scenes`, meta: fmt(total()), rows: state.scenes.map((x, i) => ({ l: `${i + 1} · ${x.name}`, r: fmt(dur(x)), go: i })) },
      { instant: true, after: 'Want me to translate it, or add a practice scene where viewers spot a phishing email?' });
    $('[data-card]', msgs())?.setAttribute('data-card', 'seed');
  }

  /* ================= conversations ================= */
  const userHTML = (text, att) => `<div class="m-user">${att ? `<div class="att"><span class="fi">${ic('file', 'sm')}</span><span><b>${esc(att[0])}</b><small>${esc(att[1])}</small></span></div>` : ''}<div class="bubble">${esc(text)}</div></div>`;
  const actsHTML = () => `<div class="ai-acts"><button class="ib xs" title="Copy" data-toast="Copied">${ic('copy', 'sm')}</button><button class="ib xs" title="Good response" data-toast="Thanks for the feedback">${ic('thumb', 'sm')}</button></div>`;
  const aiHTML = (text, card, after, time) => `<div class="m-ai">${aiWho(time)}<div class="ai-text">${md(text)}</div>${card ? cardHTML(card) : ''}${after ? `<div class="ai-text">${md(after)}</div>` : ''}${actsHTML()}</div>`;
  const CONVS = [
    { id: 'now', title: 'Memo → training video', group: 'Today', time: 'Now', html: '' },
    { id: 'c2', title: 'Welcome script for sales hires', group: 'Yesterday', time: '4:12 PM', msgs: [
      ['u', 'Write a 30-second welcome script for new hires on the sales team.'],
      ['a', 'Here’s a warm, four-beat welcome (≈28s). I kept product names out so it works in every region.', { icon: 'file', title: 'Draft script', meta: '0:28', rows: [{ l: 'Hook · first-day energy' }, { l: 'Who we are, in one line' }, { l: 'What week one looks like' }, { l: 'Where to get help' }] }, 'Want a version with a quick team-intro montage?', '16:12'],
      ['u', 'Make the hook less formal.'],
      ['a', 'Swapped the opener. Everything after it stays the same.', { icon: 'wand', title: 'Updated hook', meta: 'Scene 1', diff: ['Welcome to the Northwind sales organization.', 'Hey — welcome aboard. Let’s make your first week easy.'] }, '', '16:14'],
    ] },
    { id: 'c3', title: 'Translate Q2 compliance to German', group: 'Previous 7 days', time: 'Mon', msgs: [
      ['u', 'Translate the Q2 compliance video to German, but keep legal terms in English.'],
      ['a', 'Translated all 6 scenes to **German** and switched the voice to *de-DE*. 14 legal terms stayed in English and are highlighted in the script for your reviewer.', { icon: 'globe', title: 'Translated script', meta: 'EN → DE', rows: [{ l: 'Scene 1 · Why compliance', r: '0:09' }, { l: 'Scene 2 · Gifts & hospitality', r: '0:14' }, { l: 'Scene 3 · Reporting', r: '0:11' }, { l: '+ 3 more scenes' }] }, '', '11:02'],
    ] },
    { id: 'c4', title: 'Phishing quiz questions', group: 'Previous 7 days', time: 'Sep 18', msgs: [
      ['u', 'Give me 3 quiz questions about phishing for the end of the video.'],
      ['a', '1. An email says your password expires in an hour. What’s the first thing you check?\n2. Which sender is fake: it@northwind.com or it@northwlnd-help.co?\n3. You clicked a suspicious link. Who do you tell — and how fast?', null, 'I can turn these into an interactive quiz scene if you like.', '09:40'],
    ] },
    { id: 'c5', title: 'Brand colors for the intro', group: 'Older', time: 'Sep 2', msgs: [
      ['u', 'Use our brand green for the highlight words in the intro.'],
      ['a', 'Done — highlight words now use **#A8E07F** from your brand kit. Contrast on the dark background is 12.4:1, so it passes WCAG AAA.', { icon: 'palette', title: 'Applied brand color', meta: 'Scene 1', rows: [{ l: 'Headline · 2 words' }, { l: 'Saved to brand kit' }] }, '', '14:25'],
    ] },
  ];
  let activeConv = 'now';
  const conv = id => CONVS.find(c => c.id === id);
  function buildConv(c) {
    if (c.html != null) return;
    c.html = `<div class="day">${c.group === 'Today' || c.group === 'Yesterday' ? c.group : c.time}</div>` +
      c.msgs.map(m => m[0] === 'u' ? userHTML(m[1]) : aiHTML(m[1], m[2], m[3], m[4])).join('');
  }
  function saveConv() { const c = conv(activeConv); if (!c) return; c.html = msgs().innerHTML; c.snip = $('.m-user .bubble', msgs())?.textContent || ''; }
  function setChatTitle() { $('#chatTitleTxt').textContent = conv(activeConv)?.title || 'New chat'; }
  function showConv(c) { buildConv(c); msgs().innerHTML = c.html; if (!$('.m-user, .m-ai', msgs())) emptyState(); scrollChat(); }
  function openConv(id) {
    if (busy) { toast('Wait for the assistant to finish'); return; }
    if (id !== activeConv) { saveConv(); activeConv = id; showConv(conv(id)); }
    setChatTitle(); closeHist(); setTab('assistant');
  }
  function newChat() {
    if (busy) { toast('Wait for the assistant to finish'); return; }
    closeHist(); setTab('assistant');
    if (!$('.m-user', msgs())) { prompt.focus(); return; }
    saveConv();
    const c = { id: 'n' + Date.now(), title: 'New chat', group: 'Today', time: 'Now', html: '' };
    CONVS.unshift(c); activeConv = c.id; emptyState(); setChatTitle(); prompt.focus();
  }
  function openHist() { saveConv(); $('#hist').hidden = false; $('#histSearch').value = ''; renderHist(); setTimeout(() => $('#histSearch').focus(), 60); }
  function closeHist() { $('#hist').hidden = true; }
  function renderHist() {
    const q = $('#histSearch').value.trim().toLowerCase();
    const snipOf = c => c.snip ?? c.msgs?.find(m => m[0] === 'u')?.[1] ?? '';
    const list = CONVS.filter(c => !q || c.title.toLowerCase().includes(q) || snipOf(c).toLowerCase().includes(q));
    let out = '', g = '';
    list.forEach(c => {
      if (c.group !== g) { g = c.group; out += `<div class="hist-group">${g}</div>`; }
      out += `<div class="h-item ${c.id === activeConv ? 'on' : ''}" data-conv="${c.id}" role="button" tabindex="0">
        <span class="h-ic">${ic('chat', 'sm')}</span>
        <span class="h-main"><b>${esc(c.title)}</b><small>${esc(snipOf(c) || 'No messages yet')}</small></span>
        <span class="h-time">${esc(c.time)}</span>
        <button class="ib xs h-del" data-conv-del="${c.id}" title="Delete chat">${ic('trash', 'sm')}</button></div>`;
    });
    $('#histList').innerHTML = out || `<div class="hist-empty">No chats match “${esc(q)}”</div>`;
  }
  function deleteConv(id) {
    const i = CONVS.findIndex(c => c.id === id); if (i < 0) return;
    CONVS.splice(i, 1);
    if (id === activeConv) {
      if (!CONVS.length) CONVS.push({ id: 'n' + Date.now(), title: 'New chat', group: 'Today', time: 'Now', html: '' });
      activeConv = CONVS[0].id; showConv(CONVS[0]); setChatTitle();
    }
    renderHist(); toast('Chat deleted');
  }
  function focusAsk() {
    setTab('assistant'); closeHist();
    if ($('#app').classList.contains('no-right')) toggleRight();
    prompt.focus();
  }

  /* ================= preview player ================= */
  const playerOpen = () => !$('#player').hidden;
  function openPlayer() {
    closeMenu(); select(null);
    $('#player').hidden = false;
    if (state.t >= total() - 0.05) state.t = 0;
    const idx = sceneAt(state.t); if (idx !== state.scene) goScene(idx, false);
    renderPlayer(); layoutPlayer(); setPlaying(true);
  }
  function closePlayer() { setPlaying(false); $('#player').hidden = true; }
  function layoutPlayer() {
    if (!playerOpen()) return;
    const st = $('#plStage'), s = Math.min((st.clientWidth - 48) / 1280, (st.clientHeight - 8) / 720);
    $('#plFrame').style.width = 1280 * s + 'px'; $('#plFrame').style.height = 720 * s + 'px';
    $('#plRoot').style.transform = `scale(${s})`;
  }
  function renderPlayer() {
    if (!playerOpen()) return;
    const root = $('#plRoot'); root.innerHTML = sceneHTML(cur()); applyGeo(root);
    $('#plTitle').textContent = $('#title').value;
    $('#plScene').textContent = `Scene ${state.scene + 1} of ${state.scenes.length} · ${cur().name}`;
    $('#plLang').textContent = state.lang === 'tr' ? 'Türkçe' : 'English';
    $('#plProg').innerHTML = state.scenes.map(s => `<div class="pseg" style="flex:${dur(s)} 1 0"><i></i></div>`).join('');
    updPlayer();
  }
  function updPlayer() {
    if (!playerOpen()) return;
    let a = 0;
    $$('#plProg .pseg i').forEach((b, i) => { const d = dur(state.scenes[i]); b.style.width = Math.max(0, Math.min(1, (state.t - a) / d)) * 100 + '%'; a += d; });
    $('#plTime').textContent = `${fmt(state.t)} / ${fmt(total())}`;
    const sc = cur(), txt = scriptOf(sc).filter(p => typeof p === 'string').join('').trim();
    const sents = txt.match(/[^.!?]+[.!?]*/g) || [];
    const f = (state.t - startOf(state.scene)) / dur(sc), len = sents.reduce((n, s) => n + s.length, 0) || 1;
    let acc = 0, line = '';
    for (const s of sents) { acc += s.length; line = s; if (acc / len >= f) break; }
    $('#plCap').textContent = line.trim();
  }

  /* ================= navigation ================= */
  function goScene(i, setT = true) {
    state.scene = Math.max(0, Math.min(state.scenes.length - 1, i));
    if (setT) state.t = startOf(state.scene);
    state.sel = null; $('#ftb').dataset.for = '';
    $('#rtabs').classList.remove('has-sel');
    renderCanvas(); renderScript(); renderTrack(); renderCtx(); renderSugg();
    if (state.tab === 'props') renderProps();
    $$('.scene-item').forEach(n => n.classList.toggle('on', +n.dataset.i === state.scene));
    $('.scene-item.on')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function renderAll() { renderCanvas(); renderScript(); renderTrack(); renderCtx(); renderSugg(); renderProps(); if (state.tool === 'scenes' || state.tool === 'avatar') renderDrawer(); $('#rtabs').classList.toggle('has-sel', !!state.sel); }
  function toggleRight() { const a = $('#app'); a.classList.toggle('no-right'); $('#toggleRight').classList.toggle('on', !a.classList.contains('no-right')); }
  function addScene(at = state.scene + 1, from) {
    const before = snap(), id = 's' + state.nextId++;
    const sc = from ? { ...from, id, name: from.name + ' copy' } : { id, type: 'blank', name: 'Untitled scene' };
    state.scenes.splice(at, 0, sc);
    if (from) { Object.keys(state.texts).forEach(k => { if (k.startsWith(from.id + '-')) state.texts[id + k.slice(from.id.length)] = state.texts[k]; }); ['en', 'tr'].forEach(L => state.scripts[L][id] = clone(state.scripts[L][from.id] || [''])); }
    else ['en', 'tr'].forEach(L => state.scripts[L][id] = [{ m: 'Headline' }, '']);
    pushHist(before); state.scene = at; state.t = startOf(at); renderAll();
  }

  /* ================= events ================= */
  on(document, 'click', e => {
    if (outside(e)) { closeMenu(); return; }
    const t = e.target;
    const mi = t.closest('#cmenu [data-m]'); if (mi) { menuAction(mi.dataset.m); return; }
    if (!t.closest('#cmenu')) closeMenu();
    const toastEl = t.closest('[data-toast]'); if (toastEl) { toast(toastEl.dataset.toast); }
    const ai = t.closest('[data-ai]'); if (ai) { runAI(ai.dataset.ai); return; }
    const tool = t.closest('[data-tool]'); if (tool) { setTool(tool.dataset.tool); return; }
    const tab = t.closest('#rtabs [data-tab]'); if (tab) { setTab(tab.dataset.tab); return; }
    const tabGo = t.closest('[data-tab-go]'); if (tabGo) { setTab(tabGo.dataset.tabGo); return; }
    const sw = t.closest('.sw-t'); if (sw) { sw.classList.toggle('on'); return; }
    const isb = t.closest('.iseg:not(.act) button, .seg:not(#rtabs) button, .src-row .src'); if (isb) { [...isb.parentNode.children].forEach(b => b.classList.toggle('on', b === isb)); }
    const cap = t.closest('.cap-tile'); if (cap) { $$('.cap-tile').forEach(c => c.classList.toggle('on', c === cap)); }
    if (t.closest('[data-close-modal]') || t.id === 'keys') { $('#keys').hidden = true; return; }
    const cd = t.closest('[data-conv-del]'); if (cd) { deleteConv(cd.dataset.convDel); return; }
    const cv = t.closest('[data-conv]'); if (cv) { openConv(cv.dataset.conv); return; }
    const ce = t.closest('[data-center]'); if (ce) { centerSel(ce.dataset.center); return; }
    const zb = t.closest('[data-z]'); if (zb) { zorder(zb.dataset.z === 'front'); return; }

    const actEl = t.closest('[data-act]'), act = actEl?.dataset.act;
    if (act === 'collapse') { $('#app').classList.add('no-drawer'); renderDrawer(); return; }
    if (act === 'add-scene') { addScene(); return; }
    if (act === 'desel') { select(null); return; }
    if (act === 'props') { setTab('props'); return; }
    if (act === 'reset-geo') { resetGeo(); return; }
    if (act === 'avatars') { state.tool = 'avatar'; $('#app').classList.remove('no-drawer'); renderDrawer(); return; }
    if (act === 'ask') { focusAsk(); return; }
    if (act === 'menu') { const r = actEl.getBoundingClientRect(), el = canvasEl(state.sel); if (el) openMenu(r.left, r.bottom + 6, el); return; }

    const dup = t.closest('[data-dup]'); if (dup) { e.stopPropagation(); addScene(+dup.dataset.dup + 1, state.scenes[+dup.dataset.dup]); toast('Scene duplicated'); return; }
    const del = t.closest('[data-del]'); if (del) {
      const i = +del.dataset.del, before = snap(); state.scenes.splice(i, 1);
      state.scene = Math.min(state.scene, state.scenes.length - 1); state.t = startOf(state.scene);
      pushHist(before); renderAll(); toast('Scene deleted — Ctrl+Z to undo'); return;
    }
    const si = t.closest('.scene-item'); if (si) { goScene(+si.dataset.i); return; }
    const seg = t.closest('.seg-b'); if (seg) { goScene(+seg.dataset.i); return; }
    const avc = t.closest('[data-av]'); if (avc) {
      const before = snap(); state.avatar = +avc.dataset.av; pushHist(before); renderAll(); flashEl(`${cur().id}-av`); return;
    }
    const go = t.closest('[data-go]'); if (go) { goScene(+go.dataset.go); return; }
    const und = t.closest('[data-undo]'); if (und) {
      const card = und.closest('.card'), c = cards[card.dataset.card];
      if (!c) { toast('This change is already part of your history'); return; }
      const reverted = card.classList.toggle('reverted');
      pushHist(snap()); restore(reverted ? c.before : c.after);
      und.innerHTML = reverted ? `${ic('redo', 'sm')}Redo` : `${ic('undo', 'sm')}Undo`;
      toast(reverted ? 'Change reverted' : 'Change re-applied'); return;
    }
    const rev = t.closest('[data-review]'); if (rev) { const f = rev.closest('.card').querySelector('[data-go]'); goScene(f ? +f.dataset.go : state.scene); toast('Showing changes on canvas'); return; }

    // canvas selection
    if (t.closest('#stage')) {
      if (justDragged || t.closest('#ftb') || t.closest('.stage-foot') || t.closest('#sel')) return;
      const el = t.closest('#scene .el');
      if (el && el.dataset.editing) return;
      select(el ? el.dataset.el : null);
    }
  });

  /* canvas: select + move, resize handles, edit, context menu */
  $('#scene').addEventListener('pointerdown', e => {
    if (e.button !== 0 || spaceDown) return;
    const el = e.target.closest('.el'); if (!el || el.dataset.editing) return;
    e.preventDefault(); closeMenu();
    select(el.dataset.el);
    beginDrag(e, el, 'move');
  });
  $('#sel').addEventListener('pointerdown', e => {
    const h = e.target.closest('i[data-h]'); if (!h || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const el = canvasEl(state.sel); if (el) beginDrag(e, el, 'resize', h.dataset.h);
  });
  $('#scene').addEventListener('dblclick', e => { const el = e.target.closest('.el'); if (el) { select(el.dataset.el); startEdit(el); } });
  $('#scene').addEventListener('contextmenu', e => {
    const el = e.target.closest('.el'); if (!el) return;
    e.preventDefault(); select(el.dataset.el); openMenu(e.clientX, e.clientY, el);
  });

  /* zoom + pan */
  const vp = $('#viewport');
  let spaceDown = false, spaceUsed = false;
  vp.addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault(); setZoom(scale * Math.exp(-e.deltaY * 0.0025), e.clientX, e.clientY);
  }, { passive: false });
  vp.addEventListener('scroll', () => { closeMenu(); positionSel(); });
  vp.addEventListener('pointerdown', e => {
    if (!(spaceDown || e.button === 1)) return;
    e.preventDefault(); e.stopPropagation(); spaceUsed = true;
    const sx = e.clientX, sy = e.clientY, sl = vp.scrollLeft, st = vp.scrollTop;
    $('#stage').classList.add('panning');
    const mv = ev => { vp.scrollLeft = sl - (ev.clientX - sx); vp.scrollTop = st - (ev.clientY - sy); };
    on(document, 'pointermove', mv);
    on(document, 'pointerup', () => {
      document.removeEventListener('pointermove', mv); $('#stage').classList.remove('panning');
      justDragged = true; setTimeout(() => justDragged = false, 0);
    }, { once: true });
  }, true);
  $('#zoomIn').onclick = () => zoomStep(1);
  $('#zoomOut').onclick = () => zoomStep(-1);
  $('#zoomLbl').onclick = () => setZoom(state.zoom === 'fit' ? 1 : 'fit');

  /* resizable panels */
  const prefs = {};
  function setRightW(w) {
    const app = $('#app');
    if (w == null) { delete prefs.rightW; app.style.removeProperty('--st-right-w'); return; }
    prefs.rightW = Math.round(Math.min(Math.max(w, 320), Math.max(320, Math.min(640, studioW() * 0.45))));
    app.style.setProperty('--st-right-w', prefs.rightW + 'px');
  }
  function setDockH(h) {
    const app = $('#app');
    if (h == null) { delete prefs.dockH; app.style.removeProperty('--st-dock-h'); return; }
    prefs.dockH = Math.round(Math.min(Math.max(h, 150), Math.max(150, studioH() - 320)));
    app.style.setProperty('--st-dock-h', prefs.dockH + 'px');
  }
  function savePrefs() { try { localStorage.setItem('studio-layout', JSON.stringify(prefs)); } catch (e) {} }
  function loadPrefs() { try { const p = JSON.parse(localStorage.getItem('studio-layout') || '{}'); if (p.rightW) setRightW(p.rightW); if (p.dockH) setDockH(p.dockH); } catch (e) {} }
  function makeResizer(h, start, apply, reset) {
    h.addEventListener('pointerdown', e => {
      e.preventDefault();
      const v0 = start(), x0 = e.clientX, y0 = e.clientY;
      h.setPointerCapture(e.pointerId); h.classList.add('on'); $('#app').classList.add('resizing');
      const mv = ev => apply(v0, ev.clientX - x0, ev.clientY - y0);
      h.addEventListener('pointermove', mv);
      h.addEventListener('pointerup', () => { h.removeEventListener('pointermove', mv); h.classList.remove('on'); $('#app').classList.remove('resizing'); savePrefs(); }, { once: true });
    });
    h.addEventListener('dblclick', () => { reset(); savePrefs(); });
  }
  makeResizer($('#rzRight'), () => $('.right').offsetWidth, (v0, dx) => setRightW(v0 - dx), () => setRightW(null));
  makeResizer($('#rzDock'), () => $('.dock').offsetHeight, (v0, dx, dy) => setDockH(v0 - dy), () => setDockH(null));

  /* theme */
  function updThemeIcon() {
    const dark = isDark();
    $('#themeBtn').innerHTML = ic(dark ? 'sun' : 'moon');
    $('#themeBtn').title = (dark ? 'Light mode' : 'Dark mode') + ' (Shift D)';
  }
  function setTheme(t) {
    if (opts.setTheme) opts.setTheme(t); else document.documentElement.classList.toggle('dark', t === 'dark');
    setTimeout(updThemeIcon, 0);
  }
  $('#themeBtn').onclick = () => setTheme(isDark() ? 'light' : 'dark');

  /* scenes: drag to reorder */
  let dragFrom = null;
  const clearDrop = () => $$('.scene-item').forEach(n => n.classList.remove('drop-before', 'drop-after', 'dragging'));
  $('#drawer').addEventListener('dragstart', e => {
    const it = e.target.closest('.scene-item'); if (!it) return;
    dragFrom = +it.dataset.i; it.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(dragFrom));
  });
  $('#drawer').addEventListener('dragover', e => {
    if (dragFrom == null) return;
    const it = e.target.closest('.scene-item'); if (!it) return;
    e.preventDefault();
    $$('.scene-item').forEach(n => n.classList.remove('drop-before', 'drop-after'));
    const r = it.getBoundingClientRect();
    it.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
  });
  $('#drawer').addEventListener('drop', e => {
    const it = e.target.closest('.scene-item'); if (dragFrom == null || !it) return;
    e.preventDefault();
    let to = +it.dataset.i + (it.classList.contains('drop-after') ? 1 : 0);
    if (dragFrom < to) to--;
    const from = dragFrom; dragFrom = null; clearDrop();
    if (to === from) return;
    const curId = cur().id, before = snap();
    const [m] = state.scenes.splice(from, 1); state.scenes.splice(to, 0, m);
    state.scene = state.scenes.findIndex(s => s.id === curId); state.t = startOf(state.scene);
    pushHist(before); renderAll(); toast(`Moved “${m.name}” to position ${to + 1}`);
  });
  $('#drawer').addEventListener('dragend', () => { dragFrom = null; clearDrop(); });

  /* properties: numeric position & size */
  $('#props').addEventListener('change', e => {
    const inp = e.target.closest('[data-geo]'); if (!inp) return;
    const el = canvasEl(state.sel), v = parseFloat(inp.value); if (!el || isNaN(v)) return;
    const k = inp.dataset.geo, before = snap(), p = { [k]: Math.round(v * 10) / 10 };
    if (k === 'w' && !isBox(el)) p.wrap = true;
    setGeo(state.sel, p); applyGeoEl(el); pushHist(before);
    $('#ftb').dataset.for = ''; positionSel(); renderScenes(); renderProps();
  });

  /* timeline */
  $('#track').addEventListener('pointerdown', e => {
    const tr = $('#track'), move = ev => { const r = tr.getBoundingClientRect(); seek((ev.clientX - r.left) / r.width * total()); };
    move(e); tr.setPointerCapture(e.pointerId);
    tr.onpointermove = move; tr.onpointerup = () => { tr.onpointermove = null; };
  });
  $('#play').onclick = () => setPlaying(!state.playing);
  $('#undo').onclick = undo; $('#redo').onclick = redo;
  $('#toggleRight').onclick = toggleRight;
  $('#closeRight').onclick = toggleRight;
  $('#voice').onclick = () => { state.tool = 'avatar'; $('#app').classList.remove('no-drawer'); renderDrawer(); };
  $('#mode').onclick = () => { const s = $('#mode span'); const on = s.textContent === 'Auto-apply'; s.textContent = on ? 'Ask first' : 'Auto-apply'; toast(on ? 'AI will propose changes before applying' : 'AI will apply changes directly'); };
  $('#mention').onclick = () => { const p = $('#prompt'); p.value += (p.value && !p.value.endsWith(' ') ? ' ' : '') + '@Scene ' + (state.scene + 1) + ' '; p.focus(); autoGrow(); };
  $('#helpBtn').onclick = () => $('#keys').hidden = false;

  /* chat history */
  $('#chatTitle').onclick = openHist;
  $('#histBtn').onclick = openHist;
  $('#histBack').onclick = closeHist;
  $('#histNew').onclick = newChat;
  $('#newChat').onclick = newChat;
  $('#histSearch').addEventListener('input', renderHist);
  $('#histList').addEventListener('keydown', e => { const it = e.target.closest('[data-conv]'); if (it && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openConv(it.dataset.conv); } });

  /* player */
  $('#previewBtn').onclick = openPlayer;
  $('#plClose').onclick = closePlayer;
  $('#plPlay').onclick = () => setPlaying(!state.playing);
  $('#plCC').onclick = () => { $('#plCC').classList.toggle('on'); $('#plCap').classList.toggle('off'); };
  $('#plProg').addEventListener('pointerdown', e => { const r = $('#plProg').getBoundingClientRect(); seek((e.clientX - r.left) / r.width * total()); updPlayer(); });

  let scriptBefore = null;
  $('#script').addEventListener('focus', () => scriptBefore = snap());
  $('#script').addEventListener('input', () => { readScript(); renderDur(); renderTrack(); });
  $('#script').addEventListener('blur', () => { if (scriptBefore && scriptBefore !== snap()) { pushHist(scriptBefore); renderScenes(); } scriptBefore = null; });

  const prompt = $('#prompt');
  function autoGrow() { prompt.style.height = 'auto'; prompt.style.height = Math.min(160, prompt.scrollHeight) + 'px'; $('#send').disabled = !busy && !prompt.value.trim(); }
  prompt.addEventListener('input', autoGrow);
  prompt.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runAI(prompt.value); } });
  $('#send').onclick = () => busy ? toast('Stopped') : runAI(prompt.value);

  /* keyboard */
  on(document, 'keydown', e => { if (outside(e)) return;
    const typing = e.target.closest('input, textarea, select, [contenteditable=true]');
    const mod = e.ctrlKey || e.metaKey;
    if (playerOpen()) {
      if (e.key === 'Escape') closePlayer();
      else if (e.code === 'Space') { e.preventDefault(); setPlaying(!state.playing); }
      else if (e.key.toLowerCase() === 'c') $('#plCC').click();
      else if (e.key === 'ArrowRight') { seek(state.t + 5); updPlayer(); }
      else if (e.key === 'ArrowLeft') { seek(state.t - 5); updPlayer(); }
      return;
    }
    if (e.key === 'Escape') {
      if ($('#cmenu')) { closeMenu(); return; }
      if (!$('#keys').hidden) { $('#keys').hidden = true; return; }
      if (!$('#hist').hidden) { closeHist(); return; }
    }
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); focusAsk(); return; }
    if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomStep(1); return; }
    if (mod && e.key === '-') { e.preventDefault(); zoomStep(-1); return; }
    if (mod && e.key === '0') { e.preventDefault(); setZoom('fit'); return; }
    if (typing) return;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat && !spaceDown) { spaceDown = true; spaceUsed = false; $('#stage').classList.add('space-pan'); }
      return;
    }
    if (mod) return;
    if (e.shiftKey && e.code === 'Digit1') { setZoom('fit'); return; }
    if (e.shiftKey && e.code === 'Digit0') { setZoom(1); return; }
    if (e.shiftKey && e.code === 'KeyD') { $('#themeBtn').click(); return; }
    if (e.key === '?') { $('#keys').hidden = false; return; }
    if (e.key.toLowerCase() === 'p') { openPlayer(); return; }
    if (e.key === 'Escape') { select(null); return; }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key]) {
      e.preventDefault();
      const [x, y] = arrows[e.key];
      if (state.sel) { const k = e.shiftKey ? 10 : 1; nudge(x * k, y * k); } else goScene(state.scene + x + y);
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.sel) { e.preventDefault(); deleteSel(); return; }
    if (e.key === ']' && state.sel) { zorder(true); return; }
    if (e.key === '[' && state.sel) { zorder(false); return; }
    if (e.key === 'Enter' && state.sel) { const el = canvasEl(state.sel); if (el) { e.preventDefault(); startEdit(el); } }
  });
  on(document, 'keyup', e => { if (outside(e)) return;
    if (e.code === 'Space' && spaceDown) {
      spaceDown = false; $('#stage').classList.remove('space-pan');
      if (!spaceUsed) setPlaying(!state.playing);
    }
  });
  $('#kHint').textContent = /Mac/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

  /* ================= v3: extra icons ================= */
  $('svg defs').insertAdjacentHTML('beforeend', `
    <symbol id="i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></symbol>
    <symbol id="i-zap" viewBox="0 0 24 24"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></symbol>
    <symbol id="i-trend" viewBox="0 0 24 24"><path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/></symbol>
    <symbol id="i-heart" viewBox="0 0 24 24"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></symbol>
    <symbol id="i-mega" viewBox="0 0 24 24"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></symbol>
    <symbol id="i-ratio" viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="2"/></symbol>
    <symbol id="i-cam" viewBox="0 0 24 24"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></symbol>
    <symbol id="i-folder" viewBox="0 0 24 24"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></symbol>
  `);

  state.extras = state.extras || {};
  state.nextX = state.nextX || 0;

  /* ================= media library data ================= */
  const MCATS = ['Popular', 'Office', 'Technology', 'Security', 'People', 'City', 'Nature', 'Abstract'];
  const MEDIA = [
    ['Laptop on a desk', 'Office', 'photo', 4, 3], ['Team stand-up', 'Office', 'video', 16, 9, 8], ['Typing close-up', 'Technology', 'video', 4, 5, 6],
    ['Server racks', 'Technology', 'photo', 3, 4], ['Padlock on keyboard', 'Security', 'photo', 1, 1], ['Phone with a code', 'Security', 'video', 9, 16, 5],
    ['Smiling portrait', 'People', 'photo', 4, 5], ['Meeting room', 'Office', 'photo', 16, 10], ['City at night', 'City', 'video', 16, 9, 12],
    ['Coffee and notes', 'Office', 'photo', 1, 1], ['Circuit board', 'Technology', 'photo', 4, 3], ['Hands on keyboard', 'Security', 'video', 16, 9, 7],
    ['Mountain lake', 'Nature', 'photo', 3, 2], ['Gradient waves', 'Abstract', 'video', 1, 1, 10], ['Crowd crossing', 'City', 'photo', 4, 5],
    ['Colleagues talking', 'People', 'video', 4, 5, 9], ['Code on a screen', 'Technology', 'photo', 16, 10], ['Forest path', 'Nature', 'photo', 2, 3],
    ['Abstract shapes', 'Abstract', 'photo', 1, 1], ['Office lobby', 'Office', 'video', 16, 9, 11], ['Skyline', 'City', 'photo', 3, 2],
    ['Fingerprint scan', 'Security', 'photo', 4, 3], ['Support headset', 'People', 'photo', 1, 1], ['Ocean waves', 'Nature', 'video', 16, 9, 14],
  ].map(([title, cat, kind, w, h, dur], i) => ({ id: 'm' + i, title, cat, kind, w, h, dur: dur || 0, seed: 'studio-' + i + '-' + title.split(' ')[0].toLowerCase() }));
  const AI_MEDIA = ['m13', 'm18', 'm4'];
  const mimg = (m, W = 420) => `https://picsum.photos/seed/${m.seed}/${W}/${Math.round(W * m.h / m.w)}`;
  const media = { src: 'stock', type: 'all', cat: 'Popular', q: '', orient: 'any', sel: new Set() };
  function mediaList() {
    let list = MEDIA;
    if (media.src === 'library') { const used = new Set(Object.values(state.extras).flat().filter(x => x.kind === 'media').map(x => x.mid)); list = MEDIA.filter(m => used.has(m.id) || ['m0', 'm7', 'm4'].includes(m.id)); }
    if (media.src === 'uploads') return [];
    if (media.src === 'ai') list = MEDIA.filter(m => AI_MEDIA.includes(m.id));
    const q = media.q.trim().toLowerCase();
    return list.filter(m => (media.type === 'all' || m.kind === media.type)
      && (media.cat === 'Popular' || media.src !== 'stock' || m.cat === media.cat)
      && (!q || (m.title + ' ' + m.cat).toLowerCase().includes(q))
      && (media.orient === 'any' || (media.orient === 'landscape' ? m.w > m.h : media.orient === 'portrait' ? m.h > m.w : m.w === m.h)));
  }
  function tileHTML(m, inModal) {
    const hue = (+m.id.slice(1) * 47) % 360;
    return `<div class="mt ${inModal && media.sel.has(m.id) ? 'sel' : ''}" data-media="${m.id}" draggable="true" title="${esc(m.title)} — ${inModal ? 'click to select, double-click to add' : 'click to add, or drag onto the canvas'}"
      style="aspect-ratio:${m.w}/${m.h};background:linear-gradient(135deg,hsl(${hue} 25% 42%),hsl(${(hue + 40) % 360} 25% 22%))">
      <img loading="lazy" alt="" draggable="false" src="${mimg(m)}" onerror="this.remove()">
      ${AI_MEDIA.includes(m.id) && media.src === 'ai' ? '<span class="ai-b">AI</span>' : ''}
      ${m.kind === 'video' ? `<span class="dur-b">${ic('play')}${fmt(m.dur)}</span><i class="vbar"></i>` : ''}
      <span class="chk">${ic('check', 'sm')}</span><span class="mt-t">${esc(m.title)}</span>
      <button class="add-b" data-madd="${m.id}" title="Add to scene">${ic('plus', 'sm')}</button></div>`;
  }
  function gridHTML(list, inModal) {
    if (media.src === 'uploads') return `<div class="dropzone big" style="column-span:all">${ic('upload', 'lg')}<b style="color:var(--st-text)">No uploads yet</b>Drop images or videos here, or <button class="lnk" data-toast="Choose files to upload">browse files</button></div>`;
    if (!list.length) return `<div class="mm-empty" style="column-span:all">No results for “${esc(media.q)}”. Try another word or <button class="lnk" data-mai-q>generate it with AI</button>.</div>`;
    return list.map(m => tileHTML(m, inModal)).join('');
  }
  function renderMediaGrid() {
    const g = $('#mGrid'); if (g) { const l = mediaList(); g.innerHTML = gridHTML(l, false); $('#mCount').textContent = media.src === 'uploads' ? 'Uploads' : `${l.length} results`; }
    if (!$('#mm').hidden) renderMM();
  }
  const typeChips = () => ['all', 'photo', 'video'].map(t => `<button class="fchip ${media.type === t ? 'on' : ''}" data-mtype="${t}">${{ all: 'All', photo: 'Photos', video: 'Videos' }[t]}</button>`).join('');
  const catChips = () => MCATS.map(c => `<button class="fchip ${media.cat === c ? 'on' : ''}" data-mcat="${c}">${c}</button>`).join('');

  TOOLS.media = () => `<div class="dr-head"><h2>Media</h2><div>
      <button class="ib sm" data-mm-open title="Open full library">${ic('expand')}</button>
      <button class="ib sm" data-act="collapse" title="Collapse">${ic('left')}</button></div></div>
    <div class="dr-body">
      <div class="seg">${[['stock', 'Stock'], ['library', 'Library'], ['uploads', 'Uploads']].map(([k, l]) => `<button class="${media.src === k ? 'on' : ''}" data-msrc="${k}">${l}</button>`).join('')}</div>
      <div class="search" style="margin-top:10px">${ic('search', 'sm')}<input id="mSearch" placeholder="Search photos & videos" value="${esc(media.q)}"><button class="ib xs" data-mm-open title="Filters">${ic('sliders', 'sm')}</button></div>
      <div class="chips-x" style="margin-top:10px">${typeChips()}${media.src === 'stock' ? `<span class="vsep"></span>${catChips()}` : ''}</div>
      <button class="ai-row" data-mai>${ic('sparkles', 'spark')}<span><b>Generate with AI</b><small>Describe any photo or clip</small></span>${ic('down', 'sm')}</button>
      <div class="ai-box" id="mAi" hidden style="margin-top:8px">
        <textarea id="mAiText" placeholder="e.g. close-up of hands typing on a laptop, soft office light"></textarea>
        <div class="ai-box-bar"><span class="chipsel">${ic('image', 'sm')}Photo${ic('down', 'sm')}</span><span class="chipsel">16:9</span><span class="grow"></span>
        <button class="btn primary sm" data-mai-go>${ic('sparkles', 'sm')}Create</button></div>
      </div>
      <div class="dr-label"><span id="mCount"></span><button class="lnk" data-mm-open>See all</button></div>
      <div class="masonry" id="mGrid"></div>
    </div>
    <div class="dr-foot"><div class="dropzone">${ic('upload', 'sm')}Drop files or <button class="lnk" data-toast="Choose files to upload">browse</button></div></div>`;

  /* text + shape panels now add real elements (click or drag onto the canvas) */
  const XT = {
    h: { style: 'h', text: 'Add a heading', name: 'Heading' },
    sub: { style: 'sub', text: 'Add a subheading', name: 'Subheading' },
    body: { style: 'body', text: 'Add a little bit of body text', name: 'Body text' },
    c1: { style: 'h', text: 'Stay <em>Secure.</em>', name: 'Heading' },
    c2: { style: 'h', text: '81%', name: 'Stat' },
    c3: { style: 'sub', text: 'First line of defense.', name: 'Subheading' },
    c4: { style: 'kick', text: 'Chapter 02', name: 'Kicker' },
  };
  const SHAPES = ['<rect x="0" y="0" width="24" height="24"/>', '<rect x="0" y="0" width="24" height="24" rx="6"/>', '<circle cx="12" cy="12" r="12"/>', '<path d="M12 0 24 24H0z"/>',
    '<path d="M12 0 24 12 12 24 0 12z"/>', '<path d="m12 1 3.2 7 7.8.9-5.8 5.3 1.6 7.8L12 18l-6.8 4 1.6-7.8L1 8.9l7.8-.9z"/>', '<rect x="0" y="7" width="24" height="10" rx="5"/>', '<path d="M12 0 24 8v16H0V8z"/>'];
  TOOLS.text = () => `<div class="dr-head"><h2>Text</h2><button class="ib sm" data-act="collapse">${ic('left')}</button></div>
    <div class="dr-body">
      <button class="txt-add xadd" data-xadd="h" draggable="true"><div style="font:600 22px/1.2 var(--st-font-display);letter-spacing:-.02em">Add a heading</div></button>
      <button class="txt-add xadd" data-xadd="sub" draggable="true"><div style="font:500 16px/1.3 var(--st-font-display)">Add a subheading</div></button>
      <button class="txt-add xadd" data-xadd="body" draggable="true"><div style="font:400 13px/1.4 var(--st-font-ui);color:var(--st-text-2)">Add a little bit of body text</div></button>
      <div class="dr-label">Text styles <span>Click or drag</span></div>
      <div class="grid2">
        <div class="combo xadd" data-xadd="c1" draggable="true" style="background:#0a0c0b;color:#fff"><div style="font-size:17px;font-weight:500;line-height:1.05;letter-spacing:-.02em">Stay <span style="color:#a8e07f">Secure.</span></div><div style="font-size:9px;opacity:.6;margin-top:4px">Sub-headline goes here</div></div>
        <div class="combo xadd" data-xadd="c2" draggable="true" style="background:#f3f0e8;color:#121212"><div style="font-size:26px;font-weight:500;letter-spacing:-.05em;line-height:1">81%</div><div style="font-size:9px;margin-top:3px">of teams agree</div></div>
        <div class="combo xadd" data-xadd="c3" draggable="true" style="background:#a8e07f;color:#0b120c"><div style="font-size:15px;font-weight:500;line-height:1.05;letter-spacing:-.02em">First line of defense.</div></div>
        <div class="combo xadd" data-xadd="c4" draggable="true" style="background:#fff;color:#111;box-shadow:0 0 0 1px var(--st-border)"><div style="font-size:9px;letter-spacing:.14em;font-weight:600;color:#888">CHAPTER 02</div><div style="font-size:15px;font-weight:500;letter-spacing:-.02em">Three habits</div></div>
      </div></div>`;
  TOOLS.shape = () => `<div class="dr-head"><h2>Shape</h2><button class="ib sm" data-act="collapse">${ic('left')}</button></div>
    <div class="dr-body"><div class="dr-label">Basic <span>Click or drag</span></div><div class="grid4">
      ${SHAPES.map((p, i) => `<button class="shape" data-shape="${i}" draggable="true" title="Add shape"><svg viewBox="-2 -2 28 28" fill="currentColor">${p}</svg></button>`).join('')}
    </div></div>`;

  /* ================= user-added elements ================= */
  function extrasHTML(sc) {
    return (state.extras[sc.id] || []).map(x => {
      const key = `${sc.id}-${x.k}`, attrs = `data-el="${key}" data-key="${x.k}"`;
      if (x.kind === 'media') {
        const m = MEDIA.find(z => z.id === x.mid);
        return `<div class="el x-media x-box" ${attrs} data-type="image" data-name="${m.kind === 'video' ? 'Video' : 'Photo'}" style="background-image:url('${mimg(m, 1000)}')">${m.kind === 'video' ? `<span class="xb">${ic('play')}${fmt(m.dur)}</span>` : ''}</div>`;
      }
      if (x.kind === 'text') return `<div class="el x-text x-${x.style}" ${attrs} data-type="text" data-name="${esc(x.name)}">${state.texts[key] ?? x.text}</div>`;
      return `<div class="el x-shape x-box" ${attrs} data-type="image" data-name="Shape"><svg viewBox="0 0 24 24" preserveAspectRatio="none" fill="${x.color}">${SHAPES[x.shape]}</svg></div>`;
    }).join('');
  }
  const _sceneHTML = sceneHTML;
  sceneHTML = function (sc) { const h = _sceneHTML(sc), i = h.lastIndexOf('</div>'); return h.slice(0, i) + extrasHTML(sc) + h.slice(i); };

  function addExtra(x, w, h, at) {
    if (planOpen) closePlan();
    const sc = cur(), before = snap();
    state.nextX = (state.nextX || 0) + 1; x.k = 'x' + state.nextX;
    (state.extras[sc.id] = state.extras[sc.id] || []).push(x);
    const key = `${sc.id}-${x.k}`, off = ((state.extras[sc.id].length - 1) % 5) * 28;
    const cx = at ? at.x : 640 + off, cy = at ? at.y : 360 + off;
    state.geo[key] = w ? { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h } : { x: cx, y: cy };
    renderCanvas();
    if (!w) { const el = canvasEl(key), g = readGeo(el); setGeo(key, { x: Math.round(cx - g.w / 2), y: Math.round(cy - g.h / 2) }); applyGeoEl(el); }
    pushHist(before); renderScenes(); select(key); positionSel(); flashEl(key);
    toast(`Added to Scene ${state.scene + 1} — drag to position`);
  }
  function addMedia(mid, at) { const m = MEDIA.find(x => x.id === mid); const s = Math.min(560 / m.w, 420 / m.h); addExtra({ kind: 'media', mid }, Math.round(m.w * s), Math.round(m.h * s), at); }
  function addText(t, at) { const d = XT[t]; addExtra({ kind: 'text', style: d.style, text: d.text, name: d.name }, null, null, at); }
  function addShape(i, at) { addExtra({ kind: 'shape', shape: +i, color: '#a8e07f' }, 220, 220, at); }
  function addPayload(p, at) { if (p.kind === 'media') addMedia(p.id, at); else if (p.kind === 'text') addText(p.id, at); else addShape(p.id, at); }

  /* drag from panels / library onto the canvas */
  on(document, 'dragstart', e => { if (outside(e)) return;
    const t = e.target.closest && e.target.closest('[data-media],[data-xadd],[data-shape]'); if (!t) return;
    const p = t.dataset.media ? { kind: 'media', id: t.dataset.media } : t.dataset.xadd ? { kind: 'text', id: t.dataset.xadd } : { kind: 'shape', id: t.dataset.shape };
    e.dataTransfer.setData('application/x-studio', JSON.stringify(p)); e.dataTransfer.effectAllowed = 'copy';
    if (!$('#mm').hidden) setTimeout(() => $('#mm').style.opacity = '.15', 0);
  });
  on(document, 'dragend', () => { $('#frame').classList.remove('drop-on'); $('#mm').style.opacity = ''; });
  const isStudioDrag = e => [...(e.dataTransfer?.types || [])].includes('application/x-studio');
  $('#stage').addEventListener('dragover', e => { if (!isStudioDrag(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; $('#frame').classList.add('drop-on'); });
  $('#stage').addEventListener('dragleave', e => { if (!$('#stage').contains(e.relatedTarget)) $('#frame').classList.remove('drop-on'); });
  $('#stage').addEventListener('drop', e => {
    if (!isStudioDrag(e)) return; e.preventDefault(); $('#frame').classList.remove('drop-on');
    const f = $('#frame').getBoundingClientRect();
    const at = { x: Math.max(0, Math.min(1280, (e.clientX - f.left) / scale)), y: Math.max(0, Math.min(720, (e.clientY - f.top) / scale)) };
    const wasModal = !$('#mm').hidden; if (wasModal) closeMM();
    addPayload(JSON.parse(e.dataTransfer.getData('application/x-studio')), at);
  });

  /* ================= media library modal ================= */
  layer.insertAdjacentHTML('beforeend', `<div class="modal-bg" id="mm" hidden><div class="mm" role="dialog" aria-label="Media library">
    <div class="mm-head"><h3>Media library</h3><div class="search">${ic('search', 'sm')}<input id="mmSearch" placeholder="Search photos and videos"></div><span class="grow"></span>
      <button class="btn sm" data-toast="Choose files to upload">${ic('upload', 'sm')}Upload</button><button class="ib sm" data-mm-close title="Close (Esc)">${ic('x')}</button></div>
    <div class="mm-body"><aside class="mm-side" id="mmSide"></aside><div class="mm-main" id="mmMain"><div class="mm-bar" id="mmBar"></div><div class="masonry wide" id="mmGrid"></div></div></div>
    <div class="mm-foot"><span class="muted" id="mmInfo"></span><span class="grow"></span><button class="btn" id="mmClear">Clear</button><button class="btn primary" id="mmAdd" disabled>Add to scene</button></div>
  </div></div>`);
  function renderMM() {
    const src = [['stock', 'image', 'Stock', '2.4M'], ['library', 'folder', 'Your library', ''], ['uploads', 'upload', 'Uploads', '0'], ['ai', 'sparkles', 'AI generated', AI_MEDIA.length]];
    const or = [['any', 'Any', 14, 14], ['landscape', 'Landscape', 18, 11], ['portrait', 'Portrait', 11, 18], ['square', 'Square', 14, 14]];
    $('#mmSide').innerHTML = `<h4>Source</h4>${src.map(([k, i, l, n]) => `<button class="mm-nav ${media.src === k ? 'on' : ''}" data-msrc="${k}">${ic(i, 'sm')}${l}<small>${n}</small></button>`).join('')}
      <h4>Type</h4><div class="iseg act">${['all', 'photo', 'video'].map(t => `<button class="${media.type === t ? 'on' : ''}" data-mtype="${t}">${{ all: 'All', photo: 'Photos', video: 'Videos' }[t]}</button>`).join('')}</div>
      <h4>Orientation</h4><div class="orient">${or.map(([k, l, w, h]) => `<button class="${media.orient === k ? 'on' : ''}" data-morient="${k}" title="${l}">${k === 'any' ? '<b style="font-size:11px">Any</b>' : `<span style="width:${w}px;height:${h}px"></span>`}</button>`).join('')}</div>
      <h4>Color</h4><div class="mm-sw">${['#e5484d', '#f59e0b', '#a8e07f', '#10b981', '#3b82f6', '#8b5cf6', '#111', '#f5f5f5'].map(c => `<button style="background:${c}" data-toast="Filtered by color"></button>`).join('')}</div>`;
    $('#mmBar').innerHTML = `<div class="chips-x">${media.src === 'stock' ? catChips() : `<b style="font-size:13px">${src.find(s => s[0] === media.src)[2]}</b>`}</div>
      <label class="field" style="flex:none;width:150px"><select><option>Most relevant</option><option>Newest</option><option>Most used</option></select>${ic('down', 'sm')}</label>`;
    const l = mediaList();
    $('#mmGrid').innerHTML = gridHTML(l, true);
    const n = media.sel.size;
    $('#mmInfo').textContent = n ? `${n} selected` : `${l.length} results · click to select, double-click to add, or drag onto the canvas`;
    $('#mmAdd').disabled = !n; $('#mmAdd').textContent = n > 1 ? `Add ${n} to scene` : 'Add to scene';
    $('#mmClear').style.display = n ? '' : 'none';
  }
  function openMM() { media.sel.clear(); $('#mm').hidden = false; $('#mmSearch').value = media.q; renderMM(); setTimeout(() => $('#mmSearch').focus(), 50); }
  function closeMM() { $('#mm').hidden = true; $('#mm').style.opacity = ''; }
  $('#mmAdd').onclick = () => { const ids = [...media.sel]; closeMM(); ids.forEach((id, i) => addMedia(id, { x: 640 + i * 36 - (ids.length - 1) * 18, y: 360 + i * 30 - (ids.length - 1) * 15 })); };
  $('#mmClear').onclick = () => { media.sel.clear(); renderMM(); };
  on(document, 'input', e => { if (outside(e)) return;
    if (e.target.id === 'mSearch' || e.target.id === 'mmSearch') { media.q = e.target.value; renderMediaGrid(); }
  });
  $('#mmGrid').addEventListener('dblclick', e => { const t = e.target.closest('[data-media]'); if (t) { closeMM(); addMedia(t.dataset.media); } });

  /* ================= drawer: resizable, thumbnails follow width ================= */
  $('.drawer').insertAdjacentHTML('beforeend', '<div class="rz rz-x rz-l" id="rzDrawer" title="Drag to resize · double-click to reset"></div>');
  function setDrawerW(w) {
    if (w == null) { delete prefs.drawerW; $('#app').style.removeProperty('--st-drawer-w'); }
    else { prefs.drawerW = Math.round(Math.min(Math.max(w, 260), 520)); $('#app').style.setProperty('--st-drawer-w', prefs.drawerW + 'px'); }
  }
  makeResizer($('#rzDrawer'), () => $('.drawer').offsetWidth, (v0, dx) => setDrawerW(v0 + dx), () => setDrawerW(null));
  try { const p = JSON.parse(localStorage.getItem('studio-layout') || '{}'); if (p.drawerW) setDrawerW(p.drawerW); } catch (e) {}
  function fixThumbs() { $$('.thumb').forEach(t => { const i = t.firstElementChild; if (i && t.clientWidth) i.style.transform = `scale(${t.clientWidth / 1280})`; }); }
  track(new ResizeObserver(fixThumbs)).observe($('#drawer'));
  const _renderScenes = renderScenes;
  renderScenes = function () { _renderScenes(); fixThumbs(); };
  const _renderDrawer = renderDrawer;
  renderDrawer = function () { _renderDrawer(); if (state.tool === 'media') renderMediaGrid(); };

  /* overlay panels on small screens close when you go back to the canvas */
  $('#stage').insertAdjacentHTML('beforeend', `<button class="ask-fab" data-act="ask">${ic('sparkles')}Ask AI</button>`);
  $('#stage').addEventListener('pointerdown', () => {
    const app = $('#app');
    if (studioW() <= 1100 && !app.classList.contains('no-drawer')) { app.classList.add('no-drawer'); renderDrawer(); }
    if (studioW() <= 900 && !app.classList.contains('no-right')) toggleRight();
  }, true);
  if (studioW() < 900) { $('#app').classList.add('no-right'); $('#toggleRight').classList.remove('on'); }

  /* ================= plans ================= */
  const SECTION_COLORS = { hook: '#f59e0b', problem: '#ef4444', flags: '#8b5cf6', action: '#10b981', cta: '#3b82f6', intro: '#f59e0b', why: '#ef4444', habits: '#8b5cf6', recap: '#3b82f6' };
  const STRAT_ICONS = [['target', '#f43f5e'], ['user', '#3b82f6'], ['zap', '#f59e0b'], ['trend', '#10b981'], ['heart', '#ec4899'], ['mega', '#8b5cf6']];
  const shot = (id, sec, dur, vis, vo, ost, cam, move, trans) => ({ id, sec, dur, vis, vo, ost, cam, move, trans, img: 'shot-' + sec + '-' + id });
  const PHISH_PLAN = {
    title: 'Spot the Phish — 60s Vertical', aspect: '9:16', lang: 'English', voiceName: 'Oliver',
    summary: 'A 60-second vertical explainer that teaches employees to recognise a phishing email in three checks — sender, urgency, link — and to report it instead of replying. Presenter-led, calm, with motion graphics on a mocked-up inbox. No real addresses or logos are shown.',
    strategy: [['Goal', 'Spot a phishing email in under 3 seconds'], ['Audience', 'All employees — non-technical, mostly watching on mobile'], ['Hook · first 3s', 'A real-looking urgent email and the question “Would you click?”'],
      ['Format', 'Vertical explainer · presenter + motion graphics · captions on'], ['Emotional arc', 'Unease → recognition → confidence → action'], ['Call to action', 'Report suspicious emails; take the 2-minute quiz']],
    voice: { tags: ['calm', 'clear', 'friendly'], desc: 'English (US), measured pace, reassuring — never alarmist.' },
    subjects: [{ kind: 'Character', name: 'Oliver', role: 'Presenter', desc: 'Speaks directly to camera. Smart-casual, neutral studio light.', ref: 'avatar' },
      { kind: 'Scene', name: 'Dark studio', desc: 'Vertical set with soft practical lights and a screen wall for email graphics.', ref: 'studio-set' },
      { kind: 'Product', name: 'Northwind Mail', desc: 'Stylised mock-up of the company mail client — no real addresses.', ref: null }],
    sections: [['hook', 'Hook'], ['problem', 'Problem'], ['flags', 'Red flags'], ['action', 'What to do'], ['cta', 'Call to action']],
    shots: [
      shot(1, 'hook', 4, 'Extreme close-up: a phone lights up in the dark with an urgent email notification.', 'This email looks real. It isn’t.', 'WOULD YOU CLICK?', 'close-up', 'push in', 'hard cut'),
      shot(2, 'hook', 5, 'Oliver steps into frame and speaks straight to camera — calm, serious.', 'Give me one minute and you’ll spot it in three seconds.', '60 SECONDS', 'medium shot', 'static', 'whip pan'),
      shot(3, 'problem', 5, 'Animated counter climbs on a dark background.', 'Nine out of ten breaches start with a single message like this one.', '9 IN 10 BREACHES', 'full frame', 'static', 'hard cut'),
      shot(4, 'problem', 5, 'Split screen: a real IT email next to the fake — nearly identical.', 'The fakes are good. That’s the whole point.', 'SPOT THE DIFFERENCE', 'split screen', 'slow zoom', 'wipe'),
      shot(5, 'flags', 5, 'Zoom into the sender line; the fake domain lights up red.', 'Red flag one: the sender. Northwind — with an L instead of an I.', '① LOOK-ALIKE DOMAIN', 'insert', 'push in', 'hard cut'),
      shot(6, 'flags', 5, 'The subject line pulses as a countdown timer overlays it.', 'Red flag two: urgency. Real IT never gives you one hour.', '② FAKE URGENCY', 'insert', 'static', 'hard cut'),
      shot(7, 'flags', 5, 'The cursor hovers over the button and reveals a strange URL.', 'Red flag three: the link. Hover before you click — the address tells the truth.', '③ HOVER THE LINK', 'insert', 'track right', 'hard cut'),
      shot(8, 'flags', 5, 'All three flags appear together on the email.', 'Sender, urgency, link. Check all three, every time.', 'SENDER · URGENCY · LINK', 'full frame', 'pull out', 'fade'),
      shot(9, 'action', 5, 'Oliver taps “Report phishing” in the mail app.', 'Not sure? Don’t reply, don’t click — hit Report.', 'REPORT, DON’T REPLY', 'medium shot', 'static', 'hard cut'),
      shot(10, 'action', 5, 'The security dashboard receives the report with a green check.', 'It takes five seconds and protects the whole team.', '5 SECONDS', 'screen', 'slow zoom', 'hard cut'),
      shot(11, 'action', 5, 'Oliver, relaxed, back to camera.', 'Already clicked? Tell us right away. No blame.', 'CLICKED? TELL US.', 'close-up', 'static', 'hard cut'),
      shot(12, 'cta', 6, 'End card with a quiz QR code and the brand lockup.', 'Think you’ve got it? Take the two-minute quiz below.', 'TAKE THE QUIZ →', 'full frame', 'static', 'fade out'),
    ],
    alt: {
      1: ['One click. One week of cleanup. Would you click this?', 'ONE CLICK = ONE WEEK'], 2: ['Sixty seconds from now, you’ll spot these in three.'],
      3: ['Nine in ten breaches begin with a message just like this.'], 4: ['Side by side — can you tell which one is fake?'],
      5: ['Flag one: the sender. One wrong letter — northwlnd.'], 6: ['Flag two: urgency. One hour? Real IT never rushes you.'],
      7: ['Flag three: the link. Hover first — it can’t lie.'], 8: ['Sender. Urgency. Link. Three checks, three seconds.'],
      9: ['Unsure? Don’t reply. Don’t click. Just report.'], 10: ['Five seconds of your time protects everyone.'],
      11: ['Already clicked? Tell us now — no blame, just speed.'], 12: ['Ready? Scan the code and take the two-minute quiz.'],
    },
  };
  const SEC_PLAN = {
    title: 'Security Awareness · Q3', aspect: '16:9', lang: 'English', voiceName: 'Oliver',
    summary: 'A friendly 40-second explainer that turns the Q3 security memo into three memorable habits. Presenter-led, calm tone, one idea per scene.',
    strategy: [['Goal', 'Make three security habits stick after one viewing'], ['Audience', 'All employees, mixed technical background'], ['Hook · first 3s', 'Bold “Stay Secure. Stay Connected.” title with Oliver on camera'],
      ['Format', 'Presenter + kinetic typography · 16:9'], ['Emotional arc', 'Reassurance → concern → empowerment'], ['Call to action', 'Take the 2-minute quiz']],
    voice: { tags: ['calm', 'warm', 'clear'], desc: 'English (US), friendly and steady; pauses after each habit.' },
    subjects: [{ kind: 'Character', name: 'Oliver', role: 'Presenter', desc: 'On the right third of the frame, direct address.', ref: 'avatar' },
      { kind: 'Scene', name: 'Neutral studio', desc: 'Dark set with warm bokeh; brand green accents.', ref: 'neutral-studio' },
      { kind: 'Product', name: 'Security policy', desc: 'Referenced by name only; no documents on screen.', ref: null }],
    sections: [['intro', 'Intro'], ['why', 'Why it matters'], ['habits', 'Three habits'], ['recap', 'Recap']],
    shots: [
      shot(1, 'intro', 4, 'Title card with Oliver on the right; the headline animates in.', 'Welcome to Security Awareness.', 'STAY SECURE. STAY CONNECTED.', 'medium shot', 'static', 'fade in'),
      shot(2, 'intro', 6, 'The sub-headline fades in as Oliver gestures to camera.', 'In the next two minutes, we’ll cover three simple habits that keep us safe online.', 'A TWO-MINUTE GUIDE', 'medium shot', 'static', 'hard cut'),
      shot(3, 'why', 5, 'A large “81%” counts up on a warm paper background.', 'Eighty-one percent of breaches start with a weak or reused password.', '81%', 'full frame', 'slow zoom', 'wipe'),
      shot(4, 'why', 6, 'A progress bar fills; Oliver appears in a circle frame.', 'It’s rarely a sophisticated attack — usually just a door someone left open.', 'A DOOR LEFT OPEN', 'medium shot', 'static', 'hard cut'),
      shot(5, 'habits', 3, 'The section title slides up.', 'So what can you do?', 'THREE HABITS THAT MATTER', 'full frame', 'static', 'slide up'),
      shot(6, 'habits', 8, 'Three cards reveal one by one with icons.', 'Use a password manager, turn on two-factor everywhere, and pause before you click.', 'MANAGER · 2FA · PAUSE', 'full frame', 'static', 'stagger'),
      shot(7, 'recap', 4, 'Lime end card with a bold headline.', 'Three small habits, one much safer team.', 'FIRST LINE OF DEFENSE', 'full frame', 'static', 'hard cut'),
      shot(8, 'recap', 4, 'The quiz button pulses next to the logo lockup.', 'You’re our first line of defense. Thanks for watching.', 'TAKE THE 2-MINUTE QUIZ', 'full frame', 'static', 'fade out'),
    ],
    alt: { 1: ['Two minutes. Three habits. One safer team.', 'TWO MINUTES · THREE HABITS'], 2: ['Here are the three habits that stop most attacks.'] },
  };
  const plans = {};
  let planOpen = null, planDrawerWasOpen = false;
  const planFields = p => ({ title: p.title, summary: p.summary, strategy: p.strategy, voice: p.voice, subjects: p.subjects, shots: p.shots });
  function makePlan(id, tpl, status) {
    const d = clone(tpl);
    const p = plans[id] = {
      id, ...d, status: status || 'draft', v: 1, changed: [], was: {}, built: 0, edited: false,
      sections: d.sections.map(([sid, name]) => ({ id: sid, name, color: SECTION_COLORS[sid] })),
      strategy: d.strategy.map(([k, v], i) => ({ k, v, icon: STRAT_ICONS[i][0], c: STRAT_ICONS[i][1] })),
      versions: [], notes: ['Original draft'],
    };
    p.versions.push(JSON.stringify(planFields(p)));
    return p;
  }
  const planDur = p => p.shots.reduce((a, s) => a + s.dur, 0);
  const secDur = (p, sid) => p.shots.filter(s => s.sec === sid).reduce((a, s) => a + s.dur, 0);
  const statusHTML = p => `<span class="st ${p.status}">${{ draft: 'Draft', building: 'Building', approved: 'Approved' }[p.status]} · v${p.v}</span>`;
  function planCardHTML(id) {
    const p = plans[id], open = planOpen === id;
    return `<div class="plan-card ${open ? 'open' : ''}" data-plan="${id}" role="button" tabindex="0" title="${open ? 'Close' : 'Open'} plan">
      <div class="pc-top"><span class="pc-ic">${ic('file')}</span><div><b>${esc(p.title)}</b><small>${p.shots.length} shots · ${fmt(planDur(p))} · ${p.aspect} · ${p.lang}</small></div>${statusHTML(p)}</div>
      <div class="pc-bar">${p.sections.map(s => `<i style="flex:${secDur(p, s.id)} 1 0;background:${s.color}"></i>`).join('')}</div>
      <div class="pc-secs">${p.sections.map(s => esc(s.name)).join(' · ')}</div>
      <div class="pc-f"><button class="btn sm" data-plan-toggle="${id}">${open ? 'Close plan' : 'Open plan'}${ic(open ? 'x' : 'arrow-right', 'sm')}</button>${p.status === 'draft' ? `<button class="btn primary sm" data-plan-approve="${id}">${ic('check', 'sm')}Approve</button>` : ''}</div></div>`;
  }
  function updatePlanCards(id) { $$(`.plan-card[data-plan="${id}"]`).forEach(n => n.outerHTML = planCardHTML(id)); }
  function refHTML(r) {
    if (r === 'avatar') return `<div class="ref">${avatarSVG(AV[state.avatar])}</div>`;
    if (r) return `<div class="ref" style="background-image:url(https://picsum.photos/seed/${r}/120/120)"></div>`;
    return `<div class="ref empty" data-toast="Upload a reference image">${ic('plus', 'sm')}Add ref</div>`;
  }
  function shotHTML(p, s) {
    const n = p.shots.indexOf(s) + 1, ch = p.changed.includes(s.id), ed = p.status === 'draft', ce = `contenteditable="${ed}"`;
    const v = p.aspect === '9:16';
    return `<article class="pl-card shot ${ch ? 'changed' : ''}" id="shot-${s.id}">
      ${ch ? `<span class="rev-b">Revised in v${p.v}</span>` : ''}
      <div class="sb"><span class="no">S${n}</span><div class="fr ${v ? 'v916' : 'v169'}" style="background-image:url(https://picsum.photos/seed/${s.img}/${v ? '128/228' : '224/126'})"><span class="ot">${esc(s.ost)}</span></div></div>
      <div style="min-width:0">
        <div class="shot-top"><div class="vis ed" ${ce} data-pf="shot.${s.id}.vis">${esc(s.vis)}</div>
          ${ed ? `<div class="sacts"><button class="ib xs" data-ai="Rewrite shot S${n}" title="Rewrite with AI">${ic('sparkles', 'sm spark')}</button><button class="ib xs" data-shot-dup="${s.id}" title="Duplicate">${ic('dup', 'sm')}</button><button class="ib xs" data-shot-del="${s.id}" title="Delete">${ic('trash', 'sm')}</button></div>` : ''}
          <span class="durp" title="Duration in seconds">${ic('clock', 'sm')}<span class="ed" ${ce} data-pf="shot.${s.id}.dur">${s.dur}</span>s</span></div>
        <div class="kv"><label>${ic('mic')}Voiceover</label><div class="box"><div class="ed" ${ce} data-pf="shot.${s.id}.vo">${esc(s.vo)}</div>${ch && p.was[s.id] ? `<span class="was">${esc(p.was[s.id])}</span>` : ''}</div></div>
        <div class="kv"><label>${ic('type')}On-screen</label><div class="box ost"><div class="ed" ${ce} data-pf="shot.${s.id}.ost">${esc(s.ost)}</div></div></div>
        <div class="stags"><span class="stag">${ic('cam')}${esc(s.cam)}</span><span class="stag">${ic('motion')}${esc(s.move)}</span><span class="stag">${ic('refresh')}${esc(s.trans)}</span>${ed ? `<button class="stag add" data-toast="Add a camera or lighting note">${ic('plus')}</button>` : ''}</div>
      </div></article>`;
  }
  function renderPlan() {
    const p = plans[planOpen]; if (!p) return;
    const oldMain = $('#plMain'), st = oldMain ? oldMain.scrollTop : 0;
    const tot = planDur(p), ed = p.status === 'draft', ce = `contenteditable="${ed}"`;
    const foot = p.status === 'building'
      ? `<div class="sum"><span class="spin"></span>Building scenes from plan v${p.v}…</div>`
      : p.status === 'approved'
        ? `<div class="sum">${ic('check-c', 'sm')}<b>Approved</b> · v${p.v}${p.built ? ` · ${p.built} scenes built` : ''}</div><span class="grow"></span>
           <button class="btn" data-plan-reopen>${ic('edit', 'sm')}Revise plan</button><button class="btn primary" data-plan-close>Go to editor</button>`
        : `<div class="sum"><b>${p.shots.length} shots</b> · ${fmt(tot)} · ${p.aspect} · ${p.lang}${p.changed.length ? ` · <span style="color:var(--st-accent-text)">${p.changed.length} revised</span>` : ''}${p.edited ? ' · edited' : ''}</div><span class="grow"></span>
           <button class="btn" data-plan-revise>${ic('sparkles', 'sm spark')}Request changes</button><button class="btn primary" data-plan-approve="${p.id}">${ic('check', 'sm')}Approve & build video</button>`;
    $('#plan').innerHTML = `
      <header class="pl-head">
        <button class="ib sm" data-plan-close title="Back to editor (Esc)">${ic('left')}</button>
        <div class="pl-titles"><div class="pl-kicker">${ic('file', 'sm')}Video plan ${statusHTML(p)}</div>
          <input class="pl-title" id="plTitleIn" value="${esc(p.title)}" ${ed ? '' : 'readonly'} aria-label="Plan title"></div>
        <button class="btn ghost sm" data-plan-vers title="Version history">${ic('history', 'sm')}<span>v${p.v}</span>${ic('down', 'sm')}</button>
        <button class="btn ghost sm" data-plan-copy title="Copy voiceover script">${ic('copy', 'sm')}<span class="hide-sm">Copy script</span></button>
        <button class="ib sm" data-plan-close title="Close">${ic('x')}</button>
      </header>
      <div class="pl-bodyw">
        <nav class="pl-nav" id="plNav">
          <a data-jump="ov" class="on">${ic('file', 'sm')}Overview</a>
          <a data-jump="strat">${ic('target', 'sm')}Strategy</a>
          <a data-jump="subj">${ic('user', 'sm')}Subjects<small>${p.subjects.length + 1}</small></a>
          <a data-jump="shots">${ic('scenes', 'sm')}Shot script<small>${p.shots.length}</small></a>
          ${p.sections.map(s => `<a class="sub" data-jump="sec-${s.id}"><span class="dot" style="background:${s.color}"></span>${esc(s.name)}<small>${fmt(secDur(p, s.id))}</small></a>`).join('')}
        </nav>
        <div class="pl-main" id="plMain"><div class="pl-wrap">
          <section class="pl-sec" id="pj-ov"><div class="pl-card ov">
            <div class="meta-row"><span class="mchip">${ic('clock')}${fmt(tot)}</span><span class="mchip">${ic('ratio')}${p.aspect}</span><span class="mchip">${ic('globe')}${p.lang}</span><span class="mchip">${ic('scenes')}${p.shots.length} shots</span><span class="mchip">${ic('mic')}${p.voiceName}</span></div>
            <p class="summary ed" ${ce} data-pf="summary">${esc(p.summary)}</p>
            <div class="pace"><div class="pace-bar">${p.sections.map(s => `<i style="flex:${secDur(p, s.id)} 1 0;background:${s.color}"></i>`).join('')}</div>
              <div class="pace-lb">${p.sections.map(s => `<span style="flex:${secDur(p, s.id)} 1 0"><b>${esc(s.name)}</b> ${fmt(secDur(p, s.id))}</span>`).join('')}</div></div>
          </div></section>
          <section class="pl-sec" id="pj-strat"><h3>${ic('target')}Script strategy</h3><div class="pl-card strat">
            ${p.strategy.map((f, i) => `<div class="sf"><span class="sic" style="background:color-mix(in srgb,${f.c} 14%,transparent);color:${f.c}">${ic(f.icon, 'sm')}</span><div style="min-width:0;flex:1"><label>${f.k}</label><div class="v ed" ${ce} data-pf="strategy.${i}">${esc(f.v)}</div></div></div>`).join('')}
          </div></section>
          <section class="pl-sec" id="pj-subj"><h3>${ic('user')}Subjects${ed ? `<button class="btn ghost sm r" data-toast="Add a character, scene or product">${ic('plus', 'sm')}Add subject</button>` : ''}</h3>
            <div class="pl-card" style="overflow:hidden">
              <div class="voice-row"><span class="sic" style="background:var(--st-accent-soft);color:var(--st-accent-text)">${ic('mic', 'sm')}</span>
                <div style="flex:1;min-width:0"><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b>Voice · ${p.voiceName}</b>${p.voice.tags.map(t => `<span class="tagc">${t}</span>`).join('')}</div>
                <small class="muted ed" ${ce} data-pf="voice">${esc(p.voice.desc)}</small></div>
                <button class="btn sm" data-toast="Playing voice sample…">${ic('play', 'sm')}Preview</button></div>
              <div class="subj-grid">${p.subjects.map((it, i) => `<div class="sj">${refHTML(it.ref)}<div style="min-width:0"><span class="kb ${it.kind.toLowerCase()}">${it.kind}</span><div><b>${esc(it.name)}</b>${it.role ? `<span class="muted"> · ${it.role}</span>` : ''}</div><p class="ed" ${ce} data-pf="subj.${i}">${esc(it.desc)}</p></div></div>`).join('')}</div>
            </div></section>
          <section class="pl-sec" id="pj-shots"><h3>${ic('scenes')}Shot script<span class="r muted" style="font-weight:500;font-size:12px">${p.shots.length} shots · ${fmt(tot)}</span></h3>
            ${p.sections.map(sec => { const ss = p.shots.filter(s => s.sec === sec.id); if (!ss.length) return ''; return `<div class="sec-h" id="pj-sec-${sec.id}"><span class="dot" style="background:${sec.color}"></span>${esc(sec.name)}<small>${ss.length} shot${ss.length > 1 ? 's' : ''} · ${fmt(secDur(p, sec.id))}</small><span class="grow"></span>${ed ? `<button class="btn ghost sm" data-ai="Rewrite the ${esc(sec.name.toLowerCase())} section">${ic('sparkles', 'sm spark')}Rewrite</button>` : ''}</div>` + ss.map(s => shotHTML(p, s)).join(''); }).join('')}
            ${ed ? `<button class="add-shot" data-shot-add>${ic('plus', 'sm')}Add shot</button>` : ''}
          </section>
        </div></div>
      </div>
      <footer class="pl-foot">${foot}</footer>`;
    $('#plMain').scrollTop = st;
  }
  function openPlan(id, focusShot) {
    if (!plans[id]) return;
    const prev = planOpen; planOpen = id;
    const app = $('#app');
    if (!prev) { planDrawerWasOpen = !app.classList.contains('no-drawer'); if (planDrawerWasOpen) { app.classList.add('no-drawer'); renderDrawer(); } }
    $('#plan').hidden = false; closeMenu(); select(null);
    renderPlan(); if (prev !== id) $('#plMain').scrollTop = 0;
    [prev, id].forEach(x => x && updatePlanCards(x));
    renderCtx(); renderSugg();
    if (focusShot) { const el = $('#shot-' + focusShot); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); } }
  }
  function closePlan() {
    const id = planOpen; if (!id) return;
    planOpen = null; $('#plan').hidden = true;
    if (planDrawerWasOpen && studioW() > 1100) { $('#app').classList.remove('no-drawer'); renderDrawer(); }
    planDrawerWasOpen = false;
    updatePlanCards(id); renderCtx(); renderSugg(); fit();
  }
  function togglePlan(id) { planOpen === id ? closePlan() : openPlan(id); }
  function commitPlanVersion(p, changed, was, note) {
    p.v = p.versions.length + 1; p.changed = changed; p.was = was; p.edited = false; p.status = 'draft';
    p.versions.push(JSON.stringify(planFields(p))); p.notes.push(note);
  }
  async function approvePlan(id) {
    const p = plans[id]; if (!p || p.status !== 'draft' || busy) return;
    p.status = 'building'; renderPlan(); updatePlanCards(id);
    await wait(1300);
    const before = snap(), at = state.scenes.length, made = [];
    p.sections.forEach(sec => {
      const ss = p.shots.filter(s => s.sec === sec.id); if (!ss.length) return;
      const sid = 's' + state.nextId++;
      state.scenes.push({ id: sid, type: 'blank', name: sec.name });
      state.texts[`${sid}-h`] = ss[0].ost.charAt(0) + ss[0].ost.slice(1).toLowerCase();
      state.texts[`${sid}-sub`] = ss.length > 1 ? ss[1].ost.charAt(0) + ss[1].ost.slice(1).toLowerCase() : '';
      const vo = ss.map(s => s.vo).join(' ');
      state.scripts.en[sid] = [{ m: 'Headline' }, vo]; state.scripts.tr[sid] = [{ m: 'Headline' }, vo];
      made.push(sec.name);
    });
    pushHist(before);
    p.status = 'approved'; p.built = made.length; p.changed = [];
    state.scene = at; state.t = startOf(at); renderAll();
    renderPlan(); updatePlanCards(id);
    const cardId = 'c' + Date.now(); cards[cardId] = { before, after: snap() };
    await addAI(`Plan v${p.v} approved. I built **${made.length} scenes** from it and added them after your existing scenes — voiceover, on-screen text and timing come straight from the shot script.`,
      { id: cardId, icon: 'scenes', title: `Built ${made.length} scenes`, meta: fmt(planDur(p)), rows: made.map((n, i) => ({ l: `${at + i + 1} · ${n}`, go: at + i })) });
    setTimeout(closePlan, 500);
    toast(`${made.length} scenes added from the plan`);
  }

  /* plan intents for the assistant */
  function planIntent(q) {
    const s = q.toLowerCase(), el = canvasEl(state.sel);
    if (planOpen && !/translat|türk|çevir/.test(s)) {
      const p = plans[planOpen];
      if (p.status === 'building') return null;
      const nm = s.match(/shot\s*s?(\d+)/);
      const secHit = p.sections.find(x => s.includes(x.name.toLowerCase()));
      let targets, note, text;
      if (/short|trim|kısa|45|50|tighter/.test(s)) {
        return {
          steps: [`Reading plan v${p.v}`, 'Finding repeated ideas', 'Re-timing the cut'],
          apply() {
            const before = planDur(p), drop = p.shots.filter(x => x.sec === 'problem' || x.sec === 'action' || x.sec === 'why').slice(-1).concat(p.shots.filter(x => x.sec === 'flags').slice(-1));
            const was = {}; p.shots = p.shots.filter(x => !drop.includes(x));
            const keep = p.shots.filter(x => x.dur > 4).slice(0, 2); keep.forEach(x => x.dur -= 1);
            commitPlanVersion(p, keep.map(x => x.id), was, `Trimmed to ${fmt(planDur(p))}`);
            return { text: `Trimmed the plan from **${fmt(before)}** to **${fmt(planDur(p))}** — removed ${drop.length} shots that repeated an earlier point and tightened two more. It’s now **v${p.v}**.`, html: planCardHTML(p.id), after: () => openPlan(p.id) };
          }
        };
      }
      if (/quiz|add a shot|add shot|ekle/.test(s)) {
        return {
          steps: [`Reading plan v${p.v}`, 'Writing a quiz shot', 'Placing it before the CTA'],
          apply() {
            const nid = Math.max(...p.shots.map(x => x.id)) + 1, lastSec = p.sections[p.sections.length - 2] || p.sections[0];
            const ns = shot(nid, lastSec.id, 5, 'Quick quiz: two sender addresses appear side by side; a timer counts down from 3.', 'Quick test: which of these two is fake? You have three seconds.', 'WHICH ONE IS FAKE?', 'full frame', 'static', 'hard cut');
            const idx = p.shots.findIndex(x => x.sec === p.sections[p.sections.length - 1].id);
            p.shots.splice(idx < 0 ? p.shots.length : idx, 0, ns);
            commitPlanVersion(p, [nid], {}, 'Added a quiz shot');
            return { text: `Added an interactive **quiz shot** right before the call to action. The plan is now ${fmt(planDur(p))} — **v${p.v}**.`, html: planCardHTML(p.id), after: () => openPlan(p.id, nid) };
          }
        };
      }
      if (nm) { const sh = p.shots[+nm[1] - 1]; targets = sh ? [sh] : []; note = `Rewrote shot S${nm[1]}`; text = `Rewrote **shot S${nm[1]}** — tighter voiceover, same timing.`; }
      else if (secHit && !/hook/.test(s)) { targets = p.shots.filter(x => x.sec === secHit.id); note = `Rewrote ${secHit.name}`; text = `Rewrote the **${secHit.name}** section (${targets.length} shots) — shorter lines, clearer rhythm.`; }
      else { const first = p.sections[0].id; targets = p.shots.filter(x => x.sec === first); note = 'Stronger hook'; text = `Made the **hook** stronger — it now opens on the cost of a single click, which gives the rest of the video a clear stake.`; }
      if (!targets.length) return { steps: ['Reading plan'], apply: () => ({ text: 'I couldn’t find that shot in the plan. Try “Rewrite shot S3”.' }) };
      return {
        steps: [`Reading plan v${p.v}`, `Rewriting ${targets.length} shot${targets.length > 1 ? 's' : ''}`, 'Checking pacing'],
        apply() {
          const was = {};
          targets.forEach(x => {
            was[x.id] = x.vo;
            const a = p.alt[x.id];
            if (a && a[0] !== x.vo) { x.vo = a[0]; if (a[1]) x.ost = a[1]; }
            else { const first = (x.vo.match(/[^.!?]+[.!?]/) || [x.vo])[0].trim(); x.vo = first === x.vo ? x.vo.replace(/^(\w)/, c => c.toUpperCase()).replace(/\s—.*$/, '.') : first; }
          });
          commitPlanVersion(p, targets.map(x => x.id), was, note);
          return { text: `${text} Changes are highlighted in **v${p.v}** — the old line is shown underneath each one.`, html: planCardHTML(p.id), after: () => openPlan(p.id, targets[0].id) };
        }
      };
    }
    if (!planOpen && /\bplan\b|storyboard|senaryo|(write|draft|create|make)\b.*\b(video|script)\b/.test(s) && !/rewrite|this scene/.test(s)) {
      return {
        steps: ['Reading the brief', 'Outlining 5 sections', 'Writing 12 shots', 'Checking pacing · 1:00'],
        apply() {
          const id = 'p' + Date.now(); makePlan(id, PHISH_PLAN, 'draft');
          return { text: `Here’s a **60-second vertical plan** — 5 sections, 12 shots. It’s open on the left: edit anything inline, ask me for changes, then approve and I’ll build the scenes.`, html: planCardHTML(id), after: () => openPlan(id) };
        }
      };
    }
    if (el && el.dataset.type === 'text' && el.dataset.key.startsWith('x') && !/translat|short|kısa/.test(s)) {
      const key = el.dataset.el;
      return {
        steps: [`Reading ${el.dataset.name.toLowerCase()}`, 'Drafting options'],
        apply() {
          const opts = ['Think before you click.', 'Small habits. Big protection.', 'Security starts with you.'];
          const old = state.texts[key] ?? strip(el.innerHTML), n = (state.alt[key] = ((state.alt[key] ?? -1) + 1) % opts.length);
          state.texts[key] = opts[n];
          return { text: 'Here’s a punchier line. Ask again for another option.', card: { icon: 'wand', title: `Updated ${el.dataset.name}`, meta: `Scene ${state.scene + 1}`, diff: [strip(old), opts[n]] }, flash: key };
        }
      };
    }
    return null;
  }
  const _plan = plan;
  plan = function (q) { return planIntent(q) || _plan(q); };

  const _renderCtx = renderCtx;
  renderCtx = function () {
    if (!planOpen) return _renderCtx();
    const p = plans[planOpen];
    $('#ctx').innerHTML = `<span class="chip focus">${ic('file')}Plan · v${p.v}<button data-plan-close title="Close plan">${ic('x', 'sm')}</button></span>`;
    $('#prompt').placeholder = p.status === 'draft' ? 'Describe what to change in the plan…' : 'Ask to revise the approved plan…';
  };
  const _renderSugg = renderSugg;
  renderSugg = function () {
    if (!planOpen) return _renderSugg();
    const s = ['Make the hook stronger', 'Shorten it', 'Add a quiz shot before the CTA'];
    $('#sugg').innerHTML = s.map(t => `<button data-ai="${esc(t)}">${ic('sparkles')}${esc(t)}</button>`).join('');
  };

  /* plan canvas lives over the editor, to the left of the chat */
  $('.center').insertAdjacentHTML('beforeend', '<section class="plan" id="plan" hidden aria-label="Video plan"></section>');
  $('#plan').addEventListener('focusout', e => {
    const el = e.target.closest('[data-pf]'), p = plans[planOpen]; if (!el || !p || p.status !== 'draft') return;
    const v = el.textContent.trim(), [a, b, c] = el.dataset.pf.split('.');
    let changed = false, rerender = false;
    const set = (obj, k) => { if (obj[k] !== v) { obj[k] = v; changed = true; } };
    if (a === 'summary') set(p, 'summary');
    else if (a === 'strategy') set(p.strategy[b], 'v');
    else if (a === 'voice') set(p.voice, 'desc');
    else if (a === 'subj') set(p.subjects[b], 'desc');
    else if (a === 'shot') {
      const s = p.shots.find(x => x.id === +b); if (!s) return;
      if (c === 'dur') { const n = Math.max(1, Math.min(30, parseInt(v, 10) || s.dur)); el.textContent = n; if (n !== s.dur) { s.dur = n; changed = rerender = true; } }
      else set(s, c);
    }
    if (!changed) return;
    p.edited = true; markSaving(); updatePlanCards(p.id);
    if (rerender) renderPlan(); else { const f = $('.pl-foot .sum'); if (f && !/edited/.test(f.textContent)) f.insertAdjacentText('beforeend', ' · edited'); }
  });
  $('#plan').addEventListener('keydown', e => {
    const el = e.target.closest('[data-pf]');
    if (el && e.key === 'Enter' && !e.shiftKey && /\.(dur|ost)$|^strategy/.test(el.dataset.pf)) { e.preventDefault(); el.blur(); }
    if (e.target.id === 'plTitleIn' && e.key === 'Enter') e.target.blur();
    if (el && el.dataset.pf.endsWith('.dur') && e.key.length === 1 && !/\d/.test(e.key)) e.preventDefault();
  });
  $('#plan').addEventListener('change', e => {
    if (e.target.id !== 'plTitleIn') return;
    const p = plans[planOpen], v = e.target.value.trim(); if (!p || !v) return;
    p.title = v; p.edited = true; updatePlanCards(p.id); markSaving();
  });
  $('#plan').addEventListener('scroll', e => {
    if (e.target.id !== 'plMain') return;
    const top = e.target.getBoundingClientRect().top + 40;
    let cur = 'ov';
    $$('#plMain [id^="pj-"]').forEach(s => { if (s.getBoundingClientRect().top <= top) cur = s.id.slice(3); });
    $$('#plNav a').forEach(a => a.classList.toggle('on', a.dataset.jump === cur));
  }, true);

  /* ================= v3 click handling ================= */
  on(document, 'click', e => { if (outside(e)) return;
    const t = e.target;
    // media
    const madd = t.closest('[data-madd]'); if (madd) { e.stopPropagation(); if (!$('#mm').hidden) closeMM(); addMedia(madd.dataset.madd); return; }
    const mt = t.closest('[data-media]');
    if (mt) { if (mt.closest('#mm')) { const id = mt.dataset.media; media.sel.has(id) ? media.sel.delete(id) : media.sel.add(id); renderMM(); } else addMedia(mt.dataset.media); return; }
    if (t.closest('[data-mm-open]')) { openMM(); return; }
    if (t.closest('[data-mm-close]') || t.id === 'mm') { closeMM(); return; }
    const f = t.closest('[data-mtype],[data-mcat],[data-msrc],[data-morient]');
    if (f) {
      const d = f.dataset;
      if (d.mtype) media.type = d.mtype; if (d.mcat) media.cat = d.mcat; if (d.msrc) media.src = d.msrc; if (d.morient) media.orient = d.morient;
      if (state.tool === 'media' && $('#mGrid')) { if (f.closest('#drawer')) { const q = $('#mSearch').value; renderDrawer(); } else renderDrawer(); }
      if (!$('#mm').hidden) renderMM();
      return;
    }
    if (t.closest('[data-mai]')) { const b = $('#mAi'); b.hidden = !b.hidden; if (!b.hidden) $('#mAiText').focus(); return; }
    if (t.closest('[data-mai-q]')) { closeMM(); state.tool = 'media'; $('#app').classList.remove('no-drawer'); renderDrawer(); $('#mAi').hidden = false; $('#mAiText').value = media.q; $('#mAiText').focus(); return; }
    if (t.closest('[data-mai-go]')) { toast('Generating… your result will appear in Library'); return; }
    const xa = t.closest('[data-xadd]'); if (xa) { addText(xa.dataset.xadd); return; }
    const sh = t.closest('[data-shape]'); if (sh) { addShape(sh.dataset.shape); return; }

    // plans
    const pv = t.closest('[data-pv]');
    if (pv) {
      const p = plans[planOpen], i = +pv.dataset.pv; closeMenu();
      Object.assign(p, JSON.parse(p.versions[i])); p.v = i + 1; p.changed = []; p.edited = false; if (p.status === 'approved') p.status = 'draft';
      renderPlan(); updatePlanCards(p.id); renderCtx(); toast(`Restored v${i + 1} · ${p.notes[i]}`); return;
    }
    if (t.closest('[data-plan-vers]')) {
      const p = plans[planOpen], r = t.closest('[data-plan-vers]').getBoundingClientRect();
      closeMenu();
      const m = document.createElement('div'); m.className = 'cmenu'; m.id = 'cmenu';
      m.innerHTML = p.versions.map((_, i) => `<button data-pv="${i}">${ic(i + 1 === p.v ? 'check' : 'history')}v${i + 1} · ${esc(p.notes[i])}</button>`).reverse().join('');
      layer.appendChild(m);
      m.style.left = Math.min(r.left, innerWidth - m.offsetWidth - 8) + 'px'; m.style.top = r.bottom + 6 + 'px';
      e.stopPropagation(); return;
    }
    if (t.closest('[data-plan-copy]')) {
      const p = plans[planOpen], txt = p.shots.map((s, i) => `S${i + 1} (${s.dur}s) — ${s.vo}`).join('\n');
      (navigator.clipboard?.writeText(txt) || Promise.reject()).then(() => toast('Voiceover script copied'), () => toast('Copy isn’t available here'));
      return;
    }
    if (t.closest('[data-plan-close]')) { closePlan(); return; }
    if (t.closest('[data-plan-revise]')) { focusAsk(); return; }
    if (t.closest('[data-plan-reopen]')) { const p = plans[planOpen]; p.status = 'draft'; renderPlan(); updatePlanCards(p.id); renderCtx(); toast('Plan unlocked — changes create a new version'); return; }
    const ap = t.closest('[data-plan-approve]'); if (ap) { e.stopPropagation(); approvePlan(ap.dataset.planApprove); return; }
    const jump = t.closest('[data-jump]'); if (jump) { $('#pj-' + jump.dataset.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const sd = t.closest('[data-shot-del]');
    if (sd) { const p = plans[planOpen]; if (p.shots.length < 2) return; p.shots = p.shots.filter(x => x.id !== +sd.dataset.shotDel); p.edited = true; renderPlan(); updatePlanCards(p.id); toast('Shot removed'); return; }
    const sdp = t.closest('[data-shot-dup]');
    if (sdp) { const p = plans[planOpen], i = p.shots.findIndex(x => x.id === +sdp.dataset.shotDup), c = clone(p.shots[i]); c.id = Math.max(...p.shots.map(x => x.id)) + 1; p.shots.splice(i + 1, 0, c); p.edited = true; renderPlan(); updatePlanCards(p.id); $('#shot-' + c.id)?.classList.add('flash'); return; }
    if (t.closest('[data-shot-add]')) {
      const p = plans[planOpen], last = p.shots[p.shots.length - 1], id = Math.max(...p.shots.map(x => x.id)) + 1;
      p.shots.push(shot(id, last.sec, 4, 'Describe what we see…', 'What the presenter says…', 'ON-SCREEN TEXT', 'medium shot', 'static', 'hard cut'));
      p.edited = true; renderPlan(); updatePlanCards(p.id);
      const el = $('#shot-' + id); el.scrollIntoView({ block: 'center' }); el.querySelector('.vis').focus(); document.execCommand('selectAll'); return;
    }
    const tg = t.closest('[data-plan-toggle]'); if (tg) { e.stopPropagation(); togglePlan(tg.dataset.planToggle); return; }
    const pc = t.closest('.plan-card'); if (pc && !t.closest('button')) { togglePlan(pc.dataset.plan); return; }
  });
  $('#msgs').addEventListener('keydown', e => { const pc = e.target.closest('.plan-card'); if (pc && (e.key === 'Enter' || e.key === ' ') && e.target === pc) { e.preventDefault(); togglePlan(pc.dataset.plan); } });

  /* Escape closes the top-most layer first */
  on(window, 'keydown', e => { if (outside(e)) return;
    if (e.key !== 'Escape') return;
    if ($('#cmenu')) return;
    if (!$('#mm').hidden) { e.stopPropagation(); closeMM(); return; }
    if (planOpen && !e.target.closest('input, textarea, [contenteditable=true]') && $('#hist').hidden) { e.stopPropagation(); closePlan(); }
  }, true);

  /* seeded conversation now includes the approved plan the scenes came from */
  makePlan('p-seed', SEC_PLAN, 'approved').built = 4;
  seedChat = function () {
    msgs().innerHTML = `<div class="day">Today</div>`;
    addUser('Turn this security memo into a short training video for the team. Friendly tone, under 45 seconds.', ['Security_memo_Q3.pdf', 'PDF · 2 pages']);
    msgs().insertAdjacentHTML('beforeend', aiHTML('I read the memo and drafted a plan first — strategy, subjects and an 8-shot script. Have a look before I build anything.', null, '', '09:12').replace('</div><div class="ai-acts">', `</div>${planCardHTML('p-seed')}<div class="ai-acts">`));
    msgs().insertAdjacentHTML('beforeend', userHTML('Looks good, go ahead.'));
    addAI(`Done — I built **${state.scenes.length} scenes (${fmt(total())})** from the approved plan using the *Secure* template, with ${AV[state.avatar].name} presenting.`,
      { icon: 'scenes', title: `Created ${state.scenes.length} scenes`, meta: fmt(total()), rows: state.scenes.map((x, i) => ({ l: `${i + 1} · ${x.name}`, r: fmt(dur(x)), go: i })) },
      { instant: true, after: 'Want me to translate it, or plan a short vertical cut about phishing for social?' });
    $('[data-card]', msgs())?.setAttribute('data-card', 'seed');
  };

  /* ================= v4: versioned plans with per-version diffs ================= */
  const nowHM = () => { const d = new Date(); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const credits = d => Math.max(1, Math.ceil(d / 10));
  function normPlan(p) {
    p.versions = p.versions.map((v, i) => typeof v === 'string'
      ? { data: v, note: (p.notes && p.notes[i]) || (i ? `Version ${i + 1}` : 'Original draft'), at: i ? nowHM() : 'Earlier', diff: null } : v);
    if (p.showDiff == null) p.showDiff = true;
    if (p.view === undefined) p.view = null;
  }
  function diffPlans(a, b) {
    const changed = {}, added = [], removed = [], fields = {};
    const am = new Map(a.shots.map(s => [s.id, s])), bm = new Set(b.shots.map(s => s.id));
    b.shots.forEach(s => {
      const o = am.get(s.id); if (!o) { added.push(s.id); return; }
      const c = {}; ['vis', 'vo', 'ost', 'dur'].forEach(k => { if (o[k] !== s[k]) c[k] = o[k]; });
      if (Object.keys(c).length) changed[s.id] = c;
    });
    a.shots.forEach((s, i) => { if (!bm.has(s.id)) removed.push({ id: s.id, n: i + 1, sec: s.sec, vo: s.vo }); });
    if (a.summary !== b.summary) fields.summary = a.summary;
    if (a.title !== b.title) fields.title = a.title;
    if (a.voice.desc !== b.voice.desc) fields.voice = a.voice.desc;
    a.strategy.forEach((f, i) => { if (b.strategy[i] && f.v !== b.strategy[i].v) (fields.strategy = fields.strategy || {})[i] = f.v; });
    a.subjects.forEach((f, i) => { if (b.subjects[i] && f.desc !== b.subjects[i].desc) (fields.subj = fields.subj || {})[i] = f.desc; });
    const dur = x => x.shots.reduce((t, s) => t + s.dur, 0);
    return { changed, added, removed, fields, dDur: dur(b) - dur(a), dShots: b.shots.length - a.shots.length };
  }
  const hasDiff = df => !!df && !!(Object.keys(df.changed).length || df.added.length || df.removed.length || Object.keys(df.fields).length);
  function diffSummary(df, short) {
    if (!df) return short ? 'Original' : '';
    const parts = [], nC = Object.keys(df.changed).length;
    if (nC) parts.push(`${nC} shot${nC > 1 ? 's' : ''} ${short ? 'edited' : 'rewritten'}`);
    if (df.added.length) parts.push(`${df.added.length} added`);
    if (df.removed.length) parts.push(`${df.removed.length} removed`);
    const nf = Object.keys(df.fields).filter(k => k !== 'spec').length, sp = df.fields.spec ? Object.keys(df.fields.spec).length : 0;
    if (sp) parts.push(short ? 'settings' : `${sp} setting${sp > 1 ? 's' : ''} changed`);
    if (nf) parts.push(short ? 'details' : 'plan details updated');
    if (df.dDur) parts.push(`${df.dDur > 0 ? '+' : '−'}${Math.abs(df.dDur)}s`);
    return parts.join(' · ') || 'No changes';
  }
  commitPlanVersion = function (p, _c, _w, note) {
    normPlan(p);
    const prev = JSON.parse(p.versions[p.versions.length - 1].data), cur = planFields(p);
    const diff = diffPlans(prev, cur);
    p.versions.push({ data: JSON.stringify(cur), note, at: nowHM(), diff });
    p.v = p.versions.length; p.view = null; p.edited = false; p.status = 'draft'; p.showDiff = true;
    p.changed = Object.keys(diff.changed).map(Number).concat(diff.added); p.was = {};
  };
  function planView(p) {
    normPlan(p);
    const last = p.versions.length - 1, vi = p.view == null ? last : p.view;
    const d = vi === last ? p : { ...p, ...JSON.parse(p.versions[vi].data) };
    const df = p.versions[vi].diff;
    return { d, vi, last, df, old: vi !== last, show: p.showDiff && hasDiff(df) };
  }

  function planHeadHTML(p, d, vi, old, df) {
    const tot = planDur(d), cr = credits(tot), prevTot = df ? tot - df.dDur : tot;
    const dl = (v, f) => df && v ? `<span class="dl" title="Change from v${vi}">${v > 0 ? '+' : '−'}${f(Math.abs(v))}</span>` : '';
    const st = old ? 'viewing' : p.status;
    const lbl = old ? 'Viewing' : { draft: 'Draft', building: 'Building', approved: 'Approved' }[p.status];
    const hidden = !p.showDiff && hasDiff(p.versions[vi].diff);
    let actions;
    if (old) actions = `<button class="btn sm" data-latest>Back to latest</button><button class="btn primary sm" data-restore="${vi}" title="Make this the newest version">${ic('history', 'sm')}<span class="lbl">Restore v${vi + 1}</span></button>`;
    else if (p.status === 'draft') actions = `<button class="btn sm" data-plan-revise title="Tell the assistant what to change">${ic('chat', 'sm')}<span class="lbl">Request changes</span></button><button class="btn primary sm" data-plan-approve="${p.id}" title="Approve the plan and build the scenes">${ic('check', 'sm')}<span class="lbl">Approve & build</span></button>`;
    else if (p.status === 'building') actions = `<button class="btn primary sm" disabled><span class="spin"></span><span class="lbl">Building…</span></button>`;
    else actions = `<button class="btn sm" data-plan-reopen title="Unlock the plan for a new version">${ic('edit', 'sm')}<span class="lbl">Revise</span></button><button class="btn primary sm" data-plan-close><span class="lbl">Open editor</span>${ic('arrow-right', 'sm')}</button>`;
    return `<header class="pl-head">
      <div class="pl-tb">
        <div class="pl-trow"><input class="pl-title" id="plTitleIn" value="${esc(d.title)}" ${old || p.status !== 'draft' ? 'readonly' : ''} aria-label="Plan title">
          <button class="vpill" data-plan-vers title="Versions"><i class="sdot ${st}"></i>${lbl} · v${vi + 1}${ic('down', 'sm')}</button></div>
        <div class="pl-meta">
          <span title="Duration">${ic('clock')}${fmt(tot)}${dl(df && df.dDur, x => x + 's')}</span>
          <span title="Shots">${ic('scenes')}${d.shots.length} shots${dl(df && df.dShots, x => x)}</span>
          <span title="Aspect ratio">${ic('ratio')}${d.aspect}</span>
          <span title="Language">${ic('globe')}${d.lang}</span>
          <span title="Estimated render cost">${ic('zap')}≈ ${cr} credits${dl(df ? cr - credits(prevTot) : 0, x => x)}</span>
          ${p.edited && !old ? `<span class="edited" title="Your edits become part of the next version">Edited since v${vi + 1}</span>` : ''}
          ${hidden ? `<button class="chgpill" data-diff-toggle>${ic('sparkles')}Show changes</button>` : ''}
        </div>
      </div>
      <div class="pl-actions">${actions}
        <button class="ib sm" data-plan-more title="More">${ic('more')}</button>
        <button class="ib sm" data-plan-close title="Close (Esc)">${ic('x')}</button></div>
    </header>`;
  }
  function planNavHTML(p, d, vi, df) {
    const tot = planDur(d);
    const secChanged = sid => df && (d.shots.some(s => s.sec === sid && (df.changed[s.id] || df.added.includes(s.id))) || df.removed.some(r => r.sec === sid));
    return `<nav class="pl-nav" id="plNav">
      <div class="navh">Plan</div>
      <a data-jump="ov" class="on">${ic('file', 'sm')}Overview</a>
      <a data-jump="strat">${ic('target', 'sm')}Strategy</a>
      <a data-jump="subj">${ic('user', 'sm')}Subjects<small>${d.subjects.length + 1}</small></a>
      <div class="navh"><span>Shot script</span><small>${d.shots.length} · ${fmt(tot)}</small></div>
      ${d.sections.map(s => {
        const sd = secDur(d, s.id), c = d.shots.filter(x => x.sec === s.id).length;
        return `<a class="nsec" data-jump="sec-${s.id}">${secChanged(s.id) ? '<span class="cdot" title="Changed in this version"></span>' : ''}<span class="nsec-t"><span>${esc(s.name)}</span><small>${c} · ${fmt(sd)}</small></span><i class="nbar"><b style="width:${tot ? sd / tot * 100 : 0}%"></b></i></a>`;
      }).join('')}
      <div class="navh"><span>Versions</span><small>${p.versions.length}</small></div>
      <div class="vlist">${p.versions.map((v, i) => ({ v, i })).reverse().map(({ v, i }) =>
        `<button class="vitem ${i === vi ? 'on' : ''}" data-pv="${i}"><span class="vdot"></span><span style="min-width:0"><b>v${i + 1}</b> ${esc(v.note)}<small>${esc(v.at)} · ${esc(diffSummary(v.diff, true))}</small></span></button>`).join('')}</div>
    </nav>`;
  }
  function shotHTML2(d, s, c, isNew, ro, vi) {
    const n = d.shots.indexOf(s) + 1, v = d.aspect === '9:16', ce = `contenteditable="${!ro}"`, o = c || {};
    const was = k => o[k] != null ? `<span class="wasl">${esc(o[k])}</span>` : '';
    return `<article class="pl-card shot ${c || isNew ? 'changed' : ''}" id="shot-${s.id}">
      ${isNew ? `<span class="rev-b new">New in v${vi + 1}</span>` : c ? `<span class="rev-b">Changed in v${vi + 1}</span>` : ''}
      <div class="sb"><span class="no">S${n}</span><div class="fr ${v ? 'v916' : 'v169'}" style="background-image:url(https://picsum.photos/seed/${s.img}/${v ? '128/228' : '224/126'})"><span class="ot">${esc(s.ost)}</span></div></div>
      <div style="min-width:0">
        <div class="shot-top"><div style="flex:1;min-width:0"><div class="vis ed ${o.vis != null ? 'hl' : ''}" ${ce} data-pf="shot.${s.id}.vis">${esc(s.vis)}</div>${was('vis')}</div>
          ${!ro ? `<div class="sacts"><button class="ib xs" data-ai="Rewrite shot S${n}" title="Rewrite with AI">${ic('sparkles', 'sm spark')}</button><button class="ib xs" data-shot-dup="${s.id}" title="Duplicate">${ic('dup', 'sm')}</button><button class="ib xs" data-shot-del="${s.id}" title="Delete">${ic('trash', 'sm')}</button></div>` : ''}
          <span class="durp ${o.dur != null ? 'hl' : ''}" title="${o.dur != null ? `Was ${o.dur}s` : 'Duration in seconds'}">${ic('clock', 'sm')}<span class="ed" ${ce} data-pf="shot.${s.id}.dur">${s.dur}</span>s</span></div>
        <div class="kv"><label>${ic('mic')}Voiceover</label><div class="box ${o.vo != null ? 'hl' : ''}"><div class="ed" ${ce} data-pf="shot.${s.id}.vo">${esc(s.vo)}</div>${was('vo')}</div></div>
        <div class="kv"><label>${ic('type')}On-screen</label><div class="box ost ${o.ost != null ? 'hl' : ''}"><div class="ed" ${ce} data-pf="shot.${s.id}.ost">${esc(s.ost)}</div>${was('ost')}</div></div>
        <div class="stags"><span class="stag">${ic('cam')}${esc(s.cam)}</span><span class="stag">${ic('motion')}${esc(s.move)}</span><span class="stag">${ic('refresh')}${esc(s.trans)}</span>${!ro ? `<button class="stag add" data-toast="Add a camera or lighting note">${ic('plus')}</button>` : ''}</div>
      </div></article>`;
  }
  renderPlan = function () {
    const p = plans[planOpen]; if (!p) return;
    const { d, vi, last, df, old, show } = planView(p);
    const m0 = $('#plMain'), st = m0 ? m0.scrollTop : 0;
    const ro = old || p.status !== 'draft', ce = `contenteditable="${!ro}"`;
    const tot = planDur(d), ch = show ? df.changed : {}, added = show ? df.added : [], F = show ? df.fields : {};
    const was = v => v != null ? `<span class="wasl">${esc(v)}</span>` : '';
    $('#plan').innerHTML = `${planHeadHTML(p, d, vi, old, show ? df : null)}
      <div class="pl-bodyw">${planNavHTML(p, d, vi, show ? df : null)}
        <div class="pl-main" id="plMain"><div class="pl-wrap">
          ${old ? `<div class="oldv">${ic('history', 'sm')}<span style="flex:1">You’re viewing <b>v${vi + 1}</b> · ${esc(p.versions[vi].note)} — read-only.</span><button class="lnk" data-latest>Back to v${last + 1}</button></div>` : ''}
          ${show ? `<div class="chg"><span class="chg-ic">${ic('sparkles', 'sm')}</span><div class="chg-t"><b>What changed in v${vi + 1}</b>${esc(diffSummary(df))} · compared with v${vi}</div>
            ${Object.keys(df.changed).length + df.added.length ? `<button class="btn ghost sm" data-next-change>Next change${ic('down', 'sm')}</button>` : ''}
            <button class="ib sm" data-diff-toggle title="Hide highlights">${ic('x', 'sm')}</button></div>` : ''}
          <section class="pl-sec" id="pj-ov"><div class="pl-card ov">
            <p class="summary ed ${F.summary != null ? 'hl' : ''}" ${ce} data-pf="summary">${esc(d.summary)}</p>${was(F.summary)}
            <div class="pace"><div class="pace-bar">${d.sections.map(s => `<i data-sec="${s.id}" style="flex:${secDur(d, s.id) || .001} 1 0"></i>`).join('')}</div>
              <div class="pace-lb">${d.sections.map(s => `<span data-sec="${s.id}" style="flex:${secDur(d, s.id) || .001} 1 0"><b>${esc(s.name)}</b> ${fmt(secDur(d, s.id))}</span>`).join('')}</div></div>
          </div></section>
          <section class="pl-sec" id="pj-strat"><h3>${ic('target')}Strategy</h3><div class="pl-card strat2">
            ${d.strategy.map((f, i) => { const o = F.strategy && F.strategy[i]; return `<div class="sf2"><div class="sf2-l">${ic(f.icon, 'sm')}${esc(f.k)}</div><div class="v ed ${o != null ? 'hl' : ''}" ${ce} data-pf="strategy.${i}">${esc(f.v)}</div>${was(o)}</div>`; }).join('')}
          </div></section>
          <section class="pl-sec" id="pj-subj"><h3>${ic('user')}Subjects${!ro ? `<button class="btn ghost sm r" data-toast="Add a character, scene or product">${ic('plus', 'sm')}Add</button>` : ''}</h3>
            <div class="pl-card" style="overflow:hidden">
              <div class="voice-row"><span class="sic">${ic('mic', 'sm')}</span>
                <div style="flex:1;min-width:0"><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b>Voice · ${esc(d.voiceName)}</b>${d.voice.tags.map(t => `<span class="tagc">${t}</span>`).join('')}</div>
                <small class="muted ed ${F.voice != null ? 'hl' : ''}" ${ce} data-pf="voice">${esc(d.voice.desc)}</small>${was(F.voice)}</div>
                <button class="btn sm" data-toast="Playing voice sample…">${ic('play', 'sm')}Preview</button></div>
              <div class="subj-grid">${d.subjects.map((it, i) => { const o = F.subj && F.subj[i]; return `<div class="sj">${refHTML(it.ref)}<div style="min-width:0"><span class="kb2">${it.kind}</span><div><b>${esc(it.name)}</b>${it.role ? `<span class="muted"> · ${it.role}</span>` : ''}</div><p class="ed ${o != null ? 'hl' : ''}" ${ce} data-pf="subj.${i}">${esc(it.desc)}</p>${was(o)}</div></div>`; }).join('')}</div>
            </div></section>
          <section class="pl-sec" id="pj-shots"><h3>${ic('scenes')}Shot script<span class="r muted" style="font-weight:500;font-size:12px">${d.shots.length} shots · ${fmt(tot)}</span></h3>
            ${d.sections.map(sec => {
              const ss = d.shots.filter(s => s.sec === sec.id), gone = show ? df.removed.filter(r => r.sec === sec.id) : [];
              if (!ss.length && !gone.length) return '';
              const secCh = gone.length || ss.some(s => ch[s.id] || added.includes(s.id));
              return `<div class="sec-h" id="pj-sec-${sec.id}">${secCh ? '<span class="cdot2" title="Changed in this version"></span>' : '<span class="dot"></span>'}${esc(sec.name)}<small>${ss.length} shot${ss.length !== 1 ? 's' : ''} · ${fmt(secDur(d, sec.id))}</small><span class="grow"></span>${!ro ? `<button class="btn ghost sm" data-ai="Rewrite the ${esc(sec.name.toLowerCase())} section">${ic('sparkles', 'sm spark')}Rewrite</button>` : ''}</div>`
                + ss.map(s => shotHTML2(d, s, ch[s.id], added.includes(s.id), ro, vi)).join('')
                + gone.map(r => `<div class="shot-ghost">${ic('trash', 'sm')}<b>S${r.n} removed</b><s>${esc(r.vo)}</s></div>`).join('');
            }).join('')}
            ${!ro ? `<button class="add-shot" data-shot-add>${ic('plus', 'sm')}Add shot</button>` : ''}
          </section>
        </div></div>
      </div>`;
    $('#plMain').scrollTop = st;
    spyPace();
  };
  function spyPace() {
    const a = $('#plNav a.on'), sid = a && a.dataset.jump.startsWith('sec-') ? a.dataset.jump.slice(4) : null;
    $$('#plan .pace-bar i, #plan .pace-lb span').forEach(x => x.classList.toggle('on', x.dataset.sec === sid));
  }
  $('#plan').addEventListener('scroll', spyPace, true);
  // keep the header's "edited" state in sync after inline edits
  $('#plan').addEventListener('focusout', () => setTimeout(() => {
    const p = plans[planOpen]; if (!p || !p.edited || $('#plan .pl-meta .edited')) return;
    const { d, vi, old, df, show } = planView(p); const h = $('#plan .pl-head'); if (h) h.outerHTML = planHeadHTML(p, d, vi, old, show ? df : null);
  }, 0));

  function openMenuAt(btn, html) {
    closeMenu();
    const r = btn.getBoundingClientRect(), m = document.createElement('div');
    m.className = 'cmenu'; m.id = 'cmenu'; m.innerHTML = html; layer.appendChild(m);
    m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + 'px';
    m.style.top = Math.min(r.bottom + 6, innerHeight - m.offsetHeight - 8) + 'px';
  }
  const versMenuHTML = p => {
    const { vi } = planView(p);
    return `<div class="mh">Versions</div>` + p.versions.map((v, i) => ({ v, i })).reverse().map(({ v, i }) =>
      `<button data-pv="${i}" class="${i === vi ? 'on' : ''}">${ic(i === vi ? 'check' : 'history')}v${i + 1} · ${esc(v.note)}<small>${esc(diffSummary(v.diff, true))}</small></button>`).join('')
      + `<hr><button data-diff-toggle>${ic(p.showDiff ? 'check' : 'sparkles')}Highlight changes</button>`;
  };

  /* plan interactions — run before the generic handlers */
  on(window, 'click', e => { if (outside(e)) return;
    const p = plans[planOpen]; if (!p) return;
    const t = e.target, hit = s => t.closest(s), stop = () => e.stopPropagation();
    let el;
    if ((el = hit('[data-pv]'))) { stop(); closeMenu(); const i = +el.dataset.pv; p.view = i === p.versions.length - 1 ? null : i; renderPlan(); $('#plMain').scrollTop = 0; renderCtx(); return; }
    if ((el = hit('[data-plan-vers]'))) { stop(); openMenuAt(el, versMenuHTML(p)); return; }
    if ((el = hit('[data-plan-more]'))) { stop(); openMenuAt(el, `<button data-plan-copy2>${ic('copy')}Copy voiceover script</button><button data-toast="Exported plan as PDF">${ic('file')}Export as PDF</button><button data-toast="Plan duplicated">${ic('dup')}Duplicate plan</button>`); return; }
    if (hit('[data-plan-copy2]')) {
      stop(); closeMenu();
      const txt = planView(p).d.shots.map((s, i) => `S${i + 1} (${s.dur}s) — ${s.vo}`).join('\n');
      (navigator.clipboard?.writeText(txt) || Promise.reject()).then(() => toast('Voiceover script copied'), () => toast('Copy isn’t available here'));
      return;
    }
    if (hit('[data-diff-toggle]')) { stop(); closeMenu(); p.showDiff = !p.showDiff; renderPlan(); return; }
    if (hit('[data-latest]')) { stop(); p.view = null; renderPlan(); renderCtx(); return; }
    if ((el = hit('[data-restore]'))) {
      stop(); const i = +el.dataset.restore;
      Object.assign(p, JSON.parse(p.versions[i].data)); p.status = 'draft';
      commitPlanVersion(p, 0, 0, `Restored v${i + 1}`);
      renderPlan(); updatePlanCards(p.id); renderCtx(); toast(`Restored v${i + 1} as v${p.v}`); return;
    }
    if (hit('[data-next-change]')) {
      stop(); const list = $$('#plMain .shot.changed'); if (!list.length) return;
      const top = $('#plMain').getBoundingClientRect().top + 90;
      const nx = list.find(x => x.getBoundingClientRect().top > top) || list[0];
      nx.scrollIntoView({ behavior: 'smooth', block: 'center' }); nx.classList.remove('flash'); void nx.offsetWidth; nx.classList.add('flash'); return;
    }
    if (hit('[data-plan-revise]')) { stop(); focusAsk(); const c = $('#composer'); c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse'); return; }
  }, true);

  /* approving saves inline edits as their own version first */
  const _approvePlan = approvePlan;
  approvePlan = async function (id) {
    const p = plans[id]; if (!p) return;
    normPlan(p); p.view = null;
    if (p.edited) commitPlanVersion(p, 0, 0, 'Your edits');
    await _approvePlan(id);
    p.showDiff = false; if (planOpen === id) renderPlan();
  };

  /* the seeded plan gets a short history so versions are visible from the start */
  (() => {
    const p = plans['p-seed']; normPlan(p);
    const v1 = JSON.parse(p.versions[0].data);
    v1.shots[1].vo = 'Over the next two minutes we will review three security practices that every employee is required to follow.';
    v1.shots[6].vo = 'In summary: three habits, applied consistently.';
    v1.strategy[4].v = 'Neutral → informed';
    p.versions = [{ data: JSON.stringify(v1), note: 'First draft from memo', at: '09:10', diff: null },
      { data: JSON.stringify(planFields(p)), note: 'Friendlier tone', at: '09:12', diff: diffPlans(v1, planFields(p)) }];
    p.v = 2;
  })();

  /* ================= v5: minimal plan page · specs & model pickers ================= */
  $('svg defs').insertAdjacentHTML('beforeend', `
    <symbol id="i-chip" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></symbol>
    <symbol id="i-wave" viewBox="0 0 24 24"><path d="M2 10v4M6 6v12M10 3v18M14 8v8M18 5v14M22 10v4"/></symbol>`);
  const VIDEO_MODELS = [
    { id: 'motion-std', name: 'Motion Standard', desc: 'Fast renders — great for talking heads and graphics', mult: 1 },
    { id: 'motion-pro', name: 'Motion Pro', desc: 'Sharper detail and smoother camera moves', mult: 2 },
    { id: 'cinematic', name: 'Cinematic Ultra', desc: 'Film-grade lighting and depth; slowest', mult: 4 },
  ];
  const VOICE_MODELS = [
    { id: 'natural', name: 'Voice Natural', desc: 'Clear, steady narration', add: 0 },
    { id: 'expressive', name: 'Voice Expressive', desc: 'More emotion and pacing control', add: 1 },
  ];
  const LANGS = ['English', 'Türkçe', 'Deutsch', 'Español', 'Français'];
  const RATIOS = [['16:9', 'Landscape · YouTube, LMS'], ['9:16', 'Vertical · Reels, Shorts'], ['1:1', 'Square · feeds'], ['4:5', 'Portrait · feeds']];
  const SPEC_KEYS = ['aspect', 'lang', 'voiceName', 'videoModel', 'voiceModel'];
  const vmOf = id => VIDEO_MODELS.find(m => m.id === id) || VIDEO_MODELS[0];
  const voOf = id => VOICE_MODELS.find(m => m.id === id) || VOICE_MODELS[0];
  function creditsOf(d) {
    const vid = d.shots.reduce((a, s) => a + s.dur / 10 * vmOf(s.model || d.videoModel).mult, 0);
    return Math.max(1, Math.ceil(vid + voOf(d.voiceModel).add * planDur(d) / 30));
  }
  const planFields2 = p => ({ ...planFields(p), ...Object.fromEntries(SPEC_KEYS.map(k => [k, p[k]])) });

  const _normPlan4 = normPlan;
  normPlan = function (p) {
    _normPlan4(p); p.videoModel = p.videoModel || 'motion-std'; p.voiceModel = p.voiceModel || 'natural';
    if (!p._specs) { // versions saved before plan settings existed get the settings the plan started with
      p._specs = true;
      p.versions.forEach(v => { const d = JSON.parse(v.data); if (d.videoModel === undefined) { SPEC_KEYS.forEach(k => d[k] = p[k]); v.data = JSON.stringify(d); } });
    }
  };
  const _diffPlans4 = diffPlans;
  diffPlans = function (a, b) {
    const df = _diffPlans4(a, b), am = new Map(a.shots.map(s => [s.id, s]));
    b.shots.forEach(s => { const o = am.get(s.id); if (o && (o.model || '') !== (s.model || '')) (df.changed[s.id] = df.changed[s.id] || {}).model = o.model || 'default'; });
    SPEC_KEYS.forEach(k => { if (a[k] !== undefined && a[k] !== b[k]) (df.fields.spec = df.fields.spec || {})[k] = a[k]; });
    df.dCr = creditsOf(b) - creditsOf(a);
    return df;
  };
  commitPlanVersion = function (p, _c, _w, note) {
    normPlan(p);
    const prev = JSON.parse(p.versions[p.versions.length - 1].data), cur = planFields2(p), diff = diffPlans(prev, cur);
    p.versions.push({ data: JSON.stringify(cur), note, at: nowHM(), diff });
    p.v = p.versions.length; p.view = null; p.edited = false; p.status = 'draft'; p.showDiff = true;
    p.changed = Object.keys(diff.changed).map(Number).concat(diff.added);
  };

  /* header: title + version, decisions on the right — no stats here */
  planHeadHTML = function (p, d, vi, old) {
    const st = old ? 'viewing' : p.status;
    const lbl = old ? 'Viewing' : { draft: 'Draft', building: 'Building', approved: 'Approved' }[p.status];
    let actions;
    if (old) actions = `<button class="btn sm" data-latest>Back to latest</button><button class="btn primary sm" data-restore="${vi}" title="Make this the newest version">${ic('history', 'sm')}<span class="lbl">Restore v${vi + 1}</span></button>`;
    else if (p.status === 'draft') actions = `<button class="btn sm" data-plan-revise title="Tell the assistant what to change">${ic('chat', 'sm')}<span class="lbl">Request changes</span></button><button class="btn primary sm" data-plan-approve="${p.id}" title="Approve the plan and build the scenes">${ic('check', 'sm')}<span class="lbl">Approve & build</span></button>`;
    else if (p.status === 'building') actions = `<button class="btn primary sm" disabled><span class="spin"></span><span class="lbl">Building…</span></button>`;
    else actions = `<span class="pl-done">${ic('check-c', 'sm')}${p.built ? `${p.built} scenes built` : 'Approved'}</span><button class="btn sm" data-plan-reopen title="Unlock the plan for a new version">${ic('edit', 'sm')}<span class="lbl">Revise</span></button>`;
    return `<header class="pl-head">
      <div class="pl-tb"><div class="pl-trow">
        <input class="pl-title" id="plTitleIn" value="${esc(d.title)}" ${old || p.status !== 'draft' ? 'readonly' : ''} aria-label="Plan title">
        <button class="vpill" data-plan-vers title="Versions"><i class="sdot ${st}"></i>${lbl} · v${vi + 1}${ic('down', 'sm')}</button>
        ${p.edited && !old ? '<span class="edited" title="Your edits become part of the next version">Edited</span>' : ''}
      </div></div>
      <div class="pl-actions">${actions}
        <button class="ib sm" data-plan-more title="More">${ic('more')}</button>
        <button class="ib sm" data-plan-close title="Close (Esc)">${ic('x')}</button></div>
    </header>`;
  };

  /* spec bar: the plan's settings + live cost, sticky while you read */
  function specsHTML(p, d, old, df) {
    const ro = old || p.status !== 'draft', tot = planDur(d), S = (df && df.fields.spec) || {};
    const dl = (v, f) => df && v ? `<span class="dl" title="Change from the previous version">${v > 0 ? '+' : '−'}${f(Math.abs(v))}</span>` : '';
    const pill = (key, icon, label, title) => ro
      ? `<span class="spec ${S[key] !== undefined ? 'hl' : ''}" title="${title}">${ic(icon)}${esc(label)}</span>`
      : `<button class="spec ${S[key] !== undefined ? 'hl' : ''}" data-spec="${key}" title="${title}">${ic(icon)}${esc(label)}${ic('down')}</button>`;
    const secCh = sid => df && (d.shots.some(s => s.sec === sid && (df.changed[s.id] || df.added.includes(s.id))) || df.removed.some(r => r.sec === sid));
    return `<div class="specs"><div class="spec-r1">
      ${pill('aspect', 'ratio', d.aspect, 'Aspect ratio')}
      ${pill('lang', 'globe', d.lang, 'Language')}
      ${pill('voiceName', 'mic', d.voiceName, 'Voice')}
      ${pill('videoModel', 'chip', vmOf(d.videoModel).name, 'Video model — used by every shot unless a shot overrides it')}
      ${pill('voiceModel', 'wave', voOf(d.voiceModel).name, 'Voice model')}
      <span class="spec cost" id="plCost" title="Estimated render cost for this plan">${ic('zap')}≈ ${creditsOf(d)} credits${dl(df && df.dCr, x => x)}</span></div>
      <div class="spec-r2"><div class="spec-pace">${d.sections.map(s => `<button data-jump="sec-${s.id}" data-sec="${s.id}" class="${secCh(s.id) ? 'ch' : ''}" style="flex:${secDur(d, s.id) || .001} 1 0" title="${esc(s.name)} · ${fmt(secDur(d, s.id))}"><i></i><span>${esc(s.name)}</span></button>`).join('')}</div>
      <span class="spec ro" title="Total duration and shots">${ic('clock')}${fmt(tot)}${dl(df && df.dDur, x => x + 's')}<span class="muted">·</span>${d.shots.length} shots${dl(df && df.dShots, x => x)}</span></div>
    </div>`;
  }
  const ck = (on) => `<span class="ck">${on ? ic('check', 'sm') : ''}</span>`;
  function specMenuHTML(p, key) {
    const cur = p[key];
    if (key === 'aspect') return `<div class="mh">Aspect ratio</div>` + RATIOS.map(([v, dsc]) => `<button class="tall" data-specv="aspect|${v}">${ck(v === cur)}<span class="mo"><b>${v}</b><small>${dsc}</small></span></button>`).join('');
    if (key === 'lang') return `<div class="mh">Language</div>` + LANGS.map(v => `<button data-specv="lang|${v}">${ck(v === cur)}${v}</button>`).join('');
    if (key === 'voiceName') return `<div class="mh">Voice</div>` + AV.map(a => `<button class="tall" data-specv="voiceName|${a.name}">${ck(a.name === cur)}<span class="mo"><b>${a.name}</b><small>${a.meta}</small></span></button>`).join('');
    if (key === 'videoModel') return `<div class="mh">Video model</div>` + VIDEO_MODELS.map(m => `<button class="tall" data-specv="videoModel|${m.id}">${ck(m.id === cur)}<span class="mo"><b>${m.name}</b><small>${m.desc}</small></span><em>×${m.mult}</em></button>`).join('');
    return `<div class="mh">Voice model</div>` + VOICE_MODELS.map(m => `<button class="tall" data-specv="voiceModel|${m.id}">${ck(m.id === cur)}<span class="mo"><b>${m.name}</b><small>${m.desc}</small></span><em>${m.add ? `+${m.add} / 30s` : 'included'}</em></button>`).join('');
  }
  function shotModelMenuHTML(p, s) {
    const n = p.shots.indexOf(s) + 1;
    return `<div class="mh">Model for S${n}</div><button class="tall" data-shotmv="${s.id}|">${ck(!s.model)}<span class="mo"><b>Plan default</b><small>${vmOf(p.videoModel).name}</small></span></button>`
      + VIDEO_MODELS.map(m => `<button class="tall" data-shotmv="${s.id}|${m.id}">${ck(s.model === m.id)}<span class="mo"><b>${m.name}</b><small>${m.desc}</small></span><em>×${m.mult}</em></button>`).join('');
  }
  function modelChip(s, d, ro, changed) {
    const m = vmOf(s.model || d.videoModel);
    return `<button class="stag model ${s.model ? 'set' : ''} ${changed ? 'hl' : ''}" data-shotmodel="${s.id}" ${ro ? 'disabled' : ''} title="${s.model ? 'Model override for this shot' : 'Uses the plan’s video model — click to override'}">${ic('chip')}${esc(m.name)}${s.model ? '' : '<i>· default</i>'}</button>`;
  }

  /* single column: drop the side menu, put the spec bar first */
  const _renderPlan4 = renderPlan;
  renderPlan = function () {
    const p = plans[planOpen]; if (!p) return;
    const m0 = $('#plMain'), st = m0 ? m0.scrollTop : 0;
    _renderPlan4();
    const { d, old, df, show } = planView(p), ro = old || p.status !== 'draft';
    $('#plNav')?.remove();
    $('#pj-ov .pace')?.remove();
    $('#plMain .pl-wrap').insertAdjacentHTML('afterbegin', specsHTML(p, d, old, show ? df : null));
    d.shots.forEach(s => {
      const tags = $(`#shot-${s.id} .stags`); if (!tags) return;
      const c = show && df.changed[s.id];
      tags.insertAdjacentHTML('afterbegin', modelChip(s, d, ro, c && c.model !== undefined));
    });
    $('#plMain').scrollTop = st;
    spyPace2();
  };
  function spyPace2() {
    const main = $('#plMain'); if (!main) return;
    const top = main.getBoundingClientRect().top + 120; let sid = null;
    $$('#plMain .sec-h').forEach(h => { if (h.getBoundingClientRect().top <= top) sid = h.id.replace('pj-sec-', ''); });
    $$('#plan .spec-pace button').forEach(x => x.classList.toggle('on', x.dataset.sec === sid));
  }
  $('#plan').addEventListener('scroll', spyPace2, true);

  on(window, 'click', e => { if (outside(e)) return;
    const p = plans[planOpen]; if (!p) return;
    const t = e.target; let el;
    if ((el = t.closest('[data-spec]'))) { e.stopPropagation(); openMenuAt(el, specMenuHTML(p, el.dataset.spec)); $('#cmenu').style.left = el.getBoundingClientRect().left + 'px'; return; }
    if ((el = t.closest('[data-shotmodel]'))) { e.stopPropagation(); const s = p.shots.find(x => x.id === +el.dataset.shotmodel); openMenuAt(el, shotModelMenuHTML(p, s)); $('#cmenu').style.left = Math.min(el.getBoundingClientRect().left, innerWidth - $('#cmenu').offsetWidth - 8) + 'px'; return; }
    const apply = (fn, label) => {
      e.stopPropagation(); closeMenu();
      const before = creditsOf(p); fn(); p.edited = true;
      renderPlan(); updatePlanCards(p.id); markSaving();
      const after = creditsOf(p);
      if (after !== before) { toast(`${label} · ≈ ${after} credits (${after > before ? '+' : '−'}${Math.abs(after - before)})`); $('#plCost')?.classList.add('flash'); }
      else toast(label);
    };
    if ((el = t.closest('[data-specv]'))) {
      const [k, v] = el.dataset.specv.split('|');
      const name = k === 'videoModel' ? vmOf(v).name : k === 'voiceModel' ? voOf(v).name : v;
      apply(() => { p[k] = v; }, `${{ aspect: 'Aspect ratio', lang: 'Language', voiceName: 'Voice', videoModel: 'Video model', voiceModel: 'Voice model' }[k]}: ${name}`);
      return;
    }
    if ((el = t.closest('[data-shotmv]'))) {
      const [id, m] = el.dataset.shotmv.split('|'), s = p.shots.find(x => x.id === +id);
      apply(() => { if (m) s.model = m; else delete s.model; }, `S${p.shots.indexOf(s) + 1}: ${m ? vmOf(m).name : 'plan default'}`);
    }
  }, true);

  /* ================= v6: document-style plan · generation pipeline ================= */
  $('svg defs').insertAdjacentHTML('beforeend', `
    <symbol id="i-link" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></symbol>
    <symbol id="i-scissors" viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/></symbol>
    <symbol id="i-layers" viewBox="0 0 24 24"><path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/></symbol>`);

  /* node catalogue — swap names/costs for your real models */
  const NODES = {
    image: { label: 'Image', icon: 'image', hint: 'Text → image', per: 'shot', models: [
      { id: 'still-turbo', name: 'Still Turbo', desc: 'Drafts in seconds', cost: .1 },
      { id: 'still-xl', name: 'Still XL', desc: 'Balanced quality and speed', cost: .2 },
      { id: 'still-photo', name: 'Still Photoreal', desc: 'Photographic detail, slower', cost: .4 }] },
    video: { label: 'Video', icon: 'video', hint: 'Image → video', per: 'sec', models: [
      { id: 'motion-std', name: 'Motion Standard', desc: 'Fast, good for simple motion', cost: 1 },
      { id: 'motion-pro', name: 'Motion Pro', desc: 'Sharper detail, smoother camera', cost: 2 },
      { id: 'cinematic', name: 'Cinematic Ultra', desc: 'Film-grade lighting and depth', cost: 4 }] },
    frame: { label: 'Frame extract', icon: 'scissors', hint: 'Continuity between shots', per: 'shot', optional: true, models: [
      { id: 'last', name: 'Last frame', desc: 'Final frame seeds the next shot', cost: 0 },
      { id: 'best', name: 'Best frame · AI', desc: 'Picks the sharpest, most stable frame', cost: .05 }] },
    upscale: { label: 'Upscale', icon: 'expand', hint: 'Final resolution', per: 'shot', optional: true, models: [
      { id: '2x', name: 'Upscale 2×', desc: '1080p → 4K-ready', cost: .1 },
      { id: '4k', name: 'Upscale 4K', desc: 'Detail-preserving 4K', cost: .3 }] },
    avatar: { label: 'Avatar', icon: 'user', hint: 'Presenter render', per: 'sec', models: [
      { id: 'av-lite', name: 'Avatar Lite', desc: 'Head and shoulders', cost: .5 },
      { id: 'av-studio', name: 'Avatar Studio', desc: 'Full gestures and expressions', cost: 1 }] },
    lipsync: { label: 'Lip-sync', icon: 'wave', hint: 'Mouth matches voice', per: 'sec', models: [
      { id: 'sync-lite', name: 'Sync Lite', desc: 'Good for medium shots', cost: .3 },
      { id: 'sync-studio', name: 'Sync Studio', desc: 'Close-up accuracy', cost: .8 }] },
    voice: { label: 'Voice', icon: 'mic', hint: 'Text → speech', per: '30s', models: [
      { id: 'natural', name: 'Voice Natural', desc: 'Clear, steady narration', cost: 0 },
      { id: 'expressive', name: 'Voice Expressive', desc: 'More emotion and pacing control', cost: 1 }] },
    template: { label: 'Motion template', icon: 'motion', hint: 'Brand animation', fixed: true, models: [{ id: 'brand', name: 'Brand motion', cost: 0 }] },
  };
  const KINDS = {
    presenter: { label: 'Presenter', icon: 'user', desc: 'Avatar speaks to camera' },
    broll: { label: 'B-roll', icon: 'video', desc: 'Generated · image → video' },
    graphic: { label: 'Motion graphic', icon: 'shapes', desc: 'Still image + brand motion' },
  };
  const PATHS = { broll: ['image', 'video', 'frame', 'upscale'], presenter: ['avatar', 'lipsync', 'upscale'], graphic: ['image', 'template', 'upscale'] };
  const DEFAULT_PIPE = { image: 'still-xl', video: 'motion-std', frame: 'last', frameOn: true, upscale: '2x', upscaleOn: false, avatar: 'av-lite', lipsync: 'sync-lite', voice: 'natural', template: 'brand' };
  const modelOf = (n, id) => NODES[n].models.find(m => m.id === id) || NODES[n].models[0];
  const kindOf = s => s.kind || (/Oliver/.test(s.vis) ? 'presenter'
    : /counter|end card|split screen|flags appear|dashboard|title|stat|cards reveal|headline|button pulses|progress bar/i.test(s.vis) ? 'graphic' : 'broll');
  const pipeOf = d => d.pipe || DEFAULT_PIPE;
  const pathOf = (d, s) => PATHS[kindOf(s)].filter(n => !NODES[n].optional || pipeOf(d)[n + 'On']);
  const shotModel = (d, s, n) => modelOf(n, (s.models && s.models[n]) || pipeOf(d)[n]);
  function shotCost(d, s) { return pathOf(d, s).reduce((a, n) => a + (NODES[n].per === 'sec' ? s.dur / 10 : 1) * (shotModel(d, s, n).cost || 0), 0); }
  function costBreak(d) {
    const b = {};
    d.shots.forEach(s => pathOf(d, s).forEach(n => { const c = (NODES[n].per === 'sec' ? s.dur / 10 : 1) * (shotModel(d, s, n).cost || 0); b[n] = (b[n] || 0) + c; }));
    b.voice = planDur(d) / 30 * modelOf('voice', pipeOf(d).voice).cost;
    return b;
  }
  const credits2 = d => Math.max(1, Math.ceil(Object.values(costBreak(d)).reduce((a, x) => a + x, 0) - 1e-9));
  const costLabel = (n, m) => NODES[n].fixed ? '' : NODES[n].per === 'sec' ? `${m.cost} cr / 10s` : NODES[n].per === '30s' ? (m.cost ? `+${m.cost} / 30s` : 'included') : m.cost ? `${m.cost} cr / shot` : 'free';

  /* versions now carry the pipeline and per-shot choices */
  const planFields3 = p => ({ ...planFields2(p), pipe: { ...p.pipe } });
  const _normPlan5 = normPlan;
  normPlan = function (p) {
    _normPlan5(p);
    if (!p.pipe) p.pipe = { ...DEFAULT_PIPE, video: p.videoModel || DEFAULT_PIPE.video, voice: p.voiceModel || DEFAULT_PIPE.voice };
    if (!p._pipe) { p._pipe = true; p.versions.forEach(v => { const d = JSON.parse(v.data); if (!d.pipe) { d.pipe = { ...p.pipe }; v.data = JSON.stringify(d); } }); }
  };
  const _diffPlans5 = diffPlans;
  diffPlans = function (a, b) {
    const df = _diffPlans5(a, b), am = new Map(a.shots.map(s => [s.id, s]));
    b.shots.forEach(s => {
      const o = am.get(s.id); if (!o) return;
      const c = df.changed[s.id] || {};
      if ((o.kind || '') !== (s.kind || '')) c.kind = KINDS[kindOf(o)].label;
      const om = o.models || {}, sm = s.models || {};
      new Set([...Object.keys(om), ...Object.keys(sm)]).forEach(n => { if (om[n] !== sm[n]) c['m_' + n] = om[n] ? modelOf(n, om[n]).name : 'plan default'; });
      delete c.model;
      if (Object.keys(c).length) df.changed[s.id] = c;
    });
    if (a.pipe && b.pipe) Object.keys(b.pipe).forEach(k => { if (a.pipe[k] !== b.pipe[k]) (df.fields.pipe = df.fields.pipe || {})[k] = a.pipe[k]; });
    if (df.fields.spec) { ['videoModel', 'voiceModel'].forEach(k => delete df.fields.spec[k]); if (!Object.keys(df.fields.spec).length) delete df.fields.spec; }
    df.dCr = credits2(b) - credits2(a);
    return df;
  };
  diffSummary = function (df, short) {
    if (!df) return short ? 'Original' : '';
    const parts = [], nC = Object.keys(df.changed).length, F = df.fields;
    if (nC) parts.push(`${nC} shot${nC > 1 ? 's' : ''} ${short ? 'edited' : 'changed'}`);
    if (df.added.length) parts.push(`${df.added.length} added`);
    if (df.removed.length) parts.push(`${df.removed.length} removed`);
    if (F.pipe) parts.push(short ? 'pipeline' : 'pipeline updated');
    if (F.spec) parts.push(short ? 'settings' : `${Object.keys(F.spec).length} setting${Object.keys(F.spec).length > 1 ? 's' : ''} changed`);
    if (Object.keys(F).filter(k => k !== 'spec' && k !== 'pipe').length) parts.push(short ? 'details' : 'plan details updated');
    if (df.dDur) parts.push(`${df.dDur > 0 ? '+' : '−'}${Math.abs(df.dDur)}s`);
    return parts.join(' · ') || 'No changes';
  };
  commitPlanVersion = function (p, _c, _w, note) {
    normPlan(p);
    const prev = JSON.parse(p.versions[p.versions.length - 1].data), cur = planFields3(p), diff = diffPlans(prev, cur);
    p.versions.push({ data: JSON.stringify(cur), note, at: nowHM(), diff });
    p.v = p.versions.length; p.view = null; p.edited = false; p.status = 'draft'; p.showDiff = true;
    p.changed = Object.keys(diff.changed).map(Number).concat(diff.added);
  };

  /* slim top bar: what it is + version, decisions on the right */
  planHeadHTML = function (p, d, vi, old) {
    const st = old ? 'viewing' : p.status;
    const lbl = old ? 'Viewing' : { draft: 'Draft', building: 'Building', approved: 'Approved' }[p.status];
    let actions;
    if (old) actions = `<button class="btn sm" data-latest>Back to latest</button><button class="btn primary sm" data-restore="${vi}" title="Make this the newest version">${ic('history', 'sm')}<span class="lbl">Restore v${vi + 1}</span></button>`;
    else if (p.status === 'draft') actions = `<button class="btn sm" data-plan-revise title="Tell the assistant what to change">${ic('chat', 'sm')}<span class="lbl">Request changes</span></button><button class="btn primary sm" data-plan-approve="${p.id}" title="Approve the plan and build the scenes">${ic('check', 'sm')}<span class="lbl">Approve & build</span></button>`;
    else if (p.status === 'building') actions = `<button class="btn primary sm" disabled><span class="spin"></span><span class="lbl">Building…</span></button>`;
    else actions = `<span class="pl-done">${ic('check-c', 'sm')}${p.built ? `${p.built} scenes built` : 'Approved'}</span><button class="btn sm" data-plan-reopen title="Unlock the plan for a new version">${ic('edit', 'sm')}<span class="lbl">Revise</span></button>`;
    return `<header class="pl-head">
      <div class="pl-kick">${ic('file', 'sm')}<span class="kl">Video plan</span><span class="pl-htitle">${esc(d.title)}</span>
        <button class="vpill" data-plan-vers title="Versions"><i class="sdot ${st}"></i>${lbl} · v${vi + 1}${ic('down', 'sm')}</button></div>
      <div class="pl-actions">${actions}
        <button class="ib sm" data-plan-more title="More">${ic('more')}</button>
        <button class="ib sm" data-plan-close title="Close (Esc)">${ic('x')}</button></div>
    </header>`;
  };

  /* title → facts → brief, like the top of a document */
  function docHeadHTML(p, d, vi, old, df) {
    const ro = old || p.status !== 'draft', tot = planDur(d), F = df ? df.fields : {}, S = F.spec || {};
    const dl = (v, f) => df && v ? `<span class="dl" title="Change from v${vi}">${v > 0 ? '+' : '−'}${f(Math.abs(v))}</span>` : '';
    const inl = (key, label, title) => ro ? `<span class="${S[key] !== undefined ? 'hlt' : ''}">${esc(label)}</span>`
      : `<button class="inl ${S[key] !== undefined ? 'hlt' : ''}" data-spec="${key}" title="${title}">${esc(label)}${ic('down')}</button>`;
    const secCh = sid => df && (d.shots.some(s => s.sec === sid && (df.changed[s.id] || df.added.includes(s.id))) || df.removed.some(r => r.sec === sid));
    return `<div class="doc-h">
      <input class="doc-title ${F.title != null ? 'hl' : ''}" id="plTitleIn" value="${esc(d.title)}" ${ro ? 'readonly' : ''} aria-label="Plan title">
      ${F.title != null ? `<span class="wasl">${esc(F.title)}</span>` : ''}
      <div class="doc-meta">
        <span title="Total duration">${ic('clock')}${fmt(tot)}${dl(df && df.dDur, x => x + 's')}</span>
        <span title="Shots">${ic('scenes')}${d.shots.length} shots${dl(df && df.dShots, x => x)}</span>
        <span>${ic('ratio')}${inl('aspect', d.aspect, 'Aspect ratio')}</span>
        <span>${ic('globe')}${inl('lang', d.lang, 'Language')}</span>
        <span id="plCost" title="Estimated render cost — breakdown in Generation pipeline">${ic('zap')}≈ ${credits2(d)} credits${dl(df && df.dCr, x => x)}</span>
        ${p.edited && !old ? `<span class="edited" title="Your edits become part of the next version">Edited since v${vi + 1}</span>` : ''}
      </div>
      <p class="summary ed ${F.summary != null ? 'hl' : ''}" contenteditable="${!ro}" data-pf="summary">${esc(d.summary)}</p>
      ${F.summary != null ? `<span class="wasl">${esc(F.summary)}</span>` : ''}
      <div class="doc-pace">${d.sections.map(s => `<button data-jump="sec-${s.id}" class="${secCh(s.id) ? 'ch' : ''}" style="flex:${secDur(d, s.id) || .001} 1 0" title="Go to ${esc(s.name)}"><i></i><span><b>${esc(s.name)}</b> ${fmt(secDur(d, s.id))}</span></button>`).join('')}</div>
    </div>`;
  }

  function pipeHTML(p, d, ro, df) {
    const P = pipeOf(d), C = (df && df.fields.pipe) || {};
    const count = k => d.shots.filter(s => kindOf(s) === k).length;
    const node = n => {
      const N = NODES[n], m = modelOf(n, P[n]), off = N.optional && !P[n + 'On'], hl = C[n] !== undefined || C[n + 'On'] !== undefined;
      if (N.fixed) return `<div class="node is-fixed" title="${N.hint}"><div class="node-h">${ic(N.icon)}${N.label}</div><div class="node-m">${m.name}</div><small>included</small></div>`;
      return `<div class="node ${off ? 'off' : ''} ${hl ? 'hlc' : ''}" title="${N.hint}">
        <div class="node-h">${ic(N.icon)}${N.label}${N.optional ? `<button class="sw-t ${off ? '' : 'on'}" data-nodetoggle="${n}" ${ro ? 'disabled' : ''} title="${off ? 'Turn on' : 'Turn off'} ${N.label.toLowerCase()}"></button>` : ''}</div>
        ${ro ? `<div class="node-m">${m.name}</div>` : `<button class="node-m" data-node="${n}" title="Change model">${m.name}${ic('down')}</button>`}
        <small>${off ? 'Off' : costLabel(n, m)}</small></div>`;
    };
    const lane = k => count(k) ? `<div class="lane"><div class="lane-l">${ic(KINDS[k].icon)}<div><b>${KINDS[k].label}</b><small>${count(k)} shot${count(k) > 1 ? 's' : ''}</small></div></div>
      <div class="nodes">${PATHS[k].map(node).join('<span class="arr"></span>')}</div></div>` : '';
    const vm = modelOf('voice', P.voice), vHl = C.voice !== undefined;
    const b = costBreak(d), parts = Object.entries(b).filter(([, v]) => v > 0.001);
    return `<section class="pl-sec" id="pj-pipe"><h3>${ic('layers')}Generation pipeline<span class="r muted" style="font-weight:500;font-size:12px">Plan defaults · override on any shot</span></h3>
      <div class="pl-card pipe">
        ${lane('broll')}${lane('presenter')}${lane('graphic')}
        <div class="lane"><div class="lane-l">${ic('wave')}<div><b>Audio</b><small>All shots</small></div></div>
          <div class="nodes"><div class="node ${vHl ? 'hlc' : ''}"><div class="node-h">${ic('mic')}Voice</div>
            <div class="node-2">${ro ? `<div class="node-m">${esc(d.voiceName)}</div><div class="node-m">${vm.name}</div>`
              : `<button class="node-m" data-spec="voiceName" title="Change voice">${esc(d.voiceName)}${ic('down')}</button><button class="node-m" data-node="voice" title="Change voice model">${vm.name}${ic('down')}</button>`}</div>
            <small>${costLabel('voice', vm)}</small></div></div></div>
        <div class="pipe-f">${parts.map(([n, v]) => `<span>${NODES[n].label} <b>${v.toFixed(1)}</b></span>`).join('')}<span class="tot">≈ <b>${credits2(d)} credits</b> total</span></div>
      </div></section>`;
  }
  function shotPipeHTML(d, s, ro, c) {
    const k = kindOf(s), c0 = c || {};
    const chip = n => {
      const N = NODES[n], m = shotModel(d, s, n), ov = s.models && s.models[n];
      if (N.fixed) return `<span class="pchip is-fixed" title="${N.label}">${ic(N.icon)}${m.name}</span>`;
      return `<button class="pchip ${ov ? 'set' : ''} ${c0['m_' + n] !== undefined ? 'hlc' : ''}" data-shotnode="${s.id}|${n}" ${ro ? 'disabled' : ''} title="${N.label} · ${ov ? 'set for this shot' : 'plan default'}${c0['m_' + n] !== undefined ? ` · was ${c0['m_' + n]}` : ''}">${ic(N.icon)}${m.name}</button>`;
    };
    return `<div class="spipe">
      <button class="kchip ${c0.kind !== undefined ? 'hlc' : ''}" data-shotkind="${s.id}" ${ro ? 'disabled' : ''} title="Shot type${c0.kind !== undefined ? ` · was ${c0.kind}` : ''}">${ic(KINDS[k].icon)}${KINDS[k].label}${ro ? '' : ic('down')}</button>
      ${pathOf(d, s).map(chip).join('<span class="parr"></span>')}
      <span class="scost" title="Estimated cost of this shot">≈ ${shotCost(d, s).toFixed(1)} cr</span></div>`;
  }
  const contHTML = (d, s, nx, i) => `<div class="cont">${ic('link')}${shotModel(d, s, 'frame').id === 'best' ? 'Best frame' : 'Last frame'} of S${i + 1} starts S${i + 2}</div>`;

  const _renderPlan4b = _renderPlan4;
  renderPlan = function () {
    const p = plans[planOpen]; if (!p) return;
    const m0 = $('#plMain'), st = m0 ? m0.scrollTop : 0;
    _renderPlan4b();
    const { d, vi, old, df, show } = planView(p), D = show ? df : null, ro = old || p.status !== 'draft';
    $('#plNav')?.remove();
    const ov = $('#pj-ov');
    ov.innerHTML = docHeadHTML(p, d, vi, old, D);
    [...$$('#plMain .chg'), ...$$('#plMain .oldv')].forEach(b => ov.after(b));
    $('#pj-shots').insertAdjacentHTML('beforebegin', pipeHTML(p, d, ro, D));
    d.shots.forEach((s, i) => {
      const card = $('#shot-' + s.id); if (!card) return;
      card.querySelector('.stags').insertAdjacentHTML('afterend', shotPipeHTML(d, s, ro, D && D.changed[s.id]));
      const nx = d.shots[i + 1];
      if (nx && nx.sec === s.sec && kindOf(s) === 'broll' && kindOf(nx) === 'broll' && pipeOf(d).frameOn) card.insertAdjacentHTML('afterend', contHTML(d, s, nx, i));
    });
    $('#plMain').scrollTop = st;
    headOnScroll();
  };
  function headOnScroll() {
    const t = $('#plTitleIn'), m = $('#plMain'); if (!t || !m) return;
    $('#plan').classList.toggle('scrolled', t.getBoundingClientRect().bottom < m.getBoundingClientRect().top + 4);
  }
  $('#plan').addEventListener('scroll', headOnScroll, true);

  /* menus for nodes, shot types and per-shot overrides */
  function nodeMenuHTML(n, cur, withDefault) {
    const N = NODES[n];
    return `<div class="mh">${N.label} model</div>` + (withDefault ? `<button class="tall" data-pick="">${ck(!cur)}<span class="mo"><b>Plan default</b><small>${withDefault}</small></span></button>` : '')
      + N.models.map(m => `<button class="tall" data-pick="${m.id}">${ck(m.id === cur)}<span class="mo"><b>${m.name}</b><small>${m.desc}</small></span><em>${costLabel(n, m)}</em></button>`).join('');
  }
  const kindMenuHTML = cur => `<div class="mh">Shot type</div>` + Object.entries(KINDS).map(([k, K]) =>
    `<button class="tall" data-pick="${k}">${ck(k === cur)}<span class="mo"><b>${K.label}</b><small>${PATHS[k].map(n => NODES[n].label).join(' → ')}</small></span></button>`).join('');
  let pickFor = null;
  function openPick(el, html, fn) { openMenuAt(el, html); const m = $('#cmenu'); m.style.left = Math.min(el.getBoundingClientRect().left, innerWidth - m.offsetWidth - 8) + 'px'; pickFor = fn; }

  on(window, 'click', e => { if (outside(e)) return;
    const p = plans[planOpen]; if (!p) return;
    const t = e.target; let el;
    const change = (fn, label) => {
      closeMenu(); const before = credits2(p); fn(); p.edited = true;
      renderPlan(); updatePlanCards(p.id); markSaving();
      const after = credits2(p);
      toast(after !== before ? `${label} · ≈ ${after} credits (${after > before ? '+' : '−'}${Math.abs(after - before)})` : label);
      if (after !== before) $('#plCost')?.classList.add('flash');
    };
    if ((el = t.closest('#cmenu [data-pick]')) && pickFor) { e.stopPropagation(); const f = pickFor; pickFor = null; f(el.dataset.pick, change); return; }
    if ((el = t.closest('[data-node]'))) {
      e.stopPropagation(); const n = el.dataset.node;
      openPick(el, nodeMenuHTML(n, p.pipe[n]), (v, ch) => ch(() => { p.pipe[n] = v; }, `${NODES[n].label}: ${modelOf(n, v).name}`)); return;
    }
    if ((el = t.closest('[data-nodetoggle]'))) {
      e.stopPropagation(); if (el.disabled) return; const n = el.dataset.nodetoggle;
      change(() => { p.pipe[n + 'On'] = !p.pipe[n + 'On']; }, `${NODES[n].label} ${p.pipe[n + 'On'] ? 'off' : 'on'}`); return;
    }
    if ((el = t.closest('[data-shotkind]'))) {
      e.stopPropagation(); const s = p.shots.find(x => x.id === +el.dataset.shotkind);
      openPick(el, kindMenuHTML(kindOf(s)), (v, ch) => ch(() => { s.kind = v; }, `S${p.shots.indexOf(s) + 1} → ${KINDS[v].label}`)); return;
    }
    if ((el = t.closest('[data-shotnode]'))) {
      e.stopPropagation(); const [id, n] = el.dataset.shotnode.split('|'), s = p.shots.find(x => x.id === +id);
      openPick(el, nodeMenuHTML(n, s.models && s.models[n], modelOf(n, p.pipe[n]).name), (v, ch) => ch(() => {
        s.models = s.models || {}; if (v) s.models[n] = v; else delete s.models[n]; if (!Object.keys(s.models).length) delete s.models;
      }, `S${p.shots.indexOf(s) + 1} ${NODES[n].label.toLowerCase()}: ${v ? modelOf(n, v).name : 'plan default'}`)); return;
    }
  }, true);

  /* ================= boot ================= */
  track(new ResizeObserver(fit)).observe($('#stage'));
  track(new ResizeObserver(layoutPlayer)).observe($('#plStage'));
  on(window, 'resize', () => { positionSel(); closeMenu(); });
  if (studioW() < 1180) $('#app').classList.add('no-drawer');
  loadPrefs(); updThemeIcon();
  renderDrawer(); renderCanvas(); renderScript(); renderTrack(); renderCtx(); renderSugg(); renderProps(); updUndo();
  seedChat(); setChatTitle();
  document.fonts?.ready.then(() => { if (disposed) return; fit(); renderScenes(); });

  /* ?demo=plan | revise | media | library — opens a state directly (handy for reviews) */
  (async () => {
    const demo = new URLSearchParams(location.search).get('demo');
    if (demo === 'media' || demo === 'library') { state.tool = 'media'; $('#app').classList.remove('no-drawer'); renderDrawer(); }
    if (demo === 'library') openMM();
    if (demo === 'pipe') { await runAI('Plan a 60-second vertical video about phishing'); $('#plMain').style.scrollBehavior = 'auto'; $('#pj-pipe').scrollIntoView(); $('#plMain').scrollTop -= 12; }
    if (demo === 'plan' || demo === 'revise') { await runAI('Plan a 60-second vertical video about phishing'); if (demo === 'revise') await runAI('Make the hook stronger'); }
    if (demo === 'revise') { $('#plMain').style.scrollBehavior = 'auto'; $('#pj-shots').scrollIntoView(); }
  })();

  /* ======================= end of design script ======================= */

  return {
    syncTheme() { if (!disposed) updThemeIcon() },
    dispose() {
      if (disposed) return
      disposed = true
      timers.forEach((id) => window.clearTimeout(id)); timers.clear()
      frames.forEach((id) => window.cancelAnimationFrame(id)); frames.clear()
      disposers.splice(0).reverse().forEach((release) => { try { release() } catch (error) { void error } })
      root.innerHTML = ''
    },
  }
}

/**
 * Binds the opened Spark project to the design's top bar: the title shows the project name,
 * and the logo and breadcrumb lead back to the project list.
 */
function bindProject(root, opts, on) {
  const title = root.querySelector('#title')
  if (title && opts.projectTitle) title.value = opts.projectTitle
  const crumb = root.querySelector('.top .crumb > span')
  if (crumb && opts.backLabel) crumb.textContent = opts.backLabel
  if (!opts.onBack) return
  for (const el of [root.querySelector('.top .logo'), crumb]) {
    if (!el) continue
    el.setAttribute('role', 'link')
    el.tabIndex = 0
    if (opts.backLabel) el.setAttribute('title', opts.backLabel)
    on(el, 'click', () => opts.onBack())
    on(el, 'keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      opts.onBack()
    })
  }
}
