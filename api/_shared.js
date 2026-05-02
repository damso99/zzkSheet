import XLSX from "xlsx";

export const ARMORY_ENDPOINTS = {
  profile: "profiles",
  equipment: "equipment",
  engravings: "engravings",
  gems: "gems",
  cards: "cards",
  arkpassive: "arkpassive",
  arkgrid: "arkgrid",
};

export function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

export function getLostarkApiKey() {
  return String(process.env.LOSTARK_API_KEY || "").replace(/^["']|["']$/g, "").trim();
}

export async function fetchLostarkJson(apiUrl, lostarkApiKey) {
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

export async function getSheetData(sheetUrl, requestedSheet = "") {
  if (!sheetUrl) {
    return { status: 400, body: { error: "url query is required." } };
  }

  const exportUrl = buildGoogleSheetXlsxUrl(sheetUrl);
  if (!exportUrl) {
    return { status: 400, body: { error: "Google Sheets URL is invalid." } };
  }

  const requestedGid = extractSheetGid(sheetUrl);
  const sheetResponse = await fetch(exportUrl, {
    headers: { accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*" },
  });
  const buffer = await sheetResponse.arrayBuffer();
  const contentType = sheetResponse.headers.get("content-type") || "";

  if (!sheetResponse.ok) {
    const detail = new TextDecoder().decode(buffer.slice(0, 300));
    return {
      status: sheetResponse.status,
      body: { error: "Google Sheets request failed.", detail },
    };
  }

  if (contentType.includes("text/html")) {
    const detail = new TextDecoder().decode(buffer.slice(0, 300));
    return {
      status: 502,
      body: {
        error: "Google Sheets returned an HTML page instead of XLSX. Check sheet sharing permissions.",
        detail,
      },
    };
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

  return {
    status: 200,
    body: {
      sourceUrl: sheetUrl,
      exportUrl,
      sheetNames,
      selectedSheet,
      updatedAt: new Date().toISOString(),
      rows,
    },
  };
}

export function buildAssetCandidates(assetName) {
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
