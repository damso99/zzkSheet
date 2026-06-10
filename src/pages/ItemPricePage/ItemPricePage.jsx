import { useEffect, useMemo, useState } from "react";
import styles from "./ItemPricePage.module.css";
import { DEFAULT_SHEET_URL, loadSheetRowsByName } from "../RaidSchedulePage/utils/sheetApi.js";

const ITEM_PRICE_SHEET_NAME = "아이템시세";
const CATEGORY_ORDER = ["engraving", "gem"];

const CATEGORY_META = {
  engraving: {
    label: "각인서",
    searchValues: ["각인서"],
  },
  gem: {
    label: "보석",
    searchValues: ["멸화의 보석", "홍염의 보석", "겁화의 보석", "작열의 보석"],
  },
};

const COLUMN_INDEX = {
  baseDate: 0,
  updatedAt: 1,
  category: 2,
  searchValue: 3,
  itemName: 4,
  grade: 5,
  todayPrice: 6,
  yesterdayPrice: 7,
  diff: 8,
  diffRate: 9,
  weeklyAverage: 10,
  weeklyDiff: 11,
  weeklyRate: 12,
  direction: 13,
  icon: 14,
};

const SORT_OPTIONS = [
  { label: "전일등락률 큰 순", value: "rate" },
  { label: "오늘가 높은 순", value: "price" },
];

export default function ItemPricePage({ embedded = false }) {
  const [rows, setRows] = useState([]);
  const [categoryKey, setCategoryKey] = useState("engraving");
  const [sortKey, setSortKey] = useState("rate");
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
          sheetName: ITEM_PRICE_SHEET_NAME,
          signal: controller.signal,
        });

        setRows(Array.isArray(payload?.rows) ? payload.rows : []);
      } catch (error) {
        if (error?.name === "AbortError") return;
        setErrorMessage(error?.message || "아이템 시세 데이터를 불러오지 못했습니다.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadRows();

    return () => controller.abort();
  }, []);

  const parsedItems = useMemo(() => parseItemPriceRows(rows), [rows]);
  const latestBaseDate = useMemo(() => getLatestBaseDate(parsedItems, categoryKey), [categoryKey, parsedItems]);
  const visibleItems = useMemo(
    () =>
      parsedItems
        .filter((item) => item.categoryKey === categoryKey && item.baseDate === latestBaseDate)
        .slice()
        .sort((left, right) => compareItems(left, right, sortKey)),
    [categoryKey, latestBaseDate, parsedItems, sortKey],
  );

  const summary = useMemo(() => buildSummary(visibleItems), [visibleItems]);
  const latestUpdatedAt = visibleItems.reduce((latest, item) => compareString(item.updatedAt, latest) > 0 ? item.updatedAt : latest, "") || "-";

  const content = (
    <>
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>LostArk Market Snapshot</p>
          <h2>아이템 시세</h2>
          <p className={styles.description}>
            각인서와 보석만 모아서 오늘가, 어제가, 전일차이, 주간평균을 한 번에 확인합니다.
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
            <span>총 항목</span>
            <strong>{visibleItems.length}개</strong>
          </div>
        </div>
      </header>

      <section className={styles.controls} aria-label="아이템 시세 필터">
        <div className={styles.categoryTabs} role="tablist" aria-label="카테고리 선택">
          {CATEGORY_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={categoryKey === key}
              className={categoryKey === key ? styles.activeTab : styles.tab}
              onClick={() => setCategoryKey(key)}
            >
              {CATEGORY_META[key].label}
            </button>
          ))}
        </div>

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
          <p>아이템 시세 데이터를 불러오는 중입니다.</p>
        </section>
      ) : null}

      {!isLoading && errorMessage ? (
        <section className={styles.errorState}>
          <p>{sanitizeText(errorMessage)}</p>
        </section>
      ) : null}

      {!isLoading && !errorMessage && parsedItems.length === 0 ? (
        <section className={styles.emptyState}>
          <p>표시할 아이템 시세가 없습니다.</p>
        </section>
      ) : null}

      {!isLoading && !errorMessage && parsedItems.length > 0 && visibleItems.length === 0 ? (
        <section className={styles.emptyState}>
          <p>선택한 카테고리에 데이터가 없습니다.</p>
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
                  <th>주간평균</th>
                  <th>주간평균차이</th>
                  <th>주간평균대비율</th>
                  <th>방향</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.id} className={styles.row}>
                    <td className={styles.itemCell}>
                      <div className={styles.iconBadge}>{item.icon || "—"}</div>
                      <div className={styles.itemText}>
                        <strong>{sanitizeText(item.itemName)}</strong>
                        <small>{sanitizeText(item.searchValue)}</small>
                      </div>
                    </td>
                    <td>
                      <span className={styles.gradeBadge}>{sanitizeText(item.grade)}</span>
                    </td>
                    <td className={styles.numberCell}>{formatPrice(item.todayPrice)}</td>
                    <td className={styles.numberCell}>{formatNullablePrice(item.yesterdayPrice)}</td>
                    <td className={getDeltaClass(item.diff)}>{formatSignedNumber(item.diff)}</td>
                    <td className={getDeltaClass(item.diffRate)}>{formatPercent(item.diffRate)}</td>
                    <td className={styles.numberCell}>{formatNullablePrice(item.weeklyAverage)}</td>
                    <td className={getDeltaClass(item.weeklyDiff)}>{formatSignedNumber(item.weeklyDiff)}</td>
                    <td className={getDeltaClass(item.weeklyRate)}>{formatPercent(item.weeklyRate)}</td>
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
                    <strong>{sanitizeText(item.itemName)}</strong>
                    <small>
                      {sanitizeText(item.searchValue)} · {sanitizeText(item.grade)}
                    </small>
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
                  <div className={styles.statBox}>
                    <span>주간평균</span>
                    <strong>{formatNullablePrice(item.weeklyAverage)}</strong>
                  </div>
                  <div className={styles.statBox}>
                    <span>주간평균차이</span>
                    <strong className={getDeltaClass(item.weeklyDiff)}>{formatSignedNumber(item.weeklyDiff)}</strong>
                  </div>
                  <div className={styles.statBox}>
                    <span>주간평균대비율</span>
                    <strong className={getDeltaClass(item.weeklyRate)}>{formatPercent(item.weeklyRate)}</strong>
                  </div>
                  <div className={styles.statBox}>
                    <span>방향 아이콘</span>
                    <strong>{sanitizeText(item.icon || "—")}</strong>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </>
      ) : null}
    </>
  );

  function reloadData() {
    setIsLoading(true);
    setErrorMessage("");

    loadSheetRowsByName({
      sheetUrl: DEFAULT_SHEET_URL,
      sheetName: ITEM_PRICE_SHEET_NAME,
      forceRefresh: true,
    })
      .then((payload) => {
        setRows(Array.isArray(payload?.rows) ? payload.rows : []);
      })
      .catch((error) => {
        setErrorMessage(error?.message || "아이템 시세 데이터를 불러오지 못했습니다.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

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

function parseItemPriceRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  return rows
    .map((row, index) => {
      if (!Array.isArray(row)) return null;

      const baseDate = sanitizeText(row[COLUMN_INDEX.baseDate]);
      const updatedAt = sanitizeText(row[COLUMN_INDEX.updatedAt]);
      const categoryLabel = sanitizeText(row[COLUMN_INDEX.category]);
      const searchValue = sanitizeText(row[COLUMN_INDEX.searchValue]);
      const itemName = sanitizeText(row[COLUMN_INDEX.itemName]);
      const grade = sanitizeText(row[COLUMN_INDEX.grade]);

      if (!isDataRow({ baseDate, categoryLabel, itemName, grade })) {
        return null;
      }

      const categoryKey = getCategoryKey(categoryLabel, searchValue);
      if (!categoryKey) {
        return null;
      }

      return {
        id: `${baseDate}-${categoryKey}-${searchValue}-${itemName}-${grade}-${index}`,
        baseDate,
        updatedAt,
        categoryKey,
        categoryLabel,
        searchValue,
        itemName,
        grade,
        todayPrice: toNumber(row[COLUMN_INDEX.todayPrice]),
        yesterdayPrice: toNullableNumber(row[COLUMN_INDEX.yesterdayPrice]),
        diff: toNullableNumber(row[COLUMN_INDEX.diff]),
        diffRate: toNullableNumber(row[COLUMN_INDEX.diffRate]),
        weeklyAverage: toNullableNumber(row[COLUMN_INDEX.weeklyAverage]),
        weeklyDiff: toNullableNumber(row[COLUMN_INDEX.weeklyDiff]),
        weeklyRate: toNullableNumber(row[COLUMN_INDEX.weeklyRate]),
        direction: normalizeDirection(row[COLUMN_INDEX.direction]),
        icon: sanitizeText(row[COLUMN_INDEX.icon]),
      };
    })
    .filter(Boolean);
}

function buildSummary(items) {
  return items.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.direction === "UP") acc.up += 1;
      if (item.direction === "DOWN") acc.down += 1;
      if (item.direction === "SAME") acc.same += 1;
      if (item.direction === "NEW") acc.newCount += 1;
      return acc;
    },
    { total: 0, up: 0, down: 0, same: 0, newCount: 0 },
  );
}

function getLatestBaseDate(items, categoryKey) {
  const dates = items
    .filter((item) => item.categoryKey === categoryKey)
    .map((item) => item.baseDate)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  return dates.at(-1) || "";
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

function compareString(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""));
}

function getCategoryKey(categoryLabel, searchValue) {
  if (categoryLabel === CATEGORY_META.engraving.label) return "engraving";
  if (categoryLabel === CATEGORY_META.gem.label) return "gem";

  const normalizedSearch = normalize(searchValue);
  if (CATEGORY_META.engraving.searchValues.some((value) => normalize(value) === normalizedSearch)) {
    return "engraving";
  }
  if (CATEGORY_META.gem.searchValues.some((value) => normalize(value) === normalizedSearch)) {
    return "gem";
  }

  return "";
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

function toNumber(value) {
  const normalized = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(normalized) ? normalized : 0;
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(normalized) ? normalized : null;
}

function sanitizeText(value) {
  return String(value ?? "").replace(/^['"]|['"]$/g, "").trim();
}

function normalize(value) {
  return sanitizeText(value).toLowerCase();
}

function isDataRow({ baseDate, categoryLabel, itemName, grade }) {
  if (!baseDate || !categoryLabel || !itemName || !grade) return false;
  if (baseDate === "기준일" || categoryLabel === "구분" || itemName === "아이템명") return false;
  return true;
}
