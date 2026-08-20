import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import styles from "./RaidSchedulePage.module.css";
import AuctionBidSidebar from "./components/AuctionBidSidebar.jsx";
import RaidCard from "./components/RaidCard.jsx";
import {
  formatDateLabel,
  formatLocalDate,
  formatLocalDateTime,
  getScheduleDateKey,
  getScheduleStartAt,
  getTodayIsoDate,
  isInScheduleRange,
} from "./utils/dateUtils.js";
import { buildFallbackRaidSchedule, buildRaidSchedule } from "./utils/raidParser.js";
import {
  findUpdatedRaidKeys,
  getRaidTrackingKey,
  markRaidAsSeen,
} from "./utils/raidUpdateTracker.js";
import { DEFAULT_SHEET_URL, DEFAULT_TARGET_GID, loadRaidSheetBundle } from "./utils/sheetApi.js";

const loadAuctionBidCalculator = () => import("./components/AuctionBidCalculator.jsx");
const loadCharacterDetailModal = () => import("./components/CharacterDetailModal.jsx");
const loadPersonalRaidPage = () => import("../PersonalRaidPage/PersonalRaidPage.jsx");
const loadPersonalSchedulePage = () => import("../PersonalSchedulePage/PersonalSchedulePage.jsx");

const AuctionBidCalculator = lazy(loadAuctionBidCalculator);
const CharacterDetailModal = lazy(loadCharacterDetailModal);
const PersonalRaidPage = lazy(loadPersonalRaidPage);
const PersonalSchedulePage = lazy(loadPersonalSchedulePage);

const TAB_ORDER = ["today", "week", "auction", "personalRaid", "personal"];

const TAB_LABELS = {
  today: "금일 일정",
  week: "주간 일정",
  auction: "쌀산기",
  personal: "개인 일정",
  personalRaid: "레이드 참여 현황",
};

export default function RaidSchedulePage({ initialTab = "today" }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [weeklyViewMode, setWeeklyViewMode] = useState("list");
  const [raids, setRaids] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedCharacterName, setSelectedCharacterName] = useState("");
  const [selectedOwnerName, setSelectedOwnerName] = useState("");
  const [selectedWeeklyParticipant, setSelectedWeeklyParticipant] = useState("");
  const [selectedCalendarRaid, setSelectedCalendarRaid] = useState(null);
  const [updatedRaidKeys, setUpdatedRaidKeys] = useState(() => new Set());
  const raidSignatureRef = useRef("");
  const [sourceMeta, setSourceMeta] = useState({
    isFallback: false,
    fetchedAt: "",
    sourceUrl: DEFAULT_SHEET_URL,
  });

  const todayIsoDate = useMemo(() => getTodayIsoDate(), []);
  const showOverviewStats = activeTab === "today" || activeTab === "week";

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const preloadDeferredViews = () => {
      loadAuctionBidCalculator();
      loadCharacterDetailModal();
      loadPersonalRaidPage();
      loadPersonalSchedulePage();
    };
    const idleId = window.requestIdleCallback?.(preloadDeferredViews, { timeout: 3000 });
    const timerId = idleId == null ? window.setTimeout(preloadDeferredViews, 1500) : null;

    return () => {
      if (idleId != null) window.cancelIdleCallback?.(idleId);
      if (timerId != null) window.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    let refreshInFlight = false;
    const controller = new AbortController();

    async function loadSchedule({ background = false } = {}) {
      if (refreshInFlight) return;

      refreshInFlight = true;
      if (!background) {
        setIsLoading(true);
        setErrorMessage("");
      }

      try {
        const bundle = await loadRaidSheetBundle({
          forceRefresh: background,
          signal: controller.signal,
          sheetUrl: DEFAULT_SHEET_URL,
          targetGid: DEFAULT_TARGET_GID,
        });
        const normalizedRaids = buildRaidSchedule(bundle);
        const nextRaidSignature = JSON.stringify(normalizedRaids);

        if (!ignore) {
          if (raidSignatureRef.current !== nextRaidSignature) {
            raidSignatureRef.current = nextRaidSignature;
            setUpdatedRaidKeys(findUpdatedRaidKeys(normalizedRaids));
            setRaids(normalizedRaids);
          }
          setSourceMeta({
            fetchedAt: bundle.fetchedAt,
            isFallback: false,
            sourceUrl: bundle.sourceUrl,
          });
          setErrorMessage("");
        }
      } catch (error) {
        if (ignore) return;

        if (background) return;

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
        refreshInFlight = false;
        if (!ignore && !background) setIsLoading(false);
      }
    }

    loadSchedule();

    const refreshSchedule = () => {
      if (document.visibilityState === "visible") {
        loadSchedule({ background: true });
      }
    };
    const refreshTimer = window.setInterval(refreshSchedule, 30 * 1000);
    document.addEventListener("visibilitychange", refreshSchedule);

    return () => {
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", refreshSchedule);
      controller.abort();
      ignore = true;
    };
  }, [todayIsoDate]);

  function handleRaidOpen(raid) {
    const seenKey = markRaidAsSeen(raid);
    setUpdatedRaidKeys((current) => {
      if (!current.has(seenKey)) return current;
      const next = new Set(current);
      next.delete(seenKey);
      return next;
    });
  }

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
  const todayStartTime = useMemo(() => {
    const now = new Date();
    const raidsWithStart = todayRaids
      .map((raid) => ({
        startAt: raid.startAt || getScheduleStartAt(raid.date, raid.time || raid.blockTime),
        time: String(raid.time || raid.blockTime || "").trim(),
      }))
      .filter((raid) => raid.time && raid.startAt instanceof Date && !Number.isNaN(raid.startAt.getTime()))
      .sort((left, right) => left.startAt.getTime() - right.startAt.getTime());

    if (raidsWithStart.length === 0) {
      return { status: "none", value: "예정된 일정 없음" };
    }

    const currentRaid = raidsWithStart[0];
    const status = getStartTimeStatus(currentRaid.startAt, now);

    return {
      isStartingSoon: status === "soon",
      status,
      statusLabel: status === "general" ? "" : getStartTimeStatusLabel(status),
      value: currentRaid.time,
    };
  }, [todayRaids]);
  const deferredSearchQuery = selectedWeeklyParticipant;
  const weeklyParticipantNames = useMemo(() => {
    const names = raids.flatMap((raid) =>
      raid.participants.map((participant) => participant.ownerName?.trim()).filter(Boolean),
    );

    return [...new Set(names)].sort((left, right) => left.localeCompare(right, "ko"));
  }, [raids]);
  const weeklySelectedResults = useMemo(() => {
    if (!selectedWeeklyParticipant) return [];

    const groupedResults = new Map();

    raids.forEach((raid) => {
      raid.participants
        .filter((participant) => participant.ownerName === selectedWeeklyParticipant)
        .forEach((participant) => {
          const groupKey = `${raid.date}-${participant.ownerName}-${participant.characterName}`;
          const existing = groupedResults.get(groupKey);

          if (existing) {
            if (!existing.raids.includes(raid.raidName)) {
              existing.raids.push(raid.raidName);
            }
            return;
          }

          groupedResults.set(groupKey, {
            date: raid.date,
            id: `${raid.date}-${participant.ownerName}-${participant.characterName}`,
            ownerName: participant.ownerName,
            characterName: participant.characterName,
            raids: [raid.raidName],
            startCol: raid.startCol,
            startRow: raid.startRow,
            time: raid.time,
          });
        });
    });

    return Array.from(groupedResults.values());
  }, [raids, selectedWeeklyParticipant]);
  const weeklySelectedGroups = useMemo(() => groupItemsByDate(weeklySelectedResults), [weeklySelectedResults]);
  const weeklyCalendarDays = useMemo(
    () => buildWeeklyCalendarDays(raids, todayIsoDate),
    [raids, todayIsoDate],
  );
  const searchGroups = weeklySelectedGroups;
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
          <a
            className={styles.sheetLinkButton}
            href={sourceMeta.sourceUrl || DEFAULT_SHEET_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Google 시트 새 창에서 열기"
          >
            시트 열기
          </a>
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

        <main>
          {!isLoading && activeTab === "today" ? (
            <section className={`${styles.section} ${styles.pageSection} ${styles.todaySchedule}`}>
              <SectionHeading
                styles={styles}
                title={TAB_LABELS.today}
                subtitle={`${formatDateLabel(todayIsoDate)} 기준 일정`}
                meta={<TimeMetaBadge styles={styles} value={todayStartTime} />}
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
                        isUpdated={updatedRaidKeys.has(getRaidTrackingKey(raid))}
                        onOpen={handleRaidOpen}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}

          {!isLoading && activeTab === "week" ? (
            <section className={`${styles.section} ${styles.pageSection}`}>
              <SectionHeading
                styles={styles}
                title={TAB_LABELS.week}
                subtitle="요일별 레이드 일정"
                meta={
                  <WeekViewToggle styles={styles} value={weeklyViewMode} onChange={setWeeklyViewMode} />
                }
              />
              <WeeklyParticipantList
                ownerNames={weeklyParticipantNames}
                selectedOwnerName={selectedWeeklyParticipant}
                onSelectOwnerName={setSelectedWeeklyParticipant}
                styles={styles}
              />

              {weeklyViewMode === "calendar" ? (
                weeklyCalendarDays.some((day) => day.items.length > 0) ? (
                  <div className={styles.weekCalendarGrid}>
                    {weeklyCalendarDays.map((day) => (
                      <section key={day.dateKey} className={styles.weekCalendarDay}>
                        <header className={styles.weekCalendarDayHeader}>
                          <div className={styles.weekCalendarDayHeaderMain}>
                            <span className={styles.weekCalendarDayLabel}>{day.label}</span>
                            <strong className={styles.weekCalendarDayDate}>{day.dateLabel}</strong>
                          </div>
                          {day.startTime ? (
                            <span className={styles.weekCalendarDayStartTime}>{day.startTime}</span>
                          ) : (
                            <span className={styles.weekCalendarDayStartTime}>시간 미정</span>
                          )}
                        </header>
                        {day.items.length ? (
                          <div className={styles.weekCalendarDayList}>
                            {day.items.map((raid) => {
                              const isHighlighted =
                                Boolean(selectedWeeklyParticipant) &&
                                raid.participants.some(
                                  (participant) => participant.ownerName === selectedWeeklyParticipant,
                                );

                              return (
                                <article
                                  key={raid.id}
                                  className={`${styles.weekCalendarDayCard} ${
                                    isHighlighted ? styles.weekCalendarDayCardHighlighted : ""
                                  }`}
                                  onClick={() => setSelectedCalendarRaid(raid)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      setSelectedCalendarRaid(raid);
                                    }
                                  }}
                                  role="button"
                                  tabIndex={0}
                                >
                                  <div className={styles.weekCalendarDayCardTop}>
                                    <strong className={styles.weekCalendarDayCardTitle}>{raid.raidName}</strong>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        ) : (
                          <p className={styles.weekCalendarDayEmpty}>일정 없음</p>
                        )}
                      </section>
                    ))}
                  </div>
                ) : (
                  <StatePanel styles={styles} message="이번 주 일정이 없습니다." />
                )
              ) : deferredSearchQuery ? (
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
                              <div className={styles.searchInlineMeta}>
                                <div className={`${styles.searchInlineField} ${styles.searchCharacterField}`}>
                                  <span>참여 캐릭터</span>
                                  <button
                                    type="button"
                                    className={styles.searchCharacterButton}
                                    onClick={() => setSelectedCharacterName(item.characterName)}
                                  >
                                    {item.characterName}
                                  </button>
                                </div>
                                <div className={`${styles.searchInlineField} ${styles.searchOwnerField}`}>
                                  <span>이름</span>
                                  <strong>{item.ownerName}</strong>
                                </div>
                              </div>
                              <div className={styles.searchRaidList}>
                                {item.raids?.map((raidName) => (
                                  <span key={`${item.id}-${raidName}`} className={styles.searchRaidPill}>
                                    {raidName}
                                  </span>
                                ))}
                              </div>
                              <div className={styles.searchMobileRaidRows}>
                                {item.raids?.map((raidName) => (
                                  <div key={`${item.id}-mobile-${raidName}`} className={styles.searchMobileRaidRow}>
                                    <button
                                      type="button"
                                      className={`${styles.searchCharacterButton} ${styles.searchMobileCharacterButton}`}
                                      onClick={() => setSelectedCharacterName(item.characterName)}
                                    >
                                      {item.characterName}
                                    </button>
                                    <span className={styles.searchMobileRaidName}>{raidName}</span>
                                  </div>
                                ))}
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
                        {group.items.map((raid) => {
                          const isHighlighted =
                            Boolean(selectedWeeklyParticipant) &&
                            raid.participants.some(
                              (participant) => participant.ownerName === selectedWeeklyParticipant,
                            );

                          return (
                            <RaidCard
                              key={raid.id}
                              raid={raid}
                              styles={styles}
                              onCharacterClick={setSelectedCharacterName}
                              isHighlighted={isHighlighted}
                              selectedOwnerName={selectedWeeklyParticipant}
                            />
                          );
                        })}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {activeTab === "auction" ? (
            <section className={`${styles.section} ${styles.pageSection}`}>
              <Suspense fallback={<StatePanel styles={styles} message="쌀산기를 불러오는 중입니다." />}>
                <AuctionBidCalculator />
              </Suspense>
            </section>
          ) : null}

          {activeTab === "personal" ? (
            <section className={`${styles.section} ${styles.pageSection}`}>
              <Suspense fallback={<StatePanel styles={styles} message="개인 일정을 불러오는 중입니다." />}>
                <PersonalSchedulePage embedded />
              </Suspense>
            </section>
          ) : null}
          {activeTab === "personalRaid" ? (
            <section className={`${styles.section} ${styles.pageSection}`}>
              <Suspense fallback={<StatePanel styles={styles} message="레이드 참여 현황을 불러오는 중입니다." />}>
                <PersonalRaidPage embedded />
              </Suspense>
            </section>
          ) : null}
        </main>

        {activeTab === "today" || activeTab === "week" ? (
          <aside className={styles.auctionFloatingSidebar} aria-label="쌀산기">
            <AuctionBidSidebar />
          </aside>
        ) : null}
      </div>

      {selectedCharacterName ? (
        <Suspense fallback={null}>
          <CharacterDetailModal
            characterName={selectedCharacterName}
            onClose={() => setSelectedCharacterName("")}
            styles={styles}
          />
        </Suspense>
      ) : null}

      {selectedCalendarRaid ? (
        <CalendarRaidModal
          raid={selectedCalendarRaid}
          onCharacterClick={setSelectedCharacterName}
          onClose={() => setSelectedCalendarRaid(null)}
          styles={styles}
        />
      ) : null}
    </div>
  );
}

function CalendarRaidModal({ raid, onCharacterClick, onClose, styles }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    const scrollY = window.scrollY;
    const previousBodyStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.documentElement.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyStyles.overflow;
      document.body.style.position = previousBodyStyles.position;
      document.body.style.top = previousBodyStyles.top;
      document.body.style.width = previousBodyStyles.width;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      window.scrollTo(0, scrollY);
    };
  }, []);

  return (
    <div className={styles.calendarRaidModalOverlay} onClick={onClose}>
      <section
        className={styles.calendarRaidModalShell}
        role="dialog"
        aria-modal="true"
        aria-label={`${raid.raidName} 상세 일정`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.calendarRaidModalHeader}>
          <div>
            <span>{raid.date ? formatDateLabel(raid.date) : "날짜 미정"}</span>
            <strong>{raid.time || raid.blockTime || "시간 미정"}</strong>
          </div>
          <button type="button" className={styles.detailToggleButton} onClick={onClose}>
            닫기
          </button>
        </header>
        <div className={styles.calendarRaidModalBody}>
          <RaidCard raid={raid} styles={styles} onCharacterClick={onCharacterClick} />
        </div>
      </section>
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

function WeeklyParticipantList({ ownerNames, selectedOwnerName, onSelectOwnerName, styles }) {
  return (
    <section className={styles.todayParticipantPanel} aria-labelledby="weekly-participant-title">
      <div className={styles.todayParticipantHeader}>
        <h3 id="weekly-participant-title">주간 참여자 인원</h3>
        <span>{ownerNames.length}명</span>
      </div>
      {ownerNames.length ? (
        <div className={styles.todayParticipantBadges}>
          <button
            type="button"
            className={`${styles.todayParticipantBadge} ${selectedOwnerName ? "" : styles.activeTodayParticipantBadge}`}
            onClick={() => onSelectOwnerName("")}
          >
            전체
          </button>
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
        <p className={styles.todayParticipantEmpty}>주간 참여자가 없습니다.</p>
      )}
    </section>
  );
}

function SectionHeading({ styles, title, subtitle, meta = "" }) {
  return (
    <header className={styles.sectionHeading}>
      <div className={styles.sectionHeadingTopRow}>
        <h2>{title}</h2>
        {meta ? (typeof meta === "string" ? <span className={styles.sectionHeadingMeta}>{meta}</span> : meta) : null}
      </div>
      <p className={styles.sectionHeadingDescription}>{subtitle}</p>
    </header>
  );
}

function TimeMetaBadge({ styles, value, className = styles.sectionHeadingMeta }) {
  if (value && typeof value === "object") {
    return (
      <div
        className={`${styles.startTimeCompact} ${value.isStartingSoon ? styles.startTimeCompactActive : ""}`}
      >
        <div className={styles.startTimeCompactValue}>
          <span className={styles.startTimeCompactIcon}>
            <svg
              aria-hidden="true"
              className={styles.startTimeCompactMainIcon}
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
          </span>
          <strong>{value.value}</strong>
          {value.statusLabel && value.statusLabel !== "일반" ? (
            <span className={styles.startTimeCompactSoonBadge}>{value.statusLabel}</span>
          ) : null}
        </div>
      </div>
    );
  }

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

function StartTimeSpotlight({ raid, styles }) {
  const displayTime = String(raid?.time || raid?.blockTime || "").trim();
  const startAt = displayTime ? raid.startAt || getScheduleStartAt(raid.date, displayTime) : null;
  const status = displayTime && startAt ? getStartTimeStatus(startAt) : "none";
  const statusLabel = status === "general" ? "" : getStartTimeStatusLabel(status);

  return (
    <section className={styles.startTimeSpotlight} aria-label="시작시간">
      <div className={styles.startTimeSpotlightHeader}>
        <span className={styles.startTimeSpotlightLabel}>시작시간</span>
      </div>
      <div className={styles.startTimeSpotlightContent}>
        <div className={styles.startTimeSpotlightIconShell}>
          <svg
            aria-hidden="true"
            className={styles.startTimeSpotlightIcon}
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
        </div>
        <div className={styles.startTimeSpotlightMain}>
          <strong className={styles.startTimeSpotlightValue}>{displayTime || "예정된 일정 없음"}</strong>
          {statusLabel && statusLabel !== "일반" ? <span className={styles.startTimeSoonBadge}>{statusLabel}</span> : null}
        </div>
      </div>
    </section>
  );
}

function WeekViewToggle({ styles, value, onChange }) {
  return (
    <div className={styles.weekViewToggle} role="group" aria-label="주간 보기 모드">
      <button
        type="button"
        className={`${styles.weekViewToggleButton} ${value === "list" ? styles.weekViewToggleButtonActive : ""}`}
        aria-label="리스트 모드"
        title="리스트 모드"
        onClick={() => onChange("list")}
      >
        <svg
          aria-hidden="true"
          className={styles.weekViewToggleIcon}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 6H20M8 12H20M8 18H20M4 6H4.01M4 12H4.01M4 18H4.01"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        className={`${styles.weekViewToggleButton} ${value === "calendar" ? styles.weekViewToggleButtonActive : ""}`}
        aria-label="캘린더 모드"
        title="캘린더 모드"
        onClick={() => onChange("calendar")}
      >
        <svg
          aria-hidden="true"
          className={styles.weekViewToggleIcon}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M7 3V5M17 3V5M4.5 9H19.5M6 7H18C19.1046 7 20 7.89543 20 9V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V9C4 7.89543 4.89543 7 6 7Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
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
          label: item.date ? formatDateLabel(item.date) : "날짜 미지정",
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

function getStartTimeStatus(startAt, now = new Date()) {
  if (!(startAt instanceof Date) || Number.isNaN(startAt.getTime())) return "none";
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return "none";

  const diffMinutes = (startAt.getTime() - now.getTime()) / 1000 / 60;
  if (diffMinutes < 0) return "general";
  if (diffMinutes <= 60) return "soon";
  return "scheduled";
}

function getStartTimeStatusLabel(status) {
  switch (status) {
    case "soon":
      return "곧 시작";
    case "general":
      return "일반";
    case "scheduled":
      return "예정";
    default:
      return "";
  }
}

function buildWeeklyCalendarDays(raids, todayIsoDate) {
  const weekStart = getWeekStartDate(todayIsoDate);

  const raidsByDateKey = new Map();

  raids.forEach((raid) => {
    const dateKey = getScheduleDateKey(raid.startAt || raid.date, raid.time || raid.blockTime);
    if (!dateKey) return;

    if (!raidsByDateKey.has(dateKey)) {
      raidsByDateKey.set(dateKey, []);
    }

    raidsByDateKey.get(dateKey).push(raid);
  });

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    const dateKey = formatLocalDate(date);
    const items = (raidsByDateKey.get(dateKey) || []).slice().sort(compareRaidOrder);

    return {
      dateKey,
      dateLabel: `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`,
      startTime: resolveGroupBlockTime(items),
      items,
      label: WEEKDAY_LABELS[date.getDay()],
    };
  });
}

function getWeekStartDate(dateValue) {
  const baseDate = parseIsoDateToLocalDate(dateValue) || new Date();
  const day = baseDate.getDay();
  const diffToWednesday = -((day - 3 + 7) % 7);
  const weekStart = new Date(baseDate);
  weekStart.setDate(baseDate.getDate() + diffToWednesday);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function parseIsoDateToLocalDate(dateValue) {
  const text = String(dateValue || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
