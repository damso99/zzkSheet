import { getSheetData, sendJson } from "./_shared.js";
import { fetchLostarkJson, getLostarkApiKey } from "./_lostark.js";

const LOSTARK_MARKET_BASE_URL = "https://developer-lostark.game.onstove.com";
const ITEM_PRICE_SHEET_NAME = "아이템시세";
const ITEM_PRICE_CATEGORY = {
  key: "engraving",
  label: "각인서",
  categoryCode: 40000,
};
const ITEM_PRICE_REQUEST_DELAY_MS = 180;
const ITEM_PRICE_SHEET_URL =
  process.env.ITEM_PRICE_SHEET_URL ||
  "https://docs.google.com/spreadsheets/d/1pn-86CBr_9TzKI1zncCXpo3Ge0rKjg8zA99v6twX_gA/edit?gid=1973331080#gid=1973331080";

export async function handleItemPriceRequest(request, response) {
  try {
    const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
    const forceRefresh = ["1", "true", "yes"].includes(String(url.searchParams.get("force") || "").toLowerCase());
    const apiKey = getLostarkApiKey();

    if (!apiKey) {
      sendJson(response, 503, {
        success: false,
        error: "LOSTARK_API_KEY is missing. Add it to server environment variables.",
      });
      return;
    }

    if (/[^\x20-\x7E]/.test(apiKey)) {
      sendJson(response, 503, {
        success: false,
        error: "LOSTARK_API_KEY contains invalid characters.",
        detail: "JWT 값만 그대로 넣어주세요. 한글 설명, 따옴표, 공백, 줄바꿈이 섞이면 안 됩니다.",
      });
      return;
    }

    const refreshResult = await refreshItemPriceSnapshot({ apiKey, forceRefresh });

    sendJson(response, 200, {
      success: true,
      ...refreshResult,
    });
  } catch (error) {
    console.error("[item-price]", error);
    sendJson(response, 502, {
      success: false,
      error: "Failed to refresh item price snapshot.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function refreshItemPriceSnapshot({ apiKey, forceRefresh = false }) {
  const now = new Date();
  const baseDate = resolveKstBusinessDate(now);
  const updatedAt = formatKstDateTime(now);

  const historyResult = await getSheetData(ITEM_PRICE_SHEET_URL, ITEM_PRICE_SHEET_NAME);
  if (historyResult.status !== 200) {
    throw new Error(historyResult.body?.detail || historyResult.body?.error || "Failed to read item price sheet.");
  }

  const historyRows = Array.isArray(historyResult.body?.rows) ? historyResult.body.rows : [];
  const historyItems = parseHistoryRows(historyRows);
  const currentSnapshotExists = historyItems.some((item) => item.baseDate === baseDate);

  if (!forceRefresh && currentSnapshotExists) {
    return {
      baseDate,
      categories: [ITEM_PRICE_CATEGORY],
      marketCount: 0,
      rowCount: historyItems.filter((item) => item.baseDate === baseDate).length,
      skipped: true,
      updatedAt,
    };
  }

  const marketItems = await fetchMarketItems(apiKey, ITEM_PRICE_CATEGORY);
  const snapshotRows = buildSnapshotRows({
    baseDate,
    updatedAt,
    historyItems,
    marketItems,
  });

  let saveResult = { insertedCount: 0, updatedCount: 0 };
  let saveError = "";

  try {
    saveResult = await saveSnapshotToSheet({
      baseDate,
      rows: snapshotRows,
      updatedAt,
    });
  } catch (error) {
    saveError = error instanceof Error ? error.message : String(error);
    console.warn("[item-price] snapshot save skipped:", saveError);
  }

  return {
    baseDate,
    categories: [ITEM_PRICE_CATEGORY],
    insertedCount: saveResult.insertedCount,
    updatedCount: saveResult.updatedCount,
    marketCount: marketItems.length,
    rowCount: snapshotRows.length,
    skipped: false,
    updatedAt,
    rows: snapshotRows,
    saveError: saveError || undefined,
  };
}

async function fetchMarketItems(apiKey, category) {
  const items = [];
  const maxPages = 25;

  for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
    const { body, response } = await fetchLostarkJsonWithBody(`${LOSTARK_MARKET_BASE_URL}/markets/items`, apiKey, {
      CategoryCode: Number(category.categoryCode),
      PageNo: pageNo,
    });

    if (!response.ok) {
      throw new Error(extractApiError(body) || `markets/items request failed for ${category.label} (${response.status}).`);
    }

    const pageItems = normalizeMarketItems(body, category);
    items.push(...pageItems);

    const totalCount = toNullableNumber(body?.TotalCount ?? body?.totalCount);
    const pageSize = toNullableNumber(body?.PageSize ?? body?.pageSize) || pageItems.length;
    const currentCount = pageNo * (pageSize || pageItems.length || 1);

    if (!pageItems.length) break;
    if (totalCount !== null && currentCount >= totalCount) break;
    if (pageItems.length < (pageSize || pageItems.length)) break;

    await wait(ITEM_PRICE_REQUEST_DELAY_MS);
  }

  return dedupeMarketItems(items);
}

function normalizeMarketItems(payload, category) {
  const rawItems =
    payload?.Items ||
    payload?.items ||
    payload?.MarketItems ||
    payload?.marketItems ||
    payload?.Rows ||
    payload?.rows ||
    [];

  return rawItems
    .map((item) => {
      const itemName = sanitizeText(item?.Name ?? item?.ItemName ?? item?.name);
      if (!itemName) return null;

      return {
        categoryKey: category.key,
        categoryLabel: category.label,
        icon: sanitizeText(item?.Icon ?? item?.icon ?? item?.IconUrl ?? item?.iconUrl ?? ""),
        itemName,
        grade: sanitizeText(item?.Grade ?? item?.ItemGrade ?? item?.grade ?? item?.itemGrade),
        todayPrice: toNumber(item?.CurrentMinPrice ?? item?.currentMinPrice ?? item?.CurrentPrice ?? item?.currentPrice),
      };
    })
    .filter(Boolean);
}

function buildSnapshotRows({ baseDate, updatedAt, historyItems, marketItems }) {
  const previousBaseDate = getPreviousBaseDate(historyItems, baseDate);
  const weeklyBaseDates = getPreviousBaseDates(historyItems, baseDate, 7);
  const historyByKeyAndDate = createHistoryIndex(historyItems);

  const rows = marketItems.map((item) => {
    const key = makeItemKey(item.itemName, item.grade);
    const yesterdayItem = previousBaseDate ? historyByKeyAndDate.get(makeHistoryKey(previousBaseDate, key)) : null;
    const weeklyPrices = weeklyBaseDates
      .map((date) => historyByKeyAndDate.get(makeHistoryKey(date, key)))
      .filter(Boolean)
      .map((entry) => entry.todayPrice)
      .filter((value) => Number.isFinite(value));

    const yesterdayPrice = yesterdayItem ? yesterdayItem.todayPrice : null;
    const diff = yesterdayPrice === null ? null : item.todayPrice - yesterdayPrice;
    const diffRate = yesterdayPrice && yesterdayPrice > 0 && diff !== null ? (diff / yesterdayPrice) * 100 : null;
    const weeklyAverage = weeklyPrices.length ? average(weeklyPrices) : null;
    const weeklyDiff = weeklyAverage === null ? null : item.todayPrice - weeklyAverage;
    const weeklyRate = weeklyAverage && weeklyAverage > 0 && weeklyDiff !== null ? (weeklyDiff / weeklyAverage) * 100 : null;

    return [
      baseDate,
      updatedAt,
      item.itemName,
      item.grade,
      item.todayPrice,
      yesterdayPrice,
      diff,
      diffRate,
      weeklyAverage,
      weeklyDiff,
      weeklyRate,
      resolveDirection(yesterdayPrice, diff),
      item.icon,
    ];
  });

  rows.sort((left, right) => {
    const priceDiff = toNumber(right[4]) - toNumber(left[4]);
    if (priceDiff !== 0) return priceDiff;
    return String(left[2]).localeCompare(String(right[2]), "ko");
  });

  return rows;
}

function parseHistoryRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  return rows
    .map((row) => {
      if (!Array.isArray(row)) return null;

      const baseDate = sanitizeText(row[0]);
      const itemName = sanitizeText(row[2]);
      const grade = sanitizeText(row[3]);
      const todayPrice = toNullableNumber(row[4]);

      if (!baseDate || !itemName || !grade || todayPrice === null) return null;

      return {
        baseDate,
        grade,
        itemName,
        key: makeItemKey(itemName, grade),
        todayPrice,
      };
    })
    .filter(Boolean);
}

function createHistoryIndex(historyItems) {
  const index = new Map();
  historyItems.forEach((item) => {
    index.set(makeHistoryKey(item.baseDate, item.key), item);
  });
  return index;
}

function getPreviousBaseDate(historyItems, currentBaseDate) {
  const dates = uniqueSortedDates(historyItems.map((item) => item.baseDate)).filter((date) => date < currentBaseDate);
  return dates.at(-1) || "";
}

function getPreviousBaseDates(historyItems, currentBaseDate, count) {
  return uniqueSortedDates(historyItems.map((item) => item.baseDate))
    .filter((date) => date < currentBaseDate)
    .slice(-count);
}

function uniqueSortedDates(dates) {
  return [...new Set(dates.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function dedupeMarketItems(items) {
  const seen = new Map();

  items.forEach((item) => {
    const key = makeItemKey(item.itemName, item.grade);
    if (!seen.has(key) || seen.get(key).todayPrice < item.todayPrice) {
      seen.set(key, item);
    }
  });

  return Array.from(seen.values());
}

async function saveSnapshotToSheet({ baseDate, rows, updatedAt }) {
  const scriptUrl = cleanEnvValue(process.env.ITEM_PRICE_SCRIPT_URL);
  if (!scriptUrl) {
    throw new Error("ITEM_PRICE_SCRIPT_URL is not configured. Add a Google Apps Script Web App URL for sheet writes.");
  }

  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      accept: "application/json",
    },
    body: JSON.stringify({
      baseDate,
      sheetName: ITEM_PRICE_SHEET_NAME,
      updatedAt,
      rows,
    }),
  });

  const text = await response.text();
  const payload = safeJsonParse(text);

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || text || "Failed to save item price snapshot.");
  }

  return {
    insertedCount: Number(payload?.insertedCount || 0),
    updatedCount: Number(payload?.updatedCount || 0),
  };
}

async function fetchLostarkJsonWithBody(url, apiKey, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      authorization: `bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { body: safeJsonParse(text) ?? text, response };
}

function resolveDirection(yesterdayPrice, diff) {
  if (yesterdayPrice === null || yesterdayPrice === undefined) return "NEW";
  if (diff === null || diff === undefined) return "SAME";
  if (diff > 0) return "UP";
  if (diff < 0) return "DOWN";
  return "SAME";
}

function resolveKstBusinessDate(date) {
  const now = new Date(date);
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const kstTime = now.getTime() + kstOffsetMs;
  const kstDate = new Date(kstTime);
  if (kstDate.getUTCHours() < 6) {
    kstDate.setUTCDate(kstDate.getUTCDate() - 1);
  }

  return [
    kstDate.getUTCFullYear(),
    String(kstDate.getUTCMonth() + 1).padStart(2, "0"),
    String(kstDate.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function formatKstDateTime(date) {
  const kstDate = toKstDate(date);
  return [
    kstDate.getUTCFullYear(),
    String(kstDate.getUTCMonth() + 1).padStart(2, "0"),
    String(kstDate.getUTCDate()).padStart(2, "0"),
  ].join("-") + ` ${String(kstDate.getUTCHours()).padStart(2, "0")}:${String(kstDate.getUTCMinutes()).padStart(2, "0")}:${String(kstDate.getUTCSeconds()).padStart(2, "0")}`;
}

function toKstDate(date) {
  return new Date(new Date(date).getTime() + 9 * 60 * 60 * 1000);
}

function makeItemKey(itemName, grade) {
  return `${sanitizeText(itemName)}||${sanitizeText(grade)}`;
}

function makeHistoryKey(baseDate, itemKey) {
  return `${baseDate}||${itemKey}`;
}

function average(values) {
  if (!values.length) return null;
  const sum = values.reduce((acc, value) => acc + Number(value || 0), 0);
  return sum / values.length;
}

function toNumber(value) {
  const numeric = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(numeric) ? numeric : 0;
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function sanitizeText(value) {
  return String(value ?? "").replace(/^['"]|['"]$/g, "").trim();
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractApiError(body) {
  if (!body) return "";
  if (typeof body === "string") return body.slice(0, 300);
  return sanitizeText(body?.detail || body?.error || body?.message || "");
}

function cleanEnvValue(value) {
  return String(value || "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
