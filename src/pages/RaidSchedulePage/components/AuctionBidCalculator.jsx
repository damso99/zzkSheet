import { useMemo, useState } from "react";
import styles from "./AuctionBidCalculator.module.css";

const PARTICIPANT_OPTIONS = [4, 8];
const GOLD_FORMATTER = new Intl.NumberFormat("ko-KR");

export default function AuctionBidCalculator() {
  const [itemPriceText, setItemPriceText] = useState("");
  const [participantCount, setParticipantCount] = useState(8);

  const itemPrice = useMemo(() => parsePrice(itemPriceText), [itemPriceText]);
  const result = useMemo(() => calculateAuctionBid(itemPrice, participantCount), [itemPrice, participantCount]);

  const handlePriceChange = (event) => {
    const nextValue = event.target.value.replace(/[^\d]/g, "");
    setItemPriceText(nextValue ? formatNumber(nextValue) : "");
  };

  const handleReset = () => {
    setItemPriceText("");
    setParticipantCount(8);
  };

  return (
    <section className={styles.calculatorShell} aria-labelledby="auction-calculator-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>쌀산기</p>
          <h2 id="auction-calculator-title">쌀산기</h2>
          <p className={styles.description}>
            직접사용과 판매 상황을 나눠서, 입찰 적정가와 분배금을 함께 계산합니다.
          </p>
        </div>

        <button type="button" className={styles.resetButton} onClick={handleReset}>
          금액 초기화
        </button>
      </header>

      <div className={styles.layout}>
        <form className={styles.inputPanel} onSubmit={(event) => event.preventDefault()}>
          <div className={styles.field}>
            <label htmlFor="auction-item-price">템 가격</label>
            <div className={styles.inputWrap}>
              <input
                id="auction-item-price"
                inputMode="numeric"
                placeholder="가격을 입력해 주세요"
                value={itemPriceText}
                onChange={handlePriceChange}
              />
              <span className={styles.goldUnit} aria-hidden="true">
                G
              </span>
            </div>
            <p className={styles.helpText}>천 단위 콤마가 자동으로 표시됩니다.</p>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>입찰 인원</span>
            <div className={styles.optionGroup} role="radiogroup" aria-label="입찰 인원 선택">
              {PARTICIPANT_OPTIONS.map((option) => (
                <label key={option} className={styles.optionCard}>
                  <input
                    type="radio"
                    name="participantCount"
                    value={option}
                    checked={participantCount === option}
                    onChange={() => setParticipantCount(option)}
                  />
                  <span>{option}명</span>
                </label>
              ))}
            </div>
          </div>

        </form>

        <section className={styles.resultPanel} aria-label="계산 결과">
          <ResultSection
            title="직접사용"
            subtitle="템을 직접 사용할 때의 적정 입찰가"
            rows={[
              { label: "실제 가치", value: formatGold(result.direct.actualValue) },
              { label: "입찰적정가", value: formatGold(result.direct.optimalBid) },
              { label: "분배금", value: formatGold(result.direct.distribution) },
            ]}
          />

          <ResultSection
            title="판매"
            subtitle="템 가격 기준 차익을 함께 보여줍니다."
            rows={[
              { label: "수수료", value: formatGold(result.sale.fee) },
              { label: "손익분기점", value: formatGold(result.sale.breakEvenBid) },
              { label: "분배금", value: formatGold(result.sale.breakEvenDistribution) },
              { label: "판매차익", value: formatGold(result.sale.breakEvenProfit) },
            ]}
          />

          <div className={styles.recommendCard}>
            <div className={styles.recommendHeader}>
              <div>
                <p>추천 입찰가</p>
                <h3>{formatGold(result.sale.recommendedBid)}</h3>
              </div>
              <span className={styles.recommendBadge}>95%</span>
            </div>
            <div className={styles.recommendGrid}>
              <div>
                <span>분배금</span>
                <strong>{formatGold(result.sale.recommendedDistribution)}</strong>
              </div>
              <div>
                <span>판매차익</span>
                <strong>{formatGold(result.sale.recommendedProfit)}</strong>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

function ResultSection({ title, subtitle, rows }) {
  return (
    <section className={styles.resultSection}>
      <header className={styles.resultSectionHeader}>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </header>

      <div className={styles.resultRows}>
        {rows.map((row) => (
          <div key={row.label} className={styles.resultRow}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function calculateAuctionBid(itemPrice, participantCount) {
  const safePrice = Math.max(0, Math.floor(itemPrice));
  const safeParticipantCount = participantCount === 4 ? 4 : 8;
  const fee = Math.floor(safePrice * 0.05);
  const netSettlement = Math.max(0, safePrice - fee);

  const directOptimalBid = findMaxAffordableBid(safePrice, safeParticipantCount);
  const directDistribution = calculateDistribution(directOptimalBid, safeParticipantCount);

  const breakEvenBid = findMaxAffordableBid(netSettlement, safeParticipantCount);
  const breakEvenDistribution = calculateDistribution(breakEvenBid, safeParticipantCount);
  const breakEvenProfit = Math.max(0, netSettlement - breakEvenBid - breakEvenDistribution);

  const recommendedBid = Math.max(0, Math.floor(breakEvenBid * 0.95));
  const recommendedDistribution = calculateDistribution(recommendedBid, safeParticipantCount);
  const recommendedProfit = Math.max(0, netSettlement - recommendedBid - recommendedDistribution);

  return {
    direct: {
      actualValue: safePrice,
      optimalBid: directOptimalBid,
      distribution: directDistribution,
    },
    sale: {
      fee,
      netSettlement,
      breakEvenBid,
      breakEvenDistribution,
      breakEvenProfit,
      recommendedBid,
      recommendedDistribution,
      recommendedProfit,
    },
  };
}

function findMaxAffordableBid(limit, participantCount) {
  const safeLimit = Math.max(0, Math.floor(limit));
  const divisor = Math.max(1, participantCount - 1);
  let low = 0;
  let high = safeLimit;

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    const totalCost = mid + Math.floor(mid / divisor);

    if (totalCost <= safeLimit) {
      low = mid;
      continue;
    }

    high = mid - 1;
  }

  return low;
}

function calculateDistribution(bid, participantCount) {
  const divisor = Math.max(1, participantCount - 1);
  return Math.floor(Math.max(0, Math.floor(bid)) / divisor);
}

function parsePrice(text) {
  const digits = String(text ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function formatNumber(value) {
  return GOLD_FORMATTER.format(Math.max(0, Math.floor(value)));
}

function formatGold(value) {
  return `${formatNumber(value)} G`;
}
