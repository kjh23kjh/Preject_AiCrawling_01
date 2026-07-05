export default async function handler(req, res) {
  const query = req.query.query || "";

  if (!query.trim()) {
    return res.status(400).json({
      error: "검색어가 없습니다.",
    });
  }

  try {
    const [domesticArticles, foreignArticles] = await Promise.all([
      fetchNaverNews(query),
      fetchForeignNews(query),
    ]);

    const articles = removeDuplicateArticles([
      ...domesticArticles,
      ...foreignArticles,
    ]);

    return res.status(200).json({
      total: articles.length,
      articles,
    });
  } catch (error) {
    return res.status(500).json({
      error: "뉴스 수집 중 오류가 발생했습니다.",
      message: error.message,
    });
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
  const englishQuery = await translateQueryToEnglish(query);

  const apiUrl =
    "https://api.gdeltproject.org/api/v2/doc/doc?" +
    new URLSearchParams({
      query: englishQuery,
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

async function translateQueryToEnglish(query) {
  try {
    const url =
      "https://api.mymemory.translated.net/get?" +
      new URLSearchParams({
        q: query,
        langpair: "ko|en",
      });

    const response = await fetch(url);

    if (!response.ok) {
      return query;
    }

    const data = await response.json();
    return data?.responseData?.translatedText || query;
  } catch {
    return query;
  }
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

/*export default async function handler(req, res) {
  const query = req.query.query || "";

  if (!query.trim()) {
    return res.status(400).json({
      error: "검색어가 없습니다.",
    });
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: "네이버 API 키가 설정되지 않았습니다.",
    });
  }

  const apiUrl =
    "https://openapi.naver.com/v1/search/news.json?" +
    new URLSearchParams({
      query,
      display: "20",
      start: "1",
      sort: "date",
    });

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: "네이버 뉴스 API 요청 실패",
      });
    }

    const data = await response.json();

    const articles = data.items.map((item) => ({
      title: removeHtmlTags(item.title),
      description: removeHtmlTags(item.description),
      url: item.link,
      originallink: item.originallink,
      pubDate: item.pubDate,
      domain: getDomain(item.link),
      type: "domestic",
    }));

    return res.status(200).json({
      total: data.total,
      articles,
    });
  } catch (error) {
    return res.status(500).json({
      error: "서버 오류가 발생했습니다.",
      message: error.message,
    });
  }
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
}*/
