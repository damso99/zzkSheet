const TEST_MESSAGE = "자동메세지 테스트";
const SEND_COOLDOWN_MS = 30 * 1000;

let lastSentAt = 0;

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "POST 요청만 허용됩니다." });
    return;
  }

  if (!isSameOriginRequest(request)) {
    sendJson(response, 403, { error: "허용되지 않은 요청입니다." });
    return;
  }

  const now = Date.now();
  const remainingCooldown = SEND_COOLDOWN_MS - (now - lastSentAt);
  if (remainingCooldown > 0) {
    response.setHeader("Retry-After", String(Math.ceil(remainingCooldown / 1000)));
    sendJson(response, 429, { error: "잠시 후 다시 시도해주세요." });
    return;
  }

  const webhookUrl = String(process.env.DISCORD_WEBHOOK_URL || "").trim();
  if (!webhookUrl) {
    sendJson(response, 503, { error: "Vercel에 DISCORD_WEBHOOK_URL 설정이 필요합니다." });
    return;
  }

  try {
    const discordResponse = await fetch(`${webhookUrl}?wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        allowed_mentions: { parse: [] },
        content: TEST_MESSAGE,
        thread_name: TEST_MESSAGE,
        username: "Stick Over Flow",
      }),
    });

    if (!discordResponse.ok) {
      const detail = await discordResponse.text();
      sendJson(response, 502, {
        error: "디스코드 메시지 전송에 실패했습니다.",
        detail: detail.slice(0, 300),
      });
      return;
    }

    lastSentAt = now;
    sendJson(response, 200, { success: true });
  } catch (error) {
    sendJson(response, 502, {
      error: "디스코드에 연결하지 못했습니다.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function isSameOriginRequest(request) {
  const origin = String(request.headers.origin || "").trim();
  const host = String(request.headers.host || "").trim();
  if (!origin || !host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}
