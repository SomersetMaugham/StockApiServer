from flask import Flask, request, jsonify
from flask_cors import CORS
import yfinance as yf
import pandas as pd
# 문제가 있는 pandas_ta 대신 직접 필요한 기능만 구현
import numpy as np
import requests
from bs4 import BeautifulSoup
import json
import re
import sys
import os
import urllib.parse
import random
import time
import sqlite3
import math
import jellyfish
from datetime import datetime, timedelta

# Flask 애플리케이션 생성
app = Flask(__name__)
CORS(app) 

# User-Agent 리스트 (더 많은 User-Agent를 추가할 수 있습니다)
user_agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
]

def create_db_if_not_exists(csv_path, db_path="stock_info.db"):
    if os.path.exists(db_path):
        print(f"✅ DB already exists: {db_path} — no action taken.")
        return

    # CSV 파일을 읽음
    df = pd.read_csv(csv_path, encoding='utf-8-sig')
    df = df.drop_duplicates(subset=["종목코드"])
    # SQLite 연결 및 DB 생성
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 명시적 테이블 생성 (스키마 정의)
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS companies (
        회사명 TEXT NOT NULL,
        종목코드 TEXT NOT NULL PRIMARY KEY,
        티커 TEXT,
        시장구분 TEXT,
        업종 TEXT,
        주요제품 TEXT,
        상장일 TEXT,
        결산월 TEXT,
        대표자 TEXT,
        홈페이지 TEXT,
        주소지 TEXT,
        alias TEXT
    );
    """
    cursor.execute(create_table_sql)
    conn.commit()

    # 데이터 삽입
    df.to_sql("companies", conn, if_exists="append", index=False)

    # 마무리
    conn.close()
    print(f"✅ DB created and data loaded from {csv_path}.")

def normalize_name(name):
    return (
        name.strip()         # 양쪽 공백 제거
            .replace(" ", "") # 중간 공백 제거 (선택사항)
            .lower()         # 소문자로 통일
    )

def suggest_similar_names(company_name):
    norm_input = normalize_name(company_name)
    conn = sqlite3.connect("stock_info.db")
    df = pd.read_sql_query("SELECT 회사명 FROM companies", conn)
    conn.close()

    # 후보 목록 정규화 비교
    df["정규화"] = df["회사명"].apply(normalize_name)
    matches = df[df["정규화"].str.contains(norm_input[:2])]
    return matches["회사명"].tolist()

def standardize_website_url(url):
    """
    Standardizes a website URL to ensure it starts with 'http://' and has no trailing slash.

    Args:
        url: The website URL to standardize.

    Returns:
        The standardized website URL, or None if the URL is invalid.
    """
    if not url:
        return None

    # Remove trailing slash
    url = url.rstrip('/')

    # Add 'http://' if it's missing
    if not url.startswith('http://') and not url.startswith('https://'):
        url = 'http://' + url

    return url

# 기술적 지표 계산 함수들
def calculate_rsi(close_prices, period=14):
    """RSI(Relative Strength Index) 계산"""
    delta = close_prices.diff()
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)
    
    avg_gain = gain.rolling(window=period).mean()
    avg_loss = loss.rolling(window=period).mean()
    
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    
    return rsi

def calculate_macd(close_prices, fast=12, slow=26, signal=9):
    """MACD(Moving Average Convergence Divergence) 계산"""
    ema_fast = close_prices.ewm(span=fast, adjust=False).mean()
    ema_slow = close_prices.ewm(span=slow, adjust=False).mean()
    
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    
    return macd_line, signal_line

def calculate_bollinger_bands(close_prices, period=20, std_dev=2):
    """볼린저 밴드 계산"""
    sma = close_prices.rolling(window=period).mean()
    std = close_prices.rolling(window=period).std()
    
    upper_band = sma + (std * std_dev)
    lower_band = sma - (std * std_dev)
    
    return upper_band, lower_band

# 한국 상장회사 이름을 티커 심볼로 변환하는 함수
# def get_ticker_from_company_name(company_name):
    # 캐시에 있는지 확인
    clean_name = company_name.strip()
    if company_name in company_ticker_map:
        cached = company_ticker_map[company_name]
        return {
            'ticker': cached.get('ticker'),
            'industry': cached.get('industry'),
            'website': cached.get('website'),
            'phone': cached.get('phone')
        }
    
    try:
        search_url = "https://seibro.or.kr/IPORTAL/jsp/konanSearch/search1.jsp?category=TOTAL&kwd={company_name}"
        print("search_url:", search_url)
        # 디버깅 정보
        
        # User-Agent 랜덤 선택
        headers = {
            "User-Agent": random.choice(user_agents),
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
        }

        response = requests.get(search_url, headers=headers)
        response.raise_for_status()  # HTTP 에러 발생 시 예외 발생
        print("response.text:", response.text)

        soup = BeautifulSoup(response.text, 'html.parser')

        # id가 "h3_tit_01"인 <h3> 태그 찾기
        h3_tag = soup.find('h3', id='h3_tit_01')
        
        print("h3_tag:", h3_tag)
        if h3_tag:
            # 텍스트 내용 추출
            text = h3_tag.text.strip()

            # 정규 표현식을 사용하여 종목 코드 추출
            match = re.search(r'\((\d+)\)', text)
            if match:
                stock_code = match.group(1)
                print(f"종목 코드: {stock_code}")
                
                # 'response.text'에서 '코스피' 또는 '코스닥' 검색
                if '코스피' in response.text:
                    ticker = f"{stock_code}.KS"
                elif '코스닥' in response.text:
                    ticker = f"{stock_code}.KQ"
                else:
                    ticker = f"{stock_code}.KS" # 기본적으로 코스피로 가정
            else:
                print("종목 코드를 찾을 수 없습니다.")
                return None
        else:
            print("해당하는 <h3> 태그를 찾을 수 없습니다.")

        # 1. 업종 추출
        industry_tag = soup.find('dd', id='item_add_info_left_03_dd')
        # print("industry_tag:", industry_tag)
        if industry_tag:
            industry_text = industry_tag.text.strip()
            # ">"로 분리하여 마지막 요소 추출
            industry_parts = industry_text.split(">")
            industry = industry_parts[-1].strip()
            print(f"업종: {industry}")
        else:
            print("업종 정보를 찾을 수 없습니다.")

        # 2. 웹사이트 정보 추출
        website_tag = soup.find('p', id='item_add_right')
        # print("website_tag:", website_tag)
        if website_tag:
            website = website_tag.text.strip()
            website = standardize_website_url(website)
            # print(f"웹사이트 정보: {website}")
        else:
            print("웹사이트 정보를 찾을 수 없습니다.")

        # 3. 전화번호 추출
        phone_tag = soup.find('dd', id='item_add_info_right_02_Dd')
        # print("phone_tag:", sphone_tag)
        if phone_tag:
            phone = phone_tag.text.strip()
            print(f"전화번호: {phone}")
        else:
            print("전화번호를 찾을 수 없습니다.")

        # company_ticker_map[company_name] = {
        #     'ticker': ticker,
        #     'industry': industry,
        #     'website': website,
        #     'phone': phone
        # }
        
        # synchronize with json file
        save_company_to_cache(company_name, ticker, industry, website, phone)

        return {
            'ticker':ticker,
            'industry':industry,
            'website':website,
            'phone':phone
        }

    except Exception as e:
        print(f"Error finding ticker for {company_name}: {e}")
        return {
            "ticker": None,
            "website": "_",
            "industry": "_",
            "phone": "_"
        }
    
def get_ticker_from_company_name(company_name, min_similarity=0.90):
    
    norm_input = normalize_name(company_name)
    # DB 연결
    conn = sqlite3.connect("stock_info.db")  # 실제 DB 경로에 맞게 수정
    cursor = conn.cursor()

    # SQL 쿼리 실행
    query = """
    SELECT 티커, 주요제품, 홈페이지
    FROM companies
    WHERE lower(replace(회사명, ' ', '')) = ?
       OR lower(replace(alias, ' ', '')) LIKE ?
    """

    like_pattern = f"%{norm_input}%"
    cursor.execute(query, (norm_input, like_pattern))
    result = cursor.fetchone()

    # 연결 종료
    conn.close()

    if result:
        # Unpack the tuple returned from the database
        ticker, industry, website = result
        phone = None # Assign None or a default value as phone isn't in the DB result

        # Return a dictionary as expected by the caller
        return {
            'ticker': ticker,
            'industry': industry,
            'website': website,
            'phone': phone
        }
    else:
        # 2. 유사도 기반 검색 (fallback)
        cursor.execute("SELECT 회사명, 티커, 주요제품, 홈페이지 FROM companies")
        rows = cursor.fetchall()
        conn.close()

        best_match = None
        best_score = 0

        for row in rows:
            db_name = normalize_name(row[0])
            score = jellyfish.jaro_winkler_similarity(norm_input, db_name)

            if score > best_score:
                best_score = score
                best_match = row

        if best_score >= min_similarity and best_match:
            name, ticker, industry, website = best_match
            return {
                'ticker': ticker,
                'industry': industry,
                'website': website,
                'phone': None,
                'matched_name': name,
                'similarity': round(best_score, 3)
            }
        
        # Return a dictionary with None values if not found
        return {
            'ticker': None,
            'industry': None,
            'website': None,
            'phone': None
        }
    

# 주식 데이터 가져오기
def get_stock_data(ticker, range='1y'):
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period=range)
        
        if hist.empty:
            return None
        
        # 기본 주가 데이터
        dates = hist.index.strftime('%Y-%m-%d').tolist()
        prices = hist['Close'].tolist()
        
        # 현재 가격 및 변동 정보
        current_price = prices[-1] if prices else None
        prev_price = prices[-2] if len(prices) > 1 else None
        price_change = current_price - prev_price if current_price and prev_price else None
        price_change_percent = (price_change / prev_price * 100) if price_change and prev_price else None
        
        return {
            'dates': dates,
            'prices': prices,
            'currentPrice': current_price,
            'priceChange': price_change,
            'priceChangePercent': price_change_percent
        }
    except Exception as e:
        print(f"Error fetching stock data for {ticker}: {e}")
        return None

# 재무 데이터 가져오기
def get_financial_data(ticker):
    try:
        stock = yf.Ticker(ticker)
        
        # 재무제표 데이터
        income_stmt = stock.income_stmt
        balance_sheet = stock.balance_sheet
        # cash_flow = stock.cashflow
        info = stock.info

        if income_stmt.empty or balance_sheet.empty:
            # 샘플 데이터 반환 (테스트용)
            return {
                'revenue': 100000000000,
                'revenueGrowth': 15.5,
                'operatingProfit': 20000000000,
                'operatingMargin': 20.0,
                'netIncome': 15000000000,
                'netMargin': 15.0,
                'per': 12.5,
                'perIndustry': 15.0,
                'pbr': 1.8,
                'pbrIndustry': 1.5,
                'roe': 12.0,
                'roeIndustry': 10.0,
                'marketCap': 300000000000,
                'dividendYield': 0.028  # 예: 0.028 (2.8%)
                
            }
        
        # 최근 연간 데이터
        latest_year = income_stmt.columns[0]
        prev_year = income_stmt.columns[1] if len(income_stmt.columns) > 1 else None
        
        # 매출액
        revenue = income_stmt.loc['Total Revenue', latest_year] if 'Total Revenue' in income_stmt.index else None
        prev_revenue = income_stmt.loc['Total Revenue', prev_year] if prev_year and 'Total Revenue' in income_stmt.index else None
        revenue_growth = ((revenue / prev_revenue) - 1) * 100 if revenue and prev_revenue else None
        
        # 영업이익
        operating_profit = income_stmt.loc['Operating Income', latest_year] if 'Operating Income' in income_stmt.index else None
        operating_margin = (operating_profit / revenue) * 100 if operating_profit and revenue else None
        
        # 순이익
        net_income = income_stmt.loc['Net Income', latest_year] if 'Net Income' in income_stmt.index else None
        net_margin = (net_income / revenue) * 100 if net_income and revenue else None
        
        # 시가총액
        market_cap = stock.info.get('marketCap')

        # PER, PBR 계산
        per = market_cap / net_income if market_cap and net_income else None
        
        # 자기자본
        total_equity = balance_sheet.loc['Total Stockholder Equity', latest_year] if 'Total Stockholder Equity' in balance_sheet.index else None
        pbr = market_cap / total_equity if market_cap and total_equity else None
        
        # ROE
        roe = (net_income / total_equity) * 100 if net_income and total_equity else None

        # dividend_yield
        dividend_yield = info.get("dividendYield")  # 예: 0.028 (2.8%)
        
        return {
            'revenue': revenue,
            'revenueGrowth': revenue_growth,
            'operatingProfit': operating_profit,
            'operatingMargin': operating_margin,
            'netIncome': net_income,
            'netMargin': net_margin,
            'per': per,
            'perIndustry': None,  # 예시 값
            'pbr': pbr,
            'pbrIndustry': 1.5,   # 예시 값
            'roe': roe,
            'roeIndustry': 10.0,  # 예시 값
            'marketCap': market_cap,
            'dividendYield': dividend_yield
        }
    except Exception as e:
        print(f"Error fetching financial data for {ticker}: {e}")
        # 샘플 데이터 반환 (테스트용)
        return {
            'revenue': 100000000000,
            'revenueGrowth': 15.5,
            'operatingProfit': 20000000000,
            'operatingMargin': 20.0,
            'netIncome': 15000000000,
            'netMargin': 15.0,
            'per': 12.5,
            'perIndustry': None,
            'pbr': 1.8,
            'pbrIndustry': 1.5,
            'roe': 12.0,
            'roeIndustry': 10.0,
            'marketCap': 300000000000,
            'dividendYield': 0.028
        }

# 기술적 지표 계산
def calculate_technical_indicators(ticker, ma_periods=[20, 60], base_range_days=365):
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period='1y')
        # 현재 날짜 기준으로 가장 긴 MA를 위한 start 날짜 계산

        if hist.empty:
            # 샘플 데이터 반환
            length = 252  # 1년 기준 대략적인 거래일 수
            return {
                # 'rsi': [55.0] * length,
                # 'macd': [10.5] * length,
                # 'macdSignal': [8.2] * length,
                'ma20': [50000.0] * length,
                'ma60': [48000.0] * length,
                'bollingerUpper': [52000.0] * length,
                'bollingerLower': [48000.0] * length,
                'currentPrice': 50000.0,
                # 'support': 48500.0,
                # 'resistance': 51500.0
            }

        close = hist['Close']

        # RSI (14일)
        # 경고 발생 부분 수정: fillna(method='backfill') -> bfill()
        rsi_series = calculate_rsi(close, period=14).bfill()

        # MACD
        macd_line, signal_line = calculate_macd(close)
        # 경고 발생 부분 수정: fillna(method='backfill') -> bfill()
        macd_line = macd_line.bfill()
        signal_line = signal_line.bfill()

        # MA20 / MA60
        # 경고 발생 부분 수정: fillna(method='backfill') -> bfill()
        ma20_series = close.rolling(window=20).mean().bfill()
        ma60_series = close.rolling(window=60).mean().bfill()

        # 볼린저 밴드
        bollinger_upper, bollinger_lower = calculate_bollinger_bands(close)
        # 경고 발생 부분 수정: fillna(method='backfill') -> bfill()
        bollinger_upper = bollinger_upper.bfill()
        bollinger_lower = bollinger_lower.bfill()

        # 현재 가격
        current_price = float(close.iloc[-1])

        # 지지선/저항선 (최근 30일)
        recent_lows = hist['Low'].tail(30).nsmallest(3).mean()
        recent_highs = hist['High'].tail(30).nlargest(3).mean()
        # bollinger_upper = bollinger_upper.fillna(value=None).tolist()
        # bollinger_lower = bollinger_lower.fillna(value=None).tolist()
        
        # print("bollinger_upper:", bollinger_upper)
        # print("bollinger_lower:", bollinger_lower)
        # 현재 가격
        current_price = float(close.iloc[-1])

        # 지지선/저항선 (최근 30일)
        recent_lows = hist['Low'].tail(30).nsmallest(3).mean()
        recent_highs = hist['High'].tail(30).nlargest(3).mean()

        return {
            # 'rsi': rsi_series.tolist(),
            # 'macd': macd_line.tolist(),
            # 'macdSignal': signal_line.tolist(),
            'ma20': ma20_series.tolist(),
            'ma60': ma60_series.tolist(),
            'bollingerUpper': bollinger_upper.tolist(),
            'bollingerLower': bollinger_lower.tolist(),
            'currentPrice': current_price,
            # 'support': float(recent_lows),
            # 'resistance': float(recent_highs)
        }

    except Exception as e:
        print(f"Error calculating technical indicators for {ticker}: {e}")
        length = 252
        return {
            # 'rsi': [55.0] * length,
            # 'macd': [10.5] * length,
            # 'macdSignal': [8.2] * length,
            'ma20': [50000.0] * length,
            'ma60': [48000.0] * length,
            'bollingerUpper': [52000.0] * length,
            'bollingerLower': [48000.0] * length,
            'currentPrice': 50000.0,
            # 'support': 48500.0,
            # 'resistance': 51500.0
        }


# 뉴스 데이터 가져오기
def get_news_data(company_name):
    try:
        # URL 인코딩 처리
        encoded_name = urllib.parse.quote(company_name)
        
        # 네이버 뉴스 검색
        search_url = f"https://search.naver.com/search.naver?where=news&query={encoded_name}&sort=recent"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
        }
        
        response = requests.get(search_url, headers=headers)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        news_items = []
        
        # 2025년 기준 네이버 뉴스 검색 결과 구조에 맞게 수정
        # news_wrap, news_area, news_info 클래스를 모두 탐색
        news_elements = soup.select('.news_wrap')
        
        for i, news in enumerate(news_elements):
            if i >= 10:  # 최대 10개 뉴스만 가져오기
                break
            
            # 제목 및 링크 추출    
            title_elem = news.select_one('.news_tit')
            
            # 날짜 정보 추출 (news_info 클래스 내의 time 태그)
            # info_elems = news.select_one('.info_group .info')
            info_elems = news.select('.info_group .info')
            
            press = info_elems[0].text.strip() if len(info_elems) > 0 else "언론사 정보 없음"
            # "언론사 선정"이라는 문구가 포함되어 있다면 제거
            if "언론사 선정" in press:
                press = press.replace("언론사 선정", "").strip()
            
            date = info_elems[1].text.strip() if len(info_elems) > 1 else "날짜 정보 없음"
       
            if title_elem:
                title = title_elem.text.strip()
                url = title_elem['href']
                # date = date_elem.text.strip() if date_elem else "날짜 정보 없음" 
                # print("date:", date)
                news_items.append({
                    'title': title,
                    'url': url,
                    'date': date,
                    'press': press
                })
        
        # 대체 방법: 다른 선택자 시도
        if not news_items:
            # 첫 번째 방법이 실패하면 다른 선택자로 시도
            news_elements = soup.select('.news_area')
            
            for i, news in enumerate(news_elements):
                if i >= 10:
                    break
                
                title_elem = news.select_one('a.news_tit, a.tit')
                date_elem = news.select_one('.info_group span.info, .time')
                
                if title_elem:
                    title = title_elem.text.strip()
                    url = title_elem['href']
                    date = date_elem.text.strip() if date_elem else "날짜 정보 없음"
                    
                    news_items.append({
                        'title': title,
                        'url': url,
                        'date': date,
                        'press': press
                    })
        
        # 뉴스를 찾지 못한 경우 샘플 데이터 반환 (테스트용)
        if not news_items:
            print(f"뉴스를 찾지 못했습니다: {company_name}. 샘플 데이터를 반환합니다.")
            return [
                {
                    'title': f'{company_name} 실적 전망 밝아...주가 상승세',
                    'url': 'https://example.com/news1',
                    'date': '2025.04.07.'
                },
                {
                    'title': f'{company_name} 신제품 출시 예정...시장 반응 주목',
                    'url': 'https://example.com/news2',
                    'date': '2025.04.06.'
                },
                {
                    'title': f'{company_name} 해외 시장 진출 가속화',
                    'url': 'https://example.com/news3',
                    'date': '2025.04.05.'
                }
            ]
        
        # 디버깅 정보
        print(f"{company_name}에 대한 뉴스 {len(news_items)}개를 찾았습니다.")
        return news_items
    
    except Exception as e:
        print(f"Error fetching news for {company_name}: {e}")
        # 샘플 데이터 반환 (테스트용)
        return [
            {
                'title': f'{company_name} 실적 전망 밝아...주가 상승세',
                'url': 'https://example.com/news1',
                'date': '2025.04.07.'
            },
            {
                'title': f'{company_name} 신제품 출시 예정...시장 반응 주목',
                'url': 'https://example.com/news2',
                'date': '2025.04.06.'
            },
            {
                'title': f'{company_name} 해외 시장 진출 가속화',
                'url': 'https://example.com/news3',
                'date': '2025.04.05.'
            }
        ]

# Helper function to replace NaN with None (JSON null)
def replace_nan_with_none(obj):
    """Recursively replaces NaN values with None in nested objects/lists."""
    if isinstance(obj, dict):
        return {k: replace_nan_with_none(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [replace_nan_with_none(elem) for elem in obj]
    # Check specifically for float NaN (covers math.nan, np.nan, float('nan'))
    # Use pd.isna if you primarily use pandas
    elif isinstance(obj, float) and math.isnan(obj):
         return None
    # Handle pandas NaT (Not a Time) if you work with timestamps
    elif pd.isna(obj) and isinstance(obj, pd.Timestamp):
         return None
    return obj
    
# API 엔드포인트: 서버 상태 확인
@app.route('/status', methods=['GET'])
def check_server_status():
    return jsonify({
        'status': 'online',
        'message': '서버가 정상적으로 실행 중입니다.',
        'timestamp': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')
    })

# API 엔드포인트: 회사 정보 가져오기
@app.route('/api/company', methods=['GET'])
def get_company_info():
    company_name = request.args.get('name')
    
    if not company_name:
        return jsonify({'error': '회사 이름이 제공되지 않았습니다.'}), 400
    
    # 회사 이름으로 티커 심볼 가져오기
    result = get_ticker_from_company_name(company_name)
    ticker = result["ticker"]
    if not ticker:
        return jsonify({'error': f'"{company_name}" 회사의 티커 심볼을 찾을 수 없습니다.'}), 404

    industry = result["industry"] or "_"
    
    website = result["website"] or "_"
    
    phone = result["phone"] or "_"
    
    # 주식 데이터 가져오기
    stock_data = get_stock_data(ticker)

    # 재무 데이터 가져오기
    financial_data = get_financial_data(ticker)

    # 기술적 지표 계산
    technical_data = calculate_technical_indicators(ticker)

    # 뉴스 데이터 가져오기
    news_data = get_news_data(company_name)

    # 거래소 정보
    exchange = "KOSPI" if ticker.endswith(".KS") else "KOSDAQ" if ticker.endswith(".KQ") else "Unknown"

    # 결과 반환
    result = {
        'name': company_name,
        'ticker': ticker,
        'industry': industry,
        'website': website,
        'phone': phone,
        'exchange': exchange,
        'currentPrice': stock_data['currentPrice'] if stock_data and 'currentPrice' in stock_data else None,
        'priceChange': stock_data['priceChange'] if stock_data and 'priceChange' in stock_data else None,
        'priceChangePercent': stock_data['priceChangePercent'] if stock_data and 'priceChangePercent' in stock_data else None,
        'stockData': stock_data,
        'financialData': financial_data,
        'technicalData': technical_data,
        'newsData': news_data
    }
    # NaN 문제 대책
    cleaned_data = replace_nan_with_none(result)

    return jsonify(cleaned_data)

# API 엔드포인트: 주식 데이터 가져오기 (시간 범위별)
@app.route('/api/stock', methods=['GET'])
def get_stock_data_api():
    company_name = request.args.get('name')
    range = request.args.get('range', '1y')
    print("Chrome Extension Requested")
    if not company_name:
        return jsonify({'error': '회사 이름이 제공되지 않았습니다.'}), 400
    
    # 회사 이름으로 티커 심볼 가져오기
    # print("회사 이름:", company_name)
    result = get_ticker_from_company_name(company_name)
    ticker = result["ticker"]
    if not ticker:
        return jsonify({'error': f'"{company_name}" 회사의 티커 심볼을 찾을 수 없습니다.'}), 404
    
    # 주식 데이터 가져오기
    stock_data = get_stock_data(ticker, range)
    
    if not stock_data:
        return jsonify({'error': f'"{company_name}" 회사의 주식 데이터를 가져올 수 없습니다.'}), 500
    
    return jsonify({'stockData': stock_data})

@app.route('/api/technical', methods=['GET'])
def get_technical_indicators_api():
    company_name = request.args.get('name')
    indicator_keys = request.args.getlist('indicators')

    if not company_name:
        return jsonify({'error': '회사 이름이 제공되지 않았습니다.'}), 400

    # 회사 이름 → 티커
    result = get_ticker_from_company_name(company_name)
    ticker = result.get("ticker")
    if not ticker:
        return jsonify({'error': f'"{company_name}" 회사의 티커를 찾을 수 없습니다.'}), 404

    # 기술적 지표 계산
    all_indicators = calculate_technical_indicators(ticker)

    # 요청된 지표만 추려서 반환
    filtered_result = {}
    for key in indicator_keys:
        if key == "ma":
            filtered_result["ma20"] = all_indicators.get("ma20")
            filtered_result["ma60"] = all_indicators.get("ma60")
        elif key == "bollinger":
            filtered_result["bollingerUpper"] = all_indicators.get("bollingerUpper")
            filtered_result["bollingerLower"] = all_indicators.get("bollingerLower")
        else:
            # 일반 키 ('rsi', 'macd', 'macdSignal' 등)
            if key in all_indicators:
                filtered_result[key] = all_indicators[key]

    return jsonify(filtered_result)

@app.route('/api/financial_trend')
def get_financial_trend():
    name = request.args.get("name")
    if not name:
        return jsonify({"error": "회사 이름 없음"}), 400

    result = get_ticker_from_company_name(name)
    ticker = result.get("ticker")
    if not ticker:
        return jsonify({"error": "티커 없음"}), 404

    stock = yf.Ticker(ticker)
    income = stock.income_stmt
    if income is None or income.empty:
        return jsonify({"error": "수익 데이터 없음"}), 500

    income = income.iloc[:, :4]  # 최근 4개 연도
    years = [str(col.year) for col in income.columns]

    # 값 추출
    revenue = []
    operating = []
    net = []
    operating_margin = []
    net_margin = []

    for col in income.columns:
        rev = int(income.loc["Total Revenue", col]) if "Total Revenue" in income.index else 0
        op = int(income.loc["Operating Income", col]) if "Operating Income" in income.index else 0
        nt = int(income.loc["Net Income", col]) if "Net Income" in income.index else 0

        revenue.append(rev)
        operating.append(op)
        net.append(nt)

        # 이익률 계산 (%)
        operating_margin.append(round(op / rev * 100, 1) if rev else 0)
        net_margin.append(round(nt / rev * 100, 1) if rev else 0)

    return jsonify({
        "years": years,
        "revenue": revenue,
        "operatingProfit": operating,
        "netIncome": net,
        "operatingMargin": operating_margin,
        "netMargin": net_margin
    })


# 서버 실행
if __name__ == '__main__':
    create_db_if_not_exists("company.csv")
    app.run(host='0.0.0.0', port=5000, debug=True)
