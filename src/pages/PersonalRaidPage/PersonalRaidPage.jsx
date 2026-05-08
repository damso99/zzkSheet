import { useEffect, useMemo, useState } from "react";
import styles from "./PersonalRaidPage.module.css";
import { DEFAULT_SHEET_URL, loadSheetRowsByName } from "../RaidSchedulePage/utils/sheetApi.js";

const PERSONAL_RAID_SHEET_NAME = "\uAC1C\uC778\uB808\uC774\uB4DC";

const PAGE_TABS = [
  { href: "/personal", label: "\uAC1C\uC778\uC77C\uC815" },
  { href: "/", label: "\uC8FC\uAC04\uC77C\uC815" },
  { href: "/personal-raid", label: "\uAC1C\uC778\uB808\uC774\uB4DC" },
];

const HEADER_KEYWORDS = {
  owner: ["\uC8FC\uC778", "\uC774\uB984"],
  character: ["\uCE90\uB9AD\uD130"],
  level: ["\uB808\uBCA8"],
  power: ["\uD22C\uB825", "\uC804\uD22C\uB825"],
  className: ["\uD074\uB798\uC2A4"],
  participation: ["\uCC38\uC5EC"],
};

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

  const cards = useMemo(() => parsePersonalRaidRows(rows), [rows]);
  const normalizedQuery = query.trim().toLowerCase();

  const filteredCards = useMemo(() => {
    const baseCards = normalizedQuery
      ? cards.filter((card) => card.ownerName.toLowerCase().includes(normalizedQuery))
      : cards;

    return [...baseCards].sort((left, right) => right.levelValue - left.levelValue);
  }, [cards, normalizedQuery]);

  const totalOwners = useMemo(() => {
    return new Set(cards.map((card) => card.ownerName).filter(Boolean)).size;
  }, [cards]);

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} />
      <div className={styles.content}>
        <section className={styles.hero}>
          <div className={styles.pageTabs} role="tablist" aria-label="\uD398\uC774\uC9C0 \uC774\uB3D9">
            {PAGE_TABS.map((tab) => (
              <a
                key={tab.href}
                href={tab.href}
                className={tab.href === "/personal-raid" ? styles.activePageTab : styles.pageTab}
                role="tab"
                aria-selected={tab.href === "/personal-raid"}
              >
                {tab.label}
              </a>
            ))}
          </div>

          <a href="/" className={styles.backLink}>
            \uB808\uC774\uB4DC \uC77C\uC815\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30
          </a>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Personal Raid Search</span>
            <h1 className={styles.title}>\uAC1C\uC778\uB808\uC774\uB4DC</h1>
            <p className={styles.description}>
              \uC8FC\uC778 \uC774\uB984\uC73C\uB85C \uCC38\uC5EC \uC911\uC778 \uCE90\uB9AD\uD130\uB97C \uBE60\uB974\uAC8C \uCC3E\uACE0, \uBCF4\uC720 \uCE90\uB9AD\uD130\uBCC4
              \uCC38\uC5EC \uB808\uC774\uB4DC\uB97C \uD55C \uBC88\uC5D0 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.
            </p>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>\uC774\uB984 \uAC80\uC0C9</h2>
              <p className={styles.panelSubtitle}>
                \uC8FC\uC778 \uC774\uB984\uC744 \uC785\uB825\uD558\uBA74 \uCC38\uC5EC \uCCB4\uD06C\uB41C \uCE90\uB9AD\uD130\uB9CC \uCE74\uB4DC\uB85C \uD45C\uC2DC\uB429\uB2C8\uB2E4.
              </p>
            </div>
            <div className={styles.summaryPills}>
              <div className={styles.summaryPill}>
                <span>\uCC38\uC5EC \uCE90\uB9AD\uD130</span>
                <strong>{cards.length}\uBA85</strong>
              </div>
              <div className={styles.summaryPill}>
                <span>\uC8FC\uC778 \uADF8\uB8F9</span>
                <strong>{totalOwners}\uBA85</strong>
              </div>
              <div className={styles.summaryPill}>
                <span>\uAC80\uC0C9 \uACB0\uACFC</span>
                <strong>{filteredCards.length}\uAC1C</strong>
              </div>
            </div>
          </div>

          <label className={styles.searchField}>
            <span>\uC8FC\uC778 \uC774\uB984 \uAC80\uC0C9</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="\uC608: \uC131\uD0DC, \uBBFC\uC9C0, \uC900\uD638"
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

        {!isLoading && !errorMessage && cards.length === 0 ? (
          <section className={styles.emptyState}>
            <p>\uCC38\uC5EC \uC911\uC778 \uCE90\uB9AD\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p>
          </section>
        ) : null}

        {!isLoading && !errorMessage && cards.length > 0 && filteredCards.length === 0 ? (
          <section className={styles.emptyState}>
            <p>\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p>
          </section>
        ) : null}

        {!isLoading && !errorMessage && filteredCards.length > 0 ? (
          <section className={styles.cardGrid}>
            {filteredCards.map((card) => (
              <article key={card.id} className={styles.characterCard}>
                <div className={styles.cardGlow} />
                <header className={styles.cardHeader}>
                  <div className={styles.cardTitleGroup}>
                    <span className={styles.ownerName}>{card.ownerName}</span>
                    <h3 className={styles.characterName}>{card.characterName}</h3>
                  </div>
                  <span className={styles.classBadge}>{card.className || "\uD074\uB798\uC2A4 \uC5C6\uC74C"}</span>
                </header>

                <div className={styles.statGrid}>
                  <div className={styles.statItem}>
                    <span>\uB808\uBCA8</span>
                    <strong>{card.level || "-"}</strong>
                  </div>
                  <div className={styles.statItem}>
                    <span>\uC804\uD22C\uB825</span>
                    <strong>{card.power || "-"}</strong>
                  </div>
                </div>

                <section className={styles.raidSection}>
                  <div className={styles.raidSectionHeader}>
                    <span>\uCC38\uC5EC \uB808\uC774\uB4DC</span>
                    <strong>{card.raids.length}\uAC1C</strong>
                  </div>

                  {card.raids.length > 0 ? (
                    <div className={styles.raidPills}>
                      {card.raids.map((raid, index) => (
                        <span key={`${card.id}-${raid}-${index}`} className={styles.raidPill}>
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

  const headerRowIndex = findHeaderRowIndex(rows);
  if (headerRowIndex < 0) {
    return [];
  }

  const headerRow = rows[headerRowIndex] || [];
  const columns = resolveColumns(headerRow);
  if (columns.character < 0 || columns.participation < 0) {
    return [];
  }

  const ownerColumnIndex = columns.owner >= 0 ? columns.owner : Math.max(columns.character - 1, 0);
  const raidStartIndex = columns.participation + 1;
  let currentOwnerName = "";

  return rows
    .slice(headerRowIndex + 1)
    .map((row, index) => {
      const ownerCell = normalizeCell(row?.[ownerColumnIndex]);
      if (ownerCell) {
        currentOwnerName = ownerCell;
      }

      const characterName = normalizeCell(row?.[columns.character]);
      if (!characterName) {
        return null;
      }

      if (!parseParticipation(row?.[columns.participation])) {
        return null;
      }

      const raids = (row || []).slice(raidStartIndex).map(normalizeCell).filter(Boolean);
      const level = normalizeCell(row?.[columns.level]);
      const power = normalizeCell(row?.[columns.power]);
      const className = normalizeCell(row?.[columns.className]);

      return {
        id: `${currentOwnerName || "owner"}-${characterName}-${index}`,
        ownerName: currentOwnerName || "\uC774\uB984 \uBBF8\uC9C0\uC815",
        characterName,
        level,
        levelValue: parseNumericValue(level),
        power,
        className,
        raids,
      };
    })
    .filter(Boolean);
}

function findHeaderRowIndex(rows) {
  return rows.findIndex((row) => {
    const normalizedRow = (row || []).map((value) => normalizeCell(value));
    return (
      normalizedRow.some((value) => includesAny(value, HEADER_KEYWORDS.character)) &&
      normalizedRow.some((value) => includesAny(value, HEADER_KEYWORDS.level)) &&
      normalizedRow.some((value) => includesAny(value, HEADER_KEYWORDS.participation))
    );
  });
}

function resolveColumns(headerRow) {
  const result = {
    owner: -1,
    character: -1,
    level: -1,
    power: -1,
    className: -1,
    participation: -1,
  };

  headerRow.forEach((value, index) => {
    const normalizedValue = normalizeCell(value);
    if (!normalizedValue) {
      return;
    }

    if (result.owner < 0 && includesAny(normalizedValue, HEADER_KEYWORDS.owner)) {
      result.owner = index;
      return;
    }

    if (result.character < 0 && includesAny(normalizedValue, HEADER_KEYWORDS.character)) {
      result.character = index;
      return;
    }

    if (result.level < 0 && includesAny(normalizedValue, HEADER_KEYWORDS.level)) {
      result.level = index;
      return;
    }

    if (result.power < 0 && includesAny(normalizedValue, HEADER_KEYWORDS.power)) {
      result.power = index;
      return;
    }

    if (result.className < 0 && includesAny(normalizedValue, HEADER_KEYWORDS.className)) {
      result.className = index;
      return;
    }

    if (result.participation < 0 && includesAny(normalizedValue, HEADER_KEYWORDS.participation)) {
      result.participation = index;
    }
  });

  if (result.owner < 0 && result.character > 0) {
    result.owner = result.character - 1;
  }

  return result;
}

function parseParticipation(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  const normalized = normalizeCell(value).toLowerCase();
  if (!normalized) {
    return false;
  }

  return ["true", "\uCC38\uC5EC", "y", "yes", "1", "v", "\u2713", "\u2714", "\u2611"].some((token) =>
    normalized.includes(token.toLowerCase()),
  );
}

function parseNumericValue(value) {
  const numeric = Number.parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function includesAny(value, keywords) {
  return keywords.some((keyword) => value.includes(keyword));
}

function normalizeCell(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
