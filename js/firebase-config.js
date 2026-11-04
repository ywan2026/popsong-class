/* =====================================================================
   Firebase 설정 — README의 'Firebase 연결하기' 순서대로 값을 채워 넣으세요.
   firebaseConfig가 null이면 Firebase 없이 이 기기에만 저장하는 '로컬 모드'로 동작합니다.
   ===================================================================== */
export const firebaseConfig = null;
/* 예시)
export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "popsong-class.firebaseapp.com",
  projectId: "popsong-class",
  storageBucket: "popsong-class.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
*/

/* 선생님 화면에 로그인할 수 있는 Google 계정 (firestore.rules에도 같은 주소를 넣어야 합니다) */
export const TEACHER_EMAILS = ["dydnjsl2022@gmail.com"];

/* 학생 계정용 내부 이메일 주소 형식 (바꾸면 기존 학생 계정을 쓸 수 없으니 그대로 두세요) */
export const STUDENT_EMAIL_DOMAIN = "popsong.songrye.school";
