const searchForm = document.getElementById("searchForm");
const queryInput = document.getElementById("queryInput");
const newsGrid = document.getElementById("newsGrid");
const statusArea = document.getElementById("statusArea");
const statusText = document.getElementById("statusText");
const briefing = document.getElementById("briefing");
const briefingText = document.getElementById("briefingText");
const translateToggle = document.getElementById("translateToggle");
const summaryToggle = document.getElementById("summaryToggle");

let currentArticles = [];
let currentFilter = "all";

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const query = queryInput.value.trim();
  if (!query) return;

  showLoading("기사를 수집하는 중입니다...");

  try {
    const articles = await fetchNews(query);
    currentArticles = await prepareArticles(articles, query);
    renderBriefing(currentArticles, query);
    renderArticles(currentArticles);
  } catch (error) {
    console.error(error);
    newsGrid.innerHTML = `
      <div class="empty">
        기사를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        <br />
        오류 내용: ${escapeHTML(error.message)}
      </div>
    `;
    briefing.classList.add("hidden");
  } finally {
    hideLoading();
  }
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    currentFilter = tab.dataset.filter;
    renderArticles(currentArticles);
  });
});

// GDELT 뉴스 API 사용: 별도 API 키 없이 뉴스 기사 목록을 가져오기 위한 용도
/*async function fetchNews(query) {
  const encodedQuery = encodeURIComponent(query);
  const url =
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodedQuery}` +
    `&mode=artlist&format=json&maxrecords=12&sort=HybridRel`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("뉴스 API 응답 오류");
  }

  const data = await response.json();
  return data.articles || [];
}*/

/*async function fetchNews(query) {
  const response = await fetch(`/api/naver-news?query=${encodeURIComponent(query)}`);

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || `네이버 뉴스 API 요청 실패 (${response.status})`);
  }

  return data.articles.map((article) => ({
    title: article.title,
    description: article.description,
    url: article.url,
    domain: article.domain,
    language: "Korean",
    sourceCountry: "KS",
    seendate: article.pubDate,
    socialimage: "",
  }));
}*/

async function fetchNews(query) {
  const response = await fetch(`/api/naver-news?query=${encodeURIComponent(query)}`);

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || "뉴스 API 요청 실패");
  }

  return data.articles.map((article) => ({
    title: article.title,
    description: article.description,
    url: article.url,
    domain: article.domain,
    language: article.language,
    sourceCountry: article.sourceCountry,
    seendate: article.pubDate,
    socialimage: article.socialimage,
  }));
}

async function prepareArticles(articles, query) {
  if (!articles.length) return [];

  showLoading("국내/해외 기사를 분류하고 번역하는 중입니다...");

  const prepared = [];

  for (const article of articles) {
    const title = article.title || "제목 없음";
    const country = article.sourceCountry || "";
    const domain = article.domain || "";
    const language = article.language || "";

    const type = isDomesticArticle(country, domain, language) ? "domestic" : "foreign";

    let translatedTitle = "";
    if (translateToggle.checked && type === "foreign") {
      translatedTitle = await translateToKorean(title, language);
    }

    const summary = summaryToggle.checked
      ? makeSimpleSummary({
          query,
          title,
          translatedTitle,
          type,
          domain,
          language,
        })
      : "";

    prepared.push({
      title,
      translatedTitle,
      summary,
      type,
      domain,
      language,
      country,
      url: article.url,
      image: article.socialimage,
      date: article.seendate,
    });
  }

  return prepared;
}

function isDomesticArticle(country, domain, language) {
  const lowerDomain = String(domain).toLowerCase();
  const lowerLang = String(language).toLowerCase();

  return (
    country === "KS" ||
    lowerLang.includes("korean") ||
    lowerLang === "ko" ||
    lowerDomain.endsWith(".kr") ||
    lowerDomain.includes("yna.co.kr") ||
    lowerDomain.includes("chosun") ||
    lowerDomain.includes("joongang") ||
    lowerDomain.includes("hani.co.kr")
  );
}

// 무료 번역 API를 이용한 간단 번역
// 사용량 제한이 있으므로 발표/시연 전에는 너무 많이 반복 검색하지 않는 것을 추천
async function translateToKorean(text, language) {
  try {
    const sourceLang = guessLangCode(language);
    const url =
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}` +
      `&langpair=${sourceLang}|ko`;

    const response = await fetch(url);
    if (!response.ok) return "";

    const data = await response.json();
    return data?.responseData?.translatedText || "";
  } catch (error) {
    console.warn("번역 실패:", error);
    return "";
  }
}

function guessLangCode(language) {
  const lang = String(language).toLowerCase();

  if (lang.includes("english")) return "en";
  if (lang.includes("japanese")) return "ja";
  if (lang.includes("chinese")) return "zh";
  if (lang.includes("french")) return "fr";
  if (lang.includes("spanish")) return "es";
  if (lang.includes("german")) return "de";
  if (lang.includes("russian")) return "ru";

  return "en";
}

function makeSimpleSummary({ query, title, translatedTitle, type, domain, language }) {
  const displayTitle = translatedTitle || title;
  const articleType = type === "domestic" ? "국내 기사" : "해외 기사";

  return `"${query}"와 관련된 ${articleType}입니다. ${domain ? `${domain}에서 보도했으며, ` : ""}핵심 내용은 "${displayTitle}"로 요약할 수 있습니다.${language ? ` 원문 언어 정보: ${language}.` : ""}`;
}

function renderBriefing(articles, query) {
  if (!articles.length) {
    briefing.classList.add("hidden");
    return;
  }

  const domesticCount = articles.filter((item) => item.type === "domestic").length;
  const foreignCount = articles.filter((item) => item.type === "foreign").length;

  const topTitles = articles
    .slice(0, 5)
    .map((item, index) => {
      const title = item.translatedTitle || item.title;
      return `${index + 1}. ${title}`;
    })
    .join("\n");

  briefingText.textContent =
    `검색어 "${query}"에 대한 기사 ${articles.length}건을 찾았습니다.\n` +
    `국내 기사 ${domesticCount}건, 해외 기사 ${foreignCount}건으로 분류되었습니다.\n\n` +
    `주요 기사 제목:\n${topTitles}`;

  briefing.classList.remove("hidden");
}

function renderArticles(articles) {
  const filtered = articles.filter((article) => {
    if (currentFilter === "all") return true;
    return article.type === currentFilter;
  });

  if (!filtered.length) {
    newsGrid.innerHTML = `<div class="empty">표시할 기사가 없습니다.</div>`;
    return;
  }

  newsGrid.innerHTML = filtered
    .map((article) => {
      const tagText = article.type === "domestic" ? "국내" : "해외";
      const imageStyle = article.image
        ? `style="background-image: url('${escapeAttribute(article.image)}')"`
        : "";

      return `
        <article class="news-card">
          <div class="thumbnail" ${imageStyle}></div>
          <div class="card-body">
            <div class="meta">
              <span>${escapeHTML(article.domain || "출처 미상")}</span>
              <span>${formatDate(article.date)}</span>
            </div>
            <span class="tag ${article.type}">${tagText}</span>
            <h3>${escapeHTML(article.title)}</h3>
            ${
              article.translatedTitle
                ? `<p class="translated">번역: ${escapeHTML(article.translatedTitle)}</p>`
                : ""
            }
            ${article.summary ? `<p class="summary">${escapeHTML(article.summary)}</p>` : ""}
            <a class="read-link" href="${escapeAttribute(article.url)}" target="_blank" rel="noopener">
              원문 기사 보기 →
            </a>
          </div>
        </article>
      `;
    })
    .join("");
}

function showLoading(message) {
  statusText.textContent = message;
  statusArea.classList.remove("hidden");
}

function hideLoading() {
  statusArea.classList.add("hidden");
}

function formatDate(dateText) {
  if (!dateText) return "날짜 없음";

  const date = new Date(dateText);

  if (Number.isNaN(date.getTime())) {
    return String(dateText).slice(0, 10);
  }

  return date.toLocaleDateString("ko-KR");
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHTML(value).replaceAll("`", "&#096;");
}
