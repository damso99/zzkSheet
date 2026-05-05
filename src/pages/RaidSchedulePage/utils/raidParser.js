import { parseSheetDate, parseSheetTime } from "./dateUtils.js";

const DAY_CODE_TO_LABEL = {
  WED: "\uC218",
  THU: "\uBAA9",
  FRI: "\uAE08",
  SAT: "\uD1A0",
  SUN: "\uC77C",
  MON: "\uC6D4",
  TUE: "\uD654",
};

const DAY_LABEL_TO_CODE = Object.fromEntries(
  Object.entries(DAY_CODE_TO_LABEL).map(([code, label]) => [label, code]),
);

const DEFAULT_TIME_SEQUENCE = ["10:00", "10:30", "11:00", "11:30", "12:00"];
const WEEKDAY_CODES = new Set(["WED", "THU", "FRI", "SAT", "SUN", "MON", "TUE"]);

export function buildRaidSchedule({ settingRows, calendarRows, raidCalendarRows }) {
  const settingLookup = parseSettingRows(settingRows);
  const raidBlocks = parseRaidCalendarRows(raidCalendarRows);
  const calendarSlots = parseCalendarRows(calendarRows);

  return mergeRaidData({ calendarSlots, raidBlocks, settingLookup }).sort(compareRaidTime);
}

export function buildFallbackRaidSchedule(todayIsoDate) {
  return [
    {
      date: todayIsoDate,
      dayLabel: "미지정",
      id: `${todayIsoDate}-fallback-raid`,
      raidName: "미지정",
      time: "10:00",
      participants: [
        { characterName: "미지정", ownerName: "미지정", level: "-", power: "-" },
      ],
      participantCount: 1,
    },
  ];
}

function mergeRaidData({ calendarSlots, raidBlocks, settingLookup }) {
  const calendarMap = new Map();

  calendarSlots.forEach((slot) => {
    calendarMap.set(slot.matchKey, slot);
  });

  console.log("Calendar match keys:", [...calendarMap.keys()]);

  const merged = [];

  raidBlocks.forEach((block) => {
    block.raids.forEach((raid, raidIndex) => {
      const matchKey = buildCalendarMatchKey(block.dayCode, raidIndex);
      const slot = calendarMap.get(matchKey) || null;
      const participants = raid.characterNames.map((characterName) =>
        decorateParticipant(characterName, settingLookup),
      );

      if (!slot) {
        console.warn("Calendar 일정 매칭 실패:", {
          raidName: raid.raidName,
          day: DAY_CODE_TO_LABEL[block.dayCode] || block.dayCode,
          columnIndex: raid.columnIndex,
          rowIndex: block.index,
          partyIndex: raidIndex,
          matchKey,
        });
      }

      merged.push({
        date: slot?.date || null,
        dayCode: block.dayCode,
        dayLabel: DAY_CODE_TO_LABEL[block.dayCode] || "미지정",
        id: `${slot?.date || "unscheduled"}-${slot?.time || `slot-${raidIndex}`}-${raid.raidName}-${block.index}-${raidIndex}`,
        participants,
        participantCount: participants.length,
        raidName: raid.raidName,
        time: slot?.time || null,
      });
    });
  });

  return merged;
}

function parseSettingRows(rows) {
  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => {
      const text = cleanText(cell).toUpperCase();
      return text === "CHARACTER" || text === "\uCE90\uB9AD\uD130";
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
      ownerName: cleanText(row[ownerColumn]) || "미지정",
      power: cleanText(row[powerColumn]) || "-",
    });
  });

  return metadataByCharacter;
}

function parseCalendarRows(rows) {
  const dateRowIndex = findBestDateRowIndex(rows);
  const dateColumns = getDateColumns(rows[dateRowIndex] || []);
  const timeRows = collectTimeRows(rows, 0, rows.length - 1);
  const slots = [];

  dateColumns.forEach((columnIndex) => {
    const date = parseSheetDate(rows[dateRowIndex]?.[columnIndex]);
    if (!date) return;

    const dayCode = toDayCode(date);
    let partyIndex = 0;
    let pendingTime = "";

    for (let rowIndex = dateRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
      const value = cleanText(rows[rowIndex]?.[columnIndex]);
      if (!value || isCalendarNoiseCell(value) || isColorCode(value)) continue;

      const inlineTime = normalizeTimeLabel(parseSheetTime(value));
      if (inlineTime) {
        pendingTime = inlineTime;
        continue;
      }

      if (isCalendarDetailRow(rows, rowIndex, columnIndex)) continue;

      const matchKey = buildCalendarMatchKey(dayCode, partyIndex);

      slots.push({
        columnIndex,
        date,
        dayCode,
        matchKey,
        partyIndex,
        rowIndex,
        time: pendingTime || resolveTimeForRow(rowIndex, timeRows),
      });

      pendingTime = "";
      partyIndex += 1;
    }
  });

  return slots;
}

function parseRaidCalendarRows(rows) {
  const blocks = findDayBlocks(rows);

  return blocks.map((block, blockIndex) => {
    const headerRow = rows[block.index - 1] || [];
    const nextBlockIndex = blocks[blockIndex + 1]?.index ?? rows.length;
    const blockEndIndex = Math.max(block.index, nextBlockIndex - 1);
    const raidColumns = getRaidColumnsFromHeader(headerRow);
    const raidTitleSet = buildRaidTitleSet(headerRow, raidColumns);

    const raids = raidColumns
      .map((column) => {
        const raidName = normalizeRaidName(headerRow[column.index]);
        if (!raidName) return null;

        const characterNames = collectCharactersInColumn(
          rows,
          column.index,
          block.index,
          blockEndIndex,
          raidTitleSet,
        );

        if (characterNames.length === 0) return null;

        return {
          columnIndex: column.index,
          raidName,
          characterNames,
        };
      })
      .filter(Boolean);

    return {
      dayCode: block.dayCode,
      index: block.index,
      raids,
    };
  });
}

function findDayBlocks(rows) {
  return rows
    .map((row, index) => ({
      dayCode: DAY_LABEL_TO_CODE[cleanText(row[0])] || "",
      index,
    }))
    .filter((item) => WEEKDAY_CODES.has(item.dayCode));
}

function getRaidColumnsFromHeader(headerRow) {
  return headerRow
    .map((cell, index) => ({ cell: cleanText(cell), index }))
    .filter(({ cell, index }) => index > 1 && cell && !isNoiseCell(cell) && !isColorCode(cell));
}

function buildRaidTitleSet(headerRow, raidColumns) {
  const titles = new Set();

  raidColumns.forEach(({ index }) => {
    const raidName = normalizeKey(headerRow[index]);
    if (raidName) titles.add(raidName);
  });

  return titles;
}

function findBestDateRowIndex(rows) {
  const searchLimit = Math.min(rows.length - 1, 8);
  let bestRowIndex = -1;
  let bestScore = -1;

  for (let rowIndex = 0; rowIndex <= searchLimit; rowIndex += 1) {
    const score = rows[rowIndex].reduce(
      (count, cell) => count + Number(Boolean(parseSheetDate(cell))),
      0,
    );

    if (score > bestScore) {
      bestScore = score;
      bestRowIndex = rowIndex;
    }
  }

  return bestRowIndex >= 0 ? bestRowIndex : 0;
}

function getDateColumns(row) {
  return row
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => Boolean(parseSheetDate(cell)))
    .map(({ index }) => index);
}

function collectTimeRows(rows, startIndex, endIndex) {
  const timeRows = [];

  for (let rowIndex = startIndex; rowIndex <= endIndex; rowIndex += 1) {
    const time = normalizeTimeLabel(parseSheetTime(rows[rowIndex]?.[1]));
    if (!time) continue;
    timeRows.push({ rowIndex, time });
  }

  return timeRows.length > 0
    ? timeRows
    : DEFAULT_TIME_SEQUENCE.map((time, index) => ({
        rowIndex: startIndex + index,
        time,
      }));
}

function resolveTimeForRow(rowIndex, timeRows) {
  let activeBase = null;

  for (const timeRow of timeRows) {
    if (timeRow.rowIndex <= rowIndex) {
      activeBase = timeRow;
      continue;
    }
    break;
  }

  if (!activeBase) return null;

  const baseMinutes = toMinutes(activeBase.time);
  const halfHourSteps = Math.max(0, Math.ceil((rowIndex - activeBase.rowIndex) / 2));
  return toTimeLabel(baseMinutes + halfHourSteps * 30);
}

function collectCharactersInColumn(rows, columnIndex, startIndex, endIndex, raidTitleSet) {
  const characters = [];

  for (let rowIndex = startIndex; rowIndex <= endIndex; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    if (!rowHasParticipantContent(row, raidTitleSet)) continue;

    const value = cleanText(row[columnIndex]);
    if (!value || isNoiseCell(value) || isColorCode(value)) continue;
    if (raidTitleSet.has(normalizeKey(value))) continue;
    if (!characters.includes(value)) characters.push(value);
  }

  return characters;
}

function rowHasParticipantContent(row, raidTitleSet) {
  return row.some((cell, index) => {
    if (index <= 1) return false;

    const value = cleanText(cell);
    if (!value || isNoiseCell(value) || isColorCode(value)) return false;

    return !raidTitleSet.has(normalizeKey(value));
  });
}

function isCalendarDetailRow(rows, rowIndex, columnIndex) {
  const value = cleanText(rows[rowIndex]?.[columnIndex]);
  if (!isCalendarDetailCell(value)) return false;

  const previousValue = cleanText(rows[rowIndex - 1]?.[columnIndex]);
  return Boolean(previousValue) && !normalizeTimeLabel(parseSheetTime(previousValue));
}

function decorateParticipant(characterName, settingLookup) {
  const metadata = settingLookup.get(normalizeKey(characterName));

  return {
    characterName,
    level: metadata?.level || "-",
    ownerName: metadata?.ownerName || "미지정",
    power: metadata?.power || "-",
  };
}

function buildCalendarMatchKey(dayCode, partyIndex) {
  return `${dayCode}_${partyIndex}`;
}

function normalizeRaidName(value) {
  return cleanText(value)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTimeLabel(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return `${String(hours >= 24 ? hours - 24 : hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toMinutes(timeLabel) {
  const match = String(timeLabel).match(/^(\d{2}):(\d{2})$/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function toTimeLabel(totalMinutes) {
  const normalizedMinutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toDayCode(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  const day = date.getDay();

  switch (day) {
    case 0:
      return "SUN";
    case 1:
      return "MON";
    case 2:
      return "TUE";
    case 3:
      return "WED";
    case 4:
      return "THU";
    case 5:
      return "FRI";
    case 6:
      return "SAT";
    default:
      return "";
  }
}

function compareRaidTime(left, right) {
  const leftDate = left.date || "9999-12-31";
  const rightDate = right.date || "9999-12-31";
  const leftTime = left.time || "99:99";
  const rightTime = right.time || "99:99";
  return `${leftDate} ${leftTime}`.localeCompare(`${rightDate} ${rightTime}`);
}

function isColorCode(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "").trim());
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

function isCalendarNoiseCell(value) {
  const text = String(value || "").trim();
  return (
    !text ||
    text === "-" ||
    text === "+" ||
    text === "TRUE" ||
    text === "FALSE" ||
    text === "#REF!" ||
    /^#[0-9a-f]{3,8}$/i.test(text) ||
    /^https?:\/\//i.test(text)
  );
}

function isCalendarDetailCell(value) {
  const text = cleanText(value);
  return /^\d+$/.test(text) || /^[A-Z]$/i.test(text);
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
