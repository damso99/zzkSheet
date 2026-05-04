import { CHARACTER_PLACEHOLDER_IMAGE, displayValue } from "../utils/characterParser.js";

export default function CharacterGemGrid({ gems, styles }) {
  if (!gems.length) {
    return <p className={styles.modalEmpty}>보석 정보 없음</p>;
  }

  return (
    <div className={styles.gemGrid}>
      {gems.map((gem, index) => (
        <article key={`${gem.name}-${index}`} className={styles.gemCard}>
          <img
            className={styles.itemIcon}
            src={gem.icon || CHARACTER_PLACEHOLDER_IMAGE}
            alt=""
            onError={replaceWithPlaceholder}
          />
          <div>
            <span className={styles.gemLevel}>{displayValue(gem.level)}레벨</span>
            <h4>{displayValue(gem.name)}</h4>
            <p>{displayValue(gem.effect)}</p>
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
