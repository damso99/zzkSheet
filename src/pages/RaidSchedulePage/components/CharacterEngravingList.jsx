import { displayValue } from "../utils/characterParser.js";

export default function CharacterEngravingList({ engravings = [], styles }) {
  if (!Array.isArray(engravings) || engravings.length === 0) {
    return <p className={styles.modalEmpty}>0</p>;
  }

  return (
    <div className={styles.compactEngravingList}>
      {engravings.map((engraving, index) => {
        const name = displayValue(engraving.name || engraving.Name || engraving.EngravingName || engraving.Title);
        const relicValue = engraving.level ?? engraving.Level;
        const abilityStoneValue = engraving.abilityStoneLevel ?? engraving.AbilityStoneLevel;
        const relicLevel = hasDisplayValue(relicValue) ? normalizeLevel(relicValue) : "";
        const abilityStoneLevel = hasPositiveDisplayValue(abilityStoneValue) ? normalizeLevel(abilityStoneValue) : "";
        const isActive = Number(relicLevel) > 0 || Number(abilityStoneLevel) > 0;

        return (
          <article
            key={`${name}-${relicLevel}-${abilityStoneLevel}-${index}`}
            className={`${styles.compactEngravingRow} ${isActive ? styles.compactEngravingRowActive : styles.compactEngravingRowInactive}`}
            title={displayValue(engraving.description || engraving.Description || "")}
          >
            <div className={styles.compactEngravingTitle}>
              <strong className={styles.compactEngravingName}>{name}</strong>
            </div>

            <div className={styles.compactEngravingBadges}>
              {abilityStoneLevel !== "" ? (
                <span className={styles.compactEngravingActivationBadge}>x{abilityStoneLevel}</span>
              ) : null}
              {relicLevel !== "" ? <span className={styles.compactEngravingLevelBadge}>Lv.{relicLevel}</span> : null}
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

function hasDisplayValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function hasPositiveDisplayValue(value) {
  if (!hasDisplayValue(value)) return false;
  const numeric = Number(String(value).trim());
  if (Number.isFinite(numeric)) return numeric !== 0;
  return true;
}
