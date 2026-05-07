import {
  formatDateLabel,
  normalizeSheetDateValue,
  parseSheetDate,
  parseSheetTime,
} from "./dateUtils.js";

const DEFAULT_FALLBACK_TIME = "";
const DEFAULT_OWNER_NAME = "미정";
const DATE_RE = /^\d{4}\.\s*\d{1,2}\.\s*\d{1,2}$/;
const KNOWN_RAID_TITLES = ["카제로스", "세르카", "지평", "지팽막걸리", "아르모체"];

export function buildRaidSchedule({ settingRows = [], raidCalendarRows = [], raidCalendarCols = [] } = {}) {
  const settingLookup = parseSettingRows(settingRows);
  const raidBlocks = collectRaidColumnBlocks(raidCalendarCols, raidCalendarRows);
  const raidNameLookup = buildRaidNameLookup(raidBlocks);

  const parsedRaids = parseRaidCalendarRows({
    raidBlocks,
    raidNameLookup,
    rows: raidCalendarRows,
    settingLookup,
  });

  return parsedRaids
    .map((raid, raidIndex) => {
      const participants = raid.members.map((characterName) => decorateParticipant(characterName, settingLookup));
      const item = {
        blockTime: raid.blockTime,
        date: raid.date,
        dayLabel: formatDateLabel(raid.date),
        endCol: raid.endCol,
        endRow: raid.endRow,
        id: `${raid.date || "unscheduled"}-${raid.blockTime || raid.time || "time"}-${slugify(raid.raidName)}-${raidIndex}`,
        participantCount: participants.length,
        participants,
        raidName: raid.raidName,
        startCol: raid.startCol,
        startRow: raid.startRow,
        time: raid.blockTime || raid.time || DEFAULT_FALLBACK_TIME,
      };
      return item;
    })
    .sort(compareRaidOrder);
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

    raidBlocks.forEach((block) => {
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
  const raids = [];
  let currentParty = null;
  let seenMembers = new Set();

  for (let rowIndex = blockStartRow; rowIndex <= blockEndRow; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const header = findRaidHeaderInBlock(row, block, raidNameLookup, settingLookup);

    if (header) {
      if (currentParty?.members.length > 0) {
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
      seenMembers = new Set();
      continue;
    }

    if (!currentParty) {
      continue;
    }

    const members = extractMembersFromRow(row, block.startCol, block.endCol, settingLookup);
    for (const member of members) {
      const normalized = normalizeKey(member);
      if (seenMembers.has(normalized)) continue;
      seenMembers.add(normalized);
      currentParty.members.push(member);
    }
  }

  if (currentParty?.members.length > 0) {
    currentParty.endRow = blockEndRow;
    raids.push(currentParty);
  }

  return raids;
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
          endCol: Number.isFinite(nextIndex) ? nextIndex - 1 : index,
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
        endCol: Number.isFinite(nextIndex) ? nextIndex - 1 : index,
        raidName,
        startCol: index,
      };
    })
    .sort((left, right) => left.startCol - right.startCol);
}

function buildRaidNameLookup(raidBlocks) {
  const knownTitles = KNOWN_RAID_TITLES.map((title) => normalizeKey(title));
  return new Set([...knownTitles, ...raidBlocks.map((block) => normalizeKey(block.raidName)).filter(Boolean)]);
}

function findRaidHeaderInBlock(row, block, raidNameLookup, settingLookup) {
  for (let columnIndex = block.startCol; columnIndex <= block.endCol && columnIndex < row.length; columnIndex += 1) {
    const value = cleanText(row[columnIndex]);
    if (!value) continue;
    if (isNoiseCell(value) || isColorCode(value) || parseSheetDate(value) || parseSheetTime(value)) continue;
    if (isCharacterValue(value, settingLookup)) continue;

    const normalized = normalizeKey(value);
    if (raidNameLookup.has(normalized)) {
      return normalizeRaidName(value);
    }
  }

  return "";
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

function parseSettingRows(rows) {
  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => {
      const text = normalizeKey(cell);
      return text === "character" || text === "charactername" || text === "캐릭터";
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

function slugify(value) {
  return cleanText(value)
    .replace(/\s+/g, "-")
    .replace(/[^0-9a-zA-Z가-힣-]/g, "")
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
