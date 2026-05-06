import { CHARACTER_PLACEHOLDER_IMAGE, displayValue } from "../utils/characterParser.js";

const SECTION_ORDER = ["진화", "깨달음", "도약"];

export default function CharacterArkPassivePanel({ arkPassive = {}, styles }) {
  const sections = Array.isArray(arkPassive.sections) ? arkPassive.sections : [];

  if (!sections.length) {
    return <p className={styles.modalEmpty}>정보 없음</p>;
  }

  const sectionMap = new Map(sections.map((section) => [normalizeSectionName(section.name), section]));

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

      <div className={styles.arkPassiveCardGrid}>
        {SECTION_ORDER.map((sectionName) => {
          const section = sectionMap.get(normalizeSectionName(sectionName));
          return (
            <article key={sectionName} className={styles.arkPassiveCard}>
              <header className={styles.arkPassiveCardHeader}>
                <div>
                  <h4>{sectionName}</h4>
                  <span>{normalizeNumber(section?.value)}P</span>
                </div>
              </header>

              <div className={styles.arkPassiveRowList}>
                {section?.items?.length ? (
                  section.items.map((effect, index) => (
                    <div
                      key={`${sectionName}-${effect.name}-${index}`}
                      className={styles.arkPassiveRow}
                      title={effect.description || ""}
                    >
                      <img
                        className={styles.arkPassiveRowIcon}
                        src={effect.icon || CHARACTER_PLACEHOLDER_IMAGE}
                        alt=""
                        onError={replaceWithPlaceholder}
                      />
                      <span className={styles.arkPassiveRowTier}>{effect.tier ? `${normalizeNumber(effect.tier)}티어` : "티어"}</span>
                      <strong className={styles.arkPassiveRowName}>{displayValue(effect.name)}</strong>
                      <span className={styles.arkPassiveRowLevel}>Lv.{normalizeNumber(effect.level)}</span>
                    </div>
                  ))
                ) : (
                  <p className={styles.arkPassiveEmpty}>정보 없음</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
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
