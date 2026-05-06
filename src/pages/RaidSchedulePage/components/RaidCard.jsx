import { useState } from "react";
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
