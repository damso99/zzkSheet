export const DEFAULT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1pn-86CBr_9TzKI1zncCXpo3Ge0rKjg8zA99v6twX_gA/edit?gid=57930127#gid=57930127";

export const DEFAULT_TARGET_GID = "57930127";

const SHEET_GIDS = {
  setting: "279415455",
  calendar: "521341679",
  raidCalendar: "57930127",
};

export async function loadRaidSheetBundle({ sheetUrl = DEFAULT_SHEET_URL, targetGid = DEFAULT_TARGET_GID } = {}) {
  const targetSheetUrl = ensureGid(sheetUrl, targetGid);

  const [raidCalendarSheet, calendarSheet, settingSheet] = await Promise.all([
    fetchSheetRows({ sheetUrl: targetSheetUrl, gid: SHEET_GIDS.raidCalendar }),
    fetchSheetRows({ sheetUrl: targetSheetUrl, gid: SHEET_GIDS.calendar }),
    fetchSheetRows({ sheetUrl: targetSheetUrl, gid: SHEET_GIDS.setting }),
  ]);

  console.groupCollapsed("[sheetApi] raw Google Sheet rows");
  console.log("레이드캘린더 rows", raidCalendarSheet.rows || []);
  console.log("Calendar rows", calendarSheet.rows || []);
  console.log("Setting rows", settingSheet.rows || []);
  console.groupEnd();

  return {
    fetchedAt: new Date().toISOString(),
    raidCalendarRows: raidCalendarSheet.rows || [],
    calendarRows: calendarSheet.rows || [],
    settingRows: settingSheet.rows || [],
    sourceUrl: targetSheetUrl,
    targetGid,
  };
}

async function fetchSheetRows({ sheetUrl, gid }) {
  const params = new URLSearchParams({ url: sheetUrl, gid });
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
