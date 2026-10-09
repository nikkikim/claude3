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

})();
