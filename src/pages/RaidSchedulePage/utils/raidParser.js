import { parseSheetDate, parseSheetTime, shiftIsoDate } from "./dateUtils.js";

const RAID_NAME_ALIASES = {
  노르모체: "아르모체",
  지평성당: "지평막걸리",
  하기르: "에기르",
};

const KOREAN_DAY_TO_CODE = {
  수: "WED",
  목: "THU",
  금: "FRI",
  토: "SAT",
  일: "SUN",
  월: "MON",
  화: "TUE",
};

const WEEKDAY_CODES = ["WED", "THU", "FRI", "SAT", "SUN", "MON", "TUE"];
const KNOWN_RAID_NAMES = ["카제로스", "세르카", "아르모체", "지평성당", "지평막걸리", "에기르", "하기르", "익스트림"];
const SCHEDULE_NOTE_ROW_MARKERS = ["본캐일정", "배드민턴", "여행"];

export function buildRaidSchedule({ settingRows, calendarRows, raidCalendarRows }) {
  const metadataByCharacter = parseSettingRows(settingRows);
  const calendarSlotsByDay = parseCalendarRows(calendarRows);
  const participantGroupsByDay = parseRaidCalendarRows(raidCalendarRows, calendarSlotsByDay);

  const raids = [];

  for (const dayCode of WEEKDAY_CODES) {
    const slots = calendarSlotsByDay.get(dayCode) || [];
    const participantQueues = buildParticipantQueues(participantGroupsByDay.get(dayCode) || []);

    slots.forEach((slot, slotIndex) => {
      const normalizedRaidName = normalizeRaidName(slot.raidName);
      const matchedGroup = participantQueues.get(normalizedRaidName)?.shift() || null;

      raids.push({
        date: slot.date,
        id: `${slot.date}-${slot.time}-${normalizedRaidName}-${slotIndex}`,
        participants: (matchedGroup?.characterNames || []).map((characterName) =>
          decorateParticipant(characterName, metadataByCharacter),
        ),
        raidName: normalizedRaidName,
        time: slot.time,
      });
    });
  }

  return raids.sort((left, right) => `${left.date}${left.time}`.localeCompare(`${right.date}${right.time}`));
}

function buildParticipantQueues(participantGroups) {
  const queues = new Map();

  participantGroups.forEach((group) => {
    const raidName = normalizeRaidName(group.raidName);
    if (!raidName) return;
    if (!queues.has(raidName)) queues.set(raidName, []);
    queues.get(raidName).push(group);
  });

  return queues;
}

export function buildFallbackRaidSchedule(todayIsoDate) {
  return [
    {
      date: todayIsoDate,
      id: `${todayIsoDate}-20:00-카제로스-A`,
      raidName: "카제로스",
      time: "20:00",
      participants: [
        { characterName: "포동포동한펭귄", ownerName: "펭귄", level: "1775.0", power: "5275.33" },
        { characterName: "Erbia", ownerName: "리아", level: "1776.66", power: "5002.80" },
        { characterName: "도롱다룽", ownerName: "지훈", level: "1775.83", power: "5230.92" },
      ],
    },
    {
      date: shiftIsoDate(todayIsoDate, 1),
      id: `${shiftIsoDate(todayIsoDate, 1)}-21:00-세르카-B`,
      raidName: "세르카",
      time: "21:00",
      participants: [
        { characterName: "코카콜라아이스티맥주소주", ownerName: "치호", level: "1790.0", power: "6858.13" },
        { characterName: "머키용Mk3", ownerName: "준현", level: "1780.83", power: "5774.47" },
        { characterName: "탱글퐁듀", ownerName: "태경", level: "1770.0", power: "5260.48" },
      ],
    },
  ];
}

function parseSettingRows(rows) {
  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => cleanText(cell).toUpperCase() === "CHARACTER"),
  );

  if (headerRowIndex < 0) return new Map();

  const metadataByCharacter = new Map();

  // NOTE:
  // The live sheet currently stores usable character metadata in fixed columns.
  // If the SETTING tab changes, adjust these indexes first.
  const CHARACTER_COLUMN = 1;
  const LEVEL_COLUMN = 3;
  const MAX_POWER_COLUMN = 4;
  const OWNER_COLUMN = 9;

  rows.slice(headerRowIndex + 1).forEach((row) => {
    const characterName = cleanText(row[CHARACTER_COLUMN]);
    if (!characterName || characterName === "CHARACTER") return;

    metadataByCharacter.set(characterName, {
      characterName,
      level: cleanText(row[LEVEL_COLUMN]) || "-",
      ownerName: cleanText(row[OWNER_COLUMN]) || "정보없음",
      power: cleanText(row[MAX_POWER_COLUMN]) || "-",
    });
  });

  return metadataByCharacter;
}

function parseCalendarRows(rows) {
  const result = new Map();
  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => WEEKDAY_CODES.includes(cleanText(cell).toUpperCase())),
  );

  if (headerRowIndex < 0) return result;

  const dayColumns = rows[headerRowIndex]
    .map((cell, index) => ({
      dayCode: cleanText(cell).toUpperCase(),
      index,
    }))
    .filter((item) => WEEKDAY_CODES.includes(item.dayCode));

  const dateRowIndex = findDateRowIndex(rows, headerRowIndex, dayColumns);
  const baseTimes = collectBaseTimes(rows, headerRowIndex);
  const scanStartRowIndex = dateRowIndex + 1;
  const scanEndRowIndex = findScheduleEndRowIndex(rows, scanStartRowIndex);

  dayColumns.forEach(({ dayCode, index }) => {
    const isoDate = dateRowIndex >= 0 ? parseSheetDate(rows[dateRowIndex][index]) : "";
    const slots = [];

    for (let rowIndex = scanStartRowIndex; rowIndex <= scanEndRowIndex; rowIndex += 1) {
      const raidName = extractRaidName(rows[rowIndex][index]);
      if (!raidName || !isoDate) continue;

      const time = resolveTimeForRow(rowIndex, baseTimes);
      if (!time) continue;

      slots.push({ date: isoDate, raidName, time });
    }

    result.set(dayCode, slots);
  });

  return result;
}

function parseRaidCalendarRows(rows, calendarSlotsByDay) {
  const result = new Map();
  const dayRows = rows
    .map((row, index) => ({ dayCode: KOREAN_DAY_TO_CODE[cleanText(row[0])] || "", index }))
    .filter((item) => item.dayCode);

  dayRows.forEach(({ dayCode, index }, blockIndex) => {
    const headerRow = rows[index - 1] || [];
    const nextDayIndex = dayRows[blockIndex + 1]?.index ?? rows.length;
    const endRowIndex = nextDayIndex - 2;
    const raidColumns = [];
    const calendarSlots = calendarSlotsByDay.get(dayCode) || [];
    const fallbackRaidNames = calendarSlots.map((slot) => slot.raidName);
    const headerColumns = resolveHeaderColumns(headerRow, rows[index], fallbackRaidNames);

    headerColumns.forEach(({ columnIndex, raidName }) => {
      const characterNames = [];
      for (let rowIndex = index; rowIndex <= endRowIndex; rowIndex += 1) {
        const characterName = cleanText(rows[rowIndex]?.[columnIndex]);
        if (!characterName || characterName === "-") continue;
        characterNames.push(characterName);
      }

      raidColumns.push({
        characterNames,
        raidName,
      });
    });

    result.set(dayCode, raidColumns);
  });

  return result;
}

function findDateRowIndex(rows, headerRowIndex, dayColumns) {
  let bestRowIndex = -1;
  let bestScore = -1;

  for (let rowIndex = headerRowIndex + 1; rowIndex <= headerRowIndex + 4; rowIndex += 1) {
    const score = dayColumns.reduce((count, item) => count + Number(Boolean(parseSheetDate(rows[rowIndex]?.[item.index]))), 0);
    if (score > bestScore) {
      bestRowIndex = rowIndex;
      bestScore = score;
    }
  }

  return bestRowIndex;
}

function collectBaseTimes(rows, headerRowIndex) {
  const baseTimes = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const parsedTime = parseSheetTime(rows[rowIndex]?.[1]);
    if (!parsedTime) continue;
    baseTimes.push({ rowIndex, time: parsedTime });
  }

  return baseTimes;
}

function resolveTimeForRow(rowIndex, baseTimes) {
  let activeBase = null;

  for (const baseTime of baseTimes) {
    if (baseTime.rowIndex <= rowIndex) {
      activeBase = baseTime;
      continue;
    }
    break;
  }

  if (!activeBase) return "";

  const baseMinutes = toMinutes(activeBase.time);
  const halfHourSteps = Math.max(0, Math.ceil((rowIndex - activeBase.rowIndex) / 2));
  return toTimeLabel(baseMinutes + halfHourSteps * 30);
}

function decorateParticipant(characterName, metadataByCharacter) {
  const metadata = metadataByCharacter.get(characterName);

  return {
    characterName,
    level: metadata?.level || "-",
    ownerName: metadata?.ownerName || "-",
    power: metadata?.power || "-",
  };
}

function normalizeRaidName(value) {
  const text = cleanText(value);
  if (!text) return "";
  return RAID_NAME_ALIASES[text] || text;
}

function extractRaidName(value) {
  const text = cleanText(value);
  if (!text) return "";
  const matchedRaidName = KNOWN_RAID_NAMES.find((raidName) => text === raidName);
  return matchedRaidName ? normalizeRaidName(matchedRaidName) : "";
}

function findScheduleEndRowIndex(rows, scanStartRowIndex) {
  const noteRowIndex = rows.findIndex((row, index) => {
    if (index < scanStartRowIndex) return false;
    return row.some((cell) =>
      SCHEDULE_NOTE_ROW_MARKERS.some((marker) => cleanText(cell).includes(marker)),
    );
  });

  return noteRowIndex > 0 ? noteRowIndex - 1 : rows.length - 1;
}

function resolveHeaderColumns(headerRow, firstParticipantRow, fallbackRaidNames) {
  const explicitHeaders = headerRow
    .map((value, columnIndex) => ({
      columnIndex,
      raidName: extractRaidName(value),
    }))
    .filter((item) => item.raidName);

  if (explicitHeaders.length > 0) return explicitHeaders;

  // NOTE:
  // The first "수요일" block in gviz does not keep a separate header row,
  // so we borrow the day order from Calendar and map it to visible participant columns here.
  const visibleNameColumns = firstParticipantRow
    .map((value, columnIndex) => ({
      columnIndex,
      isString: typeof value === "string",
      value: cleanText(value),
    }))
    .filter(
      (item) =>
        item.isString &&
        item.columnIndex >= 2 &&
        item.value &&
        item.value !== "-" &&
        !isColorCode(item.value) &&
        item.value !== "수",
    )
    .slice(0, fallbackRaidNames.length);

  return visibleNameColumns.map((item, index) => ({
    columnIndex: item.columnIndex,
    raidName: normalizeRaidName(fallbackRaidNames[index] || ""),
  }));
}

function isColorCode(value) {
  return /^#[0-9a-f]{6}$/i.test(value);
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

function cleanText(value) {
  return String(value ?? "")
    .replace(/\n/g, " ")
    .trim();
}
