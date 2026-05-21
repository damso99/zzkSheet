import {
  formatDateLabel,
  getScheduleStartAt,
  normalizeSheetDateValue,
  parseSheetDate,
  parseSheetTime,
} from "./dateUtils.js";

const DEFAULT_FALLBACK_TIME = "";
const DEFAULT_OWNER_NAME = "미지정";
const DATE_RE = /^\d{4}\.\s*\d{1,2}\.\s*\d{1,2}$/;
const KNOWN_RAID_TITLES = [
  "\uce74\uc81c\ub85c\uc2a4",
  "\uc138\ub974\uce74",
  "\uc9c0\ud3c9",
  "\uc9c0\ud33d\ub9c9\uac78\ub9ac",
  "\uc544\ub974\ubaa8\uccb4",
  "익스트림 아브렐슈드",
  "EX 아브렐슈드",
  "\uc775\uc2a4\ud2b8\ub9bc \uc5d0\uae30\ub974",
  "\uc77c\uc815\uc5c6\uc74c",
];

export function buildRaidSchedule({ settingRows = [], raidCalendarRows = [], raidCalendarCols = [] } = {}) {
  const settingLookup = parseSettingRows(settingRows);
  const raidBlocks = collectRaidColumnBlocks(raidCalendarCols, raidCalendarRows);
  const raidNameLookup = buildRaidNameLookup(raidBlocks);
  const titleCache = new Map();

  const parsedRaids = parseRaidCalendarRows({
    raidBlocks,
    raidNameLookup,
    rows: raidCalendarRows,
    settingLookup,
  });

  const normalizedRaids = parsedRaids
    .map((raid, raidIndex) => {
      const participants = raid.members.map((characterName) => decorateParticipant(characterName, settingLookup));
      const titleSearchRow = raid.titleLookupRow ?? raid.startRow;
      const titleCacheKey = `${titleSearchRow}:${raid.startCol}:${raid.endCol}`;
      const directRaidTitle = resolveRaidTitleFromRows({
        raid,
        raidCalendarRows,
        raidNameLookup,
        settingLookup,
      });
      const resolvedRaidName = normalizeRaidNameToCanonicalRaidName(
        findRaidTitleByPosition({
          endCol: raid.endCol,
          raidNameLookup,
          rowIndex: titleSearchRow,
          rows: raidCalendarRows,
          settingLookup,
          startCol: raid.startCol,
        }) || "미지정",
      );
      const cachedFinalRaidName = titleCache.get(titleCacheKey);
      const fallbackRaidName = normalizeRaidNameToCanonicalRaidName(raid.raidName) || "미지정";
      const canonicalRaidTitle =
        raid.titleOverride ||
        directRaidTitle ||
        (isRaidTitle(resolvedRaidName) && !isSkippedRaidTitle(resolvedRaidName) ? resolvedRaidName : "");
      const resolvedFallbackRaidName = isSkippedRaidTitle(resolvedRaidName) ? "" : resolvedRaidName;
      const finalRaidName =
        cachedFinalRaidName ||
        canonicalRaidTitle ||
        resolvedFallbackRaidName ||
        fallbackRaidName;
      if (!cachedFinalRaidName) {
        titleCache.set(titleCacheKey, finalRaidName);
      }
      const item = {
        blockTime: raid.blockTime,
        date: raid.date,
        dayLabel: formatDateLabel(raid.date),
        endCol: raid.endCol,
        endRow: raid.endRow,
        id: `${raid.date || "unscheduled"}-${raid.blockTime || raid.time || "time"}-${slugify(finalRaidName)}-${raidIndex}`,
        participantCount: participants.length,
        participants,
        raidName: finalRaidName,
        startAt: getScheduleStartAt(raid.date, raid.blockTime || raid.time || DEFAULT_FALLBACK_TIME),
        startCol: raid.startCol,
        startRow: raid.startRow,
        time: raid.blockTime || raid.time || DEFAULT_FALLBACK_TIME,
      };
      return item;
    })
    .sort(compareRaidOrder);

  return normalizedRaids;
}

export function buildFallbackRaidSchedule(todayIsoDate) {
  const normalizedDate = normalizeSheetDateValue(todayIsoDate);

  return [
    {
      blockTime: DEFAULT_FALLBACK_TIME,
      date: normalizedDate,
      dayLabel: formatDateLabel(normalizedDate),
      endCol: 0,
      endRow: 0,
      id: `${normalizedDate || todayIsoDate || "fallback"}-fallback-raid`,
      participantCount: 1,
      participants: [
        {
          characterName: "일정 없음",
          ownerName: DEFAULT_OWNER_NAME,
          level: "-",
          power: "-",
        },
      ],
      raidName: "일정 없음",
      startAt: getScheduleStartAt(normalizedDate, DEFAULT_FALLBACK_TIME),
      startCol: 0,
      startRow: 0,
      time: DEFAULT_FALLBACK_TIME,
    },
  ];
}

function parseRaidCalendarRows({ rows = [], raidBlocks = [], raidNameLookup = new Set(), settingLookup = new Map() } = {}) {
  const dateRows = findDateRows(rows);
  const raids = [];

  dateRows.forEach((dateRow, dateRowIndex) => {
    const nextDateRow = dateRows[dateRowIndex + 1];
    const blockStartRow = dateRow.index;
    const blockTime = findBlockTimeFromColumnA(rows, dateRow.index, nextDateRow?.index);
    const blockEndRow = (nextDateRow?.index ?? rows.length) - 1;
    const dateScopedBlocks =
      collectRaidColumnBlocksForDateBlock(rows, blockStartRow - 1) || raidBlocks;

    dateScopedBlocks.forEach((block) => {
      raids.push(
        ...collectRaidsForBlock({
          block,
          blockEndRow,
          blockStartRow,
          blockTime,
          date: dateRow.date,
          raidNameLookup,
          rows,
          settingLookup,
        }),
      );
    });
  });

  return raids;
}

function collectRaidsForBlock({
  rows,
  block,
  blockStartRow,
  blockEndRow,
  blockTime,
  date,
  raidNameLookup,
  settingLookup,
}) {
  const scanStartRow = Math.max(0, blockStartRow - 1);
  const hasCanonicalTitleInBlock = hasCanonicalRaidTitleInRange(rows, scanStartRow, blockEndRow, block, raidNameLookup);
  if (isSkippedRaidTitle(block.raidName) && !hasCanonicalTitleInBlock) {
    return [];
  }

  const raids = [];
  let currentParty = createParty({
    blockTime,
    date,
    endCol: block.endCol,
    raidName: block.raidName,
    startCol: block.startCol,
    startRow: blockStartRow,
  });
  let seenMembers = new Set();

  for (let rowIndex = scanStartRow; rowIndex <= blockEndRow; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const canonicalRaidTitle = findCanonicalRaidTitleInRow(row, block, raidNameLookup);
    if (canonicalRaidTitle) {
      currentParty.titleOverride = canonicalRaidTitle;
    }
    const header = findRaidHeaderInBlock(row, block, raidNameLookup);

    if (header) {
      if (header === "일정없음" && hasCanonicalTitleInBlock) {
        continue;
      }

      if (currentParty.members.length > 0) {
        currentParty.endRow = rowIndex - 1;
        raids.push(currentParty);
      }

      currentParty = createParty({
        blockTime,
        date,
        endCol: block.endCol,
        raidName: header,
        startCol: block.startCol,
        startRow: rowIndex,
      });
      currentParty.titleOverride = canonicalRaidTitle || currentParty.titleOverride || "";
      seenMembers = new Set();
      continue;
    }

    const members = extractMembersFromRow(row, block.startCol, block.endCol, settingLookup);
    for (const member of members) {
      if (currentParty.members.length === 0) {
        currentParty.titleLookupRow = rowIndex;
      }

      const normalized = normalizeKey(member);
      if (seenMembers.has(normalized)) continue;
      seenMembers.add(normalized);
      currentParty.members.push(member);
    }
  }

  if (currentParty.members.length > 0) {
    currentParty.endRow = blockEndRow;
    raids.push(currentParty);
  }

  return raids;
}

function hasCanonicalRaidTitleInRange(rows, startRow, endRow, block, raidNameLookup) {
  for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    if (findCanonicalRaidTitleInRow(row, block, raidNameLookup)) {
      return true;
    }
  }

  return false;
}

function resolveRaidTitleFromRows({ raid, raidCalendarRows, raidNameLookup }) {
  const startRow = Math.max(0, (raid.titleLookupRow ?? raid.startRow ?? 0) - 1);
  const endRow = Math.min(
    raidCalendarRows.length - 1,
    Math.max(raid.endRow ?? raid.startRow ?? 0, raid.startRow ?? 0) + 2,
  );
  const block = {
    endCol: raid.endCol ?? 0,
    startCol: raid.startCol ?? 0,
  };

  for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
    const row = raidCalendarRows[rowIndex] || [];
    const canonicalRaidTitle = findCanonicalRaidTitleInRow(row, block, raidNameLookup);
    if (canonicalRaidTitle) {
      return canonicalRaidTitle;
    }
  }

  return "";
}

function createParty({ blockTime = "", date, raidName, startCol, endCol, startRow }) {
  return {
    blockTime: blockTime || "",
    date: normalizeSheetDateValue(date),
    endCol,
    endRow: startRow,
    members: [],
    raidName,
    startCol,
    startRow,
    time: blockTime || "",
    titleLookupRow: startRow,
  };
}

function findDateRows(rows) {
  return rows
    .map((row, index) => ({
      date: findDateInRow(row),
      index,
    }))
    .filter((item) => Boolean(item.date));
}

function findDateInRow(row) {
  const text = String(row?.[0] ?? "").trim();
  if (!text) return "";
  if (DATE_RE.test(text) || parseSheetDate(text)) {
    return normalizeSheetDateValue(text);
  }
  return "";
}

function findBlockTimeFromColumnA(rows, dateRow, nextDateRow) {
  const startRow = dateRow + 1;
  const endRow = nextDateRow ? nextDateRow - 1 : rows.length - 1;

  for (let rowIndex = endRow; rowIndex > dateRow; rowIndex -= 1) {
    const time = normalizeTime(rows[rowIndex]?.[0]);
    if (time) {
      return time;
    }
  }

  return "";
}

function collectRaidColumnBlocks(cols = [], rows = []) {
  const detectedEndCol = getDetectedEndCol(rows);
  const labeledColumns = cols
    .map((col, index) => ({
      index,
      label: cleanText(col?.label),
    }))
    .filter(({ label }) => Boolean(label));

  if (labeledColumns.length > 0) {
    return labeledColumns
      .map(({ index, label }, currentIndex) => {
        const nextIndex = labeledColumns[currentIndex + 1]?.index;
        return {
          endCol: Number.isFinite(nextIndex) ? nextIndex - 1 : detectedEndCol,
          raidName: normalizeRaidName(label),
          startCol: index,
        };
      })
      .sort((left, right) => left.startCol - right.startCol);
  }

  const anchorRow = rows.find((row) => row.some((cell) => isMeaningfulText(cell))) || [];
  const fallbackColumns = anchorRow
    .map((cell, index) => ({ cell: cleanText(cell), index }))
    .filter(({ cell }) => Boolean(cell) && !isNoiseCell(cell) && !isColorCode(cell))
    .map(({ cell, index }) => ({ index, raidName: normalizeRaidName(cell) }));

  return fallbackColumns
    .map(({ index, raidName }, currentIndex) => {
      const nextIndex = fallbackColumns[currentIndex + 1]?.index;
      return {
        endCol: Number.isFinite(nextIndex) ? nextIndex - 1 : detectedEndCol,
        raidName,
        startCol: index,
      };
    })
    .sort((left, right) => left.startCol - right.startCol);
}

function collectRaidColumnBlocksForDateBlock(rows = [], headerRowIndex = -1) {
  if (headerRowIndex < 0) return null;

  const headerRow = rows[headerRowIndex] || [];
  const detectedEndCol = getDetectedEndCol(rows);
  const titleColumns = [];

  for (let columnIndex = 0; columnIndex <= detectedEndCol; columnIndex += 1) {
    const rawValue = cleanText(headerRow[columnIndex]);
    if (!rawValue) continue;
    if (!isRaidTitle(rawValue)) continue;

    titleColumns.push({
      index: columnIndex,
      raidName: normalizeRaidName(rawValue),
    });
  }

  if (titleColumns.length === 0) {
    return null;
  }

  return titleColumns.map(({ index, raidName }, currentIndex) => {
    const nextIndex = titleColumns[currentIndex + 1]?.index;
    return {
      endCol: Number.isFinite(nextIndex) ? nextIndex - 1 : detectedEndCol,
      raidName,
      startCol: index,
    };
  });
}

function buildRaidNameLookup(raidBlocks) {
  const knownTitles = KNOWN_RAID_TITLES.map((title) => normalizeKey(title));
  return new Set([...knownTitles, ...raidBlocks.map((block) => normalizeKey(block.raidName)).filter(Boolean)]);
}

function isRaidTitle(value) {
  return Boolean(getCanonicalRaidTitle(value));
}

function getCanonicalRaidTitle(value) {
  const normalized = normalizeRaidName(value);
  if (
    normalized === "익스트림 아브렐슈드" ||
    normalized === "익스트림아브렐슈드" ||
    normalized === "EX 아브렐슈드" ||
    normalized === "EX아브렐슈드"
  ) {
    return "EX 아브렐슈드";
  }

  return KNOWN_RAID_TITLES.includes(normalized) ? normalized : "";
}

function isSkippedRaidTitle(value) {
  return normalizeRaidName(value) === "일정없음";
}

function findCanonicalRaidTitleInRow(row, block, raidNameLookup) {
  for (let columnIndex = block.startCol; columnIndex <= block.endCol && columnIndex < row.length; columnIndex += 1) {
    const value = cleanText(row[columnIndex]);
    if (!value) continue;
    if (isNoiseCell(value) || isColorCode(value) || parseSheetDate(value) || parseSheetTime(value)) continue;

    const canonical = getCanonicalRaidTitle(value);
    if (canonical) {
      return canonical;
    }

    if (raidNameLookup.has(normalizeKey(value))) {
      return normalizeRaidNameToCanonicalRaidName(value);
    }
  }

  return "";
}

function findRaidHeaderInBlock(row, block, raidNameLookup) {
  for (let columnIndex = block.startCol; columnIndex <= block.endCol && columnIndex < row.length; columnIndex += 1) {
    const value = cleanText(row[columnIndex]);
    if (!value) continue;
    if (isNoiseCell(value) || isColorCode(value) || parseSheetDate(value) || parseSheetTime(value)) continue;

    const normalized = normalizeKey(value);
    if (raidNameLookup.has(normalized)) {
      return normalizeRaidNameToCanonicalRaidName(value);
    }
  }

  return "";
}

function findRaidTitleByPosition({
  rows = [],
  rowIndex = 0,
  startCol = 0,
  endCol = 0,
  settingLookup = new Map(),
  raidNameLookup = new Set(),
} = {}) {
  const candidateColumns = buildCandidateTitleColumns(startCol, endCol);

  for (let currentRowIndex = rowIndex; currentRowIndex >= 0; currentRowIndex -= 1) {
    const row = rows[currentRowIndex] || [];

    for (const columnIndex of candidateColumns) {
      if (columnIndex >= row.length) continue;
      const value = cleanText(row[columnIndex]);
      if (!value) continue;
      if (isNoiseCell(value) || isColorCode(value) || parseSheetDate(value) || parseSheetTime(value)) continue;
      if (isCharacterValue(value, settingLookup)) continue;
      if (isSkippedRaidTitle(value)) continue;

      const normalized = normalizeKey(value);
      if (raidNameLookup.has(normalized)) {
        return normalizeRaidName(value);
      }
    }
  }

  const fullRow = rows[rowIndex] || [];
  for (let columnIndex = 0; columnIndex < fullRow.length; columnIndex += 1) {
    const value = cleanText(fullRow[columnIndex]);
    if (!value) continue;
    if (isNoiseCell(value) || isColorCode(value) || parseSheetDate(value) || parseSheetTime(value)) continue;
    if (isCharacterValue(value, settingLookup)) continue;
    if (isSkippedRaidTitle(value)) continue;

    const canonical = getCanonicalRaidTitle(value);
    if (canonical) {
      return canonical;
    }

    if (raidNameLookup.has(normalizeKey(value))) {
      return normalizeRaidNameToCanonicalRaidName(value);
    }
  }

  return "";
}

function buildCandidateTitleColumns(startCol, endCol) {
  const columns = [];
  const midpoint = Math.floor((startCol + endCol) / 2);
  const preferredColumns = [
    startCol,
    startCol - 1,
    startCol + 1,
    startCol - 2,
    startCol + 2,
    midpoint,
    endCol,
    endCol - 1,
    endCol + 1,
  ];

  preferredColumns.forEach((columnIndex) => {
    if (columnIndex < 0) return;
    if (!columns.includes(columnIndex)) {
      columns.push(columnIndex);
    }
  });

  for (let columnIndex = startCol; columnIndex <= endCol; columnIndex += 1) {
    if (!columns.includes(columnIndex)) {
      columns.push(columnIndex);
    }
  }

  return columns;
}

function extractMembersFromRow(row, startCol, endCol, settingLookup) {
  const members = [];

  for (let columnIndex = startCol; columnIndex <= endCol && columnIndex < row.length; columnIndex += 1) {
    const value = cleanText(row[columnIndex]);
    if (!value) continue;
    if (isNoiseCell(value) || isColorCode(value) || parseSheetDate(value) || parseSheetTime(value)) continue;
    if (!isCharacterValue(value, settingLookup)) continue;

    members.push(value);
  }

  return members;
}

function getDetectedEndCol(rows = []) {
  let detectedEndCol = 0;

  rows.forEach((row) => {
    const currentEndCol = findLastMeaningfulColumnIndex(row);
    if (currentEndCol > detectedEndCol) {
      detectedEndCol = currentEndCol;
    }
  });

  return detectedEndCol;
}

function findLastMeaningfulColumnIndex(row = []) {
  for (let columnIndex = row.length - 1; columnIndex >= 0; columnIndex -= 1) {
    const value = cleanText(row[columnIndex]);
    if (value) {
      return columnIndex;
    }
  }

  return 0;
}

function parseSettingRows(rows) {
  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => {
      const text = normalizeKey(cell);
      return text === "character" || text === "charactername" || text === "charactername";
    }),
  );

  const metadataByCharacter = new Map();
  if (headerRowIndex < 0) return metadataByCharacter;

  const characterColumn = 1;
  const levelColumn = 3;
  const powerColumn = 4;
  const ownerColumn = 9;

  rows.slice(headerRowIndex + 1).forEach((row) => {
    const characterName = cleanText(row[characterColumn]);
    if (!characterName) return;

    metadataByCharacter.set(normalizeKey(characterName), {
      characterName,
      level: cleanText(row[levelColumn]) || "-",
      ownerName: cleanText(row[ownerColumn]) || DEFAULT_OWNER_NAME,
      power: cleanText(row[powerColumn]) || "-",
    });
  });

  return metadataByCharacter;
}

function isCharacterValue(value, settingLookup) {
  const text = cleanText(value);
  if (!text) return false;
  return settingLookup.has(normalizeKey(text));
}

function decorateParticipant(characterName, settingLookup) {
  const metadata = settingLookup.get(normalizeKey(characterName));

  return {
    characterName,
    level: metadata?.level || "-",
    ownerName: metadata?.ownerName || DEFAULT_OWNER_NAME,
    power: metadata?.power || "-",
  };
}

function compareRaidOrder(left, right) {
  const leftDate = left.date || "9999-12-31";
  const rightDate = right.date || "9999-12-31";

  if (leftDate !== rightDate) {
    return leftDate.localeCompare(rightDate);
  }

  if ((left.startCol ?? 0) !== (right.startCol ?? 0)) {
    return (left.startCol ?? 0) - (right.startCol ?? 0);
  }

  return (left.startRow ?? 0) - (right.startRow ?? 0);
}

function normalizeTime(value) {
  if (value == null || value === "") return "";

  if (value instanceof Date) {
    const hh = String(value.getHours()).padStart(2, "0");
    const mm = String(value.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const fraction = ((value % 1) + 1) % 1;
    const totalMinutes = Math.round(fraction * 24 * 60);
    const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  const text = String(value).trim();
  const gvizMatch = text.match(/^Date\(\d{4},\d{1,2},\d{1,2},(\d{1,2}),(\d{1,2}),(\d{1,2})\)$/);
  if (gvizMatch) {
    const hh = String(Number(gvizMatch[1])).padStart(2, "0");
    const mm = String(Number(gvizMatch[2])).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  const match = text.match(/([01]?\d|2[0-3]):[0-5]\d/);
  return match ? match[0].padStart(5, "0") : "";
}

function normalizeRaidName(value) {
  return cleanText(value).replace(/\s+/g, " ").trim();
}

function normalizeRaidNameToCanonicalRaidName(value) {
  const normalized = normalizeRaidName(value);
  if (
    normalized === "익스트림 아브렐슈드" ||
    normalized === "익스트림아브렐슈드" ||
    normalized === "EX 아브렐슈드" ||
    normalized === "EX아브렐슈드"
  ) {
    return "EX 아브렐슈드";
  }

  return normalized;
}

function slugify(value) {
  return cleanText(value)
    .replace(/\s+/g, "-")
    .replace(/[^0-9A-Za-z가-힣-]/g, "")
    .toLowerCase();
}

function isMeaningfulText(value) {
  const text = cleanText(value);
  return Boolean(text) && !isNoiseCell(text) && !isColorCode(text);
}

function isNoiseCell(value) {
  const text = String(value || "").trim();
  return (
    !text ||
    text === "-" ||
    text === "+" ||
    text === "TRUE" ||
    text === "FALSE" ||
    text === "#REF!" ||
    /^\d+$/.test(text) ||
    /^#[0-9a-f]{3,8}$/i.test(text) ||
    /^https?:\/\//i.test(text)
  );
}

function isColorCode(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "").trim());
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .trim();
}

function normalizeKey(value) {
  return cleanText(value).replace(/\s+/g, "").toLowerCase();
}










