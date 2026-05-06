import { displayValue } from "../utils/characterParser.js";

const SECTION_ORDER = ["진화", "깨달음", "도약"];

export default function CharacterArkPassivePanel({ arkPassive = {}, styles }) {
  const sections = Array.isArray(arkPassive.sections) ? arkPassive.sections : [];
  const summaryPoints = Array.isArray(arkPassive.points) ? arkPassive.points : [];

  if (!sections.length && !summaryPoints.length) {
    return <p className={styles.modalEmpty}>0</p>;
  }

  return (
    <div className={styles.arkTabLayout}>
      <header className={styles.arkTabHeader}>
        <div className={styles.arkTabTitleBlock}>
          <p className={styles.modalSubtitle}>Ark Passive</p>
          <h3>{displayValue(arkPassive.title || "아크 패시브")}</h3>
        </div>
        <span className={arkPassive.isArkPassive ? styles.arkStateBadge : styles.arkStateBadgeMuted}>
          {arkPassive.isArkPassive ? "활성" : "비활성"}
        </span>
      </header>

      {summaryPoints.length ? (
        <div className={styles.arkHeaderBadges}>
          {summaryPoints.map((point) => (
            <span key={`${point.name}-${point.value}`} className={styles.arkSummaryBadge} title={point.tooltip || ""}>
              <strong>{displayValue(point.name)}</strong>
              <em>{normalizeNumber(point.value)}P</em>
            </span>
          ))}
        </div>
      ) : null}

      <div className={styles.arkSectionStack}>
        {sortSections(sections).map((section) => (
          <article key={section.key} className={styles.arkSectionCard}>
            <header className={styles.arkSectionHeader}>
              <div className={styles.arkSectionTitleBlock}>
                <h4>{displayValue(section.name)}</h4>
                <span>{section.items.length}개 효과</span>
              </div>
              <span className={styles.arkPointBadge}>{normalizeNumber(section.value)}P</span>
            </header>

            <div className={styles.arkEffectList}>
              {section.items.map((effect, index) => {
                const tierLabel = effect.tier ? `${normalizeNumber(effect.tier)}티어` : "티어";
                const levelLabel = `Lv.${normalizeNumber(effect.level)}`;
                return (
                  <div key={`${section.key}-${effect.name}-${index}`} className={styles.arkEffectRow} title={effect.description || ""}>
                    <span className={styles.arkTierBadge}>{tierLabel}</span>
                    <strong>{displayValue(effect.name)}</strong>
                    <span className={styles.arkEffectLevel}>{levelLabel}</span>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
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

function normalizeNumber(value) {
  const numeric = Number(String(value ?? "").replace(/,/g, ""));
  if (Number.isFinite(numeric)) return String(numeric);
  return "0";
}

function normalizeSectionName(value) {
  return String(value ?? "").replace(/\s+/g, "").trim();
}
