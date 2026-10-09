# dasulkim.com

김다슬(Dasul Kim) 포트폴리오 사이트. Wix에서 옮겨온 정적 사이트이고, GitHub Pages로 무료 호스팅할 수 있어요.

- 기본 언어는 영어이고, 왼쪽 위의 `EN / KR`로 한국어로 바꿀 수 있어요. 선택은 브라우저에 기억돼요. `?lang=ko`를 주소에 붙여도 한국어로 열려요.
- 데스크톱은 3열(프로필·메뉴 / 작품 / CV·목록)이고 열마다 따로 스크롤돼요. 모바일은 한 열로 쌓여요.
- 작품 42개, Bio, Artist Statement, CV, Texts, Contact 페이지가 있어요.

## 구성

```
index.html, bio/, statement/, cv/, texts/, contact/, works/*/   ← build.py가 만든 페이지
content/*.json                                                  ← 글과 작품 정보 (여기를 고치세요)
assets/works/<작품>/                                            ← 작품 이미지(01.jpg…), 대표 이미지(cover.jpg), 영상
assets/css/style.css, assets/js/site.js, assets/fonts/          ← 디자인, 동작, 폰트
build.py                                                        ← content/ 를 읽어 HTML을 만드는 스크립트
```

## 내용을 고치려면

1. `content/` 의 JSON을 고쳐요.
   - `works.json`: 작품 제목(`title_en`, `title_ko`), 연도, 매체, 이미지 크기 목록
   - `bio.json`, `statement.json`: `en`/`ko` 문단 목록
   - `cv.json`: 영어(`en`)와 한국어(`ko`) 섹션별 항목
   - `texts.json`: 전시 글
2. `python3 build.py` 를 실행해요. (설치할 것 없이 Python 3만 있으면 돼요.)
3. 미리보기: `python3 -m http.server 8000` 후 http://localhost:8000
4. 변경된 파일을 커밋하고 푸시해요.

새 작품을 추가할 때는 `assets/works/<slug>/` 에 `01.jpg`, `02.jpg`…와 `cover.jpg`(가로 900px 정도)를 넣고, `content/works.json` 맨 위에 항목을 추가하세요. Claude에게 시켜도 돼요.

## 배포 (GitHub Pages)

1. GitHub 저장소 Settings → Pages → Build and deployment → "Deploy from a branch"로 두고, 배포할 브랜치(`main` 등)와 `/ (root)`를 선택해요.
2. 배포가 끝나면 `https://<계정>.github.io/<저장소>/` 에서 먼저 확인할 수 있어요.

## 도메인 연결 (www.dasulkim.com)

도메인은 Wix에서 유지하고 DNS만 GitHub로 향하게 바꿔요.

1. 저장소 루트에 `CNAME` 파일을 만들고 `www.dasulkim.com` 한 줄을 적어요. (Settings → Pages → Custom domain에 입력해도 자동으로 만들어져요.)
2. Wix 도메인 관리 → DNS 레코드에서 아래처럼 바꿔요.
   - `www` 의 CNAME → `<계정>.github.io`
   - 루트(`@`) 의 A 레코드 4개 → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - 기존 Wix 사이트를 가리키던 A/CNAME 레코드는 지워요.
3. Settings → Pages 에서 "Enforce HTTPS"를 켜요. (DNS 반영까지 몇 분에서 몇 시간 걸려요.)

Wix 요금제를 해지하기 전에 이 사이트가 정상으로 열리는지 먼저 확인하세요.

## 참고

- 이메일 폼은 서버가 없어서 `mailto:`로 동작해요. 보내기를 누르면 방문자의 메일 앱이 열려요.
- 영상은 Wix에 직접 올려둔 2개 작품(허공에서 수영하기, Temple of Flatness)만 파일로 포함돼 있어요. 나머지 작품은 정지 이미지예요.
- 폰트: Pretendard, Geist Mono (둘 다 SIL OFL 1.1, `assets/fonts/LICENSE.txt`).
