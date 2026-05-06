import {
  formatDateLabel,
  normalizeSheetDateValue,
  parseSheetDate,
  parseSheetTime,
} from "./dateUtils.js";

const DEFAULT_FALLBACK_TIME = "";
const DEFAULT_OWNER_NAME = "unknown";

export function buildRaidSchedule({ settingRows = [], raidCalendarRows = [] } = {}) {
  console.log("[ACTIVE RAID PARSER]", "buildRaidSchedule");

  const settingLookup = parseSettingRows(settingRows);
  const parsedRaids = parseRaidCalendarRows(raidCalendarRows);

  console.table(
    parsedRaids.map((raid) => ({
      date: raid.date,
      endCol: raid.endCol,
      memberCount: raid.members.length,
      members: raid.members.join(", "),
      raidName: raid.raidName,
      startCol: raid.startCol,
      time: raid.time,
    })),
  );

  return parsedRaids
    .map((raid, raidIndex) => {
      const participants = raid.members.map((characterName) => decorateParticipant(characterName, settingLookup));
      const item = {
        date: raid.date,
        dayLabel: formatDateLabel(raid.date),
        id: `${raid.date || "unscheduled"}-${raid.time || "time"}-${slugify(raid.raidName)}-${raidIndex}`,
        participantCount: participants.length,
        participants,
        raidName: raid.raidName,
        startCol: raid.startCol,
        endCol: raid.endCol,
        time: raid.time || DEFAULT_FALLBACK_TIME,
      };

      console.log("[RAW RAID ITEM]", item);
      return item;
    })
    .sort(compareRaidTime);
}

export function buildFallbackRaidSchedule(todayIsoDate) {
  const normalizedDate = normalizeSheetDateValue(todayIsoDate);

  return [
    {
      date: normalizedDate,
      dayLabel: formatDateLabel(normalizedDate),
      id: `${normalizedDate || todayIsoDate || "fallback"}-fallback-raid`,
      participantCount: 1,
      participants: [
        {
          characterName: "info missing",
          ownerName: DEFAULT_OWNER_NAME,
          level: "-",
          power: "-",
        },
      ],
      raidName: "no schedule",
      time: DEFAULT_FALLBACK_TIME,
    },
  ];
}

function parseRaidCalendarRows(rows = []) {
  const dateRows = findDateRows(rows);
  const raids = [];

  dateRows.forEach((dateRow, dateRowIndex) => {
    const nextDateRowIndex = dateRows[dateRowIndex + 1]?.index ?? rows.length;
    const titleRowIndex = findLastNonEmptyRowIndex(rows, dateRow.index, nextDateRowIndex - 1);

    if (titleRowIndex < dateRow.index) return;

    const titleRow = rows[titleRowIndex] || [];
    const partyBlocks = collectPartyBlocksFromTitleRow(titleRow);

    partyBlocks.forEach(({ raidName, startCol, endCol }) => {
      const members = collectRaidMembers({
        endIndex: titleRowIndex - 1,
        endCol,
        raidName,
        rows,
        startCol,
        startIndex: dateRow.index,
      });

      if (!raidName || !members.length) return;

      const time = findBlockTime(rows, dateRow.index, titleRowIndex - 1, startCol, endCol);

      raids.push({
        date: normalizeSheetDateValue(dateRow.date),
        endCol,
        members,
        raidName,
        startCol,
        time,
      });
    });
  });

  return raids;
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
  for (const cell of row || []) {
    const date = parseSheetDate(cell);
    if (date) return date;
  }

  return "";
}

function findLastNonEmptyRowIndex(rows, startIndex, endIndex) {
  for (let rowIndex = endIndex; rowIndex >= startIndex; rowIndex -= 1) {
    const row = rows[rowIndex] || [];
    if (row.some((cell) => isMeaningfulText(cell))) {
      return rowIndex;
    }
  }

  return startIndex;
}

function collectPartyBlocksFromTitleRow(row) {
  const titleColumns = (row || [])
    .map((cell, index) => ({ cell: cleanText(cell), index }))
    .filter(({ cell, index }) => {
      if (!cell) return false;
      if (index < 0) return false;
      if (isNoiseCell(cell) || isColorCode(cell)) return false;
      if (parseSheetDate(cell) || parseSheetTime(cell)) return false;
      return true;
    })
    .map(({ index, cell }) => ({ index, raidName: normalizeRaidName(cell) }))
    .filter(({ raidName }) => Boolean(raidName));

  return titleColumns
    .map(({ index, raidName }, titleIndex) => {
      const nextIndex = titleColumns[titleIndex + 1]?.index;

      return {
        endCol: Number.isFinite(nextIndex) ? nextIndex - 1 : index,
        raidName,
        startCol: index,
      };
    })
    .sort((left, right) => left.startCol - right.startCol);
}

function collectRaidMembers({ rows, startIndex, endIndex, startCol, endCol, raidName }) {
  const members = [];
  const seen = new Set();
  const raidNameKey = normalizeKey(raidName);

  for (let rowIndex = startIndex; rowIndex <= endIndex; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    for (let columnIndex = startCol; columnIndex <= endCol && columnIndex < row.length; columnIndex += 1) {
      const value = cleanText(row[columnIndex]);
      if (!value) continue;
      if (isNoiseCell(value) || isColorCode(value) || parseSheetDate(value) || parseSheetTime(value)) continue;

      const normalizedValue = normalizeKey(value);
      if (normalizedValue === raidNameKey) continue;
      if (seen.has(normalizedValue)) continue;

      seen.add(normalizedValue);
      members.push(value);
    }
  }

  return members;
}

function findBlockTime(rows, startIndex, endIndex, startCol, endCol) {
  for (let rowIndex = startIndex; rowIndex <= endIndex; rowIndex += 1) {
    const row = rows[rowIndex] || [];

    for (let columnIndex = startCol; columnIndex <= endCol && columnIndex < row.length; columnIndex += 1) {
      const time = extractTimeLabel(row[columnIndex]);
      if (time) return time;
    }
  }

  return "";
}

function extractTimeLabel(value) {
  const text = cleanText(value);
  if (!text) return "";
  if (parseSheetDate(text)) return "";
  if (isColorCode(text) || isNoiseCell(text)) return "";

  const directTime = normalizeTimeLabel(parseSheetTime(text));
  if (directTime) return directTime;

  const inlineMatch = text.match(/\b(\d{1,2}:\d{2})\b/);
  if (inlineMatch) return normalizeTimeLabel(inlineMatch[1]);

  return "";
}

function parseSettingRows(rows) {
  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => {
      const text = cleanText(cell).toLowerCase();
      return text === "character" || text === "캐릭터";
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

function decorateParticipant(characterName, settingLookup) {
  const metadata = settingLookup.get(normalizeKey(characterName));

  return {
    characterName,
    level: metadata?.level || "-",
    ownerName: metadata?.ownerName || DEFAULT_OWNER_NAME,
    power: metadata?.power || "-",
  };
}

function compareRaidTime(left, right) {
  const leftDate = left.date || "9999-12-31";
  const rightDate = right.date || "9999-12-31";
  const leftTime = left.time || "99:99";
  const rightTime = right.time || "99:99";

  return `${leftDate} ${leftTime} ${left.raidName || ""}`.localeCompare(
    `${rightDate} ${rightTime} ${right.raidName || ""}`,
  );
}

function normalizeRaidName(value) {
  return cleanText(value).replace(/\s+/g, " ").trim();
}

function normalizeTimeLabel(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return `${String(hours >= 24 ? hours - 24 : hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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
