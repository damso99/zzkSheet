import { CHARACTER_PLACEHOLDER_IMAGE, displayValue } from "../utils/characterParser.js";

const SECTION_ORDER = ["질서의 해", "질서의 달", "질서의 별", "혼돈의 해", "혼돈의 달", "혼돈의 별"];

export default function CharacterArkGridPanel({ arkGrid = {}, styles }) {
  const sections = Array.isArray(arkGrid.sections) ? arkGrid.sections : [];
  const effects = Array.isArray(arkGrid.effects) ? arkGrid.effects : [];

  if (!sections.length && !effects.length) {
    return <p className={styles.modalEmpty}>정보 없음</p>;
  }

  const displaySections = orderArkGridSections(sections);
  const totalPoint = sections.reduce((sum, section) => sum + formatTotalPoint(section.items), 0);

  return (
    <div className={styles.arkTabLayout}>
      <header className={styles.arkTabHeader}>
        <div className={styles.arkTabTitleBlock}>
          <p className={styles.modalSubtitle}>Ark Grid</p>
          <h3>{displayValue(arkGrid.title || "아크 그리드")}</h3>
        </div>
        <span className={styles.arkGridHeaderBadge}>{totalPoint}P</span>
      </header>

      <div className={styles.arkGridCardGrid}>
        {displaySections.map((section) => {
          const representativeItem = section?.items?.[0] || null;
          const point = formatTotalPoint(section?.items);
          return (
            <article key={section.key || section.name} className={styles.arkGridCard}>
              <div className={styles.arkGridCardTopRow}>
                <span className={styles.arkGridCardSectionName}>{displayValue(section.name)}</span>
                <span className={styles.arkPointBadge}>{point}P</span>
              </div>

              {representativeItem ? (
                <div className={styles.arkGridCardBody}>
                  <img
                    className={styles.arkGridCardIcon}
                    src={representativeItem.icon || CHARACTER_PLACEHOLDER_IMAGE}
                    alt=""
                    onError={replaceWithPlaceholder}
                  />
                  <div className={styles.arkGridCardInfo}>
                    <strong className={styles.arkGridCardName}>{displayValue(representativeItem.name)}</strong>
                    <div className={styles.arkGridCardBadges}>
                      {representativeItem.grade ? <span>{displayValue(representativeItem.grade)}</span> : null}
                      <span>활성 {point}P</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className={styles.arkGridEmpty}>정보 없음</p>
              )}
            </article>
          );
        })}
      </div>

      {effects.length ? (
        <section className={styles.arkGridEffectCard}>
          <header className={styles.arkSectionHeader}>
            <div className={styles.arkSectionTitleBlock}>
              <h4>효과 목록</h4>
              <span>{effects.length}개 효과</span>
            </div>
          </header>

          <div className={styles.arkGridEffectList}>
            {effects.map((effect, index) => (
              <article key={`${effect.name}-${index}`} className={styles.arkGridEffectRow} title={effect.tooltip || ""}>
                <div className={styles.arkGridEffectMain}>
                  <strong>{displayValue(effect.name)}</strong>
                  <span>{displayValue(effect.tooltip || effect.value || "설명 없음")}</span>
                </div>
                <div className={styles.arkGridEffectMeta}>
                  <span className={styles.arkEffectLevelBadge}>Lv.{normalizeNumber(effect.level)}</span>
                  <span className={styles.arkGridEffectValue}>{displayValue(effect.value || "0")}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function formatTotalPoint(items) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => sum + parseNumber(item.point), 0);
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

function orderArkGridSections(sections) {
  const sectionMap = new Map(sections.map((section) => [normalizeSectionName(section.name), section]));
  const orderedSections = SECTION_ORDER.map((name) => sectionMap.get(normalizeSectionName(name))).filter(Boolean);
  const orderedKeys = new Set(orderedSections.map((section) => normalizeSectionName(section.name)));
  const extraSections = sections.filter((section) => !orderedKeys.has(normalizeSectionName(section.name)));

  return [...orderedSections, ...extraSections];
}

function replaceWithPlaceholder(event) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = CHARACTER_PLACEHOLDER_IMAGE;
}
