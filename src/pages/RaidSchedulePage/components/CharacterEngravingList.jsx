import { CHARACTER_PLACEHOLDER_IMAGE, displayValue } from "../utils/characterParser.js";

export default function CharacterEngravingList({ engravings, styles }) {
  if (!engravings.length) {
    return <p className={styles.modalEmpty}>각인 정보 없음</p>;
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
              <strong>Lv. {displayValue(engraving.level)}</strong>
            </div>
            <h4>{displayValue(engraving.name)}</h4>
            <p>{displayValue(engraving.description)}</p>
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
