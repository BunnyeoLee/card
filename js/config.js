// ==========================================================
//  미래 명함 만들기 - 설정 파일
//  README.md 의 "Firebase 연결하기" 순서대로 아래 값을 채우세요.
//  firebase 값이 비어 있으면 '체험 모드'(이 브라우저에만 저장)로 동작합니다.
// ==========================================================
export const CONFIG = {
  siteTitle: '미래 명함 만들기',
  programName: '나의 미래 명함 NFC 프로젝트', // 화면 상단에 보이는 프로그램 이름

  // Firebase 콘솔 > 프로젝트 설정 > 내 앱(웹) 에서 복사한 값
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },

  // 관리자(선생님) Google 계정 이메일. firestore.rules 의 목록과 똑같이 맞춰 주세요.
  adminEmails: ['teacher@example.com'],

  // 학생 아이디를 내부적으로 이메일 형태로 바꿀 때 쓰는 주소(바꾸지 않아도 됩니다)
  loginDomain: 'student.futurecard',
};

export const useFirebase = !!(CONFIG.firebase.apiKey && CONFIG.firebase.projectId);
