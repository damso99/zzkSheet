import { formatLocalDateTime } from "./dateUtils.js";

export const DEFAULT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1pn-86CBr_9TzKI1zncCXpo3Ge0rKjg8zA99v6twX_gA/edit?gid=57930127#gid=57930127";

export const DEFAULT_TARGET_GID = "57930127";

const SHEET_GIDS = {
  setting: "279415455",
  raidCalendar: "57930127",
};

const SHEET_NAMES = {
  setting: "SETTING",
  raidCalendar: "레이드캘린더",
};

const SHEET_CACHE_TTL_MS = 60 * 1000;
const sheetRowsCache = new Map();
const sheetRowsInFlight = new Map();
const bundleCache = new Map();
const bundleInFlight = new Map();

export async function loadRaidSheetBundle({
  sheetUrl = DEFAULT_SHEET_URL,
  targetGid = DEFAULT_TARGET_GID,
  forceRefresh = false,
  signal,
} = {}) {
  const targetSheetUrl = ensureGid(sheetUrl, targetGid);
  const cacheKey = `${targetSheetUrl}:${targetGid}`;
  const cachedBundle = getFreshCacheEntry(bundleCache, cacheKey, SHEET_CACHE_TTL_MS);
  if (!forceRefresh && cachedBundle) {
    return withAbortSignal(Promise.resolve(cachedBundle), signal);
  }

  if (!forceRefresh && bundleInFlight.has(cacheKey)) {
    return withAbortSignal(bundleInFlight.get(cacheKey), signal);
  }

  const promise = (async () => {
    const [raidCalendarSheet, settingSheet] = await Promise.all([
      fetchSheetRows({
        forceRefresh,
        sheetUrl: targetSheetUrl,
        gid: SHEET_GIDS.raidCalendar,
        sheetName: SHEET_NAMES.raidCalendar,
      }),
      fetchSheetRows({
        forceRefresh,
        sheetUrl: targetSheetUrl,
        gid: SHEET_GIDS.setting,
        sheetName: SHEET_NAMES.setting,
      }),
    ]);

    const payload = {
      fetchedAt: formatLocalDateTime(new Date()),
      raidCalendarCols: raidCalendarSheet.cols || [],
      raidCalendarRows: raidCalendarSheet.rows || [],
      settingRows: settingSheet.rows || [],
      sourceUrl: targetSheetUrl,
      targetGid,
    };

    setCacheEntry(bundleCache, cacheKey, payload);
    return payload;
  })();

  bundleInFlight.set(cacheKey, promise);

  try {
    return await withAbortSignal(promise, signal);
  } finally {
    if (bundleInFlight.get(cacheKey) === promise) {
      bundleInFlight.delete(cacheKey);
    }
  }
}

export async function loadSheetRowsByName({
  sheetUrl = DEFAULT_SHEET_URL,
  sheetName,
  gid = "",
  forceRefresh = false,
  signal,
} = {}) {
  if (!sheetName) {
    throw new Error("sheetName is required.");
  }

  const targetSheetUrl = ensureGid(sheetUrl, gid || extractGidFromUrl(sheetUrl));
  return withAbortSignal(
    fetchSheetRows({
      sheetUrl: targetSheetUrl,
      gid,
      sheetName,
      forceRefresh,
    }),
    signal,
  );
}

async function fetchSheetRows({ sheetUrl, gid, sheetName, forceRefresh = false }) {
  const params = new URLSearchParams({ url: sheetUrl });
  if (gid) params.set("gid", gid);
  if (sheetName) params.set("sheet", sheetName);

  const cacheKey = params.toString();
  const cachedRows = forceRefresh ? null : getFreshCacheEntry(sheetRowsCache, cacheKey, SHEET_CACHE_TTL_MS);
  if (cachedRows) {
    return cachedRows;
  }

  if (!forceRefresh && sheetRowsInFlight.has(cacheKey)) {
    return sheetRowsInFlight.get(cacheKey);
  }

  const promise = (async () => {
    const response = await fetch(`/api/raid-sheet?${cacheKey}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.detail || payload?.error || "시트를 불러오지 못했습니다.");
    }

    setCacheEntry(sheetRowsCache, cacheKey, payload);
    return payload;
  })();

  sheetRowsInFlight.set(cacheKey, promise);

  try {
    return await promise;
  } catch (error) {
    sheetRowsCache.delete(cacheKey);
    throw error;
  } finally {
    if (sheetRowsInFlight.get(cacheKey) === promise) {
      sheetRowsInFlight.delete(cacheKey);
    }
  }
}

function withAbortSignal(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    const handleAbort = () => reject(createAbortError());

    signal.addEventListener("abort", handleAbort, { once: true });

    promise.then(
      (value) => {
        signal.removeEventListener("abort", handleAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", handleAbort);
        reject(error);
      },
    );
  });
}

function createAbortError() {
  const error = new Error("Request aborted");
  error.name = "AbortError";
  return error;
}

function ensureGid(sheetUrl, gid) {
  if (!gid) return sheetUrl;
  if (sheetUrl.includes("gid=")) return sheetUrl;
  return `${sheetUrl}${sheetUrl.includes("?") ? "&" : "?"}gid=${gid}`;
}

function extractGidFromUrl(sheetUrl) {
  if (!sheetUrl) return "";
  const match = sheetUrl.match(/[?&#]gid=(\d+)/);
  return match?.[1] || "";
}

function getFreshCacheEntry(cache, key, ttlMs) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCacheEntry(cache, key, value) {
  cache.set(key, {
    createdAt: Date.now(),
    value,
  });
}
