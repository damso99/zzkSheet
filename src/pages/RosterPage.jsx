import { WEEKDAYS, getCharacterAvailableDays, getPartyCharacterNames, normalizeCharacter } from "../partyLogic.js";
import styles from "../App.module.css";

export default function RosterPage({
  roster,
  onSelectCharacter,
  onUpdatePartyCharacterSelection,
  onUpdateCharacterSchedule,
}) {
  if (!roster) {
    return <Empty title="보유 캐릭터가 없습니다" message="대표 캐릭터를 검색하면 원정대 캐릭터가 표시됩니다." />;
  }

  const partyCharacterNames = new Set(getPartyCharacterNames(roster));
  const characters = roster.characters
    .map((character) => ({
      raw: character,
      normalized: normalizeCharacter(character, roster.representative),
      availableDays: getCharacterAvailableDays(character, roster),
    }))
    .sort((a, b) => b.normalized.itemLevel - a.normalized.itemLevel);

  function toggleDay(characterName, currentDays, day) {
    const nextDays = currentDays.includes(day)
      ? currentDays.filter((item) => item !== day)
      : [...currentDays, day].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b));

    onUpdateCharacterSchedule(characterName, nextDays);
  }

  return (
    <div className={styles.rosterPageStack}>
      <section className={styles.schedulePanel}>
        <header>
          <div>
            <span>{roster.representative}</span>
            <h3>개인 일정</h3>
          </div>
          <p>캐릭터별 가능한 요일을 선택하세요.</p>
        </header>
        <div className={styles.scheduleList}>
          {characters.map(({ raw, normalized: member, availableDays }) => (
            <article className={styles.scheduleCard} key={member.name}>
              <div>
                <strong>{member.name}</strong>
                <span>
                  {member.className} · {member.itemLevelText}
                </span>
              </div>
              <div className={styles.dayPicker}>
                {WEEKDAYS.map((day) => (
                  <button
                    className={availableDays.includes(day) ? styles.activeDay : ""}
                    type="button"
                    key={`${raw.CharacterName}-schedule-${day}`}
                    onClick={() => toggleDay(raw.CharacterName, availableDays, day)}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.indexPanel}>
        <header>
          <div>
            <span>{roster.representative}</span>
            <h3>파티 참여 캐릭터</h3>
          </div>
          <p>
            {partyCharacterNames.size}/{characters.length}명 참여
          </p>
        </header>
        <div className={styles.table}>
          <div className={`${styles.tableHead} ${styles.rosterTableHead}`}>
            <span>참여</span>
            <span>캐릭터</span>
            <span>직업</span>
            <span>서버</span>
            <span>아이템 레벨</span>
          </div>
          {characters.map(({ normalized: member }) => {
            const enabled = partyCharacterNames.has(member.name);

            return (
              <div className={`${styles.tableRow} ${styles.rosterTableRow}`} key={member.name}>
                <label className={styles.partyToggle}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => onUpdatePartyCharacterSelection(member.name, event.target.checked)}
                  />
                  <span>{enabled ? "참여" : "제외"}</span>
                </label>
                <button className={styles.characterOpenButton} type="button" onClick={() => onSelectCharacter(member.name)}>
                  {member.name}
                </button>
                <span>{member.className}</span>
                <span>{member.serverName}</span>
                <strong>{member.itemLevelText}</strong>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Empty({ title, message }) {
  return (
    <section className={styles.empty}>
      <div />
      <h3>{title}</h3>
      <p>{message}</p>
    </section>
  );
}
