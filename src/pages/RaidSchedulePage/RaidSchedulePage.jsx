import { useDeferredValue, useEffect, useMemo, useState } from "react";
import styles from "./RaidSchedulePage.module.css";
import CharacterDetailModal from "./components/CharacterDetailModal.jsx";
import RaidCard from "./components/RaidCard.jsx";
import RaidSearch from "./components/RaidSearch.jsx";
import PersonalRaidPage from "../PersonalRaidPage/PersonalRaidPage.jsx";
import PersonalSchedulePage from "../PersonalSchedulePage/PersonalSchedulePage.jsx";
import {
  formatDateLabel,
  formatLocalDateTime,
  getScheduleDateKey,
  getScheduleStartAt,
  getTodayIsoDate,
  isInScheduleRange,
} from "./utils/dateUtils.js";
import { buildFallbackRaidSchedule, buildRaidSchedule } from "./utils/raidParser.js";
import { DEFAULT_SHEET_URL, DEFAULT_TARGET_GID, loadRaidSheetBundle } from "./utils/sheetApi.js";

const TAB_ORDER = ["today", "week", "personalRaid", "personal"];

const TAB_LABELS = {
  today: "금일 일정",
  week: "주간 일정",
  personal: "개인 일정",
  personalRaid: "레이드 참여 현황",
};

export default function RaidSchedulePage({ initialTab = "today" }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [raids, setRaids] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedCharacterName, setSelectedCharacterName] = useState("");
  const [selectedOwnerName, setSelectedOwnerName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceMeta, setSourceMeta] = useState({
    isFallback: false,
    fetchedAt: "",
    sourceUrl: DEFAULT_SHEET_URL,
  });

  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const todayIsoDate = useMemo(() => getTodayIsoDate(), []);
  const showOverviewStats = activeTab === "today" || activeTab === "week";

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    async function loadSchedule() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const bundle = await loadRaidSheetBundle({
          signal: controller.signal,
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
          fetchedAt: formatLocalDateTime(new Date()),
          isFallback: true,
          sourceUrl: DEFAULT_SHEET_URL,
        });
        setErrorMessage(
          error instanceof Error
            ? `시트 로딩에 실패했습니다. 잠시 후 다시 시도해주세요. ${error.message}`
            : "시트 로딩에 실패했습니다. 잠시 후 다시 시도해주세요.",
        );
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadSchedule();

    return () => {
      controller.abort();
      ignore = true;
    };
  }, [todayIsoDate]);

  const todayRaids = useMemo(
    () =>
      raids.filter((raid) => {
        const startAt = raid.startAt || getScheduleStartAt(raid.date, raid.time || raid.blockTime);
        if (startAt) {
          return isInScheduleRange(startAt, todayIsoDate);
        }

        return getScheduleDateKey(raid.date, raid.time || raid.blockTime) === todayIsoDate;
      }),
    [raids, todayIsoDate],
  );

  const todayOwnerNames = useMemo(() => {
    const ownerNames = todayRaids.flatMap((raid) =>
      raid.participants.map((participant) => participant.ownerName?.trim()).filter(Boolean),
    );

    return [...new Set(ownerNames)];
  }, [todayRaids]);

  const groupedRaids = useMemo(() => groupItemsByDate(raids), [raids]);
  const todayGroup = useMemo(
    () => groupedRaids.find((group) => group.date === todayIsoDate),
    [groupedRaids, todayIsoDate],
  );
  const todayStartTime = useMemo(
    () => todayGroup?.blockTime || todayGroup?.time || todayRaids?.[0]?.blockTime || todayRaids?.[0]?.time || "",
    [todayGroup, todayRaids],
  );

  const searchResults = useMemo(() => {
    if (!deferredSearchQuery) return [];

    const loweredQuery = deferredSearchQuery.toLowerCase();

    return raids.flatMap((raid) =>
      raid.participants
        .filter(
          (participant) =>
            participant.ownerName.toLowerCase().includes(loweredQuery) ||
            participant.characterName.toLowerCase().includes(loweredQuery),
        )
        .map((participant) => ({
          date: raid.date,
          id: `${raid.id}-${participant.characterName}`,
          ownerName: participant.ownerName,
          raidName: raid.raidName,
          characterName: participant.characterName,
          startCol: raid.startCol,
          startRow: raid.startRow,
          time: raid.time,
        })),
    );
  }, [deferredSearchQuery, raids]);

  const searchGroups = useMemo(() => groupItemsByDate(searchResults), [searchResults]);
  const sortedTodayRaids = useMemo(() => [...todayRaids].sort(compareRaidOrder), [todayRaids]);

  return (
    <div className={styles.page}>
      <div className={styles.backdrop} />
      <div className={styles.content}>
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>LostArk Weekly Planner</p>
            <h1>Stick Over Flow</h1>
            <div className={styles.metaLine} aria-label="데이터 갱신 상태">
              <span>갱신 {formatFetchedAt(sourceMeta.fetchedAt)}</span>
              <span
                className={`${styles.connectionStatus} ${
                  sourceMeta.isFallback ? styles.connectionOffline : styles.connectionOnline
                }`}
              >
                <span className={styles.connectionStatusDot} aria-hidden="true" />
                {sourceMeta.isFallback ? "Disconnected" : "Connected"}
              </span>
            </div>
          </div>
        </header>

        <section className={styles.toolbar}>
          <div className={styles.tabs} role="tablist" aria-label="일정 보기 선택">
            {TAB_ORDER.map((tabKey) => (
              <button
                key={tabKey}
                type="button"
                role="tab"
                aria-selected={activeTab === tabKey}
                className={activeTab === tabKey ? styles.activeTab : styles.tab}
                onClick={() => setActiveTab(tabKey)}
              >
                {TAB_LABELS[tabKey]}
              </button>
            ))}
          </div>

          <div
            className={`${styles.summaryChips} ${showOverviewStats ? "" : styles.summaryChipsPlaceholder}`}
            aria-hidden={!showOverviewStats}
          >
            {showOverviewStats ? (
              <>
              <div className={styles.chip}>
                <span>금일 일정</span>
                <strong>{todayRaids.length}개</strong>
              </div>
              <div className={styles.chip}>
                <span>전체 일정</span>
                <strong>{raids.length}개</strong>
              </div>
              <div className={styles.chip}>
                <span>전체 캐릭</span>
                <strong>{countUniqueCharacters(raids)}명</strong>
              </div>
              </>
            ) : null}
          </div>
        </section>

        {isLoading && (activeTab === "today" || activeTab === "week") ? (
          <StatePanel styles={styles} message="레이드 일정을 불러오는 중입니다." />
        ) : null}

        {!isLoading && errorMessage && (activeTab === "today" || activeTab === "week") ? (
          <div className={styles.errorBanner} role="alert">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && activeTab === "today" ? (
          <section className={`${styles.section} ${styles.pageSection} ${styles.todaySchedule}`}>
            <SectionHeading
              styles={styles}
              title={TAB_LABELS.today}
              subtitle={`${formatDateLabel(todayIsoDate)} 기준 일정`}
              meta={todayRaids.length ? <TimeMetaBadge styles={styles} value={todayStartTime || "시간 미정"} /> : ""}
            />
            <TodayParticipantList
              ownerNames={todayOwnerNames}
              selectedOwnerName={selectedOwnerName}
              onSelectOwnerName={setSelectedOwnerName}
              styles={styles}
            />
            {sortedTodayRaids.length === 0 ? (
              <StatePanel styles={styles} message="금일 일정이 없습니다." />
            ) : (
              <div className={styles.cardGrid}>
                {sortedTodayRaids.map((raid) => {
                  const isHighlighted =
                    Boolean(selectedOwnerName) &&
                    raid.participants.some((participant) => participant.ownerName === selectedOwnerName);

                  return (
                    <RaidCard
                      key={raid.id}
                      raid={raid}
                      styles={styles}
                      onCharacterClick={setSelectedCharacterName}
                      collapsible
                      isHighlighted={isHighlighted}
                      selectedOwnerName={selectedOwnerName}
                    />
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {!isLoading && activeTab === "week" ? (
          <section className={`${styles.section} ${styles.pageSection}`}>
            <SectionHeading styles={styles} title={TAB_LABELS.week} subtitle="요일별 레이드 일정" />
            <div className={styles.weekSearchBox}>
              <RaidSearch value={searchQuery} onChange={setSearchQuery} styles={styles} />
            </div>

            {deferredSearchQuery ? (
              searchGroups.length === 0 ? (
                <StatePanel styles={styles} message="검색 결과가 없습니다." />
              ) : (
                <div className={styles.weekStack}>
                  {searchGroups.map((group) => (
                    <details key={group.id} className={styles.dayGroup}>
                      <summary className={styles.dayHeader}>
                        <span className={styles.dayTitle}>{group.label}</span>
                        <span className={styles.dayHeaderMeta}>
                          <TimeMetaBadge styles={styles} value={formatGroupTime(group)} className={styles.dayTimeBadge} />
                          <span>{group.items.length}개 결과</span>
                        </span>
                      </summary>
                      <div className={`${styles.searchResults} ${styles.weeklySearchResult}`}>
                        {group.items.map((item) => (
                          <article key={item.id} className={styles.searchResultCard}>
                            <div>
                              <h3>{item.raidName}</h3>
                            </div>
                            <div className={styles.searchInlineMeta}>
                              <div className={styles.searchInlineField}>
                                <span>참여 캐릭터</span>
                                <button
                                  type="button"
                                  className={styles.searchCharacterButton}
                                  onClick={() => setSelectedCharacterName(item.characterName)}
                                >
                                  {item.characterName}
                                </button>
                              </div>
                              <div className={styles.searchInlineField}>
                                <span>이름</span>
                                <strong>{item.ownerName}</strong>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )
            ) : groupedRaids.length === 0 ? (
              <StatePanel styles={styles} message="일정이 없습니다." />
            ) : (
              <div className={styles.weekStack}>
                {groupedRaids.map((group) => (
                  <details key={group.id} className={styles.dayGroup}>
                    <summary className={styles.dayHeader}>
                      <span className={styles.dayTitle}>{group.label}</span>
                      <span className={styles.dayHeaderMeta}>
                        <TimeMetaBadge styles={styles} value={formatGroupTime(group)} className={styles.dayTimeBadge} />
                        <span>{group.items.length}개 일정</span>
                      </span>
                    </summary>
                    <div className={styles.cardGrid}>
                      {group.items.map((raid) => (
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

        {activeTab === "personal" ? (
          <section className={`${styles.section} ${styles.pageSection}`}>
            <PersonalSchedulePage embedded />
          </section>
        ) : null}
        {activeTab === "personalRaid" ? (
          <section className={`${styles.section} ${styles.pageSection}`}>
            <PersonalRaidPage embedded />
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

function TodayParticipantList({ ownerNames, selectedOwnerName, onSelectOwnerName, styles }) {
  return (
    <section className={styles.todayParticipantPanel} aria-labelledby="today-participant-title">
      <div className={styles.todayParticipantHeader}>
        <h3 id="today-participant-title">금일 참여자 목록</h3>
        <span>{ownerNames.length}명</span>
      </div>
      {ownerNames.length ? (
        <div className={styles.todayParticipantBadges}>
          {ownerNames.map((ownerName) => (
            <button
              key={ownerName}
              type="button"
              className={`${styles.todayParticipantBadge} ${
                selectedOwnerName === ownerName ? styles.activeTodayParticipantBadge : ""
              }`}
              onClick={() => onSelectOwnerName(selectedOwnerName === ownerName ? "" : ownerName)}
            >
              {ownerName}
            </button>
          ))}
        </div>
      ) : (
        <p className={styles.todayParticipantEmpty}>금일 참여자가 없습니다.</p>
      )}
    </section>
  );
}

function SectionHeading({ styles, title, subtitle, meta = "" }) {
  return (
    <header className={styles.sectionHeading}>
      <div className={styles.sectionHeadingTopRow}>
        <h2>{title}</h2>
        {meta ? <span className={styles.sectionHeadingMeta}>{meta}</span> : null}
      </div>
      <p className={styles.sectionHeadingDescription}>{subtitle}</p>
    </header>
  );
}

function TimeMetaBadge({ styles, value, className = styles.sectionHeadingMeta }) {
  return (
    <span className={className}>
      <svg
        aria-hidden="true"
        className={styles.timeMetaIcon}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M7.05 3.05L4.22 5.88M16.95 3.05L19.78 5.88M12 8.25C8.82 8.25 6.25 10.82 6.25 14C6.25 17.18 8.82 19.75 12 19.75C15.18 19.75 17.75 17.18 17.75 14C17.75 10.82 15.18 8.25 12 8.25ZM12 11.25V14.1L14.15 15.55M8.25 20.95L7.15 22.05M15.75 20.95L16.85 22.05"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
      <span>{value}</span>
    </span>
  );
}

function StatePanel({ styles, message }) {
  return (
    <div className={styles.statePanel}>
      <p>{message}</p>
    </div>
  );
}

function groupItemsByDate(items) {
  const groups = new Map();

  items
    .slice()
    .sort(compareRaidOrder)
    .forEach((item) => {
      const dateKey = getScheduleDateKey(item.startAt || item.date, item.time || item.blockTime) || "unscheduled";

      if (!groups.has(dateKey)) {
        groups.set(dateKey, {
          date: dateKey,
          id: dateKey,
          label: item.date ? formatDateLabel(item.date) : "날짜 미정",
          time: "",
          items: [],
        });
      }

      groups.get(dateKey).items.push(item);
    });

  const grouped = Array.from(groups.values());
  grouped.forEach((group) => {
    group.blockTime = resolveGroupBlockTime(group.items);
    group.time = group.blockTime;
  });

  return grouped.sort((left, right) => `${left.date}`.localeCompare(`${right.date}`));
}

function resolveGroupBlockTime(items = []) {
  const times = items
    .map((item) => item.time || item.blockTime || "")
    .map((value) => String(value || "").trim())
    .filter((value) => Boolean(value) && value !== "시간 미정");

  if (!times.length) return "";

  return [...new Set(times)].sort((left, right) => left.localeCompare(right))[0] || "";
}

function countUniqueCharacters(raids) {
  const names = new Set();

  raids.forEach((raid) => {
    raid.participants.forEach((participant) => {
      if (participant.characterName) names.add(participant.characterName);
    });
  });

  return names.size;
}

function compareRaidOrder(left, right) {
  const leftDate = left.date || "9999-12-31";
  const rightDate = right.date || "9999-12-31";

  if (leftDate !== rightDate) {
    return leftDate.localeCompare(rightDate);
  }

  if ((left.startCol ?? 0) !== (right.startCol ?? 0)) {
    return (left.startCol ?? 0) - (right.startCol ?? 0);
  }

  return (left.startRow ?? 0) - (right.startRow ?? 0);
}

function formatGroupTime(group) {
  return group.time || "시간 미정";
}

function formatFetchedAt(value) {
  if (!value) return "-";
  return String(value);
}
