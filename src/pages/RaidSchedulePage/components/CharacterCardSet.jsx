import { CHARACTER_PLACEHOLDER_IMAGE, displayValue } from "../utils/characterParser.js";

export default function CharacterCardSet({ cards, styles }) {
  const cardItems = cards.cards || [];
  const effects = cards.effects || [];

  if (!cardItems.length && !effects.length) {
    return <p className={styles.modalEmpty}>카드 정보 없음</p>;
  }

  return (
    <div className={styles.cardSetLayout}>
      <div className={styles.cardSetGrid}>
        {cardItems.map((card, index) => (
          <article key={`${card.name}-${index}`} className={styles.cardSet}>
            <img
              className={styles.cardImage}
              src={card.icon || CHARACTER_PLACEHOLDER_IMAGE}
              alt=""
              onError={replaceWithPlaceholder}
            />
            <h4>{displayValue(card.name)}</h4>
            <p>각성 {displayValue(card.awakeCount)}</p>
          </article>
        ))}
      </div>

      <section className={styles.cardEffectList}>
        <h4>세트 효과</h4>
        {effects.length ? (
          effects.map((effect, index) => <p key={`${effect}-${index}`}>{displayValue(effect)}</p>)
        ) : (
          <p>{displayValue("")}</p>
        )}
      </section>
    </div>
  );
}

function replaceWithPlaceholder(event) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = CHARACTER_PLACEHOLDER_IMAGE;
}
