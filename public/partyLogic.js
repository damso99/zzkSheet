export const DEFAULT_RULES = [
  { id: "kayangel", name: "카양겔", minLevel: 1540, maxMembers: 4 },
  { id: "akkan", name: "일리아칸", minLevel: 1580, maxMembers: 8 },
  { id: "thaemine", name: "카멘", minLevel: 1610, maxMembers: 8 },
  { id: "echidna", name: "에키드나", minLevel: 1620, maxMembers: 8 },
  { id: "behemoth", name: "베히모스", minLevel: 1640, maxMembers: 16 },
  { id: "aegir", name: "아게오로스", minLevel: 1660, maxMembers: 4 },
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

export function buildEligibleCharacters(rosters, rule) {
  return rosters
    .flatMap((roster) => roster.characters.map((character) => normalizeCharacter(character, roster.representative)))
    .filter((character) => character.itemLevel >= rule.minLevel)
    .sort((a, b) => {
      if (a.itemLevel !== b.itemLevel) return b.itemLevel - a.itemLevel;
      if (a.owner !== b.owner) return a.owner.localeCompare(b.owner, "ko");
      return a.name.localeCompare(b.name, "ko");
    });
}

export function buildPartiesForRule(rosters, rule) {
  const eligible = buildEligibleCharacters(rosters, rule);
  const desiredSupports = Math.max(1, Math.floor(rule.maxMembers / 4));
  const partyCount = Math.ceil(eligible.length / rule.maxMembers);
  const parties = Array.from({ length: partyCount }, (_, index) => ({
    id: `${rule.id}-${index + 1}`,
    raidName: rule.name,
    partyNumber: index + 1,
    maxMembers: rule.maxMembers,
    minLevel: rule.minLevel,
    members: [],
  }));

  const supports = eligible.filter((character) => character.isSupport);
  const dealers = eligible.filter((character) => !character.isSupport);

  for (const party of parties) {
    while (party.members.filter((member) => member.isSupport).length < desiredSupports && supports.length > 0) {
      party.members.push(supports.shift());
    }
  }

  const queue = [...dealers, ...supports];
  for (const character of queue) {
    const party = parties
      .filter((item) => item.members.length < item.maxMembers)
      .sort((a, b) => a.members.length - b.members.length)[0];

    if (party) party.members.push(character);
  }

  return parties.filter((party) => party.members.length > 0);
}

export function buildHomeworkPlan(rosters, rules) {
  return rules.map((rule) => ({
    rule,
    eligibleCount: buildEligibleCharacters(rosters, rule).length,
    parties: buildPartiesForRule(rosters, rule),
  }));
}
