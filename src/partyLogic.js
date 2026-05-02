export const WEEKLY_RAID_LIMIT = 3;
export const ROSTER_PARTY_CHARACTER_LIMIT = 6;
export const DAILY_PARTY_LIMIT = 6;
export const WEEKDAYS = ["수", "목", "금", "토", "일", "월", "화"];

export const DEFAULT_RULES = [
  { id: "cathedral-horizon-stage1", groupId: "cathedral-horizon", name: "지평의 성당 1단계", minLevel: 1700, maxMembers: 4 },
  { id: "cathedral-horizon-stage2", groupId: "cathedral-horizon", name: "지평의 성당 2단계", minLevel: 1720, maxMembers: 4 },
  { id: "cathedral-horizon-stage3", groupId: "cathedral-horizon", name: "지평의 성당 3단계", minLevel: 1750, maxMembers: 4 },
  { id: "serka-normal", groupId: "serka", name: "세르카 노말", minLevel: 1710, maxMembers: 4 },
  { id: "serka-hard", groupId: "serka", name: "세르카 하드", minLevel: 1730, maxMembers: 4 },
  { id: "serka-nightmare", groupId: "serka", name: "세르카 나이트메어", minLevel: 1740, maxMembers: 4 },
  { id: "kazeroth-prologue-normal", groupId: "kazeroth-prologue", name: "카제로스 서막 노말", minLevel: 1620, maxMembers: 8 },
  { id: "kazeroth-prologue-hard", groupId: "kazeroth-prologue", name: "카제로스 서막 하드", minLevel: 1640, maxMembers: 8 },
  { id: "kazeroth-act1-normal", groupId: "kazeroth-act1", name: "카제로스 1막 노말", minLevel: 1660, maxMembers: 8 },
  { id: "kazeroth-act1-hard", groupId: "kazeroth-act1", name: "카제로스 1막 하드", minLevel: 1680, maxMembers: 8 },
  { id: "kazeroth-act2-normal", groupId: "kazeroth-act2", name: "카제로스 2막 노말", minLevel: 1670, maxMembers: 8 },
  { id: "kazeroth-act2-hard", groupId: "kazeroth-act2", name: "카제로스 2막 하드", minLevel: 1690, maxMembers: 8 },
  { id: "kazeroth-act3-normal", groupId: "kazeroth-act3", name: "카제로스 3막 노말", minLevel: 1680, maxMembers: 8 },
  { id: "kazeroth-act3-hard", groupId: "kazeroth-act3", name: "카제로스 3막 하드", minLevel: 1700, maxMembers: 8 },
  { id: "kazeroth-act4-normal", groupId: "kazeroth-act4", name: "카제로스 4막 노말", minLevel: 1700, maxMembers: 8 },
  { id: "kazeroth-act4-hard", groupId: "kazeroth-act4", name: "카제로스 4막 하드", minLevel: 1720, maxMembers: 8 },
  { id: "kazeroth-finale-normal", groupId: "kazeroth-finale", name: "카제로스 종막 노말", minLevel: 1710, maxMembers: 8 },
  { id: "kazeroth-finale-hard", groupId: "kazeroth-finale", name: "카제로스 종막 하드", minLevel: 1730, maxMembers: 8 },
];

export const SUPPORT_CLASSES = new Set(["바드", "홀리나이트", "도화가"]);

export function parseItemLevel(value) {
  return Number(String(value ?? "0").replace(/,/g, ""));
}

export function normalizeCharacter(character, owner) {
  const itemLevel = parseItemLevel(character.ItemAvgLevel);

  return {
    owner,
    serverName: character.ServerName,
    name: character.CharacterName,
    className: character.CharacterClassName,
    characterLevel: character.CharacterLevel,
    itemLevel,
    itemLevelText: itemLevel.toLocaleString("ko-KR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    isSupport: SUPPORT_CLASSES.has(character.CharacterClassName),
  };
}

export function getEligibleRulesForCharacter(character, rules) {
  const itemLevel = parseItemLevel(character.ItemAvgLevel ?? character.itemLevel);

  return rules
    .filter((rule) => itemLevel >= rule.minLevel)
    .sort((a, b) => {
      if (a.minLevel !== b.minLevel) return b.minLevel - a.minLevel;
      return rules.indexOf(a) - rules.indexOf(b);
    });
}

export function getDefaultRaidSelection(character, rules) {
  return limitRaidSelection(
    getEligibleRulesForCharacter(character, rules).map((rule) => rule.id),
    rules,
  );
}

export function getCharacterRaidSelection(character, roster, rules) {
  const saved = roster.raidSelections?.[character.CharacterName] || roster.raidSelections?.[character.name];

  if (Array.isArray(saved)) {
    return limitRaidSelection(saved, rules);
  }

  return getDefaultRaidSelection(character, rules);
}

export function getCharacterAvailableDays(character, roster) {
  const saved = roster.characterSchedules?.[character.CharacterName] || roster.characterSchedules?.[character.name];

  if (Array.isArray(saved)) {
    return saved.filter((day) => WEEKDAYS.includes(day));
  }

  return WEEKDAYS;
}

export function limitRaidSelection(raidIds, rules) {
  const selected = [];
  const selectedGroups = new Set();

  for (const raidId of raidIds) {
    const rule = rules.find((item) => item.id === raidId);
    if (!rule) continue;

    const groupId = rule.groupId || rule.id;
    if (selectedGroups.has(groupId)) continue;

    selected.push(raidId);
    selectedGroups.add(groupId);

    if (selected.length >= WEEKLY_RAID_LIMIT) break;
  }

  return selected;
}

export function buildEligibleCharacters(rosters, rule, rules) {
  return rosters
    .flatMap((roster) =>
      getPartyEligibleRosterCharacters(roster).map((character) => ({
        ...normalizeCharacter(character, roster.representative),
        availableDays: getCharacterAvailableDays(character, roster),
        selectedRaidIds: getCharacterRaidSelection(character, roster, rules),
      })),
    )
    .filter((character) => character.itemLevel >= rule.minLevel)
    .filter((character) => character.selectedRaidIds.includes(rule.id))
    .sort((a, b) => {
      if (a.itemLevel !== b.itemLevel) return b.itemLevel - a.itemLevel;
      if (a.owner !== b.owner) return a.owner.localeCompare(b.owner, "ko");
      return a.name.localeCompare(b.name, "ko");
    });
}

function getPartyEligibleRosterCharacters(roster) {
  if (Array.isArray(roster.partyCharacterNames)) {
    const selectedNames = new Set(roster.partyCharacterNames);
    return roster.characters.filter((character) => selectedNames.has(character.CharacterName));
  }

  return [...roster.characters]
    .sort((a, b) => parseItemLevel(b.ItemAvgLevel) - parseItemLevel(a.ItemAvgLevel))
    .slice(0, ROSTER_PARTY_CHARACTER_LIMIT);
}

export function getDefaultPartyCharacterNames(roster) {
  return [...roster.characters]
    .sort((a, b) => parseItemLevel(b.ItemAvgLevel) - parseItemLevel(a.ItemAvgLevel))
    .slice(0, ROSTER_PARTY_CHARACTER_LIMIT)
    .map((character) => character.CharacterName);
}

export function getPartyCharacterNames(roster) {
  if (Array.isArray(roster.partyCharacterNames)) {
    return roster.partyCharacterNames;
  }

  return getDefaultPartyCharacterNames(roster);
}

export function buildPartiesForRule(rosters, rule, rules, day) {
  const eligible = buildEligibleCharacters(rosters, rule, rules).filter((character) =>
    character.availableDays.includes(day),
  );
  const partyCount = calculatePartyCount(eligible, rule.maxMembers);
  const parties = Array.from({ length: partyCount }, (_, index) => ({
    id: `${day}-${rule.id}-${index + 1}`,
    day,
    raidName: rule.name,
    partyNumber: index + 1,
    maxMembers: rule.maxMembers,
    minLevel: rule.minLevel,
    members: [],
  }));

  const queue = prioritizeSupports(eligible);

  for (const character of queue) {
    const party = findAvailableParty(parties, character);

    if (party) {
      party.members.push(character);
    }
  }

  return parties.filter((party) => party.members.length > 0);
}

function calculatePartyCount(characters, maxMembers) {
  const ownerCounts = new Map();

  for (const character of characters) {
    ownerCounts.set(character.owner, (ownerCounts.get(character.owner) || 0) + 1);
  }

  const byTotalMembers = Math.ceil(characters.length / maxMembers);
  const byOwnerLimit = Math.max(0, ...ownerCounts.values());

  return Math.max(byTotalMembers, byOwnerLimit);
}

function prioritizeSupports(characters) {
  return [...characters].sort((a, b) => {
    if (a.isSupport !== b.isSupport) return a.isSupport ? -1 : 1;
    if (a.itemLevel !== b.itemLevel) return b.itemLevel - a.itemLevel;
    if (a.owner !== b.owner) return a.owner.localeCompare(b.owner, "ko");
    return a.name.localeCompare(b.name, "ko");
  });
}

function findAvailableParty(parties, character) {
  return parties
    .filter((party) => party.members.length < party.maxMembers)
    .filter((party) => !party.members.some((member) => member.owner === character.owner))
    .sort((a, b) => {
      const supportDiff = supportCount(a) - supportCount(b);
      if (character.isSupport && supportDiff !== 0) return supportDiff;
      if (a.members.length !== b.members.length) return a.members.length - b.members.length;
      return a.partyNumber - b.partyNumber;
    })[0];
}

function supportCount(party) {
  return party.members.filter((member) => member.isSupport).length;
}

export function buildHomeworkPlan(rosters, rules) {
  return WEEKDAYS.map((day) => ({
    day,
    raids: buildDailyRaidPlan(rosters, rules, day),
  }));
}

function buildDailyRaidPlan(rosters, rules, day) {
  let remainingPartySlots = DAILY_PARTY_LIMIT;
  const dailyPlan = [];

  for (const rule of rules) {
    const eligibleCount = buildEligibleCharacters(rosters, rule, rules).filter((character) =>
      character.availableDays.includes(day),
    ).length;
    const parties = remainingPartySlots > 0 ? buildPartiesForRule(rosters, rule, rules, day).slice(0, remainingPartySlots) : [];

    remainingPartySlots -= parties.length;
    dailyPlan.push({ rule, eligibleCount, parties });
  }

  return dailyPlan;
}
