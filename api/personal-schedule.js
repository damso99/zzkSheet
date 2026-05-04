export default async function handler(req, res) {
  const scriptUrl = process.env.PERSONAL_SCHEDULE_SCRIPT_URL;

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

      return sendProxyResponse(res, response.status || 200, text);
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

      return sendProxyResponse(res, response.status || 200, text);
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

function sendProxyResponse(res, status, text) {
  try {
    return res.status(status).json(JSON.parse(text));
  } catch {
    return res.status(status).send(text);
  }
}
