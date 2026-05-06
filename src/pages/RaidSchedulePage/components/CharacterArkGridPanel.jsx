import { CHARACTER_PLACEHOLDER_IMAGE, displayValue } from "../utils/characterParser.js";

const SECTION_ORDER = ["질서의", "혼돈의", "기타"];

export default function CharacterArkGridPanel({ arkGrid = {}, styles }) {
  const sections = Array.isArray(arkGrid.sections) ? arkGrid.sections : [];
  const effects = Array.isArray(arkGrid.effects) ? arkGrid.effects : [];

  if (!sections.length && !effects.length) {
    return <p className={styles.modalEmpty}>0</p>;
  }

  return (
    <div className={styles.arkTabLayout}>
      <header className={styles.arkTabHeader}>
        <div>
          <p className={styles.modalSubtitle}>Ark Grid</p>
          <h3>아크 그리드</h3>
        </div>
        <span className={styles.arkGridHeaderBadge}>{sections.length + effects.length}개</span>
      </header>

      <div className={styles.arkGridSectionStack}>
        {sortSections(sections).map((section) => (
          <article key={section.key} className={styles.arkSectionCard}>
            <header className={styles.arkSectionHeader}>
              <div>
                <h4>{section.name}</h4>
                <p>{section.items.length}개 항목</p>
              </div>
              <span className={styles.arkPointBadge}>
                {section.items.reduce((sum, item) => sum + parseNumber(item.point), 0)}P
              </span>
            </header>

            <div className={styles.arkGridSlotList}>
              {section.items.map((slot, index) => (
              <article key={`${slot.name}-${index}`} className={styles.arkGridSlotRow}>
                  <img
                    className={styles.arkGridSlotIcon}
                    src={slot.icon || CHARACTER_PLACEHOLDER_IMAGE}
                    alt=""
                    onError={handleImageError}
                  />
                  <div className={styles.arkGridSlotBody}>
                    <div className={styles.arkGridSlotTopRow}>
                      <strong>{displayValue(slot.name)}</strong>
                      <span className={styles.arkGridSlotPoint}>{normalizeNumber(slot.point)}P</span>
                    </div>
                    <div className={styles.arkGridSlotBadges}>
                      {slot.grade ? <span>{slot.grade}</span> : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </article>
        ))}
      </div>

      <section className={styles.arkEffectCard}>
        <header className={styles.arkSectionHeader}>
          <div>
            <h4>효과 목록</h4>
            <p>공격력 / 추가 피해 / 낙인력 / 보스 피해</p>
          </div>
        </header>

        <div className={styles.arkEffectStatList}>
              {effects.map((effect, index) => (
            <article key={`${effect.name}-${index}`} className={styles.arkEffectStatRow}>
              <div>
                <strong>{displayValue(effect.name)}</strong>
                {effect.tooltip ? <p>{effect.tooltip}</p> : null}
              </div>
              <span className={styles.arkEffectLevelBadge}>Lv.{normalizeNumber(effect.level)}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function sortSections(sections) {
  const orderMap = new Map(SECTION_ORDER.map((name, index) => [name, index]));

  return [...sections].sort((left, right) => {
    const leftIndex = orderMap.has(left.name) ? orderMap.get(left.name) : 999;
    const rightIndex = orderMap.has(right.name) ? orderMap.get(right.name) : 999;

    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    return String(left.name).localeCompare(String(right.name), "ko-KR");
  });
}

function parseNumber(value) {
  const numeric = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeNumber(value) {
  const numeric = Number(String(value ?? "").replace(/,/g, ""));
  if (Number.isFinite(numeric)) return String(numeric);
  return "0";
}

function handleImageError(event) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = CHARACTER_PLACEHOLDER_IMAGE;
}
