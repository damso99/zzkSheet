import { useState } from "react";
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
  if (isAbilityStoneItem(item)) {
    return <AbilityStoneCard item={item} styles={styles} />;
  }

  return <NormalEquipmentCard item={item} styles={styles} />;
}

function NormalEquipmentCard({ item, styles }) {
  const [isOptionOpen, setIsOptionOpen] = useState(false);
  const isCollapsibleOption = isAccessoryItem(item);
  const shouldShowQuality = !isAbilityStoneItem(item) && item.category !== "bracelet";
  const shouldShowOptionList = item.options?.length && (!isCollapsibleOption || isOptionOpen);

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
          {shouldShowQuality ? <span>품질 {displayValue(item.quality)}</span> : null}
          {item.enhancement ? <span>강화 {item.enhancement}</span> : null}
        </div>
        {item.options?.length ? (
          <div className={styles.equipmentOptions}>
            {isCollapsibleOption ? (
              <button
                type="button"
                className={styles.equipmentOptionToggle}
                onClick={() => setIsOptionOpen((currentValue) => !currentValue)}
                aria-expanded={isOptionOpen}
              >
                <span>{isOptionOpen ? "옵션 접기" : "옵션 보기"}</span>
                <span aria-hidden="true">{isOptionOpen ? "▲" : "▼"}</span>
              </button>
            ) : (
              <strong>부여 옵션</strong>
            )}
            {shouldShowOptionList ? (
              <ul className={styles.equipmentOptionList}>
                {item.options.map((option, index) => (
                  <li key={`${option}-${index}`}>{option}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function AbilityStoneCard({ item, styles }) {
  const basicEffects = item.abilityStone?.basicEffects || [];
  const engravings = item.abilityStone?.engravings || [];

  return (
    <article className={`${styles.equipmentCard} ${styles.abilityStoneCard}`}>
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
        </div>

        {basicEffects.length ? (
          <div className={styles.abilityStoneEffects}>
            {basicEffects.map((effect, index) => (
              <span key={`${effect}-${index}`}>{effect}</span>
            ))}
          </div>
        ) : null}

        {engravings.length ? (
          <ul className={styles.abilityStoneEngravings}>
            {engravings.map((engraving, index) => {
              const isDecrease = engraving.name.includes("감소") || engraving.direction === "감소";
              const badgeClassName = isDecrease
                ? `${styles.abilityStoneLevelBadge} ${styles.abilityStoneLevelDecrease}`
                : `${styles.abilityStoneLevelBadge} ${styles.abilityStoneLevelIncrease}`;

              return (
                <li key={`${engraving.name}-${index}`} className={styles.abilityStoneEngraving}>
                  <span>{engraving.name}</span>
                  <strong className={badgeClassName}>[{displayValue(engraving.level)}]</strong>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

function isAbilityStoneItem(item) {
  return /어빌리티\s*스톤|스톤/.test(`${item?.type || ""} ${item?.name || ""}`);
}

function isAccessoryItem(item) {
  return item?.category === "accessory" && /목걸이|귀걸이|반지/.test(`${item?.type || ""} ${item?.name || ""}`);
}

function replaceWithPlaceholder(event) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = CHARACTER_PLACEHOLDER_IMAGE;
}
