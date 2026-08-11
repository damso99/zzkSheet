import { getLostarkCharacterBundle, sendJson } from "./_lostark.js";

export default async function handler(request, response) {
  const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  const characterName = url.searchParams.get("name")?.trim();

  try {
    const result = await getLostarkCharacterBundle(characterName);
    if (result.status === 200) {
      response.setHeader(
        "Vercel-CDN-Cache-Control",
        "public, s-maxage=300, stale-while-revalidate=300",
      );
      response.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    }
    sendJson(response, result.status, result.body);
  } catch (error) {
    sendJson(response, 502, {
      error: "Failed to contact Lost Ark OpenAPI.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
