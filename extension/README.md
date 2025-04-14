
# Manus Stock Info - 크롬 확장 프로그램

Manus Stock Info는 웹 페이지에서 한국 상장 회사 이름을 선택하면 해당 회사의 주식 정보, 재무 데이터, 관련 뉴스를 빠르고 간편하게 확인할 수 있는 크롬 확장 프로그램입니다.

## 주요 기능

*   **실시간 주가 정보:** 선택한 회사의 현재가, 변동률 및 시계열 차트(1일, 1주, 1개월, 1년 등) 제공
*   **핵심 재무 데이터:** 매출액, 영업이익, 순이익, PER, PBR, ROE 등 주요 재무 지표 표시
*   **기술적 지표:** 이동평균선(MA), 볼린저 밴드 등 기술적 분석 지표 차트 제공
*   **최신 뉴스:** 해당 회사와 관련된 최신 뉴스 목록 제공 (네이버 뉴스 기반)
*   **회사 기본 정보:** 업종, 웹사이트 등 기본적인 회사 정보 확인 가능

## 설치 방법

이 확장 프로그램은 아직 Chrome 웹 스토어에 등록되지 않았습니다. 아래 단계에 따라 수동으로 설치해야 합니다.

1.  **저장소 다운로드 또는 클론:**
    *   이 GitHub 저장소를 로컬 컴퓨터에 다운로드합니다. (ZIP 파일 다운로드 또는 `git clone` 사용)
2.  **Chrome 확장 프로그램 페이지 열기:**
    *   Chrome 브라우저를 열고 주소창에 `chrome://extensions` 를 입력하여 확장 프로그램 관리 페이지로 이동합니다.
3.  **개발자 모드 활성화:**
    *   페이지 오른쪽 상단에 있는 **'개발자 모드(Developer mode)'** 스위치를 켭니다.
4.  **확장 프로그램 로드:**
    *   왼쪽 상단에 나타나는 **'압축 해제된 확장 프로그램을 로드합니다(Load unpacked)'** 버튼을 클릭합니다.
    *   파일 탐색기가 열리면, 1단계에서 다운로드하거나 클론한 폴더 내의 **`extension`** 폴더를 선택합니다.
5.  **설치 확인:**
    *   설치가 완료되면 확장 프로그램 목록에 'Manus Stock Info' (또는 `manifest.json`에 정의된 이름)가 나타나고, 브라우저 툴바에 아이콘이 추가됩니다.

## 사용 방법

1.  주식 정보를 확인하고 싶은 웹 페이지를 방문합니다.
2.  페이지 내에서 조회하려는 **한국 회사 이름**을 마우스로 드래그하여 **텍스트를 선택**합니다.
3.  텍스트를 선택하면 자동으로 작은 팝업 창이 나타나 해당 회사의 주식 정보 요약을 보여줍니다. (만약 팝업이 나타나지 않으면, 브라우저 툴바의 확장 프로그램 아이콘을 클릭해야 할 수도 있습니다 - 이 부분은 실제 구현에 따라 다를 수 있습니다.)

## 백엔드 서버 요구사항

이 확장 프로그램이 정상적으로 작동하려면 로컬 또는 원격 환경에서 백엔드 서버(`server` 폴더 내의 Python Flask 애플리케이션)가 실행 중이어야 합니다.

1.  **서버 폴더로 이동:**
    ```bash
    cd /path/to/repository/server
    ```
2.  **필요한 라이브러리 설치:**
    ```bash
    # requirements.txt 파일이 있다면:
    # pip install -r requirements.txt

    # 없다면 직접 설치:
    pip install Flask flask_cors yfinance pandas numpy requests beautifulsoup4 jellyfish
    ```
3.  **company.csv 파일 확인:**
    *   `server` 폴더 내에 한국 주식 종목 정보가 담긴 `company.csv` 파일이 있어야 합니다. 이 파일은 서버 첫 실행 시 `stock_info.db` 데이터베이스를 생성하는 데 사용됩니다.
4.  **서버 실행:**
    ```bash
    python app.py
    ```
    서버가 기본적으로 `http://localhost:5000` 에서 실행됩니다. 확장 프로그램은 이 주소로 데이터를 요청합니다.

## 기여하기

(만약 오픈 소스로 기여를 받고 싶다면 여기에 기여 방법을 안내하는 내용을 추가하세요. 예: 버그 리포트, 기능 제안, Pull Request 등)

## 라이선스
이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 아래 라이선스 전문을 참고하세요.

Copyright (c) [2025]

이 소프트웨어 및 관련 문서 파일(이하 "소프트웨어")의 사본을 얻는 모든 사람에게 사용, 복제, 수정, 병합, 게시, 배포, 서브라이선스 부여 및/또는 판매할 수 있는 권리를 포함하여 제한 없이 소프트웨어를 취급할 수 있는 권한을 무료로 부여합니다. 이는 다음 조건에 따릅니다:

위 저작권 고지 및 이 허가 고지는 소프트웨어의 모든 사본 또는 상당 부분에 포함되어야 합니다.

소프트웨어는 상품성, 특정 목적에의 적합성 및 비침해에 대한 보증을 포함하되 이에 국한되지 않는 어떠한 종류의 명시적 또는 묵시적 보증 없이 "있는 그대로" 제공됩니다. 어떤 경우에도 저자 또는 저작권자는 계약, 불법 행위 또는 기타 방식으로 소프트웨어 또는 그 사용 또는 기타 거래와 관련하여 발생하거나 그로 인해 발생하는 모든 청구, 손해 또는 기타 책임에 대해 책임을 지지 않습니다.

```text
MIT License

Copyright (c) [Year] [Copyright Holder]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
