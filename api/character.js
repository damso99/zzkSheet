import { getLostarkCharacterBundle, sendJson } from "./_lostark.js";

export default async function handler(request, response) {
  const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  const characterName = url.searchParams.get("name")?.trim();

  try {
    const result = await getLostarkCharacterBundle(characterName);
    sendJson(response, result.status, result.body);
  } catch (error) {
    sendJson(response, 502, {
      error: "Failed to contact Lost Ark OpenAPI.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
