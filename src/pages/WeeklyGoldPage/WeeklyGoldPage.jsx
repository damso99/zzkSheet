import { useEffect, useMemo, useState } from "react";
import styles from "./WeeklyGoldPage.module.css";
import { DEFAULT_SHEET_URL, loadSheetRowsByName } from "../RaidSchedulePage/utils/sheetApi.js";

const RAID_GOLD_SHEET_NAME = "레이드골드(귀속)";
const MAX_GOLD_CHARACTERS = 6;
const MAX_RAIDS_PER_CHARACTER = 3;
const GOLD_CONTENT_INDEX = 0;
const GOLD_DIFFICULTY_INDEX = 1;
const GOLD_PARITY_TEXT_INDEX = 2;
const GOLD_MIN_LEVEL_INDEX = 4;
const GOLD_TRADABLE_INDEX = 5;
const GOLD_BOUND_INDEX = 6;
const GOLD_TOTAL_INDEX = 7;

export default function WeeklyGoldPage() {
  const [goldRows, setGoldRows] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [rosterCharacters, setRosterCharacters] = useState([]);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState([]);
  const [selections, setSelections] = useState({});
  const [isRosterLoading, setIsRosterLoading] = useState(false);
  const [isGoldLoading, setIsGoldLoading] = useState(true);
  const [rosterError, setRosterError] = useState("");
  const [selectionMessage, setSelectionMessage] = useState("");
  const [goldError, setGoldError] = useState("");
  const [searchedName, setSearchedName] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    loadSheetRowsByName({ sheetUrl: DEFAULT_SHEET_URL, sheetName: RAID_GOLD_SHEET_NAME, forceRefresh: true, signal: controller.signal })
      .then((payload) => setGoldRows(Array.isArray(payload?.rows) ? payload.rows : []))
      .catch((error) => {
        if (error?.name !== "AbortError") setGoldError(error?.message || "레이드골드(귀속) 시트를 불러오지 못했습니다.");
      })
      .finally(() => { if (!controller.signal.aborted) setIsGoldLoading(false); });
    return () => controller.abort();
  }, []);

  const raidGoldOptions = useMemo(() => parseRaidGoldRows(goldRows), [goldRows]);
  const selectedCharacters = useMemo(
    () => selectedCharacterIds.map((id) => rosterCharacters.find((character) => character.id === id)).filter(Boolean),
    [rosterCharacters, selectedCharacterIds],
  );

  useEffect(() => {
    if (!selectedCharacters.length || !raidGoldOptions.length) return;
    setSelections((current) => {
      const next = { ...current };
      selectedCharacters.forEach((character) => {
        if (!Array.isArray(next[character.id])) next[character.id] = getOptimalRaidSelection(character.levelValue, raidGoldOptions);
      });
      return next;
    });
  }, [selectedCharacters, raidGoldOptions]);

  const characterTotals = useMemo(() => {
    const totals = {};
    selectedCharacters.forEach((character) => {
      totals[character.id] = getSelectedRaidIds(selections[character.id])
        .map((raidId) => raidGoldOptions.find((option) => option.id === raidId))
        .filter(Boolean)
        .reduce((sum, option) => ({
          tradable: sum.tradable + option.tradableGold,
          bound: sum.bound + option.boundGold,
          total: sum.total + option.totalGold,
        }), { tradable: 0, bound: 0, total: 0 });
    });
    return totals;
  }, [selectedCharacters, raidGoldOptions, selections]);

  const rosterTotals = useMemo(
    () => Object.values(characterTotals).reduce((sum, value) => ({
      tradable: sum.tradable + value.tradable,
      bound: sum.bound + value.bound,
      total: sum.total + value.total,
    }), { tradable: 0, bound: 0, total: 0 }),
    [characterTotals],
  );

  async function handleRosterSearch(event) {
    event?.preventDefault();
    const name = cleanText(searchKeyword);
    if (!name || isRosterLoading) return;
    setIsRosterLoading(true);
    setRosterError("");
    setSelectionMessage("");
    try {
      const response = await fetch(`/api/roster?name=${encodeURIComponent(name)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || payload?.detail || "원정대 정보를 불러오지 못했습니다.");
      const characters = parseRosterCharacters(payload?.characters);
      if (!characters.length) throw new Error("원정대 캐릭터를 찾지 못했습니다.");
      setRosterCharacters(characters);
      setSearchedName(name);
      setSelectedCharacterIds(characters.slice(0, MAX_GOLD_CHARACTERS).map((character) => character.id));
      setSelections({});
    } catch (error) {
      setRosterCharacters([]);
      setSelectedCharacterIds([]);
      setSelections({});
      setSearchedName(name);
      setRosterError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRosterLoading(false);
    }
  }

  function toggleGoldCharacter(characterId) {
    setSelectionMessage("");
    setSelectedCharacterIds((current) => {
      if (current.includes(characterId)) return current.filter((id) => id !== characterId);
      if (current.length >= MAX_GOLD_CHARACTERS) {
        setSelectionMessage(`골드 획득 캐릭터는 최대 ${MAX_GOLD_CHARACTERS}명까지 선택할 수 있습니다.`);
        return current;
      }
      return [...current, characterId];
    });
  }

  function handleRaidNameChange(characterId, slotIndex, raidName, characterLevel) {
    setSelections((current) => {
      const next = [...(current[characterId] || Array(MAX_RAIDS_PER_CHARACTER).fill(""))];
      if (!raidName) {
        next[slotIndex] = "";
        return { ...current, [characterId]: next };
      }
      for (let index = 0; index < next.length; index += 1) {
        if (index === slotIndex) continue;
        const selectedOption = raidGoldOptions.find((option) => option.id === next[index]);
        if (selectedOption?.raidName === raidName) next[index] = "";
      }
      const bestDifficulty = raidGoldOptions
        .filter((option) => option.raidName === raidName && characterLevel >= option.minLevel)
        .sort((a, b) => b.totalGold - a.totalGold || b.minLevel - a.minLevel)[0];
      next[slotIndex] = bestDifficulty?.id || "";
      return { ...current, [characterId]: next };
    });
  }

  function handleDifficultyChange(characterId, slotIndex, raidId) {
    setSelections((current) => {
      const next = [...(current[characterId] || Array(MAX_RAIDS_PER_CHARACTER).fill(""))];
      next[slotIndex] = raidId;
      return { ...current, [characterId]: next };
    });
  }

  function resetSelections() {
    const defaults = {};
    selectedCharacters.forEach((character) => { defaults[character.id] = getOptimalRaidSelection(character.levelValue, raidGoldOptions); });
    setSelections(defaults);
  }

  const canUseGoldOptions = !isGoldLoading && !goldError && raidGoldOptions.length > 0;

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} />
      <div className={styles.content}>
        <header className={styles.topHeader}>
          <div><p className={styles.eyebrow}>LostArk Weekly Planner</p><h1>Stick Over Flow</h1></div>
        </header>

        <section className={styles.sectionHeader}>
          <div>
            <h2>원정대 주간 골드</h2>
            <p>캐릭터별 유통 골드와 귀속 골드를 나눠 확인하고, 총 획득량까지 한 번에 계산합니다.</p>
          </div>
        </section>

        <form className={styles.searchPanel} onSubmit={handleRosterSearch}>
          <label className={styles.searchLabel}>캐릭터 검색
            <input type="text" value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} placeholder="캐릭터명을 직접 입력하세요" autoComplete="off" disabled={isRosterLoading} />
          </label>
          <button className={styles.searchButton} type="submit" disabled={isRosterLoading || !cleanText(searchKeyword)}>{isRosterLoading ? "조회 중" : "원정대 조회"}</button>
          <span className={styles.searchHint}>캐릭터/아이템 레벨은 Lost Ark OpenAPI, 골드는 레이드골드(귀속) 시트를 사용합니다.</span>
        </form>

        <section className={styles.summaryGrid} aria-label="주간 골드 요약">
          <SummaryCard label="조회 캐릭터" value={searchedName || "-"} />
          <SummaryCard label="골드 캐릭터" value={`${selectedCharacters.length}/${MAX_GOLD_CHARACTERS}명`} />
          <SummaryCard label="유통 골드" value={`${formatGold(rosterTotals.tradable)} G`} tone="tradable" />
          <SummaryCard label="귀속 골드" value={`${formatGold(rosterTotals.bound)} G`} tone="bound" />
          <SummaryCard label="총합" value={`${formatGold(rosterTotals.total)} G`} emphasis />
        </section>

        {rosterError ? <StatePanel message={rosterError} error /> : null}
        {!searchedName && !isRosterLoading ? <StatePanel message="캐릭터명을 입력하고 원정대 조회를 눌러주세요." /> : null}

        {rosterCharacters.length > 0 ? (
          <section className={styles.rosterPanel}>
            <div className={styles.rosterPanelHeader}><div><h3>골드 획득 캐릭터 선택</h3><p>기본값은 아이템 레벨이 높은 6명입니다. 다른 캐릭터로 자유롭게 교체할 수 있습니다.</p></div><strong>{selectedCharacters.length}/{MAX_GOLD_CHARACTERS}</strong></div>
            <div className={styles.rosterList}>
              {rosterCharacters.map((character) => {
                const checked = selectedCharacterIds.includes(character.id);
                const selectionLocked = !checked && selectedCharacterIds.length >= MAX_GOLD_CHARACTERS;
                return (
                  <label key={character.id} className={`${styles.rosterCharacter} ${checked ? styles.rosterCharacterSelected : ""} ${selectionLocked ? styles.rosterCharacterLocked : ""}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleGoldCharacter(character.id)} />
                    <span className={styles.rosterCheck}>{checked ? "✓" : ""}</span>
                    <span className={styles.rosterCharacterInfo}><strong>{character.characterName}</strong><small>{character.className || "-"} · Lv. {character.level}</small></span>
                  </label>
                );
              })}
            </div>
            {selectionMessage ? <p className={styles.selectionMessage}>{selectionMessage}</p> : null}
          </section>
        ) : null}

        {isGoldLoading && selectedCharacters.length > 0 ? <StatePanel message="레이드골드(귀속) 시트를 불러오는 중입니다." /> : null}
        {!isGoldLoading && goldError && selectedCharacters.length > 0 ? <StatePanel message={`레이드골드(귀속) 조회 실패: ${goldError}`} error /> : null}
        {!isGoldLoading && !goldError && selectedCharacters.length > 0 && raidGoldOptions.length === 0 ? <StatePanel message={`레이드골드(귀속) ${goldRows.length}행을 읽었지만 유효한 레이드 골드를 찾지 못했습니다.`} error /> : null}

        {selectedCharacters.length > 0 ? (
          <>
            <section className={styles.characterGrid}>
              {selectedCharacters.map((character) => {
                const selected = selections[character.id] || Array(MAX_RAIDS_PER_CHARACTER).fill("");
                const availableOptions = raidGoldOptions.filter((option) => character.levelValue >= option.minLevel);
                const availableRaidNames = getAvailableRaidNames(availableOptions);
                const totals = characterTotals[character.id] || { tradable: 0, bound: 0, total: 0 };
                return (
                  <article key={character.id} className={styles.characterCard}>
                    <header className={styles.characterHeader}>
                      <div>
                        <div className={styles.characterTitleLine}><h3>{character.characterName}</h3>{character.className ? <span className={styles.classBadge}>{character.className}</span> : null}</div>
                        <div className={styles.characterMeta}><span>Lv. {character.level}</span>{character.serverName ? <span>{character.serverName}</span> : null}</div>
                      </div>
                      <div className={styles.characterGoldBreakdown}>
                        <span><small>유통</small><strong>{formatGold(totals.tradable)}</strong></span>
                        <span><small>귀속</small><strong>{formatGold(totals.bound)}</strong></span>
                        <span className={styles.characterGoldTotal}><small>총합</small><strong>{formatGold(totals.total)} G</strong></span>
                      </div>
                    </header>

                    <div className={styles.raidSlots}>
                      {Array.from({ length: MAX_RAIDS_PER_CHARACTER }, (_, slotIndex) => {
                        const currentOption = raidGoldOptions.find((option) => option.id === selected[slotIndex]);
                        const selectedRaidNames = selected.filter((_, index) => index !== slotIndex).map((id) => raidGoldOptions.find((option) => option.id === id)?.raidName).filter(Boolean);
                        const difficultyOptions = currentOption ? availableOptions.filter((option) => option.raidName === currentOption.raidName).sort((a, b) => b.minLevel - a.minLevel) : [];
                        return (
                          <div key={`${character.id}-${slotIndex}`} className={styles.raidSlot}>
                            <div className={styles.raidSelectPair}>
                              <label className={styles.selectField}>
                                <span>레이드</span>
                                <select value={currentOption?.raidName || ""} onChange={(event) => handleRaidNameChange(character.id, slotIndex, event.target.value, character.levelValue)} disabled={!canUseGoldOptions}>
                                  <option value="">선택 안 함</option>
                                  {availableRaidNames.map((raidName) => <option key={raidName} value={raidName} disabled={selectedRaidNames.includes(raidName)}>{raidName}</option>)}
                                </select>
                              </label>
                              <label className={styles.selectField}>
                                <span>난이도</span>
                                <select value={selected[slotIndex] || ""} onChange={(event) => handleDifficultyChange(character.id, slotIndex, event.target.value)} disabled={!canUseGoldOptions || !currentOption}>
                                  {!currentOption ? <option value="">레이드 먼저 선택</option> : null}
                                  {difficultyOptions.map((option) => <option key={option.id} value={option.id}>{option.difficulty} · {formatGold(option.totalGold)} G</option>)}
                                </select>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </section>

            <footer className={styles.totalBar}>
              <div className={styles.totalBreakdown}>
                <span><small>유통 골드</small><strong>{formatGold(rosterTotals.tradable)} G</strong></span>
                <span><small>귀속 골드</small><strong>{formatGold(rosterTotals.bound)} G</strong></span>
                <span className={styles.totalGrand}><small>총합</small><strong>{formatGold(rosterTotals.total)} G</strong></span>
              </div>
              <button type="button" className={styles.resetButton} onClick={resetSelections}>최대 골드로 초기화</button>
            </footer>
          </>
        ) : null}
      </div>
    </main>
  );
}

function SummaryCard({ label, value, emphasis = false, tone = "" }) {
  return <article className={`${styles.summaryCard} ${emphasis ? styles.summaryCardEmphasis : ""} ${tone === "tradable" ? styles.summaryCardTradable : ""} ${tone === "bound" ? styles.summaryCardBound : ""}`}><span>{label}</span><strong>{value}</strong></article>;
}

function StatePanel({ message, error = false }) {
  return <section className={`${styles.statePanel} ${error ? styles.errorState : ""}`}>{cleanText(message)}</section>;
}

function parseRosterCharacters(characters) {
  if (!Array.isArray(characters)) return [];
  return characters.map((character, index) => {
    const characterName = cleanText(character?.CharacterName);
    const itemLevel = cleanText(character?.ItemAvgLevel || character?.ItemMaxLevel);
    if (!characterName || !itemLevel) return null;
    return { id: `${cleanText(character?.ServerName)}-${characterName}-${index}`, characterName, className: cleanText(character?.CharacterClassName), serverName: cleanText(character?.ServerName), level: itemLevel, levelValue: parseNumber(itemLevel) };
  }).filter(Boolean).sort((a, b) => b.levelValue - a.levelValue || a.characterName.localeCompare(b.characterName, "ko"));
}

function parseRaidGoldRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  return rows.map((row, index) => {
    const raidName = cleanText(row?.[GOLD_CONTENT_INDEX]);
    const difficulty = cleanText(row?.[GOLD_DIFFICULTY_INDEX]);
    const minLevel = parseNumber(row?.[GOLD_MIN_LEVEL_INDEX]);
    const tradableGold = parseNumber(row?.[GOLD_TRADABLE_INDEX]);
    const boundGold = parseNumber(row?.[GOLD_BOUND_INDEX]);
    const totalGold = parseNumber(row?.[GOLD_TOTAL_INDEX]) || tradableGold + boundGold;
    if (!raidName || !difficulty || minLevel <= 0 || totalGold <= 0) return null;
    const parity = cleanText(row?.[GOLD_PARITY_TEXT_INDEX]) || `${raidName}/${difficulty}`;
    return { id: `${normalize(raidName)}-${normalize(difficulty)}-${index}`, raidName, difficulty, parity, minLevel, tradableGold, boundGold, totalGold, gold: totalGold };
  }).filter(Boolean);
}

function getAvailableRaidNames(options) {
  const bestGoldByRaid = new Map();
  options.forEach((option) => { if (option.totalGold > (bestGoldByRaid.get(option.raidName) || 0)) bestGoldByRaid.set(option.raidName, option.totalGold); });
  return [...bestGoldByRaid.entries()].sort((a, b) => b[1] - a[1]).map(([raidName]) => raidName);
}

function getOptimalRaidSelection(levelValue, options) {
  const bestByRaidName = new Map();
  options.filter((option) => levelValue >= option.minLevel).forEach((option) => {
    const current = bestByRaidName.get(option.raidName);
    if (!current || option.totalGold > current.totalGold) bestByRaidName.set(option.raidName, option);
  });
  const selected = [...bestByRaidName.values()].sort((a, b) => b.totalGold - a.totalGold || b.minLevel - a.minLevel).slice(0, MAX_RAIDS_PER_CHARACTER).map((option) => option.id);
  while (selected.length < MAX_RAIDS_PER_CHARACTER) selected.push("");
  return selected;
}

function getSelectedRaidIds(value) { return Array.isArray(value) ? value.filter(Boolean) : []; }
function parseNumber(value) { const matched = String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/); const number = matched ? Number(matched[0]) : 0; return Number.isFinite(number) ? number : 0; }
function formatGold(value) { return Math.trunc(Number(value) || 0).toLocaleString("ko-KR"); }
function cleanText(value) { return String(value ?? "").replace(/^[\s'\"]+|[\s'\"]+$/g, "").trim(); }
function normalize(value) { return cleanText(value).toLowerCase().replace(/\s+/g, ""); }
