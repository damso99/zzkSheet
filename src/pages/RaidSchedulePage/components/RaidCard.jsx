import { memo, useState } from "react";
import RaidParticipantTable from "./RaidParticipantTable.jsx";

function RaidCard({
  raid,
  styles,
  onCharacterClick,
  collapsible = false,
  isHighlighted = false,
  isUpdated = false,
  onOpen,
  selectedOwnerName = "",
}) {
  const [isOpen, setIsOpen] = useState(!collapsible);

  function toggleOpen() {
    if (!collapsible) return;
    if (!isOpen) onOpen?.(raid);
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
          {isUpdated ? <span className={styles.raidUpdateDot} aria-label="갱신된 일정" /> : null}
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

export default memo(RaidCard);
