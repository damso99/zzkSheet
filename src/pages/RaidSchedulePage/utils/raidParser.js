import { formatDateLabel, parseSheetDate, parseSheetTime } from "./dateUtils.js";

const DEFAULT_FALLBACK_TIME = "";
const DEFAULT_OWNER_NAME = "미지정";

export function buildRaidSchedule({ settingRows = [], raidCalendarRows = [] } = {}) {
  const settingLookup = parseSettingRows(settingRows);
  const raidBlocks = parseRaidCalendarRows(raidCalendarRows);

  return raidBlocks
    .flatMap((block, blockIndex) =>
      block.raids.map((raid, raidIndex) => {
        const participants = raid.characterNames.map((characterName) =>
          decorateParticipant(characterName, settingLookup),
        );

        return {
          date: block.date,
          dayLabel: block.dayLabel,
          id: `${block.date || "unscheduled"}-${raid.time || "time"}-${slugify(raid.raidName)}-${blockIndex}-${raidIndex}`,
          participantCount: participants.length,
          participants,
          raidName: raid.raidName,
          time: raid.time || DEFAULT_FALLBACK_TIME,
        };
      }),
    )
    .sort(compareRaidTime);
}

export function buildFallbackRaidSchedule(todayIsoDate) {
  return [
    {
      date: todayIsoDate,
      dayLabel: formatDateLabel(todayIsoDate),
      id: `${todayIsoDate}-fallback-raid`,
      participantCount: 1,
      participants: [
        {
          characterName: "미지정",
          ownerName: DEFAULT_OWNER_NAME,
          level: "-",
          power: "-",
        },
      ],
      raidName: "일정 없음",
      time: DEFAULT_FALLBACK_TIME,
    },
  ];
}

function parseRaidCalendarRows(rows) {
  const dateRows = findDateRows(rows);

  return dateRows
    .map((dateRow, blockIndex) => {
      const nextDateRowIndex = dateRows[blockIndex + 1]?.index ?? rows.length;
      const dateRowData = rows[dateRow.index] || [];
      const blockEndIndex = Math.max(dateRow.index, nextDateRowIndex - 1);
      const blockRows = rows.slice(dateRow.index, nextDateRowIndex);
      const blockTime = findBlockTime(blockRows);
      const raidColumns = collectRaidColumns(dateRowData);

      const raids = raidColumns
        .map((columnIndex) => {
          const raidName = normalizeRaidName(dateRowData[columnIndex]);
          if (!raidName) return null;

          const characterNames = collectParticipants({
            rows,
            startIndex: dateRow.index + 1,
            endIndex: blockEndIndex,
            columnIndex,
            raidName,
          });

          if (!characterNames.length) return null;

          return {
            columnIndex,
            raidName,
            characterNames,
            time: blockTime,
          };
        })
        .filter(Boolean);

      return {
        date: dateRow.date,
        dayLabel: formatDateLabel(dateRow.date),
        index: dateRow.index,
        raids,
      };
    })
    .filter((block) => block.raids.length > 0);
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

function collectRaidColumns(row) {
  return (row || [])
    .map((cell, index) => ({ cell: cleanText(cell), index }))
    .filter(({ cell, index }) => {
      if (index <= 0) return false;
      if (!cell) return false;
      if (parseSheetDate(cell)) return false;
      if (parseSheetTime(cell)) return false;
      if (isColorCode(cell)) return false;
      if (isNoiseCell(cell)) return false;
      return true;
    })
    .map(({ index }) => index);
}

function collectParticipants({ rows, startIndex, endIndex, columnIndex, raidName }) {
  const participants = [];
  const seen = new Set();

  for (let rowIndex = startIndex; rowIndex <= endIndex; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const value = cleanText(row[columnIndex]);

    if (!value) continue;
    if (isNoiseCell(value) || isColorCode(value) || parseSheetDate(value) || parseSheetTime(value)) continue;
    if (normalizeKey(value) === normalizeKey(raidName)) continue;

    const normalizedValue = normalizeKey(value);
    if (seen.has(normalizedValue)) continue;

    seen.add(normalizedValue);
    participants.push(value);
  }

  return participants;
}

function findBlockTime(rows) {
  for (const row of rows || []) {
    for (const cell of row || []) {
      const time = extractTimeLabel(cell);
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
    .replace(/[^0-9a-zA-Z가-힣_-]/g, "")
    .toLowerCase();
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
