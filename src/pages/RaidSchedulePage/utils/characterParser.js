export const CHARACTER_PLACEHOLDER_IMAGE = "/character-placeholder.svg";
export const EMPTY_TEXT = "정보 없음";

export function normalizeCharacterDetail(payload = {}) {
  const armory = payload.armory || {};
  const profileSource = armory.profile || payload.character || {};
  const skills = normalizeSkills(armory.combatSkills);

  return {
    profile: normalizeProfile(profileSource, payload.characterName),
    equipment: normalizeEquipment(armory.equipment),
    gems: normalizeGems(armory.gems, skills),
    engravings: normalizeEngravings(armory.engravings),
    cards: normalizeCards(armory.cards),
    skills,
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
  return asArray(equipment)
    .filter((item) => !isExcludedEquipment(item))
    .map((item) => {
      const tooltipObject = parseMaybeJson(item.Tooltip);
      const tooltipLines = getTooltipLines(item.Tooltip);
      const type = displayValue(item.Type);
      const name = displayValue(stripHtml(item.Name));
      const category = getEquipmentCategory(type, name);

      return {
        category,
        type,
        name,
        icon: normalizeIconUrl(item.Icon),
        grade: displayValue(item.Grade),
        quality: displayValue(
          item.Quality !== "" && item.Quality != null ? item.Quality : findDeepValue(tooltipObject, "qualityValue"),
        ),
        enhancement: extractEnhancement(item.Name),
        options: getEquipmentOptions({ category, name, type, tooltipLines }),
      };
    });
}

function normalizeGems(gemsPayload, skills = []) {
  const effectsBySlot = new Map(
    asArray(gemsPayload?.Effects).map((effect) => [String(effect.GemSlot ?? effect.Slot ?? ""), effect]),
  );

  return asArray(gemsPayload?.Gems || gemsPayload).map((gem) => {
    const effect = effectsBySlot.get(String(gem.Slot ?? "")) || {};
    const rawEffectText = getGemRawEffectText({ effect, gem });
    const skillName = matchGemSkillName({
      effectText: rawEffectText,
      gemName: gem.Name,
      skills,
      tooltipText: toPlainTooltip(gem.Tooltip),
    });
    const effectType = getGemEffectType(`${rawEffectText} ${gem.Name}`);

    return {
      name: displayValue(stripHtml(gem.Name)),
      icon: normalizeIconUrl(gem.Icon),
      level: displayValue(gem.Level || extractGemLevel(gem.Name)),
      effect: formatGemEffect({ effectType, skillName }),
      effectType,
      skillName,
    };
  });
}

function normalizeEngravings(engravingsPayload) {
  const abilityEngravings = asArray(engravingsPayload?.Engravings).map((engraving) =>
    normalizeEngravingItem(engraving, "활성 각인"),
  );
  const normalEffects = asArray(engravingsPayload?.Effects).map((effect) => ({
    name: displayValue(stripHtml(effect.Name)),
    level: normalizeEngravingLevel(effect.Level || extractLevel(effect.Name || effect.Description)),
    description: stripHtml(effect.Description),
    icon: normalizeIconUrl(effect.Icon || extractIconFromTooltip(effect.Tooltip || effect.Description)),
  }));

  const arkPassiveEffects = asArray(engravingsPayload?.ArkPassiveEffects).map((effect) => ({
    name: displayValue(stripHtml(effect.Name)),
    level: normalizeEngravingLevel(effect.Level || extractLevel(effect.Name || effect.Description)),
    description: stripHtml(effect.Description || "아크 패시브 각인 효과"),
    icon: normalizeIconUrl(effect.Icon || extractIconFromTooltip(effect.Tooltip || effect.Description)),
  }));

  return [...abilityEngravings, ...normalEffects, ...arkPassiveEffects].filter(
    (engraving, index, list) => list.findIndex((item) => item.name === engraving.name) === index,
  );
}

function normalizeCards(cardsPayload) {
  return {
    cards: asArray(cardsPayload?.Cards).map((card) => ({
      name: displayValue(stripHtml(card.Name)),
      icon: normalizeIconUrl(card.Icon),
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
    .filter((skill) => getSkillPoint(skill) >= 2)
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
        icon: normalizeIconUrl(skill.Icon),
        level: displayValue(skill.Level),
        point: displayValue(getSkillPoint(skill)),
        rune: displayValue(skill.Rune?.Name || skill.RuneName),
        tripods,
      };
    });
}

function normalizeEngravingItem(engraving, fallbackDescription) {
  return {
    name: displayValue(stripHtml(engraving.Name)),
    level: normalizeEngravingLevel(engraving.Level || extractLevel(engraving.Name || engraving.Description)),
    description: stripHtml(engraving.Description || fallbackDescription),
    icon: normalizeIconUrl(engraving.Icon || extractIconFromTooltip(engraving.Tooltip || engraving.Description)),
  };
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
  if (shouldSkipTooltipKey(key)) return [];
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
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function isExcludedEquipment(item) {
  const type = stripHtml(item?.Type);
  const name = stripHtml(item?.Name);
  return /부적|문장|나침반/.test(`${type} ${name}`);
}

function getEquipmentCategory(type, name) {
  const text = `${type} ${name}`;
  if (/팔찌/.test(text)) return "bracelet";
  if (/목걸이|귀걸이|반지|어빌리티\s*스톤|스톤/.test(text)) return "accessory";
  return "gear";
}

function getEquipmentOptions({ category, name, type, tooltipLines }) {
  if (category === "gear") return [];
  if (isAbilityStone(type, name)) return parseAbilityStoneOptions(tooltipLines);
  if (category === "accessory") return parseAccessoryOptions(tooltipLines, { name, type });
  if (category === "bracelet") return parseBraceletOptions(tooltipLines, { name, type });

  return [];
}

export function parseAbilityStoneOptions(tooltipLines) {
  return tooltipLines
    .map(cleanTooltipLine)
    .filter(Boolean)
    .flatMap((line) => extractAbilityStoneCandidates(line))
    .map(normalizeAbilityStoneLine)
    .filter(Boolean)
    .filter((line) => !/Lv\.0/.test(line))
    .filter((line) => !/무작위\s*각인\s*효과/.test(line))
    .filter((line, index, lines) => lines.indexOf(line) === index)
    .slice(0, 6);
}

export function parseAccessoryOptions(tooltipLines, { name = "", type = "" } = {}) {
  return tooltipLines
    .map(cleanTooltipLine)
    .filter(Boolean)
    .flatMap((line) => splitOptionCandidates(line))
    .map(cleanTooltipLine)
    .filter((line) => isUsefulAccessoryOption(line, { name, type }))
    .filter((line, index, lines) => lines.indexOf(line) === index)
    .slice(0, 8);
}

function parseBraceletOptions(tooltipLines, { name = "", type = "" } = {}) {
  return tooltipLines
    .map(cleanTooltipLine)
    .filter(Boolean)
    .flatMap((line) => splitOptionCandidates(line))
    .map(cleanTooltipLine)
    .filter((line) => isUsefulBraceletOption(line, { name, type }))
    .filter((line, index, lines) => lines.indexOf(line) === index)
    .slice(0, 10);
}

function getTooltipLines(value) {
  const parsed = parseMaybeJson(value);
  const rawLines = parsed ? collectStrings(parsed) : [value];

  return rawLines.flatMap((line) =>
    String(line || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .split(/\n|ㆍ|●|◆|※/)
      .map(cleanTooltipLine),
  );
}

function cleanTooltipLine(value) {
  return stripHtml(value)
    .replace(/\[[^\]]*]/g, " ")
    .replace(/부여\s*옵션/gi, " ")
    .replace(/nameTagBox/gi, " ")
    .replace(/태그\s*:/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAbilityStone(type, name) {
  return /어빌리티\s*스톤|스톤/.test(`${type} ${name}`);
}

function splitOptionCandidates(line) {
  return String(line || "")
    .split(/\n|ㆍ|●|◆|※/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function extractAbilityStoneCandidates(line) {
  const candidates = [];
  const pattern = /(.+?)\s*(?:Lv\.?\s*(\d+)|레벨\s*(\d+))\s*(증가|감소)?(?=\s|$)/gi;
  let match = pattern.exec(line);

  while (match) {
    candidates.push(match[0]);
    match = pattern.exec(line);
  }

  return candidates.length ? candidates : [line];
}

function normalizeAbilityStoneLine(line) {
  if (!line || /무작위\s*각인\s*효과/.test(line)) return "";

  const compactLine = cleanTooltipLine(line);
  const directMatch = compactLine.match(
    /(.+?)\s*(?:Lv\.?\s*(\d+)|레벨\s*(\d+))\s*(증가|감소)?/i,
  );
  if (!directMatch) return "";

  const name = cleanOptionName(directMatch[1]);
  const level = directMatch[2] || directMatch[3] || "0";
  if (!name || Number(level) === 0) return "";

  const direction = directMatch[4] || (/(공격속도|이동속도|방어력|감소|패널티)/.test(name) ? "감소" : "증가");
  return `${name} Lv.${level} ${direction}`;
}

function isUsefulAccessoryOption(line, { name, type }) {
  if (!line || line === name || line === type) return false;
  if (!hasOptionNumber(line)) return false;
  return !isIgnoredEquipmentLine(line);
}

function isUsefulBraceletOption(line, { name, type }) {
  if (!line || line === name || line === type) return false;
  if (!hasOptionNumber(line) && !/(효과|피해|공격력|치명타|쿨타임|재사용|회복|보호막|약점|비수|응원|정밀|순환|우월)/.test(line)) {
    return false;
  }
  return !isIgnoredEquipmentLine(line);
}

function hasOptionNumber(line) {
  return /[+-]?\s*\d+(?:\.\d+)?\s*%?|Lv\.?\s*\d/i.test(line);
}

function isIgnoredEquipmentLine(line) {
  if (line.length < 2 || line.length > 100) return true;
  return /nameTagBox|Element_|slotData|아이템\s*정보|판매|분해|거래|귀속|획득|내구도|장착|레벨|티어|^품질\s*:?\s*\d*$|설명|무작위\s*각인\s*효과|효과가\s*부여|옵션을\s*부여|부여\s*옵션$/i.test(line);
}

function cleanOptionName(value) {
  return cleanTooltipLine(value)
    .replace(/각인\s*효과/g, "")
    .replace(/활성도/g, "")
    .replace(/감소\s*효과/g, "감소")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldSkipTooltipKey(key) {
  return /nameTagBox|slotData|icon|image|button|profile|qualityProgress/i.test(key);
}

export function matchGemSkillName({ effectText = "", gemName = "", skills = [], tooltipText = "" }) {
  const sourceText = normalizeMatchText(`${effectText} ${gemName} ${tooltipText}`);
  const matchedSkill = skills.find((skill) => {
    const skillName = normalizeMatchText(skill.name);
    return skillName && sourceText.includes(skillName);
  });

  if (matchedSkill) return matchedSkill.name;

  const skillMatch = stripHtml(`${effectText} ${tooltipText}`).match(/([가-힣A-Za-z0-9\s]{2,30})(?:의)?\s*(?:피해|재사용|쿨타임|스킬)/);
  return skillMatch?.[1]?.trim() || "";
}

function normalizeMatchText(value) {
  return stripHtml(value).replace(/\s+/g, "").toLowerCase();
}

function getGemRawEffectText({ effect, gem }) {
  const directText = [effect.Name, effect.Description, effect.Effect, effect.Text]
    .filter(Boolean)
    .map(stripHtml)
    .find((value) => isUsefulGemEffectText(value));

  if (directText) return directText;

  const tooltipText = [...getTooltipLines(effect.Tooltip), ...getTooltipLines(gem.Tooltip)].find(isUsefulGemEffectText);
  return tooltipText || "";
}

function isUsefulGemEffectText(value) {
  const text = cleanTooltipLine(value);
  if (!text || text.length > 80) return false;
  if (/NameTagBox|ItemTitle|SingleTextBox|MultiTextBox|Element_|장착|거래|귀속|아이템|티어|레벨|보석/i.test(text)) {
    return false;
  }
  return /피해|데미지|대미지|재사용|쿨타임|쿨\s*감|감소|증가/.test(text);
}

function getGemEffectType(value) {
  if (/재사용|쿨타임|쿨\s*감|감소/.test(value)) return "쿨감";
  if (/피해|데미지|대미지|증가/.test(value)) return "데미지";
  return "";
}

function formatGemEffect({ effectType, skillName }) {
  if (!skillName && !effectType) return "";
  if (!skillName) return effectType;
  if (!effectType) return skillName;
  return `${skillName} · ${effectType}`;
}

function normalizeIconUrl(value) {
  const icon = String(value || "").trim();
  if (!icon) return CHARACTER_PLACEHOLDER_IMAGE;
  if (/^https?:\/\//i.test(icon)) return icon;
  if (icon.startsWith("//")) return `https:${icon}`;
  if (icon.startsWith("/")) return `https://cdn-lostark.game.onstove.com${icon}`;
  if (/^[a-z0-9_.-]+\.(png|jpg|jpeg|webp)$/i.test(icon)) {
    return `/api/asset?name=${encodeURIComponent(icon)}`;
  }

  return `https://cdn-lostark.game.onstove.com/${icon.replace(/^\.?\//, "")}`;
}

function extractIconFromTooltip(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value || "");
  const urlMatch = text.match(/https?:\/\/[^"')\s]+?\.(?:png|jpg|jpeg|webp)/i);
  if (urlMatch) return urlMatch[0];

  const pathMatch = text.match(/(?:\/)?(?:EFUI|efui)[^"')\s]+?\.(?:png|jpg|jpeg|webp)/i);
  if (pathMatch) {
    const path = pathMatch[0].replace(/\\/g, "/");
    return path.startsWith("/") ? path : `/${path}`;
  }

  return "";
}

function getSkillPoint(skill) {
  const explicitPoint = Number(
    skill.Point ??
      skill.SkillPoint ??
      skill.SkillPoints ??
      skill.SkillPointCost ??
      skill.RequiredSkillPoint ??
      "",
  );

  if (Number.isFinite(explicitPoint) && explicitPoint > 0) return explicitPoint;

  // 일부 OpenAPI 응답은 투자 포인트 대신 스킬 레벨만 내려와 레벨 2 이상을 투자 스킬로 봅니다.
  const level = Number(skill.Level || 0);
  return Number.isFinite(level) ? level : 0;
}

function normalizeEngravingLevel(value) {
  if (value == null || value === "") return "0";
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) return String(numericValue);
  const extractedLevel = extractLevel(value);
  return extractedLevel || "0";
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
