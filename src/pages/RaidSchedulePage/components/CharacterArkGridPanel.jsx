import { CHARACTER_PLACEHOLDER_IMAGE, displayValue } from "../utils/characterParser.js";

const SECTION_ORDER = ["질서", "혼돈"];

export default function CharacterArkGridPanel({ arkGrid = {}, styles }) {
  const sections = Array.isArray(arkGrid.sections) ? arkGrid.sections : [];
  const effects = Array.isArray(arkGrid.effects) ? arkGrid.effects : [];

  if (!sections.length && !effects.length) {
    return <p className={styles.modalEmpty}>정보 없음</p>;
  }

  const sectionMap = new Map(sections.map((section) => [normalizeSectionName(section.name), section]));
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
        {SECTION_ORDER.map((sectionName) => {
          const section = sectionMap.get(normalizeSectionName(sectionName));
          const representativeItem = section?.items?.[0];
          return (
            <article key={sectionName} className={styles.arkGridCard}>
              <div className={styles.arkGridCardTopRow}>
                <span className={styles.arkGridCardSectionName}>{sectionName}</span>
                <span className={styles.arkPointBadge}>{formatTotalPoint(section?.items)}P</span>
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
                      <span>{section?.items?.length || 0}개</span>
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

function replaceWithPlaceholder(event) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = CHARACTER_PLACEHOLDER_IMAGE;
}
