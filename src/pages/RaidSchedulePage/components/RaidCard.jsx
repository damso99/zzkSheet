import { useState } from "react";
import { getScheduleStartAt, isStartingSoon } from "../utils/dateUtils.js";
import RaidParticipantTable from "./RaidParticipantTable.jsx";

export default function RaidCard({
  raid,
  styles,
  onCharacterClick,
  collapsible = false,
  isHighlighted = false,
  selectedOwnerName = "",
}) {
  const [isOpen, setIsOpen] = useState(!collapsible);
  const startTimeValue = String(raid.time || raid.blockTime || "").trim();
  const startTime = startTimeValue || "시간 미정";
  const startAt = startTimeValue ? raid.startAt || getScheduleStartAt(raid.date, startTimeValue) : null;
  const showStartingSoon = startTimeValue ? isStartingSoon(startAt) : false;

  function toggleOpen() {
    if (!collapsible) return;
    setIsOpen((current) => !current);
  }

  return (
    <article
      className={`${styles.raidCard} ${collapsible ? styles.collapsibleRaidCard : ""} ${
        isHighlighted ? styles.highlightRaidCard : ""
      }`}
      onClick={toggleOpen}
      onKeyDown={(event) => {
        if (!collapsible) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleOpen();
        }
      }}
      role={collapsible ? "button" : undefined}
      tabIndex={collapsible ? 0 : undefined}
      aria-expanded={collapsible ? isOpen : undefined}
    >
      <header className={styles.cardHeader}>
        <div>
          <h3>{raid.raidName}</h3>
        </div>
        <div className={styles.cardHeaderActions}>
          <span className={styles.startTimeBadge}>
            <AlarmClockIcon className={styles.startTimeIcon} />
            <span>{startTime}</span>
          </span>
          {showStartingSoon ? <span className={`${styles.statusBadge} ${styles.startingSoonBadge}`}>곧 시작</span> : null}
          {collapsible ? (
            <button
              type="button"
              className={styles.detailToggleButton}
              onClick={(event) => {
                event.stopPropagation();
                toggleOpen();
              }}
            >
              {isOpen ? "닫기" : "상세 보기"}
            </button>
          ) : null}
        </div>
      </header>

      <p className={styles.participantSummary}>참여 인원 {raid.participants.length}명</p>
      {isOpen ? (
        <div onClick={(event) => event.stopPropagation()}>
          <RaidParticipantTable
            participants={raid.participants}
            styles={styles}
            onCharacterClick={onCharacterClick}
            selectedOwnerName={selectedOwnerName}
          />
        </div>
      ) : null}
    </article>
  );
}

function AlarmClockIcon({ className = "" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
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
  );
}
