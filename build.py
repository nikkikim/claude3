#!/usr/bin/env python3
"""Static site generator for dasulkim.com.

Reads content/*.json and writes the HTML pages. No dependencies beyond Python 3.
Run:  python3 build.py
Preview:  python3 -m http.server 8000   (then open http://localhost:8000)
"""
import html
import json
import os
import hashlib
import re
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
NAME_EN, NAME_KO = "Dasul Kim", "김다슬"

esc = html.escape


def load(name):
    with open(os.path.join(ROOT, "content", name), encoding="utf-8") as f:
        return json.load(f)


WORKS = load("works.json")
BIO = load("bio.json")
STATEMENT = load("statement.json")
CV = load("cv.json")
TEXTS = load("texts.json")
SITE_INFO = load("site.json")
# the address link previews (og:image, canonical) point to; set it in the admin if the site lives somewhere else
SITE = (SITE_INFO.get("site_url") or "https://www.dasulkim.com").strip().rstrip("/")
EMAIL = SITE_INFO["email"]
INSTAGRAM = SITE_INFO["instagram"]
PORTFOLIO = SITE_INFO["portfolio"]


def portfolio_link(rel, br=True):
    """the "Portfolio PDF" link (opens in a new window); nothing at all while the address is empty"""
    if not PORTFOLIO.strip():
        return ""
    a = (f'<a class="u" href="{html.escape(portfolio_href(rel), quote=True)}" target="_blank" rel="noopener">'
         f'{L("Portfolio PDF ↗", "포트폴리오 PDF ↗")}</a>')
    return ("<br>" + a) if br else a


def portfolio_href(rel):
    """a path like assets/portfolio/x.pdf is relative to the site root; a full https:// link is used as it is"""
    return PORTFOLIO if re.match(r"^(https?:)?//|^mailto:", PORTFOLIO) else rel + PORTFOLIO.lstrip("/")
DESC_EN = SITE_INFO["desc_en"]
DESC_KO = SITE_INFO["desc_ko"]

# ---- search & analytics settings (admin: 검색·홍보 / 방문 통계)
META_DESC = (SITE_INFO.get("seo_desc_en") or "").strip() or DESC_EN          # text under the title in search results
SEO_TITLE_EN = (SITE_INFO.get("seo_title_en") or "").strip() or "Dasul Kim — Media artist"
SEO_TITLE_KO = (SITE_INFO.get("seo_title_ko") or "").strip() or "김다슬 — 미디어 아티스트"


def word_list(v):
    return [w.strip() for w in re.split(r"[,\n]", v or "") if w.strip()]


KEYWORDS = word_list(SITE_INFO.get("keywords_en")) + word_list(SITE_INFO.get("keywords_ko"))
SAME_AS = [u for u in word_list(SITE_INFO.get("same_as")) if re.match(r"^https?://", u)]
if INSTAGRAM and INSTAGRAM not in SAME_AS:
    SAME_AS.insert(0, INSTAGRAM)


def token(v):
    return re.sub(r"[^A-Za-z0-9_.\-]", "", (v or "").strip())


def seo_head(home):
    out = []
    if KEYWORDS:
        out.append(f'<meta name="keywords" content="{esc(", ".join(KEYWORDS), quote=True)}">')
    out.append(f'<meta name="author" content="{NAME_EN} / {NAME_KO}">')
    for key, name in (("google_verify", "google-site-verification"), ("naver_verify", "naver-site-verification"),
                      ("bing_verify", "msvalidate.01")):
        t = token(SITE_INFO.get(key))
        if t:
            out.append(f'<meta name="{name}" content="{t}">')
    if home:
        person = {"@type": "Person", "@id": SITE + "/#artist", "name": NAME_EN, "alternateName": [NAME_KO], "url": SITE + "/",
                  "jobTitle": "Media artist",
                  "description": [{"@language": "en", "@value": DESC_EN}, {"@language": "ko", "@value": DESC_KO}]}
        if SAME_AS:
            person["sameAs"] = SAME_AS
        if KEYWORDS:
            person["knowsAbout"] = KEYWORDS
        site = {"@type": "WebSite", "@id": SITE + "/#website", "url": SITE + "/", "name": f"{NAME_EN} ({NAME_KO})",
                "inLanguage": ["en", "ko"], "about": {"@id": SITE + "/#artist"}}
        data = json.dumps({"@context": "https://schema.org", "@graph": [person, site]}, ensure_ascii=False).replace("<", "\\u003c")
        out.append(f'<script type="application/ld+json">{data}</script>')
    return "\n".join(out) + "\n"


def analytics_tag():
    code = re.sub(r"[^a-z0-9-]", "", (SITE_INFO.get("goatcounter") or "").strip().lower())
    if not code:
        return ""
    return (f'<script data-goatcounter="https://{code}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>\n')

# ---------------------------------------------------------------- helpers


def L(en, ko=None, tag="span", cls=""):
    """Two language versions; CSS shows the one matching <html lang>."""
    ko = en if ko is None else ko
    c = f' class="{cls}"' if cls else ""
    return (f'<{tag}{c} data-l="en" lang="en">{en}</{tag}><{tag}{c} data-l="ko" lang="ko">{ko}</{tag}>')


def wtitle(w, lang):
    return w["title_en"] if lang == "en" else (w.get("title_ko") or w["title_en"])


def cover_dims(w):
    if not w["images"]:
        return 900, 600
    im = w["images"][0]
    s = min(900 / im["w"], 900 / im["h"], 1)
    return round(im["w"] * s), round(im["h"] * s)


def write(path, content):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)


# ---------------------------------------------------------------- menu & pages (content/pages.json)
# Built-in pages keep their layout; custom pages are plain text pages made in the admin.
# status: "menu" = listed in the menu, "hidden" = published but not in the menu (noindex, link only),
#         "draft" = not published (custom pages only).
BUILTIN = {
    "bio": ("bio/", "Bio", "소개"),
    "statement": ("statement/", "Artist Statement", "작가노트"),
    "works": ("#works", "Works", "작업"),
    "cv": ("cv/", "CV", "이력"),
    "texts": ("texts/", "Texts", "글"),
    "contact": ("contact/", "Contact", "연락"),
}
RESERVED = set(BUILTIN) | {"admin", "assets", "content", "index", "404", "sitemap", "robots", "favicon", "cname", "node_modules"}
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,59}$")


def load_pages():
    try:
        raw = load("pages.json")
    except FileNotFoundError:
        raw = []
    out, seen, slugs = [], set(), set()
    for p in raw:
        pid = p.get("id")
        if not pid or pid in seen:
            continue
        if p.get("type") == "builtin":
            if pid not in BUILTIN:
                continue
            _, en, ko = BUILTIN[pid]
            out.append({"id": pid, "type": "builtin", "title_en": (p.get("title_en") or en).strip(),
                        "title_ko": (p.get("title_ko") or ko).strip(),
                        "status": "hidden" if p.get("status") == "hidden" else "menu"})
        else:
            slug = p.get("slug", "")
            if not SLUG_RE.match(slug) or slug in RESERVED or slug in slugs:
                print(f"skipped page {pid!r}: bad or duplicate address {slug!r}")
                continue
            slugs.add(slug)
            q = dict(p)
            q.update({"type": "custom", "status": p.get("status") if p.get("status") in ("menu", "hidden", "draft") else "draft",
                      "title_en": (p.get("title_en") or slug).strip()})
            q["title_ko"] = (p.get("title_ko") or "").strip() or q["title_en"]
            out.append(q)
        seen.add(pid)
    for pid, (_, en, ko) in BUILTIN.items():      # a built-in page can never go missing
        if pid not in seen:
            out.append({"id": pid, "type": "builtin", "title_en": en, "title_ko": ko, "status": "menu"})
    return out


PAGES = load_pages()
PAGE = {p["id"]: p for p in PAGES}


def T(pid):
    """(English, Korean) title of a built-in page, as set in the admin; already HTML-escaped"""
    return esc(PAGE[pid]["title_en"]), esc(PAGE[pid]["title_ko"])


def menu_items():
    for p in PAGES:
        if p["status"] != "menu":
            continue
        href = BUILTIN[p["id"]][0] if p["type"] == "builtin" else p["slug"] + "/"
        yield p["id"], href, p["title_en"], p["title_ko"]


def file_hash(rel):
    full = os.path.join(ROOT, rel)
    if not os.path.isfile(full):
        return None
    with open(full, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()[:8]


def asset_url(rel, absolute=False):
    """URL of a site file with a version tag (so a replaced favicon/preview image is not served from a stale cache)"""
    v = file_hash(rel)
    if not v:
        return None
    return (SITE + "/" if absolute else "") + f"{rel}?v={v}"


# a text page body: blank line = new paragraph, "## " = heading, [text](https://…) = link
LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")
SAFE_URL = re.compile(r"^(https?://|mailto:|/|\./|\.\./|#)")


def md_inline(t):
    out, pos = [], 0
    for m in LINK_RE.finditer(t):
        out.append(esc(t[pos:m.start()]))
        url = m.group(2)
        if SAFE_URL.match(url):
            ext = ' target="_blank" rel="noopener"' if re.match(r"^https?://", url) else ""
            out.append(f'<a class="u" href="{esc(url, quote=True)}"{ext}>{esc(m.group(1))}</a>')
        else:
            out.append(esc(m.group(0)))
        pos = m.end()
    out.append(esc(t[pos:]))
    return "".join(out).replace("\n", "<br>")


def md(text):
    blocks = []
    for b in re.split(r"\n\s*\n", (text or "").strip()):
        b = b.strip()
        if not b:
            continue
        blocks.append(f"<h3>{md_inline(b[3:].strip())}</h3>" if b.startswith("## ") and "\n" not in b else f"<p>{md_inline(b)}</p>")
    return "".join(blocks)


YEAR_RE = re.compile(
    r"^((?:19|20)\d{2}(?:\.\d{1,2}){0,2}\.?(?:\s*[-–]\s*(?:(?:19|20)\d{2}(?:\.\d{1,2}){0,2}|Current|현재|Present))?"
    r"|Present|현\s*재)\s*\|?\s+(.*)$"
)


MONTH_RANGE_RE = re.compile(r"^((?:19|20)\d{2})\.\d{1,2}\s*-\s*(?:((?:19|20)\d{2})\.\d{1,2}|(현재))$")


def year_only(date):
    """'2021.10-2024.06' -> '2021-2024', '2024.03-2024.06' -> '2024', '2024.09-현재' -> '2024-현재'."""
    m = MONTH_RANGE_RE.match(date)
    if not m:
        return date
    start, end, current = m.groups()
    if current:
        return f"{start}-{current}"
    return start if start == end else f"{start}-{end}"


def cv_rows(items):
    out = []
    for line in items:
        m = YEAR_RE.match(line)
        y, rest = (year_only(m.group(1)), m.group(2)) if m else ("", line)
        cls = "cv-row range" if len(y) > 12 else "cv-row"
        out.append(f'<div class="{cls}"><span class="y">{esc(y)}</span><span>{esc(rest)}</span></div>')
    return "".join(out)


def cv_sections(lang, home_only=False):
    out = []
    for sec in CV[lang]:
        if home_only and not sec.get("home"):
            continue
        items = sec["items"]
        out.append(f'<section class="cv-sec"><h2 class="m mute">{esc(sec["heading"])}</h2>{cv_rows(items)}</section>')
    return "".join(out)


def bilingual_cv(**kw):
    return (f'<div data-l="en" lang="en">{cv_sections("en", **kw)}</div>'
            f'<div data-l="ko" lang="ko">{cv_sections("ko", **kw)}</div>')


def index_list(rel, current=None):
    rows = []
    for w in WORKS:
        cur = ' aria-current="page"' if w["slug"] == current else ""
        rows.append(
            f'<a href="{rel}works/{w["slug"]}/"{cur}><span>{w["n"]:02d}</span>'
            f'<span>{L(esc(wtitle(w, "en")), esc(wtitle(w, "ko")))}</span><span>{w["year"]}</span></a>')
    return '<nav class="idx" aria-label="Works index">' + "".join(rows) + "</nav>"


def icon_links(rel):
    out = []
    for fn, extra in (("favicon.ico", ' sizes="48x48"'), ("favicon-32.png", ' type="image/png" sizes="32x32"'),
                      ("favicon-192.png", ' type="image/png" sizes="192x192"')):
        u = asset_url("assets/" + fn)
        if u:
            out.append(f'<link rel="icon" href="{rel}{u}"{extra}>')
    u = asset_url("assets/apple-touch-icon.png")
    if u:
        out.append(f'<link rel="apple-touch-icon" href="{rel}{u}">')
    return "\n".join(out)


def page(*, rel, path, title_en, title_ko, desc, left_extra="", mid, right, current=None,
         og_image=None, canonical=None, noindex=False, extra_head="", scripts=()):
    menu = []
    for key, href, en, ko in menu_items():
        cur = ' aria-current="page"' if key == current else ""
        menu.append(f'<a href="{rel}{href}"{cur}>{L(esc(en), esc(ko))}</a>')
    menu_html = (
        "".join(menu) + '<span class="gap"></span>'
        f'<a href="{INSTAGRAM}" rel="noopener" target="_blank">Instagram ↗</a>'
        f'<a href="mailto:{EMAIL}">{esc(EMAIL)} ↗</a>'
    )
    # a work page shows its own cover; every other page shows the preview image uploaded in the admin (if any)
    site_og = asset_url("assets/og.jpg", absolute=True)
    if og_image:
        og = f'<meta property="og:image" content="{SITE}/{og_image}">\n<meta name="twitter:image" content="{SITE}/{og_image}">'
    elif site_og:
        og = (f'<meta property="og:image" content="{site_og}">\n<meta property="og:image:width" content="1200">\n'
              f'<meta property="og:image:height" content="630">\n<meta name="twitter:image" content="{site_og}">')
    else:
        og = ""
    card = "summary_large_image" if (og_image or site_og) else "summary"
    og = og + "\n" if og else ""
    robots = '<meta name="robots" content="noindex">\n' if noindex else ""
    extra_head = seo_head(path == "") + (extra_head + "\n" if extra_head else "")
    script_tags = "".join(f'<script src="{rel}assets/js/{n}" defer></script>\n' for n in scripts)
    canon = canonical or (SITE + "/" + path)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script>(function(){{try{{var q=new URLSearchParams(location.search).get('lang'),s=localStorage.getItem('lang'),l=(q==='ko'||q==='en')?q:(s==='ko'||s==='en'?s:'en');document.documentElement.lang=l;}}catch(e){{}}}})();</script>
<title>{esc(title_en)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{canon}">
<meta property="og:site_name" content="{NAME_EN}">
<meta property="og:title" content="{esc(title_en)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="{canon}">
{og}<meta name="twitter:card" content="{card}">
{robots}{extra_head}<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#ffffff">
<script>(function(){{var t='light';try{{if(localStorage.getItem('theme')==='dark')t='dark';}}catch(e){{}}document.documentElement.dataset.theme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.content=t==='dark'?'#111111':'#ffffff';}})();</script>
{icon_links(rel)}
<link rel="preload" href="{rel}assets/fonts/Pretendard-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{rel}assets/css/style.css">
<link rel="stylesheet" href="{rel}assets/css/cursor.css">
<link rel="stylesheet" href="{rel}assets/css/scrollbar.css">
<link rel="stylesheet" href="{rel}assets/css/signal.css">
</head>
<body data-title-en="{esc(title_en)}" data-title-ko="{esc(title_ko)}">
<a class="skip" href="#main">Skip to content</a>
<div class="cols">
<aside class="col left">
  <div class="lab">
    <div class="brand"><a class="name m" href="{rel or './'}">{L(NAME_EN, NAME_KO)}</a>
    <button type="button" class="bento" aria-expanded="false" aria-controls="bento-panel" aria-label="Menu / 메뉴" title="Menu"><svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="2" cy="2" r="1.3"/><circle cx="7" cy="2" r="1.3"/><circle cx="12" cy="2" r="1.3"/><circle cx="2" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="12" cy="7" r="1.3"/><circle cx="2" cy="12" r="1.3"/><circle cx="7" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/></svg></button></div>
    <div class="tools">
    <div class="lang m" role="group" aria-label="Language"><button type="button" data-set-lang="en" aria-pressed="true">EN</button><span class="sep">/</span><button type="button" data-set-lang="ko" aria-pressed="false">KR</button></div>
    <button type="button" class="theme" data-theme-toggle aria-pressed="false" aria-label="Dark mode" title="Dark / Light"><svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6z"/></svg><svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7"/></svg></button>
    <button type="button" class="eye" data-eye-toggle aria-pressed="false" aria-label="Signal mode / 신호 모드" title="Signal mode: text becomes signal, drag to read"><svg class="i-eye" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg><svg class="i-eye-off" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6 5 10 5 10-5 10-5"/><path d="M5.5 15.2 4 17.5M10 17.2l-.8 2.6M14 17.2l.8 2.6M18.5 15.2l1.5 2.3"/></svg></button>
    </div>
    <nav class="bento-panel m" id="bento-panel" aria-label="Menu" hidden>{menu_html}</nav>
  </div>
  <nav class="menu m" aria-label="Main">{menu_html}</nav>
  {left_extra}
  <div class="clock m"><span data-clock>--:--:--</span> Seoul</div>
</aside>
<main class="col mid" id="main">
{mid}
</main>
{right}
</div>
<button class="to-top" type="button" aria-label="Back to top / 맨 위로"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true"><path d="M12 20V5M5.5 11.5 12 5l6.5 6.5"/></svg></button>
<script src="{rel}assets/js/site.js" defer></script>
<script src="{rel}assets/js/cursor.js" defer></script>
<script src="{rel}assets/js/scrollbar.js" defer></script>
<script src="{rel}assets/js/signal.js" defer></script>
{script_tags}{analytics_tag()}</body>
</html>
"""


def right_col(inner, label_en, label_ko, extra="", cls=""):
    return (f'<aside class="col right {cls}"><div class="lab"><span class="m">{L(esc(label_en), esc(label_ko))}</span>'
            f'<span class="m mute">{extra}</span></div>{inner}</aside>')


# ---------------------------------------------------------------- home


def build_home():
    cards = []
    for w in WORKS:
        cw, ch = cover_dims(w)
        href = f'works/{w["slug"]}/'
        t_en, t_ko = esc(wtitle(w, "en")), esc(wtitle(w, "ko"))
        meta = f'{w["year"]}' + (f', {esc(w["medium"])}' if w["medium"] else "")
        cards.append(f"""<article class="work" id="{w['slug']}">
<a class="cover" href="{href}" aria-label="{t_en}"><img src="assets/works/{w['slug']}/cover.jpg" width="{cw}" height="{ch}" alt="{esc(w['title_en'])}" loading="{'eager' if w['n'] <= 2 else 'lazy'}" decoding="async"></a>
<div class="row"><div class="t">{w['n']:02d}. <a href="{href}">{L(t_en, t_ko)}</a></div><div class="d"><i>{meta}</i></div></div>
</article>""")
    mid = (f'<div class="lab"><span class="m" id="works">{L(*T("works"))} <span class="pill">{len(WORKS)}</span></span>'
           f'<span class="m mute">{WORKS[-1]["year"]}–{WORKS[0]["year"]}</span></div>' + "".join(cards))
    intro = f"""<div class="intro">
  <div data-l="en" lang="en"><p>{esc(DESC_EN)}</p></div>
  <div data-l="ko" lang="ko"><p>{esc(DESC_KO)}</p></div>
  <p class="m"><a class="u" href="bio/">{L('Full bio', '소개 전체')}</a></p>
</div>"""
    cv_inner = (bilingual_cv(home_only=True) +
                f'<div class="cv-more m"><a class="u" href="cv/">{L("Full CV →", "이력 전체 →")}</a>{portfolio_link("")}</div>')
    right = right_col(cv_inner, PAGE["cv"]["title_en"], PAGE["cv"]["title_ko"], extra=f'<a class="u" href="cv/">{L("Full", "전체")}</a>')
    write("index.html", page(
        rel="", path="", title_en=SEO_TITLE_EN, title_ko=SEO_TITLE_KO,
        desc=META_DESC, left_extra=intro, mid=mid, right=right))


# ---------------------------------------------------------------- work pages


def build_works():
    shutil.rmtree(os.path.join(ROOT, "works"), ignore_errors=True)
    total = len(WORKS)
    for i, w in enumerate(WORKS):
        rel = "../../"
        figs = []
        n_img = len(w["images"])
        for k, im in enumerate(w["images"], 1):
            figs.append(f"""<figure class="fig"><img src="{rel}assets/works/{w['slug']}/{im['f']}" width="{im['w']}" height="{im['h']}" alt="{esc(w['title_en'])} ({k}/{n_img})" loading="{'eager' if k == 1 else 'lazy'}" decoding="async"></figure>""")
        for v in w["videos"]:
            figs.append(f"""<figure class="fig"><video controls preload="none" playsinline src="{rel}assets/works/{w['slug']}/{v}.mp4"></video></figure>""")
        prev_w = WORKS[i - 1] if i > 0 else None
        next_w = WORKS[i + 1] if i < total - 1 else None
        pager = ""
        if prev_w:
            pager += f'<a class="u" data-prev href="{rel}works/{prev_w["slug"]}/">← {L("Prev", "이전")}</a>'
        if next_w:
            pager += f'<a class="u" data-next href="{rel}works/{next_w["slug"]}/">{L("Next", "다음")} →</a>'
        medium = (f'<p class="m">{L("Medium", "매체")}<br><span class="mute" style="text-transform:none">{esc(w["medium"])}</span></p>'
                  if w["medium"] else "")
        info = f"""<div class="winfo intro">
<a class="m u" href="{rel}#works">← {L(*T('works'))}</a>
<h1>{L(esc(w['title_en']), esc(w['title_ko']))}</h1>
<p class="m mute">{w['year']} · {w['n']:02d} / {total:02d}</p>
{medium}
<div class="pager m">{pager}</div>
</div>"""
        mid = (f'<div class="lab"><span class="m">{L(esc(w["title_en"]), esc(w["title_ko"]))}</span></div>'
               + "".join(figs))
        right = right_col(index_list(rel, w["slug"]), "Index", "목록", extra=str(total), cls="idx-only")
        t_en = f'{w["title_en"]} ({w["year"]}) — {NAME_EN}'
        t_ko = f'{w["title_ko"]} ({w["year"]}) — {NAME_KO}'
        write(f"works/{w['slug']}/index.html", page(
            rel=rel, path=f"works/{w['slug']}/", title_en=t_en, title_ko=t_ko,
            desc=f'{w["title_en"]}, {w["year"]}' + (f', {w["medium"]}' if w["medium"] else "") + f" — {NAME_EN}",
            left_extra=info, mid=mid, right=right, current="works",
            og_image=f"assets/works/{w['slug']}/cover.jpg"))
    # old /works address keeps working
    write("works/index.html", """<!doctype html><meta charset="utf-8"><title>Works — Dasul Kim</title>
<meta http-equiv="refresh" content="0; url=../#works"><link rel="canonical" href="%s/#works">
<a href="../#works">Works</a>""" % SITE)


# ---------------------------------------------------------------- text pages


def paras(items, lang):
    return "".join(f'<p>{esc(p)}</p>' for p in items)


def side_index(rel, current):
    return right_col(index_list(rel), "Index", "목록", extra=str(len(WORKS)), cls="idx-only")


def build_bio():
    rel = "../"
    mid = (f'<div class="lab"><span class="m">{L(*T("bio"))}</span><span class="m mute">{L(NAME_EN, NAME_KO)}</span></div>'
           f'<div class="prose"><div data-l="en" lang="en">{paras(BIO["en"], "en")}</div>'
           f'<div data-l="ko" lang="ko">{paras(BIO["ko"], "ko")}</div>'
           f'<p class="m"><a class="u" href="{rel}cv/">CV →</a> &nbsp; <a class="u" href="mailto:{EMAIL}">{EMAIL}</a></p></div>')
    write("bio/index.html", page(rel=rel, path="bio/", title_en=f"{PAGE['bio']['title_en']} — {NAME_EN}",
                                 title_ko=f"{PAGE['bio']['title_ko']} — {NAME_KO}",
                                 desc=META_DESC, mid=mid, right=side_index(rel, None), current="bio"))


def build_statement():
    rel = "../"
    mid = (f'<div class="lab"><span class="m">{L(*T("statement"))}</span><span class="m mute">{L(NAME_EN, NAME_KO)}</span></div>'
           f'<div class="prose"><div data-l="en" lang="en">{paras(STATEMENT["en"], "en")}</div>'
           f'<div data-l="ko" lang="ko">{paras(STATEMENT["ko"], "ko")}</div></div>')
    write("statement/index.html", page(rel=rel, path="statement/",
                                       title_en=f"{PAGE['statement']['title_en']} — {NAME_EN}",
                                       title_ko=f"{PAGE['statement']['title_ko']} — {NAME_KO}", desc=META_DESC, mid=mid,
                                       right=side_index(rel, None), current="statement"))


def build_cv():
    rel = "../"
    mid = (f'<div class="lab"><span class="m">{L(*T("cv"))}</span><span class="m mute">{portfolio_link(rel, False)}</span></div>'
           + bilingual_cv())
    write("cv/index.html", page(rel=rel, path="cv/", title_en=f"{PAGE['cv']['title_en']} — {NAME_EN}",
                                title_ko=f"{PAGE['cv']['title_ko']} — {NAME_KO}",
                                desc=META_DESC, mid=mid, right=side_index(rel, None), current="cv"))


def essay_en(e):
    return e.get("title_en") or e["title"]


def build_texts():
    rel = "../"
    toc = "".join(
        f'<a href="#{e["slug"]}">{L(esc(essay_en(e)), esc(e["title"]))}</a>' for e in TEXTS)
    blocks = []
    for e in TEXTS:
        sub = f'<p class="by" lang="ko">{esc(e["subtitle"])}</p>' if e.get("subtitle") else ""
        notes = "".join(f'<p lang="ko">{esc(n)}</p>' for n in e["notes"])
        body = "".join(f'<p lang="ko">{esc(p)}</p>' for p in e["paras"])
        blocks.append(f"""<article class="essay prose" id="{e['slug']}">
<p class="m mute">{L('Written in Korean', '글')}</p>
<h2>{L(esc(essay_en(e)), esc(e['title']))}</h2>
{sub}<p class="m by" lang="ko">{esc(e['author'])}</p>
{body}
<div class="notes">{notes}</div>
</article>""")
    mid = (f'<div class="lab"><span class="m">{L(*T("texts"))} <span class="pill">{len(TEXTS)}</span></span></div>'
           f'<div class="toc" style="padding-top:8px">{toc}</div>' + "".join(blocks))
    write("texts/index.html", page(rel=rel, path="texts/", title_en=f"{PAGE['texts']['title_en']} — {NAME_EN}",
                                   title_ko=f"{PAGE['texts']['title_ko']} — {NAME_KO}",
                                   desc="Critical texts and exhibition forewords on the work of Dasul Kim.",
                                   mid=mid, right=side_index(rel, None), current="texts"))


def build_contact():
    rel = "../"
    mid = (f'<div class="lab"><span class="m">{L(*T("contact"))}</span></div>'
           f'<div class="prose"><p class="lead"><a class="u" href="mailto:{EMAIL}">{EMAIL} ↗</a></p></div>')
    write("contact/index.html", page(rel=rel, path="contact/", title_en=f"{PAGE['contact']['title_en']} — {NAME_EN}",
                                     title_ko=f"{PAGE['contact']['title_ko']} — {NAME_KO}", desc=f"Contact Dasul Kim: {EMAIL}",
                                     mid=mid, right=side_index(rel, None), current="contact"))


def lock_ok(p):
    k = p.get("locked")
    return bool(isinstance(k, dict) and k.get("salt") and k.get("iv") and k.get("ct"))


def build_custom_pages():
    """pages made in the admin -> <slug>/index.html; pages that were removed or turned into drafts are cleaned up"""
    keep = {p["slug"] for p in PAGES if p["type"] == "custom" and p["status"] != "draft"}
    for name in os.listdir(ROOT):                      # earlier custom pages carry a marker
        f = os.path.join(ROOT, name, "index.html")
        if name not in keep and os.path.isfile(f):
            with open(f, encoding="utf-8") as fh:
                if 'name="dk-page"' in fh.read(2000):
                    shutil.rmtree(os.path.join(ROOT, name))
    for p in PAGES:
        if p["type"] != "custom" or p["status"] == "draft":
            continue
        rel = "../"
        en, ko = esc(p["title_en"]), esc(p["title_ko"])
        locked = lock_ok(p)
        if locked:
            k = p["locked"]
            data = json.dumps({"v": 1, "salt": k["salt"], "iv": k["iv"], "ct": k["ct"], "hint": k.get("hint", "")},
                              ensure_ascii=False).replace("<", "\\u003c")
            body = f"""<div class="prose lockbox" data-lock>
<p class="lead">{L("This page is password protected.", "비밀번호가 필요한 페이지예요.")}</p>
<form class="lockform" autocomplete="off">
<input type="password" name="pw" required autocomplete="off" aria-label="Password / 비밀번호" placeholder="Password / 비밀번호">
<button type="submit" class="m">{L("Open", "열기")}</button>
</form>
<p class="m mute lockhint"></p>
<p class="m lockerr" role="alert"></p>
<script type="application/json" class="lock-data">{data}</script>
<div class="lock-out"></div>
<noscript><p class="m">JavaScript is required.</p></noscript>
</div>"""
            desc = META_DESC
        else:
            body_en = p.get("body_en", "")
            body_ko = p.get("body_ko") or body_en
            body = (f'<div class="prose"><div data-l="en" lang="en">{md(body_en)}</div>'
                    f'<div data-l="ko" lang="ko">{md(body_ko)}</div></div>')
            first = re.sub(r"\s+", " ", re.sub(r"[#\[\]()]", "", body_en)).strip()
            desc = (first[:157] + "…") if len(first) > 158 else (first or META_DESC)
        mid = f'<div class="lab"><span class="m">{L(en, ko)}</span></div>' + body
        write(f"{p['slug']}/index.html", page(
            rel=rel, path=f"{p['slug']}/", title_en=f"{p['title_en']} — {NAME_EN}", title_ko=f"{p['title_ko']} — {NAME_KO}",
            desc=desc, mid=mid, right=side_index(rel, None), current=p["id"],
            noindex=(p["status"] == "hidden" or locked), extra_head='<meta name="dk-page" content="custom">',
            scripts=("lock.js",) if locked else ()))


def build_404():
    rel = "/"
    mid = (f'<div class="lab"><span class="m">404</span></div><div class="prose"><p class="lead">{L("Page not found.", "페이지를 찾을 수 없습니다.")}</p>'
           f'<p class="m"><a class="u" href="/">{L("Back to home", "홈으로")}</a></p></div>')
    write("404.html", page(rel=rel, path="404.html", title_en="Not found — Dasul Kim", title_ko="페이지 없음 — 김다슬",
                           desc=META_DESC, mid=mid, right='<aside class="col right idx-only"></aside>'))


def build_meta():
    urls = [""]
    for p in PAGES:           # hidden pages stay out of the sitemap (they are reachable by link only)
        if p["status"] != "menu" or p["id"] == "works":
            continue
        urls.append(BUILTIN[p["id"]][0] if p["type"] == "builtin" else p["slug"] + "/")
    urls += [f"works/{w['slug']}/" for w in WORKS]
    items = "".join(f"<url><loc>{SITE}/{u}</loc></url>" for u in urls)
    write("sitemap.xml", f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{items}</urlset>\n')
    write("robots.txt", f"User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n")
    write(".nojekyll", "")
    src, dst = os.path.join(ROOT, "assets", "favicon.ico"), os.path.join(ROOT, "favicon.ico")
    if os.path.isfile(src):                            # browsers ask for /favicon.ico
        shutil.copyfile(src, dst)
    elif os.path.isfile(dst):
        os.remove(dst)


if __name__ == "__main__":
    build_home()
    build_works()
    build_bio()
    build_statement()
    build_cv()
    build_texts()
    build_contact()
    build_custom_pages()
    build_404()
    build_meta()
    print(f"built {len(WORKS)} works")
