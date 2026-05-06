import { CHARACTER_PLACEHOLDER_IMAGE, displayValue } from "../utils/characterParser.js";

const GROUP_ORDER = ["질서", "혼돈"];
const CORE_ORDER = ["해", "달", "별"];

export default function CharacterArkGridPanel({ arkGrid = {}, styles }) {
  const sections = Array.isArray(arkGrid.sections) ? arkGrid.sections : [];
  const effects = Array.isArray(arkGrid.effects) ? arkGrid.effects : [];

  if (!sections.length && !effects.length) {
    return <p className={styles.modalEmpty}>정보 없음</p>;
  }

  const groupedSections = groupArkGridSections(sections);
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
        {groupedSections.map((group) => {
          const point = group.rows.reduce((sum, row) => sum + row.point, 0);
          return (
            <article key={group.name} className={styles.arkGridCard}>
              <div className={styles.arkGridCardTopRow}>
                <span className={styles.arkGridCardSectionName}>{group.name}</span>
                <span className={styles.arkPointBadge}>{point}P</span>
              </div>

              {group.rows.length ? (
                <div className={styles.arkGridCoreList}>
                  {group.rows.map((row) => (
                    <div key={`${group.name}-${row.coreName}`} className={styles.arkGridCoreRow}>
                      <img
                        className={styles.arkGridCardIcon}
                        src={row.item.icon || CHARACTER_PLACEHOLDER_IMAGE}
                        alt=""
                        onError={replaceWithPlaceholder}
                      />
                      <span className={styles.arkGridCoreType}>{row.coreName}</span>
                      <div className={styles.arkGridCardInfo}>
                        <strong className={styles.arkGridCardName}>{displayValue(row.item.name)}</strong>
                        <div className={styles.arkGridCardBadges}>
                          {row.item.grade ? <span>{displayValue(row.item.grade)}</span> : null}
                        </div>
                      </div>
                      <strong className={styles.arkGridCorePoint}>{row.point}P</strong>
                    </div>
                  ))}
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

function groupArkGridSections(sections) {
  return GROUP_ORDER.map((groupName) => {
    const groupSections = sections.filter((section) => getGroupName(section.name) === groupName);
    const rows = CORE_ORDER.map((coreName) => {
      const section = groupSections.find((item) => getCoreName(item.name) === coreName);
      if (!section?.items?.length) return null;

      return {
        coreName,
        item: section.items[0],
        point: formatTotalPoint(section.items),
      };
    }).filter(Boolean);

    return { name: groupName, rows };
  }).filter((group) => group.rows.length > 0);
}

function getGroupName(value) {
  const text = String(value ?? "");
  if (text.includes("질서")) return "질서";
  if (text.includes("혼돈")) return "혼돈";
  return "기타";
}

function getCoreName(value) {
  const text = String(value ?? "");
  if (text.includes("해")) return "해";
  if (text.includes("달")) return "달";
  if (text.includes("별")) return "별";
  return "";
}

function replaceWithPlaceholder(event) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = CHARACTER_PLACEHOLDER_IMAGE;
}
