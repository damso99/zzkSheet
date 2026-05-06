export default function RaidParticipantTable({ participants, styles, onCharacterClick, selectedOwnerName = "" }) {
  if (!participants.length) {
    return <p className={styles.emptyParticipants}>참여자 정보가 없습니다.</p>;
  }

  return (
    <>
      <div className={styles.participantTableWrap}>
        <table className={styles.participantTable}>
          <thead>
            <tr>
              <th scope="col">참여자</th>
              <th scope="col">캐릭터명</th>
              <th scope="col">이름</th>
              <th scope="col">레벨</th>
              <th scope="col">전투력</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((participant, index) => {
              const isSelected = isSelectedOwner(participant, selectedOwnerName);

              return (
                <tr
                  key={`${participant.characterName}-${participant.ownerName}-${index}`}
                  className={isSelected ? styles.participantHighlight : ""}
                >
                  <td>{index + 1}</td>
                  <td>
                    {renderCharacterName({
                      characterName: participant.characterName,
                      onCharacterClick,
                      styles,
                    })}
                  </td>
                  <td>{participant.ownerName}</td>
                  <td>{participant.level}</td>
                  <td>{participant.power}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.mobileParticipantList}>
        {participants.map((participant, index) => {
          const isSelected = isSelectedOwner(participant, selectedOwnerName);

          return (
            <article
              key={`${participant.characterName}-${participant.ownerName}-${index}-mobile`}
              className={`${styles.mobileParticipantCard} ${isSelected ? styles.participantHighlight : ""}`}
            >
              {renderCharacterName({
                characterName: participant.characterName,
                onCharacterClick,
                styles,
                className: styles.mobileCharacterNameButton,
              })}
              <p>
                <span>{participant.ownerName}</span>
                <span>Lv.{participant.level}</span>
                <span>전투력 {participant.power}</span>
              </p>
            </article>
          );
        })}
      </div>
    </>
  );
}

function isSelectedOwner(participant, selectedOwnerName) {
  return Boolean(selectedOwnerName) && participant.ownerName === selectedOwnerName;
}

function renderCharacterName({ characterName, onCharacterClick, styles, className = styles.characterNameButton }) {
  if (!onCharacterClick) return <strong className={styles.mobileCharacterNameText}>{characterName}</strong>;

  return (
    <button type="button" className={className} onClick={() => onCharacterClick(characterName)}>
      {characterName}
    </button>
  );
}
