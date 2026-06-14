import { useMemo, useState } from "react";
import styles from "./AuctionBidSidebar.module.css";

const PARTICIPANT_OPTIONS = [4, 8];
const GOLD_FORMATTER = new Intl.NumberFormat("ko-KR");

export default function AuctionBidSidebar() {
  const [itemPriceText, setItemPriceText] = useState("");
  const [participantCount, setParticipantCount] = useState(8);

  const itemPrice = useMemo(() => parsePrice(itemPriceText), [itemPriceText]);
  const saleOptimalBid = useMemo(
    () => calculateSaleOptimalBid(itemPrice, participantCount),
    [itemPrice, participantCount],
  );

  const handlePriceChange = (event) => {
    const nextValue = event.target.value.replace(/[^\d]/g, "");
    setItemPriceText(nextValue ? formatNumber(nextValue) : "");
  };

  return (
    <aside className={styles.sidebar} aria-labelledby="auction-sidebar-title">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>쌀산기</p>
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="auction-sidebar-price">템 가격</label>
        <div className={styles.inputWrap}>
          <input
            id="auction-sidebar-price"
            inputMode="numeric"
            placeholder="가격을 입력해주세요"
            value={itemPriceText}
            onChange={handlePriceChange}
          />
          <span className={styles.goldUnit} aria-hidden="true">
            G
          </span>
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>참여 인원</span>
        <div className={styles.optionGroup} role="radiogroup" aria-label="참여 인원 선택">
          {PARTICIPANT_OPTIONS.map((option) => (
            <label key={option} className={styles.optionCard}>
              <input
                type="radio"
                name="sidebarParticipantCount"
                value={option}
                checked={participantCount === option}
                onChange={() => setParticipantCount(option)}
              />
              <span>{option}명</span>
            </label>
          ))}
        </div>
      </div>

      <section className={styles.resultCard} aria-label="판매가 기준 입찰가 결과">
        <span className={styles.resultLabel}>판매가 기준 입찰가</span>
        <strong className={styles.resultValue}>{formatGold(saleOptimalBid)}</strong>
        <p className={styles.resultHelp}>판매가에서 수수료를 뺀 기준으로 계산한 값입니다.</p>
      </section>
    </aside>
  );
}

function calculateSaleOptimalBid(itemPrice, participantCount) {
  const safePrice = Math.max(0, Math.floor(itemPrice));
  const safeParticipantCount = participantCount === 4 ? 4 : 8;
  const saleFee = Math.floor(safePrice * 0.05);
  const netSettlement = Math.max(0, safePrice - saleFee);
  return findMaxAffordableBid(netSettlement, safeParticipantCount);
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
    } else {
      high = mid - 1;
    }
  }

  return low;
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
