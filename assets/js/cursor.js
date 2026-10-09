/* Catalog crosshair cursor: a thin crosshair with live x / y coordinates.
   Only runs for a mouse (hover + fine pointer); touch devices keep their normal behaviour. */
(function () {
  var mq = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!mq || !mq.matches) return;

  var root = document.documentElement;
  var el = document.createElement('div');
  el.className = 'xh';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<svg viewBox="0 0 28 28">' +
    '<g class="cross" fill="none" stroke="currentColor" stroke-width="1"><path d="M14 1v9M14 18v9M1 14h9M18 14h9"/></g>' +
    // pinwheel: four blades that spin while the pointer is over something clickable
    '<g class="pin" fill="currentColor">' +
    '<path d="M14 14V1.5C20.5 2.5 24.5 6.5 25 13z"/>' +
    '<path d="M14 14V1.5C20.5 2.5 24.5 6.5 25 13z" transform="rotate(90 14 14)"/>' +
    '<path d="M14 14V1.5C20.5 2.5 24.5 6.5 25 13z" transform="rotate(180 14 14)"/>' +
    '<path d="M14 14V1.5C20.5 2.5 24.5 6.5 25 13z" transform="rotate(270 14 14)"/>' +
    '<circle cx="14" cy="14" r="1.8" fill="#fff"/></g></svg>';
  var label = document.createElement('div');
  label.className = 'xh-xy';
  label.setAttribute('aria-hidden', 'true');
  label.innerHTML = '<span></span>';
  document.body.appendChild(el);
  document.body.appendChild(label);

  var xy = label.firstChild;
  var x = 0, y = 0, raf = 0, last = '';

  function pad(n) { return ('0000' + n).slice(-4); }

  function draw() {
    raf = 0;
    var tf = 'translate3d(' + x + 'px,' + y + 'px,0)';
    el.style.transform = tf;
    label.style.transform = tf;
    var t = 'X ' + pad(x) + '\nY ' + pad(y);
    if (t !== last) { xy.textContent = t; last = t; }
    label.classList.toggle('flip-x', x > window.innerWidth - 100);
    label.classList.toggle('flip-y', y > window.innerHeight - 56);
  }

  window.addEventListener('pointermove', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    x = Math.round(e.clientX);
    y = Math.round(e.clientY);
    var t = e.target, can = t && t.closest;
    root.classList.add('xh-on');
    var show = !(can && t.closest('video'));   // keep the native cursor on video controls
    var link = !!(can && t.closest('a,button,[role="button"],summary'));
    el.classList.toggle('show', show);
    el.classList.toggle('is-link', link);
    label.classList.toggle('show', show && !link);   // no coordinates over clickable things
    if (!raf) raf = requestAnimationFrame(draw);
  }, { passive: true });

  function hide() { el.classList.remove('show'); label.classList.remove('show'); }
  root.addEventListener('mouseleave', hide);
  window.addEventListener('blur', hide);
})();
