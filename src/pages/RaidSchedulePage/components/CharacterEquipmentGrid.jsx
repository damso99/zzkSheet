import { CHARACTER_PLACEHOLDER_IMAGE, displayValue } from "../utils/characterParser.js";

export default function CharacterEquipmentGrid({ equipment, styles }) {
  if (!equipment.length) {
    return <p className={styles.modalEmpty}>장비 정보 없음</p>;
  }

  return (
    <div className={styles.equipmentGrid}>
      {equipment.map((item, index) => (
        <article key={`${item.type}-${item.name}-${index}`} className={styles.equipmentCard}>
          <img
            className={styles.itemIcon}
            src={item.icon || CHARACTER_PLACEHOLDER_IMAGE}
            alt=""
            onError={replaceWithPlaceholder}
          />
          <div className={styles.itemBody}>
            <h4>{displayValue(item.name)}</h4>
            <div className={styles.itemBadges}>
              <span>{displayValue(item.type)}</span>
              <span>{displayValue(item.grade)}</span>
              <span>품질 {displayValue(item.quality)}</span>
              {item.enhancement ? <span>강화 {item.enhancement}</span> : null}
            </div>
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
