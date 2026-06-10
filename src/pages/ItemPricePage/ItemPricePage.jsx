import { useEffect, useMemo, useState } from "react";
import styles from "./ItemPricePage.module.css";
import { loadSheetRowsByName } from "../RaidSchedulePage/utils/sheetApi.js";

const ITEM_PRICE_REFRESH_API_URL = "/api/item-price";
const ITEM_PRICE_SHEET_NAME = "아이템시세";
const ITEM_PRICE_SHEET_URL =
  import.meta.env.VITE_ITEM_PRICE_SHEET_URL ||
  "https://docs.google.com/spreadsheets/d/1pn-86CBr_9TzKI1zncCXpo3Ge0rKjg8zA99v6twX_gA/edit?gid=1973331080#gid=1973331080";

const COLUMN_INDEX = {
  baseDate: 0,
  updatedAt: 1,
  itemName: 2,
  grade: 3,
  todayPrice: 4,
  yesterdayPrice: 5,
  diff: 6,
  diffRate: 7,
  weeklyAverage: 8,
  weeklyDiff: 9,
  weeklyRate: 10,
  direction: 11,
  icon: 12,
};

const SORT_OPTIONS = [
  { label: "전일등락률 큰 순", value: "rate" },
  { label: "오늘가 높은 순", value: "price" },
];

export default function ItemPricePage({ embedded = false }) {
  const [rows, setRows] = useState([]);
  const [sortKey, setSortKey] = useState("rate");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void loadSnapshot({ signal: controller.signal });
    return () => controller.abort();
  }, []);

  const parsedItems = useMemo(() => parseItemPriceRows(rows), [rows]);
  const latestBaseDate = useMemo(() => getLatestBaseDate(parsedItems), [parsedItems]);
  const visibleItems = useMemo(
    () =>
      parsedItems
        .filter((item) => item.baseDate === latestBaseDate)
        .filter((item) => item.grade === "유물")
        .filter((item) => item.itemName.includes("각인서"))
        .slice()
        .sort((left, right) => compareItems(left, right, sortKey)),
    [latestBaseDate, parsedItems, sortKey],
  );
  const summary = useMemo(() => buildSummary(visibleItems), [visibleItems]);
  const latestUpdatedAt = useMemo(() => getLatestUpdatedAt(visibleItems), [visibleItems]);

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} />
      <div className={styles.content}>
        <section className={embedded ? styles.embeddedContent : undefined}>
          <header className={styles.hero}>
            <div className={styles.heroText}>
              <p className={styles.eyebrow}>LostArk Market Snapshot</p>
              <h2>유물 각인서 시세</h2>
              <p className={styles.description}>
                유물 등급 각인서만 보여줍니다. 오늘가, 어제가, 전일차이, 전일등락률만 핵심 위주로 확인할 수 있습니다.
              </p>
            </div>

            <div className={styles.heroMeta}>
              <div className={styles.metaCard}>
                <span>기준일</span>
                <strong>{latestBaseDate || "-"}</strong>
              </div>
              <div className={styles.metaCard}>
                <span>갱신시각</span>
                <strong>{latestUpdatedAt}</strong>
              </div>
              <div className={styles.metaCard}>
                <span>표시 항목</span>
                <strong>{visibleItems.length}개</strong>
              </div>
            </div>
          </header>

          <section className={styles.controls} aria-label="아이템 시세 필터">
            <div className={styles.categoryPill}>각인서 · 유물만 조회</div>

            <div className={styles.controlRow}>
              <select className={styles.select} value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button type="button" className={styles.button} onClick={reloadData}>
                새로고침
              </button>
            </div>
          </section>

          <section className={styles.summaryBar} aria-label="요약">
            <div className={styles.summaryChip}>
              <span>상승</span>
              <strong>{summary.up}</strong>
            </div>
            <div className={styles.summaryChip}>
              <span>하락</span>
              <strong>{summary.down}</strong>
            </div>
            <div className={styles.summaryChip}>
              <span>유지</span>
              <strong>{summary.same}</strong>
            </div>
            <div className={styles.summaryChip}>
              <span>신규</span>
              <strong>{summary.newCount}</strong>
            </div>
          </section>

          {isLoading ? (
            <section className={styles.emptyState}>
              <p>유물 각인서 시세를 불러오는 중입니다.</p>
            </section>
          ) : null}

          {!isLoading && errorMessage ? (
            <section className={styles.errorState}>
              <p>{errorMessage}</p>
            </section>
          ) : null}

          {!isLoading && !errorMessage && parsedItems.length === 0 ? (
            <section className={styles.emptyState}>
              <p>시트에 표시할 아이템 시세가 없습니다.</p>
            </section>
          ) : null}

          {!isLoading && !errorMessage && parsedItems.length > 0 && visibleItems.length === 0 ? (
            <section className={styles.emptyState}>
              <p>유물 등급 각인서 데이터가 없습니다.</p>
            </section>
          ) : null}

          {!isLoading && !errorMessage && visibleItems.length > 0 ? (
            <>
              <section className={styles.tableWrap} aria-label="아이템 시세 표">
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>아이템명</th>
                      <th>등급</th>
                      <th>오늘가</th>
                      <th>어제가</th>
                      <th>전일차이</th>
                      <th>전일등락률</th>
                      <th>방향</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map((item) => (
                      <tr key={item.id} className={styles.row}>
                        <td className={styles.itemCell}>
                          <div className={styles.iconBadge}>{renderIcon(item.icon, item.itemName)}</div>
                          <div className={styles.itemText}>
                            <strong>{item.itemName}</strong>
                            <small>{item.baseDate}</small>
                          </div>
                        </td>
                        <td>
                          <span className={styles.gradeBadge}>{item.grade || "-"}</span>
                        </td>
                        <td className={styles.numberCell}>{formatPrice(item.todayPrice)}</td>
                        <td className={styles.numberCell}>{formatNullablePrice(item.yesterdayPrice)}</td>
                        <td className={getDeltaClass(item.diff)}>{formatSignedNumber(item.diff)}</td>
                        <td className={getDeltaClass(item.diffRate)}>{formatPercent(item.diffRate)}</td>
                        <td>
                          <span className={`${styles.directionBadge} ${getDirectionClass(item.direction)}`}>
                            {directionLabel(item.direction)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className={styles.mobileList} aria-label="아이템 시세 카드">
                {visibleItems.map((item) => (
                  <article key={`mobile-${item.id}`} className={styles.mobileCard}>
                    <div className={styles.mobileHeader}>
                      <div className={styles.mobileTitle}>
                        <strong>{item.itemName}</strong>
                        <small>{item.grade || "-"}</small>
                      </div>
                      <span className={`${styles.directionBadge} ${getDirectionClass(item.direction)}`}>
                        {directionLabel(item.direction)}
                      </span>
                    </div>

                    <div className={styles.mobileGrid}>
                      <div className={styles.statBox}>
                        <span>오늘가</span>
                        <strong>{formatPrice(item.todayPrice)}</strong>
                      </div>
                      <div className={styles.statBox}>
                        <span>어제가</span>
                        <strong>{formatNullablePrice(item.yesterdayPrice)}</strong>
                      </div>
                      <div className={styles.statBox}>
                        <span>전일차이</span>
                        <strong className={getDeltaClass(item.diff)}>{formatSignedNumber(item.diff)}</strong>
                      </div>
                      <div className={styles.statBox}>
                        <span>전일등락률</span>
                        <strong className={getDeltaClass(item.diffRate)}>{formatPercent(item.diffRate)}</strong>
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );

  function reloadData() {
    void loadSnapshot({ force: true });
  }

  async function loadSnapshot({ signal, force = false } = {}) {
    setIsLoading(true);
    setErrorMessage("");

    let refreshError = "";
    let refreshRows = [];

    try {
      const refreshUrl = force ? `${ITEM_PRICE_REFRESH_API_URL}?force=1` : ITEM_PRICE_REFRESH_API_URL;
      const response = await fetch(refreshUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
        },
        signal,
      });
      const payload = await response.json();
      refreshRows = Array.isArray(payload?.rows) ? payload.rows : [];

      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.detail || payload?.error || "아이템 시세 갱신에 실패했습니다.");
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        refreshError = error instanceof Error ? error.message : "아이템 시세 갱신에 실패했습니다.";
      } else {
        return;
      }
    }

    try {
      const payload = await loadSheetRowsByName({
        sheetUrl: ITEM_PRICE_SHEET_URL,
        sheetName: ITEM_PRICE_SHEET_NAME,
        forceRefresh: true,
        signal,
      });
      const sheetRows = Array.isArray(payload?.rows) ? payload.rows : [];
      setRows(sheetRows.length > 0 ? sheetRows : refreshRows);
    } catch (error) {
      if (error?.name === "AbortError") return;
      const sheetError = error instanceof Error ? error.message : "아이템 시세 시트를 불러오지 못했습니다.";
      setRows(refreshRows);
      setErrorMessage(refreshError ? `${refreshError} / ${sheetError}` : sheetError);
      setIsLoading(false);
      return;
    }

    if (refreshError) {
      setErrorMessage(refreshError);
    }

    setIsLoading(false);
  }
}

function parseItemPriceRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  return rows
    .map((row, index) => {
      if (!Array.isArray(row)) return null;

      const baseDate = sanitizeText(row[COLUMN_INDEX.baseDate]);
      const updatedAt = sanitizeText(row[COLUMN_INDEX.updatedAt]);
      const itemName = sanitizeText(row[COLUMN_INDEX.itemName]);
      const grade = sanitizeText(row[COLUMN_INDEX.grade]);

      if (!isDataRow({ baseDate, itemName, grade })) {
        return null;
      }

      return {
        id: `${baseDate}-${itemName}-${grade}-${index}`,
        baseDate,
        updatedAt,
        itemName,
        grade,
        todayPrice: toNumber(row[COLUMN_INDEX.todayPrice]),
        yesterdayPrice: toNullableNumber(row[COLUMN_INDEX.yesterdayPrice]),
        diff: toNullableNumber(row[COLUMN_INDEX.diff]),
        diffRate: toNullableNumber(row[COLUMN_INDEX.diffRate]),
        direction: normalizeDirection(row[COLUMN_INDEX.direction]),
        icon: sanitizeText(row[COLUMN_INDEX.icon]),
      };
    })
    .filter(Boolean);
}

function buildSummary(items) {
  return items.reduce(
    (acc, item) => {
      if (item.direction === "UP") acc.up += 1;
      if (item.direction === "DOWN") acc.down += 1;
      if (item.direction === "SAME") acc.same += 1;
      if (item.direction === "NEW") acc.newCount += 1;
      return acc;
    },
    { up: 0, down: 0, same: 0, newCount: 0 },
  );
}

function compareItems(left, right, sortKey) {
  if (sortKey === "price") {
    const priceDiff = toNumber(right.todayPrice) - toNumber(left.todayPrice);
    if (priceDiff !== 0) return priceDiff;
  } else {
    const leftRate = left.diffRate ?? Number.NEGATIVE_INFINITY;
    const rightRate = right.diffRate ?? Number.NEGATIVE_INFINITY;
    if (rightRate !== leftRate) return rightRate - leftRate;

    const leftPrice = toNumber(left.todayPrice);
    const rightPrice = toNumber(right.todayPrice);
    if (rightPrice !== leftPrice) return rightPrice - leftPrice;
  }

  return `${left.itemName} ${left.grade}`.localeCompare(`${right.itemName} ${right.grade}`, "ko");
}

function getLatestBaseDate(items) {
  const dates = items
    .map((item) => item.baseDate)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  return dates.at(-1) || "";
}

function getLatestUpdatedAt(items) {
  return items.reduce((latest, item) => {
    return compareString(item.updatedAt, latest) > 0 ? item.updatedAt : latest;
  }, "") || "-";
}

function getDirectionClass(direction) {
  switch (normalizeDirection(direction)) {
    case "UP":
      return styles.directionUp;
    case "DOWN":
      return styles.directionDown;
    case "NEW":
      return styles.directionNew;
    default:
      return styles.directionSame;
  }
}

function directionLabel(direction) {
  switch (normalizeDirection(direction)) {
    case "UP":
      return "상승";
    case "DOWN":
      return "하락";
    case "NEW":
      return "신규";
    default:
      return "유지";
  }
}

function normalizeDirection(direction) {
  const text = sanitizeText(direction).toUpperCase();
  if (["UP", "DOWN", "NEW", "SAME"].includes(text)) {
    return text;
  }
  return "SAME";
}

function getDeltaClass(value) {
  const number = toNullableNumber(value);
  if (number === null) return styles.deltaNeutral;
  if (number > 0) return styles.deltaUp;
  if (number < 0) return styles.deltaDown;
  return styles.deltaNeutral;
}

function formatPrice(value) {
  const number = toNumber(value);
  return Number.isFinite(number) ? number.toLocaleString("ko-KR") : "-";
}

function formatNullablePrice(value) {
  const number = toNullableNumber(value);
  return number === null ? "-" : number.toLocaleString("ko-KR");
}

function formatSignedNumber(value) {
  const number = toNullableNumber(value);
  if (number === null) return "-";
  const prefix = number > 0 ? "+" : "";
  return `${prefix}${Math.round(number).toLocaleString("ko-KR")}`;
}

function formatPercent(value) {
  const number = toNullableNumber(value);
  if (number === null) return "-";
  const prefix = number > 0 ? "+" : "";
  return `${prefix}${number.toFixed(2)}%`;
}

function renderIcon(icon, itemName) {
  const text = sanitizeText(icon);
  if (!text || text === "-") {
    return "∞";
  }

  if (/^https?:\/\//i.test(text)) {
    return (
      <img
        alt={`${itemName} 아이콘`}
        src={text}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
    );
  }

  return text;
}

function toNumber(value) {
  const numeric = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(numeric) ? numeric : 0;
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function compareString(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""));
}

function sanitizeText(value) {
  return String(value ?? "").replace(/^['"]|['"]$/g, "").trim();
}

function isDataRow({ baseDate, itemName, grade }) {
  return Boolean(baseDate && itemName && grade) && baseDate !== "기준일" && itemName !== "아이템명";
}
