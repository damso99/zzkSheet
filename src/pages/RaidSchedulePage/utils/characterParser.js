export const CHARACTER_PLACEHOLDER_IMAGE = "/character-placeholder.svg";
export const EMPTY_TEXT = "정보 없음";

export function normalizeCharacterDetail(payload = {}) {
  const armory = payload.armory || {};
  const summary = armory.summary || {};
  const profileSource = armory.profile || summary.ArmoryProfile || payload.character || {};
  const equipment = normalizeEquipment(armory.equipment || summary.ArmoryEquipment);
  const skills = normalizeSkills(armory.combatSkills || summary.ArmorySkills);
  const engravingsSource = armory.engravings || summary.ArmoryEngraving;
  const engravings = normalizeEngravings(engravingsSource, armory);
  const engravingImageMap = buildEngravingImageMap(engravingsSource, engravings);

  logEngravingSourceDebug({
    payload: engravingsSource,
    items: engravings,
    imageMap: engravingImageMap,
  });

  return {
    profile: normalizeProfile(profileSource, payload.characterName, { equipment, armory }),
    equipment,
    gems: normalizeGems(armory.gems || summary.ArmoryGem, skills),
    engravings,
    engravingImageMap,
    cards: normalizeCards(armory.cards || summary.ArmoryCard),
    skills,
    warnings: Object.keys(payload.errors || {}),
    fetchedAt: payload.fetchedAt || "",
  };
}

export function displayValue(value) {
  if (value == null || value === "") return EMPTY_TEXT;
  return String(value);
}

function normalizeProfile(profile, fallbackName, { equipment = [], armory = {} } = {}) {
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
    title: displayValue(cleanTitleText(profile.Title)),
    paradisePower: findParadisePower({ profile, equipment, armory }) || "-",
  };
}

function findParadisePower({ profile, equipment, armory }) {
  const directCandidates = [
    profile.ParadisePower,
    profile.NakwonPower,
    profile.NarkPower,
    profile.NirvanaPower,
    profile["낙원력"],
    findStatValue(profile.Stats, "낙원력"),
    findDeepValue(armory?.summary, "ParadisePower"),
    findDeepValue(armory?.summary, "NakwonPower"),
    findDeepValue(armory?.summary, "NarkPower"),
    findDeepValue(armory?.summary, "NirvanaPower"),
  ];

  for (const candidate of directCandidates) {
    const formattedValue = formatNumberText(candidate);
    if (formattedValue) return formattedValue;
  }

  const orbPower = asArray(equipment)
    .map((item) => item.orb?.paradisePowerValue || item.orb?.paradisePower)
    .find(Boolean);

  return formatNumberText(orbPower);
}

function normalizeEquipment(equipment) {
  return asArray(equipment)
    .filter((item) => !isExcludedEquipment(item))
    .map((item) => {
      const tooltipObject = parseMaybeJson(item.Tooltip);
      const tooltipLines = getTooltipLines(item.Tooltip);
      const type = displayValue(item.Type);
      const name = displayValue(stripHtml(item.Name));
      const icon = normalizeIconUrl(item.Icon);
      const category = getEquipmentCategory(type, name);
      const isStone = isAbilityStone(type, name);
      const isOrbItem = isOrb(type, name);
      const abilityStoneLines = isStone ? getTooltipLines(item.Tooltip, { preserveBracketText: true }) : [];

      return {
        category,
        type,
        name,
        icon,
        grade: displayValue(item.Grade),
        quality: displayValue(
          item.Quality !== "" && item.Quality != null ? item.Quality : findDeepValue(tooltipObject, "qualityValue"),
        ),
        enhancement: extractEnhancement(item.Name),
        options: getEquipmentOptions({ category, name, type, tooltipLines }),
        abilityStone: isStone ? parseAbilityStoneDetail(abilityStoneLines, { name, icon }) : null,
        orb: isOrbItem ? parseOrbDetail(tooltipLines, { name, icon }) : null,
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

function normalizeEngravings(engravingsPayload, armory = {}) {
  const primaryItems = asArray(engravingsPayload?.Engravings);
  const rawItems = primaryItems.length ? primaryItems : asArray(engravingsPayload?.ArkPassiveEffects);

  const normalizedItems = rawItems.map((engraving) => normalizeEngravingItem(engraving, "??? ???"));

  return normalizedItems.filter(
    (engraving, index, list) =>
      list.findIndex(
        (item) => item.name === engraving.name && String(item.level) === String(engraving.level),
      ) === index,
  );
}

function buildEngravingImageMap(engravingsPayload = {}, normalizedItems = []) {
  const map = new Map();
  const candidates = [
    ...asArray(engravingsPayload?.Effects),
    ...asArray(engravingsPayload?.Engravings),
    ...asArray(engravingsPayload?.ArkPassiveEffects),
    ...normalizedItems.map((item) => ({
      Name: item.Name || item.name || "",
      Icon:
        item.realApiIconUrl ||
        item.apiIconUrl ||
        item.tooltipIconUrl ||
        item.effectIconUrl ||
        item.Icon ||
        item.icon ||
        item.IconUrl ||
        item.iconUrl ||
        item.Image ||
        item.image ||
        "",
      Grade: item.Grade || item.grade || "",
    })),
  ]
    .map((item) => {
      const name = displayValue(stripHtml(item?.Name || item?.name || item?.EngravingName || item?.Title || ""));
      const normalizedName = normalizeEngravingName(name);
      const icon = normalizeOptionalIconUrl(
        item?.realApiIconUrl ||
        item?.apiIconUrl ||
          item?.tooltipIconUrl ||
          item?.effectIconUrl ||
          item?.Icon ||
          item?.icon ||
          item?.Effect?.Icon ||
          item?.effect?.icon ||
          item?.Image ||
          item?.image ||
          item?.IconUrl ||
          item?.iconUrl ||
          item?.ImageUrl ||
          item?.imageUrl ||
          getRawEngravingIconCandidate(item),
      );

      return { name, normalizedName, icon };
    })
    .filter((item) => item.name && item.icon && !isCommonEngravingIcon(item.icon));

  const uniqueIcons = new Set(candidates.map((item) => item.icon));
  if (candidates.length > 1 && uniqueIcons.size <= 1) {
    return map;
  }

  for (const item of candidates) {
    if (!map.has(item.name)) {
      map.set(item.name, item.icon);
    }
    if (!map.has(item.normalizedName)) {
      map.set(item.normalizedName, item.icon);
    }
  }

  return map;
}

function getRawEngravingIconCandidate(item) {
  return (
    item?.Icon ||
    item?.icon ||
    item?.Effect?.Icon ||
    item?.effect?.icon ||
    item?.Image ||
    item?.image ||
    item?.IconUrl ||
    item?.iconUrl ||
    item?.ImageUrl ||
    item?.imageUrl ||
    ""
  );
}

function isCommonEngravingIcon(value) {
  const text = String(value || "").toLowerCase();
  return (
    !text ||
    text.includes("profile") ||
    text.includes("default") ||
    text.includes("playerinfo") ||
    text.includes("placeholder") ||
    text.startsWith("data:image")
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

function normalizeEngravingItem(engraving, fallbackDescription, iconMap = new Map()) {
  const name = displayValue(stripHtml(engraving.Name || engraving.name || engraving.EngravingName || engraving.Title));
  const level = normalizeEngravingLevel(
    engraving.Level || engraving.level || extractLevel(engraving.Name || engraving.Description || engraving.description),
  );
  const grade = displayValue(engraving.Grade || engraving.grade);
  const directIcon = getDirectEngravingIcon(engraving);
  const tooltipIconUrl = normalizeOptionalIconUrl(
    extractIconFromTooltip(engraving.Tooltip || engraving.tooltip || engraving.Description || engraving.description),
  );
  const effectIconUrl = normalizeOptionalIconUrl(
    engraving.Effect?.Icon || engraving.effect?.icon || engraving.Effect?.icon || engraving.effect?.Icon || "",
  );
  const realApiIconUrl = directIcon || tooltipIconUrl || effectIconUrl || "";
  const tooltip = String(engraving.Tooltip || engraving.tooltip || "");

  return {
    raw: engraving,
    Name: displayValue(stripHtml(engraving.Name || engraving.name || engraving.EngravingName || engraving.Title)),
    name,
    Level: displayValue(engraving.Level || engraving.level || level),
    level,
    Grade: displayValue(engraving.Grade || engraving.grade),
    grade,
    Description: stripHtml(engraving.Description || engraving.description || fallbackDescription),
    description: stripHtml(engraving.Description || engraving.description || fallbackDescription),
    Tooltip: tooltip,
    tooltip,
    Effect: engraving.Effect || engraving.effect || null,
    effect: engraving.effect || engraving.Effect || null,
    apiIconUrl: directIcon,
    realApiIconUrl,
    tooltipIconUrl,
    effectIconUrl,
    Icon: normalizeOptionalIconUrl(engraving.Icon),
    icon: directIcon,
    IconUrl: normalizeOptionalIconUrl(engraving.IconUrl || engraving.iconUrl),
    iconUrl: normalizeOptionalIconUrl(engraving.iconUrl || engraving.IconUrl),
    Image: normalizeOptionalIconUrl(engraving.Image || engraving.image),
    image: normalizeOptionalIconUrl(engraving.image || engraving.Image),
    ImageUrl: normalizeOptionalIconUrl(engraving.ImageUrl || engraving.imageUrl),
    imageUrl: normalizeOptionalIconUrl(engraving.imageUrl || engraving.ImageUrl),
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

function formatNumberText(value) {
  if (value == null || value === "") return "";

  const text = stripHtml(value).replace(/,/g, "").trim();
  if (!text) return "";

  const values = [...text.matchAll(/\d+(?:\.\d+)?/g)].map((match) => match[0]);
  const rawNumber = values.at(-1);
  if (!rawNumber) return "";

  const numericValue = Number(rawNumber);
  if (!Number.isFinite(numericValue)) return rawNumber;

  return numericValue.toLocaleString("ko-KR");
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<img[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function createEngravingIconMap(...sources) {
  const iconMap = new Map();

  sources.flatMap((source) => collectNamedIconItems(source)).forEach((item) => {
    const normalizedName = normalizeEngravingName(item.Name || item.name || item.EngravingName || item.Title);
    const icon = getOptionalIconUrlFromItem(item);
    const grade = normalizeEngravingGrade(item.Grade || item.grade);

    if (normalizedName && icon && !iconMap.has(normalizedName)) {
      iconMap.set(normalizedName, [{ icon, grade }]);
    } else if (normalizedName && icon) {
      const currentItems = iconMap.get(normalizedName) || [];
      currentItems.push({ icon, grade });
      iconMap.set(normalizedName, currentItems);
    }
  });

  return iconMap;
}

function getDirectEngravingIcon(item) {
  const directIcon =
    item?.Icon ||
    item?.icon ||
    item?.IconUrl ||
    item?.iconUrl ||
    item?.Image ||
    item?.image ||
    item?.ImageUrl ||
    item?.imageUrl ||
    "";

  return normalizeOptionalIconUrl(directIcon);
}

function collectNamedIconItems(value, visited = new Set()) {
  if (!value || typeof value !== "object" || visited.has(value)) return [];
  visited.add(value);

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectNamedIconItems(item, visited));
  }

  const currentItem = value.Name || value.name ? [value] : [];
  const nestedItems = Object.values(value).flatMap((childValue) => collectNamedIconItems(childValue, visited));

  return [...currentItem, ...nestedItems];
}

function resolveEngravingIcon(item, iconMap = new Map(), engravingName = "", engravingGrade = "") {
  const directIcon = getOptionalIconUrlFromItem(item);
  if (directIcon) return directIcon;

  const normalizedName = normalizeEngravingName(engravingName || item?.Name || item?.name || item?.EngravingName || item?.Title);
  const normalizedGrade = normalizeEngravingGrade(engravingGrade || item?.Grade || item?.grade);
  const candidates = iconMap.get(normalizedName) || [];
  const matchedIcon =
    candidates.find((candidate) => candidate.grade && normalizedGrade && candidate.grade === normalizedGrade)?.icon ||
    candidates[0]?.icon ||
    "";

  if (matchedIcon) return matchedIcon;

  logEngravingMatchFailure({
    originalName: engravingName || item?.Name || item?.name || item?.EngravingName || item?.Title || "",
    normalizedName,
    normalizedGrade,
    imageMapKeys: [...iconMap.keys()],
    item,
  });

  return CHARACTER_PLACEHOLDER_IMAGE;
}

function getOptionalIconUrlFromItem(item) {
  const rawIcon =
    item?.Icon ||
    item?.icon ||
    item?.IconUrl ||
    item?.iconUrl ||
    item?.IconPath ||
    item?.Image ||
    item?.image ||
    item?.ImageUrl ||
    item?.imageUrl ||
    extractIconFromTooltip(item?.Tooltip || item?.ToolTip || item?.Description || item?.description);

  return normalizeOptionalIconUrl(rawIcon);
}

function normalizeOptionalIconUrl(value) {
  const icon = String(value || "").trim();
  return icon ? normalizeIconUrl(icon) : "";
}

export function normalizeEngravingName(value) {
  return stripHtml(value)
    .replace(/(?:Lv\.?|레벨)\s*\d+/gi, "")
    .replace(/\[[^\]]*]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s*(활성|각인|효과)\s*/g, "")
    .replace(/[^가-힣a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function normalizeEngravingGrade(value) {
  return stripHtml(value).replace(/\s+/g, "").toLowerCase();
}

function logEngravingSourceDebug({ payload, items, imageMap }) {
  if (!isDevMode()) return;

  const sampleItems = items.slice(0, 3).map((item) => ({
    keys: Object.keys(item || {}),
    name: item?.Name || item?.name || item?.EngravingName || item?.Title || "",
    level: item?.Level ?? item?.level ?? "",
    grade: item?.Grade ?? item?.grade ?? "",
    apiIconUrl: item?.apiIconUrl ?? "",
    realApiIconUrl: item?.realApiIconUrl ?? "",
    iconFields: {
      Icon: item?.Icon ?? "",
      icon: item?.icon ?? "",
      IconUrl: item?.IconUrl ?? "",
      iconUrl: item?.iconUrl ?? "",
      Image: item?.Image ?? "",
      image: item?.image ?? "",
      ImageUrl: item?.ImageUrl ?? "",
      imageUrl: item?.imageUrl ?? "",
      tooltipIconUrl: item?.tooltipIconUrl ?? "",
      effectIconUrl: item?.effectIconUrl ?? "",
      EffectIcon: item?.Effect?.Icon ?? item?.effect?.icon ?? "",
    },
    tooltipKeys: typeof item?.Tooltip === "string" ? ["Tooltip"] : [],
  }));

  console.debug("[lostark engravings] payload keys", Object.keys(payload || {}));
  console.debug("[lostark engravings] sample items", sampleItems);
  console.debug("[lostark engravings] image map keys", [...imageMap.keys()].slice(0, 20));
}

function logEngravingMatchFailure({ originalName, normalizedName, imageMapKeys = [], item }) {
  if (!isDevMode()) return;

  console.warn("[lostark engravings] image match failed", {
    originalName,
    normalizedName,
    normalizedGrade: normalizeEngravingGrade(item?.Grade || item?.grade),
    itemKeys: Object.keys(item || {}),
    imageMapKeysSample: imageMapKeys.slice(0, 20),
  });
}

function isDevMode() {
  return Boolean(import.meta?.env?.DEV);
}

export function cleanTitleText(value) {
  return String(value || "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
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
  return parseAbilityStoneDetail(tooltipLines).engravings.map((engraving) => `${engraving.name} ${engraving.level}`);
}

export function parseAbilityStoneDetail(tooltipLines, { name = "", icon = "" } = {}) {
  const rawLines = tooltipLines
    .map((line) => cleanTooltipLine(line, { preserveBracketText: true }))
    .filter(Boolean)
    .flatMap((line) => splitOptionCandidates(line))
    .map(sanitizeAbilityStoneLine)
    .filter(Boolean);
  const lines = rawLines.filter((line) => !isIgnoredAbilityStoneLine(line));
  const basicEffects = lines
    .map(normalizeAbilityStoneBaseEffect)
    .filter(Boolean)
    .filter((line, index, list) => list.indexOf(line) === index)
    .slice(0, 3);

  return {
    name,
    icon,
    baseEffect: basicEffects[0] || "",
    basicEffects,
    engravings: normalizeAbilityStoneEngravings(rawLines),
  };
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

export function getOptionGrade(optionText) {
  const text = cleanTooltipLine(optionText);
  const compactText = text.replace(/\s+/g, "");
  const value = extractOptionNumericValue(text);
  const isPercentOption = /%/.test(text);

  if (!Number.isFinite(value)) return "하";

  if (/아군공격력강화효과/.test(compactText)) return getGradeByThreshold(value, 5, 3);
  if (/아군피해량강화효과/.test(compactText)) return getGradeByThreshold(value, 7.5, 4.5);
  if (/치명타적중률/.test(compactText)) return getGradeByThreshold(value, 1.55, 0.95);
  if (/치명타피해/.test(compactText)) return getGradeByThreshold(value, 4, 2.4);

  if (/추가피해/.test(compactText)) return getGradeByThreshold(value, 2.6, 1.6);
  if (/적에게주는피해/.test(compactText)) return getGradeByThreshold(value, 2, 1.2);
  if (/서폿아덴획득량/.test(compactText)) return getGradeByThreshold(value, 6, 3.6);
  if (/낙인력/.test(compactText)) return getGradeByThreshold(value, 8, 4.8);

  if (/무기공격력/.test(compactText)) {
    return isPercentOption ? getGradeByThreshold(value, 3, 1.8) : getGradeByThreshold(value, 960, 480);
  }

  if (/공격력/.test(compactText)) {
    return isPercentOption ? getGradeByThreshold(value, 1.55, 0.95) : getGradeByThreshold(value, 390, 195);
  }

  return "하";
}

function getGradeByThreshold(value, highThreshold, middleThreshold) {
  if (value >= highThreshold) return "상";
  if (value >= middleThreshold) return "중";
  return "하";
}

function extractOptionNumericValue(optionText) {
  const normalizedText = String(optionText || "").replace(/,/g, "");
  const match = normalizedText.match(/[+-]\s*(\d+(?:\.\d+)?)/) || normalizedText.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : Number.NaN;
}

function parseBraceletOptions(tooltipLines, { name = "", type = "" } = {}) {
  return tooltipLines
    .map(cleanTooltipLine)
    .filter(Boolean)
    .flatMap((line) => splitOptionCandidates(line))
    .map(cleanTooltipLine)
    .filter((line) => !isIgnoredBraceletOption(line))
    .filter((line) => isUsefulBraceletOption(line, { name, type }))
    .filter((line, index, lines) => lines.indexOf(line) === index)
    .slice(0, 10);
}

function getTooltipLines(value, { preserveBracketText = false } = {}) {
  const parsed = parseMaybeJson(value);
  const rawLines = parsed ? collectStrings(parsed) : [value];

  return rawLines.flatMap((line) =>
    String(line || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .split(/\n|ㆍ|●|◆|※/)
      .map((value) => cleanTooltipLine(value, { preserveBracketText })),
  );
}

function cleanTooltipLine(value, { preserveBracketText = false } = {}) {
  const strippedText = stripHtml(value);

  return (preserveBracketText ? strippedText : strippedText.replace(/\[[^\]]*]/g, " "))
    .replace(/부여\s*옵션/gi, " ")
    .replace(/nameTagBox/gi, " ")
    .replace(/태그\s*:/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAbilityStone(type, name) {
  return /어빌리티\s*스톤|스톤/.test(`${type} ${name}`);
}

function isOrb(type, name) {
  return /보주/.test(`${type} ${name}`);
}

export function parseOrbDetail(tooltipLines, { name = "", icon = "" } = {}) {
  const paradisePowerValue = tooltipLines
    .map(cleanTooltipLine)
    .filter(Boolean)
    .flatMap((line) => splitOptionCandidates(line))
    .map(extractParadisePowerValue)
    .find(Boolean);
  const formattedParadisePower = formatNumberText(paradisePowerValue);

  return {
    name,
    icon,
    paradisePowerValue: paradisePowerValue || "",
    paradisePower: formattedParadisePower ? `시즌2 달성 최대 낙원력 : ${formattedParadisePower}` : "",
  };
}

function extractParadisePowerValue(line) {
  const text = cleanTooltipLine(line);
  if (!/낙원력/.test(text)) return "";

  const normalizedText = text.replace(/\s*:\s*/g, " : ").replace(/\s+/g, " ").trim();
  const explicitMatch = normalizedText.match(/낙원력\s*[:：]\s*([\d,]+)/);
  if (explicitMatch) return explicitMatch[1].replace(/,/g, "");

  // 설명 문장에 들어간 "시즌2" 숫자는 낙원력 값이 아니므로 값 라인이 아니면 무시합니다.
  if (!/달성\s*최대\s*낙원력/.test(normalizedText)) return "";

  const values = [...normalizedText.matchAll(/(\d{1,3}(?:,\d{3})+|\d+)/g)].map((match) => match[1]);
  const lastValue = values.at(-1) || "";
  return lastValue && lastValue !== "2" ? lastValue.replace(/,/g, "") : "";
}

function splitOptionCandidates(line) {
  return String(line || "")
    .split(/\n|ㆍ|●|◆|※/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function extractAbilityStoneCandidates(line) {
  const sourceLine = stripAbilityStoneNoiseTokens(line);
  const candidates = [];
  const pattern = /([가-힣A-Za-z][가-힣A-Za-z0-9\s]{0,24}?)\s*Lv\.?\s*(\d+)(?=\s|$|[가-힣A-Za-z])/gi;
  let match = pattern.exec(sourceLine);

  while (match) {
    candidates.push(`${match[1].trim()} Lv.${match[2]}`);
    match = pattern.exec(sourceLine);
  }

  return candidates.length ? candidates : [line];
}

function normalizeAbilityStoneEngravings(lines) {
  return lines
    .flatMap((line) => extractAbilityStoneCandidates(line))
    .filter(isUsefulAbilityStoneCandidate)
    .map(normalizeAbilityStoneEngraving)
    .filter(Boolean)
    .filter((engraving, index, list) => list.findIndex((item) => item.name === engraving.name) === index)
    .slice(0, 3);
}

const ABILITY_STONE_IGNORED_KEYWORDS = [
  "ItemPartBox",
  "IndentStringGroup",
  "Element",
  "체력",
  "최대 체력",
  "추가 효과",
  "설명",
  "거래 제한",
  "아이템 레벨",
  "장비 레벨",
  "품질",
  "획득처",
  "드랍",
];

function sanitizeAbilityStoneLine(line) {
  return cleanTooltipLine(line, { preserveBracketText: true })
    .replace(/\[\s*([^\]]+?)\s*]/g, "$1 ")
    .replace(/무작위\s*각인\s*효과/gi, " ")
    .replace(/각인\s*효과/gi, " ")
    .replace(/활성도/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripAbilityStoneNoiseTokens(line) {
  return sanitizeAbilityStoneLine(line)
    .replace(/ItemPartBox/gi, " ")
    .replace(/IndentStringGroup/gi, " ")
    .replace(/Element(?:_\d+)?/gi, " ")
    .replace(/추가\s*효과/gi, " ")
    .replace(/설명/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isIgnoredAbilityStoneLine(line) {
  const cleanedLine = sanitizeAbilityStoneLine(line);
  return !cleanedLine || isIgnoredDropSourceLine(cleanedLine) || ABILITY_STONE_IGNORED_KEYWORDS.some((keyword) => cleanedLine.includes(keyword));
}

function isUsefulAbilityStoneCandidate(line) {
  const cleanedLine = stripAbilityStoneNoiseTokens(line);
  if (!cleanedLine || !/Lv\.?\s*\d+/i.test(cleanedLine)) return false;
  if (isIgnoredAbilityStoneLine(cleanedLine)) return false;
  if (/기본/.test(cleanedLine)) return false;

  const nameMatch = cleanedLine.match(/^(.+?)\s*Lv\.?\s*\d+/i);
  const optionName = cleanOptionName(nameMatch?.[1] || "");
  return Boolean(optionName);
}

function normalizeAbilityStoneBaseEffect(line) {
  if (isIgnoredAbilityStoneLine(line)) return false;
  const match = cleanTooltipLine(line).match(/기본\s*[가-힣A-Za-z\s]*?\s*[+-]\s*\d+(?:\.\d+)?\s*%?/);
  return match?.[0]?.replace(/\s+/g, " ").trim() || "";
}

function normalizeAbilityStoneEngraving(line) {
  if (!isUsefulAbilityStoneCandidate(line)) return null;

  const compactLine = stripAbilityStoneNoiseTokens(line);
  const directMatch = compactLine.match(/(.+?)\s*Lv\.?\s*(\d+)/i);
  if (!directMatch) return null;

  const name = cleanOptionName(directMatch[1]);
  const level = directMatch[2] || "0";
  const direction = name.includes("감소") ? "감소" : "증가";
  if (!name) return null;

  return { name, level, direction, isNegative: name.includes("감소") || direction === "감소" };
}

function isUsefulAccessoryOption(line, { name, type }) {
  if (!line || line === name || line === type) return false;
  if (isBaseAccessoryStatLine(line)) return false;
  if (!hasOptionNumber(line)) return false;
  return !isIgnoredEquipmentLine(line);
}

function isBaseAccessoryStatLine(line) {
  const normalizedLine = String(line || "").replace(/,/g, "").trim();
  return /^\d+$/.test(normalizedLine) || /^(힘|민첩|지능|체력)\s*\+\s*\d+/.test(normalizedLine);
}

function isUsefulBraceletOption(line, { name, type }) {
  if (!line || line === name || line === type) return false;
  if (isIgnoredBraceletOption(line)) return false;
  if (!hasOptionNumber(line) && !/(효과|피해|공격력|치명타|쿨타임|재사용|회복|보호막|약점|비수|응원|정밀|순환|우월)/.test(line)) {
    return false;
  }
  return !isIgnoredEquipmentLine(line);
}

function isIgnoredBraceletOption(line) {
  const normalizedLine = String(line || "").trim();
  if (!normalizedLine || normalizedLine === "-1") return true;
  return /팔찌\s*효과|효과\s*부여\s*불가|아크\s*패시브\s*포인트\s*효과/.test(normalizedLine);
}

function hasOptionNumber(line) {
  return /[+-]?\s*\d+(?:\.\d+)?\s*%?|Lv\.?\s*\d/i.test(line);
}

function isIgnoredEquipmentLine(line) {
  if (line.length < 2 || line.length > 100) return true;
  if (isIgnoredDropSourceLine(line)) return true;
  return /nameTagBox|Element_|slotData|아이템\s*정보|판매|분해|거래|귀속|획득|내구도|장착|레벨|티어|^품질\s*:?\s*\d*$|설명|무작위\s*각인\s*효과|효과가\s*부여|옵션을\s*부여|부여\s*옵션$/i.test(line);
}

function isIgnoredDropSourceLine(line) {
  const cleanedLine = String(line || "").trim();
  return /^\d+막\s*:/.test(cleanedLine) || /하드|노말|획득처|드랍|군단장|카제로스/.test(cleanedLine);
}

function cleanOptionName(value) {
  return cleanTooltipLine(value)
    .replace(/각인\s*효과/g, "")
    .replace(/활성도/g, "")
    .replace(/감소\s*효과/g, "감소")
    .replace(/\s+감소$/g, "감소")
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
