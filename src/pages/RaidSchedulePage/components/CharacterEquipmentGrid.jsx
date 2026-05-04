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
            <div className={styles.itemMeta}>
              <span>{displayValue(item.type)}</span>
              <strong>{displayValue(item.grade)}</strong>
            </div>
            <h4>{displayValue(item.name)}</h4>
            <div className={styles.itemBadges}>
              {item.enhancement ? <span>강화 {item.enhancement}</span> : null}
              <span>품질 {displayValue(item.quality)}</span>
            </div>
            {item.tooltip ? <p className={styles.tooltipText}>{item.tooltip}</p> : null}
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
