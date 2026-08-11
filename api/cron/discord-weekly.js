const SPREADSHEET_ID = "1pn-86CBr_9TzKI1zncCXpo3Ge0rKjg8zA99v6twX_gA";
const SHEET_NAME = "디코공지";
const KOREA_TIME_ZONE = "Asia/Seoul";
const ENABLED_VALUES = new Set(["1", "TRUE", "Y", "YES", "사용", "전송"]);
const MANUAL_COOLDOWN_MS = 30 * 1000;

let lastManualSentAt = 0;

export default async function handler(request, response) {
  const isManualTest = request.method === "POST";

  if (request.method !== "GET" && !isManualTest) {
    response.setHeader("Allow", "GET, POST");
    sendJson(response, 405, { error: "GET 또는 POST 요청만 허용됩니다." });
    return;
  }

  if (isManualTest) {
    if (!isSameOriginRequest(request)) {
      sendJson(response, 403, { error: "허용되지 않은 요청입니다." });
      return;
    }

    const remainingCooldown = MANUAL_COOLDOWN_MS - (Date.now() - lastManualSentAt);
    if (remainingCooldown > 0) {
      response.setHeader("Retry-After", String(Math.ceil(remainingCooldown / 1000)));
      sendJson(response, 429, { error: "잠시 후 다시 시도해주세요." });
      return;
    }
  } else {
    const cronSecret = String(process.env.CRON_SECRET || "").trim();
    if (!cronSecret || request.headers.authorization !== `Bearer ${cronSecret}`) {
      sendJson(response, 401, { error: "인증되지 않은 Cron 요청입니다." });
      return;
    }
  }

  const webhookUrl = String(process.env.DISCORD_WEBHOOK_URL || "").trim();
  if (!webhookUrl) {
    sendJson(response, 503, { error: "DISCORD_WEBHOOK_URL 설정이 필요합니다." });
    return;
  }

  try {
    const notice = await loadWeeklyNotice();
    if (!notice) {
      sendJson(response, 200, { sent: false, reason: "등록된 공지가 없습니다." });
      return;
    }

    if (!notice.enabled) {
      sendJson(response, 200, { sent: false, reason: "공지 사용 설정이 꺼져 있습니다." });
      return;
    }

    const today = getKoreanDate();
    if (!isManualTest && notice.sendDate !== today) {
      sendJson(response, 200, {
        sent: false,
        reason: "전송일이 오늘과 일치하지 않습니다.",
        sendDate: notice.sendDate,
        today,
      });
      return;
    }

    if (!notice.title || !notice.content) {
      sendJson(response, 200, { sent: false, reason: "제목 또는 내용이 비어 있습니다." });
      return;
    }

    if (notice.content.length > 2000) {
      sendJson(response, 400, { error: "공지 내용은 2,000자까지 전송할 수 있습니다." });
      return;
    }

    const discordUrl = new URL(webhookUrl);
    discordUrl.searchParams.set("wait", "true");
    const discordResponse = await fetch(discordUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        allowed_mentions: { parse: [] },
        content: notice.content,
        thread_name: notice.title.slice(0, 100),
        username: "Stick Over Flow",
      }),
    });

    if (!discordResponse.ok) {
      const detail = await discordResponse.text();
      sendJson(response, 502, {
        error: "디스코드 공지 전송에 실패했습니다.",
        detail: detail.slice(0, 300),
      });
      return;
    }

    if (isManualTest) lastManualSentAt = Date.now();

    sendJson(response, 200, {
      manualTest: isManualTest,
      sent: true,
      sendDate: notice.sendDate,
      title: notice.title,
    });
  } catch (error) {
    sendJson(response, 502, {
      error: "주간 디스코드 공지를 처리하지 못했습니다.",
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

async function loadWeeklyNotice() {
  const params = new URLSearchParams({
    sheet: SHEET_NAME,
    tqx: "out:json",
  });
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?${params}`;
  const sheetResponse = await fetch(sheetUrl, {
    headers: { accept: "text/plain,application/json,text/javascript,*/*" },
  });
  const text = await sheetResponse.text();

  if (!sheetResponse.ok) {
    throw new Error(`디코공지 시트를 불러오지 못했습니다. (${sheetResponse.status})`);
  }

  const payload = parseGvizPayload(text);
  const rows = payload.table?.rows || [];
  const row = rows
    .map((item) => item?.c || [])
    .find((cells) => {
      const firstCell = getCellText(cells[0]).trim();
      return firstCell && firstCell !== "전송일";
    });
  if (!row) return null;

  return {
    sendDate: normalizeDate(getCellText(row[0])),
    title: getCellText(row[1]).trim(),
    content: getCellText(row[2]).trim(),
    enabled: ENABLED_VALUES.has(getCellText(row[3]).trim().toUpperCase()),
  };
}

function parseGvizPayload(text) {
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);?$/);
  if (!match?.[1]) throw new Error("디코공지 시트 응답을 해석하지 못했습니다.");
  return JSON.parse(match[1]);
}

function getCellText(cell) {
  if (!cell) return "";
  if (cell.f != null) return String(cell.f);
  if (cell.v != null) return String(cell.v);
  return "";
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  const dateCall = text.match(/Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\)/);
  if (dateCall) {
    return `${dateCall[1]}-${String(Number(dateCall[2]) + 1).padStart(2, "0")}-${dateCall[3].padStart(2, "0")}`;
  }

  const parts = text.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!parts) return text;
  return `${parts[1]}-${parts[2].padStart(2, "0")}-${parts[3].padStart(2, "0")}`;
}

function getKoreanDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: KOREA_TIME_ZONE,
    year: "numeric",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}
