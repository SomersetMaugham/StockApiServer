// 팝업 스크립트 업데이트 - 서버 상태 확인 및 제어 기능 추가

document.addEventListener('DOMContentLoaded', function() {
  // 서버 상태 확인
  checkServerStatus();
  
  // 서버 상태 주기적으로 확인 (5초마다)
  setInterval(checkServerStatus, 5000);
  
  // 서버 시작 버튼 이벤트 리스너 추가
  const startServerBtn = document.getElementById('start-server');
  if (startServerBtn) {
    startServerBtn.addEventListener('click', startServer);
  }
  
  // 서버 중지 버튼 이벤트 리스너 추가
  const stopServerBtn = document.getElementById('stop-server');
  if (stopServerBtn) {
    stopServerBtn.addEventListener('click', stopServer);
  }
});

// 서버 상태 확인
function checkServerStatus() {
  chrome.runtime.sendMessage({ action: 'checkServer' }, function(response) {
    updateServerStatus(response.running);
  });
}

// 서버 상태 UI 업데이트
function updateServerStatus(isRunning) {
  const statusElement = document.getElementById('server-status');
  if (statusElement) {
    statusElement.textContent = isRunning ? '실행 중' : '중지됨';
    statusElement.className = isRunning ? 'status-running' : 'status-stopped';
  }
  
  // 버튼 활성화/비활성화
  const startServerBtn = document.getElementById('start-server');
  const stopServerBtn = document.getElementById('stop-server');
  
  if (startServerBtn) {
    startServerBtn.disabled = isRunning;
  }
  
  if (stopServerBtn) {
    stopServerBtn.disabled = !isRunning;
  }
}

// 서버 시작
function startServer() {
  chrome.runtime.sendMessage({ action: 'startServer' }, function(response) {
    console.log(response.message);
    checkServerStatus();
  });
}

// 서버 중지
function stopServer() {
  chrome.runtime.sendMessage({ action: 'stopServer' }, function(response) {
    console.log(response.message);
    checkServerStatus();
  });
}
