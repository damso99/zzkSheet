import { CHARACTER_PLACEHOLDER_IMAGE, displayValue } from "../utils/characterParser.js";

const SECTION_ORDER = ["진화", "깨달음", "도약"];

export default function CharacterArkGridPanel({ arkGrid = {}, styles }) {
  const sections = Array.isArray(arkGrid.sections) ? arkGrid.sections : [];
  const effects = Array.isArray(arkGrid.effects) ? arkGrid.effects : [];

  if (!sections.length && !effects.length) {
    return <p className={styles.modalEmpty}>0</p>;
  }

  const totalPoint = formatTotalPoint(sections.flatMap((section) => section.items));

  return (
    <div className={styles.arkTabLayout}>
      <header className={styles.arkTabHeader}>
        <div className={styles.arkTabTitleBlock}>
          <p className={styles.modalSubtitle}>Ark Grid</p>
          <h3>{displayValue(arkGrid.title || "아크 그리드")}</h3>
        </div>
        <span className={styles.arkGridHeaderBadge}>{totalPoint}P</span>
      </header>

      {sections.length ? (
        <div className={styles.arkHeaderBadges}>
          {sortSections(sections).map((section) => (
            <span key={section.key} className={styles.arkSummaryBadge}>
              <strong>{displayValue(section.name)}</strong>
              <em>{formatTotalPoint(section.items)}P</em>
            </span>
          ))}
        </div>
      ) : null}

      <div className={styles.arkGridSectionStack}>
        {sortSections(sections).map((section) => (
          <article key={section.key} className={styles.arkSectionCard}>
            <header className={styles.arkSectionHeader}>
              <div className={styles.arkSectionTitleBlock}>
                <h4>{displayValue(section.name)}</h4>
                <span>{section.items.length}개 아이템</span>
              </div>
              <span className={styles.arkPointBadge}>{formatTotalPoint(section.items)}P</span>
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
                      <strong title={displayValue(slot.name)}>{displayValue(slot.name)}</strong>
                      <span className={styles.arkGridSlotPoint}>{normalizeNumber(slot.point)}P</span>
                    </div>

                    <div className={styles.arkGridSlotBadges}>
                      {slot.grade ? <span>{displayValue(slot.grade)}</span> : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </article>
        ))}
      </div>

      {effects.length ? (
        <section className={styles.arkEffectCard}>
          <header className={styles.arkSectionHeader}>
            <div className={styles.arkSectionTitleBlock}>
              <h4>아크 효과 목록</h4>
              <span>{effects.length}개 효과</span>
            </div>
          </header>

          <div className={styles.arkEffectStatList}>
            {effects.map((effect, index) => (
              <article key={`${effect.name}-${index}`} className={styles.arkEffectStatRow} title={effect.tooltip || ""}>
                <div className={styles.arkEffectStatName}>
                  <strong>{displayValue(effect.name)}</strong>
                </div>
                <span className={styles.arkEffectLevelBadge}>Lv.{normalizeNumber(effect.level)}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function sortSections(sections) {
  const orderMap = new Map(SECTION_ORDER.map((name, index) => [normalizeSectionName(name), index]));

  return [...sections].sort((left, right) => {
    const leftIndex = orderMap.has(normalizeSectionName(left.name)) ? orderMap.get(normalizeSectionName(left.name)) : 999;
    const rightIndex = orderMap.has(normalizeSectionName(right.name)) ? orderMap.get(normalizeSectionName(right.name)) : 999;

    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    return String(left.name).localeCompare(String(right.name), "ko-KR");
  });
}

function formatTotalPoint(items) {
  return String((Array.isArray(items) ? items : []).reduce((sum, item) => sum + parseNumber(item.point), 0));
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

function normalizeSectionName(value) {
  return String(value ?? "").replace(/\s+/g, "").trim();
}

function handleImageError(event) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = CHARACTER_PLACEHOLDER_IMAGE;
}
