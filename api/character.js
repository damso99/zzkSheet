import { ARMORY_ENDPOINTS, fetchLostarkJson, getLostarkApiKey, sendJson } from "./_shared.js";

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

  const encodedName = encodeURIComponent(characterName);

  try {
    const entries = await Promise.allSettled(
      Object.entries(ARMORY_ENDPOINTS).map(async ([key, path]) => {
        const apiUrl = `https://developer-lostark.game.onstove.com/armories/characters/${encodedName}/${path}`;
        const { body, response: apiResponse } = await fetchLostarkJson(apiUrl, lostarkApiKey);

        if (!apiResponse.ok) {
          return {
            key,
            value: null,
            error: {
              status: apiResponse.status,
              detail: body,
            },
          };
        }

        return { key, value: body, error: null };
      }),
    );

    const armory = {};
    const errors = {};

    for (const entry of entries) {
      if (entry.status === "rejected") {
        errors.unknown = entry.reason instanceof Error ? entry.reason.message : String(entry.reason);
        continue;
      }

      armory[entry.value.key] = entry.value.value;
      if (entry.value.error) errors[entry.value.key] = entry.value.error;
    }

    if (!armory.profile && errors.profile) {
      sendJson(response, errors.profile.status, {
        error: "Lost Ark OpenAPI profile request failed.",
        detail: errors.profile.detail,
      });
      return;
    }

    sendJson(response, 200, {
      character: armory.profile,
      armory,
      errors,
    });
  } catch (error) {
    sendJson(response, 502, {
      error: "Failed to contact Lost Ark OpenAPI.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
