const ITEM_PRICE_HEADERS = [
  "기준일",
  "갱신시각",
  "아이템명",
  "등급",
  "오늘가",
  "어제가",
  "전일차이",
  "전일등락률",
  "주간평균",
  "주간평균차이",
  "주간평균대비율",
  "방향",
  "아이콘",
];

function doGet() {
  return jsonResponse({
    success: true,
    message: "아이템 시세 저장 스크립트가 준비되어 있습니다.",
  });
}

function doPost(e) {
  try {
    const payload = parsePayload(e);
    const spreadsheetId = getRequiredProperty("ITEM_PRICE_SPREADSHEET_ID");
    const sheetName = String(payload.sheetName || getRequiredProperty("ITEM_PRICE_SHEET_NAME") || "아이템시세").trim();
    const rows = Array.isArray(payload.rows) ? payload.rows : [];

    if (!rows.length) {
      return jsonResponse({
        success: true,
        insertedCount: 0,
        updatedCount: 0,
        message: "저장할 데이터가 없습니다.",
      });
    }

    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`시트를 찾을 수 없습니다: ${sheetName}`);
    }

    ensureHeaderRow(sheet);
    const result = upsertRows(sheet, rows);

    return jsonResponse({
      success: true,
      ...result,
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function upsertRows(sheet, rows) {
  const lastRow = sheet.getLastRow();
  const width = ITEM_PRICE_HEADERS.length;
  const existingValues = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, width).getValues() : [];
  const rowIndexByKey = new Map();

  existingValues.forEach((row, index) => {
    const key = makeRowKey(row);
    if (key) {
      rowIndexByKey.set(key, index + 2);
    }
  });

  const appendRows = [];
  let updatedCount = 0;

  rows.forEach((row) => {
    const key = makeRowKey(row);
    if (!key) return;

    const normalizedRow = normalizeRow(row);
    const rowIndex = rowIndexByKey.get(key);

    if (rowIndex) {
      sheet.getRange(rowIndex, 1, 1, width).setValues([normalizedRow]);
      updatedCount += 1;
      return;
    }

    appendRows.push(normalizedRow);
    rowIndexByKey.set(key, lastRow + appendRows.length);
  });

  if (appendRows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, appendRows.length, width).setValues(appendRows);
  }

  return {
    insertedCount: appendRows.length,
    updatedCount,
    totalCount: updatedCount + appendRows.length,
  };
}

function ensureHeaderRow(sheet) {
  const firstRow = sheet.getRange(1, 1, 1, ITEM_PRICE_HEADERS.length).getValues()[0];
  const isEmpty = firstRow.every((cell) => String(cell || "").trim() === "");

  if (isEmpty) {
    sheet.getRange(1, 1, 1, ITEM_PRICE_HEADERS.length).setValues([ITEM_PRICE_HEADERS]);
  }
}

function normalizeRow(row) {
  return Array.from({ length: ITEM_PRICE_HEADERS.length }, (_, index) => row[index] ?? "");
}

function makeRowKey(row) {
  const baseDate = String(row?.[0] || "").trim();
  const itemName = String(row?.[2] || "").trim();
  const grade = String(row?.[3] || "").trim();

  if (!baseDate || !itemName || !grade) {
    return "";
  }

  return `${baseDate}||${itemName}||${grade}`;
}

function parsePayload(e) {
  if (!e?.postData?.contents) {
    return {};
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch {
    return {};
  }
}

function getRequiredProperty(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) {
    throw new Error(`Script property is missing: ${key}`);
  }
  return value;
}

function jsonResponse(payload) {
  const output = ContentService.createTextOutput(JSON.stringify(payload));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
