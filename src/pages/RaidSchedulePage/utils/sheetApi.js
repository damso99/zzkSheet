import { formatLocalDateTime, normalizeSheetDateValue } from "./dateUtils.js";

export const DEFAULT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1pn-86CBr_9TzKI1zncCXpo3Ge0rKjg8zA99v6twX_gA/edit?gid=57930127#gid=57930127";

export const DEFAULT_TARGET_GID = "57930127";

const SHEET_GIDS = {
  setting: "279415455",
  raidCalendar: "57930127",
};

const SHEET_NAMES = {
  setting: "SETTING",
  raidCalendar: "\ub808\uc774\ub4dc\uce98\ub9b0\ub354",
};

export async function loadRaidSheetBundle({ sheetUrl = DEFAULT_SHEET_URL, targetGid = DEFAULT_TARGET_GID } = {}) {
  const targetSheetUrl = ensureGid(sheetUrl, targetGid);

  const [raidCalendarSheet, settingSheet] = await Promise.all([
    fetchSheetRows({
      sheetUrl: targetSheetUrl,
      gid: SHEET_GIDS.raidCalendar,
      sheetName: SHEET_NAMES.raidCalendar,
    }),
    fetchSheetRows({
      sheetUrl: targetSheetUrl,
      gid: SHEET_GIDS.setting,
      sheetName: SHEET_NAMES.setting,
    }),
  ]);

  const raidCalendarRows = raidCalendarSheet.rows || [];
  const raidCalendarCols = raidCalendarSheet.cols || [];
  const maxColLength = Math.max(0, ...raidCalendarRows.map((row) => row.length));
  const rawDayGroups = summarizeRawDayGroups(raidCalendarRows);
  const saturdayRows = raidCalendarRows
    .map((row, index) => ({
      aValue: row?.[0] ?? "",
      normalizedDate: normalizeSheetDateValue(row?.[0]),
      rowLength: row.length,
      rowNumber: index + 1,
      tailPreview: row.slice(Math.max(0, row.length - 6)),
    }))
    .filter((entry) => entry.normalizedDate === "2026-05-09");

  console.log("[raid-calendar/debug] raw rows:", raidCalendarRows.length);
  console.log("[raid-calendar/debug] max columns:", maxColLength);
  console.log("[raid-calendar/debug] fetch source:", raidCalendarSheet.sourceUrl || targetSheetUrl);
  console.table(rawDayGroups);
  console.log("[raid-calendar/debug] saturday raw check:", saturdayRows);

  return {
    fetchedAt: formatLocalDateTime(new Date()),
    raidCalendarCols,
    raidCalendarRows,
    settingRows: settingSheet.rows || [],
    sourceUrl: targetSheetUrl,
    targetGid,
  };
}

async function fetchSheetRows({ sheetUrl, gid, sheetName }) {
  const params = new URLSearchParams({ url: sheetUrl });
  if (gid) params.set("gid", gid);
  if (sheetName) params.set("sheet", sheetName);
  const response = await fetch(`/api/raid-sheet?${params.toString()}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.detail || payload?.error || "시트를 불러오지 못했습니다.");
  }

  return payload;
}

function ensureGid(sheetUrl, gid) {
  if (!gid) return sheetUrl;
  if (sheetUrl.includes("gid=")) return sheetUrl;
  return `${sheetUrl}${sheetUrl.includes("?") ? "&" : "?"}gid=${gid}`;
}

function summarizeRawDayGroups(rows = []) {
  const groups = [];
  let currentGroup = null;

  rows.forEach((row, index) => {
    const normalizedDate = normalizeSheetDateValue(row?.[0]);
    if (normalizedDate) {
      currentGroup = {
        day: normalizedDate,
        rawCols: row.length,
        rawRows: 1,
      };
      groups.push(currentGroup);
      return;
    }

    if (!currentGroup) return;
    currentGroup.rawRows += 1;
    currentGroup.rawCols = Math.max(currentGroup.rawCols, row.length);
  });

  return groups;
}
