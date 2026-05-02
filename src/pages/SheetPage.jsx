import styles from "../App.module.css";

export default function SheetPage({ sheet, isLoading, onRefresh, onSelectSheet }) {
  const rows = normalizeRows(sheet.rows || []);
  const events = extractRaidEvents(rows);
  const stats = buildEventStats(events);

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
    <section className={styles.sheetDashboard}>
      <article className={styles.sheetHero}>
        <div>
          <span>Google Sheet</span>
          <h3>레이드 일정 대시보드</h3>
          <p>{sheet.selectedSheet || "시트"} 탭에서 날짜, 참여인원, 시간, 참여레이드만 정리합니다.</p>
        </div>
        <div className={styles.sheetHeroActions}>
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

      <div className={styles.scheduleSummaryGrid}>
        <SummaryCard label="일정" value={events.length} suffix="개" />
        <SummaryCard label="참여인원" value={stats.totalParticipants} suffix="명" />
        <SummaryCard label="레이드 종류" value={stats.raidCount} suffix="개" />
        <SummaryCard label="가장 많은 시간" value={stats.peakTime || "-"} />
      </div>

      <div className={styles.scheduleLayout}>
        <article className={styles.schedulePanelModern}>
          <header>
            <div>
              <span>Schedule</span>
              <h3>참여 일정</h3>
            </div>
            <strong>{events.length} rows</strong>
          </header>

          <div className={styles.scheduleCards}>
            {events.length === 0 && (
              <div className={styles.emptySchedule}>
                선택한 탭에서 날짜, 시간, 참여인원, 참여레이드 정보를 찾지 못했습니다.
              </div>
            )}
            {events.map((event, index) => (
              <article className={styles.scheduleCardModern} key={`${event.date}-${event.time}-${event.raid}-${index}`}>
                <div className={styles.scheduleDateBadge}>
                  <span>{event.weekday || "DATE"}</span>
                  <strong>{event.date || "-"}</strong>
                </div>
                <div className={styles.scheduleContent}>
                  <strong>{event.raid || "레이드 미정"}</strong>
                  <div>
                    <span>{event.time || "시간 미정"}</span>
                    <span>{event.participantsText || `${event.participantCount || 0}명`}</span>
                  </div>
                </div>
                <b>{event.participantCount || "-"}</b>
              </article>
            ))}
          </div>
        </article>

        <aside className={styles.scheduleInsightPanel}>
          <ChartPanel title="레이드별 참여" items={stats.byRaid} />
          <ChartPanel title="시간대별 일정" items={stats.byTime} />
        </aside>
      </div>
    </section>
  );
}

function SummaryCard({ label, value, suffix = "" }) {
  return (
    <article className={styles.scheduleSummaryCard}>
      <span>{label}</span>
      <strong>
        {value}
        {suffix && <small>{suffix}</small>}
      </strong>
    </article>
  );
}

function ChartPanel({ title, items }) {
  const max = Math.max(1, ...items.map((item) => item.value));

  return (
    <article className={styles.chartPanelMono}>
      <header>
        <h3>{title}</h3>
      </header>
      <div className={styles.monoBars}>
        {items.length === 0 && <p>표시할 데이터가 없습니다.</p>}
        {items.slice(0, 8).map((item) => (
          <div className={styles.monoBarRow} key={item.label}>
            <span>{item.label}</span>
            <div>
              <i style={{ width: `${Math.max(8, (item.value / max) * 100)}%` }} />
            </div>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function extractRaidEvents(rows) {
  if (rows.length === 0) return [];

  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => /날짜|일자|시간|참여|인원|레이드|던전|콘텐츠/i.test(cell)),
  );
  const header = headerIndex >= 0 ? rows[headerIndex] : [];
  const bodyRows = rows.filter((row, index) => index !== headerIndex && row.some(Boolean));
  const columns = mapColumns(header);

  return bodyRows
    .map((row) => buildEvent(row, columns))
    .filter((event) => event.date || event.time || event.raid || event.participantsText)
    .filter((event) => event.raid || event.participantCount > 0)
    .slice(0, 100);
}

function buildEvent(row, columns) {
  const date = pickColumn(row, columns.date) || findDate(row);
  const time = pickColumn(row, columns.time) || findTime(row);
  const raid = cleanRaidName(pickColumn(row, columns.raid) || findRaid(row));
  const participantsRaw = pickColumn(row, columns.participants) || findParticipants(row, { date, time, raid });
  const participantCount = countParticipants(participantsRaw);

  return {
    date: normalizeDate(date),
    weekday: findWeekday(date),
    time: normalizeTime(time),
    raid,
    participantsText: normalizeParticipants(participantsRaw, participantCount),
    participantCount,
  };
}

function mapColumns(header) {
  const columns = {};

  header.forEach((cell, index) => {
    if (/날짜|일자|요일/i.test(cell)) columns.date ??= index;
    if (/시간|시각/i.test(cell)) columns.time ??= index;
    if (/참여|인원|멤버|공대원|파티원/i.test(cell)) columns.participants ??= index;
    if (/레이드|던전|콘텐츠|관문/i.test(cell)) columns.raid ??= index;
  });

  return columns;
}

function buildEventStats(events) {
  const totalParticipants = events.reduce((sum, event) => sum + (event.participantCount || 0), 0);
  const byRaid = countBy(events.map((event) => event.raid).filter(Boolean));
  const byTime = countBy(events.map((event) => event.time).filter(Boolean));

  return {
    totalParticipants,
    raidCount: byRaid.length,
    peakTime: byTime[0]?.label || "",
    byRaid,
    byTime,
  };
}

function countBy(values) {
  const map = new Map();
  values.forEach((value) => map.set(value, (map.get(value) || 0) + 1));
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "ko"));
}

function normalizeRows(rows) {
  return rows
    .map((row) => row.map((cell) => String(cell || "").trim()))
    .filter((row) => row.some(Boolean));
}

function pickColumn(row, index) {
  return Number.isInteger(index) ? row[index] || "" : "";
}

function findDate(row) {
  return row.find((cell) => /\d{1,2}[./월-]\s*\d{1,2}|20\d{2}[./-]\d{1,2}[./-]\d{1,2}|[월화수목금토일]요일?/.test(cell)) || "";
}

function findWeekday(value) {
  const match = String(value || "").match(/[월화수목금토일]요일?/);
  return match ? match[0].replace("요일", "") : "";
}

function findTime(row) {
  return row.find((cell) => /\b(?:[01]?\d|2[0-3]):[0-5]\d\b|오전|오후|저녁|밤|낮/.test(cell)) || "";
}

function findRaid(row) {
  return (
    row.find((cell) =>
      /카제로스|세르카|아르모체|모르둠|아브렐|에기르|지평|종막|막|레이드|하드|노말|나이트메어/i.test(cell),
    ) || ""
  );
}

function findParticipants(row, known) {
  const ignored = new Set(Object.values(known).filter(Boolean));
  const candidate = row
    .filter((cell) => cell && !ignored.has(cell))
    .find((cell) => /\d+\s*명|[,/·]|[가-힣A-Za-z0-9_]{2,}\s+[가-힣A-Za-z0-9_]{2,}/.test(cell));

  return candidate || "";
}

function countParticipants(value) {
  const text = String(value || "").trim();
  const explicit = text.match(/(\d+)\s*명/);
  if (explicit) return Number(explicit[1]);
  if (!text) return 0;

  const names = text
    .split(/[,/·\n\r]+|\s{2,}/)
    .map((item) => item.trim())
    .filter((item) => item && !/참여|인원|시간|레이드|날짜/.test(item));

  return names.length || 0;
}

function normalizeParticipants(value, count) {
  const text = String(value || "").trim();
  if (!text && count) return `${count}명`;
  if (/^\d+$/.test(text)) return `${text}명`;
  return text;
}

function normalizeDate(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/요일/g, "")
    .trim();
}

function normalizeTime(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanRaidName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/참여|인원|시간|날짜/g, "")
    .trim();
}
