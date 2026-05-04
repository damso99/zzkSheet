import RaidParticipantTable from "./RaidParticipantTable.jsx";
export default function RaidCard({ raid, styles, onCharacterClick }) {
  return (
    <article className={styles.raidCard}>
      <header className={styles.cardHeader}>
        <div>
          <h3>{raid.raidName}</h3>
        </div>
      </header>

      <p className={styles.participantSummary}>참여자 명단 {raid.participants.length}명</p>
      <RaidParticipantTable participants={raid.participants} styles={styles} onCharacterClick={onCharacterClick} />
    </article>
  );
}
