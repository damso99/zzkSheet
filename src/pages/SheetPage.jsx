import styles from "../App.module.css";

export default function SheetPage({ sheet, isLoading, onRefresh, onSelectSheet }) {
  const rows = normalizeRows(sheet.rows || []);
  const headerIndex = findHeaderIndex(rows);
  const header = headerIndex >= 0 ? rows[headerIndex] : rows[0] || [];
  const bodyRows = rows.filter((_, index) => index !== headerIndex);

  if (!isLoading && rows.length === 0) {
    return (
      <section className={styles.empty}>
        <div />
        <h3>시트 데이터가 없습니다</h3>
        <p>구글 시트를 링크가 있는 사용자 보기 가능으로 공유한 뒤 다시 불러오세요.</p>
      </section>
    );
  }

  return (
    <section className={styles.sheetStack}>
      <article className={styles.sheetToolbar}>
        <div>
          <span>Google Sheet</span>
          <h3>스프레드시트 시각화</h3>
        </div>
        <div>
          <span>{sheet.updatedAt ? new Date(sheet.updatedAt).toLocaleString("ko-KR") : "-"}</span>
          <button type="button" onClick={onRefresh} disabled={isLoading}>
            새로고침
          </button>
        </div>
      </article>

      {sheet.sheetNames?.length > 0 && (
        <div className={styles.sheetTabs}>
          {sheet.sheetNames.map((name) => (
            <button
              className={name === sheet.selectedSheet ? styles.activeSheetTab : ""}
              type="button"
              onClick={() => onSelectSheet(name)}
              key={name}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div className={styles.sheetTableWrap}>
        <table className={styles.sheetTable}>
          <thead>
            <tr>
              {header.map((cell, index) => (
                <th key={`header-${index}`}>{cell || columnName(index)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, rowIndex) => (
              <SheetRow header={header} row={row} rowIndex={rowIndex} key={`row-${rowIndex}`} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SheetRow({ header, row, rowIndex }) {
  const filledCells = row.filter(Boolean);
  const isSection = filledCells.length === 1 && row[0];
  const isTotal = row.some((cell) => /합계|총|total|골드 대비|골드 수급/i.test(cell));

  if (isSection) {
    return (
      <tr className={styles.sheetSectionRow}>
        <td colSpan={Math.max(header.length, row.length)}>{row[0]}</td>
      </tr>
    );
  }

  return (
    <tr className={isTotal ? styles.sheetTotalRow : ""}>
      {header.map((_, index) => {
        const value = row[index] || "";
        return (
          <td className={getCellClass(value, index, rowIndex)} key={`cell-${rowIndex}-${index}`}>
            {formatCell(value)}
          </td>
        );
      })}
    </tr>
  );
}

function normalizeRows(rows) {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return rows
    .map((row) => row.map((cell) => String(cell || "").trim()))
    .filter((row) => row.some(Boolean))
    .map((row) => [...row, ...Array.from({ length: width - row.length }, () => "")]);
}

function findHeaderIndex(rows) {
  return rows.findIndex((row) => row.filter(Boolean).length >= 3);
}

function getCellClass(value, columnIndex) {
  const classes = [];
  const text = String(value || "").trim();

  if (columnIndex === 0) classes.push(styles.sheetFirstColumn);
  if (isNumeric(text)) classes.push(styles.sheetNumberCell);
  if (/하드|hard/i.test(text)) classes.push(styles.sheetHardCell);
  if (/노말|normal/i.test(text)) classes.push(styles.sheetNormalCell);
  if (/나이트메어|nightmare/i.test(text)) classes.push(styles.sheetNightmareCell);
  if (/^\d{4}(?:\.\d+)?$/.test(text.replace(/,/g, ""))) classes.push(styles.sheetLevelCell);

  return classes.join(" ");
}

function formatCell(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const numeric = text.replace(/,/g, "");
  if (/^-?\d+(?:\.\d+)?$/.test(numeric) && Math.abs(Number(numeric)) >= 1000) {
    return Number(numeric).toLocaleString("ko-KR");
  }

  return text;
}

function isNumeric(value) {
  return /^-?\d[\d,]*(?:\.\d+)?%?$/.test(String(value || "").trim());
}

function columnName(index) {
  return String.fromCharCode(65 + index);
}
