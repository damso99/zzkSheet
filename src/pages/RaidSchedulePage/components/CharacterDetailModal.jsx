import { useEffect, useState } from "react";
import CharacterArkGridPanel from "./CharacterArkGridPanel.jsx";
import CharacterArkPassivePanel from "./CharacterArkPassivePanel.jsx";
import CharacterCardSet from "./CharacterCardSet.jsx";
import CharacterEquipmentGrid from "./CharacterEquipmentGrid.jsx";
import CharacterGemGrid from "./CharacterGemGrid.jsx";
import CharacterProfileHeader from "./CharacterProfileHeader.jsx";
import CharacterSkillList from "./CharacterSkillList.jsx";
import { normalizeCharacterDetail } from "../utils/characterParser.js";

const CHARACTER_DETAIL_CACHE_VERSION = "compact-ark-tabs-v11";
const CHARACTER_DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;
const characterDetailCache = new Map();
const characterDetailInFlight = new Map();

const DETAIL_TABS = [
  { key: "profile", label: "프로필" },
  { key: "equipment", label: "장비" },
  { key: "gems", label: "보석" },
  { key: "arkPassive", label: "아크 패시브" },
  { key: "arkGrid", label: "아크 그리드" },
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

    if (
      cachedDetail?.version === CHARACTER_DETAIL_CACHE_VERSION &&
      Date.now() - cachedDetail.createdAt < CHARACTER_DETAIL_CACHE_TTL_MS
    ) {
      setDetail(cachedDetail.detail);
      setIsLoading(false);
      return;
    }

    if (cachedDetail?.detail) {
      setDetail(cachedDetail.detail);
      setIsLoading(false);
    } else {
      setDetail(null);
    }

    const controller = new AbortController();

    async function loadCharacterDetail() {
      if (!cachedDetail?.detail) {
        setIsLoading(true);
      }

      try {
        const parsedDetail = await fetchCharacterDetail({
          cacheKey,
          characterName: normalizedName,
          signal: controller.signal,
        });
        characterDetailCache.set(cacheKey, {
          createdAt: Date.now(),
          version: CHARACTER_DETAIL_CACHE_VERSION,
          detail: parsedDetail,
        });
        setDetail(parsedDetail);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (!cachedDetail?.detail) {
          setDetail(null);
        }
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
      <section className={styles.modalShell} role="dialog" aria-modal="true" aria-labelledby="character-detail-title">
        <header className={styles.modalHeader}>
          <div className={styles.modalTitleBlock}>
            <span>LostArk OpenAPI</span>
            <h2 id="character-detail-title">{modalTitle}</h2>
          </div>
          <button type="button" className={styles.modalCloseButton} onClick={onClose} aria-label="닫기">
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
                  role="tab"
                  aria-selected={activeTab === tab.key}
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
                  일부 OpenAPI 응답이 비어 있어 해당 영역은 정보 없음으로 표시됩니다.
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
    return <CharacterEquipmentGrid equipment={detail.equipment} engravings={detail.engravings} styles={styles} />;
  }

  if (activeTab === "gems") {
    return <CharacterGemGrid gems={detail.gems} styles={styles} />;
  }

  if (activeTab === "arkPassive") {
    return <CharacterArkPassivePanel arkPassive={detail.arkPassive} styles={styles} />;
  }

  if (activeTab === "arkGrid") {
    return <CharacterArkGridPanel arkGrid={detail.arkGrid} styles={styles} />;
  }

  if (activeTab === "cards") {
    return <CharacterCardSet cards={detail.cards} styles={styles} />;
  }

  return <CharacterSkillList skills={detail.skills} styles={styles} />;
}

function buildErrorMessage(payload, status) {
  if (payload?.code === "MISSING_LOSTARK_API_KEY") {
    return payload.detail || "Vercel 환경 변수에 LOSTARK_API_KEY 설정이 필요합니다.";
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

async function fetchCharacterDetail({ cacheKey, characterName, signal }) {
  if (signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }

  if (characterDetailInFlight.has(cacheKey)) {
    return withAbortSignal(characterDetailInFlight.get(cacheKey), signal);
  }

  const promise = (async () => {
    const response = await fetch(`/api/lostark/characters/${encodeURIComponent(characterName)}`);
    const payload = await readJsonSafely(response);

    if (!response.ok) {
      throw new Error(buildErrorMessage(payload, response.status));
    }

    return normalizeCharacterDetail(payload);
  })();

  characterDetailInFlight.set(cacheKey, promise);

  try {
    return await withAbortSignal(promise, signal);
  } finally {
    if (characterDetailInFlight.get(cacheKey) === promise) {
      characterDetailInFlight.delete(cacheKey);
    }
  }
}

function withAbortSignal(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException("The operation was aborted.", "AbortError"));
  }

  return new Promise((resolve, reject) => {
    const handleAbort = () => {
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };

    signal.addEventListener("abort", handleAbort, { once: true });

    promise.then(
      (value) => {
        signal.removeEventListener("abort", handleAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", handleAbort);
        reject(error);
      },
    );
  });
}
