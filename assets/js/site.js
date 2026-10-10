(function () {
  var root = document.documentElement;

  function setLang(l, persist) {
    if (l !== 'ko' && l !== 'en') l = 'en';
    root.lang = l;
    var b = document.body;
    if (b && b.dataset['title' + (l === 'ko' ? 'Ko' : 'En')]) {
      document.title = b.dataset['title' + (l === 'ko' ? 'Ko' : 'En')];
    }
    var btns = document.querySelectorAll('[data-set-lang]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-pressed', btns[i].dataset.setLang === l ? 'true' : 'false');
    }
    if (persist) { try { localStorage.setItem('lang', l); } catch (e) {} }
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-set-lang]');
    if (!t) return;
    setLang(t.dataset.setLang, true);
  });
  setLang(root.lang, false);

  // dark / light
  function setTheme(t, persist) {
    t = t === 'dark' ? 'dark' : 'light';
    root.dataset.theme = t;
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = t === 'dark' ? '#111111' : '#ffffff';
    var btns = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
    if (persist) { try { localStorage.setItem('theme', t); } catch (e) {} }
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-theme-toggle]');
    if (!t) return;
    setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true);
  });
  setTheme(root.dataset.theme, false);

  // Seoul clock
  var clocks = document.querySelectorAll('[data-clock]');
  if (clocks.length && window.Intl) {
    var fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    var tick = function () {
      var s = fmt.format(new Date());
      for (var i = 0; i < clocks.length; i++) clocks[i].textContent = s;
    };
    tick(); setInterval(tick, 1000);
  }

  // prev / next work with arrow keys
  var prev = document.querySelector('a[data-prev]'), next = document.querySelector('a[data-next]');
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (e.key === 'ArrowLeft' && prev) location.href = prev.href;
    if (e.key === 'ArrowRight' && next) location.href = next.href;
  });

  // back-to-top button (shown on mobile after scrolling)
  var toTop = document.querySelector('.to-top');
  if (toTop) {
    var onScroll = function () { toTop.classList.toggle('show', window.scrollY > 400); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    toTop.addEventListener('click', function () {
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  // bento menu (mobile): open the menu from anywhere on the page
  var bento = document.querySelector('.bento'), panel = document.getElementById('bento-panel');
  if (bento && panel) {
    var setBento = function (open) {
      panel.hidden = !open;
      bento.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    bento.addEventListener('click', function (e) { e.stopPropagation(); setBento(panel.hidden); });
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) setBento(false); });
    document.addEventListener('click', function (e) { if (!panel.hidden && !e.target.closest('.lab')) setBento(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { setBento(false); bento.focus(); } });
    window.addEventListener('resize', function () { if (window.innerWidth >= 960) setBento(false); });
  }
})();
