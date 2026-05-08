import { useEffect, useMemo, useState } from "react";
import styles from "./PersonalRaidPage.module.css";
import { DEFAULT_SHEET_URL, loadSheetRowsByName } from "../RaidSchedulePage/utils/sheetApi.js";

const PERSONAL_RAID_SHEET_NAME = "개인레이드";
const OWNER_COLUMN_INDEX = 1;
const CHARACTER_COLUMN_INDEX = 3;
const LEVEL_COLUMN_INDEX = 4;
const POWER_COLUMN_INDEX = 5;
const CLASS_COLUMN_INDEX = 6;
const JOINED_COLUMN_INDEX = 8;
const RAID_START_COLUMN_INDEX = 9;

export default function PersonalRaidPage({ embedded = false }) {
  const [rows, setRows] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadRows() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const payload = await loadSheetRowsByName({
          sheetUrl: DEFAULT_SHEET_URL,
          sheetName: PERSONAL_RAID_SHEET_NAME,
          signal: controller.signal,
        });

        setRows(Array.isArray(payload?.rows) ? payload.rows : []);
      } catch (error) {
        if (error?.name === "AbortError") return;
        setErrorMessage(error?.message || "레이드 데이터를 불러오지 못했습니다.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadRows();

    return () => controller.abort();
  }, []);

  const parsedCharacters = useMemo(() => parsePersonalRaidRows(rows), [rows]);
  const hasKeyword = searchKeyword.trim().length > 0;

  const filteredCharacters = useMemo(() => {
    const keyword = normalize(cleanText(searchKeyword));
    const matchedCharacters = keyword
      ? parsedCharacters.filter((item) => normalize(cleanText(item.owner)).includes(keyword))
      : [];

    return [...matchedCharacters].sort((left, right) => right.levelValue - left.levelValue);
  }, [parsedCharacters, searchKeyword]);

  const content = (
    <>
      <header className={styles.hero}>
        <section className={styles.sectionHeader}>
          <h2>레이드 참여 현황</h2>
          <p>이름 검색으로 참여 캐릭터와 참여 레이드를 확인합니다.</p>
        </section>
      </header>

      <section className={styles.panel}>
        {/*<div className={styles.panelHeader}>*/}
        {/*  <div>*/}
        {/*    <h2 className={styles.panelTitle}>이름 검색</h2>*/}
        {/*    <p className={styles.panelSubtitle}>이름을 검색하면 보유중인 캐릭터의 레이드 참여 현황을 보여줍니다.</p>*/}
        {/*  </div>*/}
        {/*</div>*/}

        <label className={styles.searchField}>
          <span>이름 검색</span>
          <input
            type="search"
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder="예: 지훈, 지덩, jistick"
          />
        </label>
      </section>

      {isLoading ? (
        <section className={styles.emptyState}>
          <p>레이드 데이터를 불러오는 중입니다.</p>
        </section>
      ) : null}

      {!isLoading && errorMessage ? (
        <section className={styles.errorState}>
          <p>{cleanText(errorMessage)}</p>
        </section>
      ) : null}

      {!isLoading && !errorMessage && parsedCharacters.length === 0 ? (
        <section className={styles.emptyState}>
          <p>참여 중인 캐릭터가 없습니다.</p>
        </section>
      ) : null}

      {!isLoading && !errorMessage && !hasKeyword ? (
        <section className={styles.emptyState}>
          <p>이름을 검색하면 참여 캐릭터가 표시됩니다.</p>
        </section>
      ) : null}

      {!isLoading && !errorMessage && hasKeyword && parsedCharacters.length > 0 && filteredCharacters.length === 0 ? (
        <section className={styles.emptyState}>
          <p>검색 결과가 없습니다.</p>
        </section>
      ) : null}

      {!isLoading && !errorMessage && hasKeyword && filteredCharacters.length > 0 ? (
        <section className={styles.cardList}>
          {filteredCharacters.map((item) => (
            <article key={item.id} className={styles.characterCard}>
              <div className={styles.cardGlow} />
              <div className={styles.cardInner}>
                <header className={styles.cardHeader}>
                  <span className={styles.ownerName}>{cleanText(item.owner)}</span>
                  <span className={styles.classBadge}>{cleanText(item.className || "클래스 없음")}</span>
                </header>

                <h3 className={styles.characterName}>{cleanText(item.characterName)}</h3>

                <div className={styles.bottomRow}>
                  <div className={styles.statGrid}>
                    <div className={styles.statItem}>
                      <span>레벨</span>
                      <strong>{item.level || "-"}</strong>
                    </div>
                    <div className={styles.statItem}>
                      <span>전투력</span>
                      <strong>{item.power || "-"}</strong>
                    </div>
                  </div>

                  <section className={styles.raidSection}>
                    {item.raids.length ? (
                      <div className={styles.raidPills}>
                        {item.raids.map((raid, index) => (
                          <span key={`${item.id}-${raid}-${index}`} className={styles.raidPill}>
                            {cleanText(raid)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.emptyRaidText}>참여 레이드 없음</p>
                    )}
                  </section>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </>
  );

  if (embedded) {
    return <section className={styles.embeddedContent}>{content}</section>;
  }

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} />
      <div className={styles.content}>{content}</div>
    </main>
  );
}

function parsePersonalRaidRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  let currentOwner = "";

  return rows
    .map((row, index) => {
      const ownerCell = cleanText(row?.[OWNER_COLUMN_INDEX]);
      if (ownerCell) currentOwner = ownerCell;

      const owner = cleanText(currentOwner);
      const characterName = cleanText(row?.[CHARACTER_COLUMN_INDEX]);

      if (!owner || !characterName) {
        return null;
      }

      const joined = parseJoinedValue(row?.[JOINED_COLUMN_INDEX]);
      if (!joined) {
        return null;
      }

      const raids = (row || []).slice(RAID_START_COLUMN_INDEX).map(cleanText).filter(isRaidEntry);

      const level = cleanText(row?.[LEVEL_COLUMN_INDEX]);
      const power = cleanText(row?.[POWER_COLUMN_INDEX]);
      const className = cleanText(row?.[CLASS_COLUMN_INDEX]);

      return {
        id: `${owner}-${characterName}-${index}`,
        owner,
        characterName,
        level,
        power,
        className,
        joined,
        raids,
        levelValue: parseLevelValue(level),
      };
    })
    .filter(Boolean);
}

function parseJoinedValue(value) {
  if (value === true) return true;
  if (value === false) return false;

  const text = cleanText(value).toLowerCase();
  return ["1", "true", "checked", "참여", "✓", "✔", "☑"].includes(text);
}

function parseLevelValue(value) {
  const numeric = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(numeric) ? numeric : 0;
}

function isRaidEntry(value) {
  if (!value) return false;
  if (value === "0") return false;
  if (/^\d+(\.\d+)?$/.test(value)) return false;
  return /[A-Za-z가-힣]/.test(value);
}

function decodeUnicodeEscapes(value) {
  if (value == null) return "";
  const stringValue = String(value);

  if (!/\\u[0-9a-fA-F]{4}/.test(stringValue)) {
    return stringValue;
  }

  try {
    return stringValue.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
  } catch {
    return stringValue;
  }
}

function cleanText(value) {
  return decodeUnicodeEscapes(value).replace(/^['"]|['"]$/g, "").trim();
}

function normalize(value) {
  return cleanText(value).toLowerCase();
}
