#!/usr/bin/env python3
"""Static site generator for dasulkim.com.

Reads content/*.json and writes the HTML pages. No dependencies beyond Python 3.
Run:  python3 build.py
Preview:  python3 -m http.server 8000   (then open http://localhost:8000)
"""
import html
import json
import os
import re
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = "https://www.dasulkim.com"
EMAIL = "info@dasulkim.com"
INSTAGRAM = "https://www.instagram.com/dsuriii"
NAME_EN, NAME_KO = "Dasul Kim", "김다슬"
DESC_EN = ("Dasul Kim is a media artist who explores the human ecosystem as it's projected onto "
           "non-human entities. Her work offers an expanded interpretation of concepts such as body, "
           "identity, the tangible and intangible, technology, and existence.")

esc = html.escape


def load(name):
    with open(os.path.join(ROOT, "content", name), encoding="utf-8") as f:
        return json.load(f)


WORKS = load("works.json")
BIO = load("bio.json")
STATEMENT = load("statement.json")
CV = load("cv.json")
TEXTS = load("texts.json")

# ---------------------------------------------------------------- helpers


def L(en, ko=None, tag="span", cls=""):
    """Two language versions; CSS shows the one matching <html lang>."""
    ko = en if ko is None else ko
    c = f' class="{cls}"' if cls else ""
    return (f'<{tag}{c} data-l="en" lang="en">{en}</{tag}><{tag}{c} data-l="ko" lang="ko">{ko}</{tag}>')


def wtitle(w, lang):
    return w["title_en"] if lang == "en" else w["title_ko"]


def cover_dims(w):
    im = w["images"][0]
    s = min(900 / im["w"], 900 / im["h"], 1)
    return round(im["w"] * s), round(im["h"] * s)


def write(path, content):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)


MENU = [
    ("bio", "bio/", "Bio", "소개"),
    ("statement", "statement/", "Artist Statement", "작가 노트"),
    ("works", "#works", "Works", "작업"),
    ("cv", "cv/", "CV", "CV"),
    ("texts", "texts/", "Texts", "텍스트"),
    ("contact", "contact/", "Contact", "연락처"),
]

YEAR_RE = re.compile(
    r"^((?:19|20)\d{2}(?:\.\d{1,2}){0,2}\.?(?:\s*[-–]\s*(?:(?:19|20)\d{2}(?:\.\d{1,2}){0,2}|Current|현재|Present))?"
    r"|Present|현\s*재)\s*\|?\s+(.*)$"
)


def cv_rows(items):
    out = []
    for line in items:
        m = YEAR_RE.match(line)
        y, rest = (m.group(1), m.group(2)) if m else ("", line)
        cls = "cv-row range" if len(y) > 12 else "cv-row"
        out.append(f'<div class="{cls}"><span class="y">{esc(y)}</span><span>{esc(rest)}</span></div>')
    return "".join(out)


def cv_sections(lang, only=None, group_limit=None):
    out = []
    for i, sec in enumerate(CV[lang]):
        if only is not None and i not in only:
            continue
        items = sec["items"]
        if group_limit and i == 2:
            items = items[:group_limit]
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


def page(*, rel, path, title_en, title_ko, desc, left_extra="", mid, right, current=None,
         og_image=None, canonical=None):
    menu = []
    for key, href, en, ko in MENU:
        cur = ' aria-current="page"' if key == current else ""
        menu.append(f'<a href="{rel}{href}"{cur}>{L(esc(en), esc(ko))}</a>')
    menu_html = (
        "".join(menu) + '<span class="gap"></span>'
        f'<a href="{INSTAGRAM}" rel="noopener" target="_blank">Instagram ↗</a>'
        f'<a href="mailto:{EMAIL}">{esc(EMAIL)} ↗</a>'
    )
    og = f'<meta property="og:image" content="{SITE}/{og_image}">' if og_image else ""
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
{og}
<meta name="twitter:card" content="summary_large_image">
<meta name="color-scheme" content="light">
<link rel="icon" href="{rel}assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="{rel}assets/fonts/Pretendard-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{rel}assets/css/style.css">
</head>
<body data-title-en="{esc(title_en)}" data-title-ko="{esc(title_ko)}">
<a class="skip" href="#main">Skip to content</a>
<div class="cols">
<aside class="col left">
  <div class="lab">
    <a class="name m" href="{rel or './'}">{L(NAME_EN, NAME_KO)}</a>
    <div class="lang m" role="group" aria-label="Language"><button type="button" data-set-lang="en" aria-pressed="true">EN</button><span class="sep">/</span><button type="button" data-set-lang="ko" aria-pressed="false">KR</button></div>
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
<script src="{rel}assets/js/site.js" defer></script>
</body>
</html>
"""


def right_col(inner, label_en, label_ko, extra="", cls=""):
    return (f'<aside class="col right {cls}"><div class="lab"><span class="m">{L(esc(label_en), esc(label_ko))}</span>'
            f'<span class="m mute">{extra}</span></div>{inner}</aside>')


# ---------------------------------------------------------------- home


def first_sentence(text):
    m = re.match(r"^(.*?다\.)\s", text)
    return m.group(1) if m else text


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
    mid = (f'<div class="lab"><span class="m" id="works">{L("Works", "작업")} <span class="pill">{len(WORKS)}</span></span>'
           f'<span class="m mute">{WORKS[-1]["year"]}–{WORKS[0]["year"]}</span></div>' + "".join(cards))
    intro = f"""<div class="intro">
  <div data-l="en" lang="en"><p>{esc(DESC_EN)}</p></div>
  <div data-l="ko" lang="ko"><p>{esc(first_sentence(BIO['ko'][0]))}</p></div>
  <p class="m"><a class="u" href="bio/">{L('Full bio', '소개 전체 보기')}</a></p>
</div>"""
    cv_inner = (bilingual_cv(only={0, 1, 2}, group_limit=8) +
                f'<div class="cv-more m"><a class="u" href="cv/">{L("Full CV →", "CV 전체 보기 →")}</a><br>'
                f'<a class="u" href="{CV["portfolio"]}" target="_blank" rel="noopener">{L("Portfolio PDF ↗", "포트폴리오 PDF ↗")}</a></div>')
    right = right_col(cv_inner, "CV", "CV", extra=f'<a class="u" href="cv/">{L("Full", "전체")}</a>')
    write("index.html", page(
        rel="", path="", title_en="Dasul Kim — Media artist", title_ko="김다슬 — 미디어 아티스트",
        desc=DESC_EN, left_extra=intro, mid=mid, right=right, og_image=f"assets/works/{WORKS[0]['slug']}/cover.jpg"))


# ---------------------------------------------------------------- work pages


def build_works():
    shutil.rmtree(os.path.join(ROOT, "works"), ignore_errors=True)
    total = len(WORKS)
    for i, w in enumerate(WORKS):
        rel = "../../"
        figs = []
        n_img = len(w["images"])
        for k, im in enumerate(w["images"], 1):
            figs.append(f"""<figure class="fig"><img src="{rel}assets/works/{w['slug']}/{k:02d}.jpg" width="{im['w']}" height="{im['h']}" alt="{esc(w['title_en'])} ({k}/{n_img})" loading="{'eager' if k == 1 else 'lazy'}" decoding="async"></figure>""")
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
<a class="m u" href="{rel}#works">← {L('Works', '작업')}</a>
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
    mid = (f'<div class="lab"><span class="m">{L("Bio", "소개")}</span><span class="m mute">{L(NAME_EN, NAME_KO)}</span></div>'
           f'<div class="prose"><div data-l="en" lang="en">{paras(BIO["en"], "en")}</div>'
           f'<div data-l="ko" lang="ko">{paras(BIO["ko"], "ko")}</div>'
           f'<p class="m"><a class="u" href="{rel}cv/">CV →</a> &nbsp; <a class="u" href="mailto:{EMAIL}">{EMAIL}</a></p></div>')
    write("bio/index.html", page(rel=rel, path="bio/", title_en="Bio — Dasul Kim", title_ko="소개 — 김다슬",
                                 desc=DESC_EN, mid=mid, right=side_index(rel, None), current="bio"))


def build_statement():
    rel = "../"
    mid = (f'<div class="lab"><span class="m">{L("Artist Statement", "작가 노트")}</span><span class="m mute">{L(NAME_EN, NAME_KO)}</span></div>'
           f'<div class="prose"><div data-l="en" lang="en">{paras(STATEMENT["en"], "en")}</div>'
           f'<div data-l="ko" lang="ko">{paras(STATEMENT["ko"], "ko")}</div></div>')
    write("statement/index.html", page(rel=rel, path="statement/", title_en="Artist Statement — Dasul Kim",
                                       title_ko="작가 노트 — 김다슬", desc=DESC_EN, mid=mid,
                                       right=side_index(rel, None), current="statement"))


def build_cv():
    rel = "../"
    mid = (f'<div class="lab"><span class="m">CV</span><span class="m mute"><a class="u" href="{CV["portfolio"]}" target="_blank" rel="noopener">{L("Portfolio PDF ↗", "포트폴리오 PDF ↗")}</a></span></div>'
           + bilingual_cv())
    write("cv/index.html", page(rel=rel, path="cv/", title_en="CV — Dasul Kim", title_ko="CV — 김다슬",
                                desc=DESC_EN, mid=mid, right=side_index(rel, None), current="cv"))


ESSAY_EN = {
    "layers": "Foreword to the solo exhibition “LAYERS”",
    "deep-dof": "Foreword to the solo exhibition “Deep DOF”",
    "blam-bang-boom": "Review of the solo exhibition “BLAM BANG BOOM”",
}


def build_texts():
    rel = "../"
    toc = "".join(
        f'<a href="#{e["slug"]}">{L(esc(ESSAY_EN[e["slug"]]), esc(e["title"]))}</a>' for e in TEXTS)
    blocks = []
    for e in TEXTS:
        sub = f'<p class="by" lang="ko">{esc(e["subtitle"])}</p>' if e.get("subtitle") else ""
        notes = "".join(f'<p lang="ko">{esc(n)}</p>' for n in e["notes"])
        body = "".join(f'<p lang="ko">{esc(p)}</p>' for p in e["paras"])
        blocks.append(f"""<article class="essay prose" id="{e['slug']}">
<p class="m mute">{L('Essay · written in Korean', '텍스트')}</p>
<h2>{L(esc(ESSAY_EN[e['slug']]), esc(e['title']))}</h2>
{sub}<p class="m by" lang="ko">{esc(e['author'])}</p>
{body}
<div class="notes">{notes}</div>
</article>""")
    mid = (f'<div class="lab"><span class="m">{L("Texts", "텍스트")} <span class="pill">{len(TEXTS)}</span></span></div>'
           f'<div class="toc" style="padding-top:8px">{toc}</div>' + "".join(blocks))
    write("texts/index.html", page(rel=rel, path="texts/", title_en="Texts — Dasul Kim", title_ko="텍스트 — 김다슬",
                                   desc="Critical texts and exhibition forewords on the work of Dasul Kim.",
                                   mid=mid, right=side_index(rel, None), current="texts"))


def build_contact():
    rel = "../"
    mid = (f'<div class="lab"><span class="m">{L("Contact", "연락처")}</span></div>'
           f'<div class="prose"><p class="lead"><a class="u" href="mailto:{EMAIL}">{EMAIL} ↗</a></p>'
           f'<p class="lead"><a class="u" href="{INSTAGRAM}" target="_blank" rel="noopener">Instagram ↗</a></p></div>')
    write("contact/index.html", page(rel=rel, path="contact/", title_en="Contact — Dasul Kim",
                                     title_ko="연락처 — 김다슬", desc=f"Contact Dasul Kim: {EMAIL}",
                                     mid=mid, right=side_index(rel, None), current="contact"))


def build_404():
    rel = "/"
    mid = (f'<div class="lab"><span class="m">404</span></div><div class="prose"><p class="lead">{L("Page not found.", "페이지를 찾을 수 없습니다.")}</p>'
           f'<p class="m"><a class="u" href="/">{L("Back to home", "홈으로")}</a></p></div>')
    write("404.html", page(rel=rel, path="404.html", title_en="Not found — Dasul Kim", title_ko="페이지 없음 — 김다슬",
                           desc=DESC_EN, mid=mid, right='<aside class="col right idx-only"></aside>'))


def build_meta():
    urls = [""] + [f"{p}/" for p in ("bio", "statement", "cv", "texts", "contact")] + [f"works/{w['slug']}/" for w in WORKS]
    items = "".join(f"<url><loc>{SITE}/{u}</loc></url>" for u in urls)
    write("sitemap.xml", f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{items}</urlset>\n')
    write("robots.txt", f"User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n")
    write(".nojekyll", "")
    write("assets/favicon.svg",
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#d9e8fb"/>'
          '<text x="16" y="21" font-family="monospace" font-size="14" text-anchor="middle" fill="#111">DK</text></svg>\n')


if __name__ == "__main__":
    build_home()
    build_works()
    build_bio()
    build_statement()
    build_cv()
    build_texts()
    build_contact()
    build_404()
    build_meta()
    print(f"built {len(WORKS)} works")
