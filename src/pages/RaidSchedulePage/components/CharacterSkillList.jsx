import { CHARACTER_PLACEHOLDER_IMAGE, displayValue } from "../utils/characterParser.js";

export default function CharacterSkillList({ skills, styles }) {
  if (!skills.length) {
    return <p className={styles.modalEmpty}>스킬 정보 없음</p>;
  }

  return (
    <div className={styles.skillList}>
      {skills.map((skill, index) => (
        <details key={`${skill.name}-${index}`} className={styles.skillCard}>
          <summary className={styles.skillSummary}>
            <img
              className={styles.itemIcon}
              src={skill.icon || CHARACTER_PLACEHOLDER_IMAGE}
              alt=""
              onError={replaceWithPlaceholder}
            />
            <span>
              <strong>{displayValue(skill.name)}</strong>
              <small>Lv. {displayValue(skill.level)} · 포인트 {displayValue(skill.point)} · 룬 {displayValue(skill.rune)}</small>
            </span>
          </summary>
          <div className={styles.tripodList}>
            {skill.tripods.length ? (
              skill.tripods.map((tripod, tripodIndex) => (
                <p key={`${tripod.name}-${tripodIndex}`}>
                  {displayValue(tripod.name)} · Lv. {displayValue(tripod.level)} · Tier {displayValue(tripod.tier)}
                </p>
              ))
            ) : (
              <p>{displayValue("")}</p>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}

function replaceWithPlaceholder(event) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = CHARACTER_PLACEHOLDER_IMAGE;
}
