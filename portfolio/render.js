/* Portfolio layout engine (runs in the browser).
   The SAME code is used by
     - portfolio/print.html  (printed to PDF by render_pdf.js / GitHub Actions) and
     - the admin page        (live preview),
   so the preview always matches the PDF.

   Data: content/portfolio.json   (see README: "포트폴리오 PDF")
   Every spread is 1440 x 810 px = two pages of 720 x 810 px. */
(function (root) {
  'use strict';

  var PW = 720, PH = 810, M = 28, TOP = 50, BOT = 26, GAP = 10, WMAX = 600;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function node(cls, css, html) {
    var d = document.createElement('div');
    if (cls) d.className = cls;
    if (css) d.style.cssText = css;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function image(src, css) {
    var i = document.createElement('img');
    i.src = src; i.decoding = 'async'; i.alt = '';
    i.style.cssText = css;
    return i;
  }
  function px(n) { return Math.round(n * 100) / 100 + 'px'; }
  function num(v, d) { v = parseFloat(v); return isFinite(v) ? v : d; }

  /* straight double quotes -> typographic quotes (per line) */
  function curly(s) {
    var open = true;
    return s.replace(/"/g, function () { var c = open ? '“' : '”'; open = !open; return c; });
  }

  /* ---------------------------------------------------------------- text pages
     body style:  "# heading"  bold small line,  "~ text"  small line,
                  other text = paragraphs separated by a blank line (a single line break stays a line break)
     cv style:    "# heading", "2026 text" (year column + text), any other line = text without a year */
  function textHtml(text, style) {
    var lines = String(text || '').replace(/\r/g, '').split('\n');
    var out = [], para = [];
    function flush() { if (para.length) { out.push('<p>' + para.join('<br>') + '</p>'); para = []; } }
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i], t = l.replace(/\s+$/, '');
      if (style === 'cv') {
        if (!t.trim()) continue;
        var m;
        if (/^#\s/.test(t)) out.push('<div class="cvh">' + esc(t.replace(/^#\s+/, '')) + '</div>');
        else if ((m = /^(\d{4})\s+(.*)$/.exec(t.trim()))) out.push('<div class="cvr"><span>' + m[1] + '</span><span>' + esc(curly(m[2])) + '</span></div>');
        else out.push('<div class="cvr"><span></span><span>' + esc(curly(t.trim())) + '</span></div>');
      } else {
        if (!t.trim()) { flush(); continue; }
        if (/^#\s/.test(t)) { flush(); out.push('<div class="ph">' + esc(t.replace(/^#\s+/, '')) + '</div>'); }
        else if (/^~\s?/.test(t)) { flush(); out.push('<div class="ps">' + esc(t.replace(/^~\s?/, '')) + '</div>'); }
        else para.push(esc(t));
      }
    }
    flush();
    return out.join('');
  }

  /* ---------------------------------------------------------------- image helpers */
  function dim(ctx, name) {
    var d = ctx.dims[name];
    return d && d.w && d.h ? d : { w: 3, h: 2 };
  }
  function ratio(ctx, name) { var d = dim(ctx, name); return d.h / d.w; }

  function pageX(side, align, wt) {
    if (align === 'out') return side === 'L' ? 0 : PW - wt;
    if (align === 'mid') return (PW - wt) / 2;
    return side === 'L' ? PW - wt : 0;                    // 'in': against the spine
  }

  /* images of one page. cap = number of caption lines that sit on this page */
  function imagesPage(el, pg, side, ctx, cap) {
    var names = (pg.images || []).filter(Boolean), n = names.length;
    if (!n) return;
    var mode = pg.mode || 'frame', align = pg.align || 'in', valign = pg.valign || 'top';
    var scale = num(pg.scale, 1), pos = pg.pos || [50, 50];
    var capH = cap ? cap * 16.5 + 26 : 0;
    var availH = PH - TOP - BOT - capH;
    var fit = pos[0] + '% ' + pos[1] + '%';

    function put(name, x, y, w, h) {
      el.appendChild(image(ctx.src(name), 'left:' + px(x) + ';top:' + px(y) + ';width:' + px(w) + ';height:' + px(h)));
    }
    function cover(name, x, y, w, h) {
      el.appendChild(image(ctx.src(name), 'left:' + px(x) + ';top:' + px(y) + ';width:' + px(w) + ';height:' + px(h) + ';object-fit:cover;object-position:' + fit));
    }
    function yFor(ht) { return valign === 'mid' ? (cap ? TOP + (availH - ht) / 2 : (PH - ht) / 2) : TOP; }

    if (mode === 'bleed') { cover(names[0], 0, 0, PW, PH); return; }
    if (mode === 'split') {
      var hh = PH / n;
      names.forEach(function (nm, i) { cover(nm, 0, i * hh, PW, hh); });
      return;
    }
    if (mode === 'stack') {
      var sum = 0; names.forEach(function (nm) { sum += ratio(ctx, nm); });
      var w = Math.min(WMAX, (availH - GAP * (n - 1)) / sum) * scale;
      var ht = sum * w + GAP * (n - 1), y = yFor(ht), x = pageX(side, align, w);
      names.forEach(function (nm) { var h2 = ratio(ctx, nm) * w; put(nm, x, y, w, h2); y += h2 + GAP; });
      return;
    }
    if (mode === 'row') {
      var inv = 0; names.forEach(function (nm) { inv += 1 / ratio(ctx, nm); });
      var wav = PW - M;
      var h = Math.min(availH, (wav - GAP * (n - 1)) / inv) * scale;
      var wt = inv * h + GAP * (n - 1), x0 = pageX(side, align, wt), y0 = yFor(h);
      names.forEach(function (nm) { var w2 = h / ratio(ctx, nm); put(nm, x0, y0, w2, h); x0 += w2 + GAP; });
      return;
    }
    if (mode === 'grid') {
      var rows = [];
      for (var i = 0; i < n; i += 2) rows.push(names.slice(i, i + 2));
      var rsum = 0; rows.forEach(function (r) { rsum += Math.max.apply(null, r.map(function (nm) { return ratio(ctx, nm); })); });
      var wc = Math.min((PW - M - GAP) / 2, (availH - GAP * (rows.length - 1)) / rsum) * scale;
      var cols = Math.min(2, n), wt2 = wc * cols + GAP * (cols - 1);
      var gx = pageX(side, align, wt2), gy = 0, total = rsum * wc + GAP * (rows.length - 1);
      gy = yFor(total);
      rows.forEach(function (r) {
        var rh = Math.max.apply(null, r.map(function (nm) { return ratio(ctx, nm) * wc; }));
        r.forEach(function (nm, c) { put(nm, gx + c * (wc + GAP), gy, wc, ratio(ctx, nm) * wc); });
        gy += rh + GAP;
      });
      return;
    }
    // frame: one image, as large as fits
    var nm0 = names[0], r0 = ratio(ctx, nm0);
    var w0 = Math.min(WMAX / 1, availH / r0) * scale;
    var h0 = w0 * r0;
    put(nm0, pageX(side, align, w0), yFor(h0), w0, h0);
  }

  function pageContent(el, pg, side, ctx, cap) {
    pg = pg || {};
    if (pg.kind === 'text') {
      var cv = pg.style === 'cv';
      el.appendChild(node('t ' + (cv ? 'cv' : 'body'), 'left:80px;top:96px;width:560px', textHtml(pg.text, pg.style)));
    } else if (pg.kind === 'images') {
      imagesPage(el, pg, side, ctx, cap);
    }
  }

  /* ---------------------------------------------------------------- spreads */
  function names(sp) {
    var out = [];
    function add(n) { if (n) out.push(n); }
    ['L', 'R'].forEach(function (s) { var p = sp[s]; if (p && p.kind === 'images') (p.images || []).forEach(add); });
    add(sp.image);
    return out;
  }

  function renderSpread(sp, index, total, data, ctx) {
    var dark = sp.bg === 'k';
    var root = node('spread ' + (dark ? 'k' : 'w'));
    var L = node('page L'), R = node('page R');
    root.appendChild(L); root.appendChild(R);
    var layout = sp.layout || 'pages';
    var lines = (sp.caption || []).filter(function (s) { return String(s).trim(); });
    var capAt = sp.cap_at || 'L';
    var capL = layout === 'pages' && capAt === 'L' ? lines.length : 0;
    var capR = layout === 'pages' && capAt === 'R' ? lines.length : 0;

    if (layout === 'cover') {
      L.appendChild(node('t cov', 'left:' + M + 'px;top:640px;width:560px',
        '<span class="big">' + esc(sp.title_ko || '') + '</span><br><span class="mid">' + esc(sp.title_en || '') + '</span>'));
      L.appendChild(node('t w small', 'left:' + M + 'px;top:760px;width:400px', esc(sp.sub || '')));
      if (sp.image) {
        var d = dim(ctx, sp.image), w = PH * d.w / d.h;
        R.appendChild(image(ctx.src(sp.image), 'left:' + px((PW - w) / 2) + ';top:0;width:' + px(w) + ';height:' + PH + 'px'));
      }
    } else if (layout === 'end') {
      if (sp.image) {
        var e = dim(ctx, sp.image), eh = 400, ew = eh * e.w / e.h;
        L.appendChild(image(ctx.src(sp.image), 'left:120px;top:150px;width:' + px(ew) + ';height:' + eh + 'px'));
      }
      R.appendChild(node('t small', 'left:80px;top:150px;width:400px',
        (sp.lines || []).map(function (l, i) { return i === 0 ? '<b>' + esc(l) + '</b>' : esc(l); }).join('<br>')));
      if (sp.copy) R.appendChild(node('t small mute', 'left:80px;top:740px;width:300px', esc(sp.copy)));
    } else if (layout === 'full') {
      if (sp.image) {
        var p = sp.pos || [50, 50];
        root.appendChild(image(ctx.src(sp.image), 'left:0;top:0;width:1440px;height:810px;object-fit:cover;object-position:' + p[0] + '% ' + p[1] + '%'));
      }
    } else if (layout === 'fit') {
      if (sp.image) {
        var f = dim(ctx, sp.image), hmax = num(sp.h, 700), top = 52;
        var wf = Math.min(1440, hmax * f.w / f.h), hf = wf * f.h / f.w;
        if (hf < hmax) top = Math.max(top, (PH - hf) / 2 - (lines.length ? 12 : 0));
        root.appendChild(image(ctx.src(sp.image), 'left:' + px((1440 - wf) / 2) + ';top:' + px(top) + ';width:' + px(wf) + ';height:' + px(hf)));
      }
    } else {
      pageContent(L, sp.L, 'L', ctx, capL);
      pageContent(R, sp.R, 'R', ctx, capR);
    }

    if (lines.length && layout !== 'cover' && layout !== 'end') {
      var chip = sp.cap_chip || layout === 'full';
      var cap = node('cap' + (chip ? ' chip' : ''), 'bottom:26px', lines.map(esc).join('<br>'));
      if (capAt === 'R' && layout === 'pages') { cap.style.left = M + 'px'; R.appendChild(cap); }
      else if (capAt === 'S' || layout !== 'pages') { cap.style.left = M + 'px'; root.appendChild(cap); }
      else { cap.style.left = M + 'px'; L.appendChild(cap); }
    }

    root.appendChild(node('spine'));
    var hd = sp.hd || (dark ? 'w' : 'k');
    root.appendChild(node('hd hl ' + hd, null, esc(data.running || '')));
    var nn = String(index + 1); if (nn.length < 2) nn = '0' + nn;
    var tt = String(total); if (tt.length < 2) tt = '0' + tt;
    root.appendChild(node('hd hr ' + hd, null, 'Portfolio ' + esc(data.year || '') + ' &nbsp; ' + nn + ' / ' + tt));
    return root;
  }

  /* ---------------------------------------------------------------- loading */
  var cache = {};
  function preload(list, src) {
    var jobs = [];
    list.forEach(function (name) {
      var key = src(name);
      if (!cache[key]) {
        cache[key] = new Promise(function (res) {
          var im = new Image();
          im.onload = function () { res({ w: im.naturalWidth, h: im.naturalHeight }); };
          im.onerror = function () { res({ w: 0, h: 0 }); };
          im.src = key;
        });
      }
      jobs.push(cache[key].then(function (d) { return [name, d]; }));
    });
    return Promise.all(jobs).then(function (rows) {
      var out = {}; rows.forEach(function (r) { out[r[0]] = r[1]; }); return out;
    });
  }

  function waitImages(el) {
    var list = Array.prototype.slice.call(el.querySelectorAll('img'));
    return Promise.all(list.map(function (i) {
      return i.complete ? Promise.resolve() : new Promise(function (r) { i.onload = i.onerror = r; });
    }));
  }

  /* render one spread (async: waits for the image sizes) */
  function build(sp, index, total, data, src) {
    return preload(names(sp), src).then(function (dims) {
      return renderSpread(sp, index, total, data, { dims: dims, src: src });
    });
  }

  function buildAll(container, data, src) {
    var list = data.spreads || [];
    var all = [];
    list.forEach(function (sp) { all = all.concat(names(sp)); });
    return preload(all, src).then(function (dims) {
      list.forEach(function (sp, i) { container.appendChild(renderSpread(sp, i, list.length, data, { dims: dims, src: src })); });
      return waitImages(container);
    });
  }

  /* PDF only: re-encode every picture at the size it is really shown (x factor), so the file stays small.
     (Chromium puts the original JPEG into the PDF, however small it is displayed.) */
  function shrink(container, factor, quality) {
    var list = Array.prototype.slice.call(container.querySelectorAll('.spread img'));
    return Promise.all(list.map(function (im) {
      return new Promise(function (resolve) {
        var nw = im.naturalWidth, nh = im.naturalHeight, r = im.getBoundingClientRect();
        if (!nw || !nh || !r.width || !r.height) return resolve();
        var s = Math.max(r.width / nw, r.height / nh) * factor;      // output pixels per source pixel
        if (s >= 0.92) return resolve();                              // already about the right size
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(nw * s)); c.height = Math.max(1, Math.round(nh * s));
        var ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(im, 0, 0, c.width, c.height);
        c.toBlob(function (blob) {
          if (!blob) return resolve();
          im.onload = im.onerror = function () { resolve(); };
          im.src = URL.createObjectURL(blob);
        }, 'image/jpeg', quality || 0.82);
      });
    }));
  }

  root.Portfolio = { shrink: shrink, build: build, buildAll: buildAll, waitImages: waitImages, names: names, textHtml: textHtml, W: 1440, H: 810 };
})(window);
