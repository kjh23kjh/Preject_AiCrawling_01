# AI 뉴스 자동 요약 및 브리핑 시스템

## 프로젝트 주제

해외 및 국내 기사 크롤링/수집, 번역, 요약 기능을 제공하는 웹사이트입니다.

사용자가 검색창에 궁금한 주제를 입력하면 관련 기사를 가져오고, 국내 기사와 해외 기사를 구분합니다. 해외 기사 제목은 한국어로 번역하고, 전체 결과를 짧은 브리핑 형태로 요약합니다.

## 주요 기능

- 검색어 기반 뉴스 기사 수집
- 국내 기사 / 해외 기사 분류
- 해외 기사 제목 한국어 번역
- 검색 결과 자동 요약 브리핑
- 반응형 웹 디자인
- GitHub Pages 또는 Vercel 배포 가능

## 사용 기술

- HTML
- CSS
- JavaScript
- GDELT News API
- MyMemory Translation API

## 파일 구조

```text
news-ai-briefing/
├─ index.html
├─ style.css
├─ script.js
└─ README.md
```

## 실행 방법

1. 프로젝트 폴더를 다운로드합니다.
2. `index.html` 파일을 브라우저에서 실행합니다.
3. 검색창에 원하는 키워드를 입력합니다.

## 배포 방법

### GitHub 업로드

```bash
git init
git add .
git commit -m "Add AI news briefing website"
git branch -M main
git remote add origin 본인_GitHub_레포지터리_URL
git push -u origin main
```

### Vercel 배포

1. Vercel에 로그인합니다.
2. GitHub 레포지터리를 Import 합니다.
3. Framework Preset은 `Other`로 둡니다.
4. Deploy 버튼을 누릅니다.

## 참고

정적 웹사이트에서는 실제 뉴스 사이트 본문을 직접 크롤링할 때 CORS 정책 문제가 생길 수 있습니다.  
이 프로젝트는 발표와 제출이 가능한 수준으로, 뉴스 API를 이용해 기사 목록을 수집하고 번역/요약 기능을 구현했습니다.
