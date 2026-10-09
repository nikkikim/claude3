#!/usr/bin/env python3
"""Builds the portfolio PDF (assets/portfolio/Dasul-Kim-Portfolio.pdf).

The layout follows the "open book" idea of the Cargo template: every PDF page is a spread
(two pages, a soft shadow in the gutter), images sit against the spine or bleed off the page,
and the only text is small and quiet.

    python3 portfolio/build_portfolio.py          # writes portfolio/portfolio.html and the PDF

Needs: Python 3 + Pillow, and Node with Playwright/Chromium for the PDF step (see render_pdf.js).
Edit the SPREADS list below to change pages, captions or images (images live in portfolio/img/).
"""
import html
import os
import subprocess
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT_PDF = os.path.join(ROOT, "assets", "portfolio", "Dasul-Kim-Portfolio.pdf")
YEAR = "2026"
PW, PH = 720, 810          # one page of the spread
M = 28                     # outer margin
TOP = 50                   # distance of framed images from the top edge (clears the running header)

_dims = {}


def dims(n):
    if n not in _dims:
        with Image.open(os.path.join(HERE, "img", f"i{n:03d}.jpg")) as im:
            _dims[n] = im.size
    return _dims[n]


def h_of(n, w):
    iw, ih = dims(n)
    return round(w * ih / iw)


def w_of(n, h):
    iw, ih = dims(n)
    return round(h * iw / ih)


def prepare_images():
    """small clean-ups on the extracted images (idempotent)"""
    p = os.path.join(HERE, "img", "i042.jpg")
    marker = p + ".clean2"
    if os.path.exists(p) and not os.path.exists(marker):
        with Image.open(p) as im:
            im = im.convert("RGB")
            w, h = im.size
            from PIL import ImageDraw
            px = im.load()
            for x in list(range(0, int(w * 0.12))) + list(range(int(w * 0.88), w)):   # edge strips only
                for y in range(h):
                    r, g, b = px[x, y]
                    if min(r, g, b) > 150:            # light grey arrows -> white, black ink untouched
                        px[x, y] = (255, 255, 255)
            im.save(p, quality=88)
        open(marker, "w").close()
        _dims.pop(42, None)


def esc(s):
    return html.escape(s, quote=False)


def q(s):
    """straight quotes -> typographic quotes"""
    out, open_ = [], True
    for ch in s:
        if ch == '"':
            out.append("“" if open_ else "”")
            open_ = not open_
        else:
            out.append(ch)
    return "".join(out)


class Page:
    def __init__(self, side):
        self.side = side
        self.parts = []
        self.hd = None          # header colour override

    # ---- placement helpers
    def _x(self, align, w):
        if align == "in":
            return "right:0" if self.side == "L" else "left:0"
        if align == "out":
            return "left:0" if self.side == "L" else "right:0"
        if align == "mid":
            return f"left:{(PW - w) // 2}px"
        return f"left:{align}px"

    def bleed(self, n, pos="50% 50%"):
        self.parts.append(
            f'<img src="img/i{n:03d}.jpg" style="left:0;top:0;width:{PW}px;height:{PH}px;object-fit:cover;object-position:{pos}">')
        return self

    def frame(self, n, w, top=TOP, align="in"):
        h = h_of(n, w)
        if top == "mid":
            top = (PH - h) // 2
        self.parts.append(f'<img src="img/i{n:03d}.jpg" style="{self._x(align, w)};top:{top}px;width:{w}px;height:{h}px">')
        return top + h

    def frameh(self, n, h, top=TOP, align="in"):
        w = w_of(n, h)
        if top == "mid":
            top = (PH - h) // 2
        self.parts.append(f'<img src="img/i{n:03d}.jpg" style="{self._x(align, w)};top:{top}px;width:{w}px;height:{h}px">')
        return top + h

    def stack(self, ns, w, top=TOP, gap=10, align="in"):
        y = top
        for n in ns:
            y = self.frame(n, w, y, align) + gap
        return y - gap

    def row(self, ns, h, top=TOP, gap=12, align="in"):
        """images side by side, all the same height"""
        widths = [w_of(n, h) for n in ns]
        total = sum(widths) + gap * (len(ns) - 1)
        x0 = {"in": (PW - total if self.side == "L" else 0), "out": (0 if self.side == "L" else PW - total)}.get(align, align)
        x = x0
        for n, w in zip(ns, widths):
            self.parts.append(f'<img src="img/i{n:03d}.jpg" style="left:{x}px;top:{top}px;width:{w}px;height:{h}px">')
            x += w + gap
        return top + h

    def grid(self, rows, w, top=TOP, gap=12, align="in"):
        """rows = [[n, n], [n, n]]; every cell has width w, rows are as tall as their tallest image"""
        total = w * len(rows[0]) + gap * (len(rows[0]) - 1)
        x0 = {"in": (PW - total if self.side == "L" else 0), "out": (0 if self.side == "L" else PW - total)}.get(align, align)
        y = top
        for r in rows:
            hs = [h_of(n, w) for n in r]
            for i, n in enumerate(r):
                self.parts.append(f'<img src="img/i{n:03d}.jpg" style="left:{x0 + i * (w + gap)}px;top:{y}px;width:{w}px;height:{h_of(n, w)}px">')
            y += max(hs) + gap
        return y - gap

    def text(self, body, left, top, width, cls="t"):
        self.parts.append(f'<div class="{cls}" style="left:{left}px;top:{top}px;width:{width}px">{body}</div>')

    def cap(self, lines, chip=False, left=M, bottom=26, color=None):
        body = "<br>".join(esc(l) for l in lines)
        c = "cap chip" if chip else "cap"
        st = f"left:{left}px;bottom:{bottom}px" + (f";color:{color}" if color else "")
        self.parts.append(f'<div class="{c}" style="{st}">{body}</div>')

    def html(self):
        return "".join(self.parts)


class Spread:
    def __init__(self, bg="w", hdL=None, hdR=None):
        self.bg = bg
        self.L, self.R = Page("L"), Page("R")
        self.top = []
        self.hdL = hdL or ("w" if bg == "k" else "k")
        self.hdR = hdR or ("w" if bg == "k" else "k")

    def full(self, n, pos="50% 50%"):
        self.top.append(
            f'<img src="img/i{n:03d}.jpg" style="left:0;top:0;width:1440px;height:810px;object-fit:cover;object-position:{pos}">')

    def fit(self, n, h, top=24):
        """one image spanning the spread, centred, `h` tall"""
        w = w_of(n, h)
        self.top.append(f'<img src="img/i{n:03d}.jpg" style="left:{(1440 - w) // 2}px;top:{top}px;width:{w}px;height:{h}px">')

    def band(self, n, top="mid"):
        h = h_of(n, 1440)
        if top == "mid":
            top = (PH - h) // 2
        self.top.append(f'<img src="img/i{n:03d}.jpg" style="left:0;top:{top}px;width:1440px;height:{h}px">')
        return top + h

    def cap(self, lines, chip=False, color=None):
        body = "<br>".join(esc(l) for l in lines)
        c = "cap chip" if chip else "cap"
        self.top.append(f'<div class="{c}" style="left:{M}px;bottom:26px' + (f";color:{color}" if color else "") + f'">{body}</div>')


# ----------------------------------------------------------------------------- content

SPREADS = []

# 1 — cover
s = Spread("k")
s.R.parts.append('<img src="img/i000.jpg" style="left:117px;top:0;width:486px;height:810px">')
s.L.text('<span class="big">김다슬</span><br><span class="mid">Kim Dasul</span>', M, 640, 500, "t cov")
s.L.text(f"Portfolio {YEAR}", M, 760, 400, "t w small")
SPREADS.append(("cover", s))

# 2 — introduction (bio, artist statement)
s = Spread()
s.L.text("<b>김다슬 Kim Dasul</b><br>www.dasulkim.com<br>info@dasulkim.com<br>IG @dsuriii", M, 96, 360, "t small")
s.L.text(
    "김다슬은 영상을 비롯해 인공지능, 증강현실, 제너러티브 및 인터랙티브, 아트게임 등 뉴 미디어 매체를 사용하여 비인간 주체에 투영된 인간 생태계를 보여주고 물질과 비물질, 기술과 존재, 자아와 세계에 대한 확장된 해석을 제시한다. "
    "디지털에 대한 사적 친밀감을 바탕으로 디지털 대양감과 가상존재윤리 등 존재에 대한 비인간중심주의적 접근을 보여주는 그의 작업은 플랫폼L, 뮤지엄 산, 탈영역우정국, 오시선 등과 미국 LA 한국문화원, Supercollider, New Wight Gallery, Oxy Arts 등에서 선보여졌고 "
    "양자 미술 및 AI 아트 대회에서 수상한 바 있다. 이화여자대학교에서 조소와 미술사를, UCLA에서 미디어 아트를 공부했다.",
    M, 210, 400, "t body")
STATEMENT = [
    "납작한 것은 죽은 것이고 우리는 죽은 것에 관심을 두지 않는다. 나는 디지털에서 부피를 본다. 부피는 생명력이자 에너지다. 하나의 픽셀은 한 사람의 인생이나 다름없다. 렌더링을 거쳐 이미지가 생성될 때, 픽셀을 채우는 무언의 존재를 발견한다. 우리 세계에서 간과된 인간들을 본 것처럼. 나에게 요구된 하루의 할당량을 채우고 바닥에 누웠을 때, 나는 모니터 뒤의 존재를 보았다. 유저로부터 요청된 그래픽을 처리하기 위해 픽셀 하나하나를 채우던 존재가 바로 나였다. 어둠 속, 전원이 꺼진 세상 뒤에서 오로지 나와 함께 깨어있는 것은 눈을 번쩍이는 기계들 뿐이었다.",
    "내 작업은 개인적인 경험에서 온 비현실감을 바탕으로 주체와 존재에 대한 의문으로부터 물질과 비물질의 관계를 탐구하는 것으로 이어진다. 이인감에서 비롯된 관찰자적인 시선은 가상과 현실의 경계를 불분명하게 하고 이 둘을 하나의 통합적인 세계로 만들고자 하는 충동에 사로잡히게 한다. 주관적 감각 세계를 뉴 미디어로 시각화하여 개인의 인식과 그것이 어떻게 주변 세계와 교차하는지를 보여주고 외적 세계와의 관계를 새롭게 탐구한다. 또한, 가상의 존재를 포함한 비인간 주체를 인간적인 시선으로 바라보아 그들에게서 인간의 모습을 찾기도, 인간의 위치로 격상시키기도 하고 디지털적인 방법론을 현실에 적용하기도, 그 반대로도 경계를 교차시켜 다양한 주체를 오가며 우연적이고 사적인 방식으로 존재와 세계를 탐구한다.",
    "현실 세계는 내게 주(主)와 부(副)가 불분명하게 받아들여지는데, 아이러니하게도 0과 1의 이진법으로 구성된 명확한 구분과 체계가 있는 디지털의 특성을 통해 현실을 이해하는 새로운 관점을 얻게 된다. 현실과 디지털의 경계에서 발생한 특별한 시각은 감각과 인식을 해부하고 스스로와 세계를 이해하도록 돕는다. 나는 작업을 통해 주체와 대상, 내면과 외면, 현실과 가상 사이를 넘나들면서 자신을 둘러싼 세계와 그 안의 수많은 요소들에 대한 새로운 시각과 해석을 제공하고 그것을 통해 존재의 의미를 질문하고자 한다.",
]
s.R.text("<b>아티스트 스테이트먼트</b>", 80, 96, 560, "t small")
s.R.text("".join(f"<p>{esc(p)}</p>" for p in STATEMENT), 80, 140, 560, "t body")
SPREADS.append(("intro", s))

# 3 — excerpt from the artist's notes + drawing
NOTE = [
    "내가 어린아이였을 때, 부리로 중심을 잡는 새 장난감을 무척 좋아했다. 아마 무게중심에 닿아 서로를 지지하는 느낌이 좋았던 것 같다. 손을 꽉 붙잡고 있는 것처럼. 내가 중력을 겨우 버티고 있는 것처럼 느껴질 때, 내 자신이 아마 그 새일 거라고 생각한다. 새의 등은 검정색, 흰 배. 그리고 살구색 손가락. 접촉, 연결 - 색의 경계는 흐려진다. 나는 어떤 이야기들을 계속 생각했다. 스크린 속의 나는 나. 나는 너. 평평한 나. 나는 가끔씩 사라지고, 그리고 합쳐진다. 공기의 냄새, 살 썩는 냄새. 희미해지는 삶의 경계, 무한해지는 세계. 끊임없는 반복, 깜빡, 깜빡, 깜빡",
    "세상에, 날이 추워지니 나는 차가운 담요, 나는 차가운 벽, 나는 차가운 공기. 순간, 나는 내가 물결치는 커튼을 잡아당기는 것을 봤다. 갑-자-기 훨씬 느려진 시간. ㅎ ㅏ ㄴ ㅏ... 두 ㅇ ㅜ ㄹ,,, ㅅ ㅔ ㅇ ㅔ ㅅ... 숨을 쉬면, 떨어지는 따뜻한 물 아래로 갑작스런 현기증. 아마 난 지금 여기에 있는 것 같다. 컵에 담긴 우유처럼, 기억이 나에게 쏟아져 들어온다.",
    "오늘 만난 사람이 말하길, 경비원도 없는 아파트 입구에서 유치원생이 카드를 탭하고 비밀번호를 눌러 혼자 건물 안으로 들어가는 모습이 안타까웠다고 했다. 아침에 봤던 장면이 생각났다. VR 헤드셋을 끼니, 숲에 눈이 내렸다. 나는 차라리 그 눈이 따뜻하다고 생각했다.",
    "나는 점점 더 높게 날아, 모두는 점점 더 작아지고, 점이 되었다가 결국 사라졌다. 나를 혼내거나 싸우는 소리도 더이상 들리지 않았다. 불안정하지만 광활한 고요. 나는 떠다니다가, 떠다니다가, 모든 밤하늘의 까만 색처럼 어둠에 빠져 떠다니다가.",
]
s = Spread()
s.L.text("<b>작가노트 일부</b>", M, 96, 400, "t small")
s.L.text("".join(f"<p>{esc(p)}</p>" for p in NOTE), M, 140, 440, "t body")
s.R.frame(6, 440, top=180, align=120)
SPREADS.append(("note", s))

# 4 — 2026: floorboards
s = Spread()
s.L.stack([8, 10], 560, TOP, 12)
s.L.cap(["〈The Floorboards That Used to Creak (삐걱 소리를 내던 마루바닥)〉 I–II, 2026, Archival pigment print on canvas, woven, 118.9 x 42 cm each"])
s.R.bleed(12, "74% 50%")
SPREADS.append(("floorboards", s))

# 5 — 2026: viewing stone
s = Spread()
s.L.frame(14, 600, TOP)
s.L.cap(["〈Grandfather’s Viewing Stone (할아버지의 수석)〉 I–III, 2026, Archival pigment print on canvas, woven, 40 x 30 cm each"])
s.R.parts.append(f'<img src="img/i016.jpg" style="left:0;top:0;width:720px;height:405px;object-fit:cover">')
s.R.parts.append(f'<img src="img/i018.jpg" style="left:0;top:405px;width:720px;height:405px;object-fit:cover">')
SPREADS.append(("stone", s))

# 6 — 2026: life in the shape of clouds
s = Spread()
s.L.stack([20, 22], 540, TOP, 12)
s.L.cap(["〈Life in the Shape of Clouds Series〉, 2026, Archival pigment print, woven, 59.4 x 21 cm each"])
s.R.stack([24, 26], 540, TOP, 12)
SPREADS.append(("clouds-series", s))

# 7 — 2026: Layers installation view
s = Spread()
s.full(28)
s.cap(["Installation view: Layers (2026, Daegu Artway, Daegu)"], chip=True)
SPREADS.append(("layers", s))

# 8 — latent perception / night refuses to end
s = Spread()
s.L.bleed(32, "50% 50%")
s.R.frame(30, 520, TOP)
s.R.cap(["〈잠재지각 (Latent Perception)〉, 2025, single-channel video, color, sound, 4min 3sec",
         "〈불면 I–VI (Night Refuses to End I–VI)〉, 2025, PLA filament, speaker, dimensions variable"])
SPREADS.append(("latent", s))

# 9 — E8, constellations, void
s = Spread("k")
s.L.bleed(36, "50% 50%")
y = s.R.stack([34, 38], 440, TOP, 12)
s.R.cap(["〈E8 ∞ E8 (Cosmos)〉, 2025, Steel, pigment print on roll photo paper, dimensions variable",
         "〈별지도 I–VI (Constellations)〉, 2025, Steel, single channel video, dimensions variable",
         "〈허공, 붙잡기, 놓아버리기 (Void, Hold, Let go)〉, 2025, PLA filament, dimensions variable"], color="#fff")
SPREADS.append(("cosmos", s))

# 10 — failing language
s = Spread()
s.L.frame(42, 520, TOP)  # (arrows are cropped in prepare_images)
s.L.cap(["〈실패하는 언어 I (어둠에 잠긴 스카이라인 위로 섬광이 비치고 있다)〉, 2025, Acrylic on linen, 59.4 x 21 cm",
         "〈실패하는 언어 II (나는 침묵하지 않겠다)〉, 2025, Acrylic on linen, 59.4 x 21 cm",
         "〈실패하는 언어 III (오늘밤은 어제보다 더 어려운 날이 될 것이다)〉, 2025, Acrylic on linen, 59.4 x 21 cm",
         "〈실패하는 언어 IV (셋, 둘, 하나, 해피 뉴 이어!)〉, 2025, Acrylic on linen, 59.4 x 21 cm",
         "〈실패하는 언어 V (소들이 일제히 음매하고 울었다)〉, 2025, Acrylic on linen, 59.4 x 21 cm"])
s.R.bleed(40, "28% 50%")
SPREADS.append(("failing-language", s))

# 11 — BLAM BANG BOOM
s = Spread()
s.L.parts.append('<img src="img/i046.jpg" style="left:0;top:0;width:720px;height:405px;object-fit:cover">')
s.L.parts.append('<img src="img/i048.jpg" style="left:0;top:405px;width:720px;height:405px;object-fit:cover">')
s.R.bleed(44, "72% 50%")
s.R.cap(["〈쿵쾅펑! (BLAM BANG BOOM!)〉, 2025, single-channel video, real-time, custom software, black and white, sound"], chip=True)
SPREADS.append(("blam", s))

# 12 — unfolded landscape / black flash
s = Spread()
s.L.frame(50, 720, 0, align=0)
s.L.cap(["〈펼쳐진 풍경, 일렁이는 시야 (Unfolded Landscape, Flickering View)〉, 2025, Acrylic on linen, dimensions variable"], bottom=26)
s.R.frame(52, 520, TOP)
s.R.cap(["〈검은 섬광 (Black Flash)〉, 2025, PLA filament, dimensions variable"])
SPREADS.append(("unfolded", s))

# 13 — boundless landscape
s = Spread()
s.L.frame(62, 560, TOP, align=40)
s.R.stack([54, 56, 58, 60], 470, TOP, 10)
s.R.cap(["〈무한풍경 (Boundless Landscape)〉, 2025, single-channel video, color, silent, 9min 23sec"])
SPREADS.append(("boundless", s))

# 14 — one and nine candles
s = Spread("k")
s.L.frameh(66, 640, "mid", align="mid")
s.R.frame(64, 720, "mid", align=0)
s.R.cap(["〈1개와 9개의 촛불 I–IX (One and Nine Candles I–IX)〉, 2024, loop video, color, sound"], color="#fff")
SPREADS.append(("candles", s))

# 15 — fading flame
s = Spread("k")
s.L.frame(68, 720, "mid", align=0)
s.R.frame(70, 720, "mid", align=0)
s.cap(["〈꺼진 촛불 (Fading Flame)〉, 2024, single-channel video, black and white, sound, 3min 5sec"], color="#fff")
SPREADS.append(("fading-flame", s))

# 16 — grass, wind
s = Spread()
s.L.stack([72, 74], 600, TOP, 12)
s.R.stack([76, 78, 80], 380, TOP, 10)
s.R.cap(["〈풀과 바람과 공기의 시선과 (Grass, Wind, Gaze of Air, and..)〉, 2024, single-channel video, color, sound, 1min 1sec"])
SPREADS.append(("grass-wind", s))

# 17 — the clouds flow fast
s = Spread()
s.full(82, "50% 40%")
s.cap(["〈구름이 흘러간다, 아주 빠른 움직임으로 (The Clouds Flow Fast)〉, 2024, single-channel video, color, sound, 4min 23sec"], chip=True)
SPREADS.append(("clouds-flow", s))

# 18 — future clouds
s = Spread()
s.L.bleed(84, "56% 50%")
s.R.stack([86, 88], 470, TOP, 12)
s.R.cap(["〈테라폴리스의 하늘 (The Skies of Terrapolis)〉, 2024, Pigment print, 90 x 120 cm",
         "〈미래구름: 지구 (Future Clouds: Earth)〉, 2024, Pigment print, 50 x 50 cm",
         "〈미래구름: 목성 (Future Clouds: Jupiter)〉, 2024, Pigment print, 29.7 x 42 cm",
         "〈미래구름: 수성 (Future Clouds: Mercury)〉, 2024, Pigment print, 29.7 x 21 cm",
         "〈미래구름: 토성 (Future Clouds: Saturn)〉, 2024, Pigment print, 50 x 50 cm"])
SPREADS.append(("future-clouds", s))

# 19 — swimming in the void
s = Spread()
s.band(90)
s.cap(["〈허공에서 수영하기 (Swimming in the Void)〉, 2023, interactive, real-time video"])
SPREADS.append(("void", s))

# 20 — three steps one dance
s = Spread()
s.fit(92, 700, 52)
s.cap(["〈3보1댄스 (Three Steps One Dance)〉, 2023, VR 360-degree video, color, sound, 1min 14sec"])
SPREADS.append(("three-steps", s))

# 21 — our promised land
s = Spread()
s.L.stack([94, 96], 560, TOP, 10, align="out")
s.R.stack([98, 100], 560, TOP, 10)
s.R.cap(["〈낙원 (Our Promised Land)〉, 2023, single-channel video, color, 8min 30sec"])
SPREADS.append(("promised-land", s))

# 22 — anemotex
s = Spread()
s.L.stack([102, 104], 500, TOP, 12)
s.L.cap(["〈아네모텍스: 바람의 풍경 (AnemoTéx: Landscape of Wind)〉, 2023, interactive, projection mapping on fan, augmented reality",
         "Collaboration with Traditional Korean Fan-making Artisan of Intangible Cultural Heritage"])
s.R.row([106, 108], 700, TOP, 12)
SPREADS.append(("anemotex", s))

# 23 — jikyungsori
s = Spread()
s.L.frame(112, 640, TOP)
s.L.cap(["〈지경소리 (Jikyungsori)〉, 2022, 2-channel video, color, sound, 7min 14sec"])
s.R.frame(110, 400, TOP)
SPREADS.append(("jikyungsori", s))

# 24 — prop
s = Spread()
s.L.frameh(114, 690, TOP, align=110)
s.L.cap(["〈Prop〉, 2022, custom software, interactive, walking simulator"])
s.R.grid([[116, 118], [120, 122]], 330, TOP, 12)
SPREADS.append(("prop", s))

# 25 — freesia
s = Spread()
s.L.frame(124, 600, 150, align=60)
s.R.row([126, 128], 580, TOP, 12)
s.R.cap(["〈Freesia〉, 2022, multi-channel video, color, 2min"])
SPREADS.append(("freesia", s))

# 26 — reciter
s = Spread()
s.L.frame(130, 720, 200, align=0)
s.L.cap(["〈Reciter〉, 2021, custom software, EEG device, real-time video, performance"])
s.R.stack([132, 134, 136], 380, TOP, 10)
SPREADS.append(("reciter", s))

# 27 — wheel of jjik
s = Spread()
s.L.frame(138, 360, TOP)
s.L.cap(["〈찍의 굴레 (Wheel of Jjik)〉, 2021, augmented reality, essay, video, mobile website"])
s.R.frame(140, 560, TOP)
s.R.frame(142, 120, 400)
SPREADS.append(("wheel-of-jjik", s))

# 28 — who's more
s = Spread("k")
s.L.frame(144, 720, "mid", align=0)
s.R.frame(146, 720, "mid", align=0)
s.cap(["〈누가 더? (Who’s More?)〉, 2021, custom software, game"], color="#fff")
SPREADS.append(("whos-more", s))

# 29 — null bree
s = Spread()
s.L.frame(148, 720, "mid", align=0)
s.L.cap(["〈최고의 댄서, 널 브리 (Null Bree, the Best Dancer)〉, 2020, single-channel video, color, sound, 5min 58sec"])
y0 = (PH - (h_of(150, 600) + 10 + h_of(152, 600))) // 2
s.R.stack([150, 152], 600, y0, 10)
SPREADS.append(("null-bree", s))

# 30 — gold moves
s = Spread()
s.L.frame(154, 600, "mid", align="mid")
s.R.frame(156, 720, 230, align=0)
s.R.cap(["〈골드 무브 (Gold Moves)〉, 2020, digital image, stamped wet clay, scanned the stamp, colored digitally"])
SPREADS.append(("gold-moves", s))

# 31 — mindfulness
s = Spread()
s.L.frame(158, 560, TOP)
s.L.cap(["〈Mindfulness for the Quarantined〉, 2020, generative video and voice in the style of Bob Ross, color, sound, 2min 29sec"])
s.R.frame(160, 560, TOP)
SPREADS.append(("mindfulness", s))

# 32 — clover killer
s = Spread()
s.L.frame(162, 640, TOP, align=40)
s.L.cap(["〈대현동 토끼풀 살생사건 (Daehyun-dong Clover Killer)〉, 2020, Performance, 15min"])
s.R.stack([164, 166, 168], 400, TOP, 10)
SPREADS.append(("clover-killer", s))

# 33 — turbulence
s = Spread()
s.L.frame(170, 720, 120, align=0)
s.L.cap(["〈난기류와 화이트걸 (Turbulence and the Girl in White)〉, 2020, Zoom performance, 25min", "Collaboration with Sujeong Park"])
s.R.grid([[172, 174], [176, 178]], 250, TOP, 12)
SPREADS.append(("turbulence", s))

# 34 — may luck
s = Spread()
s.L.frameh(180, 690, TOP, align=100)
s.L.cap(["〈May Luck be with Your Future Self〉, 2019, mixed media, interactive, telephone, distance sensor, Arduino, speaker"])
s.R.frame(182, 600, 250)
SPREADS.append(("may-luck", s))

# 35 — CV
def cv_block(title, rows):
    out = [f'<div class="cvh">{esc(title)}</div>']
    for year, items in rows:
        for i, it in enumerate(items):
            y = year if i == 0 else ""
            out.append(f'<div class="cvr"><span>{y}</span><span>{esc(q(it))}</span></div>')
    return "".join(out)


CV_L = (
    cv_block("학력", [("2021", ["University of California, Los Angeles. Media Arts 석사"]), ("2019", ["이화여자대학교. 조소 석사"]), ("2015", ["이화여자대학교. 조소, 미술사 학사"])])
    + cv_block("수상", [("2025", ["ESAarts Award 선정. 이화조각회"]), ("2024", ["ONSO Artist 선정. 현대차 정몽구 재단"]), ("2023", ["가송예술상 콜라보레이션 부문 수상. 가송문화재단"]),
                      ("2020", ["AI X Art Global Competition 은상 수상. AI.A Gallery"]), ("2019", ["양자의 세계 3등상 수상. IBS Center for Quantum Nanoscience"]),
                      ("2013", ["페리에 130주년 기념 '물 만난 아티스트' 선정. CUC Inc."])])
    + cv_block("개인전", [("2026", ['"하이퍼오브젝트", 대구예술발전소', '"Layers", 대구아트웨이']), ("2025", ['"깊은심도", BCL', '"쿵쾅펑", 갤러리유피']),
                        ("2024", ['"After all...", 모브닷.에이', '"미래구름", 온드림소사이어티', '"픽셀-큐브", Helen.A']), ("2023", ['"납작한 입체들의 사원", 오시선']),
                        ("2020", ['"Future and Prophecy", UCLA EDA (CA, USA)']), ("2019", ['"오늘은 어제인가 내일인가", Cyartspace'])])
    + cv_block("주요 단체전", [("2026", ['"Flat-Thin-Microcosm", 스페이스잉크', '"What You Want", 아트스페이스보더'])])
)
CV_R = (
    '<div class="cvr"><span></span><span>' + esc(q('"Digital Media Art Festa", H.Art1')) + "</span></div>"
    + "".join(f'<div class="cvr"><span></span><span>{esc(q(t))}</span></div>' for t in ['"cooling effect...", 나이트쉬프트', '"K-WMA", 솔트사직'])
    + cv_block("", [
        ("2025", ['"IBK 더아트프라자", IBK기업은행본점', '"여기 ( ) 있어요", 온수공간', '"Shifting Ground", Processa (NY, USA)', '"슈도코드", 중간지점둘', '"평면의 깊이", 언바운드', '"염하기", 계원예술대학교미술관', '"포레페스타", 자하미술관']),
        ("2024", ['"Re-Fest", CultureHub (NY, USA)', '"Wave to Wave", 피어컨템포러리', '"우리의 포스트 포스트 포스트...", 스페이스언더바']),
        ("2023", ['"Hacker Space", TINC', '"울산현대미술제", 문화의거리']),
        ("2022", ['"Video Bites", 플랫폼엘']),
        ("2021", ['"Time Capsule", 오시선', '"작가의 이력서", 예술공간 의식주']),
        ("2020", ['"Deep Fake", Supercollider (CA, USA)', '"대현동 토끼풀 살생사건", 가삼로지을', '"Streetview Video Series", Oxy Arts (CA, USA)']),
        ("2018", ['"We, Activeast", New Wight Gallery (CA, USA)', '"여성이 여성을 되찾다", 탈영역우정국', '"일상의 예술: 오브제", 뮤지엄 산']),
        ("2017", ['"Spoon Art Show", 킨텍스', '"SIAE: 100 beyond Sculpture", 코엑스']),
        ("2016", ['"Contemporary Korean Prints", LA한국문화원 (CA, USA)']),
        ("2015", ['"New Face", 고은갤러리']),
    ]).replace('<div class="cvh"></div>', "")
)
s = Spread()
s.L.text(CV_L, 80, 92, 560, "t cv")
s.R.text(CV_R, 80, 92, 560, "t cv")
SPREADS.append(("cv", s))

# 36 — end
s = Spread()
s.L.parts.append('<img src="img/i000.jpg" style="left:120px;top:150px;width:240px;height:400px">')
s.R.text("<b>김다슬 Kim Dasul</b><br>www.dasulkim.com<br>info@dasulkim.com<br>IG @dsuriii", 80, 150, 400, "t small")
s.R.text(f"© {YEAR} Dasul Kim", 80, 740, 300, "t small mute")
SPREADS.append(("end", s))

# ----------------------------------------------------------------------------- html

CSS = """
@font-face{font-family:"Pretendard";src:url(../assets/fonts/Pretendard-Regular.woff2) format("woff2");font-weight:400}
@font-face{font-family:"Pretendard";src:url(../assets/fonts/Pretendard-Bold.woff2) format("woff2");font-weight:700}
@page{size:1440px 810px;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1440px;background:#fff}
body{font-family:"Pretendard",sans-serif;color:#111;-webkit-font-smoothing:antialiased}
.spread{position:relative;width:1440px;height:810px;overflow:hidden;page-break-after:always;break-after:page;background:#fff}
.spread:last-child{page-break-after:auto;break-after:auto}
.spread.k{background:#000;color:#fff}
.page{position:absolute;top:0;width:720px;height:810px;overflow:hidden}
.page.L{left:0}.page.R{left:720px}
.page img,.spread>img{position:absolute;display:block}
.hd{position:absolute;top:24px;font:700 11px/1 "Pretendard",sans-serif;letter-spacing:0;z-index:5}
.hd.hl{left:28px}.hd.hr{right:28px}
.hd.w{color:#fff}.hd.k{color:#111}
.t{position:absolute}
.t.small{font:400 11.5px/1.6 "Pretendard",sans-serif}
.t.small b{font-weight:700}
.t.body{font:400 12.5px/1.8 "Pretendard",sans-serif;word-break:keep-all}
.t.body p{margin:0 0 15px}
.t.mute{color:#8d8d8d}
.t.w{color:#fff}
.cov .big{font:700 64px/1.1 "Pretendard",sans-serif;letter-spacing:-.02em;color:#fff}
.cov .mid{font:400 22px/1.5 "Pretendard",sans-serif;color:#fff}
.t.cv{font:400 12px/1.65 "Pretendard",sans-serif}
.cvh{font:700 12px/1.4 "Pretendard",sans-serif;margin:24px 0 8px}
.cvh:first-child{margin-top:0}
.cvr{display:grid;grid-template-columns:44px 1fr}
.cap{position:absolute;font:400 10.5px/1.55 "Pretendard",sans-serif;color:#111;max-width:640px;z-index:4}
.spread.k .cap{color:#fff}
.cap.chip{background:rgba(255,255,255,.9);color:#111;padding:6px 9px 5px}
.spine{position:absolute;left:0;top:0;width:1440px;height:810px;z-index:3;pointer-events:none;
  background:linear-gradient(to right,rgba(0,0,0,0) 0,rgba(0,0,0,0) 650px,rgba(0,0,0,.08) 690px,rgba(0,0,0,.30) 714px,rgba(0,0,0,.52) 719px,rgba(0,0,0,.40) 721px,rgba(0,0,0,.14) 732px,rgba(0,0,0,.05) 760px,rgba(0,0,0,0) 800px)}
.spread.k .page img{mix-blend-mode:screen}
.spread.k .spine{background:linear-gradient(to right,rgba(255,255,255,0) 0,rgba(255,255,255,0) 700px,rgba(255,255,255,.10) 719px,rgba(255,255,255,.10) 721px,rgba(255,255,255,0) 740px)}
"""


def render_html():
    total = len(SPREADS)
    out = ['<!doctype html><html lang="ko"><meta charset="utf-8">',
           f"<title>Dasul Kim — Portfolio {YEAR}</title><style>{CSS}</style><body>"]
    for i, (name, sp) in enumerate(SPREADS, 1):
        cls = "spread " + ("k" if sp.bg == "k" else "w")
        right = f"Portfolio {YEAR} &nbsp; {i:02d} / {total:02d}"
        out.append(f'<section class="{cls}" id="{name}">')
        out.append(f'<div class="page L">{sp.L.html()}</div><div class="page R">{sp.R.html()}</div>')
        out.append("".join(sp.top))
        out.append('<div class="spine"></div>')
        out.append(f'<div class="hd hl {sp.hdL}">김다슬 Kim Dasul</div><div class="hd hr {sp.hdR}">{right}</div>')
        out.append("</section>")
    out.append("</body></html>")
    return "\n".join(out)


def main():
    prepare_images()
    path = os.path.join(HERE, "portfolio.html")
    with open(path, "w", encoding="utf-8") as f:
        f.write(render_html())
    os.makedirs(os.path.dirname(OUT_PDF), exist_ok=True)
    env = dict(os.environ)
    if "NODE_PATH" not in env:
        try:
            env["NODE_PATH"] = subprocess.check_output(["npm", "root", "-g"], text=True).strip()
        except Exception:
            pass
    subprocess.check_call(["node", os.path.join(HERE, "render_pdf.js"), path, OUT_PDF], env=env)
    print("wrote", OUT_PDF, round(os.path.getsize(OUT_PDF) / 1e6, 1), "MB,", len(SPREADS), "spreads")


if __name__ == "__main__":
    main()
