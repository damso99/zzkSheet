const SHEET_EPOCH_UTC = Date.UTC(1899, 11, 30);
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

export function parseSheetDate(value) {
  const normalized = normalizeSheetDateValue(value);
  if (!normalized) return "";

  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

export function formatDateLabel(dateValue) {
  const normalized = normalizeSheetDateValue(dateValue);
  if (!normalized) return "-";

  const parts = parseLocalDateParts(normalized);
  if (!parts) return "-";

  const localDate = new Date(parts.year, parts.month - 1, parts.day);
  return `${parts.month}월 ${parts.day}일 (${DAY_NAMES[localDate.getDay()]})`;
}

export function getTodayIsoDate() {
  return formatLocalDate(new Date());
}

export function parseSheetTime(value) {
  if (value instanceof Date) {
    return formatLocalTime(value);
  }

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

export function formatLocalDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatLocalDateTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function normalizeSheetDateValue(value) {
  if (value == null || value === "") return "";

  if (value instanceof Date) {
    return formatLocalDate(value);
  }

  const gvizDate = parseGvizDateParts(value);
  if (gvizDate) {
    return formatLocalDateParts(gvizDate.year, gvizDate.month, gvizDate.day);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 2000) {
      return serialToIsoDate(value);
    }
    return "";
  }

  const text = String(value).trim();
  if (!text) return "";

  const normalizedIsoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (normalizedIsoMatch) {
    return formatLocalDateParts(
      Number(normalizedIsoMatch[1]),
      Number(normalizedIsoMatch[2]),
      Number(normalizedIsoMatch[3]),
    );
  }

  const isoTimestampMatch = text.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoTimestampMatch) {
    return isoTimestampMatch[1];
  }

  const textDateMatch = text.match(/^(\d{4})[./-]\s?(\d{1,2})[./-]\s?(\d{1,2})$/);
  if (textDateMatch) {
    return formatLocalDateParts(Number(textDateMatch[1]), Number(textDateMatch[2]), Number(textDateMatch[3]));
  }

  const numericValue = Number(text);
  if (Number.isFinite(numericValue) && numericValue > 2000) {
    return serialToIsoDate(numericValue);
  }

  return text;
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

function serialToIsoDate(serialNumber) {
  const utcDate = new Date(SHEET_EPOCH_UTC + Math.floor(serialNumber) * DAY_IN_MS);
  return formatLocalDate(utcDate);
}

function parseLocalDateParts(dateValue) {
  const normalized = normalizeSheetDateValue(dateValue);
  if (!normalized) return null;

  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  return {
    day: Number(match[3]),
    month: Number(match[2]),
    year: Number(match[1]),
  };
}

function formatLocalDateParts(year, month, day) {
  return `${year}-${padNumber(month)}-${padNumber(day)}`;
}

function formatLocalTime(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}
