import { buildAssetCandidates, sendJson } from "./_shared.js";

export default async function handler(request, response) {
  const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  const assetName = url.searchParams.get("name")?.trim();

  if (!assetName || !/^[a-z0-9_.-]+$/i.test(assetName)) {
    sendJson(response, 400, { error: "valid asset name query is required." });
    return;
  }

  for (const candidate of buildAssetCandidates(assetName)) {
    try {
      const assetResponse = await fetch(candidate, { method: "HEAD" });
      if (assetResponse.ok) {
        response.statusCode = 302;
        response.setHeader("Location", candidate);
        response.setHeader("Cache-Control", "public, max-age=86400");
        response.end();
        return;
      }
    } catch {
      // Try the next known CDN path.
    }
  }

  sendJson(response, 404, { error: "Lost Ark asset was not found.", name: assetName });
}
