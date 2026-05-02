import { getSheetData, sendJson } from "./_shared.js";

export default async function handler(request, response) {
  try {
    const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
    const sheetUrl = url.searchParams.get("url")?.trim();
    const requestedSheet = url.searchParams.get("sheet")?.trim();
    const result = await getSheetData(sheetUrl, requestedSheet);

    sendJson(response, result.status, result.body);
  } catch (error) {
    sendJson(response, 502, {
      error: "Failed to fetch Google Sheets data.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
