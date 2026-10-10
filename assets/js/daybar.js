/* A thin strip next to the Seoul clock: the colour of daylight in Seoul across 24 hours (left = 00:00, right = 24:00).
   It is computed from the sun's real height above the horizon for today's date, so sunrise and sunset slide through
   the year. The dark line is "now" and moves along. Remove this file (and its <script> line in build.py) to drop it. */
(function () {
  var bars = [].slice.call(document.querySelectorAll('[data-daybar]'));
  if (!bars.length) return;
  var LAT = 37.5665, LON = 126.978, TZ = 9 * 3600000, RAD = Math.PI / 180;

  // sun altitude (degrees) at a UTC time for Seoul
  function altitude(ms) {
    var n = ms / 86400000 + 2440587.5 - 2451545.0;
    var L = (280.46 + 0.9856474 * n) % 360, g = (357.528 + 0.9856003 * n) % 360 * RAD;
    var lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD, eps = (23.439 - 4e-7 * n) * RAD;
    var dec = Math.asin(Math.sin(eps) * Math.sin(lam));
    var ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
    var gmst = (280.46061837 + 360.98564736629 * n) % 360 * RAD;
    var ha = gmst + LON * RAD - ra;
    return Math.asin(Math.sin(LAT * RAD) * Math.sin(dec) + Math.cos(LAT * RAD) * Math.cos(dec) * Math.cos(ha)) / RAD;
  }

  // altitude -> soft colour: night blue, orange at the horizon, warm cream, pale cool teal at midday
  var STOPS = [[-18, [193, 203, 232]], [-9, [176, 204, 230]], [-3, [244, 190, 150]], [3, [247, 200, 152]],
               [12, [243, 222, 186]], [24, [235, 232, 214]], [40, [207, 231, 228]], [75, [188, 226, 232]]];
  function colour(alt) {
    if (alt <= STOPS[0][0]) return STOPS[0][1];
    for (var i = 1; i < STOPS.length; i++) {
      if (alt <= STOPS[i][0]) {
        var a = STOPS[i - 1], b = STOPS[i], t = (alt - a[0]) / (b[0] - a[0]);
        return a[1].map(function (v, k) { return Math.round(v + (b[1][k] - v) * t); });
      }
    }
    return STOPS[STOPS.length - 1][1];
  }
  function css(c) { return 'rgb(' + c.join(',') + ')'; }

  function dayStart(now) { return Math.floor((now + TZ) / 86400000) * 86400000 - TZ; }
  function hhmm(ms) {
    var d = new Date(ms + TZ);
    return ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2);
  }
  function crossings(start) {          // sunrise / sunset: where the sun passes 0 degrees
    var rise = null, set = null, prev = altitude(start);
    for (var m = 1; m <= 1440; m++) {
      var a = altitude(start + m * 60000);
      if (prev < 0 && a >= 0 && rise === null) rise = start + m * 60000;
      if (prev >= 0 && a < 0 && set === null) set = start + m * 60000;
      prev = a;
    }
    return { rise: rise, set: set };
  }

  var built = null;
  function paint() {
    var now = Date.now(), start = dayStart(now);
    if (built !== start) {                       // new day (or first run): redraw the gradient
      built = start;
      var stops = [];
      for (var i = 0; i <= 96; i++) stops.push(css(colour(altitude(start + i * 900000))) + ' ' + (i / 96 * 100).toFixed(2) + '%');
      // thin hour ticks over the gradient
      var ticks = 'repeating-linear-gradient(to right, rgba(0,0,0,.09) 0, rgba(0,0,0,.09) 1px, transparent 1px, transparent ' + (100 / 24).toFixed(4) + '%)';
      bars.forEach(function (b) { b.style.background = ticks + ',linear-gradient(to right,' + stops.join(',') + ')'; });
      built = start; paint.sun = crossings(start);
    }
    var frac = (now - start) / 86400000, alt = altitude(now), s = paint.sun || {};
    var lang = document.documentElement.lang === 'ko';
    var phase = alt < -6 ? (lang ? '밤' : 'night') : alt < 6 ? (lang ? '노을·여명' : 'twilight / golden hour') : alt < 30 ? (lang ? '아침·오후' : 'day, low sun') : (lang ? '한낮' : 'midday');
    var label = (lang ? '서울 · 일출 ' : 'Seoul · sunrise ') + (s.rise ? hhmm(s.rise) : '—') + (lang ? ' · 일몰 ' : ' · sunset ') + (s.set ? hhmm(s.set) : '—') + ' · ' + phase;
    bars.forEach(function (b) {
      b.querySelector('.now').style.left = (frac * 100).toFixed(3) + '%';
      b.title = label; b.setAttribute('aria-label', label);
    });
  }
  paint(); setInterval(paint, 30000);
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
