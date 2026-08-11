import { getLostarkCharacterBundle, sendJson } from "../../_lostark.js";

export default async function handler(request, response) {
  try {
    const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
    const characterName = decodeURIComponent(url.pathname.split("/").pop() || "").trim();
    const result = await getLostarkCharacterBundle(characterName);

    if (result.status === 200) {
      response.setHeader(
        "Vercel-CDN-Cache-Control",
        "public, s-maxage=300, stale-while-revalidate=300",
      );
      response.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    }

    // Vercel에 프론트만 배포하더라도 API Key는 이 serverless function의 환경변수로만 주입합니다.
    sendJson(response, result.status, result.body);
  } catch (error) {
    sendJson(response, 502, {
      error: "Failed to contact Lost Ark OpenAPI.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
