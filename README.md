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
content/pages.json                                              ← 메뉴 순서·이름, 직접 만든 페이지
assets/favicon*.png/.ico, assets/og.jpg                         ← 파비콘, 공유 미리보기 이미지 (관리 페이지에서 올려요)
build.py                                                        ← content/ 를 읽어 HTML을 만드는 스크립트
```

## 내용을 고치려면 — 관리 페이지

사이트 주소 끝에 `/admin/`을 붙여서 들어가요. (예: `https://www.dasulkim.com/admin/`) 사이트 어디에도 링크는 없어요.

**할 수 있는 것**: 작품 추가·수정·삭제·순서 바꾸기·이미지 올리기, 메뉴·페이지 관리(이름·순서·숨기기, 새 페이지 추가/삭제, 비밀번호 잠금), 파비콘과 공유 미리보기 이미지, 검색·홍보 설정, 방문 통계, 사이트 정보(홈 소개, 이메일, 인스타그램, 포트폴리오 링크), Bio, 작가노트, CV(영어/한국어), 글(Texts).

**처음 한 번만 (토큰 만들기)**
1. https://github.com/settings/personal-access-tokens/new 를 열어요.
2. Token name: 아무 이름 (예: site-admin) / Expiration: 원하는 기간
3. Repository access → "Only select repositories" → `claude3`
4. Permissions → Repository permissions → **Contents: Read and write**
5. Generate token을 누르고, 나온 토큰(`github_pat_…`)을 복사해요.
6. `/admin/` 화면에 토큰을 붙여넣고, 이 기기에서 쓸 **비밀번호**를 정해요(8자 이상).
   토큰은 비밀번호로 암호화되어 이 브라우저에만 저장돼요. 다음부터는 비밀번호만 입력하면 돼요.
   다른 기기에서는 토큰을 한 번 더 붙여넣어야 해요.

**고치고 게시하기**: 왼쪽 메뉴에서 고르고, 고친 뒤 위쪽의 **게시하기**를 눌러요. 모든 변경이 한 번에 GitHub에 저장되고, GitHub Actions가 페이지를 새로 만들어요. "완성됐어요!" 메시지가 뜨고 1~2분 뒤 사이트에 반영돼요. 잘못 고쳤다면 게시하기 전에는 "변경 버리기"로 되돌릴 수 있고, 게시한 뒤에는 GitHub의 커밋 기록에서 되돌릴 수 있어요.

**문제가 생기면**
- "토큰이 올바르지 않거나 만료됐어요" → 토큰을 새로 만들어요. (잠금 화면의 "이 기기에서 토큰 지우기" 후 다시 등록)
- "권한이 부족해요" → 토큰의 Contents 권한이 "Read and write"인지 확인해요.
- 저장은 됐는데 사이트가 안 바뀜 → 저장소의 Actions 탭에서 "Rebuild site" 실행이 성공했는지 확인해요. 실패했다면 로그를 보여주면 원인을 알 수 있어요.
- 브랜치를 `main`으로 옮겼다면 `assets/admin/config.json`의 `branch`와 `.github/workflows/build.yml`의 `branches`를 같이 바꿔요.

**저장소의 파일을 직접 고치고 싶다면**: `content/*.json`을 고치고 `python3 build.py`를 실행해요. (Python 3만 있으면 돼요.) 미리보기는 `python3 -m http.server 8000` 후 http://localhost:8000.

내용(`content/`)이 바뀌면 `.github/workflows/build.yml`이 자동으로 `build.py`를 실행해서 페이지를 다시 만들어요.

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

- 영상은 Wix에 직접 올려둔 2개 작품(허공에서 수영하기, Temple of Flatness)만 파일로 포함돼 있어요. 나머지 작품은 정지 이미지예요.
- 폰트: Pretendard, Geist Mono (둘 다 SIL OFL 1.1, `assets/fonts/LICENSE.txt`).
- 십자선 커서(마우스 전용)는 `assets/css/cursor.css`와 `assets/js/cursor.js`로 분리돼 있어요. 끄려면 `build.py`에서 이 두 파일을 불러오는 줄(`cursor.css`, `cursor.js`)을 지우고 `python3 build.py`를 다시 실행하세요. 터치 기기에서는 원래도 나타나지 않아요.
- 레트로 스크롤바(데스크톱 3열 전용)는 `assets/css/scrollbar.css`와 `assets/js/scrollbar.js`로 분리돼 있어요. 끄려면 `build.py`에서 이 두 파일을 불러오는 줄을 지우고 `python3 build.py`를 다시 실행하세요. 모바일에서는 원래 스크롤바를 그대로 써요.
- **포트폴리오 PDF**는 사이트에 파일을 두지 않고 링크만 연결해요. 관리 페이지의 "사이트 정보 → 포트폴리오 PDF 주소"(또는 `content/site.json`의 `portfolio`)에 PDF의 전체 주소를 넣으면 홈 오른쪽과 이력 페이지의 "Portfolio PDF" 링크가 새 창에서 그 주소를 열어요. 주소를 비우면 링크가 사라져요.
- 다크/라이트 전환: 왼쪽 위의 해/달 아이콘이에요. 선택은 브라우저에 기억돼요(처음 방문은 항상 라이트). 색은 `assets/css/style.css`의 `html[data-theme="dark"]` 줄에서 바꿔요.

## 메뉴·페이지, 파비콘, 공유 미리보기

- **메뉴·페이지** (관리 페이지 → 메뉴·페이지): 왼쪽 메뉴의 순서(↑↓)와 이름(영어/한국어)을 바꾸고, 새 페이지를 만들거나 지울 수 있어요. 페이지마다 공개 방식을 고를 수 있어요.
  - **메뉴에 표시하고 공개**: 메뉴에 나오고 누구나 볼 수 있어요.
  - **공개하되 메뉴에는 넣지 않기**: 게시는 되지만 메뉴에 안 나와요. 주소를 아는 사람만 들어올 수 있고, 검색엔진(`noindex`)과 사이트맵에서도 빠져요.
  - **비공개(임시저장)**: 사이트에 만들어지지 않아요. 글만 저장해 두었다가 나중에 공개해요.
  - 기본 페이지(소개·작가노트·작업·이력·글·연락)는 지울 수 없고, 이름 바꾸기와 메뉴에서 숨기기만 돼요. 새 페이지는 글 중심(소제목은 `## `, 링크는 `[글자](https://…)`)이고 영어/한국어 본문을 따로 써요. 주소(`/press/` 같은 것)는 만들 때 한 번 정하면 바꿀 수 없어요.
  - **비밀번호 잠금**: 켜면 본문이 브라우저에서 암호화(AES-GCM)되어 저장돼요. 방문자는 비밀번호를 입력해야 읽을 수 있고, 저장소에도 암호문만 있어요. 이름(제목)·주소는 보여요. 비밀번호는 복구할 수 없어요(잊으면 내용을 지우고 다시 써야 해요). 정적 사이트라서 비밀번호가 짧거나 쉬우면 여러 번 시도해서 풀릴 수 있으니 길게 정하세요.
  - `content/pages.json`에 저장돼요. 직접 고친다면 `type`은 `builtin`/`custom`, `status`는 `menu`/`hidden`/`draft`예요.
- **파비콘·미리보기** (관리 페이지 → 파비콘·미리보기):
  - 파비콘: 이미지 한 장을 올리면 `assets/favicon.ico`, `favicon-32.png`, `favicon-192.png`, `apple-touch-icon.png`를 자동으로 만들어요. 제거하면 네 파일이 모두 지워져요.
  - 미리보기 이미지: 카카오톡·X·슬랙 등에 주소를 공유할 때 나오는 큰 이미지예요. 1200×630(`assets/og.jpg`)으로 맞춰서 저장해요. 작품 페이지는 그 작품의 대표 이미지가 나와요. 제거하면 사진 없이 글자만 나와요.
  - 미리보기 이미지는 `https://…` 전체 주소로 불러가야 해서 `content/site.json`의 `site_url`(비우면 `https://www.dasulkim.com`)을 기준으로 해요. 도메인을 옮기기 전에는 www.dasulkim.com이 아직 Wix를 가리키므로 미리보기가 안 보여요. 시험하려면 `site_url`을 `https://nikkikim.github.io/claude3` 으로 잠깐 바꿔보세요. 이미 공유된 링크는 서비스가 예전 미리보기를 기억할 수 있어요.
- **모바일 스크롤 효과**("신호 → 글자")는 `assets/css/mobile-fx.css`와 `assets/js/mobile-fx.js`로 분리돼 있어요. 글 문단이 화면 아래에서 올라올 때 `0 1 ▒ ░` 같은 기호로 보이다가 앞에서부터 글자로 바뀌어요. 폭 960px 미만에서만 동작하고, 기기에서 "동작 줄이기"를 켜면 꺼져요. 끄려면 `build.py`에서 `mobile-fx.css`, `mobile-fx.js`를 불러오는 줄을 지우고 `python3 build.py`를 다시 실행하세요.

## 검색·홍보, 방문 통계

- **검색·홍보** (관리 페이지 → 검색·홍보): 검색 결과에 나오는 제목·설명, 키워드(영어/한국어), 프로필 연결(`sameAs`), 구글·네이버·빙 인증 코드, 홍보 링크(UTM 꼬리표) 만들기, 홍보 아이디어 목록. 값은 `content/site.json`(`seo_title_en/ko`, `seo_desc_en`, `keywords_en/ko`, `same_as`, `google_verify`, `naver_verify`, `bing_verify`)에 저장되고, 빌드할 때 `<title>`, `<meta name="description">`, `<meta name="keywords">`, 검색엔진용 구조화 데이터(JSON-LD, 홈), 인증 `<meta>`로 들어가요. 구글은 키워드 태그를 순위에 직접 쓰지 않으니, 실제 효과는 제목·설명·본문 글과 다른 사이트에서 받는 링크가 좌우해요.
- **방문 통계**: [GoatCounter](https://www.goatcounter.com)(쿠키 없음, 개인·비영리 무료)를 써요. 가입 후 정한 코드를 "방문 통계" 화면에 적고 게시하면 모든 페이지(관리 페이지 제외)에 집계 코드가 들어가요(`site.json`의 `goatcounter`). 방문자 수, 날짜·시간대별 방문, 접근 경로, 국가, 화면 크기·운영체제·브라우저, 언어, 홍보 링크(캠페인)를 볼 수 있어요.
  - 관리 화면 안에서 보려면 GoatCounter → Settings → API에서 "Read statistics" 권한 토큰을 만들어 붙여넣어요. 토큰은 관리 비밀번호로 암호화해서 이 브라우저에만 저장돼요. (연결이 안 되면 "대시보드 열기"로 GoatCounter에서 직접 보세요.)
  - GoatCounter → Settings → Timezone을 Asia/Seoul로 맞추면 시간대별 방문이 한국 시간으로 나와요.
  - "이 기기의 내 방문은 집계하지 않기"로 내 방문을 뺄 수 있어요(브라우저마다 따로).
- **모바일 읽기 표시줄**: 폭 960px 미만에서는 레트로 스크롤바가 화면 위에 가로로 나타나 읽은 위치를 보여줘요(◆ 끌기, 양 끝 칸은 맨 위/맨 아래, 화살표는 한 화면씩). `assets/js/scrollbar.js`의 `.sbh` 블록과 `assets/css/scrollbar.css`의 `.sbh` 블록을 지우면 사라져요.
- **모바일 메뉴 버튼**: 폭 960px 미만에서는 이름 옆의 점 9개(도시락) 버튼을 누르면 페이지 어느 위치에서든 메뉴가 펼쳐져요. 메뉴는 "메뉴·페이지" 설정을 그대로 따라가요. 지우려면 `build.py`의 `bento` 버튼·`bento-panel`과 `style.css`/`site.js`의 bento 블록을 지우세요.
