import { useEffect, useMemo, useState } from "react";
import styles from "./PersonalRaidPage.module.css";
import { DEFAULT_SHEET_URL, loadSheetRowsByName } from "../RaidSchedulePage/utils/sheetApi.js";

const PERSONAL_RAID_SHEET_NAME = "개인레이드";

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
          <a href="/" className={styles.backLink}>
            레이드 일정으로 돌아가기
          </a>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Personal Raid Search</span>
            <h1 className={styles.title}>개인레이드</h1>
            <p className={styles.description}>
              주인 이름으로 참여 중인 캐릭터를 빠르게 찾고, 보유 캐릭터별 참여 레이드를 한 번에 확인할 수 있습니다.
            </p>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>이름 검색</h2>
              <p className={styles.panelSubtitle}>주인 이름을 입력하면 참여 체크된 캐릭터만 카드로 표시됩니다.</p>
            </div>
            <div className={styles.summaryPills}>
              <div className={styles.summaryPill}>
                <span>참여 캐릭터</span>
                <strong>{cards.length}명</strong>
              </div>
              <div className={styles.summaryPill}>
                <span>주인 그룹</span>
                <strong>{totalOwners}명</strong>
              </div>
              <div className={styles.summaryPill}>
                <span>검색 결과</span>
                <strong>{filteredCards.length}개</strong>
              </div>
            </div>
          </div>

          <label className={styles.searchField}>
            <span>주인 이름 검색</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="예: 성태, 민지, 준호"
            />
          </label>
        </section>

        {isLoading ? (
          <section className={styles.emptyState}>
            <p>개인레이드 데이터를 불러오는 중입니다.</p>
          </section>
        ) : null}

        {!isLoading && errorMessage ? (
          <section className={styles.errorState}>
            <p>{errorMessage}</p>
          </section>
        ) : null}

        {!isLoading && !errorMessage && cards.length === 0 ? (
          <section className={styles.emptyState}>
            <p>참여 중인 캐릭터가 없습니다.</p>
          </section>
        ) : null}

        {!isLoading && !errorMessage && cards.length > 0 && filteredCards.length === 0 ? (
          <section className={styles.emptyState}>
            <p>검색 결과가 없습니다.</p>
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
                  <span className={styles.classBadge}>{card.className || "클래스 없음"}</span>
                </header>

                <div className={styles.statGrid}>
                  <div className={styles.statItem}>
                    <span>레벨</span>
                    <strong>{card.level || "-"}</strong>
                  </div>
                  <div className={styles.statItem}>
                    <span>전투력</span>
                    <strong>{card.power || "-"}</strong>
                  </div>
                </div>

                <section className={styles.raidSection}>
                  <div className={styles.raidSectionHeader}>
                    <span>참여 레이드</span>
                    <strong>{card.raids.length}개</strong>
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
                    <p className={styles.emptyRaidText}>참여 레이드 없음</p>
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

  const ownerColumnIndex = columns.owner >= 0 ? columns.owner : 0;
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
        ownerName: currentOwnerName || "이름 미지정",
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
      normalizedRow.some((value) => value.includes("캐릭터")) &&
      normalizedRow.some((value) => value.includes("레벨")) &&
      normalizedRow.some((value) => value.includes("참여"))
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

    if (result.character < 0 && normalizedValue.includes("캐릭터")) {
      result.character = index;
      return;
    }

    if (result.level < 0 && normalizedValue.includes("레벨")) {
      result.level = index;
      return;
    }

    if (result.power < 0 && (normalizedValue.includes("투력") || normalizedValue.includes("전투력"))) {
      result.power = index;
      return;
    }

    if (result.className < 0 && normalizedValue.includes("클래스")) {
      result.className = index;
      return;
    }

    if (result.participation < 0 && normalizedValue.includes("참여")) {
      result.participation = index;
    }
  });

  if (result.character > 0) {
    result.owner = result.character - 1;
  }

  return result;
}

function parseParticipation(value) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = normalizeCell(value).toLowerCase();
  if (!normalized) {
    return false;
  }

  return ["true", "참여", "y", "yes", "1", "v", "✓", "✔"].some((token) => normalized.includes(token));
}

function parseNumericValue(value) {
  const numeric = Number.parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeCell(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
