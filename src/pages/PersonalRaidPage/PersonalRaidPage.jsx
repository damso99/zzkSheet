import { useEffect, useMemo, useState } from "react";
import styles from "./PersonalRaidPage.module.css";
import { DEFAULT_SHEET_URL, loadSheetRowsByName } from "../RaidSchedulePage/utils/sheetApi.js";

const PERSONAL_RAID_SHEET_NAME = "\uAC1C\uC778\uB808\uC774\uB4DC";
const OWNER_COLUMN_INDEX = 1;
const CHARACTER_COLUMN_INDEX = 3;
const LEVEL_COLUMN_INDEX = 4;
const POWER_COLUMN_INDEX = 5;
const CLASS_COLUMN_INDEX = 6;
const JOINED_COLUMN_INDEX = 8;
const RAID_START_COLUMN_INDEX = 9;

export default function PersonalRaidPage() {
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

        setErrorMessage(error?.message || "\uAC1C\uC778\uB808\uC774\uB4DC \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
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
  const normalizedQuery = normalizeSearchValue(query);

  const filteredCharacters = useMemo(() => {
    const matchedCharacters = normalizedQuery
      ? parsedCharacters.filter((item) => normalizeSearchValue(item.owner).includes(normalizedQuery))
      : parsedCharacters;

    return [...matchedCharacters].sort((left, right) => right.levelValue - left.levelValue);
  }, [normalizedQuery, parsedCharacters]);

  const totalOwners = useMemo(
    () => new Set(parsedCharacters.map((item) => item.owner).filter(Boolean)).size,
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
        owner: item.owner,
        characterName: item.characterName,
        level: item.level,
        power: item.power,
        className: item.className,
        joined: item.joined,
        raids: item.raids.join(", "),
      })),
    );
    console.groupEnd();
  }, [parsedCharacters]);

  useEffect(() => {
    console.group("[PersonalRaid] Search debug");
    console.table(
      filteredCharacters.map((item) => ({
        keyword: query,
        owner: item.owner,
        matched: normalizeSearchValue(item.owner).includes(normalizeSearchValue(query)),
        characterName: item.characterName,
      })),
    );
    console.groupEnd();
  }, [filteredCharacters, query]);

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} />
      <div className={styles.content}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Personal Raid Search</span>
            <h1 className={styles.title}>\uAC1C\uC778\uB808\uC774\uB4DC</h1>
            <p className={styles.description}>
              \uC8FC\uC778 \uC774\uB984 \uAC80\uC0C9\uC73C\uB85C \uCC38\uC5EC \uCCB4\uD06C\uB41C \uCE90\uB9AD\uD130\uC640 \uCC38\uC5EC \uB808\uC774\uB4DC \uBAA9\uB85D\uC744 \uD55C \uBC88\uC5D0 \uD655\uC778\uD569\uB2C8\uB2E4.
            </p>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>\uC774\uB984 \uAC80\uC0C9</h2>
              <p className={styles.panelSubtitle}>
                \uC8FC\uC778 \uC774\uB984\uC744 \uBD80\uBD84 \uAC80\uC0C9\uD558\uBA74 \uCC38\uC5EC \uCCB4\uD06C\uB41C \uCE90\uB9AD\uD130\uB9CC \uCE74\uB4DC\uB85C \uBCF4\uC5EC\uC90D\uB2C8\uB2E4.
              </p>
            </div>
            <div className={styles.summaryPills}>
              <div className={styles.summaryPill}>
                <span>\uCC38\uC5EC \uCE90\uB9AD\uD130</span>
                <strong>{parsedCharacters.length}\uBA85</strong>
              </div>
              <div className={styles.summaryPill}>
                <span>\uC8FC\uC778 \uADF8\uB8F9</span>
                <strong>{totalOwners}\uBA85</strong>
              </div>
              <div className={styles.summaryPill}>
                <span>\uAC80\uC0C9 \uACB0\uACFC</span>
                <strong>{filteredCharacters.length}\uAC1C</strong>
              </div>
            </div>
          </div>

          <label className={styles.searchField}>
            <span>\uC8FC\uC778 \uC774\uB984 \uAC80\uC0C9</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="\uC608: \uB9AC\uC544, \uC131\uD0DC, \uBBFC\uC9C0"
            />
          </label>
        </section>

        {isLoading ? (
          <section className={styles.emptyState}>
            <p>\uAC1C\uC778\uB808\uC774\uB4DC \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4.</p>
          </section>
        ) : null}

        {!isLoading && errorMessage ? (
          <section className={styles.errorState}>
            <p>{errorMessage}</p>
          </section>
        ) : null}

        {!isLoading && !errorMessage && parsedCharacters.length === 0 ? (
          <section className={styles.emptyState}>
            <p>\uCC38\uC5EC \uC911\uC778 \uCE90\uB9AD\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p>
          </section>
        ) : null}

        {!isLoading && !errorMessage && parsedCharacters.length > 0 && filteredCharacters.length === 0 ? (
          <section className={styles.emptyState}>
            <p>\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p>
          </section>
        ) : null}

        {!isLoading && !errorMessage && filteredCharacters.length > 0 ? (
          <section className={styles.cardGrid}>
            {filteredCharacters.map((item) => (
              <article key={item.id} className={styles.characterCard}>
                <div className={styles.cardGlow} />
                <header className={styles.cardHeader}>
                  <div className={styles.cardTitleGroup}>
                    <span className={styles.ownerName}>{item.owner}</span>
                    <h3 className={styles.characterName}>{item.characterName}</h3>
                  </div>
                  <span className={styles.classBadge}>{item.className || "\uD074\uB798\uC2A4 \uC5C6\uC74C"}</span>
                </header>

                <div className={styles.statGrid}>
                  <div className={styles.statItem}>
                    <span>\uB808\uBCA8</span>
                    <strong>{item.level || "-"}</strong>
                  </div>
                  <div className={styles.statItem}>
                    <span>\uC804\uD22C\uB825</span>
                    <strong>{item.power || "-"}</strong>
                  </div>
                </div>

                <section className={styles.raidSection}>
                  <div className={styles.raidSectionHeader}>
                    <span>\uCC38\uC5EC \uB808\uC774\uB4DC</span>
                    <strong>{item.raids.length}\uAC1C</strong>
                  </div>

                  {item.raids.length ? (
                    <div className={styles.raidPills}>
                      {item.raids.map((raid, index) => (
                        <span key={`${item.id}-${raid}-${index}`} className={styles.raidPill}>
                          {raid}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.emptyRaidText}>\uCC38\uC5EC \uB808\uC774\uB4DC \uC5C6\uC74C</p>
                  )}
                </section>
              </article>
            ))}
          </section>
        ) : null}
      </div>
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
      const ownerCell = cleanCell(row?.[OWNER_COLUMN_INDEX]);
      if (ownerCell) {
        currentOwner = ownerCell;
      }

      const owner = currentOwner;
      const characterName = cleanCell(row?.[CHARACTER_COLUMN_INDEX]);
      if (!owner || !characterName) {
        return null;
      }

      const joined = parseJoinedValue(row?.[JOINED_COLUMN_INDEX]);
      if (!joined) {
        return null;
      }

      const raids = (row || [])
        .slice(RAID_START_COLUMN_INDEX)
        .map(cleanCell)
        .filter(isRaidEntry);

      const level = cleanCell(row?.[LEVEL_COLUMN_INDEX]);
      const power = cleanCell(row?.[POWER_COLUMN_INDEX]);
      const className = cleanCell(row?.[CLASS_COLUMN_INDEX]);

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

function normalizeSearchValue(value) {
  return String(value ?? "")
    .replace(/^['"]|['"]$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cleanCell(value) {
  return String(value ?? "")
    .replace(/^['"]|['"]$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseJoinedValue(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  const normalized = normalizeSearchValue(value);
  return ["true", "1", "checked", "check", "v", "y", "yes", "✓", "✔", "☑", "참여"].some((token) =>
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
