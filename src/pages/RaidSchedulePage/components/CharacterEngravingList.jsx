import { CHARACTER_PLACEHOLDER_IMAGE, displayValue } from "../utils/characterParser.js";

export default function CharacterEngravingList({ engravings, styles }) {
  if (!engravings.length) {
    return <p className={styles.modalEmpty}>0</p>;
  }

  return (
    <div className={styles.engravingList}>
      {engravings.map((engraving, index) => (
        <article key={`${engraving.name}-${index}`} className={styles.engravingCard}>
          <img
            className={styles.itemIcon}
            src={engraving.icon || CHARACTER_PLACEHOLDER_IMAGE}
            alt=""
            onError={replaceWithPlaceholder}
          />
          <div>
            <div className={styles.itemMeta}>
              <strong>Lv.{formatEngravingLevel(engraving.level)}</strong>
            </div>
            <h4>{displayValue(engraving.name)}</h4>
            {engraving.description ? <p>{engraving.description}</p> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function replaceWithPlaceholder(event) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = CHARACTER_PLACEHOLDER_IMAGE;
}

function formatEngravingLevel(level) {
  if (level == null || level === "" || level === "정보 없음") return "0";
  return String(level);
}
