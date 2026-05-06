import { displayValue } from "../utils/characterParser.js";

export default function CharacterEngravingList({ engravings = [], styles }) {
  if (!Array.isArray(engravings) || engravings.length === 0) {
    return <p className={styles.modalEmpty}>0</p>;
  }

  return (
    <div className={styles.compactEngravingList}>
      {engravings.map((engraving, index) => {
        const name = displayValue(engraving.name || engraving.Name || engraving.EngravingName || engraving.Title);
        const level = normalizeLevel(engraving.level ?? engraving.Level);
        const activationValue = engraving.abilityStoneLevel ?? engraving.AbilityStoneLevel;
        const activation = activationValue == null || activationValue === "" ? "" : normalizeLevel(activationValue);
        const isActive = Number(level) > 0 || Number(activation) > 0;

        return (
          <article
            key={`${name}-${level}-${index}`}
            className={`${styles.compactEngravingRow} ${isActive ? styles.compactEngravingRowActive : styles.compactEngravingRowInactive}`}
          >
            <div className={styles.compactEngravingTitle}>
              <strong className={styles.compactEngravingName}>{name}</strong>
            </div>

            <div className={styles.compactEngravingBadges}>
              <span className={styles.compactEngravingLevelBadge}>Lv.{level}</span>
              {activation !== "" ? <span className={styles.compactEngravingActivationBadge}>x{activation}</span> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function normalizeLevel(value) {
  if (value == null || value === "") return "0";
  return String(value);
}
