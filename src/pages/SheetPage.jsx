import styles from "../App.module.css";

const RAID_WORDS =
  /카제로스|세르카|지평|지평성당|막걸리|아르모체|모르둠|아브렐|에기르|베히모스|쿠르잔|카멘|상아탑|일리아칸|아르고스|발탄|비아키스|쿠크|아브|하브|노브|하기르|하르둠|익스트림|하드|노말|헬/i;
const DATE_WORDS = /날짜|일자|요일|일정|date|day/i;
const TIME_WORDS = /시간|시각|타임|time/i;
const PARTICIPANT_WORDS = /참여|인원|멤버|공대원|파티원|참가|member|user|name/i;

export default function SheetPage({ sheet, isLoading, onRefresh, onSelectSheet }) {
  const rows = normalizeRows(sheet.rows || []);
  const events = extractRaidEvents(rows, sheet.selectedSheet);
  const stats = buildEventStats(events);

  if (!isLoading && rows.length === 0) {
    return (
      <section className={styles.empty}>
        <div />
        <h3>시트 데이터가 없습니다</h3>
        <p>구글 시트 링크가 공개 보기 상태인지 확인한 뒤 다시 불러와 주세요.</p>
      </section>
    );
  }

  return (
    <section className={styles.sheetDashboard}>
      <article className={styles.sheetHero}>
        <div>
          <span>Google Sheet</span>
          <h1>레이드 일정 대시보드</h1>
          <p>{sheet.selectedSheet || "시트"} 탭에서 날짜, 참여인원, 시간, 참여레이드만 정리해서 보여줍니다.</p>
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
                선택한 탭에서 레이드명과 참여자 정보를 찾지 못했습니다. 다른 시트 탭을 선택해 주세요.
              </div>
            )}
            {events.map((event, index) => (
              <article className={styles.scheduleCardModern} key={`${event.date}-${event.time}-${event.raid}-${index}`}>
                <div className={styles.scheduleDateBadge}>
                  <span>{event.weekday || "DATE"}</span>
                  <strong>{event.date || "-"}</strong>
                </div>
                <div className={styles.scheduleContent}>
                  <h3>{event.raid || "레이드 미정"}</h3>
                  <dl>
                    <div>
                      <dt>날짜</dt>
                      <dd>{event.date || "-"}</dd>
                    </div>
                    <div>
                      <dt>시간</dt>
                      <dd>{event.time || "미정"}</dd>
                    </div>
                    <div>
                      <dt>참여인원</dt>
                      <dd>{event.participantsText || `${event.participantCount || 0}명`}</dd>
                    </div>
                  </dl>
                </div>
                <strong>{event.participantCount || "-"}</strong>
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

function extractRaidEvents(rows, selectedSheet = "") {
  if (rows.length === 0) return [];

  const calendarEvents = extractCalendarEvents(rows, selectedSheet);
  if (calendarEvents.length > 0) return calendarEvents.slice(0, 100);

  const tableEvents = extractHeaderTableEvents(rows);
  if (tableEvents.length > 0) return tableEvents.slice(0, 100);

  return extractBlockEvents(rows, selectedSheet).slice(0, 100);
}

function extractCalendarEvents(rows, selectedSheet = "") {
  if (!/calendar|캘린더/i.test(selectedSheet)) return [];

  const dateRowIndex = rows.findIndex((row) => row.filter((cell) => parseDateCell(cell)).length >= 3);
  if (dateRowIndex < 0) return [];

  const dateAnchors = rows[dateRowIndex]
    .map((cell, index) => ({ date: parseDateCell(cell), index }))
    .filter((item) => item.date);

  if (dateAnchors.length === 0) return [];

  const events = [];

  rows.slice(dateRowIndex + 1).forEach((row, offset) => {
    const rowIndex = dateRowIndex + 1 + offset;
    const baseTime = row.find((cell, index) => index <= 2 && isTimeLike(cell) && !/^[A-Z]$/.test(cell)) || "";

    dateAnchors.forEach((anchor, anchorIndex) => {
      const nextAnchor = dateAnchors[anchorIndex + 1]?.index ?? row.length;
      const start = anchor.index;
      const end = Math.max(start + 1, nextAnchor);
      const cells = row.slice(start, end);

      cells.forEach((cell, cellOffset) => {
        const value = cleanCell(cell);
        if (!value || isNoiseCell(value) || !RAID_WORDS.test(value)) return;

        const columnIndex = start + cellOffset;
        const localTime = isTimeLike(row[columnIndex - 1]) ? row[columnIndex - 1] : "";
        const participantInfo = findCalendarParticipantInfo(rows, rowIndex, columnIndex);
        const participantCount = countParticipants(participantInfo);

        events.push({
          date: anchor.date,
          weekday: findWeekday(anchor.date),
          time: normalizeTime(localTime || baseTime || "미정"),
          raid: cleanRaidName(value),
          participantsText: participantInfo || (participantCount ? `${participantCount}명` : "-"),
          participantCount,
        });
      });
    });
  });

  return dedupeEvents(events);
}

function extractHeaderTableEvents(rows) {
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => DATE_WORDS.test(cell) || TIME_WORDS.test(cell) || PARTICIPANT_WORDS.test(cell) || RAID_WORDS.test(cell)),
  );
  const header = headerIndex >= 0 ? rows[headerIndex] : [];
  const columns = mapColumns(header);
  const hasUsefulColumns = [columns.date, columns.time, columns.participants, columns.raid].filter(Number.isInteger).length >= 2;

  if (!hasUsefulColumns) return [];

  return rows
    .filter((row, index) => index !== headerIndex && row.some(Boolean))
    .map((row) => buildTableEvent(row, columns))
    .filter((event) => event.raid || event.participantCount > 0);
}

function extractBlockEvents(rows, selectedSheet) {
  const events = [];
  const headerRows = rows
    .map((row, index) => ({ row, index, raidCells: findRaidHeaderCells(row) }))
    .filter((item) => item.raidCells.length > 0);

  headerRows.forEach((headerRow, headerRowIndex) => {
    const nextHeaderIndex = headerRows[headerRowIndex + 1]?.index ?? rows.length;
    const bodyRows = rows.slice(headerRow.index + 1, nextHeaderIndex);

    headerRow.raidCells.forEach(({ index: columnIndex, raid }) => {
      const participants = [];
      let date = "";
      let time = "";

      bodyRows.forEach((row) => {
        const participant = cleanParticipant(row[columnIndex]);
        if (participant) participants.push(participant);

        const firstCell = cleanCell(row[0]);
        if (!date && isDateLike(firstCell)) date = firstCell;
        if (!time && isTimeLike(firstCell)) time = normalizePartyLabel(firstCell);
      });

      if (participants.length === 0) return;

      events.push({
        date: date || selectedSheet || "-",
        weekday: findWeekday(date),
        time: time || findNearbyPartyLabel(bodyRows) || "미정",
        raid: cleanRaidName(raid),
        participantsText: `${participants.length}명`,
        participantCount: participants.length,
      });
    });
  });

  return dedupeEvents(events);
}

function findRaidHeaderCells(row) {
  return row
    .map((cell, index) => ({ cell: cleanCell(cell), index }))
    .filter(({ cell }) => cell && RAID_WORDS.test(cell) && !isNoiseCell(cell))
    .map(({ cell, index }) => ({ raid: cell, index }));
}

function buildTableEvent(row, columns) {
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
    if (DATE_WORDS.test(cell)) columns.date ??= index;
    if (TIME_WORDS.test(cell)) columns.time ??= index;
    if (PARTICIPANT_WORDS.test(cell)) columns.participants ??= index;
    if (/레이드|던전|콘텐츠|관문|raid/i.test(cell) || RAID_WORDS.test(cell)) columns.raid ??= index;
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

function dedupeEvents(events) {
  const seen = new Set();
  return events.filter((event) => {
    const key = `${event.date}|${event.time}|${event.raid}|${event.participantCount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeRows(rows) {
  return rows
    .map((row) => row.map((cell) => cleanCell(cell)))
    .filter((row) => row.some(Boolean));
}

function parseDateCell(value) {
  const text = cleanCell(value);
  if (!text) return "";

  const direct = text.match(/(20\d{2})[./-](\d{1,2})[./-](\d{1,2})/);
  if (direct) {
    return `${direct[1]}.${Number(direct[2])}.${Number(direct[3])}`;
  }

  if (/^\d{5}$/.test(text)) {
    const serial = Number(text);
    if (serial < 40000 || serial > 60000) return "";

    const date = new Date(Date.UTC(1899, 11, 30 + serial));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    return `${year}.${month}.${day}`;
  }

  return "";
}

function findCalendarParticipantInfo(rows, rowIndex, columnIndex) {
  const candidates = [];

  for (let y = rowIndex + 1; y <= Math.min(rows.length - 1, rowIndex + 3); y += 1) {
    for (let x = Math.max(0, columnIndex - 1); x <= Math.min(rows[y].length - 1, columnIndex + 1); x += 1) {
      const cell = cleanCell(rows[y][x]);
      if (!cell || isNoiseCell(cell) || RAID_WORDS.test(cell) || isTimeLike(cell)) continue;
      candidates.push(cell);
    }
  }

  const numeric = candidates.find((cell) => /^\d+\s*명?$/.test(cell));
  if (numeric) return /^\d+$/.test(numeric) ? `${numeric}명` : numeric;

  const names = candidates.filter((cell) => !/^[A-Z]$/.test(cell));
  if (names.length >= 2) return `${names.length}명`;
  if (names.length === 1 && /명/.test(names[0])) return names[0];

  return "";
}

function cleanCell(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .trim();
}

function pickColumn(row, index) {
  return Number.isInteger(index) ? row[index] || "" : "";
}

function findDate(row) {
  return row.find((cell) => isDateLike(cell)) || "";
}

function findWeekday(value) {
  const match = String(value || "").match(/[월화수목금토일]/);
  return match ? match[0] : "";
}

function findTime(row) {
  return row.find((cell) => isTimeLike(cell)) || "";
}

function findRaid(row) {
  return row.find((cell) => RAID_WORDS.test(cell)) || "";
}

function findParticipants(row, known) {
  const ignored = new Set(Object.values(known).filter(Boolean));
  return (
    row
      .filter((cell) => cell && !ignored.has(cell) && !isNoiseCell(cell))
      .find((cell) => /명|[,/·]|\s{2,}/.test(cell)) || ""
  );
}

function findNearbyPartyLabel(rows) {
  const label = rows.map((row) => cleanCell(row[0])).find((cell) => /^[A-Z]$|^\d+\s*파티$|^\d+팟$/.test(cell));
  return normalizePartyLabel(label);
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
  return normalizePartyLabel(String(value || "").replace(/\s+/g, " ").trim());
}

function normalizePartyLabel(value) {
  const text = String(value || "").trim();
  if (/^[A-Z]$/.test(text)) return `${text} 파티`;
  return text;
}

function cleanRaidName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/참여|인원|시간|날짜/g, "")
    .trim();
}

function cleanParticipant(value) {
  const text = cleanCell(value);
  if (!text || isNoiseCell(text) || RAID_WORDS.test(text)) return "";
  return text;
}

function isDateLike(value) {
  const text = String(value || "").trim();
  return /\d{1,2}[./-]\s*\d{1,2}|20\d{2}[./-]\d{1,2}[./-]\d{1,2}|^[월화수목금토일]$|[월화수목금토일]요일/.test(text);
}

function isTimeLike(value) {
  const text = String(value || "").trim();
  return /\b(?:[01]?\d|2[0-3]):[0-5]\d\b|오전|오후|저녁|밤|낮|^[A-Z]$|^\d+\s*파티$|^\d+팟$/.test(text);
}

function isNoiseCell(value) {
  const text = String(value || "").trim();
  return (
    !text ||
    text === "TRUE" ||
    text === "FALSE" ||
    text === "-" ||
    /^#[0-9a-f]{3,8}$/i.test(text) ||
    /^https?:\/\//i.test(text)
  );
}
