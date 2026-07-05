export default async function handler(req, res) {
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
}
