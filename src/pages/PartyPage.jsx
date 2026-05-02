import { getClassSynergies } from "../synergy.js";
import styles from "../App.module.css";

export default function PartyPage({ plan }) {
  if (plan.length === 0) {
    return <Empty title="파티 규칙이 없습니다" message="숙제 규칙을 추가하면 자동 파티가 생성됩니다." />;
  }

  return (
    <section className={styles.planner}>
      {plan.map((dayPlan) => {
        const activeRaids = dayPlan.raids.filter((group) => group.parties.length > 0);

        return (
          <section className={styles.dayBlock} key={dayPlan.day}>
            <header>
              <div>
                <span>Schedule</span>
                <h3>{dayPlan.day}요일</h3>
              </div>
              <p>{activeRaids.reduce((sum, group) => sum + group.parties.length, 0)}개 파티</p>
            </header>

            {activeRaids.length === 0 && <p className={styles.muted}>편성 가능한 파티가 없습니다.</p>}
            {activeRaids.map((group) => (
              <article className={styles.raidBlock} key={`${dayPlan.day}-${group.rule.id}`}>
                <header>
                  <div>
                    <span>{group.rule.minLevel.toLocaleString("ko-KR")}+</span>
                    <h3>{group.rule.name}</h3>
                  </div>
                  <p>
                    {group.eligibleCount}명 · {group.rule.maxMembers}인
                  </p>
                </header>
                <div className={styles.partyGrid}>
                  {group.parties.map((party) => (
                    <div className={styles.partyCard} key={party.id}>
                      <div className={styles.partyTitle}>
                        <strong>{party.partyNumber}파티</strong>
                        <span>
                          {party.members.length}/{party.maxMembers}
                        </span>
                      </div>
                      {party.members.map((member) => (
                        <MemberRow member={member} key={`${party.id}-${member.owner}-${member.name}`} />
                      ))}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>
        );
      })}
    </section>
  );
}

function MemberRow({ member }) {
  const synergies = getClassSynergies(member.className);

  return (
    <div className={`${styles.memberRow} ${member.isSupport ? styles.support : ""}`}>
      <div>
        <strong>{member.name}</strong>
        <span>
          {member.owner} · {member.className}
        </span>
        {synergies.length > 0 && (
          <div className={styles.synergyBadges}>
            {synergies.map((synergy) => (
              <small key={synergy}>{synergy}</small>
            ))}
          </div>
        )}
      </div>
      <b>{member.itemLevelText}</b>
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
