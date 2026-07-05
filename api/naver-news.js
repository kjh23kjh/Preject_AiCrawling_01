export default async function handler(req, res) {
  const query = req.query.query || "";

  if (!query.trim()) {
    return res.status(400).json({
      error: "검색어가 없습니다.",
    });
  }

  const domesticResult = await safeRun(() => fetchNaverNews(query));
  const foreignResult = await safeRun(() => fetchForeignNews(query));

  const articles = removeDuplicateArticles([
    ...domesticResult.data,
    ...foreignResult.data,
  ]);

  return res.status(200).json({
    total: articles.length,
    articles,
    debug: {
      domesticError: domesticResult.error,
      foreignError: foreignResult.error,
    },
  });
}

async function safeRun(task) {
  try {
    const data = await task();
    return {
      data,
      error: null,
    };
  } catch (error) {
    console.error(error);
    return {
      data: [],
      error: error.message,
    };
  }
}

async function fetchNaverNews(query) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("네이버 API 키가 설정되지 않았습니다.");
  }

  const apiUrl =
    "https://openapi.naver.com/v1/search/news.json?" +
    new URLSearchParams({
      query,
      display: "10",
      start: "1",
      sort: "date",
    });

  const response = await fetch(apiUrl, {
    method: "GET",
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`네이버 뉴스 API 요청 실패: ${response.status} / ${text}`);
  }

  const data = JSON.parse(text);

  return (data.items || []).map((item) => ({
    title: removeHtmlTags(item.title),
    description: removeHtmlTags(item.description),
    url: item.link,
    originallink: item.originallink,
    pubDate: item.pubDate,
    domain: getDomain(item.link),
    language: "Korean",
    sourceCountry: "KS",
    socialimage: "",
    type: "domestic",
  }));
}

async function fetchForeignNews(query) {
  const foreignQuery = makeForeignQuery(query);

  const apiUrl =
    "https://api.gdeltproject.org/api/v2/doc/doc?" +
    new URLSearchParams({
      query: foreignQuery,
      mode: "artlist",
      format: "json",
      maxrecords: "10",
      sort: "HybridRel",
    });

  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error(`해외 뉴스 API 요청 실패: ${response.status}`);
  }

  const data = await response.json();

  return (data.articles || [])
    .filter((item) => {
      const language = String(item.language || "").toLowerCase();
      const country = String(item.sourcecountry || item.sourceCountry || "").toUpperCase();
      const domain = String(item.domain || "").toLowerCase();

      return (
        country !== "KS" &&
        country !== "KR" &&
        !language.includes("korean") &&
        !domain.endsWith(".kr")
      );
    })
    .map((item) => ({
      title: item.title || "제목 없음",
      description: "",
      url: item.url,
      originallink: item.url,
      pubDate: item.seendate,
      domain: item.domain || getDomain(item.url),
      language: item.language || "English",
      sourceCountry: item.sourcecountry || item.sourceCountry || "FOREIGN",
      socialimage: item.socialimage || "",
      type: "foreign",
    }));
}

function makeForeignQuery(query) {
  const lower = query.toLowerCase().trim();

  const dictionary = {
    "인공지능": "artificial intelligence",
    "ai": "artificial intelligence",
    "반도체": "semiconductor",
    "삼성전자": "Samsung Electronics",
    "기후변화": "climate change",
    "기후 변화": "climate change",
    "전기차": "electric vehicle",
    "배터리": "battery",
    "케이팝": "K-pop",
    "k-pop": "K-pop",
    "kpop": "K-pop",
  };

  return dictionary[lower] || query;
}

function removeDuplicateArticles(articles) {
  const seen = new Set();

  return articles.filter((article) => {
    if (!article.url || seen.has(article.url)) {
      return false;
    }

    seen.add(article.url);
    return true;
  });
}

function removeHtmlTags(text) {
  return String(text || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "출처 미상";
  }
}
