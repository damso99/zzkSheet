const SHEET_EPOCH_UTC = Date.UTC(1899, 11, 30);
const HALF_HOUR_IN_DAYS = 30 / (24 * 60);
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

export function parseSheetDate(value) {
  if (value == null || value === "") return "";

  const gvizDate = parseGvizDateParts(value);
  if (gvizDate) {
    return `${gvizDate.year}-${padNumber(gvizDate.month)}-${padNumber(gvizDate.day)}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 2000) {
      return serialToIsoDate(value);
    }
    return "";
  }

  const numericValue = Number(String(value).trim());
  if (Number.isFinite(numericValue) && numericValue > 2000) {
    return serialToIsoDate(numericValue);
  }

  const text = String(value).trim();
  const dateMatch = text.match(/^(\d{4})[./-]\s?(\d{1,2})[./-]\s?(\d{1,2})$/);
  if (!dateMatch) return "";

  const [, year, month, day] = dateMatch;
  return `${year}-${padNumber(month)}-${padNumber(day)}`;
}

export function formatDateLabel(isoDate) {
  if (!isoDate) return "-";
  const date = new Date(`${isoDate}T00:00:00`);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${DAY_NAMES[date.getDay()]})`;
}

export function getCurrentWeekRange(isoDate) {
  const targetDate = new Date(`${isoDate}T00:00:00`);
  const start = new Date(targetDate);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  start.setDate(start.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  return {
    end: toIsoDate(end),
    start: toIsoDate(start),
  };
}

export function getWeekDates(range) {
  const dates = [];
  let cursor = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);

  while (cursor <= end) {
    dates.push(toIsoDate(cursor));
    cursor = new Date(cursor.getTime() + DAY_IN_MS);
  }

  return dates;
}

export function getTodayIsoDate() {
  return toIsoDate(new Date());
}

export function isDateInRange(isoDate, range) {
  return Boolean(isoDate) && isoDate >= range.start && isoDate <= range.end;
}

export function shiftIsoDate(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function parseSheetTime(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return toTimeStringFromSerial(value);
  }

  const text = String(value ?? "").trim();
  if (!text) return "";

  const plainTimeMatch = text.match(/^(\d{1,2}):(\d{2})$/);
  if (plainTimeMatch) {
    return `${padNumber(plainTimeMatch[1])}:${plainTimeMatch[2]}`;
  }

  const gvizDate = parseGvizDateParts(text);
  if (!gvizDate) return "";

  const hours = gvizDate.hours + (gvizDate.day > 30 ? 24 * (gvizDate.day - 30) : 0);
  return `${padNumber(hours)}:${padNumber(gvizDate.minutes)}`;
}

export function toTimeStringFromSerial(serialNumber) {
  const fraction = ((serialNumber % 1) + 1) % 1;
  const totalMinutes = Math.round(fraction * 24 * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${padNumber(hours)}:${padNumber(minutes)}`;
}

export function addHalfHoursToSerial(serialNumber, steps) {
  return serialNumber + HALF_HOUR_IN_DAYS * steps;
}

function serialToIsoDate(serialNumber) {
  const utcDate = new Date(SHEET_EPOCH_UTC + Math.floor(serialNumber) * DAY_IN_MS);
  return toIsoDate(utcDate);
}

function parseGvizDateParts(value) {
  const text = String(value ?? "").trim();
  const match = text.match(
    /^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,(\d{1,2}),(\d{1,2}),(\d{1,2}))?\)$/,
  );
  if (!match) return null;

  return {
    day: Number(match[3]),
    hours: Number(match[4] || 0),
    minutes: Number(match[5] || 0),
    month: Number(match[2]) + 1,
    seconds: Number(match[6] || 0),
    year: Number(match[1]),
  };
}

function toIsoDate(date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}
