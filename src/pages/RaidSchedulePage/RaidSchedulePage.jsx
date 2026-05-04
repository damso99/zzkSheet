import { useDeferredValue, useEffect, useMemo, useState } from "react";
import styles from "./RaidSchedulePage.module.css";
import CharacterDetailModal from "./components/CharacterDetailModal.jsx";
import RaidCard from "./components/RaidCard.jsx";
import RaidSearch from "./components/RaidSearch.jsx";
import { getCurrentWeekRange, getTodayIsoDate, getWeekDates, isDateInRange, formatDateLabel } from "./utils/dateUtils.js";
import { buildFallbackRaidSchedule, buildRaidSchedule } from "./utils/raidParser.js";
import { DEFAULT_SHEET_URL, DEFAULT_TARGET_GID, loadRaidSheetBundle } from "./utils/sheetApi.js";

const TAB_LABELS = {
  today: "금일 일정",
  week: "주간 일정",
  search: "이름 검색",
};

export default function RaidSchedulePage() {
  const [activeTab, setActiveTab] = useState("today");
  const [raids, setRaids] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedCharacterName, setSelectedCharacterName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceMeta, setSourceMeta] = useState({
    isFallback: false,
    fetchedAt: "",
    sourceUrl: DEFAULT_SHEET_URL,
  });

  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const todayIsoDate = useMemo(() => getTodayIsoDate(), []);
  const currentWeekRange = useMemo(() => getCurrentWeekRange(todayIsoDate), [todayIsoDate]);

  useEffect(() => {
    let ignore = false;

    async function loadSchedule() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const bundle = await loadRaidSheetBundle({
          sheetUrl: DEFAULT_SHEET_URL,
          targetGid: DEFAULT_TARGET_GID,
        });
        const normalizedRaids = buildRaidSchedule(bundle);

        if (!ignore) {
          setRaids(normalizedRaids);
          setSourceMeta({
            fetchedAt: bundle.fetchedAt,
            isFallback: false,
            sourceUrl: bundle.sourceUrl,
          });
        }
      } catch (error) {
        if (ignore) return;

        setRaids(buildFallbackRaidSchedule(todayIsoDate));
        setSourceMeta({
          fetchedAt: new Date().toISOString(),
          isFallback: true,
          sourceUrl: DEFAULT_SHEET_URL,
        });
        setErrorMessage(
          error instanceof Error
            ? `실시간 시트 연동에 실패해 더미 데이터를 표시하고 있습니다. ${error.message}`
            : "실시간 시트 연동에 실패해 더미 데이터를 표시하고 있습니다.",
        );
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadSchedule();

    return () => {
      ignore = true;
    };
  }, [todayIsoDate]);

  const todayRaids = useMemo(
    () => raids.filter((raid) => raid.date === todayIsoDate),
    [raids, todayIsoDate],
  );

  const weeklyGroups = useMemo(() => {
    const raidsByDate = new Map(
      getWeekDates(currentWeekRange).map((isoDate) => [isoDate, []]),
    );

    raids
      .filter((raid) => isDateInRange(raid.date, currentWeekRange))
      .forEach((raid) => {
        if (!raidsByDate.has(raid.date)) raidsByDate.set(raid.date, []);
        raidsByDate.get(raid.date).push(raid);
      });

    return Array.from(raidsByDate.entries())
      .map(([isoDate, dateRaids]) => ({
        date: isoDate,
        label: formatDateLabel(isoDate),
        raids: dateRaids.sort(compareRaidTime),
        startTime: getFirstStartTime(dateRaids),
      }))
      .filter((group) => group.raids.length > 0);
  }, [currentWeekRange, raids]);

  const searchResults = useMemo(() => {
    if (!deferredSearchQuery) return [];

    const loweredQuery = deferredSearchQuery.toLowerCase();
    return raids.flatMap((raid) =>
      raid.participants
        .filter((participant) => participant.ownerName.toLowerCase().includes(loweredQuery))
        .map((participant) => ({
          date: raid.date,
          id: `${raid.id}-${participant.characterName}`,
          ownerName: participant.ownerName,
          raidName: raid.raidName,
          characterName: participant.characterName,
          time: raid.time,
        })),
    );
  }, [deferredSearchQuery, raids]);

  const searchGroups = useMemo(() => {
    const groupedResults = new Map();

    searchResults
      .slice()
      .sort(compareRaidTime)
      .forEach((item) => {
        if (!groupedResults.has(item.date)) groupedResults.set(item.date, []);
        groupedResults.get(item.date).push(item);
      });

    return Array.from(groupedResults.entries()).map(([date, items]) => ({
      date,
      label: formatDateLabel(date),
      items,
      startTime: getFirstStartTime(items),
    }));
  }, [searchResults]);

  return (
    <div className={styles.page}>
      <div className={styles.backdrop} />
      <div className={styles.content}>
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Lostark Weekly Planner</p>
            <h1>레이드 일정표</h1>
            <div className={styles.metaLine} aria-label="데이터 갱신 상태">
              <span>갱신 {formatFetchedAt(sourceMeta.fetchedAt)}</span>
              <span>{sourceMeta.isFallback ? "상태 더미 데이터" : "상태 실시간 시트"}</span>
            </div>
          </div>
        </header>

        <section className={styles.toolbar}>
          <div className={styles.tabs} role="tablist" aria-label="일정 보기 선택">
            {Object.entries(TAB_LABELS).map(([tabKey, label]) => (
              <button
                key={tabKey}
                type="button"
                role="tab"
                aria-selected={activeTab === tabKey}
                className={activeTab === tabKey ? styles.activeTab : styles.tab}
                onClick={() => setActiveTab(tabKey)}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === "search" ? (
            <RaidSearch value={searchQuery} onChange={setSearchQuery} styles={styles} />
          ) : (
            <div className={styles.summaryChips}>
              <div className={styles.chip}>
                <span>금일 일정</span>
                <strong>{todayRaids.length}개</strong>
              </div>
              <div className={styles.chip}>
                <span>주간 일정</span>
                <strong>{weeklyGroups.reduce((count, group) => count + group.raids.length, 0)}개</strong>
              </div>
              <div className={styles.chip}>
                <span>전체 레이드</span>
                <strong>{raids.length}개</strong>
              </div>
            </div>
          )}
        </section>

        {isLoading && <StatePanel styles={styles} message="레이드 일정을 불러오는 중입니다." />}

        {!isLoading && errorMessage ? (
          <div className={styles.errorBanner} role="alert">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && activeTab === "today" ? (
          <section className={styles.section}>
            <SectionHeading
              styles={styles}
              title={TAB_LABELS.today}
              subtitle={`${formatDateLabel(todayIsoDate)} 기준 일정`}
            />
            {todayRaids.length === 0 ? (
              <StatePanel styles={styles} message="일정이 없습니다." />
            ) : (
              <div className={styles.cardGrid}>
                {todayRaids.sort(compareRaidTime).map((raid) => (
                  <RaidCard
                    key={raid.id}
                    raid={raid}
                    styles={styles}
                    onCharacterClick={setSelectedCharacterName}
                  />
                ))}
              </div>
            )}
          </section>
        ) : null}

        {!isLoading && activeTab === "week" ? (
          <section className={styles.section}>
            <SectionHeading
              styles={styles}
              title={TAB_LABELS.week}
              subtitle={`${formatDateLabel(currentWeekRange.start)} ~ ${formatDateLabel(currentWeekRange.end)}`}
            />
            {weeklyGroups.length === 0 ? (
              <StatePanel styles={styles} message="일정이 없습니다." />
            ) : (
              <div className={styles.weekStack}>
                {weeklyGroups.map((group) => (
                  <details key={group.date} className={styles.dayGroup} open={group.date === todayIsoDate}>
                    <summary className={styles.dayHeader}>
                      <span className={styles.dayTitle}>{formatGroupTitle(group)}</span>
                      <span>{group.raids.length}개 일정</span>
                    </summary>
                    <div className={styles.cardGrid}>
                      {group.raids.map((raid) => (
                        <RaidCard
                          key={raid.id}
                          raid={raid}
                          styles={styles}
                          onCharacterClick={setSelectedCharacterName}
                        />
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {!isLoading && activeTab === "search" ? (
          <section className={styles.section}>
            <SectionHeading
              styles={styles}
              title={TAB_LABELS.search}
              subtitle="이름으로 참여 레이드를 요일별로 빠르게 찾을 수 있습니다."
            />
            {!deferredSearchQuery ? (
              <StatePanel styles={styles} message="이름을 입력해 주세요." />
            ) : searchResults.length === 0 ? (
              <StatePanel styles={styles} message="일정이 없습니다." />
            ) : (
              <div className={styles.weekStack}>
                {searchGroups.map((group) => (
                  <details key={group.date} className={styles.dayGroup}>
                    <summary className={styles.dayHeader}>
                      <span className={styles.dayTitle}>{formatGroupTitle(group)}</span>
                      <span>{group.items.length}개 결과</span>
                    </summary>
                    <div className={styles.searchResults}>
                      {group.items.map((item) => (
                        <article key={item.id} className={styles.searchResultCard}>
                          <div>
                            <h3>{item.raidName}</h3>
                          </div>
                          <dl className={styles.searchDetailList}>
                            <div>
                              <dt>참여 캐릭터</dt>
                              <dd>
                                <button
                                  type="button"
                                  className={styles.searchCharacterButton}
                                  onClick={() => setSelectedCharacterName(item.characterName)}
                                >
                                  {item.characterName}
                                </button>
                              </dd>
                            </div>
                            <div>
                              <dt>이름</dt>
                              <dd>{item.ownerName}</dd>
                            </div>
                          </dl>
                        </article>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>

      {selectedCharacterName ? (
        <CharacterDetailModal
          characterName={selectedCharacterName}
          onClose={() => setSelectedCharacterName("")}
          styles={styles}
        />
      ) : null}
    </div>
  );
}

function SectionHeading({ styles, title, subtitle }) {
  return (
    <header className={styles.sectionHeading}>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </header>
  );
}

function StatePanel({ styles, message }) {
  return (
    <div className={styles.statePanel}>
      <p>{message}</p>
    </div>
  );
}

function compareRaidTime(left, right) {
  return `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`);
}

function getFirstStartTime(items) {
  return items
    .map((item) => item.time)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))[0] || "";
}

function formatGroupTitle(group) {
  return group.startTime ? `${group.label} · ${group.startTime}` : group.label;
}

function formatFetchedAt(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}
