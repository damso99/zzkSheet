import { CHARACTER_PLACEHOLDER_IMAGE, displayValue } from "../utils/characterParser.js";

export default function CharacterEquipmentGrid({ equipment, styles }) {
  if (!equipment.length) {
    return <p className={styles.modalEmpty}>장비 정보 없음</p>;
  }

  const gearItems = equipment.filter((item) => item.category === "gear");
  const accessoryItems = equipment.filter((item) => item.category === "accessory");
  const braceletItems = equipment.filter((item) => item.category === "bracelet");

  return (
    <div className={styles.equipmentLayout}>
      <EquipmentSection title="장비" items={gearItems} styles={styles} emptyMessage="장비 없음" />
      <div className={styles.equipmentSideColumn}>
        <EquipmentSection title="악세서리" items={accessoryItems} styles={styles} emptyMessage="악세서리 없음" />
        <EquipmentSection title="팔찌" items={braceletItems} styles={styles} emptyMessage="팔찌 없음" />
      </div>
    </div>
  );
}

function EquipmentSection({ title, items, styles, emptyMessage }) {
  return (
    <section className={styles.equipmentSection}>
      <header className={styles.equipmentSectionHeader}>
        <h3>{title}</h3>
        <span>{items.length}개</span>
      </header>
      {items.length ? (
        <div className={styles.equipmentGrid}>
          {items.map((item, index) => (
            <EquipmentCard key={`${item.type}-${item.name}-${index}`} item={item} styles={styles} />
          ))}
        </div>
      ) : (
        <p className={styles.equipmentEmpty}>{emptyMessage}</p>
      )}
    </section>
  );
}

function EquipmentCard({ item, styles }) {
  return (
    <article className={styles.equipmentCard}>
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
        {item.options?.length ? (
          <div className={styles.equipmentOptions}>
            <strong>부여 옵션</strong>
            <ul className={styles.equipmentOptionList}>
              {item.options.map((option, index) => (
                <li key={`${option}-${index}`}>{option}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function replaceWithPlaceholder(event) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = CHARACTER_PLACEHOLDER_IMAGE;
}
