const LOSTARK_BASE_URL = "https://developer-lostark.game.onstove.com";
const CACHE_TTL_MS = 5 * 60 * 1000;
const characterCache = new Map();
const characterInFlight = new Map();

const CHARACTER_ENDPOINTS = {
  summary: "",
  profile: "profiles",
  equipment: "equipment",
  avatars: "avatars",
  combatSkills: "combat-skills",
  engravings: "engravings",
  arkPassive: "arkpassive",
  arkGrid: "arkgrid",
  cards: "cards",
  gems: "gems",
};

export function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

export function getLostarkApiKey() {
  return String(
    process.env.LOSTARK_API_KEY ||
      process.env.LOSTARK_OPENAPI_KEY ||
      process.env.LOSTARK_API_JWT ||
      process.env.LOSTARK_JWT ||
      process.env.VITE_LOSTARK_API_KEY ||
      "",
  )
    .replace(/^["']|["']$/g, "")
    .trim();
}

export async function getLostarkCharacterBundle(characterName) {
  const safeCharacterName = String(characterName || "").trim();

  if (!safeCharacterName) {
    return { status: 400, body: { error: "characterName path parameter is required." } };
  }

  const lostarkApiKey = getLostarkApiKey();
  if (!lostarkApiKey) {
    return {
      status: 503,
      body: {
        code: "MISSING_LOSTARK_API_KEY",
        error: "LOSTARK_API_KEY is missing. Add it to server environment variables.",
        detail:
          "Vercel Environment Variables에 LOSTARK_API_KEY를 추가한 뒤 Production 재배포를 해주세요. 프론트 번들에는 키를 넣지 않습니다.",
      },
    };
  }

  const cacheKey = safeCharacterName.toLocaleLowerCase("ko-KR");
  const cached = characterCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return {
      status: 200,
      body: {
        ...cached.body,
        cache: { hit: true, ttlMs: CACHE_TTL_MS },
      },
    };
  }

  if (characterInFlight.has(cacheKey)) {
    return characterInFlight.get(cacheKey);
  }

  const encodedName = encodeURIComponent(safeCharacterName);
  const requestPromise = (async () => {
    const settledEntries = await Promise.allSettled(
      Object.entries(CHARACTER_ENDPOINTS).map(async ([key, endpoint]) => {
        const apiUrl = `${LOSTARK_BASE_URL}/armories/characters/${encodedName}${endpoint ? `/${endpoint}` : ""}`;
        const { body, response } = await fetchLostarkJson(apiUrl, lostarkApiKey);

        return {
          key,
          body,
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
        };
      }),
    );

    const armory = {};
    const errors = {};

    for (const entry of settledEntries) {
      if (entry.status === "rejected") {
        errors.unknown = {
          status: 502,
          detail: entry.reason instanceof Error ? entry.reason.message : String(entry.reason),
        };
        continue;
      }

      const result = entry.value;
      if (result.ok) {
        armory[result.key] = result.body;
      } else {
        errors[result.key] = {
          status: result.status,
          statusText: result.statusText,
          detail: result.body,
        };
      }
    }

    if (!armory.profile && errors.profile) {
      return {
        status: errors.profile.status || 502,
        body: {
          error: "Lost Ark OpenAPI profile request failed.",
          detail: errors.profile.detail,
          errors,
        },
      };
    }

    const body = {
      characterName: safeCharacterName,
      fetchedAt: new Date().toISOString(),
      armory,
      errors,
      cache: { hit: false, ttlMs: CACHE_TTL_MS },
    };

    characterCache.set(cacheKey, {
      createdAt: Date.now(),
      body,
    });

    return { status: 200, body };
  })();

  characterInFlight.set(cacheKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    if (characterInFlight.get(cacheKey) === requestPromise) {
      characterInFlight.delete(cacheKey);
    }
  }
}

export async function fetchLostarkJson(apiUrl, lostarkApiKey) {
  const response = await fetch(apiUrl, {
    headers: {
      accept: "application/json",
      authorization: `bearer ${lostarkApiKey}`,
    },
  });
  const text = await response.text();

  try {
    return { body: text ? JSON.parse(text) : null, response };
  } catch {
    return { body: text, response };
  }
}
