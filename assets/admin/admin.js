/* Site editor. Talks to GitHub directly from the browser:
   it reads content/*.json, lets you edit, then saves everything as ONE commit on the site branch.
   A GitHub Action then rebuilds the pages. No server, no dependencies. */
(function () {
  'use strict';

  // ---------------------------------------------------------------- tiny helpers
  var $ = function (s, el) { return (el || document).querySelector(s); };
  function h(tag, props) {
    var e = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'value') e.value = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) append(e, arguments[i]);
    return e;
  }
  function append(e, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(e, x); }); return; }
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var enc = new TextEncoder(), dec = new TextDecoder();

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  function b64(buf) {
    var a = new Uint8Array(buf), s = '', n = 0x8000;
    for (var i = 0; i < a.length; i += n) s += String.fromCharCode.apply(null, a.subarray(i, i + n));
    return btoa(s);
  }
  function unb64(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
  function blobToB64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1]); };
      r.onerror = function () { rej(r.error); };
      r.readAsDataURL(blob);
    });
  }

  // ---------------------------------------------------------------- password vault (token encrypted in this browser)
  var VAULT = 'dk_admin_vault', CFGKEY = 'dk_admin_cfg';

  async function deriveKey(pw, salt) {
    var base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 250000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(token, pw) {
    var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    var key = await deriveKey(pw, salt);
    var ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(token));
    return { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
  }
  async function unseal(vault, pw) {
    try {
      var key = await deriveKey(pw, unb64(vault.salt));
      var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(vault.iv) }, key, unb64(vault.ct));
      return dec.decode(pt);
    } catch (e) { return null; }
  }
  function getVault() { try { return JSON.parse(localStorage.getItem(VAULT)); } catch (e) { return null; } }

  // ---------------------------------------------------------------- state
  var cfg = null, token = null;
  var S = {
    phase: 'boot', view: 'works', sel: null, cvLang: 'en', busy: false,
    content: null, origSer: null, deletedWorks: [], build: null, pfSel: null, pfPending: {}
  };
  var KEYS = ['works', 'site', 'bio', 'statement', 'cv', 'texts', 'portfolio'];
  var VIEWS = [['works', '작품'], ['site', '사이트 정보'], ['bio', '소개 Bio'], ['statement', '작가노트'], ['cv', '이력 CV'], ['texts', '글 Texts'], ['portfolio', '포트폴리오 PDF']];

  function ser(o) { return JSON.stringify(o, function (k, v) { return k.charAt(0) === '_' ? undefined : v; }, 1); }

  // ---------------------------------------------------------------- GitHub API
  function ref() { return cfg.branch.split('/').map(encodeURIComponent).join('/'); }
  function repoPath() { return '/repos/' + cfg.owner + '/' + cfg.repo; }

  async function gh(path, opts) {
    opts = opts || {};
    var headers = {
      'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (opts.body) headers['Content-Type'] = 'application/json';
    if (opts.accept) headers['Accept'] = opts.accept;
    var r = await fetch(cfg.api + path, { method: opts.method || 'GET', headers: headers, body: opts.body, cache: 'no-store' });
    if (!r.ok) {
      var msg = ''; try { msg = (await r.json()).message; } catch (e) {}
      var err = new Error(msg || r.statusText); err.status = r.status; throw err;
    }
    if (r.status === 204) return null;
    return opts.raw ? r.text() : r.json();
  }

  function explain(e) {
    if (e && e.status === 401) return '토큰이 올바르지 않거나 만료됐어요. 새 토큰을 만들어 다시 등록해주세요.';
    if (e && e.status === 403) return '이 토큰에 권한이 부족해요. "Contents: Read and write" 권한을 확인해주세요. (' + e.message + ')';
    if (e && e.status === 404) return '저장소나 브랜치를 찾지 못했어요. 토큰이 이 저장소에 접근할 수 있는지, 고급 설정의 브랜치 이름이 맞는지 확인해주세요.';
    if (e && e.status === 422) return '저장 중 충돌이 났어요. 잠시 뒤 다시 시도해주세요. (' + e.message + ')';
    return '문제가 생겼어요: ' + (e && e.message ? e.message : e);
  }

  async function loadContent() {
    var out = {}, orig = {};
    await Promise.all(KEYS.map(async function (k) {
      var txt = await gh(repoPath() + '/contents/content/' + k + '.json?ref=' + encodeURIComponent(cfg.branch),
        { accept: 'application/vnd.github.raw+json', raw: true });
      out[k] = JSON.parse(txt);
    }));
    out.works.forEach(function (w) {
      w._coverFrom = w.images.length ? w.images[0].f : null;
      w._deleted = [];
      w.videos = w.videos || [];
    });
    KEYS.forEach(function (k) { orig[k] = ser(out[k]); });
    S.content = out; S.origSer = orig; S.deletedWorks = []; S.sel = null; S.pfSel = null;
  }

  // ---------------------------------------------------------------- change tracking
  function changedKeys() { return KEYS.filter(function (k) { return ser(S.content[k]) !== S.origSer[k]; }); }
  function pendingImages() {
    var n = 0;
    S.content.works.forEach(function (w) { w.images.forEach(function (im) { if (im._blob) n++; }); });
    Object.keys(S.pfPending).forEach(function (k) { if (!S.pfPending[k].saved) n++; });
    return n;
  }
  function pendingDeletes() {
    var n = S.deletedWorks.length;
    S.content.works.forEach(function (w) { n += (w._deleted || []).length; });
    return n;
  }
  function isDirty() { return changedKeys().length > 0 || pendingImages() > 0 || pendingDeletes() > 0; }

  var touchQueued = false;
  function touch() {
    if (touchQueued) return; touchQueued = true;
    requestAnimationFrame(function () { touchQueued = false; refreshBar(); });
  }

  window.addEventListener('beforeunload', function (e) {
    if (S.phase === 'main' && isDirty()) { e.preventDefault(); e.returnValue = ''; }
  });

  // ---------------------------------------------------------------- images
  async function bitmapFrom(blob) {
    if (window.createImageBitmap) return createImageBitmap(blob);
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(blob), im = new Image();
      im.onload = function () { res(im); }; im.onerror = rej; im.src = u;
    });
  }
  async function resizeToJpeg(blob, max, quality) {
    var bmp = await bitmapFrom(blob);
    var w0 = bmp.width, h0 = bmp.height, s = Math.min(1, max / Math.max(w0, h0));
    var w = Math.max(1, Math.round(w0 * s)), hh = Math.max(1, Math.round(h0 * s));
    var cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
    var ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hh); ctx.drawImage(bmp, 0, 0, w, hh);
    var out = await new Promise(function (r) { cv.toBlob(r, 'image/jpeg', quality); });
    if (bmp.close) bmp.close();
    return { blob: out, w: w, h: hh };
  }

  async function addImages(work, files) {
    var list = Array.prototype.slice.call(files).filter(function (f) { return /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|avif)$/i.test(f.name); });
    if (!list.length) { toast('이미지 파일을 골라주세요.'); return; }
    var done = 0;
    for (var i = 0; i < list.length; i++) {
      try {
        var r = await resizeToJpeg(list[i], 1400, 0.8);
        var f = 'u' + Date.now().toString(36) + i + '.jpg';
        work.images.push({ f: f, w: r.w, h: r.h, _blob: r.blob, _url: URL.createObjectURL(r.blob) });
        done++;
      } catch (e) { toast('"' + list[i].name + '" 은(는) 읽을 수 없는 형식이에요.'); }
    }
    if (done) { toast(done + '장을 추가했어요. 게시하기를 눌러야 사이트에 반영돼요.'); }
    renderPanel(); touch();
  }

  function imgSrc(w, im) { return im._url || ('../assets/works/' + w.slug + '/' + im.f); }
  function coverSrc(w) {
    if (!w.images.length) return '';
    var im = w.images[0];
    if (im._url) return im._url;
    return (!w._new && im.f === w._coverFrom) ? '../assets/works/' + w.slug + '/cover.jpg' : imgSrc(w, im);
  }

  // ---------------------------------------------------------------- text helpers
  function parseParas(v) { return v.split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(Boolean); }
  function parseLines(v) { return v.split('\n').map(function (s) { return s.trim(); }).filter(Boolean); }
  function slugify(s) {
    var t = (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return t || 'work';
  }
  function autosize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight + 4, 640) + 'px'; }

  function field(label, input, hint, cls) {
    return h('label', { class: 'f ' + (cls || '') }, h('span', { class: 'm' }, label), input, hint ? h('span', { class: 'hint' }, hint) : null);
  }
  function textInput(obj, key, opts) {
    opts = opts || {};
    return h(opts.type === 'number' ? 'input' : 'input', {
      type: opts.type || 'text', value: obj[key] == null ? '' : obj[key], placeholder: opts.ph || '',
      oninput: function (e) {
        var v = e.target.value;
        obj[key] = opts.type === 'number' ? (v === '' ? '' : parseInt(v, 10)) : v;
        if (opts.after) opts.after();
        touch();
      }
    });
  }
  function areaInput(getVal, setVal, rows) {
    var ta = h('textarea', { rows: rows || 4, value: getVal() });
    ta.addEventListener('input', function () { setVal(ta.value); autosize(ta); touch(); });
    requestAnimationFrame(function () { autosize(ta); });
    return ta;
  }
  function moveItem(arr, i, d) {
    var j = i + d; if (j < 0 || j >= arr.length) return false;
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t; return true;
  }

  // ---------------------------------------------------------------- views
  function viewWorks() {
    var ws = S.content.works;
    if (S.sel != null && ws[S.sel]) return viewWorkEdit(ws[S.sel], S.sel);
    var rows = ws.map(function (w, i) {
      return h('div', { class: 'wrow' },
        h('span', { class: 'num' }, String(i + 1).padStart(2, '0')),
        w.images.length ? h('img', { src: coverSrc(w), alt: '', loading: 'lazy' }) : h('span'),
        h('div', { class: 't', onclick: function () { S.sel = i; renderPanel(); window.scrollTo(0, 0); } },
          h('b', null, w.title_en || '(제목 없음)'), w._new ? h('span', { class: 'tag' }, '새 작품') : null,
          h('span', null, [w.title_ko && w.title_ko !== w.title_en ? w.title_ko + ' · ' : '', w.year, w.medium ? ' · ' + w.medium : ''].join(''))),
        h('div', { class: 'ctl' },
          h('button', { class: 'btn small', title: '위로', 'aria-label': '위로', onclick: function () { if (moveItem(ws, i, -1)) { renderPanel(); touch(); } } }, '↑'),
          h('button', { class: 'btn small', title: '아래로', 'aria-label': '아래로', onclick: function () { if (moveItem(ws, i, 1)) { renderPanel(); touch(); } } }, '↓'),
          h('button', { class: 'btn small', onclick: function () { S.sel = i; renderPanel(); window.scrollTo(0, 0); } }, '편집')));
    });
    return h('div', null,
      h('h2', null, '작품'),
      h('p', { class: 'lead' }, '순서가 곧 사이트에 보이는 순서예요. 위쪽일수록 먼저 보여요.'),
      h('div', { class: 'toolbar' }, h('span', { class: 'm mute' }, ws.length + '개'),
        h('button', { class: 'btn', onclick: newWork }, '＋ 새 작품')),
      h('div', { class: 'wlist' }, rows));
  }

  function newWork() {
    var w = { n: 0, slug: '', year: new Date().getFullYear(), title_en: '', title_ko: '', medium: '', images: [], videos: [], _new: true, _deleted: [], _coverFrom: null };
    S.content.works.unshift(w); S.sel = 0; renderPanel(); touch(); window.scrollTo(0, 0);
  }

  function viewWorkEdit(w, idx) {
    var grid = h('div', { class: 'igrid' }, w.images.map(function (im, k) {
      return h('div', { class: 'icard' },
        h('div', { class: 'im' }, h('img', { src: imgSrc(w, im), alt: '' }),
          h('span', { class: 'badge' + (k === 0 ? ' cover' : '') }, k === 0 ? '대표 · 1' : String(k + 1))),
        h('div', { class: 'ctl' },
          h('button', { class: 'btn small', 'aria-label': '앞으로', onclick: function () { if (moveItem(w.images, k, -1)) { renderPanel(); touch(); } } }, '◀'),
          h('button', { class: 'btn small', 'aria-label': '뒤로', onclick: function () { if (moveItem(w.images, k, 1)) { renderPanel(); touch(); } } }, '▶'),
          h('button', { class: 'btn small danger', onclick: function () {
            var removed = w.images.splice(k, 1)[0];
            if (removed && !removed._blob) w._deleted.push(removed.f);
            renderPanel(); touch();
          } }, '삭제')));
    }));
    var fileIn = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: function (e) { addImages(w, e.target.files); e.target.value = ''; } });
    var drop = h('div', { class: 'drop', tabindex: '0', role: 'button',
      onclick: function () { fileIn.click(); },
      onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } },
      ondragover: function (e) { e.preventDefault(); drop.classList.add('over'); },
      ondragleave: function () { drop.classList.remove('over'); },
      ondrop: function (e) { e.preventDefault(); drop.classList.remove('over'); addImages(w, e.dataTransfer.files); } },
      '이미지를 여기로 끌어놓거나 눌러서 고르세요 (여러 장 가능)');
    return h('div', null,
      h('div', { class: 'toolbar' },
        h('button', { class: 'btn small', onclick: function () { S.sel = null; renderPanel(); } }, '← 목록'),
        h('span', { class: 'm mute' }, w._new ? '주소: 저장할 때 정해져요' : '주소: /works/' + w.slug + '/')),
      h('h2', null, w.title_en || '새 작품'),
      h('div', { class: 'row2', style: 'margin-top:16px' },
        field('제목 (영어) *', textInput(w, 'title_en')),
        field('제목 (한국어)', textInput(w, 'title_ko'), '비워두면 한국어 화면에서도 영어 제목이 보여요.')),
      h('div', { class: 'row3' },
        field('매체 (영어, 선택)', textInput(w, 'medium', { ph: 'single-channel video, color, sound, 4min' })),
        field('연도 *', textInput(w, 'year', { type: 'number' }))),
      h('p', { class: 'm mute', style: 'margin:6px 0 0' }, '이미지 (' + w.images.length + ')'),
      h('p', { class: 'hint' }, '첫 번째 이미지가 홈의 대표 이미지가 돼요. 큰 사진은 자동으로 줄여서 올려요.'),
      grid, drop, fileIn,
      w.videos && w.videos.length ? h('p', { class: 'hint', style: 'margin-top:10px' }, '영상 ' + w.videos.length + '개가 연결돼 있어요. (영상은 이 화면에서 바꿀 수 없어요.)') : null,
      h('div', { style: 'margin-top:28px;padding-top:16px;border-top:1px solid var(--line)' },
        h('button', { class: 'btn danger', onclick: function () {
          if (!confirm('"' + (w.title_en || '새 작품') + '" 작품을 삭제할까요? 게시하기를 누르기 전까지는 되돌릴 수 있어요.')) return;
          S.content.works.splice(idx, 1); if (!w._new) S.deletedWorks.push(w);
          S.sel = null; renderPanel(); touch();
        } }, '이 작품 삭제')));
  }

  function viewSite() {
    var s = S.content.site;
    return h('div', null, h('h2', null, '사이트 정보'), h('p', { class: 'lead' }, '홈 소개 문장과 연락처 정보예요.'),
      field('홈 소개 (영어)', areaInput(function () { return s.desc_en; }, function (v) { s.desc_en = v; }, 4)),
      field('홈 소개 (한국어)', areaInput(function () { return s.desc_ko; }, function (v) { s.desc_ko = v; }, 3)),
      h('div', { class: 'row2' },
        field('이메일', textInput(s, 'email', { type: 'email' })),
        field('인스타그램 주소', textInput(s, 'instagram', { type: 'url' }))),
      field('포트폴리오 PDF 주소', textInput(s, 'portfolio'), 'CV 페이지와 홈 오른쪽에 링크로 나와요. 사이트 안의 파일(assets/portfolio/…pdf)이나 전체 주소(https://…) 모두 쓸 수 있어요.'));
  }

  function viewParas(key, title, lead) {
    var d = S.content[key];
    return h('div', null, h('h2', null, title), h('p', { class: 'lead' }, lead),
      field('영어', areaInput(function () { return d.en.join('\n\n'); }, function (v) { d.en = parseParas(v); }, 8), '문단은 빈 줄로 나눠요.'),
      field('한국어', areaInput(function () { return d.ko.join('\n\n'); }, function (v) { d.ko = parseParas(v); }, 8)));
  }

  function viewCv() {
    var lang = S.cvLang, secs = S.content.cv[lang];
    var tabs = h('div', { class: 'tabs' }, [['en', '영어'], ['ko', '한국어']].map(function (t) {
      return h('button', { class: S.cvLang === t[0] ? 'on' : '', onclick: function () { S.cvLang = t[0]; renderPanel(); } }, t[1]);
    }));
    var cards = secs.map(function (sec, i) {
      return h('div', { class: 'card' },
        h('div', { class: 'ctl' },
          h('button', { class: 'btn small', 'aria-label': '위로', onclick: function () { if (moveItem(secs, i, -1)) { renderPanel(); touch(); } } }, '↑'),
          h('button', { class: 'btn small', 'aria-label': '아래로', onclick: function () { if (moveItem(secs, i, 1)) { renderPanel(); touch(); } } }, '↓'),
          h('button', { class: 'btn small danger', onclick: function () { if (confirm('이 섹션을 삭제할까요?')) { secs.splice(i, 1); renderPanel(); touch(); } } }, '삭제')),
        field('섹션 제목', textInput(sec, 'heading')),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!sec.home, onchange: function (e) { sec.home = e.target.checked; touch(); } }), '홈 오른쪽에 보여주기'),
        field('항목 (한 줄에 하나)', areaInput(function () { return sec.items.join('\n'); }, function (v) { sec.items = parseLines(v); }, 6),
          '연도로 시작하는 줄은 왼쪽에 연도가 따로 나와요. 예) 2026 "Hyperobject", Daegu Art Factory'));
    });
    return h('div', null, h('h2', null, '이력 CV'), h('p', { class: 'lead' }, '영어와 한국어 이력은 따로 관리돼요.'),
      tabs, cards, h('button', { class: 'btn', onclick: function () { secs.push({ heading: '', items: [], home: false }); renderPanel(); touch(); } }, '＋ 섹션 추가'));
  }

  function viewTexts() {
    var list = S.content.texts;
    var cards = list.map(function (e, i) {
      return h('div', { class: 'card' },
        h('div', { class: 'ctl' },
          h('button', { class: 'btn small', 'aria-label': '위로', onclick: function () { if (moveItem(list, i, -1)) { renderPanel(); touch(); } } }, '↑'),
          h('button', { class: 'btn small', 'aria-label': '아래로', onclick: function () { if (moveItem(list, i, 1)) { renderPanel(); touch(); } } }, '↓'),
          h('button', { class: 'btn small danger', onclick: function () { if (confirm('이 글을 삭제할까요?')) { list.splice(i, 1); renderPanel(); touch(); } } }, '삭제')),
        h('div', { class: 'row2' },
          field('제목 (한국어 화면)', textInput(e, 'title')),
          field('제목 (영어 화면)', textInput(e, 'title_en'))),
        h('div', { class: 'row2' },
          field('부제 (선택)', h('input', { type: 'text', value: e.subtitle || '', oninput: function (ev) { e.subtitle = ev.target.value || null; touch(); } })),
          field('글쓴이', textInput(e, 'author'))),
        field('본문', areaInput(function () { return e.paras.join('\n\n'); }, function (v) { e.paras = parseParas(v); }, 10), '문단은 빈 줄로 나눠요.'),
        field('각주 (한 줄에 하나, 선택)', areaInput(function () { return e.notes.join('\n'); }, function (v) { e.notes = parseLines(v); }, 3)));
    });
    return h('div', null, h('h2', null, '글 Texts'), h('p', { class: 'lead' }, '전시 서문이나 비평 같은 글이에요.'),
      cards, h('button', { class: 'btn', onclick: function () {
        list.push({ slug: 'text-' + Date.now().toString(36), title: '', title_en: '', subtitle: null, author: '', paras: [], notes: [] });
        renderPanel(); touch();
      } }, '＋ 글 추가'));
  }

  // ---------------------------------------------------------------- shell
  function renderPanel() {
    var p = $('#panel'); if (!p) return;
    var v = S.view, node;
    if (v === 'works') node = viewWorks();
    else if (v === 'site') node = viewSite();
    else if (v === 'bio') node = viewParas('bio', '소개 Bio', '소개 글이에요.');
    else if (v === 'statement') node = viewParas('statement', '작가노트', '작가노트 글이에요.');
    else if (v === 'cv') node = viewCv();
    else if (v === 'portfolio') node = window.AdminPortfolio.view(api());
    else node = viewTexts();
    p.replaceChildren(node);
    refreshNav();
  }
  function refreshNav() {
    var ck = changedKeys();
    var imgs = pendingImages() > 0 || pendingDeletes() > 0;
    Array.prototype.forEach.call(document.querySelectorAll('.side button'), function (b) {
      var k = b.dataset.k;
      b.classList.toggle('on', k === S.view);
      var d = b.querySelector('.dot'); if (d) d.style.display = (ck.indexOf(k) >= 0 || (k === 'works' && imgs)) ? '' : 'none';
    });
  }
  function summary() {
    var names = { works: '작품', site: '사이트 정보', bio: '소개', statement: '작가노트', cv: 'CV', texts: '글', portfolio: '포트폴리오 PDF' };
    var parts = changedKeys().map(function (k) { return names[k]; });
    if (pendingImages()) parts.push('새 이미지 ' + pendingImages() + '장');
    if (pendingDeletes()) parts.push('삭제 ' + pendingDeletes() + '건');
    return parts;
  }
  function refreshBar() {
    var btn = $('#publish'), info = $('#dirtyinfo');
    if (!btn) return;
    var parts = summary();
    btn.disabled = S.busy || parts.length === 0;
    var d = $('#discard'); if (d) d.disabled = S.busy || parts.length === 0;
    if (info) info.textContent = parts.length ? '변경: ' + parts.join(', ') : '변경 사항 없음';
    refreshNav();
  }

  function renderBuild() {
    var box = $('#build'); if (!box) return;
    box.replaceChildren();
    if (!S.build) return;
    box.append(h('div', { class: 'msg ' + (S.build.kind || '') }, S.build.text,
      S.build.link ? [' ', h('a', { class: 'link', href: S.build.link, target: '_blank', rel: 'noopener' }, S.build.linkText || '열기')] : null));
  }
  function setBuild(text, kind, link, linkText) { S.build = text ? { text: text, kind: kind, link: link, linkText: linkText } : null; renderBuild(); }

  function renderMain() {
    var app = $('#app'); app.replaceChildren();
    var nav = h('nav', { class: 'side', 'aria-label': '메뉴' }, VIEWS.map(function (v) {
      return h('button', { 'data-k': v[0], onclick: function () { S.view = v[0]; S.sel = null; renderPanel(); window.scrollTo(0, 0); } },
        h('span', null, v[1]), h('span', { class: 'dot', style: 'display:none' }));
    }));
    app.append(
      h('header', { class: 'bar' },
        h('div', { class: 'title' }, h('b', null, '사이트 관리'), h('span', { class: 'm mute' }, cfg.owner + '/' + cfg.repo + ' · ' + cfg.branch)),
        h('div', { class: 'right' },
          h('span', { class: 'm mute', id: 'dirtyinfo' }, ''),
          h('button', { class: 'btn small', id: 'discard', onclick: discard }, '변경 버리기'),
          h('button', { class: 'btn primary', id: 'publish', onclick: publish }, '게시하기'),
          h('button', { class: 'btn small', onclick: lock }, '잠그기'))),
      h('div', { class: 'build', id: 'build' }),
      h('div', { class: 'body' }, nav, h('main', { class: 'panel', id: 'panel' })));
    renderPanel(); refreshBar(); renderBuild();
  }

  async function discard() {
    if (!isDirty() || !confirm('고친 내용을 모두 버리고 저장소의 현재 내용으로 되돌릴까요?')) return;
    S.busy = true; refreshBar();
    try { await loadContent(); toast('변경 내용을 버렸어요.'); } catch (e) { toast(explain(e)); }
    S.busy = false; renderPanel(); refreshBar();
  }

  function lock() {
    if (isDirty() && !confirm('게시하지 않은 변경 사항이 있어요. 그래도 잠글까요?')) return;
    token = null; S.content = null; S.phase = 'lock'; S.build = null; renderLock();
  }

  // ---------------------------------------------------------------- publish (one commit)
  function validate() {
    var problems = [], ws = S.content.works;
    ws.forEach(function (w, i) {
      var name = (w.title_en || '(제목 없음)') + ' [' + (i + 1) + '번째 작품]';
      if (!String(w.title_en || '').trim()) problems.push(name + ': 영어 제목이 필요해요.');
      if (!(parseInt(w.year, 10) >= 1900)) problems.push(name + ': 연도를 숫자로 적어주세요.');
      if (!w.images.length) problems.push(name + ': 이미지가 한 장 이상 필요해요.');
    });
    var s = S.content.site;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email || '')) problems.push('사이트 정보: 이메일 형식을 확인해주세요.');
    S.content.cv.en.concat(S.content.cv.ko).forEach(function (sec) { if (!String(sec.heading).trim()) problems.push('CV: 제목이 비어 있는 섹션이 있어요.'); });
    S.content.texts.forEach(function (t) { if (!String(t.title).trim()) problems.push('글: 제목이 비어 있는 글이 있어요.'); });
    return problems;
  }

  async function publish() {
    if (S.busy || !isDirty()) return;
    var problems = validate();
    if (problems.length) { setBuild('먼저 확인해주세요:\n' + problems.join('\n'), 'bad'); $('#build .msg').style.whiteSpace = 'pre-line'; return; }
    if (!confirm('지금까지 고친 내용을 사이트에 게시할까요?\n(' + summary().join(', ') + ')')) return;
    S.busy = true; refreshBar();
    try {
      var ws = S.content.works;
      // slugs for new works
      var used = {}; ws.forEach(function (w) { if (!w._new) used[w.slug] = 1; });
      ws.forEach(function (w) {
        if (!w._new) return;
        var base = slugify(w.title_en), s = base, n = 2;
        while (used[s]) s = base + '-' + (n++);
        w.slug = s; used[s] = 1;
      });
      ws.forEach(function (w, i) { w.n = i + 1; w.year = parseInt(w.year, 10); w.title_ko = (w.title_ko || '').trim() || w.title_en.trim(); w.title_en = w.title_en.trim(); });

      setBuild('이미지를 준비하는 중…');
      var entries = [];
      KEYS.forEach(function (k) {
        var t = ser(S.content[k]);
        if (t !== S.origSer[k]) entries.push({ path: 'content/' + k + '.json', text: t });
      });
      for (var i = 0; i < ws.length; i++) {
        var w = ws[i], dir = 'assets/works/' + w.slug;
        w.images.forEach(function (im) { if (im._blob) entries.push({ path: dir + '/' + im.f, blob: im._blob }); });
        (w._deleted || []).forEach(function (f) { entries.push({ path: dir + '/' + f, del: true }); });
        if (w.images.length && (w._new || w.images[0].f !== w._coverFrom)) {
          var src = w.images[0]._blob || w.images[0]._cached;
          if (!src) { var resp = await fetch('../assets/works/' + w.slug + '/' + w.images[0].f, { cache: 'no-store' }); if (!resp.ok) throw new Error('대표 이미지를 읽지 못했어요.'); src = await resp.blob(); }
          var cv = await resizeToJpeg(src, 900, 0.8);
          entries.push({ path: dir + '/cover.jpg', blob: cv.blob });
        }
      }
      Object.keys(S.pfPending).forEach(function (name) {
        var pe = S.pfPending[name];
        if (!pe.saved && pe.blob) entries.push({ path: 'portfolio/img/' + name, blob: pe.blob });
      });
      var pfChanged = changedKeys().indexOf('portfolio') >= 0 || Object.keys(S.pfPending).some(function (k) { return !S.pfPending[k].saved; });
      S.deletedWorks.forEach(function (dw) {
        var dir = 'assets/works/' + dw.slug;
        dw.images.concat((dw._deleted || []).map(function (f) { return { f: f }; })).forEach(function (im) { entries.push({ path: dir + '/' + im.f, del: true }); });
        entries.push({ path: dir + '/cover.jpg', del: true });
        (dw.videos || []).forEach(function (v) { entries.push({ path: dir + '/' + v + '.mp4', del: true }); });
      });
      // a path that is both removed and added is just an add
      var added = {}; entries.forEach(function (e) { if (!e.del) added[e.path] = 1; });
      entries = entries.filter(function (e) { return !(e.del && added[e.path]); });

      var message = '관리 페이지에서 수정: ' + summary().join(', ');
      var sha = await commitEntries(entries, message);

      // success: this is now the saved state
      KEYS.forEach(function (k) { S.origSer[k] = ser(S.content[k]); });
      ws.forEach(function (w) { delete w._new; w._deleted = []; w._coverFrom = w.images.length ? w.images[0].f : null; w.images.forEach(function (im) { if (im._blob) { im._cached = im._blob; delete im._blob; } }); });
      S.deletedWorks = [];
      Object.keys(S.pfPending).forEach(function (k) { S.pfPending[k].saved = true; });
      S.busy = false; renderPanel(); refreshBar();
      watchBuild(sha, pfChanged);
    } catch (e) {
      S.busy = false; refreshBar();
      setBuild(explain(e), 'bad');
    }
  }

  async function commitEntries(entries, message) {
    var blobCache = {};
    for (var attempt = 0; attempt < 3; attempt++) {
      var head = await gh(repoPath() + '/git/ref/heads/' + ref());
      var commit = await gh(repoPath() + '/git/commits/' + head.object.sha);
      var baseTree = commit.tree.sha;
      var existing = {};
      var tr = await gh(repoPath() + '/git/trees/' + baseTree + '?recursive=1');
      (tr.tree || []).forEach(function (t) { existing[t.path] = 1; });
      var tree = [], total = entries.filter(function (e) { return e.blob; }).length, done = 0;
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (e.text != null) tree.push({ path: e.path, mode: '100644', type: 'blob', content: e.text });
        else if (e.blob) {
          if (!blobCache[e.path]) {
            setBuild('이미지를 올리는 중… (' + (++done) + '/' + total + ')');
            var r = await gh(repoPath() + '/git/blobs', { method: 'POST', body: JSON.stringify({ content: await blobToB64(e.blob), encoding: 'base64' }) });
            blobCache[e.path] = r.sha;
          }
          tree.push({ path: e.path, mode: '100644', type: 'blob', sha: blobCache[e.path] });
        } else if (e.del && existing[e.path]) tree.push({ path: e.path, mode: '100644', type: 'blob', sha: null });
      }
      setBuild('저장하는 중…');
      var nt = await gh(repoPath() + '/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: baseTree, tree: tree }) });
      var nc = await gh(repoPath() + '/git/commits', { method: 'POST', body: JSON.stringify({ message: message, tree: nt.sha, parents: [head.object.sha] }) });
      try {
        await gh(repoPath() + '/git/refs/heads/' + ref(), { method: 'PATCH', body: JSON.stringify({ sha: nc.sha, force: false }) });
        return nc.sha;
      } catch (err) {
        if (err.status === 422 && attempt < 2) { await sleep(1200); continue; }   // branch moved (e.g. the site rebuilt): retry on top of it
        throw err;
      }
    }
  }

  async function watchBuild(sha, pdf) {
    var actions = 'https://github.com/' + cfg.owner + '/' + cfg.repo + '/actions';
    setBuild(pdf ? '저장했어요. 사이트와 포트폴리오 PDF를 다시 만들고 있어요… (보통 2~3분)' : '저장했어요. 사이트를 다시 만들고 있어요… (보통 1~2분)');
    var t0 = Date.now();
    while (Date.now() - t0 < 240000) {
      await sleep(5000);
      if (S.phase !== 'main' || !token) return;
      try {
        var list = await gh(repoPath() + '/commits?sha=' + encodeURIComponent(cfg.branch) + '&per_page=8');
        var idx = list.findIndex(function (c) { return c.sha === sha; });
        var built = list.slice(0, idx < 0 ? list.length : idx).some(function (c) { return (pdf ? /^Rebuild portfolio/ : /^Rebuild site/).test(c.commit.message); });
        if (built) { setBuild('완성됐어요! 사이트에는 1~2분 안에 반영돼요. 안 바뀌어 보이면 새로고침(또는 시크릿 창)으로 확인해보세요.', 'ok'); return; }
      } catch (e) { /* keep waiting */ }
    }
    setBuild('아직 완성 소식을 확인하지 못했어요. 조금 더 기다려보시고, 계속 안 바뀌면 GitHub의 Actions 탭에서 상태를 확인해주세요.', 'bad', actions, 'Actions 열기');
  }

  // ---------------------------------------------------------------- lock / setup screens
  function renderLock() {
    var app = $('#app'); app.replaceChildren();
    var vault = getVault();
    var err = h('p', { class: 'err', role: 'alert' });
    var box = h('div', { class: 'lock' });
    box.append(h('h1', null, '사이트 관리'), h('p', { class: 'mute m' }, cfg.owner + '/' + cfg.repo + ' · ' + cfg.branch));

    if (vault) {
      var pw = h('input', { type: 'password', autocomplete: 'current-password', autofocus: true });
      var go = async function () {
        if (!pw.value) return;
        err.textContent = '';
        var t = await unseal(vault, pw.value);
        if (!t) { err.textContent = '비밀번호가 맞지 않아요.'; return; }
        await enter(t, err);
      };
      pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      box.append(h('p', null, '비밀번호를 입력하세요.'), field('비밀번호', pw), err,
        h('button', { class: 'btn primary', onclick: go }, '열기'),
        h('details', null, h('summary', null, '이 기기에서 토큰 지우기'),
          h('p', { style: 'margin:10px 0' }, '이 브라우저에 저장된 토큰을 지워요. 다시 쓰려면 토큰을 새로 붙여넣어야 해요.'),
          h('button', { class: 'btn small danger', onclick: function () { if (confirm('이 기기에 저장된 토큰을 지울까요?')) { localStorage.removeItem(VAULT); renderLock(); } } }, '토큰 지우기')));
    } else {
      var tk = h('input', { type: 'password', autocomplete: 'off', placeholder: 'github_pat_…' });
      var p1 = h('input', { type: 'password', autocomplete: 'new-password' });
      var p2 = h('input', { type: 'password', autocomplete: 'new-password' });
      var setup = async function () {
        err.textContent = '';
        var t = tk.value.trim();
        if (!t) { err.textContent = '토큰을 붙여넣어주세요.'; return; }
        if (p1.value.length < 8) { err.textContent = '비밀번호는 8자 이상으로 정해주세요.'; return; }
        if (p1.value !== p2.value) { err.textContent = '비밀번호가 서로 달라요.'; return; }
        var ok = await enter(t, err, true);
        if (ok) { try { localStorage.setItem(VAULT, JSON.stringify(await seal(t, p1.value))); } catch (e) { toast('이 브라우저에는 저장할 수 없어요. 이번에만 사용해요.'); } }
      };
      box.append(
        h('p', null, '처음 한 번만 설정해요. GitHub 토큰을 붙여넣고, 이 기기에서 쓸 비밀번호를 정해주세요.'),
        h('div', { class: 'steps' }, h('b', null, '토큰 만드는 법'),
          h('ol', null,
            h('li', null, h('a', { class: 'link', href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' }, 'GitHub 토큰 만들기 화면'), '을 열어요.'),
            h('li', null, 'Token name: 아무 이름 (예: site-admin)'),
            h('li', null, 'Expiration: 원하는 기간을 골라요. (만료되면 새로 만들어 다시 붙여넣어요.)'),
            h('li', null, 'Repository access → "Only select repositories" → ' + cfg.repo),
            h('li', null, 'Permissions → Repository permissions → Contents: "Read and write"'),
            h('li', null, 'Generate token을 누르고, 나온 토큰(github_pat_로 시작)을 아래에 붙여넣어요.'))),
        field('GitHub 토큰', tk, '이 기기의 브라우저에만, 비밀번호로 암호화해서 저장돼요.'),
        field('비밀번호 정하기 (8자 이상)', p1), field('비밀번호 한 번 더', p2), err,
        h('button', { class: 'btn primary', onclick: setup }, '저장하고 열기'));
    }

    var adv = h('details', null, h('summary', null, '고급 설정'),
      h('div', { style: 'margin-top:10px' },
        field('소유자', textInput(cfg, 'owner')), field('저장소', textInput(cfg, 'repo')), field('브랜치', textInput(cfg, 'branch')),
        h('button', { class: 'btn small', onclick: function () {
          try { localStorage.setItem(CFGKEY, JSON.stringify({ owner: cfg.owner, repo: cfg.repo, branch: cfg.branch })); toast('저장했어요.'); } catch (e) {}
        } }, '설정 저장')));
    box.append(adv);
    app.append(box);
  }

  async function enter(t, errEl, quiet) {
    token = t;
    errEl.textContent = '확인하는 중…';
    try {
      var repo = await gh(repoPath());
      if (repo.permissions && repo.permissions.push === false) throw Object.assign(new Error('push 권한이 없어요'), { status: 403 });
      S.phase = 'loading';
      await loadContent();
      S.phase = 'main'; S.view = 'works';
      renderMain();
      return true;
    } catch (e) {
      token = null; S.phase = 'lock';
      errEl.textContent = explain(e);
      return false;
    }
  }

  function api() {
    return { h: h, S: S, touch: touch, renderPanel: renderPanel, toast: toast, field: field, textInput: textInput,
      areaInput: areaInput, moveItem: moveItem, resizeToJpeg: resizeToJpeg, autosize: autosize };
  }

  // ---------------------------------------------------------------- start
  (async function init() {
    if (!window.crypto || !crypto.subtle) {
      $('#app').replaceChildren(h('p', { class: 'boot' }, '보안 연결(https)에서만 열 수 있어요. 사이트 주소의 /admin/ 으로 들어와주세요.'));
      return;
    }
    var base = {}, local = {};
    try { base = await (await fetch('../assets/admin/config.json', { cache: 'no-store' })).json(); } catch (e) {}
    try { local = JSON.parse(localStorage.getItem(CFGKEY) || '{}'); } catch (e) {}
    cfg = Object.assign({ api: 'https://api.github.com', owner: '', repo: '', branch: 'main' }, base, local);
    S.phase = 'lock';
    renderLock();
  })();
})();
