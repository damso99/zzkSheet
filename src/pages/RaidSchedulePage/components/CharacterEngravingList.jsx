import { useEffect } from "react";
import { displayValue, normalizeEngravingName } from "../utils/characterParser.js";

const ENGRAVING_ICON_MAP = Object.freeze({
  "\uC6D0\uD55C": "https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_7_15.png",
  "\uC608\uB9AC\uD55C \uB454\uAE30": "https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_7_29.png",
  "\uB3CC\uACA9\uB300\uC7A5": "https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_7_24.png",
  "\uC544\uB4DC\uB808\uB0A0\uB9B0": "https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_7_35.png",
  "\uACB0\uD22C\uC758 \uB300\uAC00": "https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_7_34.png",
});

const DEFAULT_ENGRAVING_ICON_SRC = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="54" height="54" viewBox="0 0 54 54" fill="none">
    <defs>
      <linearGradient id="engraving-gradient" x1="8" y1="8" x2="46" y2="46" gradientUnits="userSpaceOnUse">
        <stop stop-color="#a855f7" />
        <stop offset="1" stop-color="#38bdf8" />
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="52" height="52" rx="14" fill="#091326" stroke="url(#engraving-gradient)" stroke-width="2" />
    <circle cx="27" cy="27" r="15" fill="url(#engraving-gradient)" fill-opacity="0.16" />
    <path d="M19 20H35" stroke="#f4f7ff" stroke-opacity="0.92" stroke-width="2.4" stroke-linecap="round" />
    <path d="M18 27H36" stroke="#f4f7ff" stroke-opacity="0.84" stroke-width="2.4" stroke-linecap="round" />
    <path d="M20 34H34" stroke="#f4f7ff" stroke-opacity="0.76" stroke-width="2.4" stroke-linecap="round" />
    <path d="M23 15C22.2 18.5 21.9 22.1 21.9 27C21.9 31.9 22.2 35.5 23 39" stroke="url(#engraving-gradient)" stroke-width="2.4" stroke-linecap="round" />
    <path d="M31 15C31.8 18.5 32.1 22.1 32.1 27C32.1 31.9 31.8 35.5 31 39" stroke="url(#engraving-gradient)" stroke-width="2.4" stroke-linecap="round" />
  </svg>`,
)}`;

export default function CharacterEngravingList({ engravings = [], engravingImageMap = new Map(), styles }) {
  const sharedApiIconUrl = getSharedApiIconUrl(engravings);

  useEffect(() => {
    if (!isDevMode()) return;

    const rows = engravings.map((engraving) => {
      const engravingName = getEngravingName(engraving);
      const apiIcon = getRealApiIconUrl(engraving);
      const fallbackIcon = getHardcodedIconUrl(engravingName);
      const mapIcon = getMappedIconUrl(engravingName, engravingImageMap);
      const finalIcon = getFinalIconUrl(engraving, engravingImageMap, sharedApiIconUrl);
      const source = getIconSource(finalIcon, { apiIcon, mapIcon, fallbackIcon, sharedApiIconUrl });

      console.log(`[engraving-icon] ${engravingName || "(empty)"}`, {
        engraving,
        apiIcon,
        mapIcon,
        fallbackIcon,
        finalIcon,
        renderedSrc: finalIcon || DEFAULT_ENGRAVING_ICON_SRC,
        source,
      });

      return {
        name: engravingName || "(empty)",
        apiIcon,
        mapIcon,
        fallbackIcon,
        finalIcon: finalIcon || DEFAULT_ENGRAVING_ICON_SRC,
        source,
      };
    });

    const apiCount = rows.filter((row) => row.source === "api").length;
    const fallbackCount = rows.filter((row) => row.source === "fallback").length;
    const defaultCount = rows.filter((row) => row.source === "default").length;

    console.table(rows);
    console.log("[lostark engravings] ENGRAVING_ICON_MAP keys", Object.keys(ENGRAVING_ICON_MAP));
    console.log("[lostark engravings] source ratio", {
      api: apiCount,
      fallback: fallbackCount,
      default: defaultCount,
    });
  }, [engravings, engravingImageMap, sharedApiIconUrl]);

  if (!engravings.length) {
    return <p className={styles.modalEmpty}>0</p>;
  }

  return (
    <div className={styles.engravingList}>
      {engravings.map((engraving, index) => {
        const engravingName = getEngravingName(engraving);
        const iconUrl = getFinalIconUrl(engraving, engravingImageMap, sharedApiIconUrl) || DEFAULT_ENGRAVING_ICON_SRC;
        const level = formatEngravingLevel(engraving.Level ?? engraving.level);

        return (
          <article key={`${engravingName || "engraving"}-${index}`} className={styles.engravingCard}>
            <img
              className={styles.itemIcon}
              src={iconUrl}
              alt={engravingName || "engraving icon"}
              onError={handleEngravingIconError}
            />
            <div>
              <div className={styles.itemMeta}>
                <strong>Lv.{level}</strong>
              </div>
              <h4>{displayValue(engravingName)}</h4>
              {engraving.description ? <p>{engraving.description}</p> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function getFinalIconUrl(engraving, engravingImageMap, sharedApiIconUrl) {
  const engravingName = getEngravingName(engraving);
  const realApiIconUrl = getRealApiIconUrl(engraving);
  const mapIconUrl = getMappedIconUrl(engravingName, engravingImageMap);
  const fallbackIconUrl = getHardcodedIconUrl(engravingName);

  if (isUsableIconUrl(realApiIconUrl) && realApiIconUrl !== sharedApiIconUrl) {
    return realApiIconUrl;
  }

  if (isUsableIconUrl(mapIconUrl)) {
    return mapIconUrl;
  }

  if (isUsableIconUrl(fallbackIconUrl)) {
    return fallbackIconUrl;
  }

  return "";
}

function getIconSource(finalIconUrl, { apiIcon, mapIcon, fallbackIcon, sharedApiIconUrl }) {
  if (isUsableIconUrl(apiIcon) && apiIcon !== sharedApiIconUrl && finalIconUrl === apiIcon) return "api";
  if (isUsableIconUrl(mapIcon) && finalIconUrl === mapIcon) return "api";
  if (isUsableIconUrl(fallbackIcon) && finalIconUrl === fallbackIcon) return "fallback";
  if (!finalIconUrl) return "default";
  return "api";
}

function getRealApiIconUrl(engraving) {
  return (
    engraving?.realApiIconUrl ||
    engraving?.apiIconUrl ||
    engraving?.tooltipIconUrl ||
    engraving?.effectIconUrl ||
    engraving?.Icon ||
    engraving?.icon ||
    engraving?.IconUrl ||
    engraving?.iconUrl ||
    engraving?.Effect?.Icon ||
    engraving?.effect?.icon ||
    engraving?.Effect?.icon ||
    engraving?.effect?.Icon ||
    ""
  );
}

function getMappedIconUrl(engravingName, engravingImageMap) {
  if (!engravingImageMap) return "";

  return engravingImageMap.get(engravingName) || engravingImageMap.get(normalizeEngravingName(engravingName)) || "";
}

function getHardcodedIconUrl(engravingName) {
  return ENGRAVING_ICON_MAP[String(engravingName || "").trim()] || "";
}

function getSharedApiIconUrl(engravings = []) {
  const icons = engravings.map((engraving) => getRealApiIconUrl(engraving)).filter(Boolean);
  if (icons.length <= 1) return "";

  const uniqueIcons = [...new Set(icons)];
  return uniqueIcons.length === 1 ? uniqueIcons[0] : "";
}

function isUsableIconUrl(value) {
  const icon = String(value || "").trim();
  if (!icon) return false;

  const lower = icon.toLowerCase();
  if (lower.startsWith("data:image")) return false;
  if (lower.includes("profile") || lower.includes("default") || lower.includes("placeholder")) return false;
  return true;
}

function handleEngravingIconError(event) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = DEFAULT_ENGRAVING_ICON_SRC;
}

function getEngravingName(engraving) {
  return String(
    engraving?.Name ||
      engraving?.name ||
      engraving?.EngravingName ||
      engraving?.Title ||
      engraving?.raw?.Name ||
      engraving?.raw?.name ||
      "",
  ).trim();
}

function formatEngravingLevel(level) {
  if (level == null || level === "") return "0";
  return String(level);
}

function isDevMode() {
  return Boolean(import.meta?.env?.DEV);
}
