import { useEffect } from "react";
import { displayValue } from "../utils/characterParser.js";

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

export default function CharacterEngravingList({ engravings = [], styles }) {
  useEffect(() => {
    if (!isDevMode()) return;

    const fallbackItems = [];
    const rows = engravings.map((engraving) => {
      const engravingName = getEngravingName(engraving);
      const appliedSrc = getResolvedEngravingIconUrl(engravingName);
      const finalSrc = appliedSrc || DEFAULT_ENGRAVING_ICON_SRC;
      const source = appliedSrc ? "ENGRAVING_ICON_MAP" : "fallback";

      if (!appliedSrc) {
        fallbackItems.push(engravingName || "(empty)");
      }

      return {
        name: engravingName || "(empty)",
        appliedSrc: finalSrc,
        source,
      };
    });

    console.table(rows);
    console.log("[lostark engravings] ENGRAVING_ICON_MAP keys", Object.keys(ENGRAVING_ICON_MAP));

    if (fallbackItems.length) {
      console.warn("[lostark engravings] fallback engravings", fallbackItems);
    }
  }, [engravings]);

  if (!engravings.length) {
    return <p className={styles.modalEmpty}>0</p>;
  }

  return (
    <div className={styles.engravingList}>
      {engravings.map((engraving, index) => {
        const engravingName = getEngravingName(engraving);
        const iconUrl = getResolvedEngravingIconUrl(engravingName) || DEFAULT_ENGRAVING_ICON_SRC;
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

function getResolvedEngravingIconUrl(engravingName) {
  return ENGRAVING_ICON_MAP[String(engravingName || "").trim()] || "";
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
