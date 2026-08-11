export default async function handler(request, response) {
  const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  const sheetUrl = url.searchParams.get("url")?.trim();
  const selectedSheet = url.searchParams.get("sheet")?.trim();
  const selectedGid = url.searchParams.get("gid")?.trim() || extractSheetGid(sheetUrl);

  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  if (!spreadsheetId) {
    sendJson(response, 400, { error: "Google Sheets URL is invalid." });
    return;
  }

  const gvizUrl = buildGvizUrl({ spreadsheetId, sheetName: selectedSheet, gid: selectedGid });

  try {
    const gvizResponse = await fetch(gvizUrl, {
      headers: {
        accept: "text/plain,application/json,text/javascript,*/*",
      },
    });
    const text = await gvizResponse.text();

    if (!gvizResponse.ok) {
      sendJson(response, gvizResponse.status, {
        error: "Google Sheets request failed.",
        detail: text.slice(0, 500),
      });
      return;
    }

    const payload = parseGvizPayload(text);
    const rows = toRowArrays(payload.table);

    response.setHeader(
      "Vercel-CDN-Cache-Control",
      "public, s-maxage=30, stale-while-revalidate=30",
    );
    response.setHeader("Cache-Control", "public, max-age=0, must-revalidate");

    sendJson(response, 200, {
      cols: payload.table?.cols || [],
      fetchedAt: new Date().toISOString(),
      rows,
      selectedGid: selectedGid || "",
      selectedSheet: selectedSheet || "",
      sourceUrl: gvizUrl,
    });
  } catch (error) {
    sendJson(response, 502, {
      error: "Failed to fetch Google Sheets data.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function extractSpreadsheetId(sheetUrl) {
  if (!sheetUrl) return "";

  try {
    const parsed = new URL(sheetUrl);
    const match = parsed.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

function extractSheetGid(sheetUrl) {
  if (!sheetUrl) return "";
  const match = sheetUrl.match(/[?&#]gid=(\d+)/);
  return match?.[1] || "";
}

function buildGvizUrl({ spreadsheetId, sheetName, gid }) {
  const params = new URLSearchParams({ tqx: "out:json" });

  if (sheetName) {
    params.set("sheet", sheetName);
  } else if (gid) {
    params.set("gid", gid);
  }

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${params.toString()}`;
}

function parseGvizPayload(text) {
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);?$/);
  if (!match?.[1]) {
    throw new Error("Could not parse gviz response.");
  }

  return JSON.parse(match[1]);
}

function toRowArrays(table) {
  const width = table?.cols?.length || 0;
  return (table?.rows || []).map((row) =>
    Array.from({ length: width }, (_, index) => getCellValue(row?.c?.[index])),
  );
}

function getCellValue(cell) {
  if (!cell) return "";
  if (typeof cell.v === "string" || typeof cell.v === "number" || typeof cell.v === "boolean") {
    return cell.v;
  }
  if (cell.f) return cell.f;
  if (cell.v == null) return "";
  return String(cell.v);
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}
