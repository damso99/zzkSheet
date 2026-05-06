import { useEffect, useState } from "react";
import CharacterCardSet from "./CharacterCardSet.jsx";
import CharacterEngravingList from "./CharacterEngravingList.jsx";
import CharacterEquipmentGrid from "./CharacterEquipmentGrid.jsx";
import CharacterGemGrid from "./CharacterGemGrid.jsx";
import CharacterProfileHeader from "./CharacterProfileHeader.jsx";
import CharacterSkillList from "./CharacterSkillList.jsx";
import { normalizeCharacterDetail } from "../utils/characterParser.js";

const CHARACTER_DETAIL_CACHE_VERSION = "engraving-arkgrid-map-v8";
const characterDetailCache = new Map();

const DETAIL_TABS = [
  { key: "profile", label: "프로필" },
  { key: "equipment", label: "장비" },
  { key: "gems", label: "보석" },
  { key: "engravings", label: "각인" },
  { key: "cards", label: "카드" },
  { key: "skills", label: "스킬" },
];

export default function CharacterDetailModal({ characterName, onClose, styles }) {
  const [activeTab, setActiveTab] = useState("profile");
  const [detail, setDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    const normalizedName = characterName.trim();
    const cacheKey = normalizedName.toLocaleLowerCase("ko-KR");
    const cachedDetail = characterDetailCache.get(cacheKey);

    setActiveTab("profile");
    setErrorMessage("");

    if (cachedDetail?.version === CHARACTER_DETAIL_CACHE_VERSION) {
      setDetail(cachedDetail.detail);
      setIsLoading(false);
      return;
    }

    if (cachedDetail) {
      characterDetailCache.delete(cacheKey);
    }

    const controller = new AbortController();

    async function loadCharacterDetail() {
      setIsLoading(true);

      try {
        // 브라우저에서는 공식 OpenAPI를 직접 호출하지 않고, 키가 숨겨진 서버 프록시만 호출합니다.
        const response = await fetch(`/api/lostark/characters/${encodeURIComponent(normalizedName)}`, {
          signal: controller.signal,
        });
        const payload = await readJsonSafely(response);

        if (!response.ok) {
          throw new Error(buildErrorMessage(payload, response.status));
        }

        const parsedDetail = normalizeCharacterDetail(payload);
        characterDetailCache.set(cacheKey, {
          version: CHARACTER_DETAIL_CACHE_VERSION,
          detail: parsedDetail,
        });
        setDetail(parsedDetail);
      } catch (error) {
        if (controller.signal.aborted) return;
        setDetail(null);
        setErrorMessage(error instanceof Error ? error.message : String(error));
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    loadCharacterDetail();

    return () => controller.abort();
  }, [characterName]);

  const modalTitle = detail?.profile?.characterName || characterName;

  return (
    <div className={styles.modalOverlay} role="presentation">
      <section
        className={styles.modalShell}
        role="dialog"
        aria-modal="true"
        aria-labelledby="character-detail-title"
      >
        <header className={styles.modalHeader}>
          <div className={styles.modalTitleBlock}>
            <span>Lostark OpenAPI</span>
            <h2 id="character-detail-title">{modalTitle}</h2>
          </div>
          <button type="button" className={styles.modalCloseButton} onClick={onClose} aria-label="캐릭터 상세 닫기">
            ×
          </button>
        </header>

        {isLoading ? (
          <div className={styles.modalLoading}>캐릭터 정보를 불러오는 중입니다.</div>
        ) : errorMessage ? (
          <div className={styles.modalError} role="alert">
            {errorMessage}
          </div>
        ) : detail ? (
          <>
            <nav className={styles.modalTabs} aria-label="캐릭터 상세 탭">
              {DETAIL_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={activeTab === tab.key ? styles.activeModalTab : styles.modalTab}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className={styles.modalBody}>
              {detail.warnings.length ? (
                <p className={styles.modalNote}>
                  일부 OpenAPI 엔드포인트 응답이 비어 있거나 실패해 해당 영역은 정보 없음으로 표시됩니다.
                </p>
              ) : null}
              {renderTabPanel(activeTab, detail, styles)}
            </div>
          </>
        ) : (
          <div className={styles.modalEmpty}>정보 없음</div>
        )}
      </section>
    </div>
  );

}

function renderTabPanel(activeTab, detail, styles) {
  if (activeTab === "profile") {
    return <CharacterProfileHeader profile={detail.profile} styles={styles} />;
  }

  if (activeTab === "equipment") {
    return <CharacterEquipmentGrid equipment={detail.equipment} styles={styles} />;
  }

  if (activeTab === "gems") {
    return <CharacterGemGrid gems={detail.gems} styles={styles} />;
  }

  if (activeTab === "engravings") {
    return (
      <CharacterEngravingList
        engravings={detail.engravings}
        engravingImageMap={detail.engravingImageMap}
        styles={styles}
      />
    );
  }

  if (activeTab === "cards") {
    return <CharacterCardSet cards={detail.cards} styles={styles} />;
  }

  return <CharacterSkillList skills={detail.skills} styles={styles} />;
}

function buildErrorMessage(payload, status) {
  if (payload?.code === "MISSING_LOSTARK_API_KEY") {
    return payload.detail || "Vercel 환경변수 LOSTARK_API_KEY 설정이 필요합니다.";
  }

  return payload?.detail || payload?.error || `캐릭터 정보를 불러오지 못했습니다. (${status})`;
}

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}
