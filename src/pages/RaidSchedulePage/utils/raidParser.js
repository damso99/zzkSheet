import { parseSheetDate, parseSheetTime } from "./dateUtils.js";

const DAY_CODE_TO_LABEL = {
  WED: "수",
  THU: "목",
  FRI: "금",
  SAT: "토",
  SUN: "일",
  MON: "월",
  TUE: "화",
};

const DAY_LABEL_TO_CODE = Object.fromEntries(
  Object.entries(DAY_CODE_TO_LABEL).map(([code, label]) => [label, code]),
);

const DEFAULT_TIME_SEQUENCE = ["10:00", "10:30", "11:00", "11:30", "12:00"];

export function buildRaidSchedule({ settingRows, calendarRows, raidCalendarRows }) {
  const settingLookup = parseSettingRows(settingRows);
  const calendarSlots = parseCalendarRows(calendarRows);
  const raidBlocks = parseRaidCalendarRows(raidCalendarRows);

  return mergeRaidData({
    calendarSlots,
    raidBlocks,
    settingLookup,
  }).sort(compareRaidTime);
}

export function buildFallbackRaidSchedule(todayIsoDate) {
  return [
    {
      date: todayIsoDate,
      dayLabel: "미지정",
      id: `${todayIsoDate}-10:00-카제로스-0`,
      raidName: "카제로스",
      time: "10:00",
      participants: [
        { characterName: "코카콜라아이스가나초콜릿", ownerName: "미지정", level: "-", power: "-" },
        { characterName: "Erbia", ownerName: "미지정", level: "-", power: "-" },
      ],
      participantCount: 2,
    },
  ];
}

function mergeRaidData({ calendarSlots, raidBlocks, settingLookup }) {
  const slotQueues = new Map();

  calendarSlots.forEach((slot) => {
    const key = buildSlotKey(slot.dayCode, slot.raidName);
    if (!slotQueues.has(key)) slotQueues.set(key, []);
    slotQueues.get(key).push(slot);
  });

  const merged = [];

  raidBlocks.forEach((block) => {
    block.raids.forEach((raid, raidIndex) => {
      const queue = slotQueues.get(buildSlotKey(block.dayCode, raid.raidName));
      const slot = queue?.shift() || null;
      const participants = raid.characterNames.map((characterName) =>
        decorateParticipant(characterName, settingLookup),
      );

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
    row.some((cell) => cleanText(cell).toUpperCase() === "CHARACTER"),
  );

  const metadataByCharacter = new Map();

  const characterColumn = 1;
  const levelColumn = 3;
  const powerColumn = 4;
  const ownerColumn = 9;

  if (headerRowIndex < 0) return metadataByCharacter;

  rows.slice(headerRowIndex + 1).forEach((row) => {
    const characterName = cleanText(row[characterColumn]);
    if (!characterName || characterName.toUpperCase() === "CHARACTER") return;

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
  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => WEEKDAY_CODES.has(cleanText(cell).toUpperCase())),
  );

  if (headerRowIndex < 0) return [];

  const dayColumns = rows[headerRowIndex]
    .map((cell, index) => ({
      dayCode: cleanText(cell).toUpperCase(),
      index,
    }))
    .filter((item) => WEEKDAY_CODES.has(item.dayCode));

  const dateRowIndex = findDateRowIndex(rows, headerRowIndex, dayColumns);
  const timeRows = collectTimeRows(rows, headerRowIndex);
  const endRowIndex = findScheduleEndRowIndex(rows, dateRowIndex + 1);

  const slots = [];

  dayColumns.forEach(({ dayCode, index }) => {
    const date = dateRowIndex >= 0 ? parseSheetDate(rows[dateRowIndex]?.[index]) : "";

    for (let rowIndex = dateRowIndex + 1; rowIndex <= endRowIndex; rowIndex += 1) {
      const raidName = normalizeRaidName(rows[rowIndex]?.[index]);
      if (!raidName) continue;

      slots.push({
        date: date || null,
        dayCode,
        raidName,
        time: resolveTimeForRow(rowIndex, timeRows),
      });
    }
  });

  return slots;
}

function parseRaidCalendarRows(rows) {
  const dayLabelRows = rows
    .map((row, index) => ({
      dayCode: DAY_LABEL_TO_CODE[cleanText(row[0])] || "",
      index,
    }))
    .filter((item) => item.dayCode);

  return dayLabelRows.map(({ dayCode, index }, blockIndex) => {
    const headerRow = rows[index - 1] || [];
    const nextIndex = dayLabelRows[blockIndex + 1]?.index ?? rows.length;
    const raids = parseRaidColumns(headerRow, rows.slice(index, nextIndex));

    return {
      dayCode,
      index,
      raids,
    };
  });
}

function parseRaidColumns(headerRow, bodyRows) {
  const raidColumns = headerRow
    .map((value, columnIndex) => ({
      columnIndex,
      raidName: normalizeRaidName(value),
    }))
    .filter((item) => item.columnIndex > 1 && item.raidName)
    .slice(0, 4);

  return raidColumns.map(({ columnIndex, raidName }) => ({
    characterNames: collectParticipantsFromColumn(bodyRows, columnIndex),
    raidName,
  }));
}

function collectParticipantsFromColumn(rows, columnIndex) {
  const participants = [];

  rows.forEach((row) => {
    const value = cleanText(row[columnIndex]);
    if (!value || isNoiseCell(value) || isColorCode(value)) return;
    if (!participants.includes(value)) participants.push(value);
  });

  return participants;
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

function findDateRowIndex(rows, headerRowIndex, dayColumns) {
  let bestRowIndex = -1;
  let bestScore = -1;
  const searchEndIndex = Math.min(rows.length - 1, headerRowIndex + 40);

  for (let rowIndex = headerRowIndex + 1; rowIndex <= searchEndIndex; rowIndex += 1) {
    const score = dayColumns.reduce(
      (count, item) => count + Number(Boolean(parseSheetDate(rows[rowIndex]?.[item.index]))),
      0,
    );

    if (score > bestScore) {
      bestRowIndex = rowIndex;
      bestScore = score;
    }

    if (score === dayColumns.length && score > 0) {
      return rowIndex;
    }
  }

  return bestRowIndex;
}

function collectTimeRows(rows, headerRowIndex) {
  const timeRows = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const time = normalizeTimeLabel(parseSheetTime(rows[rowIndex]?.[1]));
    if (!time) continue;
    timeRows.push({ rowIndex, time });
  }

  return timeRows.length > 0 ? timeRows : DEFAULT_TIME_SEQUENCE.map((time, index) => ({
    rowIndex: headerRowIndex + 1 + index,
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

function findScheduleEndRowIndex(rows, startRowIndex) {
  const noteRowIndex = rows.findIndex((row, index) => {
    if (index < startRowIndex) return false;
    return row.some((cell) => SCHEDULE_NOTE_MARKERS.some((marker) => cleanText(cell).includes(marker)));
  });

  return noteRowIndex > 0 ? noteRowIndex - 1 : rows.length - 1;
}

function buildSlotKey(dayCode, raidName) {
  return `${dayCode}|${normalizeKey(raidName)}`;
}

function normalizeRaidName(value) {
  const text = cleanText(value);
  if (!text) return "";

  return text
    .replace(/\((?:하드|노말)\)/g, "")
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
    text === "TRUE" ||
    text === "FALSE" ||
    text === "+" ||
    text === "#REF!" ||
    /^#[0-9a-f]{3,8}$/i.test(text) ||
    /^https?:\/\//i.test(text)
  );
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

const WEEKDAY_CODES = new Set(["WED", "THU", "FRI", "SAT", "SUN", "MON", "TUE"]);
const SCHEDULE_NOTE_MARKERS = ["공지", "안내", "주의", "참고", "메모", "notice"];
