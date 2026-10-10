/* "Signal → text" scroll effect for narrow (mobile) screens. See mobile-fx.css. */
(function () {
  var mq = window.matchMedia && window.matchMedia('(max-width: 959px)');
  var rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!mq) return;

  var SEL = '.prose p:not(.m), .prose h3';
  var GL = '01▒░/\\·:=+*';
  var items = [], on = false, queued = false;

  function noise(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += GL.charAt((Math.random() * GL.length) | 0);
    return s;
  }
  function ease(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }

  function textNodes(root) {
    var out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) if (n.nodeValue.trim()) out.push(n);
    return out;
  }

  function make(el) {
    return { el: el, ov: null, nodes: null, total: 0, done: false };
  }

  function build(it) {
    var clone = it.el.cloneNode(true);
    clone.removeAttribute('id');
    clone.className = (clone.className || '') + ' fx-ov';
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('inert', '');
    it.nodes = []; it.total = 0;
    textNodes(clone).forEach(function (t) {
      var orig = t.nodeValue, cnt = orig.replace(/\s/g, '').length;
      var tail = document.createElement('span'); tail.className = 'fx-n';
      t.parentNode.insertBefore(tail, t.nextSibling);
      it.nodes.push({ t: t, tail: tail, orig: orig, cnt: cnt, off: it.total });
      it.total += cnt;
    });
    it.ov = clone;
    it.el.appendChild(clone);
  }

  function paint(it, reveal) {
    it.nodes.forEach(function (n) {
      var k = Math.max(0, Math.min(n.cnt, reveal - n.off)), seen = 0, cut = n.orig.length;
      if (k >= n.cnt) cut = n.orig.length;
      else {
        cut = 0;
        for (var i = 0; i < n.orig.length && seen < k; i++) { if (!/\s/.test(n.orig.charAt(i))) seen++; cut = i + 1; }
      }
      n.t.nodeValue = n.orig.slice(0, cut);
      n.tail.textContent = n.orig.slice(cut).replace(/\S/g, function () { return GL.charAt((Math.random() * GL.length) | 0); });
    });
  }

  function finish(it, restart) {
    it.done = true;
    if (!restart) it.el.setAttribute('data-fx-done', '1');
    if (it.ov && it.ov.parentNode) it.ov.parentNode.removeChild(it.ov);
    it.ov = null; it.nodes = null;
    it.el.classList.remove('fx-pending');
  }

  function update() {
    queued = false;
    if (!on) return;
    var vh = window.innerHeight, sy = window.pageYOffset;
    var maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.done) continue;
      var r = it.el.getBoundingClientRect();
      if (r.height === 0) continue;                       // the other language
      var top = r.top;
      // paragraphs near the end of the page can never rise to the usual reading line: resolve them at the bottom instead
      var resolveAt = Math.max(vh * 0.55, r.top + sy - maxScroll + 6);
      var noiseAt = resolveAt + vh * 0.43;
      var p = 1 - ease((top - resolveAt) / (noiseAt - resolveAt));
      if (top <= resolveAt || p >= 0.999) { finish(it); continue; }
      if (top > vh + 80) continue;                         // far below: stays hidden, no work yet
      if (!it.ov) build(it);
      paint(it, Math.floor(p * it.total));
    }
  }

  function request() { if (!queued) { queued = true; requestAnimationFrame(update); } }

  function start() {
    if (on) return;
    on = true;
    items = Array.prototype.map.call(document.querySelectorAll(SEL), make).filter(function (it) { return !it.el.hasAttribute('data-fx-done'); });
    items.forEach(function (it) { it.el.classList.add('fx-pending'); });
    update();
  }
  function stop(restart) {
    on = false;
    items.forEach(function (it) { if (!it.done) finish(it, restart); });
    items = [];
  }
  function sync() {
    var want = mq.matches && !(rm && rm.matches);
    if (want) { stop(true); start(); } else stop();
  }

  window.addEventListener('scroll', request, { passive: true });
  var lastW = window.innerWidth;
  window.addEventListener('resize', function () {
    // the mobile address bar changes only the height; a new width means the text re-wraps
    if (on && window.innerWidth !== lastW) { stop(true); start(); }
    lastW = window.innerWidth;
    request();
  }, { passive: true });
  if (mq.addEventListener) { mq.addEventListener('change', sync); if (rm) rm.addEventListener('change', sync); }
  // language switch changes which paragraphs are visible
  new MutationObserver(function () { if (on) { stop(true); start(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  sync();
})();
