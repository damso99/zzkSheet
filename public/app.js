import { DEFAULT_RULES, buildHomeworkPlan, normalizeCharacter } from "./partyLogic.js";

const sampleRosters = [
  {
    representative: "루테란대표",
    selectedCharacterName: "루테란대표",
    armory: {
      profile: makeProfile("루테란대표", "실리안", "버서커", "1,682.50"),
      equipment: [
        { Type: "무기", Name: "샘플 무기", Grade: "고대", Icon: "" },
        { Type: "투구", Name: "샘플 투구", Grade: "고대", Icon: "" },
      ],
      engravings: { Effects: [{ Name: "원한 Lv.3" }, { Name: "돌격대장 Lv.3" }] },
      gems: { Gems: [{ Name: "멸화의 보석", Level: 10, Grade: "유물", Icon: "" }] },
      cards: { Cards: [{ Name: "샘플 카드", AwakeCount: 5, Grade: "전설", Icon: "" }] },
      arkpassive: { Points: [{ Name: "진화", Value: 120 }, { Name: "깨달음", Value: 80 }] },
    },
    characters: [
      makeCharacter("루테란대표", "실리안", "버서커", "1,682.50"),
      makeCharacter("루테란바드", "실리안", "바드", "1,665.83"),
      makeCharacter("루테란소울", "실리안", "소울이터", "1,645.00"),
      makeCharacter("루테란도화", "실리안", "도화가", "1,620.00"),
      makeCharacter("루테란건슬", "실리안", "건슬링어", "1,610.00"),
    ],
  },
];

const viewTitles = {
  party: "레벨별 자동 파티",
  character: "캐릭터 상세 정보",
  roster: "원정대 보유캐릭터",
};

const state = {
  activeView: localStorage.getItem("lostark.activeView") || "party",
  selectedRepresentative: localStorage.getItem("lostark.selectedRepresentative") || "",
  rosters: readJson("lostark.rosters", []),
  rules: readJson("lostark.rules", DEFAULT_RULES),
};

const rosterForm = document.querySelector("#roster-form");
const characterNameInput = document.querySelector("#character-name");
const statusText = document.querySelector("#status-text");
const viewTitle = document.querySelector("#view-title");
const rosterCount = document.querySelector("#roster-count");
const characterCount = document.querySelector("#character-count");
const rosterStrip = document.querySelector("#roster-strip");
const planView = document.querySelector("#plan-view");
const characterView = document.querySelector("#character-view");
const rosterView = document.querySelector("#roster-view");
const rulesList = document.querySelector("#rules-list");
const ruleTemplate = document.querySelector("#rule-template");
const tabButtons = [...document.querySelectorAll(".tab-button")];

rosterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = characterNameInput.value.trim();
  if (!name) return;

  setStatus(`${name} 원정대와 캐릭터 상세 정보를 조회하는 중입니다.`);

  try {
    const [rosterResult, armoryResult] = await Promise.allSettled([
      fetchJson(`/api/roster?name=${encodeURIComponent(name)}`),
      fetchJson(`/api/character?name=${encodeURIComponent(name)}`),
    ]);

    if (rosterResult.status === "rejected") throw rosterResult.reason;

    const roster = rosterResult.value;
    if (!Array.isArray(roster.characters)) throw new Error("API 응답 형식이 올바르지 않습니다.");

    const armory = armoryResult.status === "fulfilled" ? armoryResult.value.armory : {};
    upsertRoster({ ...roster, armory, selectedCharacterName: name });
    state.selectedRepresentative = roster.representative;
    state.activeView = "character";
    characterNameInput.value = "";
    persist();
    render();
    setStatus(`${roster.representative} 원정대 ${roster.characters.length}명과 상세 정보를 불러왔습니다.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  }
});

for (const button of tabButtons) {
  button.addEventListener("click", () => {
    state.activeView = button.dataset.view;
    persist();
    renderView();
  });
}

document.querySelector("#sample-button").addEventListener("click", () => {
  state.rosters = sampleRosters;
  state.selectedRepresentative = sampleRosters[0].representative;
  state.activeView = "character";
  persist();
  render();
  setStatus("샘플 원정대로 상세 화면을 생성했습니다.");
});

document.querySelector("#clear-button").addEventListener("click", () => {
  state.rosters = [];
  state.selectedRepresentative = "";
  persist();
  render();
  setStatus("원정대 목록을 비웠습니다.");
});

document.querySelector("#add-rule-button").addEventListener("click", () => {
  state.rules.push({
    id: crypto.randomUUID(),
    name: "신규 숙제",
    minLevel: 1600,
    maxMembers: 8,
  });
  persist();
  renderRules();
  renderPlan();
});

function makeCharacter(CharacterName, ServerName, CharacterClassName, ItemAvgLevel) {
  return {
    CharacterName,
    ServerName,
    CharacterClassName,
    CharacterLevel: 60,
    ItemAvgLevel,
    ItemMaxLevel: ItemAvgLevel,
  };
}

function makeProfile(CharacterName, ServerName, CharacterClassName, ItemAvgLevel) {
  return {
    CharacterName,
    ServerName,
    CharacterClassName,
    CharacterLevel: 70,
    ItemAvgLevel,
    ExpeditionLevel: 300,
    CombatPower: "1,234.56",
    UsingSkillPoint: 480,
    TotalSkillPoint: 480,
    Title: "샘플 칭호",
    GuildName: "샘플길드",
    TownName: "샘플영지",
    CharacterImage: "",
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) throw new Error(buildApiErrorMessage(body));
  return body;
}

function upsertRoster(roster) {
  state.rosters = [
    roster,
    ...state.rosters.filter((item) => item.representative !== roster.representative),
  ];
}

function persist() {
  localStorage.setItem("lostark.rosters", JSON.stringify(state.rosters));
  localStorage.setItem("lostark.rules", JSON.stringify(state.rules));
  localStorage.setItem("lostark.selectedRepresentative", state.selectedRepresentative);
  localStorage.setItem("lostark.activeView", state.activeView);
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || fallback;
  } catch {
    return fallback;
  }
}

function setStatus(message) {
  statusText.textContent = message;
}

function buildApiErrorMessage(body) {
  if (body?.detail?.Message) return body.detail.Message;
  if (body?.detail?.message) return body.detail.message;
  if (body?.error) return body.error;
  return "원정대 조회에 실패했습니다.";
}

function getSelectedRoster() {
  return (
    state.rosters.find((roster) => roster.representative === state.selectedRepresentative) ||
    state.rosters[0] ||
    null
  );
}

function getArmory(roster) {
  if (!roster) return {};
  if (roster.armory) return roster.armory;
  if (roster.profile) return { profile: roster.profile };
  return {};
}

function render() {
  if (!getSelectedRoster()) state.selectedRepresentative = "";
  renderStats();
  renderRosters();
  renderRules();
  renderPlan();
  renderCharacterInfo();
  renderRosterInfo();
  renderView();
}

function renderStats() {
  rosterCount.textContent = state.rosters.length;
  characterCount.textContent = state.rosters.reduce((sum, roster) => sum + roster.characters.length, 0);
}

function renderRosters() {
  rosterStrip.replaceChildren();

  for (const roster of state.rosters) {
    const card = document.createElement("article");
    card.className = `roster-card ${roster.representative === state.selectedRepresentative ? "selected" : ""}`;
    card.innerHTML = `
      <button class="roster-select" type="button">
        <strong>${escapeHtml(roster.representative)}</strong>
        <span>${escapeHtml(roster.characters[0]?.ServerName || "-")} · ${roster.characters.length}명</span>
      </button>
      <button class="roster-remove" type="button" title="원정대 제거" aria-label="원정대 제거">
        <span class="icon x"></span>
      </button>
    `;
    card.querySelector(".roster-select").addEventListener("click", () => {
      state.selectedRepresentative = roster.representative;
      persist();
      render();
    });
    card.querySelector(".roster-remove").addEventListener("click", () => {
      state.rosters = state.rosters.filter((item) => item.representative !== roster.representative);
      if (state.selectedRepresentative === roster.representative) {
        state.selectedRepresentative = state.rosters[0]?.representative || "";
      }
      persist();
      render();
    });
    rosterStrip.append(card);
  }
}

function renderRules() {
  rulesList.replaceChildren();

  for (const rule of state.rules) {
    const item = ruleTemplate.content.firstElementChild.cloneNode(true);
    const name = item.querySelector(".rule-name");
    const level = item.querySelector(".rule-level");
    const members = item.querySelector(".rule-members");

    name.value = rule.name;
    level.value = rule.minLevel;
    members.value = rule.maxMembers;

    name.addEventListener("input", () => updateRule(rule.id, { name: name.value }));
    level.addEventListener("input", () => updateRule(rule.id, { minLevel: Number(level.value || 0) }));
    members.addEventListener("change", () => updateRule(rule.id, { maxMembers: Number(members.value) }));
    item.querySelector(".rule-remove").addEventListener("click", () => {
      state.rules = state.rules.filter((itemRule) => itemRule.id !== rule.id);
      persist();
      renderRules();
      renderPlan();
    });

    rulesList.append(item);
  }
}

function updateRule(id, patch) {
  state.rules = state.rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule));
  persist();
  renderPlan();
}

function renderView() {
  for (const button of tabButtons) {
    button.classList.toggle("active", button.dataset.view === state.activeView);
  }

  viewTitle.textContent = viewTitles[state.activeView] || viewTitles.party;
  planView.hidden = state.activeView !== "party";
  characterView.hidden = state.activeView !== "character";
  rosterView.hidden = state.activeView !== "roster";
  document.querySelector(".rules-panel").hidden = state.activeView !== "party";
}

function renderCharacterInfo() {
  const roster = getSelectedRoster();

  if (!roster) {
    characterView.innerHTML = renderEmpty("캐릭터 정보가 없습니다", "대표 캐릭터명을 검색하면 상세 정보가 표시됩니다.");
    return;
  }

  const armory = getArmory(roster);
  const profile = armory.profile;
  const selectedName = roster.selectedCharacterName || roster.representative;
  const fallback = roster.characters.find((character) => character.CharacterName === selectedName);
  const character = profile || fallback;

  if (!character) {
    characterView.innerHTML = renderEmpty("캐릭터 정보가 없습니다", "원정대 목록에는 있지만 상세 정보를 찾지 못했습니다.");
    return;
  }

  const image = profile?.CharacterImage
    ? `<img class="character-image" src="${escapeHtml(profile.CharacterImage)}" alt="${escapeHtml(character.CharacterName)}" />`
    : `<div class="character-image placeholder" aria-hidden="true"></div>`;

  characterView.innerHTML = `
    <article class="character-profile">
      ${image}
      <div class="profile-summary">
        <span>${escapeHtml(character.ServerName || "-")}</span>
        <h3>${escapeHtml(character.CharacterName || selectedName)}</h3>
        <p>${escapeHtml(character.CharacterClassName || "-")}</p>
      </div>
      <div class="info-grid">
        ${renderInfo("아이템 레벨", character.ItemAvgLevel)}
        ${renderInfo("전투 레벨", character.CharacterLevel)}
        ${renderInfo("원정대 레벨", profile?.ExpeditionLevel)}
        ${renderInfo("전투력", profile?.CombatPower)}
        ${renderInfo("스킬 포인트", renderSkillPoint(profile))}
        ${renderInfo("칭호", profile?.Title)}
        ${renderInfo("길드", profile?.GuildName)}
        ${renderInfo("영지", profile?.TownName)}
      </div>
    </article>
    <section class="armory-grid">
      ${renderEquipmentSection(armory.equipment)}
      ${renderEngravingSection(armory.engravings)}
      ${renderGemSection(armory.gems)}
      ${renderCardSection(armory.cards)}
      ${renderArkPassiveSection(armory.arkpassive, armory.arkgrid)}
    </section>
  `;
}

function renderRosterInfo() {
  const roster = getSelectedRoster();

  if (!roster) {
    rosterView.innerHTML = renderEmpty("보유 캐릭터가 없습니다", "대표 캐릭터명을 검색하면 원정대 캐릭터가 표시됩니다.");
    return;
  }

  const characters = roster.characters
    .map((character) => normalizeCharacter(character, roster.representative))
    .sort((a, b) => b.itemLevel - a.itemLevel);

  rosterView.innerHTML = `
    <section class="roster-table-wrap">
      <header class="section-heading">
        <div>
          <span>${escapeHtml(roster.representative)}</span>
          <h3>원정대 보유캐릭터</h3>
        </div>
        <p>${characters.length}명</p>
      </header>
      <div class="roster-table">
        <div class="roster-table-head">
          <span>캐릭터</span>
          <span>직업</span>
          <span>서버</span>
          <span>아이템 레벨</span>
        </div>
        ${characters.map(renderRosterRow).join("")}
      </div>
    </section>
  `;

  for (const row of rosterView.querySelectorAll(".roster-row")) {
    row.addEventListener("click", () => loadRosterCharacter(row.dataset.name));
  }
}

function renderPlan() {
  planView.replaceChildren();

  if (state.rosters.length === 0) {
    const empty = document.createElement("section");
    empty.className = "empty";
    empty.innerHTML = `
      <div class="empty-emblem" aria-hidden="true"></div>
      <h3>아직 원정대가 없습니다</h3>
      <p>대표 캐릭터명을 조회하면 레벨별 숙제 파티가 자동으로 채워집니다.</p>
    `;
    planView.append(empty);
    return;
  }

  const plan = buildHomeworkPlan(state.rosters, state.rules);

  for (const group of plan) {
    const section = document.createElement("section");
    section.className = "raid-section";

    const header = document.createElement("header");
    header.className = "raid-header";
    header.innerHTML = `
      <div>
        <span>${group.rule.minLevel.toLocaleString("ko-KR")}+</span>
        <h3>${escapeHtml(group.rule.name)}</h3>
      </div>
      <p>${group.eligibleCount}명 · ${group.rule.maxMembers}인 파티</p>
    `;

    const partyGrid = document.createElement("div");
    partyGrid.className = "party-grid";

    if (group.parties.length === 0) {
      partyGrid.innerHTML = `<p class="muted">조건을 만족하는 캐릭터가 없습니다.</p>`;
    }

    for (const party of group.parties) {
      const partyCard = document.createElement("article");
      partyCard.className = "party-card";
      partyCard.innerHTML = `
        <div class="party-title">
          <strong>${party.partyNumber}파티</strong>
          <span>${party.members.length}/${party.maxMembers}</span>
        </div>
        <div class="member-list">
          ${party.members.map(renderMember).join("")}
        </div>
      `;
      partyGrid.append(partyCard);
    }

    section.append(header, partyGrid);
    planView.append(section);
  }
}

function renderEquipmentSection(equipment) {
  return renderArmorySection(
    "장비",
    Array.isArray(equipment) ? equipment.map((item) => renderIconItem(item.Name, item.Type, item.Grade, item.Icon)) : [],
  );
}

function renderEngravingSection(engravings) {
  const effects = engravings?.Effects || engravings?.ArkPassiveEffects || [];
  return renderArmorySection(
    "각인",
    effects.map((item) => renderTextItem(item.Name || item.Description || item.AbilityStoneLevel || "각인 정보", item.Level)),
  );
}

function renderGemSection(gems) {
  const gemList = gems?.Gems || [];
  return renderArmorySection(
    "보석",
    gemList.map((gem) => renderIconItem(gem.Name, gem.Level ? `Lv.${gem.Level}` : gem.SkillName, gem.Grade, gem.Icon)),
  );
}

function renderCardSection(cards) {
  const cardList = cards?.Cards || [];
  const effects = cards?.Effects || [];
  const items = [
    ...cardList.map((card) => renderIconItem(card.Name, card.AwakeCount ? `${card.AwakeCount}각성` : card.Grade, card.Grade, card.Icon)),
    ...effects.map((effect) => renderTextItem(effect.Name, effect.Description)),
  ];
  return renderArmorySection("카드", items);
}

function renderArkPassiveSection(arkpassive, arkgrid) {
  const points = arkpassive?.Points || arkpassive?.ArkPassivePoints || [];
  const effects = arkpassive?.Effects || arkpassive?.ArkPassiveEffects || [];
  const gridEffects = arkgrid?.Effects || [];
  const items = [
    ...points.map((point) => renderTextItem(point.Name || point.Type, point.Value ?? point.Point)),
    ...effects.map((effect) => renderTextItem(effect.Name, effect.Description)),
    ...gridEffects.map((effect) => renderTextItem(effect.Name, effect.Description)),
  ];
  return renderArmorySection("아크패시브", items);
}

function renderArmorySection(title, items) {
  return `
    <article class="armory-section">
      <header>
        <h3>${escapeHtml(title)}</h3>
        <span>${items.length}개</span>
      </header>
      <div class="armory-list">
        ${items.length ? items.join("") : `<p class="muted">표시할 정보가 없습니다.</p>`}
      </div>
    </article>
  `;
}

function renderIconItem(name, meta, grade, icon) {
  const iconMarkup = icon
    ? `<img src="${escapeHtml(icon)}" alt="" />`
    : `<span class="item-icon-placeholder" aria-hidden="true"></span>`;

  return `
    <div class="armory-item">
      ${iconMarkup}
      <div>
        <strong>${escapeHtml(name || "-")}</strong>
        <span>${escapeHtml([meta, grade].filter(Boolean).join(" · ") || "-")}</span>
      </div>
    </div>
  `;
}

function renderTextItem(name, meta) {
  return `
    <div class="armory-item text-only">
      <div>
        <strong>${escapeHtml(name || "-")}</strong>
        <span>${escapeHtml(meta || "-")}</span>
      </div>
    </div>
  `;
}

function renderInfo(label, value) {
  return `
    <div class="info-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "-")}</strong>
    </div>
  `;
}

function renderRosterRow(member) {
  const role = member.isSupport ? "support" : "dealer";
  return `
    <button class="roster-row ${role}" type="button" title="${escapeHtml(member.name)}" data-name="${escapeHtml(member.name)}">
      <span>${escapeHtml(member.name)}</span>
      <span>${escapeHtml(member.className)}</span>
      <span>${escapeHtml(member.serverName)}</span>
      <strong>${escapeHtml(member.itemLevelText)}</strong>
    </button>
  `;
}

async function loadRosterCharacter(characterName) {
  const roster = getSelectedRoster();
  if (!roster) return;

  setStatus(`${characterName} Armories 상세 정보를 조회하는 중입니다.`);

  try {
    const body = await fetchJson(`/api/character?name=${encodeURIComponent(characterName)}`);
    roster.armory = body.armory;
    roster.selectedCharacterName = characterName;
    state.activeView = "character";
    persist();
    render();
    setStatus(`${characterName} 상세 정보를 불러왔습니다.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  }
}

function renderSkillPoint(profile) {
  if (!profile?.UsingSkillPoint && !profile?.TotalSkillPoint) return "";
  return `${profile.UsingSkillPoint || 0} / ${profile.TotalSkillPoint || 0}`;
}

function renderMember(member) {
  const role = member.isSupport ? "support" : "dealer";
  return `
    <div class="member ${role}">
      <div>
        <strong>${escapeHtml(member.name)}</strong>
        <span>${escapeHtml(member.owner)} · ${escapeHtml(member.className)}</span>
      </div>
      <b>${escapeHtml(member.itemLevelText)}</b>
    </div>
  `;
}

function renderEmpty(title, message) {
  return `
    <section class="empty">
      <div class="empty-emblem" aria-hidden="true"></div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

render();
