export default function RaidParticipantTable({ participants, styles }) {
  if (!participants.length) {
    return <p className={styles.emptyParticipants}>참여자 정보가 없습니다.</p>;
  }

  return (
    <div className={styles.participantTableWrap}>
      <table className={styles.participantTable}>
        <thead>
          <tr>
            <th scope="col">참여자</th>
            <th scope="col">캐릭터명</th>
            <th scope="col">주인이름</th>
            <th scope="col">레벨</th>
            <th scope="col">전투력</th>
          </tr>
        </thead>
        <tbody>
          {participants.map((participant, index) => (
            <tr key={`${participant.characterName}-${participant.ownerName}-${index}`}>
              <td>{index + 1}</td>
              <td>{participant.characterName}</td>
              <td>{participant.ownerName}</td>
              <td>{participant.level}</td>
              <td>{participant.power}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
