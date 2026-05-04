export const DEFAULT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1pn-86CBr_9TzKI1zncCXpo3Ge0rKjg8zA99v6twX_gA/edit?gid=456006472#gid=456006472";

export const DEFAULT_TARGET_GID = "456006472";

const REQUIRED_SHEETS = ["SETTING", "Calendar", "레이드캘린더"];

export async function loadRaidSheetBundle({ sheetUrl = DEFAULT_SHEET_URL, targetGid = DEFAULT_TARGET_GID } = {}) {
  const targetSheetUrl = ensureGid(sheetUrl, targetGid);

  const [targetSheet, ...scheduleSheets] = await Promise.all([
    fetchSheetRows({ sheetUrl: targetSheetUrl }),
    ...REQUIRED_SHEETS.map((sheetName) => fetchSheetRows({ sheetUrl: targetSheetUrl, sheetName })),
  ]);

  const rowsBySheetName = Object.fromEntries(
    scheduleSheets.map((sheet) => [sheet.selectedSheet, sheet.rows]),
  );

  // NOTE:
  // The prompt asked to inspect the raw rows first.
  // Keep these logs in place while tuning parser rules against the real sheet.
  console.groupCollapsed("[sheetApi] raw Google Sheet rows");
  console.log("target gid rows", targetSheet.rows);
  console.log("SETTING rows", rowsBySheetName.SETTING || []);
  console.log("Calendar rows", rowsBySheetName.Calendar || []);
  console.log("레이드캘린더 rows", rowsBySheetName["레이드캘린더"] || []);
  console.groupEnd();

  return {
    fetchedAt: new Date().toISOString(),
    noticeRows: targetSheet.rows,
    raidCalendarRows: rowsBySheetName["레이드캘린더"] || [],
    calendarRows: rowsBySheetName.Calendar || [],
    settingRows: rowsBySheetName.SETTING || [],
    sourceUrl: targetSheetUrl,
    targetGid,
  };
}

async function fetchSheetRows({ sheetUrl, sheetName = "" }) {
  const params = new URLSearchParams({ url: sheetUrl });
  if (sheetName) params.set("sheet", sheetName);

  const response = await fetch(`/api/raid-sheet?${params.toString()}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.detail || payload?.error || "시트 데이터를 불러오지 못했습니다.");
  }

  return payload;
}

function ensureGid(sheetUrl, gid) {
  if (!gid) return sheetUrl;
  if (sheetUrl.includes("gid=")) return sheetUrl;
  return `${sheetUrl}${sheetUrl.includes("?") ? "&" : "?"}gid=${gid}`;
}
