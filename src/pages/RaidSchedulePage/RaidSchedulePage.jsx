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
import { findUpdatedRaidKeys, getRaidTrackingKey, markRaidAsSeen } from "./utils/raidUpdateTracker.js";
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
const TAB_LABELS = { today: "금일 일정", week: "주간 일정", auction: "쌀산기", personal: "개인 일정", personalRaid: "레이드 참여 현황" };

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
  const [sourceMeta, setSourceMeta] = useState({ isFallback: false, fetchedAt: "", sourceUrl: DEFAULT_SHEET_URL });
  const todayIsoDate = useMemo(() => getTodayIsoDate(), []);
  const showOverviewStats = activeTab === "today" || activeTab === "week";

  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);
  useEffect(() => {
    const preloadDeferredViews = () => { loadAuctionBidCalculator(); loadCharacterDetailModal(); loadPersonalRaidPage(); loadPersonalSchedulePage(); };
    const idleId = window.requestIdleCallback?.(preloadDeferredViews, { timeout: 3000 });
    const timerId = idleId == null ? window.setTimeout(preloadDeferredViews, 1500) : null;
    return () => { if (idleId != null) window.cancelIdleCallback?.(idleId); if (timerId != null) window.clearTimeout(timerId); };
  }, []);
  useEffect(() => {
    let ignore = false; let refreshInFlight = false; const controller = new AbortController();
    async function loadSchedule({ background = false } = {}) {
      if (refreshInFlight) return; refreshInFlight = true;
      if (!background) { setIsLoading(true); setErrorMessage(""); }
      try {
        const bundle = await loadRaidSheetBundle({ forceRefresh: background, signal: controller.signal, sheetUrl: DEFAULT_SHEET_URL, targetGid: DEFAULT_TARGET_GID });
        const normalizedRaids = buildRaidSchedule(bundle); const nextRaidSignature = JSON.stringify(normalizedRaids);
        if (!ignore) {
          if (raidSignatureRef.current !== nextRaidSignature) { raidSignatureRef.current = nextRaidSignature; setUpdatedRaidKeys(findUpdatedRaidKeys(normalizedRaids)); setRaids(normalizedRaids); }
          setSourceMeta({ fetchedAt: bundle.fetchedAt, isFallback: false, sourceUrl: bundle.sourceUrl }); setErrorMessage("");
        }
      } catch (error) {
        if (ignore || background) return;
        setRaids(buildFallbackRaidSchedule(todayIsoDate)); setSourceMeta({ fetchedAt: formatLocalDateTime(new Date()), isFallback: true, sourceUrl: DEFAULT_SHEET_URL });
        setErrorMessage(error instanceof Error ? `시트 로딩에 실패했습니다. 잠시 후 다시 시도해주세요. ${error.message}` : "시트 로딩에 실패했습니다. 잠시 후 다시 시도해주세요.");
      } finally { refreshInFlight = false; if (!ignore && !background) setIsLoading(false); }
    }
    loadSchedule();
    const refreshSchedule = () => { if (document.visibilityState === "visible") loadSchedule({ background: true }); };
    const refreshTimer = window.setInterval(refreshSchedule, 30 * 1000); document.addEventListener("visibilitychange", refreshSchedule);
    return () => { window.clearInterval(refreshTimer); document.removeEventListener("visibilitychange", refreshSchedule); controller.abort(); ignore = true; };
  }, [todayIsoDate]);

  function handleRaidOpen(raid) { markRaidAsSeen(raid); setUpdatedRaidKeys((current) => { const next = new Set(current); next.delete(getRaidTrackingKey(raid)); return next; }); }
  const todayRaids = useMemo(() => raids.filter((raid) => isInScheduleRange(raid, todayIsoDate)), [raids, todayIsoDate]);
  const todayOwnerNames = useMemo(() => getOwnerNames(todayRaids), [todayRaids]);
  const weeklyParticipantNames = useMemo(() => getOwnerNames(raids), [raids]);
  const groupedRaids = useMemo(() => groupRaidsByDate(raids), [raids]);
  const todayStartTime = useMemo(() => getEarliestRaidTime(todayRaids), [todayRaids]);
  const deferredSearchQuery = selectedWeeklyParticipant.trim();
  const weeklySelectedResults = useMemo(() => {
    if (!deferredSearchQuery) return [];
    const groupedResults = new Map();
    raids.forEach((raid) => raid.participants.filter((p) => p.ownerName === deferredSearchQuery).forEach((participant) => {
      const groupKey = `${raid.date}-${participant.ownerName}-${participant.characterName}`;
      const existing = groupedResults.get(groupKey);
      if (existing) { if (!existing.raids.includes(raid.raidName)) existing.raids.push(raid.raidName); return; }
      groupedResults.set(groupKey, { date: raid.date, id: `${raid.date}-${participant.ownerName}-${participant.characterName}`, ownerName: participant.ownerName, characterName: participant.characterName, raids: [raid.raidName], startCol: raid.startCol, startRow: raid.startRow, time: raid.time });
    }));
    return Array.from(groupedResults.values());
  }, [raids, deferredSearchQuery]);
  const weeklySelectedGroups = useMemo(() => groupItemsByDate(weeklySelectedResults), [weeklySelectedResults]);
  const weeklyCalendarDays = useMemo(() => buildWeeklyCalendarDays(raids, todayIsoDate), [raids, todayIsoDate]);
  const searchGroups = weeklySelectedGroups;
  const sortedTodayRaids = useMemo(() => [...todayRaids].sort(compareRaidOrder), [todayRaids]);

  return <div className={styles.page}><div className={styles.backdrop}/><div className={styles.content}>
    <header className={styles.hero}><div><p className={styles.eyebrow}>LostArk Weekly Planner</p><h1>Stick Over Flow</h1><div className={styles.metaLine} aria-label="데이터 갱신 상태"><span>갱신 {formatFetchedAt(sourceMeta.fetchedAt)}</span><span className={`${styles.connectionStatus} ${sourceMeta.isFallback ? styles.connectionOffline : styles.connectionOnline}`}><span className={styles.connectionStatusDot} aria-hidden="true"/>{sourceMeta.isFallback ? "Disconnected" : "Connected"}</span></div></div><a className={styles.sheetLinkButton} href={sourceMeta.sourceUrl || DEFAULT_SHEET_URL} target="_blank" rel="noreferrer" aria-label="Google 시트 새 창에서 열기"><span className={styles.sheetLinkLabel}>시트 열기</span><span className={styles.sheetLinkIcon} aria-hidden="true">↗</span></a></header>
    {showOverviewStats ? <section className={styles.toolbar}><div className={styles.tabs} role="tablist" aria-label="일정 보기 선택">{TAB_ORDER.map((tabKey)=><button key={tabKey} type="button" role="tab" aria-selected={activeTab===tabKey} className={activeTab===tabKey?styles.activeTab:styles.tab} onClick={()=>setActiveTab(tabKey)}>{TAB_LABELS[tabKey]}</button>)}</div><div className={styles.summaryChips}><div className={styles.chip}><span>금일 일정</span><strong>{todayRaids.length}개</strong></div><div className={styles.chip}><span>전체 일정</span><strong>{raids.length}개</strong></div><div className={styles.chip}><span>전체 캐릭</span><strong>{countUniqueCharacters(raids)}명</strong></div></div></section> : null}
    <main>
      {!isLoading&&activeTab==="today"?<section className={`${styles.section} ${styles.pageSection} ${styles.todaySchedule}`}><SectionHeading styles={styles} title={TAB_LABELS.today} subtitle={`${formatDateLabel(todayIsoDate)} 기준 일정`} meta={<TimeMetaBadge styles={styles} value={todayStartTime}/>}/><TodayParticipantList ownerNames={todayOwnerNames} selectedOwnerName={selectedOwnerName} onSelectOwnerName={setSelectedOwnerName} styles={styles}/>{sortedTodayRaids.length===0?<StatePanel styles={styles} message="금일 일정이 없습니다."/>:<div className={styles.cardGrid}>{sortedTodayRaids.map((raid)=><RaidCard key={raid.id} raid={raid} styles={styles} onCharacterClick={setSelectedCharacterName} collapsible isHighlighted={Boolean(selectedOwnerName)&&raid.participants.some((p)=>p.ownerName===selectedOwnerName)} selectedOwnerName={selectedOwnerName} isUpdated={updatedRaidKeys.has(getRaidTrackingKey(raid))} onOpen={handleRaidOpen}/>)}</div>}</section>:null}
      {!isLoading&&activeTab==="week"?<section className={`${styles.section} ${styles.pageSection}`}><SectionHeading styles={styles} title={TAB_LABELS.week} subtitle="요일별 레이드 일정" meta={<WeekViewToggle styles={styles} value={weeklyViewMode} onChange={setWeeklyViewMode}/>}/><WeeklyParticipantList ownerNames={weeklyParticipantNames} selectedOwnerName={selectedWeeklyParticipant} onSelectOwnerName={setSelectedWeeklyParticipant} styles={styles}/>{weeklyViewMode==="calendar"?(weeklyCalendarDays.some((day)=>day.items.length>0)?<div className={styles.weekCalendarGrid}>{weeklyCalendarDays.map((day)=><section key={day.dateKey} className={styles.weekCalendarDay}><header className={styles.weekCalendarDayHeader}><div className={styles.weekCalendarDayHeaderMain}><span className={styles.weekCalendarDayLabel}>{day.label}</span><strong className={styles.weekCalendarDayDate}>{day.dateLabel}</strong></div><span className={styles.weekCalendarDayStartTime}>{day.startTime||"시간 미정"}</span></header>{day.items.length?<div className={styles.weekCalendarDayList}>{day.items.map((raid)=><article key={raid.id} className={`${styles.weekCalendarDayCard} ${Boolean(selectedWeeklyParticipant)&&raid.participants.some((p)=>p.ownerName===selectedWeeklyParticipant)?styles.weekCalendarDayCardHighlighted:""}`} onClick={()=>setSelectedCalendarRaid(raid)} onKeyDown={(e)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelectedCalendarRaid(raid)}}} role="button" tabIndex={0}><div className={styles.weekCalendarDayCardTop}><strong className={styles.weekCalendarDayCardTitle}>{raid.raidName}</strong></div></article>)}</div>:<p className={styles.weekCalendarDayEmpty}>일정 없음</p>}</section>)}</div>:<StatePanel styles={styles} message="이번 주 일정이 없습니다."/>):deferredSearchQuery?(searchGroups.length===0?<StatePanel styles={styles} message="검색 결과가 없습니다."/>:<div className={styles.weekStack}>{searchGroups.map((group)=><details key={group.id} className={styles.dayGroup}><summary className={styles.dayHeader}><span className={styles.dayTitle}>{group.label}</span><span className={styles.dayHeaderMeta}><TimeMetaBadge styles={styles} value={formatGroupTime(group)} className={styles.dayTimeBadge}/><span>{group.items.length}개 결과</span></span></summary><div className={`${styles.searchResults} ${styles.weeklySearchResult}`}>{group.items.map((item)=><article key={item.id} className={styles.searchResultCard}><div className={styles.searchInlineMeta}><div className={`${styles.searchInlineField} ${styles.searchCharacterField}`}><span>참여 캐릭터</span><button type="button" className={styles.searchCharacterButton} onClick={()=>setSelectedCharacterName(item.characterName)}>{item.characterName}</button></div><div className={`${styles.searchInlineField} ${styles.searchOwnerField}`}><span>이름</span><strong>{item.ownerName}</strong></div></div><div className={styles.searchRaidList}>{item.raids?.map((r)=><span key={`${item.id}-${r}`} className={styles.searchRaidPill}>{r}</span>)}</div></article>)}</div></details>)}</div>):groupedRaids.length===0?<StatePanel styles={styles} message="일정이 없습니다."/>:<div className={styles.weekStack}>{groupedRaids.map((group)=><details key={group.id} className={styles.dayGroup}><summary className={styles.dayHeader}><span className={styles.dayTitle}>{group.label}</span><span className={styles.dayHeaderMeta}><TimeMetaBadge styles={styles} value={formatGroupTime(group)} className={styles.dayTimeBadge}/><span>{group.items.length}개 일정</span></span></summary><div className={styles.cardGrid}>{group.items.map((raid)=><RaidCard key={raid.id} raid={raid} styles={styles} onCharacterClick={setSelectedCharacterName} isHighlighted={Boolean(selectedWeeklyParticipant)&&raid.participants.some((p)=>p.ownerName===selectedWeeklyParticipant)} selectedOwnerName={selectedWeeklyParticipant}/>)}</div></details>)}</div>}</section>:null}
      {activeTab==="auction"?<section className={`${styles.section} ${styles.pageSection}`}><Suspense fallback={<StatePanel styles={styles} message="쌀산기를 불러오는 중입니다."/>}><AuctionBidCalculator/></Suspense></section>:null}
      {activeTab==="personal"?<section className={`${styles.section} ${styles.pageSection}`}><Suspense fallback={<StatePanel styles={styles} message="개인 일정을 불러오는 중입니다."/>}><PersonalSchedulePage embedded/></Suspense></section>:null}
      {activeTab==="personalRaid"?<section className={`${styles.section} ${styles.pageSection}`}><Suspense fallback={<StatePanel styles={styles} message="레이드 참여 현황을 불러오는 중입니다."/>}><PersonalRaidPage embedded/></Suspense></section>:null}
    </main>
    {(activeTab==="today"||activeTab==="week")?<aside className={styles.auctionFloatingSidebar} aria-label="쌀산기"><AuctionBidSidebar/></aside>:null}
  </div>{selectedCharacterName?<Suspense fallback={null}><CharacterDetailModal characterName={selectedCharacterName} onClose={()=>setSelectedCharacterName("")} styles={styles}/></Suspense>:null}{selectedCalendarRaid?<CalendarRaidModal raid={selectedCalendarRaid} onCharacterClick={setSelectedCharacterName} onClose={()=>setSelectedCalendarRaid(null)} styles={styles}/>:null}</div>;
}

function CalendarRaidModal({ raid, onCharacterClick, onClose, styles }) { const onCloseRef=useRef(onClose); onCloseRef.current=onClose; useLayoutEffect(()=>{const scrollY=window.scrollY;const prev={overflow:document.body.style.overflow,position:document.body.style.position,top:document.body.style.top,width:document.body.style.width};document.body.style.overflow="hidden";document.body.style.position="fixed";document.body.style.top=`-${scrollY}px`;document.body.style.width="100%";const key=(e)=>{if(e.key==="Escape")onCloseRef.current()};window.addEventListener("keydown",key);return()=>{window.removeEventListener("keydown",key);Object.assign(document.body.style,prev);window.scrollTo(0,scrollY)}},[]);return <div className={styles.modalOverlay} role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)onClose()}}><div className={styles.modalShell} role="dialog" aria-modal="true"><button type="button" className={styles.modalCloseButton} onClick={onClose}>×</button><RaidCard raid={raid} styles={styles} onCharacterClick={onCharacterClick}/></div></div> }
function StatePanel({styles,message}){return <div className={styles.statePanel}>{message}</div>}
function TimeMetaBadge({styles,value,className=""}){return <span className={`${styles.timeMetaBadge} ${className}`}>{value||"시간 미정"}</span>}
function WeekViewToggle({styles,value,onChange}){return <div className={styles.weekViewToggle}><button type="button" className={value==="list"?styles.activeWeekViewButton:styles.weekViewButton} onClick={()=>onChange("list")}>목록</button><button type="button" className={value==="calendar"?styles.activeWeekViewButton:styles.weekViewButton} onClick={()=>onChange("calendar")}>캘린더</button></div>}
function SectionHeading({styles,title,subtitle,meta}){return <div className={styles.sectionHeading}><div className={styles.sectionHeadingTopRow}><div><h2>{title}</h2><p>{subtitle}</p></div>{meta}</div></div>}
function TodayParticipantList({ownerNames,selectedOwnerName,onSelectOwnerName,styles}){return <div className={styles.todayParticipantPanel}><div className={styles.todayParticipantHeader}><span>이름 선택</span></div><div className={styles.todayParticipantBadges}>{ownerNames.map((n)=><button key={n} type="button" className={selectedOwnerName===n?styles.activeTodayParticipantBadge:styles.todayParticipantBadge} onClick={()=>onSelectOwnerName(selectedOwnerName===n?"":n)}>{n}</button>)}</div></div>}
function WeeklyParticipantList(props){return <TodayParticipantList {...props}/>} function getOwnerNames(items){return [...new Set(items.flatMap((r)=>r.participants.map((p)=>p.ownerName)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ko"))} function countUniqueCharacters(items){return new Set(items.flatMap((r)=>r.participants.map((p)=>p.characterName)).filter(Boolean)).size} function getEarliestRaidTime(items){return items.map((r)=>r.time).filter(Boolean).sort()[0]||""} function compareRaidOrder(a,b){return (getScheduleStartAt(a)?.getTime()||0)-(getScheduleStartAt(b)?.getTime()||0)} function groupRaidsByDate(items){const map=new Map();items.forEach((r)=>{const key=r.date;if(!map.has(key))map.set(key,{id:key,label:formatDateLabel(key),items:[]});map.get(key).items.push(r)});return [...map.values()].sort((a,b)=>a.id.localeCompare(b.id))} function groupItemsByDate(items){const map=new Map();items.forEach((i)=>{if(!map.has(i.date))map.set(i.date,{id:i.date,label:formatDateLabel(i.date),items:[]});map.get(i.date).items.push(i)});return [...map.values()]} function formatGroupTime(group){return group.items?.[0]?.time||""} function buildWeeklyCalendarDays(items,today){return groupRaidsByDate(items).map((g)=>({dateKey:g.id,label:new Intl.DateTimeFormat("ko-KR",{weekday:"short"}).format(new Date(`${g.id}T12:00:00`)),dateLabel:formatDateLabel(g.id),startTime:getEarliestRaidTime(g.items),items:g.items}))} function formatFetchedAt(value){if(!value)return "-";return value}
