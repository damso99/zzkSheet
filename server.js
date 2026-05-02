import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = join(__dirname, "dist");
const publicDir = existsSync(distDir) ? distDir : join(__dirname, "public");
const env = readEnvFile();
const port = Number(process.env.PORT || env.PORT || 5177);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const ARMORY_ENDPOINTS = {
  profile: "profiles",
  equipment: "equipment",
  engravings: "engravings",
  gems: "gems",
  cards: "cards",
  arkpassive: "arkpassive",
  arkgrid: "arkgrid",
};

function readEnvFile() {
  const envPath = join(__dirname, ".env");
  if (!existsSync(envPath)) return {};

  try {
    const text = readFileSync(envPath, "utf8");
    return Object.fromEntries(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function handleRosterRequest(request, response, url) {
  const lostarkApiKey = getLostarkApiKey();

  if (!lostarkApiKey) {
    sendJson(response, 500, {
      error: "LOSTARK_API_KEY is missing. Create .env from .env.example and add your JWT.",
    });
    return;
  }

  const characterName = url.searchParams.get("name")?.trim();
  if (!characterName) {
    sendJson(response, 400, { error: "name query is required." });
    return;
  }

  const apiUrl = `https://developer-lostark.game.onstove.com/characters/${encodeURIComponent(
    characterName,
  )}/siblings`;

  try {
    const { body, response: apiResponse } = await fetchLostarkJson(apiUrl, lostarkApiKey);

    if (!apiResponse.ok) {
      sendJson(response, apiResponse.status, {
        error: "Lost Ark OpenAPI request failed.",
        detail: body,
      });
      return;
    }

    sendJson(response, 200, { representative: characterName, characters: body ?? [] });
  } catch (error) {
    sendJson(response, 502, {
      error: "Failed to contact Lost Ark OpenAPI.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function handleCharacterRequest(request, response, url) {
  const lostarkApiKey = getLostarkApiKey();

  if (!lostarkApiKey) {
    sendJson(response, 500, {
      error: "LOSTARK_API_KEY is missing. Create .env from .env.example and add your JWT.",
    });
    return;
  }

  const characterName = url.searchParams.get("name")?.trim();
  if (!characterName) {
    sendJson(response, 400, { error: "name query is required." });
    return;
  }

  const encodedName = encodeURIComponent(characterName);

  try {
    const entries = await Promise.allSettled(
      Object.entries(ARMORY_ENDPOINTS).map(async ([key, path]) => {
        const apiUrl = `https://developer-lostark.game.onstove.com/armories/characters/${encodedName}/${path}`;
        const { body, response: apiResponse } = await fetchLostarkJson(apiUrl, lostarkApiKey);

        if (!apiResponse.ok) {
          return {
            key,
            value: null,
            error: {
              status: apiResponse.status,
              detail: body,
            },
          };
        }

        return { key, value: body, error: null };
      }),
    );

    const armory = {};
    const errors = {};

    for (const entry of entries) {
      if (entry.status === "rejected") {
        errors.unknown = entry.reason instanceof Error ? entry.reason.message : String(entry.reason);
        continue;
      }

      armory[entry.value.key] = entry.value.value;
      if (entry.value.error) errors[entry.value.key] = entry.value.error;
    }

    if (!armory.profile && errors.profile) {
      sendJson(response, errors.profile.status, {
        error: "Lost Ark OpenAPI profile request failed.",
        detail: errors.profile.detail,
      });
      return;
    }

    sendJson(response, 200, {
      character: armory.profile,
      armory,
      errors,
    });
  } catch (error) {
    sendJson(response, 502, {
      error: "Failed to contact Lost Ark OpenAPI.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function handleAssetRequest(request, response, url) {
  const assetName = url.searchParams.get("name")?.trim();

  if (!assetName || !/^[a-z0-9_.-]+$/i.test(assetName)) {
    sendJson(response, 400, { error: "valid asset name query is required." });
    return;
  }

  const candidates = buildAssetCandidates(assetName);

  for (const candidate of candidates) {
    try {
      const assetResponse = await fetch(candidate, { method: "HEAD" });
      if (assetResponse.ok) {
        response.writeHead(302, { Location: candidate, "Cache-Control": "public, max-age=86400" });
        response.end();
        return;
      }
    } catch {
      // Try the next known CDN path.
    }
  }

  sendJson(response, 404, { error: "Lost Ark asset was not found.", name: assetName });
}

async function handleSheetRequest(request, response, url) {
  const sheetUrl = url.searchParams.get("url")?.trim();
  const requestedSheet = url.searchParams.get("sheet")?.trim();

  if (!sheetUrl) {
    sendJson(response, 400, { error: "url query is required." });
    return;
  }

  const exportUrl = buildGoogleSheetXlsxUrl(sheetUrl);

  if (!exportUrl) {
    sendJson(response, 400, { error: "Google Sheets URL is invalid." });
    return;
  }

  try {
    const requestedGid = extractSheetGid(sheetUrl);
    const sheetResponse = await fetch(exportUrl, {
      headers: { accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*" },
    });
    const buffer = await sheetResponse.arrayBuffer();
    const contentType = sheetResponse.headers.get("content-type") || "";

    if (!sheetResponse.ok) {
      const detail = new TextDecoder().decode(buffer.slice(0, 300));
      sendJson(response, sheetResponse.status, {
        error: "Google Sheets request failed.",
        detail,
      });
      return;
    }

    if (contentType.includes("text/html")) {
      const detail = new TextDecoder().decode(buffer.slice(0, 300));
      sendJson(response, 502, {
        error: "Google Sheets returned an HTML page instead of XLSX. Check sheet sharing permissions.",
        detail,
      });
      return;
    }

    const workbook = XLSX.read(Buffer.from(buffer), { type: "buffer" });
    const sheetNames = workbook.SheetNames;
    const gidSheetName = requestedGid ? findSheetNameByGid(workbook, requestedGid) : "";
    const selectedSheet = chooseSheetName(sheetNames, requestedSheet || gidSheetName);
    const worksheet = workbook.Sheets[selectedSheet];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      blankrows: false,
      defval: "",
    });

    sendJson(response, 200, {
      sourceUrl: sheetUrl,
      exportUrl,
      sheetNames,
      selectedSheet,
      updatedAt: new Date().toISOString(),
      rows,
    });
  } catch (error) {
    sendJson(response, 502, {
      error: "Failed to fetch Google Sheets data.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function chooseSheetName(sheetNames, requestedSheet) {
  if (sheetNames.includes(requestedSheet)) return requestedSheet;

  const preferredNames = ["레이드종합", "레이드캘린더", "개인레이드", "레이드골드"];
  return preferredNames.find((name) => sheetNames.includes(name)) || sheetNames[0];
}

function extractSheetGid(sheetUrl) {
  return sheetUrl.match(/[?&#]gid=(\d+)/)?.[1] || "";
}

function findSheetNameByGid(workbook, gid) {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const sheetGid = sheet?.["!gid"] ?? sheet?.["!sheetId"];
    if (String(sheetGid) === String(gid)) return sheetName;
  }

  return "";
}

function buildGoogleSheetXlsxUrl(sheetUrl) {
  try {
    const parsed = new URL(sheetUrl);
    const match = parsed.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    const id = match?.[1];
    if (!id) return "";

    return `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
  } catch {
    return "";
  }
}

function buildAssetCandidates(assetName) {
  const cleanName = assetName.replace(/\.(png|jpg|jpeg|webp)$/i, "");
  const lowerName = cleanName.toLowerCase();
  const folders = Array.from(
    new Set([
      lowerName.split("_").slice(0, 1).join("_"),
      lowerName.split("_").slice(0, 2).join("_"),
      lowerName.split("_").slice(0, 3).join("_"),
      lowerName,
      "emoticon",
      "buff",
      "arkpassive",
      "skill",
      "ability",
      "etc",
    ]),
  ).filter(Boolean);

  return folders.flatMap((folder) => [
    `https://cdn-lostark.game.onstove.com/efui_iconatlas/${folder}/${cleanName}.png`,
    `https://cdn-lostark.game.onstove.com/efui_iconatlas/${folder}/${lowerName}.png`,
  ]);
}

async function fetchLostarkJson(apiUrl, lostarkApiKey) {
  const response = await fetch(apiUrl, {
    headers: {
      accept: "application/json",
      authorization: `bearer ${lostarkApiKey}`,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  return { body, response };
}

function getLostarkApiKey() {
  const key = process.env.LOSTARK_API_KEY || readEnvFile().LOSTARK_API_KEY || "";
  return key.replace(/^["']|["']$/g, "").trim();
}

async function serveStatic(response, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const normalized = normalize(decodeURIComponent(requestedPath))
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^[/\\]+/, "");
  const filePath = join(publicDir, normalized);

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
    });
    response.end(file);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/api/roster") {
    await handleRosterRequest(request, response, url);
    return;
  }

  if (url.pathname === "/api/character") {
    await handleCharacterRequest(request, response, url);
    return;
  }

  if (url.pathname === "/api/asset") {
    await handleAssetRequest(request, response, url);
    return;
  }

  if (url.pathname === "/api/sheet") {
    await handleSheetRequest(request, response, url);
    return;
  }

  await serveStatic(response, url.pathname);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Try PORT=5178 npm run dev or stop the existing process.`);
    process.exit(1);
  }

  throw error;
});

server.listen(port, () => {
  console.log(`Lost Ark Homework Party Builder running at http://localhost:${port}`);
});
