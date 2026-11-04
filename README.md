# Pop Song Class 🎵

송례중학교 3학년 영어 · 팝송 프로젝트 웹 학습지

| 곡 | 구분 | 학습지 |
|---|---|---|
| 🍂 Some Things Never Change | Pop Song 1 · 겨울왕국 2 | A~I 9단계 |
| 🎄 All I Want for Christmas Is You | Christmas Song · Mariah Carey | A~I 9단계 |
| 🌊 How Far I'll Go | Pop Song 3 · 모아나 | A~I 9단계 |

- **학생 화면** `index.html`: 로그인(학번 + 이름 + 숫자 6자리 비밀번호) → 앨범 보관함(나의 음악 지수) → 학습지
- **선생님 화면** `teacher.html`: Google 계정 로그인 → 학생 현황, 답안 보기, CSV, 가사 입력

> 가사 전문은 저작권 보호를 위해 이 저장소에 넣지 않습니다. 선생님 화면에서 입력하면 Firebase에만 저장되고, 로그인한 학생에게만 보입니다.

---

## Firebase 연결하기 (처음 한 번)

1. <https://console.firebase.google.com> → **프로젝트 추가** (예: `popsong-class`). Google 애널리틱스는 꺼도 됩니다.
2. **Authentication → 시작하기 → 로그인 방법**
   - **이메일/비밀번호** 사용 설정 (학생용)
   - **Google** 사용 설정 (선생님용)
   - **설정 → 승인된 도메인**에 `ywan2026.github.io` 추가
3. **Firestore Database → 데이터베이스 만들기** → 위치 `asia-northeast3 (서울)` → 프로덕션 모드
4. **Firestore → 규칙** 탭에 이 저장소의 `firestore.rules` 내용을 붙여 넣고 **게시**
5. **프로젝트 설정(⚙️) → 내 앱 → 웹 앱 추가(</>)** → 나오는 `firebaseConfig` 값을 `js/firebase-config.js`에 붙여 넣기
6. 커밋하면 GitHub Pages에 반영됩니다. (`firebaseConfig`의 apiKey는 공개되어도 괜찮은 값이고, 데이터는 규칙으로 보호됩니다.)

설정 전(`firebaseConfig = null`)에는 **로컬 모드**로 동작해 그 기기의 브라우저에만 저장됩니다.

## 가사 넣기

`teacher.html` → **가사 입력** → 곡 선택 → 한글 학습지의 가사 표를 복사해 붙여 넣기 → **저장**
오른쪽 미리보기에서 줄 수(학습지와 같아야 함)와 해석 빈칸 연결 수를 확인하세요.

## 데이터 구조 (Firestore)

```
students/{학번}             { sid, name, icon, stats: {곡id: {pct, score, …}}, musicIndex }
students/{학번}/songs/{곡id} { answers: {…} }
lyrics/{곡id}               { text }
```

## 자주 묻는 것

- **비밀번호를 잊은 학생**: Authentication → 사용자에서 `학번@popsong.songrye.school` 삭제 → 학생이 새 비밀번호로 다시 로그인(답안은 유지)
- **음악 지수**: 곡마다 완성도 50 + 정답(B~D) 30 + 감상 쓰기(A·G·H·I) 20 = 100점, 세 곡 평균
- **해석 빈칸·정답 바꾸기**: `js/songs.js`의 `blanks`, `keyB`(인정 답) 수정

## 파일

```
index.html          학생 앱
teacher.html        선생님 화면
css/app.css         macOS 스타일 학습지
css/music.css       로그인·보관함(음악 앱 스타일)·곡별 배경
js/songs.js         곡별 학습지 데이터(어휘·정답·문법·빈칸)
js/worksheet.js     학습지 화면·정답 확인·점수 계산
js/app.js           로그인·보관함·저장
js/teacher.js       선생님 화면
js/store.js         Firebase / 로컬 저장
js/firebase-config.js  Firebase 설정값
firestore.rules     보안 규칙
```

## 수정한 뒤 배포할 때
브라우저 캐시 때문에 예전 파일이 보일 수 있어요. 파일을 고치면 `index.html`, `teacher.html`, `js/*.js`의 `?v=20261104b` 값을 모두 새 값(예: 날짜)으로 바꿔 주세요.
