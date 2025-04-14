// background.js - 크롬 익스텐션 백그라운드 스크립트

// 서버 설정
const SERVER_URL = 'http://localhost:5000'; // Python 백엔드 서버 주소
let serverRunning = false;

// 서버 상태 확인 함수
async function checkServerStatus() {
  try {
    const response = await fetch(`${SERVER_URL}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      // 서버 요청 타임아웃 설정
      signal: AbortSignal.timeout(2000)
    });
    
    if (response.ok) {
      serverRunning = true;
      return true;
    } else {
      serverRunning = false;
      return false;
    }
  } catch (error) {
    console.error('서버 상태 확인 오류:', error);
    serverRunning = false;
    return false;
  }
}

// 주기적으로 서버 상태 확인 (30초마다)
function startServerStatusCheck() {
  checkServerStatus();
  setInterval(checkServerStatus, 30000);
}

// 익스텐션이 설치되거나 업데이트될 때 실행
chrome.runtime.onInstalled.addListener(async () => {
  // 컨텍스트 메뉴 생성
  chrome.contextMenus.create({
    id: "checkCompanyInfo",
    title: "How is going %s",
    contexts: ["selection"]
  });
  
  // 초기 서버 상태 확인
  await checkServerStatus();
  startServerStatusCheck();
});

// Service Worker가 활성화될 때마다 서버 상태 확인
chrome.runtime.onStartup.addListener(() => {
  startServerStatusCheck();
});

// 메시지 리스너 (팝업에서 서버 상태 요청을 처리)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkServer') {
    // 서버 상태를 즉시 확인하고 응답
    checkServerStatus().then(isRunning => {
      sendResponse({ running: isRunning });
    });
    return true; // 비동기 응답을 위해 true 반환
  }
  
  // 서버 관련 안내 메시지 응답
  if (message.action === 'startServer') {
    sendResponse({ 
      success: false, 
      message: '서버는 별도로 실행해야 합니다. 먼저 백엔드 서버를 수동으로 시작해 주세요.',
      serverUrl: SERVER_URL
    });
  } else if (message.action === 'stopServer') {
    sendResponse({ 
      success: false, 
      message: '서버는 별도로 종료해야 합니다. 백엔드 서버를 수동으로 종료해 주세요.',
      serverUrl: SERVER_URL
    });
  }
  
  return true; // 비동기 응답을 위해 true 반환
});

// 컨텍스트 메뉴 클릭 이벤트 처리
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "checkCompanyInfo") {
    const companyName = info.selectionText;
    
    // 서버 상태 확인
    const isServerRunning = await checkServerStatus();
    
    if (!isServerRunning) {
      // 서버가 실행 중이 아니면 알림 표시
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png', // 익스텐션 아이콘 경로로 변경 필요
        title: '서버 연결 오류',
        message: '백엔드 서버가 실행되고 있지 않습니다. 서버를 먼저 시작해 주세요.'
      });
      
      // 서버 시작 안내 페이지 열기
      chrome.tabs.create({
        url: 'server_guide.html' // 서버 시작 방법을 안내하는 페이지 (별도 생성 필요)
      });
    } else {
      // 서버가 실행 중이면 대시보드 페이지 열기
      chrome.tabs.create({
        url: `dashboard.html?company=${encodeURIComponent(companyName)}`
      });
    }
  }
});

// 익스텐션 아이콘 클릭 이벤트 처리
chrome.action.onClicked.addListener((tab) => {
  // 서버 상태에 관계없이 팝업이나 대시보드 페이지 열기
  chrome.tabs.create({
    url: 'popup.html'
  });
});