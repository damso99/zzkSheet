import { useEffect, useMemo, useState } from "react";
import styles from "./WeeklyGoldPage.module.css";
import { DEFAULT_SHEET_URL, loadSheetRowsByName } from "../RaidSchedulePage/utils/sheetApi.js";

const PERSONAL_RAID_SHEET_NAME = "개인레이드";
const RAID_GOLD_SHEET_NAME = "레이드골드";
const OWNER_COLUMN_INDEX = 1;
const CHARACTER_COLUMN_INDEX = 3;
const LEVEL_COLUMN_INDEX = 4;
const POWER_COLUMN_INDEX = 5;
const CLASS_COLUMN_INDEX = 6;
const MAX_RAIDS_PER_CHARACTER = 3;

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

    async function loadPersonalRows() {
      try {
        setIsPersonalLoading(true);
        setPersonalError("");
        const payload = await loadSheetRowsByName({
          sheetUrl: DEFAULT_SHEET_URL,
          sheetName: PERSONAL_RAID_SHEET_NAME,
          signal: controller.signal,
        });
        setPersonalRows(Array.isArray(payload?.rows) ? payload.rows : []);
      } catch (error) {
        if (error?.name === "AbortError") return;
        setPersonalRows([]);
        setPersonalError(error?.message || "개인레이드 시트를 불러오지 못했습니다.");
      } finally {
        if (!controller.signal.aborted) setIsPersonalLoading(false);
      }
    }

    loadPersonalRows();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadGoldRows() {
      try {
        setIsGoldLoading(true);
        setGoldError("");
        const payload = await loadSheetRowsByName({
          sheetUrl: DEFAULT_SHEET_URL,
          sheetName: RAID_GOLD_SHEET_NAME,
          signal: controller.signal,
        });
        setGoldRows(Array.isArray(payload?.rows) ? payload.rows : []);
      } catch (error) {
        if (error?.name === "AbortError") return;
        setGoldRows([]);
        setGoldError(error?.message || "레이드골드 시트를 불러오지 못했습니다.");
      } finally {
        if (!controller.signal.aborted) setIsGoldLoading(false);
      }
    }

    loadGoldRows();
    return () => controller.abort();
  }, []);

  const characters = useMemo(() => parsePersonalRaidRows(personalRows), [personalRows]);
  const raidGoldOptions = useMemo(() => parseRaidGoldRows(goldRows), [goldRows]);
  const ownerNames = useMemo(
    () => [...new Set(characters.map((item) => item.owner))].sort((a, b) => a.localeCompare(b, "ko")),
    [characters],
  );

  const keyword = normalize(searchKeyword);
  const filteredCharacters = useMemo(() => {
    if (!keyword) return [];
    return characters
      .filter((item) => normalize(item.owner).includes(keyword))
      .sort((a, b) => b.levelValue - a.levelValue);
  }, [characters, keyword]);

  const selectedOwnerNames = useMemo(
    () => [...new Set(filteredCharacters.map((item) => item.owner))],
    [filteredCharacters],
  );

  const characterTotals = useMemo(() => {
    const totals = {};
    filteredCharacters.forEach((character) => {
      totals[character.id] = getSelectedRaidIds(selections[character.id])
        .map((raidId) => raidGoldOptions.find((option) => option.id === raidId)?.gold || 0)
        .reduce((sum, gold) => sum + gold, 0);
    });
    return totals;
  }, [filteredCharacters, raidGoldOptions, selections]);

  const totalGold = useMemo(
    () => Object.values(characterTotals).reduce((sum, value) => sum + value, 0),
    [characterTotals],
  );

  const selectedRaidCount = useMemo(
    () => filteredCharacters.reduce((sum, character) => sum + getSelectedRaidIds(selections[character.id]).length, 0),
    [filteredCharacters, selections],
  );

  function handleRaidChange(characterId, slotIndex, raidId) {
    setSelections((current) => {
      const nextCharacterSelection = [...(current[characterId] || Array(MAX_RAIDS_PER_CHARACTER).fill(""))];
      nextCharacterSelection[slotIndex] = raidId;
      return { ...current, [characterId]: nextCharacterSelection };
    });
  }

  function resetSelections() {
    setSelections({});
  }

  const canUseGoldOptions = !isGoldLoading && !goldError && raidGoldOptions.length > 0;

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} />
      <div className={styles.content}>
        <header className={styles.topHeader}>
          <div>
            <p className={styles.eyebrow}>LostArk Weekly Planner</p>
            <h1>Stick Over Flow</h1>
          </div>
          <div className={styles.headerActions}>
            <a className={styles.secondaryButton} href="/">일정으로 돌아가기</a>
            <a className={styles.sheetButton} href={DEFAULT_SHEET_URL} target="_blank" rel="noreferrer">
              시트 열기 <span aria-hidden="true">↗</span>
            </a>
          </div>
        </header>

        <section className={styles.sectionHeader}>
          <div>
            <h2>원정대 주간 골드</h2>
            <p>이름으로 캐릭터를 조회하고 캐릭터마다 최대 3개의 레이드를 선택해 예상 획득 골드를 계산합니다.</p>
          </div>
        </section>

        <section className={styles.searchPanel}>
          <label className={styles.searchLabel}>
            이름 검색
            <input
              type="search"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="개인레이드 시트의 이름을 입력하세요"
              list="weekly-gold-owner-list"
              disabled={isPersonalLoading}
            />
          </label>
          <datalist id="weekly-gold-owner-list">
            {ownerNames.map((ownerName) => <option key={ownerName} value={ownerName} />)}
          </datalist>
          <span className={styles.searchHint}>개인레이드 시트의 캐릭터명·레벨을 기준으로 표시합니다.</span>
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
        {!isPersonalLoading && !personalError && keyword && filteredCharacters.length === 0 ? (
          <StatePanel message={`'${cleanText(searchKeyword)}' 이름으로 개인레이드 시트에서 캐릭터를 찾지 못했습니다.`} />
        ) : null}

        {!isPersonalLoading && !personalError && filteredCharacters.length > 0 ? (
          <>
            {isGoldLoading ? <StatePanel message="캐릭터 조회 완료 · 레이드골드 시트를 불러오는 중입니다." /> : null}
            {!isGoldLoading && goldError ? <StatePanel message={`캐릭터 조회 완료 · 레이드골드 조회 실패: ${goldError}`} error /> : null}
            {!isGoldLoading && !goldError && raidGoldOptions.length === 0 ? (
              <StatePanel message="캐릭터 조회 완료 · 레이드골드 시트에서 사용 가능한 골드 정보를 찾지 못했습니다." error />
            ) : null}

            <section className={styles.characterGrid}>
              {filteredCharacters.map((character) => {
                const selected = selections[character.id] || Array(MAX_RAIDS_PER_CHARACTER).fill("");
                const availableOptions = raidGoldOptions.filter(
                  (option) => !option.minLevel || character.levelValue >= option.minLevel,
                );

                return (
                  <article key={character.id} className={styles.characterCard}>
                    <header className={styles.characterHeader}>
                      <div>
                        <div className={styles.characterTitleLine}>
                          <h3>{character.characterName}</h3>
                          {character.className ? <span className={styles.classBadge}>{character.className}</span> : null}
                        </div>
                        <div className={styles.characterMeta}>
                          <span>Lv. {character.level || "-"}</span>
                          {character.power ? <span>전투력 {character.power}</span> : null}
                        </div>
                      </div>
                      <strong className={styles.characterGold}>{formatGold(characterTotals[character.id] || 0)} G</strong>
                    </header>

                    <div className={styles.raidSlots}>
                      {Array.from({ length: MAX_RAIDS_PER_CHARACTER }, (_, slotIndex) => {
                        const chosenIds = selected.filter(Boolean);
                        return (
                          <label key={`${character.id}-${slotIndex}`} className={styles.raidSlot}>
                            <span>레이드 {slotIndex + 1}</span>
                            <select
                              value={selected[slotIndex] || ""}
                              onChange={(event) => handleRaidChange(character.id, slotIndex, event.target.value)}
                              disabled={!canUseGoldOptions}
                            >
                              <option value="">{canUseGoldOptions ? "레이드 선택" : "골드 데이터 준비 중"}</option>
                              {availableOptions.map((option) => (
                                <option
                                  key={option.id}
                                  value={option.id}
                                  disabled={chosenIds.includes(option.id) && selected[slotIndex] !== option.id}
                                >
                                  {option.label} · {formatGold(option.gold)} G
                                </option>
                              ))}
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
              <div>
                <span>원정대 합계</span>
                <strong>{formatGold(totalGold)} G</strong>
              </div>
              <button type="button" className={styles.resetButton} onClick={resetSelections}>선택 초기화</button>
            </footer>
          </>
        ) : null}
      </div>
    </main>
  );
}

function SummaryCard({ label, value, emphasis = false }) {
  return (
    <article className={`${styles.summaryCard} ${emphasis ? styles.summaryCardEmphasis : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
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
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const headerIndex = rows.findIndex((row) => {
    const normalized = (row || []).map((cell) => normalize(cell));
    return normalized.some((cell) => cell.includes("레이드")) && normalized.some((cell) => cell.includes("골드"));
  });

  const header = headerIndex >= 0 ? rows[headerIndex].map(normalize) : [];
  const raidIndex = findHeaderIndex(header, ["레이드", "레이드명", "군단장", "콘텐츠", "컨텐츠"]);
  const difficultyIndex = findHeaderIndex(header, ["난이도", "단계", "관문", "구분"]);
  const goldIndex = findHeaderIndex(header, ["클리어골드", "획득골드", "보상골드", "골드", "보상"]);
  const minLevelIndex = findHeaderIndex(header, ["입장레벨", "최소레벨", "레벨"]);
  const dataStartIndex = headerIndex >= 0 ? headerIndex + 1 : 0;

  return rows.slice(dataStartIndex).map((row, index) => {
    const safeRaidIndex = raidIndex >= 0 ? raidIndex : 0;
    const safeDifficultyIndex = difficultyIndex >= 0 ? difficultyIndex : 1;
    const safeGoldIndex = goldIndex >= 0 ? goldIndex : 2;
    const raidName = cleanText(row?.[safeRaidIndex]);
    const difficulty = cleanText(row?.[safeDifficultyIndex]);
    const gold = parseNumber(row?.[safeGoldIndex]);
    const minLevel = minLevelIndex >= 0 ? parseNumber(row?.[minLevelIndex]) : 0;

    if (!raidName || gold <= 0) return null;
    const label = difficulty && normalize(difficulty) !== normalize(raidName) ? `${raidName} · ${difficulty}` : raidName;

    return {
      id: `${normalize(raidName)}-${normalize(difficulty)}-${gold}-${index}`,
      raidName,
      difficulty,
      label,
      gold,
      minLevel,
    };
  }).filter(Boolean);
}

function findHeaderIndex(header, aliases) {
  if (!header.length) return -1;
  const normalizedAliases = aliases.map(normalize);
  return header.findIndex((cell) => normalizedAliases.some((alias) => cell === alias || cell.includes(alias)));
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

function decodeUnicodeEscapes(value) {
  const stringValue = String(value ?? "");
  if (!/\\u[0-9a-fA-F]{4}/.test(stringValue)) return stringValue;
  return stringValue.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function cleanText(value) {
  return decodeUnicodeEscapes(value).replace(/^[\s'\"]+|[\s'\"]+$/g, "").trim();
}

function normalize(value) {
  return cleanText(value).toLowerCase().replace(/\s+/g, "");
}
