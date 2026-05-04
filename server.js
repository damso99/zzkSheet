import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = join(__dirname, "dist");
const publicDir = existsSync(distDir) ? distDir : join(__dirname, "public");
const port = Number(process.env.PORT || 5178);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);

  if (url.pathname === "/api/raid-sheet") {
    await handleRaidSheetRequest(response, url);
    return;
  }

  await serveStaticFile(response, url.pathname);
})
  .listen(port, "127.0.0.1", () => {
    console.log(`Raid schedule server is listening on http://127.0.0.1:${port}`);
  })
  .on("error", (error) => {
    console.error(error);
    process.exit(1);
  });

async function handleRaidSheetRequest(response, url) {
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

async function serveStaticFile(response, pathname) {
  const resolvedPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(resolvedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);

  try {
    const file = await readFile(filePath);
    const type = mimeTypes[extname(filePath)] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": type });
    response.end(file);
  } catch {
    if (resolvedPath !== "/index.html") {
      await serveStaticFile(response, "/index.html");
      return;
    }

    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}
