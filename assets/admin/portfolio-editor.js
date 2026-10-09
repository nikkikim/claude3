/* Portfolio PDF editor for the admin page.
   Edits content/portfolio.json. The live preview uses the SAME layout code as the PDF (portfolio/render.js). */
(function () {
  'use strict';

  var LAYOUTS = [
    ['pages', '두 쪽을 따로 구성 (왼쪽 쪽 / 오른쪽 쪽)'],
    ['full', '한 장을 두 쪽 가득 채우기'],
    ['fit', '한 장을 두 쪽에 크게 (가운데)'],
    ['cover', '표지'],
    ['end', '마지막 쪽']
  ];
  var LAYOUT_NAME = { pages: '두 쪽', full: '한 장 가득', fit: '한 장 크게', cover: '표지', end: '마지막 쪽' };
  var MODES = [
    ['frame', '한 장 (책 가장자리에 붙여서)'],
    ['stack', '위아래로 쌓기'],
    ['row', '가로로 나란히'],
    ['grid', '2열 격자'],
    ['split', '반반 채우기 (쪽 전체)'],
    ['bleed', '한 장 쪽 전체 채우기']
  ];
  var ALIGNS = [['in', '책 안쪽(가운데 접힌 곳)에 붙이기'], ['out', '바깥쪽에 붙이기'], ['mid', '가운데']];

  function view(api) {
    var h = api.h, S = api.S, data = S.content.portfolio;
    if (!data.spreads) data.spreads = [];
    if (!data.pool) data.pool = [];
    var sel = S.pfSel;
    return sel != null && data.spreads[sel] ? editView(api, data, sel) : listView(api, data);
  }

  function src(api, name) {
    var p = api.S.pfPending[name];
    return p ? p.url : '../portfolio/img/' + name;
  }

  function firstImage(sp) {
    if (sp.image) return sp.image;
    var pg = [sp.L, sp.R];
    for (var i = 0; i < 2; i++) if (pg[i] && pg[i].kind === 'images' && pg[i].images && pg[i].images[0]) return pg[i].images[0];
    return null;
  }

  function label(sp) {
    var cap = (sp.caption || []).filter(Boolean)[0];
    if (cap) return cap;
    if (sp.layout === 'cover') return sp.title_ko + ' ' + sp.title_en;
    if (sp.layout === 'end') return (sp.lines || []).join(' · ');
    var t = [sp.L, sp.R].filter(function (p) { return p && p.kind === 'text'; })[0];
    if (t) return String(t.text || '').replace(/^#\s*/, '').split('\n')[0];
    return '';
  }

  // ---------------------------------------------------------------- list
  var TEMPLATES = [
    ['images', '이미지 두 쪽 (양쪽에 이미지 한 장씩)'],
    ['full', '한 장을 두 쪽 가득 채우기'],
    ['fit', '한 장을 두 쪽에 크게'],
    ['dark', '검은 배경 이미지 두 쪽'],
    ['text', '글 쪽 (양쪽 모두 글)']
  ];

  function newSpread(kind) {
    var base = { bg: 'w', layout: 'pages', L: { kind: 'empty' }, R: { kind: 'empty' }, caption: [], cap_at: 'L', cap_chip: false };
    if (kind === 'full') return { bg: 'w', layout: 'full', image: '', pos: [50, 50], caption: [], cap_at: 'S', cap_chip: true };
    if (kind === 'fit') return { bg: 'w', layout: 'fit', image: '', h: 700, caption: [], cap_at: 'S', cap_chip: false };
    if (kind === 'text') { base.L = { kind: 'text', style: 'body', text: '# 제목\n\n본문을 입력하세요.' }; base.R = { kind: 'text', style: 'body', text: '' }; return base; }
    var img = function () { return { kind: 'images', mode: 'frame', images: [], align: 'in', valign: 'top', scale: 1, pos: [50, 50] }; };
    base.L = img(); base.R = img();
    if (kind === 'dark') base.bg = 'k';
    base.cap_at = 'R';
    return base;
  }

  function listView(api, data) {
    var h = api.h, S = api.S;
    var list = data.spreads;
    var rows = list.map(function (sp, i) {
      var im = firstImage(sp);
      return h('div', { class: 'wrow' },
        h('span', { class: 'num' }, String(i + 1).padStart(2, '0')),
        im ? h('img', { src: src(api, im), alt: '', loading: 'lazy', style: sp.bg === 'k' ? 'background:#000' : '' }) : h('span'),
        h('div', { class: 't', onclick: function () { S.pfSel = i; api.renderPanel(); window.scrollTo(0, 0); } },
          h('b', null, LAYOUT_NAME[sp.layout || 'pages'] + (sp.bg === 'k' ? ' · 검은 배경' : '')),
          h('span', null, label(sp))),
        h('div', { class: 'ctl' },
          h('button', { class: 'btn small', 'aria-label': '위로', onclick: function () { if (api.moveItem(list, i, -1)) { api.renderPanel(); api.touch(); } } }, '↑'),
          h('button', { class: 'btn small', 'aria-label': '아래로', onclick: function () { if (api.moveItem(list, i, 1)) { api.renderPanel(); api.touch(); } } }, '↓'),
          h('button', { class: 'btn small', onclick: function () { S.pfSel = i; api.renderPanel(); window.scrollTo(0, 0); } }, '편집')));
    });
    var tpl = h('select', null, TEMPLATES.map(function (t) { return h('option', { value: t[0] }, t[1]); }));
    return h('div', null,
      h('h2', null, '포트폴리오 PDF'),
      h('p', { class: 'lead' }, '사이트의 "Portfolio PDF" 링크로 열리는 포트폴리오예요. 한 줄이 PDF의 한 장(펼침면 = 두 쪽)이에요. 게시하면 GitHub가 PDF를 새로 만들어요(2~3분).'),
      h('div', { class: 'row2', style: 'margin-bottom:6px' },
        api.field('제목 줄 (왼쪽 위)', api.textInput(data, 'running')),
        api.field('연도 (표지, 쪽 번호 옆)', api.textInput(data, 'year'))),
      h('div', { class: 'toolbar' }, h('span', { class: 'm mute' }, list.length + '장'),
        h('span', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, tpl,
          h('button', { class: 'btn', onclick: function () {
            var at = list.length && list[list.length - 1].layout === 'end' ? list.length - 1 : list.length;
            list.splice(at, 0, newSpread(tpl.value)); S.pfSel = at; api.renderPanel(); api.touch(); window.scrollTo(0, 0);
          } }, '＋ 새 장 추가'))),
      h('div', { class: 'wlist' }, rows));
  }

  // ---------------------------------------------------------------- preview
  function preview(api, data, idx) {
    var h = api.h;
    var wrap = h('div', { class: 'pf-prev' }), inner = h('div', { class: 'pf-prev-in' });
    wrap.appendChild(inner);
    var tick = 0, timer = 0;
    function fit() {
      var w = wrap.clientWidth || 720, s = w / 1440;
      wrap.style.height = (810 * s) + 'px';
      inner.style.transform = 'scale(' + s + ')';
    }
    function render() {
      var my = ++tick;
      var sp = data.spreads[idx];
      window.Portfolio.build(sp, idx, data.spreads.length, data, function (n) { return src(api, n); }).then(function (el) {
        if (my !== tick) return;
        inner.replaceChildren(el); fit();
      });
    }
    function later() { clearTimeout(timer); timer = setTimeout(render, 120); }
    window.addEventListener('resize', function onr() { if (!wrap.isConnected) { window.removeEventListener('resize', onr); return; } fit(); });
    requestAnimationFrame(function () { fit(); render(); });
    return { el: wrap, update: later };
  }

  // ---------------------------------------------------------------- image picker
  function picker(api, data, done, multiple) {
    var h = api.h;
    var chosen = [];
    var overlay = h('div', { class: 'pf-modal', role: 'dialog', 'aria-label': '이미지 고르기' });
    var grid = h('div', { class: 'pf-pool' });
    var count = h('span', { class: 'm mute' }, '');
    function close() { overlay.remove(); }
    function paint() {
      grid.replaceChildren();
      data.pool.slice().reverse().forEach(function (name) {
        var on = chosen.indexOf(name) >= 0;
        grid.appendChild(h('button', { class: 'pf-thumb' + (on ? ' on' : ''), title: name, onclick: function () {
          if (!multiple) { done([name]); close(); return; }
          var i = chosen.indexOf(name); if (i >= 0) chosen.splice(i, 1); else chosen.push(name);
          count.textContent = chosen.length + '장 선택'; paint();
        } }, h('img', { src: src(api, name), loading: 'lazy', alt: '' }), on ? h('span', { class: 'ck' }, String(chosen.indexOf(name) + 1)) : null));
      });
    }
    var file = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: async function (e) {
      var list = Array.prototype.slice.call(e.target.files); e.target.value = '';
      var n = 0;
      for (var i = 0; i < list.length; i++) {
        try {
          var r = await api.resizeToJpeg(list[i], 2200, 0.85);
          var name = 'u' + Date.now().toString(36) + i + '.jpg';
          api.S.pfPending[name] = { blob: r.blob, url: URL.createObjectURL(r.blob), saved: false };
          data.pool.push(name);
          if (multiple) chosen.push(name); else { done([name]); close(); api.touch(); return; }
          n++;
        } catch (err) { api.toast('"' + list[i].name + '" 은(는) 읽을 수 없는 형식이에요.'); }
      }
      if (n) { api.toast(n + '장을 올렸어요. 게시하기를 눌러야 반영돼요.'); count.textContent = chosen.length + '장 선택'; paint(); api.touch(); }
    } });
    overlay.appendChild(h('div', { class: 'pf-box' },
      h('div', { class: 'toolbar' },
        h('b', null, multiple ? '이미지 고르기 (여러 장 선택)' : '이미지 고르기'),
        h('span', { style: 'display:flex;gap:8px;align-items:center' }, count,
          h('button', { class: 'btn small', onclick: function () { file.click(); } }, '＋ 새 이미지 올리기'),
          multiple ? h('button', { class: 'btn small primary', onclick: function () { done(chosen.slice()); close(); } }, '선택 완료') : null,
          h('button', { class: 'btn small', onclick: close }, '닫기'))),
      grid, file));
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    paint();
  }

  // ---------------------------------------------------------------- edit
  function sel(api, items, value, onchange) {
    var s = api.h('select', { onchange: function (e) { onchange(e.target.value); } },
      items.map(function (it) { return api.h('option', { value: it[0], selected: String(it[0]) === String(value) }, it[1]); }));
    return s;
  }

  function range(api, label, min, max, step, get, set, fmt) {
    var h = api.h, out = h('span', { class: 'm' }, fmt(get()));
    var inp = h('input', { type: 'range', min: min, max: max, step: step, value: get(), oninput: function (e) { var v = parseFloat(e.target.value); set(v); out.textContent = fmt(v); } });
    return h('label', { class: 'f' }, h('span', { class: 'm' }, label, ' ', out), inp);
  }

  function imageList(api, data, arr, onchange, multiple) {
    var h = api.h;
    var grid = h('div', { class: 'igrid' }, arr.map(function (name, k) {
      return h('div', { class: 'icard' },
        h('div', { class: 'im' }, h('img', { src: src(api, name), alt: '' }), h('span', { class: 'badge' }, String(k + 1))),
        h('div', { class: 'ctl' },
          h('button', { class: 'btn small', 'aria-label': '앞으로', onclick: function () { if (api.moveItem(arr, k, -1)) onchange(); } }, '◀'),
          h('button', { class: 'btn small', 'aria-label': '뒤로', onclick: function () { if (api.moveItem(arr, k, 1)) onchange(); } }, '▶'),
          h('button', { class: 'btn small danger', onclick: function () { arr.splice(k, 1); onchange(); } }, '빼기')));
    }));
    var add = h('button', { class: 'btn small', onclick: function () {
      picker(api, data, function (names) {
        if (multiple) names.forEach(function (n) { arr.push(n); }); else { arr.length = 0; arr.push(names[0]); }
        onchange();
      }, multiple);
    } }, multiple ? '＋ 이미지 추가' : (arr.length ? '이미지 바꾸기' : '＋ 이미지 고르기'));
    return h('div', null, arr.length ? grid : null, add);
  }

  function pageEditor(api, data, sp, side, redraw, rerender) {
    var h = api.h;
    var pg = sp[side];
    if (!pg) pg = sp[side] = { kind: 'empty' };
    var box = h('div', { class: 'card' });
    box.appendChild(h('div', { class: 'm', style: 'margin-bottom:8px' }, side === 'L' ? '왼쪽 쪽' : '오른쪽 쪽'));
    box.appendChild(api.field('이 쪽의 내용', sel(api, [['empty', '비워두기'], ['text', '글'], ['images', '이미지']], pg.kind || 'empty', function (v) {
      if (v === 'text') sp[side] = { kind: 'text', style: 'body', text: '' };
      else if (v === 'images') sp[side] = { kind: 'images', mode: 'frame', images: [], align: 'in', valign: 'top', scale: 1, pos: [50, 50] };
      else sp[side] = { kind: 'empty' };
      rerender(); api.touch();
    })));
    if (pg.kind === 'text') {
      box.appendChild(api.field('글 모양', sel(api, [['body', '본문 (문단)'], ['cv', '이력 표 (연도 + 내용)']], pg.style || 'body', function (v) { pg.style = v; redraw(); api.touch(); rerender(); })));
      box.appendChild(api.field('글', api.areaInput(function () { return pg.text || ''; }, function (v) { pg.text = v; redraw(); }, 10),
        pg.style === 'cv' ? '"# 제목" = 소제목, "2026 내용" = 연도 + 내용, 연도 없는 줄은 앞 연도 아래에 이어져요.'
          : '"# 제목" = 굵은 작은 제목, "~ 내용" = 작은 글씨 한 줄, 빈 줄 = 문단 나누기.'));
    } else if (pg.kind === 'images') {
      box.appendChild(api.field('배치', sel(api, MODES, pg.mode || 'frame', function (v) { pg.mode = v; rerender(); redraw(); api.touch(); })));
      box.appendChild(imageList(api, data, pg.images = pg.images || [], function () { rerender(); redraw(); api.touch(); }, ['stack', 'row', 'grid', 'split'].indexOf(pg.mode || 'frame') >= 0));
      if (['frame', 'stack', 'row', 'grid'].indexOf(pg.mode || 'frame') >= 0) {
        box.appendChild(h('div', { class: 'row2', style: 'margin-top:10px' },
          api.field('가로 위치', sel(api, ALIGNS, pg.align || 'in', function (v) { pg.align = v; redraw(); api.touch(); })),
          api.field('세로 위치', sel(api, [['top', '위쪽'], ['mid', '가운데']], pg.valign || 'top', function (v) { pg.valign = v; redraw(); api.touch(); }))));
        box.appendChild(range(api, '크기', 0.4, 1.3, 0.05, function () { return pg.scale == null ? 1 : pg.scale; }, function (v) { pg.scale = v; redraw(); api.touch(); }, function (v) { return Math.round(v * 100) + '%'; }));
      } else {
        if (!pg.pos) pg.pos = [50, 50];
        box.appendChild(range(api, '보이는 부분 (가로)', 0, 100, 1, function () { return pg.pos[0]; }, function (v) { pg.pos[0] = v; redraw(); api.touch(); }, function (v) { return v + '%'; }));
        box.appendChild(range(api, '보이는 부분 (세로)', 0, 100, 1, function () { return pg.pos[1]; }, function (v) { pg.pos[1] = v; redraw(); api.touch(); }, function (v) { return v + '%'; }));
      }
    }
    return box;
  }

  function editView(api, data, idx) {
    var h = api.h, S = api.S, sp = data.spreads[idx];
    var pv = preview(api, data, idx);
    var form = h('div');
    function redraw() { pv.update(); }
    function rerender() { build(); }
    function oneImage(label) {
      var arr = sp.image ? [sp.image] : [];
      return h('div', null, h('p', { class: 'm mute' }, label),
        imageList(api, data, arr, function () { sp.image = arr[0] || ''; build(); redraw(); api.touch(); }, false));
    }
    function build() {
      form.replaceChildren();
      var layout = sp.layout || 'pages';
      form.appendChild(h('div', { class: 'row2' },
        api.field('배경', sel(api, [['w', '흰색'], ['k', '검정']], sp.bg || 'w', function (v) { sp.bg = v; redraw(); api.touch(); })),
        api.field('구성', sel(api, LAYOUTS, layout, function (v) {
          sp.layout = v;
          if (v === 'full' && !sp.pos) sp.pos = [50, 50];
          if (v === 'fit' && !sp.h) sp.h = 700;
          if (v === 'cover') { sp.title_ko = sp.title_ko || ''; sp.title_en = sp.title_en || ''; sp.sub = sp.sub || ''; sp.bg = 'k'; }
          if (v === 'end') { sp.lines = sp.lines || []; sp.copy = sp.copy || ''; }
          build(); redraw(); api.touch();
        }))));
      if (layout === 'pages') {
        form.appendChild(pageEditor(api, data, sp, 'L', redraw, rerender));
        form.appendChild(pageEditor(api, data, sp, 'R', redraw, rerender));
      } else if (layout === 'full') {
        form.appendChild(oneImage('이미지'));
        if (!sp.pos) sp.pos = [50, 50];
        form.appendChild(range(api, '보이는 부분 (가로)', 0, 100, 1, function () { return sp.pos[0]; }, function (v) { sp.pos[0] = v; redraw(); api.touch(); }, function (v) { return v + '%'; }));
        form.appendChild(range(api, '보이는 부분 (세로)', 0, 100, 1, function () { return sp.pos[1]; }, function (v) { sp.pos[1] = v; redraw(); api.touch(); }, function (v) { return v + '%'; }));
      } else if (layout === 'fit') {
        form.appendChild(oneImage('이미지'));
        form.appendChild(range(api, '최대 높이', 300, 740, 10, function () { return sp.h || 700; }, function (v) { sp.h = v; redraw(); api.touch(); }, function (v) { return v + 'px'; }));
      } else if (layout === 'cover') {
        form.appendChild(h('div', { class: 'row2' }, api.field('큰 제목', api.textInput(sp, 'title_ko', { after: redraw })), api.field('작은 제목', api.textInput(sp, 'title_en', { after: redraw }))));
        form.appendChild(api.field('아래 줄 (예: Portfolio 2026)', api.textInput(sp, 'sub', { after: redraw })));
        form.appendChild(oneImage('표지 이미지 (오른쪽 쪽)'));
      } else if (layout === 'end') {
        form.appendChild(api.field('연락처 줄 (한 줄에 하나, 첫 줄은 굵게)', api.areaInput(function () { return (sp.lines || []).join('\n'); }, function (v) { sp.lines = v.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); redraw(); }, 4)));
        form.appendChild(api.field('맨 아래 문구', api.textInput(sp, 'copy', { after: redraw })));
        form.appendChild(oneImage('이미지 (왼쪽 쪽)'));
      }
      if (layout !== 'cover' && layout !== 'end') {
        form.appendChild(h('div', { class: 'card' },
          h('div', { class: 'm', style: 'margin-bottom:8px' }, '캡션 (작품 설명)'),
          api.field('캡션 (한 줄에 하나)', api.areaInput(function () { return (sp.caption || []).join('\n'); }, function (v) { sp.caption = v.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); redraw(); }, 3)),
          layout === 'pages' ? api.field('캡션 위치', sel(api, [['L', '왼쪽 쪽 아래'], ['R', '오른쪽 쪽 아래'], ['S', '두 쪽 전체의 왼쪽 아래']], sp.cap_at || 'L', function (v) { sp.cap_at = v; redraw(); api.touch(); })) : null,
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!sp.cap_chip, onchange: function (e) { sp.cap_chip = e.target.checked; redraw(); api.touch(); } }), '캡션에 흰 바탕 깔기 (사진 위에서 잘 읽히게)')));
      }
    }
    build();
    return h('div', null,
      h('div', { class: 'toolbar' },
        h('button', { class: 'btn small', onclick: function () { S.pfSel = null; api.renderPanel(); } }, '← 목록'),
        h('span', { class: 'm mute' }, (idx + 1) + ' / ' + data.spreads.length)),
      h('h2', null, (idx + 1) + '번째 장'),
      pv.el,
      h('p', { class: 'hint', style: 'margin:6px 0 16px' }, '위 미리보기가 PDF에 들어가는 모습이에요. 게시하면 같은 모습으로 PDF가 만들어져요.'),
      form,
      h('div', { style: 'margin-top:28px;padding-top:16px;border-top:1px solid var(--line)' },
        h('button', { class: 'btn danger', onclick: function () {
          if (!confirm('이 장을 삭제할까요? 게시하기를 누르기 전까지는 "변경 버리기"로 되돌릴 수 있어요.')) return;
          data.spreads.splice(idx, 1); S.pfSel = null; api.renderPanel(); api.touch();
        } }, '이 장 삭제')));
  }

  window.AdminPortfolio = { view: view };
})();
