import { useEffect, useMemo, useState } from "react";
import styles from "./WeeklyGoldPage.module.css";
import { DEFAULT_SHEET_URL, loadSheetRowsByName } from "../RaidSchedulePage/utils/sheetApi.js";

const PERSONAL_RAID_SHEET_NAME = "개인레이드";
const RAID_GOLD_SHEET_NAME = "레이드골드(귀속)";
const OWNER_COLUMN_INDEX = 1;
const CHARACTER_COLUMN_INDEX = 3;
const LEVEL_COLUMN_INDEX = 4;
const POWER_COLUMN_INDEX = 5;
const CLASS_COLUMN_INDEX = 6;
const MAX_RAIDS_PER_CHARACTER = 3;

const GOLD_CONTENT_INDEX = 0;
const GOLD_DIFFICULTY_INDEX = 1;
const GOLD_PARITY_TEXT_INDEX = 2;
const GOLD_MIN_LEVEL_INDEX = 4;
const GOLD_TOTAL_INDEX = 7;
const RAID_NAMES = new Set(["모르둠", "아르모체", "카제로스", "세르카", "지평", "벨가르딘"]);

export default function WeeklyGoldPage() {
  const [personalRows, setPersonalRows] = useState([]);
  const [goldRows, setGoldRows] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selections, setSelections] = useState({});
  const [isPersonalLoading, setIsPersonalLoading] = useState(true);
  const [isGoldLoading, setIsGoldLoading] = useState(true);
  const [personalError, setPersonalError] = useState("");
  const [goldError, setGoldError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    loadSheetRowsByName({ sheetUrl: DEFAULT_SHEET_URL, sheetName: PERSONAL_RAID_SHEET_NAME, signal: controller.signal })
      .then((payload) => setPersonalRows(Array.isArray(payload?.rows) ? payload.rows : []))
      .catch((error) => {
        if (error?.name !== "AbortError") setPersonalError(error?.message || "개인레이드 시트를 불러오지 못했습니다.");
      })
      .finally(() => { if (!controller.signal.aborted) setIsPersonalLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadSheetRowsByName({ sheetUrl: DEFAULT_SHEET_URL, sheetName: RAID_GOLD_SHEET_NAME, signal: controller.signal })
      .then((payload) => setGoldRows(Array.isArray(payload?.rows) ? payload.rows : []))
      .catch((error) => {
        if (error?.name !== "AbortError") setGoldError(error?.message || "레이드골드(귀속) 시트를 불러오지 못했습니다.");
      })
      .finally(() => { if (!controller.signal.aborted) setIsGoldLoading(false); });
    return () => controller.abort();
  }, []);

  const characters = useMemo(() => parsePersonalRaidRows(personalRows), [personalRows]);
  const raidGoldOptions = useMemo(() => parseRaidGoldRows(goldRows), [goldRows]);
  const keyword = normalize(searchKeyword);
  const filteredCharacters = useMemo(() => {
    if (!keyword) return [];
    return characters.filter((item) => normalize(item.owner).includes(keyword)).sort((a, b) => b.levelValue - a.levelValue);
  }, [characters, keyword]);
  const selectedOwnerNames = useMemo(() => [...new Set(filteredCharacters.map((item) => item.owner))], [filteredCharacters]);

  useEffect(() => {
    if (!filteredCharacters.length || !raidGoldOptions.length) return;
    const defaults = {};
    filteredCharacters.forEach((character) => {
      defaults[character.id] = getOptimalRaidSelection(character.levelValue, raidGoldOptions);
    });
    setSelections(defaults);
  }, [filteredCharacters, raidGoldOptions]);

  const characterTotals = useMemo(() => {
    const totals = {};
    filteredCharacters.forEach((character) => {
      totals[character.id] = getSelectedRaidIds(selections[character.id])
        .map((raidId) => raidGoldOptions.find((option) => option.id === raidId)?.gold || 0)
        .reduce((sum, gold) => sum + gold, 0);
    });
    return totals;
  }, [filteredCharacters, raidGoldOptions, selections]);

  const totalGold = useMemo(() => Object.values(characterTotals).reduce((sum, value) => sum + value, 0), [characterTotals]);
  const selectedRaidCount = useMemo(() => filteredCharacters.reduce((sum, character) => sum + getSelectedRaidIds(selections[character.id]).length, 0), [filteredCharacters, selections]);

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
        .sort((a, b) => b.gold - a.gold || b.minLevel - a.minLevel)[0];

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
    filteredCharacters.forEach((character) => {
      defaults[character.id] = getOptimalRaidSelection(character.levelValue, raidGoldOptions);
    });
    setSelections(defaults);
  }

  const canUseGoldOptions = !isGoldLoading && !goldError && raidGoldOptions.length > 0;

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} />
      <div className={styles.content}>
        <header className={styles.topHeader}>
          <div><p className={styles.eyebrow}>LostArk Weekly Planner</p><h1>Stick Over Flow</h1></div>
          <div className={styles.headerActions}>
            <a className={styles.secondaryButton} href="/">일정으로 돌아가기</a>
            <a className={styles.sheetButton} href={DEFAULT_SHEET_URL} target="_blank" rel="noreferrer">시트 열기 <span aria-hidden="true">↗</span></a>
          </div>
        </header>

        <section className={styles.sectionHeader}>
          <div>
            <h2>원정대 주간 골드</h2>
            <p>캐릭터별 최대 3개 레이드, 레이드명별 1개 난이도만 선택합니다. 기본값은 입장 가능한 최대 골드 조합입니다.</p>
          </div>
        </section>

        <section className={styles.searchPanel}>
          <label className={styles.searchLabel}>이름 검색
            <input type="text" value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} placeholder="이름을 직접 입력하세요" autoComplete="off" disabled={isPersonalLoading} />
          </label>
          <span className={styles.searchHint}>레이드골드(귀속)의 합계 골드를 기준으로 계산합니다.</span>
        </section>

        <section className={styles.summaryGrid} aria-label="주간 골드 요약">
          <SummaryCard label="조회 원정대" value={selectedOwnerNames.length ? selectedOwnerNames.join(", ") : "-"} />
          <SummaryCard label="캐릭터" value={`${filteredCharacters.length}명`} />
          <SummaryCard label="선택 레이드" value={`${selectedRaidCount}개`} />
          <SummaryCard label="예상 획득 골드" value={`${formatGold(totalGold)} G`} emphasis />
        </section>

        {isPersonalLoading ? <StatePanel message="개인레이드 시트를 불러오는 중입니다." /> : null}
        {!isPersonalLoading && personalError ? <StatePanel message={`개인레이드 조회 실패: ${personalError}`} error /> : null}
        {!isPersonalLoading && !personalError && !keyword ? <StatePanel message="이름을 검색하면 원정대 캐릭터가 표시됩니다." /> : null}
        {!isPersonalLoading && !personalError && keyword && filteredCharacters.length === 0 ? <StatePanel message={`'${cleanText(searchKeyword)}' 이름으로 개인레이드 시트에서 캐릭터를 찾지 못했습니다.`} /> : null}

        {!isPersonalLoading && !personalError && filteredCharacters.length > 0 ? (
          <>
            {isGoldLoading ? <StatePanel message="레이드골드(귀속) 시트를 불러오는 중입니다." /> : null}
            {!isGoldLoading && goldError ? <StatePanel message={`레이드골드(귀속) 조회 실패: ${goldError}`} error /> : null}
            {!isGoldLoading && !goldError && raidGoldOptions.length === 0 ? (
              <StatePanel message={`레이드골드(귀속) ${goldRows.length}행을 읽었지만 A~H 고정 컬럼에서 유효한 레이드 골드를 찾지 못했습니다.`} error />
            ) : null}

            <section className={styles.characterGrid}>
              {filteredCharacters.map((character) => {
                const selected = selections[character.id] || Array(MAX_RAIDS_PER_CHARACTER).fill("");
                const availableOptions = raidGoldOptions.filter((option) => character.levelValue >= option.minLevel);
                const availableRaidNames = getAvailableRaidNames(availableOptions);

                return (
                  <article key={character.id} className={styles.characterCard}>
                    <header className={styles.characterHeader}>
                      <div>
                        <div className={styles.characterTitleLine}><h3>{character.characterName}</h3>{character.className ? <span className={styles.classBadge}>{character.className}</span> : null}</div>
                        <div className={styles.characterMeta}><span>Lv. {character.level || "-"}</span>{character.power ? <span>전투력 {character.power}</span> : null}</div>
                      </div>
                      <strong className={styles.characterGold}>{formatGold(characterTotals[character.id] || 0)} G</strong>
                    </header>

                    <div className={styles.raidSlots}>
                      {Array.from({ length: MAX_RAIDS_PER_CHARACTER }, (_, slotIndex) => {
                        const currentOption = raidGoldOptions.find((option) => option.id === selected[slotIndex]);
                        const selectedRaidNames = selected
                          .filter((_, index) => index !== slotIndex)
                          .map((id) => raidGoldOptions.find((option) => option.id === id)?.raidName)
                          .filter(Boolean);
                        const difficultyOptions = currentOption
                          ? availableOptions.filter((option) => option.raidName === currentOption.raidName).sort((a, b) => b.minLevel - a.minLevel)
                          : [];

                        return (
                          <div key={`${character.id}-${slotIndex}`} className={styles.raidSlot}>
                            <div className={styles.raidSelectPair}>
                              <label className={styles.selectField}>
                                <span>레이드</span>
                                <select
                                  value={currentOption?.raidName || ""}
                                  onChange={(event) => handleRaidNameChange(character.id, slotIndex, event.target.value, character.levelValue)}
                                  disabled={!canUseGoldOptions}
                                >
                                  <option value="">선택 안 함</option>
                                  {availableRaidNames.map((raidName) => (
                                    <option key={raidName} value={raidName} disabled={selectedRaidNames.includes(raidName)}>{raidName}</option>
                                  ))}
                                </select>
                              </label>

                              <label className={styles.selectField}>
                                <span>난이도</span>
                                <select
                                  value={selected[slotIndex] || ""}
                                  onChange={(event) => handleDifficultyChange(character.id, slotIndex, event.target.value)}
                                  disabled={!canUseGoldOptions || !currentOption}
                                >
                                  {!currentOption ? <option value="">레이드 먼저 선택</option> : null}
                                  {difficultyOptions.map((option) => (
                                    <option key={option.id} value={option.id}>{option.difficulty} · {formatGold(option.gold)} G</option>
                                  ))}
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
              <div><span>원정대 합계</span><strong>{formatGold(totalGold)} G</strong></div>
              <button type="button" className={styles.resetButton} onClick={resetSelections}>최대 골드로 초기화</button>
            </footer>
          </>
        ) : null}
      </div>
    </main>
  );
}

function SummaryCard({ label, value, emphasis = false }) {
  return <article className={`${styles.summaryCard} ${emphasis ? styles.summaryCardEmphasis : ""}`}><span>{label}</span><strong>{value}</strong></article>;
}

function StatePanel({ message, error = false }) {
  return <section className={`${styles.statePanel} ${error ? styles.errorState : ""}`}>{cleanText(message)}</section>;
}

function parsePersonalRaidRows(rows) {
  if (!Array.isArray(rows)) return [];
  let currentOwner = "";
  return rows.map((row, index) => {
    const ownerCell = cleanText(row?.[OWNER_COLUMN_INDEX]);
    if (ownerCell) currentOwner = ownerCell;
    const owner = cleanText(currentOwner);
    const characterName = cleanText(row?.[CHARACTER_COLUMN_INDEX]);
    if (!owner || !characterName) return null;
    const level = cleanText(row?.[LEVEL_COLUMN_INDEX]);
    return {
      id: `${owner}-${characterName}-${index}`,
      owner,
      characterName,
      level,
      levelValue: parseNumber(level),
      power: cleanText(row?.[POWER_COLUMN_INDEX]),
      className: cleanText(row?.[CLASS_COLUMN_INDEX]),
    };
  }).filter(Boolean);
}

function parseRaidGoldRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];

  return rows.map((row, index) => {
    const raidName = cleanText(row?.[GOLD_CONTENT_INDEX]);
    if (!RAID_NAMES.has(raidName)) return null;

    const difficulty = cleanText(row?.[GOLD_DIFFICULTY_INDEX]);
    const parity = cleanText(row?.[GOLD_PARITY_TEXT_INDEX]) || `${raidName}/${difficulty}`;
    const minLevel = parseNumber(row?.[GOLD_MIN_LEVEL_INDEX]);
    const gold = parseNumber(row?.[GOLD_TOTAL_INDEX]);

    if (!difficulty || minLevel <= 0 || gold <= 0) return null;

    return {
      id: `${normalize(raidName)}-${normalize(difficulty)}-${index}`,
      raidName,
      difficulty,
      parity,
      minLevel,
      gold,
    };
  }).filter(Boolean);
}

function getAvailableRaidNames(options) {
  const bestGoldByRaid = new Map();
  options.forEach((option) => {
    const current = bestGoldByRaid.get(option.raidName) || 0;
    if (option.gold > current) bestGoldByRaid.set(option.raidName, option.gold);
  });
  return [...bestGoldByRaid.entries()].sort((a, b) => b[1] - a[1]).map(([raidName]) => raidName);
}

function getOptimalRaidSelection(levelValue, options) {
  const bestByRaidName = new Map();
  options
    .filter((option) => levelValue >= option.minLevel)
    .forEach((option) => {
      const current = bestByRaidName.get(option.raidName);
      if (!current || option.gold > current.gold) bestByRaidName.set(option.raidName, option);
    });

  const selected = [...bestByRaidName.values()]
    .sort((a, b) => b.gold - a.gold || b.minLevel - a.minLevel)
    .slice(0, MAX_RAIDS_PER_CHARACTER)
    .map((option) => option.id);

  while (selected.length < MAX_RAIDS_PER_CHARACTER) selected.push("");
  return selected;
}

function getSelectedRaidIds(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function parseNumber(value) {
  const matched = String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  const number = matched ? Number(matched[0]) : 0;
  return Number.isFinite(number) ? number : 0;
}

function formatGold(value) {
  return Math.trunc(Number(value) || 0).toLocaleString("ko-KR");
}

function cleanText(value) {
  return String(value ?? "").replace(/^[\s'\"]+|[\s'\"]+$/g, "").trim();
}

function normalize(value) {
  return cleanText(value).toLowerCase().replace(/\s+/g, "");
}
