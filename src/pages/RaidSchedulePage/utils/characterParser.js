export const CHARACTER_PLACEHOLDER_IMAGE = "/character-placeholder.svg";
export const EMPTY_TEXT = "정보 없음";

export function normalizeCharacterDetail(payload = {}) {
  const armory = payload.armory || {};
  const profileSource = armory.profile || payload.character || {};

  return {
    profile: normalizeProfile(profileSource, payload.characterName),
    equipment: normalizeEquipment(armory.equipment),
    gems: normalizeGems(armory.gems),
    engravings: normalizeEngravings(armory.engravings),
    cards: normalizeCards(armory.cards),
    skills: normalizeSkills(armory.combatSkills),
    warnings: Object.keys(payload.errors || {}),
    fetchedAt: payload.fetchedAt || "",
  };
}

export function displayValue(value) {
  if (value == null || value === "") return EMPTY_TEXT;
  return String(value);
}

function normalizeProfile(profile, fallbackName) {
  return {
    characterName: displayValue(profile.CharacterName || fallbackName),
    serverName: displayValue(profile.ServerName),
    characterClassName: displayValue(profile.CharacterClassName),
    characterImage: profile.CharacterImage || CHARACTER_PLACEHOLDER_IMAGE,
    itemAvgLevel: displayValue(profile.ItemAvgLevel),
    combatPower: displayValue(profile.CombatPower || findStatValue(profile.Stats, "전투력")),
    expeditionLevel: displayValue(profile.ExpeditionLevel),
    characterLevel: displayValue(profile.CharacterLevel),
    guildName: displayValue(profile.GuildName),
    title: displayValue(profile.Title),
  };
}

function normalizeEquipment(equipment) {
  return asArray(equipment).map((item) => {
    const tooltipObject = parseMaybeJson(item.Tooltip);
    const tooltip = toPlainTooltip(item.Tooltip);

    return {
      type: displayValue(item.Type),
      name: displayValue(stripHtml(item.Name)),
      icon: item.Icon || CHARACTER_PLACEHOLDER_IMAGE,
      grade: displayValue(item.Grade),
      quality: displayValue(item.Quality ?? findDeepValue(tooltipObject, "qualityValue")),
      tooltip,
      enhancement: extractEnhancement(item.Name),
    };
  });
}

function normalizeGems(gemsPayload) {
  const effectsBySlot = new Map(
    asArray(gemsPayload?.Effects).map((effect) => [String(effect.GemSlot ?? effect.Slot ?? ""), effect]),
  );

  return asArray(gemsPayload?.Gems || gemsPayload).map((gem) => {
    const effect = effectsBySlot.get(String(gem.Slot ?? "")) || {};

    return {
      name: displayValue(stripHtml(gem.Name)),
      icon: gem.Icon || CHARACTER_PLACEHOLDER_IMAGE,
      level: displayValue(gem.Level || extractGemLevel(gem.Name)),
      effect: displayValue(effect.Name || effect.Description || toPlainTooltip(effect.Tooltip)),
    };
  });
}

function normalizeEngravings(engravingsPayload) {
  const normalEffects = asArray(engravingsPayload?.Effects).map((effect) => ({
    name: displayValue(stripHtml(effect.Name)),
    level: displayValue(effect.Level || extractLevel(effect.Name || effect.Description)),
    description: displayValue(stripHtml(effect.Description)),
    icon: effect.Icon || CHARACTER_PLACEHOLDER_IMAGE,
  }));

  const arkPassiveEffects = asArray(engravingsPayload?.ArkPassiveEffects).map((effect) => ({
    name: displayValue(stripHtml(effect.Name)),
    level: displayValue(effect.Level || extractLevel(effect.Name || effect.Description)),
    description: displayValue(stripHtml(effect.Description || "아크 패시브 각인 효과")),
    icon: effect.Icon || CHARACTER_PLACEHOLDER_IMAGE,
  }));

  return [...normalEffects, ...arkPassiveEffects];
}

function normalizeCards(cardsPayload) {
  return {
    cards: asArray(cardsPayload?.Cards).map((card) => ({
      name: displayValue(stripHtml(card.Name)),
      icon: card.Icon || CHARACTER_PLACEHOLDER_IMAGE,
      awakeCount: displayValue(card.AwakeCount ?? card.AwakeTotal),
    })),
    effects: asArray(cardsPayload?.Effects).flatMap((effect) => {
      const items = asArray(effect.Items);
      if (!items.length) return [displayValue(effect.Name || effect.Description)];

      return items.map((item) =>
        displayValue([item.Name, item.Description].filter(Boolean).map(stripHtml).join(" · ")),
      );
    }),
  };
}

function normalizeSkills(skillsPayload) {
  return asArray(skillsPayload)
    .filter((skill) => Number(skill.Level || 0) > 0 || skill.Name)
    .map((skill) => {
      const tripods = asArray(skill.Tripods)
        .filter((tripod) => tripod.IsSelected || tripod.Name)
        .map((tripod) => ({
          name: displayValue(stripHtml(tripod.Name)),
          level: displayValue(tripod.Level),
          tier: displayValue(tripod.Tier),
        }));

      return {
        name: displayValue(stripHtml(skill.Name)),
        icon: skill.Icon || CHARACTER_PLACEHOLDER_IMAGE,
        level: displayValue(skill.Level),
        rune: displayValue(skill.Rune?.Name || skill.RuneName),
        tripods,
      };
    });
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return [];
}

function findStatValue(stats, type) {
  return asArray(stats).find((stat) => stat.Type === type)?.Value || "";
}

function parseMaybeJson(value) {
  if (!value || typeof value !== "string") return value || null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toPlainTooltip(value) {
  const parsed = parseMaybeJson(value);
  const strings = parsed ? collectStrings(parsed) : [value];
  const cleaned = strings.map(stripHtml).filter(Boolean);
  return cleaned.slice(0, 12).join(" · ");
}

function collectStrings(value, key = "") {
  if (value == null) return [];
  if (typeof value === "string") {
    if (/icon|image|slotdata/i.test(key) || value.startsWith("http")) return [];
    return [value];
  }
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => collectStrings(item, key));
  if (typeof value === "object") {
    return Object.entries(value).flatMap(([childKey, childValue]) => collectStrings(childValue, childKey));
  }

  return [];
}

function findDeepValue(value, targetKey) {
  if (!value || typeof value !== "object") return "";

  for (const [key, childValue] of Object.entries(value)) {
    if (key === targetKey && childValue != null && childValue !== "") return childValue;
    const nestedValue = findDeepValue(childValue, targetKey);
    if (nestedValue !== "") return nestedValue;
  }

  return "";
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractEnhancement(name) {
  const match = String(name || "").match(/\+?\d+(?=\s|$|강)/);
  return match?.[0] || "";
}

function extractGemLevel(name) {
  const match = String(name || "").match(/(\d+)\s*레벨|Lv\.?\s*(\d+)/i);
  return match?.[1] || match?.[2] || "";
}

function extractLevel(text) {
  const match = String(text || "").match(/Lv\.?\s*(\d+)|레벨\s*(\d+)|(\d+)\s*단계/i);
  return match?.[1] || match?.[2] || match?.[3] || "";
}
