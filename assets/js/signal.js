/* Signal mode: the eye button turns all text into signal glyphs (0 1 ▒ ░ / \ · : = + *); dragging a finger or the
   mouse over the text reads it. The real text is never moved: a layer of glyph boxes sits on top of it, one per word. */
(function () {
  var root = document.documentElement, btns = [].slice.call(document.querySelectorAll('[data-eye-toggle]'));
  var cols = document.querySelector('.cols');
  if (!btns.length || !cols) return;

  var GL = '01▒░/\\·:=+*';
  var SKIP = '.lab,.clock,.sg-layer,script,style,noscript,button,input,textarea,select,.lockform,.lockerr,svg,video';
  var mqDesk = window.matchMedia('(min-width: 960px)');
  var on = false, layers = [], observer = null, adv = 0.6;
  var down = false, lastPt = null, openSet = [], timer = 0, built = false;

  function glyphs(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += GL.charAt((Math.random() * GL.length) | 0);
    return s;
  }
  function measureMono() {
    var t = document.createElement('span');
    t.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:400 100px var(--mono)';
    t.textContent = 'MMMMMMMMMM'; document.body.appendChild(t);
    var w = t.getBoundingClientRect().width / 1000; document.body.removeChild(t);
    if (w > 0.3 && w < 1.2) adv = w;
  }

  function teardown() {
    if (observer) observer.disconnect();
    layers.forEach(function (l) { if (l.el.parentNode) l.el.parentNode.removeChild(l.el); });
    layers = []; openSet = []; built = false;
  }

  function build() {
    teardown();
    var hosts = mqDesk.matches ? [].slice.call(cols.querySelectorAll(':scope > .col')) : [cols];
    hosts.forEach(function (h) {
      var el = document.createElement('div'); el.className = 'sg-layer'; h.appendChild(el);
      layers.push({ el: el, host: h, boxes: [], rect: el.getBoundingClientRect() });
    });
    var styleOf = new Map(), rng = document.createRange();
    function style(p) {
      var st = styleOf.get(p);
      if (!st) {
        var cs = getComputedStyle(p);
        st = { fs: parseFloat(cs.fontSize) || 13, ff: cs.fontFamily, fw: cs.fontWeight, tt: cs.textTransform, lr: cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing };
        styleOf.set(p, st);
      }
      return st;
    }
    var walker = document.createTreeWalker(cols, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentElement;
        return !p || p.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    var frags = layers.map(function () { return document.createDocumentFragment(); });
    var n;
    while ((n = walker.nextNode())) {
      var p = n.parentElement, st = style(p), li = 0;
      if (layers.length > 1) { var hc = p.closest('.col'); li = Math.max(0, layers.findIndex(function (l) { return l.host === hc; })); }
      var L = layers[li], text = n.nodeValue, re = /\S+/g, m;
      while ((m = re.exec(text))) {
        rng.setStart(n, m.index); rng.setEnd(n, m.index + m[0].length);
        var rects = rng.getClientRects();
        if (!rects.length) continue;
        if (rects.length === 1) add(L, frags[li], rects[0], m[0], st);
        else {
          for (var k = 0; k < m[0].length; k++) {          // a word that wraps over two lines: place it letter by letter
            rng.setStart(n, m.index + k); rng.setEnd(n, m.index + k + 1);
            var r = rng.getClientRects()[0];
            if (r) add(L, frags[li], r, m[0].charAt(k), st);
          }
        }
      }
    }
    layers.forEach(function (l, i) { l.el.appendChild(frags[i]); });
    built = true;
    watch();
  }

  function add(L, frag, r, real, st) {
    if (r.width < 1 || r.height < 1) return;
    var el = document.createElement('i'), count = real.length;
    var x = r.left - L.rect.left, y = r.top - L.rect.top, ls = count > 1 ? (r.width - count * adv * st.fs) / count : 0;
    ls = Math.max(-st.fs * 0.3, Math.min(st.fs * 1.6, ls));
    el.textContent = glyphs(count);
    var s = el.style;
    s.left = x + 'px'; s.top = y + 'px'; s.width = r.width + 'px'; s.height = r.height + 'px'; s.lineHeight = r.height + 'px';
    s.fontSize = st.fs + 'px'; s.fontWeight = st.fw; s.textTransform = st.tt;
    s.setProperty('--ls', ls.toFixed(2) + 'px'); s.setProperty('--ff', st.ff); s.setProperty('--lr', st.lr);
    L.boxes.push({ el: el, real: real, sig: el.textContent, x: x, y: y, w: r.width, h: r.height, open: false, exp: 0 });
    frag.appendChild(el);
  }

  // ---- reading: boxes near the pointer turn into the real word, and turn back a moment after you let go
  function openBox(b) {
    if (!b.open) { b.open = true; b.el.classList.add('o'); b.el.textContent = b.real; openSet.push(b); }
    b.exp = Infinity;
  }
  function closeBox(b) { b.open = false; b.el.classList.remove('o'); b.el.textContent = b.sig; }
  function reveal(cx, cy, radius) {
    layers.forEach(function (L) {
      var hr = L.host.getBoundingClientRect();
      if (cx < hr.left || cx > hr.right || cy < hr.top || cy > hr.bottom) return;
      var lr = L.el.getBoundingClientRect(), px = cx - lr.left, py = cy - lr.top, r2 = radius * radius;
      for (var i = 0; i < L.boxes.length; i++) {
        var b = L.boxes[i];
        var dx = px < b.x ? b.x - px : px > b.x + b.w ? px - b.x - b.w : 0;
        var dy = py < b.y ? b.y - py : py > b.y + b.h ? py - b.y - b.h : 0;
        if (dx * dx + dy * dy <= r2) openBox(b);
      }
    });
  }
  function release() {
    down = false; lastPt = null;
    var until = Date.now() + 2200;
    openSet.forEach(function (b) { if (b.exp === Infinity) b.exp = until; });
    if (!timer) timer = setInterval(tick, 250);
  }
  function tick() {
    var now = Date.now();
    openSet = openSet.filter(function (b) { if (b.exp <= now) { closeBox(b); return false; } return true; });
    if (!openSet.length) { clearInterval(timer); timer = 0; }
  }

  function interactive(t) { return t && t.closest && t.closest('.lab,button,input,textarea,select,.sbh,.to-top'); }
  document.addEventListener('pointerdown', function (e) {
    if (!on || e.pointerType === 'touch' || e.button || interactive(e.target)) return;
    down = true; lastPt = { x: e.clientX, y: e.clientY, r: 34 }; reveal(e.clientX, e.clientY, 34);
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (!on || !down || e.pointerType === 'touch') return;
    lastPt = { x: e.clientX, y: e.clientY, r: 34 }; reveal(e.clientX, e.clientY, 34);
  }, true);
  ['pointerup', 'pointercancel'].forEach(function (ev) { document.addEventListener(ev, function () { if (on && down) release(); }, true); });
  window.addEventListener('blur', function () { if (down) release(); });

  function touchAt(e) {
    var t = e.touches[0]; if (!t) return;
    down = true; lastPt = { x: t.clientX, y: t.clientY, r: 46 }; reveal(t.clientX, t.clientY, 46);
  }
  document.addEventListener('touchstart', function (e) { if (on && !interactive(e.target)) touchAt(e); }, { passive: true });
  document.addEventListener('touchmove', function (e) { if (on && down) touchAt(e); }, { passive: true });
  ['touchend', 'touchcancel'].forEach(function (ev) { document.addEventListener(ev, function () { if (on && down) release(); }, { passive: true }); });
  // while a finger rests and the page scrolls underneath it, keep reading what passes under it
  var sq = false;
  document.addEventListener('scroll', function () {
    if (!on || !down || !lastPt || sq) return;
    sq = true; requestAnimationFrame(function () { sq = false; if (lastPt) reveal(lastPt.x, lastPt.y, lastPt.r); });
  }, true);

  // ---- keep the layer in step with the page
  var deb = 0;
  function rebuildSoon() { clearTimeout(deb); deb = setTimeout(function () { if (on) build(); }, 160); }
  function watch() {
    if (!observer) {
      observer = new MutationObserver(function (list) {
        for (var i = 0; i < list.length; i++) {
          var m = list[i], t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
          if (!t || (t.closest && t.closest('.sg-layer,.clock,.sg-hint'))) continue;
          if (m.type === 'childList' && [].concat([].slice.call(m.addedNodes), [].slice.call(m.removedNodes)).every(function (x) { return x.nodeType === 1 && x.classList.contains('sg-layer'); })) continue;
          rebuildSoon(); return;
        }
      });
    }
    observer.observe(cols, { childList: true, subtree: true, characterData: true });
  }
  window.addEventListener('resize', rebuildSoon);
  window.addEventListener('load', rebuildSoon);
  if (mqDesk.addEventListener) mqDesk.addEventListener('change', rebuildSoon);
  new MutationObserver(rebuildSoon).observe(root, { attributes: true, attributeFilter: ['lang'] });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measureMono(); rebuildSoon(); });

  // ---- the switch
  function hint() {
    var el = document.querySelector('.sg-hint');
    if (!el) { el = document.createElement('div'); el.className = 'sg-hint'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    var ko = root.lang === 'ko';
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    el.textContent = ko ? (coarse ? '손가락으로 글자 위를 문질러 읽어요' : '글자 위를 드래그해서 읽어요') : (coarse ? 'Touch and drag over the text to read' : 'Drag over the text to read');
    el.classList.add('show'); clearTimeout(hint.t); hint.t = setTimeout(function () { el.classList.remove('show'); }, 3800);
  }
  function setSig(v, persist) {
    on = v;
    root.classList.toggle('sig-on', v);
    btns.forEach(function (b) { b.setAttribute('aria-pressed', v ? 'true' : 'false'); });
    if (persist) { try { sessionStorage.setItem('sig', v ? '1' : '0'); } catch (e) {} }
    if (v) { measureMono(); build(); hint(); }
    else { teardown(); var h = document.querySelector('.sg-hint'); if (h) h.classList.remove('show'); }
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-eye-toggle]');
    if (t) setSig(!on, true);
  });
  // every new visit starts with the eyes open; moving between pages inside the same visit keeps the mode
  var saved = null; try { saved = sessionStorage.getItem('sig'); } catch (e) {}
  if (saved === '1') setSig(true, false);
})();
