export default function RaidSearch({ value, onChange, styles }) {
  return (
    <div className={styles.searchBox}>
      <label htmlFor="owner-search">이름 검색</label>
      <input
        id="owner-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="검색할 이름을 입력하세요"
        autoComplete="off"
      />
      <p className={styles.searchHint}>
        이름으로 검색하면 해당 인원이 참여한 레이드와 캐릭터만 보여줍니다.
      </p>
    </div>
  );
}
