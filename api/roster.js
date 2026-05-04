import { fetchLostarkJson, getLostarkApiKey, sendJson } from "./_lostark.js";

export default async function handler(request, response) {
  const lostarkApiKey = getLostarkApiKey();

  if (!lostarkApiKey) {
    sendJson(response, 500, {
      error: "LOSTARK_API_KEY is missing. Add it to Vercel Environment Variables.",
    });
    return;
  }

  const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  const characterName = url.searchParams.get("name")?.trim();

  if (!characterName) {
    sendJson(response, 400, { error: "name query is required." });
    return;
  }

  const apiUrl = `https://developer-lostark.game.onstove.com/characters/${encodeURIComponent(characterName)}/siblings`;

  try {
    const { body, response: apiResponse } = await fetchLostarkJson(apiUrl, lostarkApiKey);

    if (!apiResponse.ok) {
      sendJson(response, apiResponse.status, {
        error: "Lost Ark OpenAPI request failed.",
        detail: body,
      });
      return;
    }

    sendJson(response, 200, { representative: characterName, characters: body ?? [] });
  } catch (error) {
    sendJson(response, 502, {
      error: "Failed to contact Lost Ark OpenAPI.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
