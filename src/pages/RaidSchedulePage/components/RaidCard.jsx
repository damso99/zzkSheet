import { useState } from "react";
import RaidParticipantTable from "./RaidParticipantTable.jsx";

export default function RaidCard({ raid, styles, onCharacterClick, collapsible = false, isHighlighted = false }) {
  const [isOpen, setIsOpen] = useState(!collapsible);
  const statusLabel = raid.status || "예정";

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
          <span className={styles.raidTimeLabel}>{raid.time || "-"}</span>
          <h3>{raid.raidName}</h3>
        </div>
        <div className={styles.cardHeaderActions}>
          <span className={`${styles.statusBadge} ${styles.scheduled}`}>{statusLabel}</span>
          {collapsible ? (
            <button
              type="button"
              className={styles.detailToggleButton}
              onClick={(event) => {
                event.stopPropagation();
                toggleOpen();
              }}
            >
              {isOpen ? "접기" : "상세 보기"}
            </button>
          ) : null}
        </div>
      </header>

      <p className={styles.participantSummary}>참여 인원 {raid.participants.length}명</p>
      {isOpen ? (
        <div onClick={(event) => event.stopPropagation()}>
          <RaidParticipantTable participants={raid.participants} styles={styles} onCharacterClick={onCharacterClick} />
        </div>
      ) : null}
    </article>
  );
}
