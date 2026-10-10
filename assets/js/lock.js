/* Opens a password-protected page. The text was encrypted in the admin (AES-GCM, key from the password via PBKDF2);
   the page itself only holds the encrypted data, so nobody can read it without the password. */
(function () {
  var box = document.querySelector('[data-lock]');
  if (!box || !window.crypto || !crypto.subtle) {
    if (box) box.querySelector('.lockerr').textContent = 'Please open this page over https. / https 주소로 열어주세요.';
    return;
  }
  var data;
  try { data = JSON.parse(box.querySelector('.lock-data').textContent); } catch (e) { return; }
  var form = box.querySelector('form'), err = box.querySelector('.lockerr'), out = box.querySelector('.lock-out');
  if (data.hint) box.querySelector('.lockhint').textContent = data.hint;

  function unb64(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
  async function decrypt(pw) {
    var base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
    var key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: unb64(data.salt), iterations: 250000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(data.iv) }, key, unb64(data.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  // same mini-format as the generator: blank line = paragraph, "## " = heading, [text](https://…) = link
  var SAFE = /^(https?:\/\/|mailto:|\/|\.\/|\.\.\/|#)/;
  function inline(parent, text) {
    var re = /\[([^\]]+)\]\(([^)\s]+)\)/g, pos = 0, m;
    function plain(t) {
      t.split('\n').forEach(function (line, i) {
        if (i) parent.appendChild(document.createElement('br'));
        if (line) parent.appendChild(document.createTextNode(line));
      });
    }
    while ((m = re.exec(text))) {
      plain(text.slice(pos, m.index));
      if (SAFE.test(m[2])) {
        var a = document.createElement('a'); a.className = 'u'; a.href = m[2]; a.textContent = m[1];
        if (/^https?:/.test(m[2])) { a.target = '_blank'; a.rel = 'noopener'; }
        parent.appendChild(a);
      } else plain(m[0]);
      pos = re.lastIndex;
    }
    plain(text.slice(pos));
  }
  function render(lang, text) {
    var wrap = document.createElement('div'); wrap.setAttribute('data-l', lang); wrap.lang = lang;
    String(text || '').trim().split(/\n\s*\n/).forEach(function (b) {
      b = b.trim(); if (!b) return;
      var head = b.indexOf('## ') === 0 && b.indexOf('\n') < 0;
      var el = document.createElement(head ? 'h3' : 'p');
      inline(el, head ? b.slice(3).trim() : b);
      wrap.appendChild(el);
    });
    return wrap;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    err.textContent = '';
    var pw = form.pw.value;
    if (!pw) return;
    var btn = form.querySelector('button'); btn.disabled = true;
    try {
      var body = await decrypt(pw);
      out.appendChild(render('en', body.en));
      out.appendChild(render('ko', body.ko || body.en));
      Array.prototype.forEach.call(box.children, function (c) { if (c !== out) c.hidden = true; });
      box.querySelector('script').hidden = true;
    } catch (x) {
      err.textContent = 'Wrong password. / 비밀번호가 맞지 않아요.';
      btn.disabled = false;
    }
  });
})();
