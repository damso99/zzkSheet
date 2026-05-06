import { useState } from "react";
import { CHARACTER_PLACEHOLDER_IMAGE, cleanTitleText, displayValue } from "../utils/characterParser.js";

export default function CharacterProfileHeader({ profile, styles }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageSrc = !imageFailed && profile.characterImage ? profile.characterImage : CHARACTER_PLACEHOLDER_IMAGE;

  const stats = [
    ["서버", profile.serverName],
    ["클래스", profile.characterClassName],
    ["원정대", profile.expeditionLevel],
    ["전투 레벨", profile.characterLevel],
    ["아이템 레벨", profile.itemAvgLevel],
    ["전투력", profile.combatPower],
    ["낙원력", profile.paradisePower],
    ["길드", profile.guildName],
    ["칭호", cleanTitleText(profile.title)],
  ];

  return (
    <section className={styles.profileHero}>
      <div className={styles.profileImageFrame}>
        <img
          className={styles.profileImage}
          src={imageSrc}
          alt={`${profile.characterName} 캐릭터 이미지`}
          onError={() => setImageFailed(true)}
        />
      </div>
      <div className={styles.profileIdentity}>
        <p className={styles.modalSubtitle}>Character Profile</p>
        <h3>{displayValue(profile.characterName)}</h3>
        <div className={styles.profileStatsGrid}>
          {stats.map(([label, value]) => (
            <dl key={label} className={styles.profileStat}>
              <dt>{label}</dt>
              <dd>{displayValue(value)}</dd>
            </dl>
          ))}
        </div>
      </div>
    </section>
  );
}
