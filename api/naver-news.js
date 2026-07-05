export default async function handler(req, res) {
  const query = req.query.query || "";

  if (!query.trim()) {
    return res.status(400).json({
      error: "검색어가 없습니다.",
    });
  }

  const domesticResult = await safeRun(() => fetchNaverNews(query));
  const foreignResult = await safeRun(() => fetchGoogleForeignNews(query));

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
    return { data, error: null };
  } catch (error) {
    console.error(error);
    return { data: [], error: error.message };
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
    throw new Error(`네이버 뉴스 API 요청 실패: ${response.status}`);
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

async function fetchGoogleForeignNews(query) {
  const foreignQuery = makeForeignQuery(query);

  const rssUrl =
    "https://news.google.com/rss/search?" +
    new URLSearchParams({
      q: foreignQuery,
      hl: "en-US",
      gl: "US",
      ceid: "US:en",
    });

  const response = await fetch(rssUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!response.ok) {
    throw new Error(`해외 뉴스 RSS 요청 실패: ${response.status}`);
  }

  const xml = await response.text();
  const items = parseRssItems(xml).slice(0, 10);

  return items.map((item) => ({
    title: item.title || "제목 없음",
    description: item.description || "",
    url: item.link,
    originallink: item.link,
    pubDate: item.pubDate,
    domain: getDomain(item.link),
    language: "English",
    sourceCountry: "US",
    socialimage: "",
    type: "foreign",
  }));
}

function parseRssItems(xml) {
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

  return itemBlocks.map((block) => {
    const title = getXmlValue(block, "title");
    const link = getXmlValue(block, "link");
    const pubDate = getXmlValue(block, "pubDate");
    const description = removeHtmlTags(getXmlValue(block, "description"));

    return {
      title: decodeXml(title),
      link: decodeXml(link),
      pubDate: decodeXml(pubDate),
      description: decodeXml(description),
    };
  });
}

function getXmlValue(block, tagName) {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`);
  const match = block.match(regex);
  return match ? match[1] : "";
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

function decodeXml(text) {
  return String(text || "")
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
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
