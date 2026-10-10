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

## 내용을 고치려면 — 관리 페이지

사이트 주소 끝에 `/admin/`을 붙여서 들어가요. (예: `https://www.dasulkim.com/admin/`) 사이트 어디에도 링크는 없어요.

**할 수 있는 것**: 작품 추가·수정·삭제·순서 바꾸기·이미지 올리기, 사이트 정보(홈 소개, 이메일, 인스타그램, 포트폴리오 링크), Bio, 작가노트, CV(영어/한국어), 글(Texts).

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
