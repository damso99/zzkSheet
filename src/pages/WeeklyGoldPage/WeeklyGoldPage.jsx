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

export default function WeeklyGoldPage() {
  const [personalRows, setPersonalRows] = useState([]);
  const [goldRows, setGoldRows] = useState([]);
  const [goldCols, setGoldCols] = useState([]);
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
      .then((payload) => {
        setGoldRows(Array.isArray(payload?.rows) ? payload.rows : []);
        setGoldCols(Array.isArray(payload?.cols) ? payload.cols : []);
      })
      .catch((error) => {
        if (error?.name !== "AbortError") setGoldError(error?.message || "레이드골드(귀속) 시트를 불러오지 못했습니다.");
      })
      .finally(() => { if (!controller.signal.aborted) setIsGoldLoading(false); });
    return () => controller.abort();
  }, []);

  const characters = useMemo(() => parsePersonalRaidRows(personalRows), [personalRows]);
  const raidGoldOptions = useMemo(() => parseRaidGoldRows(goldRows, goldCols), [goldRows, goldCols]);
  const ownerNames = useMemo(() => [...new Set(characters.map((item) => item.owner))].sort((a, b) => a.localeCompare(b, "ko")), [characters]);
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

  function handleRaidChange(characterId, slotIndex, raidId) {
    setSelections((current) => {
      const next = [...(current[characterId] || Array(MAX_RAIDS_PER_CHARACTER).fill(""))];
      const nextOption = raidGoldOptions.find((option) => option.id === raidId);
      if (nextOption) {
        for (let index = 0; index < next.length; index += 1) {
          if (index === slotIndex) continue;
          const selectedOption = raidGoldOptions.find((option) => option.id === next[index]);
          if (selectedOption?.raidName === nextOption.raidName) next[index] = "";
        }
      }
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
            <input type="search" value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} placeholder="개인레이드 시트의 이름을 입력하세요" list="weekly-gold-owner-list" disabled={isPersonalLoading} />
          </label>
          <datalist id="weekly-gold-owner-list">{ownerNames.map((ownerName) => <option key={ownerName} value={ownerName} />)}</datalist>
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
              <StatePanel message={`레이드골드(귀속) ${goldRows.length}행을 읽었지만 골드 항목을 해석하지 못했습니다. 헤더: ${getColumnLabels(goldCols).join(" / ") || "없음"}`} error />
            ) : null}

            <section className={styles.characterGrid}>
              {filteredCharacters.map((character) => {
                const selected = selections[character.id] || Array(MAX_RAIDS_PER_CHARACTER).fill("");
                const availableOptions = raidGoldOptions.filter((option) => character.levelValue >= option.minLevel);
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
                        const otherSelectedRaidNames = selected
                          .filter((_, index) => index !== slotIndex)
                          .map((id) => raidGoldOptions.find((option) => option.id === id)?.raidName)
                          .filter(Boolean);

                        return (
                          <label key={`${character.id}-${slotIndex}`} className={styles.raidSlot}>
                            <span>레이드 {slotIndex + 1}</span>
                            <select value={selected[slotIndex] || ""} onChange={(event) => handleRaidChange(character.id, slotIndex, event.target.value)} disabled={!canUseGoldOptions}>
                              <option value="">선택 안 함</option>
                              {availableOptions.map((option) => {
                                const duplicateRaid = otherSelectedRaidNames.includes(option.raidName) && currentOption?.raidName !== option.raidName;
                                return <option key={option.id} value={option.id} disabled={duplicateRaid}>{option.parity} · {formatGold(option.gold)} G</option>;
                              })}
                            </select>
                          </label>
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

function parseRaidGoldRows(rows, cols) {
  if (!Array.isArray(rows) || !rows.length) return [];

  const columnLabels = getColumnLabels(cols);
  let dataRows = rows;
  let header = columnLabels.map(normalize);

  if (!hasRequiredGoldHeaders(header)) {
    const headerIndex = rows.findIndex((row) => hasRequiredGoldHeaders((row || []).map(normalize)));
    if (headerIndex < 0) return [];
    header = rows[headerIndex].map(normalize);
    dataRows = rows.slice(headerIndex + 1);
  }

  const contentIndex = header.indexOf("컨텐츠");
  const difficultyIndex = header.indexOf("난이도");
  const parityIndex = header.findIndex((value) => value.includes("parity"));
  const minLevelIndex = header.indexOf("입장레벨");
  const totalGoldIndex = header.indexOf("합계");

  return dataRows.map((row, index) => {
    const raidName = cleanText(row?.[contentIndex]);
    const difficulty = cleanText(row?.[difficultyIndex]);
    const parity = parityIndex >= 0 ? cleanText(row?.[parityIndex]) : `${raidName}/${difficulty}`;
    const minLevel = parseNumber(row?.[minLevelIndex]);
    const gold = parseNumber(row?.[totalGoldIndex]);
    if (!raidName || !difficulty || !minLevel || !gold) return null;
    if (normalize(raidName) === "합계") return null;
    return {
      id: `${normalize(raidName)}-${normalize(difficulty)}-${index}`,
      raidName,
      difficulty,
      parity: parity || `${raidName}/${difficulty}`,
      minLevel,
      gold,
    };
  }).filter(Boolean);
}

function getColumnLabels(cols) {
  if (!Array.isArray(cols)) return [];
  return cols.map((col) => cleanText(col?.label || col?.id || ""));
}

function hasRequiredGoldHeaders(header) {
  return header.includes("컨텐츠") && header.includes("난이도") && header.includes("입장레벨") && header.includes("합계");
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
