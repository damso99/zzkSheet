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
  const [query, setQuery] = useState("");
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
        if (error?.name === "AbortError") {
          return;
        }

        setErrorMessage(error?.message || "개인레이드 데이터를 불러오지 못했습니다.");
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
  const filteredCharacters = useMemo(() => {
    const normalizedKeyword = normalize(cleanText(query));
    const matchedCharacters = normalizedKeyword
      ? parsedCharacters.filter((item) => normalize(cleanText(item.owner)).includes(normalizedKeyword))
      : parsedCharacters;

    return [...matchedCharacters].sort((left, right) => right.levelValue - left.levelValue);
  }, [parsedCharacters, query]);

  const totalOwners = useMemo(
    () => new Set(parsedCharacters.map((item) => cleanText(item.owner)).filter(Boolean)).size,
    [parsedCharacters],
  );

  useEffect(() => {
    if (!rows.length) return;

    console.group("[PersonalRaid] Raw sheet data");
    console.table(rows);
    console.groupEnd();
  }, [rows]);

  useEffect(() => {
    if (!parsedCharacters.length) return;

    console.group("[PersonalRaid] Parsed characters");
    console.table(
      parsedCharacters.map((item) => ({
        owner: cleanText(item.owner),
        characterName: cleanText(item.characterName),
        level: item.level,
        power: item.power,
        className: cleanText(item.className),
        joined: item.joined,
        raids: item.raids.map(cleanText).join(", "),
      })),
    );
    console.groupEnd();
  }, [parsedCharacters]);

  useEffect(() => {
    console.group("[PersonalRaid] Search debug");
    console.table(
      filteredCharacters.map((item) => ({
        keyword: cleanText(query),
        owner: cleanText(item.owner),
        matched: normalize(cleanText(item.owner)).includes(normalize(cleanText(query))),
        characterName: cleanText(item.characterName),
      })),
    );
    console.groupEnd();
  }, [filteredCharacters, query]);

  const content = (
    <>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Personal Raid Search</span>
          <h1 className={styles.title}>{cleanText(PERSONAL_RAID_SHEET_NAME)}</h1>
          <p className={styles.description}>
            {cleanText("주인 이름 검색으로 참여 체크된 캐릭터와 참여 레이드 목록을 한 번에 확인합니다.")}
          </p>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>{cleanText("이름 검색")}</h2>
            <p className={styles.panelSubtitle}>
              {cleanText("주인 이름을 부분 검색하면 참여 체크된 캐릭터만 카드로 보여줍니다.")}
            </p>
          </div>
          <div className={styles.summaryPills}>
            <div className={styles.summaryPill}>
              <span>{cleanText("참여 캐릭터")}</span>
              <strong>{parsedCharacters.length}명</strong>
            </div>
            <div className={styles.summaryPill}>
              <span>{cleanText("주인 그룹")}</span>
              <strong>{totalOwners}명</strong>
            </div>
            <div className={styles.summaryPill}>
              <span>{cleanText("검색 결과")}</span>
              <strong>{filteredCharacters.length}개</strong>
            </div>
          </div>
        </div>

        <label className={styles.searchField}>
          <span>{cleanText("주인 이름 검색")}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={cleanText("예: 리아, 성태, 민지")}
          />
        </label>
      </section>

      {isLoading ? (
        <section className={styles.emptyState}>
          <p>{cleanText("개인레이드 데이터를 불러오는 중입니다.")}</p>
        </section>
      ) : null}

      {!isLoading && errorMessage ? (
        <section className={styles.errorState}>
          <p>{cleanText(errorMessage)}</p>
        </section>
      ) : null}

      {!isLoading && !errorMessage && parsedCharacters.length === 0 ? (
        <section className={styles.emptyState}>
          <p>{cleanText("참여 중인 캐릭터가 없습니다.")}</p>
        </section>
      ) : null}

      {!isLoading && !errorMessage && parsedCharacters.length > 0 && filteredCharacters.length === 0 ? (
        <section className={styles.emptyState}>
          <p>{cleanText("검색 결과가 없습니다")}</p>
        </section>
      ) : null}

      {!isLoading && !errorMessage && filteredCharacters.length > 0 ? (
        <section className={styles.cardGrid}>
          {filteredCharacters.map((item) => (
            <article key={item.id} className={styles.characterCard}>
              <div className={styles.cardGlow} />
              <header className={styles.cardHeader}>
                <div className={styles.cardTitleGroup}>
                  <span className={styles.ownerName}>{cleanText(item.owner)}</span>
                  <h3 className={styles.characterName}>{cleanText(item.characterName)}</h3>
                </div>
                <span className={styles.classBadge}>{cleanText(item.className || "클래스 없음")}</span>
              </header>

              <div className={styles.statGrid}>
                <div className={styles.statItem}>
                  <span>{cleanText("레벨")}</span>
                  <strong>{item.level || "-"}</strong>
                </div>
                <div className={styles.statItem}>
                  <span>{cleanText("전투력")}</span>
                  <strong>{item.power || "-"}</strong>
                </div>
              </div>

              <section className={styles.raidSection}>
                <div className={styles.raidSectionHeader}>
                  <span>{cleanText("참여 레이드")}</span>
                  <strong>{item.raids.length}개</strong>
                </div>

                {item.raids.length ? (
                  <div className={styles.raidPills}>
                    {item.raids.map((raid, index) => (
                      <span key={`${item.id}-${raid}-${index}`} className={styles.raidPill}>
                        {cleanText(raid)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptyRaidText}>{cleanText("참여 레이드 없음")}</p>
                )}
              </section>
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
      if (ownerCell) {
        currentOwner = ownerCell;
      }

      const owner = cleanText(currentOwner);
      const characterName = cleanText(row?.[CHARACTER_COLUMN_INDEX]);

      if (!owner || !characterName) {
        return null;
      }

      const joined = parseJoinedValue(row?.[JOINED_COLUMN_INDEX]);
      if (!joined) {
        return null;
      }

      const raids = (row || [])
        .slice(RAID_START_COLUMN_INDEX)
        .map(cleanText)
        .filter(isRaidEntry);

      const level = cleanText(row?.[LEVEL_COLUMN_INDEX]);
      const power = cleanText(row?.[POWER_COLUMN_INDEX]);
      const className = cleanText(row?.[CLASS_COLUMN_INDEX]);

      return {
        id: `${owner}-${characterName}-${index}`,
        owner,
        characterName,
        level,
        levelValue: parseNumericValue(level),
        power,
        className,
        joined,
        raids,
      };
    })
    .filter(Boolean);
}

function decodeUnicodeEscapes(value) {
  if (value == null) return "";

  const stringValue = String(value);
  if (!/\\u[0-9a-fA-F]{4}/.test(stringValue)) {
    return stringValue;
  }

  try {
    return stringValue.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
  } catch {
    return stringValue;
  }
}

function cleanText(value) {
  return decodeUnicodeEscapes(value).replace(/^['"]|['"]$/g, "").replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return cleanText(value).toLowerCase();
}

function parseJoinedValue(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  const normalized = normalize(value);
  return ["true", "1", "checked", "check", "y", "yes", "v", "✓", "✔", "☑", "참여"].some((token) =>
    normalized.includes(token.toLowerCase()),
  );
}

function isRaidEntry(value) {
  if (!value || value === "0") {
    return false;
  }

  if (/^\d+(\.\d+)?$/.test(value)) {
    return false;
  }

  return /[가-힣a-z]/i.test(value);
}

function parseNumericValue(value) {
  const numeric = Number.parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}
