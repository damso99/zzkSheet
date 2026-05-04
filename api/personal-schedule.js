export default async function handler(req, res) {
  const scriptUrl = cleanScriptUrl(process.env.PERSONAL_SCHEDULE_SCRIPT_URL);

  if (!scriptUrl) {
    return res.status(500).json({
      success: false,
      message: "PERSONAL_SCHEDULE_SCRIPT_URL is not configured",
    });
  }

  try {
    if (req.method === "GET") {
      const url = new URL(scriptUrl);
      url.searchParams.set("type", req.query?.type || "personal");

      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
      });
      const text = await response.text();

      return sendProxyResponse(res, response, text);
    }

    if (req.method === "POST") {
      const requestBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
      const response = await fetch(scriptUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: requestBody,
        redirect: "follow",
      });
      const text = await response.text();

      return sendProxyResponse(res, response, text);
    }

    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  } catch (error) {
    console.error("[personal-schedule proxy]", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function cleanScriptUrl(value) {
  return String(value || "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function sendProxyResponse(res, response, text) {
  const status = response.status || 200;
  const contentType = response.headers.get("content-type") || "";

  if (looksLikeHtml(text, contentType)) {
    return res.status(502).json({
      success: false,
      message:
        "Apps Script returned an HTML error page. Check PERSONAL_SCHEDULE_SCRIPT_URL and deploy the Apps Script Web App with Execute as Me / Anyone access.",
      upstreamStatus: status,
      upstreamUrl: response.url,
    });
  }

  try {
    return res.status(status).json(JSON.parse(text));
  } catch {
    return res.status(status).send(text);
  }
}

function looksLikeHtml(text, contentType) {
  return contentType.includes("text/html") || /^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text);
}
