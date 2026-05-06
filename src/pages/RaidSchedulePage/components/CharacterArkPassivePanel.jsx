import { displayValue } from "../utils/characterParser.js";

const SECTION_ORDER = ["진화", "깨달음", "도약"];

export default function CharacterArkPassivePanel({ arkPassive = {}, styles }) {
  const sections = Array.isArray(arkPassive.sections) ? arkPassive.sections : [];

  if (!sections.length) {
    return <p className={styles.modalEmpty}>0</p>;
  }

  return (
    <div className={styles.arkTabLayout}>
      <header className={styles.arkTabHeader}>
        <div>
          <p className={styles.modalSubtitle}>Ark Passive</p>
          <h3>{displayValue(arkPassive.title || "아크 패시브")}</h3>
        </div>
        <span className={arkPassive.isArkPassive ? styles.arkStateBadge : styles.arkStateBadgeMuted}>
          {arkPassive.isArkPassive ? "활성" : "비활성"}
        </span>
      </header>

      <div className={styles.arkSectionStack}>
        {sortSections(sections).map((section) => (
          <article key={section.key} className={styles.arkSectionCard}>
            <header className={styles.arkSectionHeader}>
              <div>
                <h4>{section.name}</h4>
                {section.description ? <p>{section.description}</p> : null}
              </div>
              <span className={styles.arkPointBadge}>{normalizeNumber(section.value)}P</span>
            </header>

            <div className={styles.arkEffectList}>
              {section.items.map((effect, index) => (
                <div key={`${section.key}-${effect.name}-${index}`} className={styles.arkEffectRow}>
                  <span className={styles.arkTierBadge}>{effect.tier ? `${effect.tier}티어` : "티어"}</span>
                  <strong>{displayValue(effect.name)}</strong>
                  <span className={styles.arkEffectLevel}>Lv.{normalizeNumber(effect.level)}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
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

function normalizeNumber(value) {
  const numeric = Number(String(value ?? "").replace(/,/g, ""));
  if (Number.isFinite(numeric)) return String(numeric);
  return "0";
}
