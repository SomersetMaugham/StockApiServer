// 백엔드 API와 연동하는 대시보드 스크립트 업데이트

// API 연결 테스트
function testApiConnection() {
  const apiUrl = 'http://localhost:5000/status';
  console.log('API 연결 테스트 중...');
  
  fetch(apiUrl)
    .then(response => {
      console.log('API 응답:', response.status);
      return response.text();
    })
    .then(data => {
      console.log('API 응답 데이터:', data);
    })
    .catch(error => {
      console.error('API 연결 실패:', error);
    });
}

document.addEventListener('DOMContentLoaded', function() {
  // URL에서 회사 이름 파라미터 가져오기
  const urlParams = new URLSearchParams(window.location.search);
  const companyName = urlParams.get('company');
  
  if (!companyName) {
    showError('회사 이름이 제공되지 않았습니다.');
    return;
  }

  // 웹사이트 링크 테스트
  const websiteLink = document.getElementById('website-link');
  if (websiteLink) {
    websiteLink.textContent = 'example.com';
    websiteLink.href = 'https://example.com';
    console.log('웹사이트 링크 테스트 설정 완료');
  } else {
    console.error('website-link 요소를 찾을 수 없습니다');
  }

  // 회사 이름 표시
  document.getElementById('company-name').textContent = companyName;
  
  // 로딩 상태 표시
  showLoading();

  // 백엔드 API 호출하여 회사 정보 가져오기
  fetchCompanyInfo(companyName);
  
  // 시간 범위 버튼 이벤트 리스너 설정
  setupTimeRangeButtons();

  document.getElementById('toggle-financial-chart').addEventListener('click', async () => {
    const container = document.getElementById('financial-chart-container');
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
  
    if (container.style.display === 'block') {
      const companyName = document.getElementById('company-name').textContent.trim();
      const apiUrl = `http://localhost:5000/api/financial_trend?name=${encodeURIComponent(companyName)}`;
      const response = await fetch(apiUrl);
      const data = await response.json();
  
      renderFinancialChart(data);
    }
  });
  
});


// 예시 데이터 (Python 백엔드에서 전달받은 데이터로 교체 필요)
let financialChartInstance;

function renderFinancialChart(data) {
  const ctx = document.getElementById('financialChart').getContext('2d');

  if (financialChartInstance) {
    financialChartInstance.destroy();
  }

  // 최신 연도가 오른쪽에 오도록 뒤집기
  const reversedYears = data.years.slice(0, 4).reverse();
  const revenue = data.revenue.slice(0, 4).reverse();
  const operatingProfit = data.operatingProfit.slice(0, 4).reverse();
  const netIncome = data.netIncome.slice(0, 4).reverse();
  const operatingMargin = data.operatingMargin.slice(0, 4).reverse();
  const netMargin = data.netMargin.slice(0, 4).reverse();

  financialChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: reversedYears,
      datasets: [
        {
          label: '매출액',
          data: revenue,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          yAxisID: 'y',
        },
        {
          label: '영업이익',
          data: operatingProfit,
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          yAxisID: 'y',
        },
        {
          label: '순이익',
          data: netIncome,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          yAxisID: 'y',
        },
        {
          label: '영업이익률',
          data: operatingMargin,
          type: 'line',
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'transparent',
          borderWidth: 2,
          yAxisID: 'y1',
          tension: 0.3,
        },
        {
          label: '순이익률',
          data: netMargin,
          type: 'line',
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'transparent',
          borderWidth: 2,
          yAxisID: 'y1',
          tension: 0.3,
        }
      ]
    },
    options: {
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false
      },
      stacked: false,
      plugins: {
        title: {
          display: true,
          text: '최근 4년 재무 요약'
        }
      },
      scales: {
        x: {
          grid: {
            display: false // ❌ X축 격자선 제거
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: '억 원'
          },
          grid: {
            display: false // ❌ Y축 격자선 제거
          },
          ticks: {
            callback: function(value) {
              if (value >= 1e12) return (value / 1e12).toFixed(1) + '조';
              if (value >= 1e8) return (value / 1e8).toFixed(1) + '억';
              return value.toLocaleString();
            }
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: '이익률 (%)'
          },
          ticks: {
            callback: function(value) {
              return value + '%';
            },
            stepSize: 10,
            max: 100,
            min: 0
          },
          grid: {
            drawOnChartArea: false
          }
        }
      }
    }
  });
}

// 로딩 상태 표시
function showLoading() {
  // 각 섹션에 로딩 메시지 추가
  const sections = document.querySelectorAll('section');
  sections.forEach(section => {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-message';
    loadingDiv.textContent = '데이터를 불러오는 중...';
    section.appendChild(loadingDiv);
  });
}

// 로딩 상태 제거
function hideLoading() {
  const loadingMessages = document.querySelectorAll('.loading-message');
  loadingMessages.forEach(msg => msg.remove());
}

// 개선된 오류 표시 함수
function showError(message, useAlert = true) {
  console.error(message);
  
  if (useAlert) {
    alert(`오류: ${message}`);
  } else {
    // 모든 섹션에 오류 메시지 표시
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-message';
      errorDiv.textContent = `오류: ${message}`;
      errorDiv.style.color = 'red';
      errorDiv.style.padding = '10px';
      errorDiv.style.margin = '10px 0';
      section.appendChild(errorDiv);
    });
  }
}

// 백엔드 API에서 회사 정보 가져오기
function fetchCompanyInfo(companyName) {
  const apiUrl = `http://localhost:5000/api/company?name=${encodeURIComponent(companyName)}`;
  
  fetch(apiUrl)
    .then(async response => {
      const responseText = await response.text(); // Read raw text first

      if (!response.ok) {
        // Try to include the response text in the error
        throw new Error(`회사 정보를 가져오는데 실패했습니다. 상태 코드: ${response.status}, 응답: ${responseText}`);
      }

      try {
        // Now, attempt to parse the text
        const data = JSON.parse(responseText);
        console.log('받은 데이터:', data);

        // --- Original success logic ---
        hideLoading();
        window.latestStockData = data.stockData;
        if (!data || !data.stockData) { // Added check here too
           console.error('API 응답에서 필요한 데이터(stockData)가 누락되었습니다.');
           showError('서버에서 유효한 주식 데이터를 받지 못했습니다.', false);
           return;
        }
        displayCompanyInfo(data);
        displayStockChart(data.stockData);
        displayFinancialInfo(data.financialData);
        displayNews(data.newsData);
        // --- End of original success logic ---

      } catch (parseError) {
        console.error('JSON 파싱 오류:', parseError);
        console.error('🚨 서버로부터 받은 텍스트:', responseText); // Log the problematic text
        throw new Error(`서버 응답이 유효한 JSON 형식이 아닙니다. ${parseError.message}`);
      }
    })
    .catch(error => {
      console.error('API 요청 또는 처리 오류:', error); // Catch fetch/parsing errors
      hideLoading();
      showError(error.message, false);
    });

    //console.log("📦 window.latestStockData =", window.latestStockData);

}

// 회사 기본 정보 표시
function displayCompanyInfo(data) {
  // 티커 심볼 및 거래소 정보 표시
  document.getElementById('ticker-symbol').textContent = data.ticker || '-';
  document.getElementById('exchange').textContent = data.exchange || '-';
  // 추가 회사 정보 표시
  // document.getElementById('industry').textContent = '주요제품: ' + (data.industry || '-');
  const industryEl = document.getElementById('industry');
  const tooltip = document.getElementById('tooltip');
  const fullIndustry = data.industry || '-';

  let shortIndustry = fullIndustry;
  if (fullIndustry.length > 30) {
    shortIndustry = fullIndustry.slice(0, 30) + '...';
  }

  industryEl.textContent = '주요제품: ' + shortIndustry;
  industryEl.setAttribute('data-tooltip', fullIndustry);

  // Tooltip logic
  industryEl.addEventListener('mouseenter', function (e) {
    const text = industryEl.getAttribute('data-tooltip');
    tooltip.textContent = text;
    tooltip.hidden = false;
    const rect = industryEl.getBoundingClientRect();
    tooltip.style.left = rect.left + 'px';
    tooltip.style.top = rect.bottom + 5 + 'px';
  });

  industryEl.addEventListener('mouseleave', function () {
    tooltip.hidden = true;
  });

  // document.getElementById('website').textContent = '웹사이트: ' + (data.website || '-');
  const websiteLink = document.getElementById('website-link');
  if (data.website && data.website !== '-') {
    const fullUrl = data.website.startsWith('http') ? data.website : 'https://' + data.website;
    websiteLink.textContent = data.website;
    websiteLink.href = fullUrl;
    websiteLink.target = '_blank'; // 이미 HTML에 있지만, 안전하게 다시 설정
  } else {
    websiteLink.textContent = '-';
    websiteLink.href = '#';
  }

  // document.getElementById('phone').textContent = '전화번호: ' + (data.phone || '-');

  // 현재 가격 및 변동 정보 표시
  const currentPrice = document.getElementById('current-price');
  const priceChange = document.getElementById('price-change');
  const priceChangePercent = document.getElementById('price-change-percent');
  
  if (data.currentPrice) {
    currentPrice.textContent = formatCurrency(data.currentPrice);
    
    if (data.priceChange) {
      priceChange.textContent = formatCurrency(data.priceChange, true);
      priceChangePercent.textContent = `(${formatPercent(data.priceChangePercent)})`;
      
      // 가격 변동에 따른 색상 설정
      const changeClass = data.priceChange > 0 ? 'positive' : (data.priceChange < 0 ? 'negative' : 'neutral');
      priceChange.className = `price-change ${changeClass}`;
      priceChangePercent.className = `price-change-percent ${changeClass}`;
    }
  }
}

// 주식 차트 표시
function displayStockChart(stockData) {
  if (!stockData || !stockData.dates || !stockData.prices) {
    console.error('주식 데이터가 유효하지 않습니다.');
    return;
  }

  const ctx = document.getElementById('stock-chart').getContext('2d');

  const stockChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: stockData.dates,
      datasets: [
        {
          label: '주가',
          data: stockData.prices,
          borderColor: '#1e3a8a',
          backgroundColor: 'rgba(30, 58, 138, 0.1)',
          borderWidth: 2,
          pointRadius: 1,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return `주가: ${formatCurrency(context.raw)}`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          ticks: {
            callback: function(value) {
              return formatCurrency(value, false, true);
            }
          }
        },
        y1: {
          position: 'right',
          grid: { display: false },
          display: false
        }
      }
    }
  });

  window.stockChart = stockChart;
  window.latestStockData = stockData; // 전역에 저장

  // 드롭다운 제거: setupIndicatorDropdown(stockData); 호출 삭제
}

// 기술적 지표 업데이트
function updateChartIndicators(stockData) {
    const indicatorValues = Array.from(document.querySelectorAll('.indicator-checkbox:checked')).map(cb => cb.value);
    const selectedIndicators = new Set();
  
    // 체크된 항목들을 기준으로 요청할 지표 그룹 설정
    if (indicatorValues.includes('ma20')) {
      selectedIndicators.add('ma');
      selectedIndicators.add('ma20');
    }
    if (indicatorValues.includes('ma60')) {
      selectedIndicators.add('ma');
      selectedIndicators.add('ma60');
    }
    if (indicatorValues.includes('bollinger')) {
      selectedIndicators.add('bollinger');
    }
    if (indicatorValues.includes('rsi')) {
      selectedIndicators.add('rsi');
    }
    if (indicatorValues.includes('macd')) {
      selectedIndicators.add('macd');
    }
  
    console.log("📈 updateChartIndicators 호출됨");
  
    fetchTechnicalIndicators(stockData.dates, Array.from(selectedIndicators))
      .then(indicatorData => {
        const chart = window.stockChart;
  
        // 기존 데이터셋 초기화 (주가 제외)
        chart.data.datasets = chart.data.datasets.filter(ds => ds.label === '주가');
  
        // MA20, MA60
        if (selectedIndicators.has('ma')) {
          if (selectedIndicators.has('ma20') && Array.isArray(indicatorData.ma20)) {
            chart.data.datasets.push({
              label: 'MA20',
              data: indicatorData.ma20,
              borderColor: 'orange',
              backgroundColor: 'transparent',
              borderWidth: 1.5,
              pointRadius: 0,
              fill: false,
              yAxisID: 'y'
            });
          }
  
          if (selectedIndicators.has('ma60') && Array.isArray(indicatorData.ma60)) {
            chart.data.datasets.push({
              label: 'MA60',
              data: indicatorData.ma60,
              borderColor: 'blue',
              backgroundColor: 'transparent',
              borderWidth: 1.5,
              pointRadius: 0,
              fill: false,
              yAxisID: 'y'
            });
          }
        }
  
        // Bollinger Bands
        if (selectedIndicators.has('bollinger')) {
          if (Array.isArray(indicatorData.bollingerUpper)) {
            chart.data.datasets.push({
              label: '볼린저 상단',
              data: indicatorData.bollingerUpper,
              borderColor: 'rgba(255, 99, 132, 0.7)',
              backgroundColor: 'transparent',
              borderWidth: 1,
              pointRadius: 0,
              fill: false,
              yAxisID: 'y'
            });
          }
  
          if (Array.isArray(indicatorData.bollingerLower)) {
            chart.data.datasets.push({
              label: '볼린저 하단',
              data: indicatorData.bollingerLower,
              borderColor: 'rgba(54, 162, 235, 0.7)',
              backgroundColor: 'transparent',
              borderWidth: 1,
              pointRadius: 0,
              fill: false,
              yAxisID: 'y'
            });
          }
        }
  
        chart.update();
      })
      .catch(error => {
        console.error("기술적 지표 데이터를 가져오는데 실패했습니다:", error);
      });
  }
  

// 기술적 지표 데이터 요청 함수
function fetchTechnicalIndicators(dates, indicators) {
  const nameElement = document.getElementById('company-name');  // ✅ 정확한 ID로 수정
  const companyName = nameElement ? nameElement.textContent.trim() : '';

  if (!companyName) {
    console.error('❌ 회사 이름을 찾을 수 없습니다. company-name 요소를 확인하세요.');
    return Promise.reject('회사 이름이 존재하지 않음');
  }

  const apiUrl = `http://localhost:5000/api/company?name=${encodeURIComponent(companyName)}&indicators=${indicators.join(',')}`;

  return fetch(apiUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error('기술적 지표 API 요청 실패');
      }
      return response.json();
    })
    .then(data => {
      const indicatorData = data.technicalData;

      if (!indicatorData) {
        throw new Error('기술적 지표가 응답에 포함되지 않았습니다.');
      }

      return indicatorData;
    });
}


// 기술적 지표 데이터 요청 함수
// function fetchTechnicalIndicators(dates, indicators) {
//   // 회사 이름 가져오기
//   const companyName = document.getElementById('company-name').textContent;
  
//   // API 요청 URL 구성
//   //const apiUrl = `http://localhost:5000/api/technical?name=${encodeURIComponent(companyName)}&indicators=${indicators.join(',')}`;
//   const apiUrl = `http://localhost:5000/api/company?name=${encodeURIComponent(companyName)}&indicators=${indicators.join(',')}`;  
//   return fetch(apiUrl)
//     .then(response => {
//       if (!response.ok) {
//         throw new Error('기술적 지표 데이터를 가져오는데 실패했습니다.');
//       }
//       return response.json();
//     })
//     .then(data => {
//       return data.technicalData;
//     });
// }


// 재무 정보 표시
function displayFinancialInfo(financialData) {
  if (!financialData) {
    console.error('재무 데이터가 유효하지 않습니다.');
    return;
  }

  // 시가총액
  if (financialData.marketCap) {
    document.getElementById('market-cap').textContent = formatCurrency(financialData.marketCap, false, true);
  }
  
  // 매출액
  if (financialData.revenue) {
    document.getElementById('revenue').textContent = formatCurrency(financialData.revenue, false, true);
    
    if (financialData.revenueGrowth) {
      const revenueGrowth = document.getElementById('revenue-growth');
      revenueGrowth.textContent = formatPercent(financialData.revenueGrowth);
      revenueGrowth.className = `growth-rate ${getValueClass(financialData.revenueGrowth)}`;
    }
  }
  
  // 영업이익
  if (financialData.operatingProfit) {
    document.getElementById('operating-profit').textContent = formatCurrency(financialData.operatingProfit, false, true);
    
    if (financialData.operatingMargin) {
      const operatingMargin = document.getElementById('operating-margin');
      operatingMargin.textContent = formatPercent(financialData.operatingMargin);
      operatingMargin.className = `ratio ${getValueClass(financialData.operatingMargin)}`;
    }
  }
  
  // 순이익
  if (financialData.netIncome) {
    document.getElementById('net-income').textContent = formatCurrency(financialData.netIncome, false, true);
    
    if (financialData.netMargin) {
      const netMargin = document.getElementById('net-margin');
      netMargin.textContent = formatPercent(financialData.netMargin);
      netMargin.className = `ratio ${getValueClass(financialData.netMargin)}`;
    }
  }
  
  // PER
  if (financialData.per) {
    document.getElementById('per').textContent = financialData.per.toFixed(2);
    
    if (financialData.perIndustry) {
      const perIndustry = document.getElementById('per-industry');
      perIndustry.textContent = `업종 평균: ${financialData.perIndustry.toFixed(2)}`;
    }
  }
  
  // 배당수익률
  if (financialData.dividendYield !== undefined && financialData.dividendYield !== null) {
    document.getElementById('dividend-yield').textContent = formatPercent(financialData.dividendYield);
  }
}

// 뉴스 표시
function displayNews(newsData) {
  const newsContainer = document.getElementById('news-container');
  
  // 로딩 메시지 제거
  newsContainer.innerHTML = '';
  
  if (!newsData || newsData.length === 0) {
    newsContainer.innerHTML = '<div class="no-news">관련 뉴스가 없습니다.</div>';
    return;
  }
  
  newsData.forEach(news => {
    if (!news.title || !news.url) {
      console.warn('잘못된 뉴스 데이터:', news);
      return;
    }
  
    const newsItem = document.createElement('div');
    newsItem.className = 'news-item';
  
    // 메타정보: 언론사 + 날짜
    const newsMeta = document.createElement('div');
    newsMeta.className = 'news-meta';
  
    const newsPress = document.createElement('div');
    newsPress.className = 'news-press';
    newsPress.textContent = news.press || '언론사 정보 없음';
  
    const newsDate = document.createElement('div');
    newsDate.className = 'news-date';
    newsDate.textContent = news.date || '날짜 정보 없음';
  
    newsMeta.appendChild(newsPress);
    newsMeta.appendChild(newsDate);
  
    // 뉴스 제목
    const newsTitle = document.createElement('div');
    newsTitle.className = 'news-title';
    const newsLink = document.createElement('a');
    newsLink.href = news.url;
    newsLink.target = '_blank';
    newsLink.textContent = news.title;
    newsTitle.appendChild(newsLink);
  
    // 조립: 왼쪽 메타, 오른쪽 제목
    newsItem.appendChild(newsMeta);
    newsItem.appendChild(newsTitle);
  
    // 뉴스 요약
    if (news.summary) {
      const newsSummary = document.createElement('div');
      newsSummary.className = 'news-summary';
      newsSummary.textContent = news.summary;
      newsItem.appendChild(newsSummary);
    }
  
    // 감성 분석
    if (news.sentiment) {
      const newsSentiment = document.createElement('div');
      newsSentiment.className = `news-sentiment ${news.sentiment}`;
  
      let sentimentText = '중립';
      if (news.sentiment === 'positive') sentimentText = '긍정';
      else if (news.sentiment === 'negative') sentimentText = '부정';
  
      newsSentiment.textContent = sentimentText;
      newsItem.appendChild(newsSentiment);
    }
  
    newsContainer.appendChild(newsItem);
  });
  
}

// 추가 뉴스 가져오기 (새 함수)
function fetchMoreNews(companyName, page = 2) {
  const apiUrl = `http://localhost:5000/api/news?name=${encodeURIComponent(companyName)}&page=${page}`;
  
  fetch(apiUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error('추가 뉴스를 가져오는데 실패했습니다.');
      }
      return response.json();
    })
    .then(data => {
      // 기존 뉴스 목록에 추가
      appendNews(data.newsData);
    })
    .catch(error => {
      showError(error.message);
    });
}

// 뉴스 추가 (새 함수)
function appendNews(newsData) {
  // 기존 더 보기 버튼 제거
  const loadMoreButton = document.querySelector('.load-more-news');
  if (loadMoreButton) {
    loadMoreButton.remove();
  }
  
  // 새 뉴스 추가
  displayNews([...document.querySelectorAll('.news-item'), ...newsData]);
}

// 시간 범위 버튼 설정
function setupTimeRangeButtons() {
  const timeRangeButtons = document.querySelectorAll('.time-range');
  
  timeRangeButtons.forEach(button => {
    button.addEventListener('click', function() {
      // 활성 버튼 클래스 제거
      timeRangeButtons.forEach(btn => btn.classList.remove('active'));
      
      // 현재 버튼 활성화
      this.classList.add('active');
      
      // 선택된 시간 범위 가져오기
      const range = this.getAttribute('data-range');
      
      // 회사 이름 가져오기
      const companyName = document.getElementById('company-name').textContent;
      
      // 해당 시간 범위의 데이터 가져오기
      fetchStockDataByRange(companyName, range);
    });
  });
  
  // 기본값으로 1년 버튼 활성화
  const defaultButton = document.querySelector('[data-range="1y"]');
  if (defaultButton) {
    defaultButton.classList.add('active');
  }
}

// 시간 범위별 주식 데이터 가져오기
function fetchStockDataByRange(companyName, range) {
  const apiUrl = `http://localhost:5000/api/stock?name=${encodeURIComponent(companyName)}&range=${range}`;
  
  fetch(apiUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error('주식 데이터를 가져오는데 실패했습니다.');
      }
      return response.json();
    })
    .then(data => {
      // 차트 업데이트
      updateStockChart(data.stockData);
      
      // 선택된 지표 다시 적용
      const indicatorSelect = document.getElementById('indicator-select');
      if (indicatorSelect && indicatorSelect.selectedOptions.length > 0) {
        updateChartIndicators(data.stockData);
      }
    })
    .catch(error => {
      showError(error.message);
    });
}

// 주식 차트 업데이트
function updateStockChart(stockData) {
  if (!window.stockChart || !stockData || !stockData.dates || !stockData.prices) {
    console.error('차트 업데이트에 필요한 데이터가 유효하지 않습니다.');
    return;
  }
  
  window.stockChart.data.labels = stockData.dates;
  window.stockChart.data.datasets[0].data = stockData.prices;
  window.stockChart.update();
}

// 에러 메시지 표시
function showError(message) {
  console.error(message);
  alert(`오류: ${message}`);
}

// 통화 형식 포맷팅
function formatCurrency(value, showSign = false, abbreviate = false) {
  if (value === undefined || value === null) return '-';
  
  let absValue = Math.abs(value);
  let suffix = '';
  
  if (abbreviate) {
    if (absValue >= 1000000000000) {
      absValue = absValue / 1000000000000;
      suffix = '조';
    } else if (absValue >= 100000000) {
      absValue = absValue / 100000000;
      suffix = '억';
    } else if (absValue >= 10000) {
      absValue = absValue / 10000;
      suffix = '만';
    }
  }
  
  const formatted = absValue.toLocaleString('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  
  const sign = showSign ? (value < 0 ? '-' : '+') : (value < 0 ? '-' : '');
  
  return `${sign}${formatted}${suffix}`;
}

// 퍼센트 형식 포맷팅
function formatPercent(value) {
  if (value === undefined || value === null) return '-';
  
  const sign = value < 0 ? '-' : '+';
  const formatted = Math.abs(value).toFixed(2);
  
  return `${sign}${formatted}%`;
}

// 값에 따른 클래스 반환 (양수: positive, 음수: negative, 0: neutral)
function getValueClass(value) {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'neutral';
}

// dashboard.js 가장 마지막 부분에 아래 코드 추가하세요
document.querySelectorAll('.indicator-checkbox').forEach(cb => {
  cb.addEventListener('change', () => {
    console.log("✅ 체크박스 변경됨:", cb.value);

    if (window.latestStockData) {
      // console.log("📈 updateChartIndicators 호출됨");
      updateChartIndicators(window.latestStockData);
    } else {
      console.warn("⚠️ window.latestStockData가 아직 없음");
    }
  });
});
