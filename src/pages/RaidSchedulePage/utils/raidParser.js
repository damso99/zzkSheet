import {
  formatDateLabel,
  normalizeSheetDateValue,
  parseSheetDate,
  parseSheetTime,
} from "./dateUtils.js";

const DEFAULT_FALLBACK_TIME = "";
const DEFAULT_OWNER_NAME = "미정";

export function buildRaidSchedule({ settingRows = [], raidCalendarRows = [], raidCalendarCols = [] } = {}) {
  console.log("[ACTIVE RAID PARSER]", "buildRaidSchedule");

  const settingLookup = parseSettingRows(settingRows);
  const raidBlocks = collectRaidColumnBlocks(raidCalendarCols, raidCalendarRows);
  const raidNameLookup = buildRaidNameLookup(raidBlocks);
  const parsedRaids = parseRaidCalendarRows({
    raidBlocks,
    raidNameLookup,
    rows: raidCalendarRows,
    settingLookup,
  });

  console.table(
    parsedRaids.map((raid) => ({
      blockTime: raid.time,
      date: raid.date,
      endCol: raid.endCol,
      endRow: raid.endRow,
      memberCount: raid.members.length,
      members: raid.members.join(", "),
      raidName: raid.raidName,
      startCol: raid.startCol,
      startRow: raid.startRow,
    })),
  );

  return parsedRaids
    .map((raid, raidIndex) => {
      const participants = raid.members.map((characterName) => decorateParticipant(characterName, settingLookup));
      const item = {
        date: raid.date,
        dayLabel: formatDateLabel(raid.date),
        endCol: raid.endCol,
        endRow: raid.endRow,
        id: `${raid.date || "unscheduled"}-${raid.time || "time"}-${slugify(raid.raidName)}-${raidIndex}`,
        participantCount: participants.length,
        participants,
        raidName: raid.raidName,
        startCol: raid.startCol,
        startRow: raid.startRow,
        time: raid.time || DEFAULT_FALLBACK_TIME,
      };

      console.log("[RAW RAID ITEM]", item);
      return item;
    })
    .sort(compareRaidOrder);
}

export function buildFallbackRaidSchedule(todayIsoDate) {
  const normalizedDate = normalizeSheetDateValue(todayIsoDate);

  return [
    {
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
    const nextDateRowIndex = dateRows[dateRowIndex + 1]?.index ?? rows.length;
    const blockStartRow = dateRow.index;
    const blockEndRow = nextDateRowIndex - 1;
    const blockTime = findDateBlockTime(rows, blockStartRow + 1, blockEndRow);

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
  let currentParty = createParty({
    date,
    endCol: block.endCol,
    raidName: block.raidName,
    startCol: block.startCol,
    startRow: blockStartRow,
    time: blockTime,
  });
  let seenMembers = new Set();

  for (let rowIndex = blockStartRow; rowIndex <= blockEndRow; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const header = findRaidHeaderInBlock(row, block, raidNameLookup);

    if (header) {
      if (currentParty.members.length > 0) {
        currentParty.endRow = rowIndex - 1;
        raids.push(currentParty);
      }

      currentParty = createParty({
        date,
        endCol: block.endCol,
        raidName: header,
        startCol: block.startCol,
        startRow: rowIndex,
        time: blockTime,
      });
      seenMembers = new Set();
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

  if (currentParty.members.length > 0) {
    currentParty.endRow = blockEndRow;
    raids.push(currentParty);
  }

  return raids;
}

function createParty({ date, raidName, startCol, endCol, startRow, time = "" }) {
  return {
    date: normalizeSheetDateValue(date),
    endCol,
    endRow: startRow,
    members: [],
    raidName,
    startCol,
    startRow,
    time: time || "",
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
  for (const cell of row || []) {
    const date = parseSheetDate(cell);
    if (date) return date;
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
  return new Set(raidBlocks.map((block) => normalizeKey(block.raidName)).filter(Boolean));
}

function findDateBlockTime(rows, startIndex, endIndex) {
  const times = [];

  for (let rowIndex = startIndex; rowIndex <= endIndex; rowIndex += 1) {
    const row = rows[rowIndex] || [];

    for (const cell of row) {
      const time = extractTimeLabel(cell);
      if (time) {
        times.push(time);
      }
    }
  }

  if (!times.length) return "";
  return [...new Set(times)].sort((left, right) => left.localeCompare(right))[0] || "";
}

function findRaidHeaderInBlock(row, block, raidNameLookup) {
  for (let columnIndex = block.startCol; columnIndex <= block.endCol && columnIndex < row.length; columnIndex += 1) {
    const value = cleanText(row[columnIndex]);
    if (!value) continue;
    if (isNoiseCell(value) || isColorCode(value) || parseSheetDate(value) || parseSheetTime(value)) continue;

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
  const leftStartCol = String(left.startCol ?? 9999).padStart(4, "0");
  const rightStartCol = String(right.startCol ?? 9999).padStart(4, "0");
  const leftStartRow = String(left.startRow ?? 9999).padStart(4, "0");
  const rightStartRow = String(right.startRow ?? 9999).padStart(4, "0");

  return `${leftDate} ${leftStartCol} ${leftStartRow}`.localeCompare(`${rightDate} ${rightStartCol} ${rightStartRow}`);
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
