import RaidParticipantTable from "./RaidParticipantTable.jsx";
import { formatDateLabel } from "../utils/dateUtils.js";

export default function RaidCard({ raid, styles, showDate = false }) {
  return (
    <article className={styles.raidCard}>
      <header className={styles.cardHeader}>
        <div>
          <h3>{raid.raidName}</h3>
          <p className={styles.cardMeta}>
            {showDate ? `${formatDateLabel(raid.date)} · ` : ""}
            {raid.time}
          </p>
        </div>
        <span className={styles.timeBadge}>{raid.time}</span>
      </header>

      <p className={styles.participantSummary}>참여자 명단 {raid.participants.length}명</p>
      <RaidParticipantTable participants={raid.participants} styles={styles} />
    </article>
  );
}
