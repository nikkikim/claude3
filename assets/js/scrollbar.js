/* Retro "Xerox Star" scrollbar for the three desktop columns.
   top cap = jump to top, ↓ = scroll up a little, − = page up, ◆ = position (drag it),
   + = page down, ↑ = scroll down a little, bottom cap = jump to bottom.
   Wheel, touch and keyboard scrolling keep working as usual; this only replaces the bar. */
(function () {
  var cols = [].slice.call(document.querySelectorAll('.cols > .col'));
  if (!cols.length || !window.matchMedia) return;

  var root = document.documentElement;
  var mq = window.matchMedia('(min-width: 960px)');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var behavior = reduce ? 'auto' : 'smooth';
  var TOP = 62, BOTTOM = 16, WIDTH = 11, INSET = 5, DIA = 7;

  var ICON = {
    down: '<svg viewBox="0 0 7 9"><path d="M3.5 1v6M1 5l2.5 2.5L6 5"/></svg>',
    up: '<svg viewBox="0 0 7 9"><path d="M3.5 8V2M1 4l2.5-2.5L6 4"/></svg>',
    minus: '<svg viewBox="0 0 7 9"><path d="M1 4.5h5"/></svg>',
    plus: '<svg viewBox="0 0 7 9"><path d="M1 4.5h5M3.5 2v5"/></svg>'
  };

  function btn(cls, label, html) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.tabIndex = -1; b.setAttribute('aria-label', label);
    if (html) b.innerHTML = html;
    return b;
  }

  // call fn now, then keep calling while the pointer is held down
  function hold(el, fn, first, every) {
    el.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      e.preventDefault();
      fn();
      var iv = 0, t = setTimeout(function () { iv = setInterval(fn, every); }, first);
      function stop() {
        clearTimeout(t); clearInterval(iv);
        window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop);
      }
      window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop);
    });
  }

  function attach(col) {
    var bar = document.createElement('div');
    bar.className = 'sb'; bar.setAttribute('aria-hidden', 'true');
    var capTop = btn('cap', 'top'), up = btn('box', 'scroll up', ICON.down), pgUp = btn('box', 'page up', ICON.minus);
    var track = document.createElement('div'); track.className = 'track';
    track.innerHTML = '<svg class="dia" viewBox="0 0 7 7"><path d="M3.5 0 7 3.5 3.5 7 0 3.5z"/></svg>';
    var dia = track.firstChild;
    var pgDn = btn('box', 'page down', ICON.plus), dn = btn('box', 'scroll down', ICON.up), capBot = btn('cap', 'bottom');
    [capTop, up, pgUp, track, pgDn, dn, capBot].forEach(function (n) { bar.appendChild(n); });
    document.body.appendChild(bar);

    var queued = false;
    function max() { return col.scrollHeight - col.clientHeight; }

    function update() {
      queued = false;
      var m = max(), on = mq.matches && m > 4;
      bar.classList.toggle('on', on);
      if (!on) return;
      var r = col.getBoundingClientRect();
      bar.style.left = Math.round(r.right - WIDTH - INSET) + 'px';
      bar.style.top = TOP + 'px';
      bar.style.height = Math.max(120, window.innerHeight - TOP - BOTTOM) + 'px';
      var th = track.clientHeight, ratio = Math.min(1, Math.max(0, col.scrollTop / m));
      dia.style.transform = 'translateY(' + Math.round(ratio * Math.max(0, th - DIA)) + 'px)';
    }
    function schedule() { if (!queued) { queued = true; requestAnimationFrame(update); } }
    attach.schedulers.push(schedule);

    col.addEventListener('scroll', schedule, { passive: true });
    hold(up, function () { col.scrollBy(0, -64); }, 350, 40);
    hold(dn, function () { col.scrollBy(0, 64); }, 350, 40);
    hold(pgUp, function () { col.scrollBy({ top: -col.clientHeight * 0.9, behavior: behavior }); }, 500, 380);
    hold(pgDn, function () { col.scrollBy({ top: col.clientHeight * 0.9, behavior: behavior }); }, 500, 380);
    capTop.addEventListener('click', function () { col.scrollTo({ top: 0, behavior: behavior }); });
    capBot.addEventListener('click', function () { col.scrollTo({ top: max(), behavior: behavior }); });

    // click or drag anywhere on the track: the diamond follows the pointer
    var dragging = false;
    function seek(e) {
      var r = track.getBoundingClientRect(), span = Math.max(1, r.height - DIA);
      var ratio = Math.min(1, Math.max(0, (e.clientY - r.top - DIA / 2) / span));
      col.scrollTop = ratio * max();
    }
    track.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      e.preventDefault(); dragging = true; track.setPointerCapture(e.pointerId); seek(e);
    });
    track.addEventListener('pointermove', function (e) { if (dragging) seek(e); });
    function endDrag() { dragging = false; }
    track.addEventListener('pointerup', endDrag); track.addEventListener('pointercancel', endDrag);

    if (window.ResizeObserver) {
      var ro = new ResizeObserver(schedule);
      ro.observe(col);
      [].slice.call(col.children).forEach(function (c) { ro.observe(c); });
    }
    schedule();
  }
  attach.schedulers = [];

  cols.forEach(attach);
  root.classList.add('sb-on');
  function all() { attach.schedulers.forEach(function (s) { s(); }); }
  window.addEventListener('resize', all);
  document.addEventListener('load', all, true);          // images finishing to load change the height
  if (mq.addEventListener) mq.addEventListener('change', all);
  window.addEventListener('load', all);
})();

/* ".sbh": the mobile version, a horizontal bar fixed to the top that follows the page's own scrolling.
   left cap = top, ← = page back, ◆ = how far you have read (drag it), → = page forward, right cap = bottom. */
(function () {
  if (!window.matchMedia || !document.body) return;
  var mq = window.matchMedia('(max-width: 959px)'), root = document.documentElement;
  var DIA = 8;
  function btn(cls, label, html) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.tabIndex = -1; b.setAttribute('aria-label', label);
    if (html) b.innerHTML = html;
    return b;
  }
  var bar = document.createElement('div'); bar.className = 'sbh'; bar.setAttribute('aria-hidden', 'true');
  var left = '<svg viewBox="0 0 9 7"><path d="M8 3.5H2M4 1 1.5 3.5 4 6"/></svg>';
  var right = '<svg viewBox="0 0 9 7"><path d="M1 3.5h6M5 1l2.5 2.5L5 6"/></svg>';
  var capL = btn('cap', 'top'), back = btn('box', 'page back', left), capR = btn('cap', 'bottom'), fwd = btn('box', 'page forward', right);
  var track = document.createElement('div'); track.className = 'track';
  track.innerHTML = '<svg class="dia" viewBox="0 0 8 8"><path d="M4 0 8 4 4 8 0 4z"/></svg>';
  var dia = track.firstChild;
  [capL, back, track, fwd, capR].forEach(function (n) { bar.appendChild(n); });
  document.body.appendChild(bar);

  function max() { return Math.max(0, document.documentElement.scrollHeight - window.innerHeight); }
  var queued = false;
  function update() {
    queued = false;
    var m = max(), on = mq.matches && m > 4;
    bar.classList.toggle('on', on);
    root.classList.toggle('sbh-on', on);
    if (!on) return;
    var span = Math.max(0, track.clientWidth - DIA), ratio = Math.min(1, Math.max(0, window.pageYOffset / m));
    dia.style.transform = 'translateX(' + Math.round(ratio * span) + 'px)';
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(update); } }
  function to(y, smooth) { window.scrollTo({ top: y, behavior: smooth ? 'smooth' : 'instant' }); }

  capL.addEventListener('click', function () { to(0, true); });
  capR.addEventListener('click', function () { to(max(), true); });
  back.addEventListener('click', function () { to(window.pageYOffset - window.innerHeight * 0.85, true); });
  fwd.addEventListener('click', function () { to(window.pageYOffset + window.innerHeight * 0.85, true); });

  var dragging = false;
  function seek(e) {
    var r = track.getBoundingClientRect(), span = Math.max(1, r.width - DIA);
    to(Math.min(1, Math.max(0, (e.clientX - r.left - DIA / 2) / span)) * max(), false);
  }
  track.addEventListener('pointerdown', function (e) {
    if (e.button) return;
    e.preventDefault(); dragging = true; bar.classList.add('drag'); track.setPointerCapture(e.pointerId); seek(e);
  });
  track.addEventListener('pointermove', function (e) { if (dragging) seek(e); });
  function end() { dragging = false; bar.classList.remove('drag'); }
  track.addEventListener('pointerup', end); track.addEventListener('pointercancel', end);

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('load', schedule);
  document.addEventListener('load', schedule, true);
  if (mq.addEventListener) mq.addEventListener('change', schedule);
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);
  schedule();
})();

