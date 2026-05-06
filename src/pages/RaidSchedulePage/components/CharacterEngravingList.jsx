import { useEffect, useId } from "react";
import { displayValue } from "../utils/characterParser.js";

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

    engravings.forEach((engraving, index) => {
      const engravingName = getEngravingName(engraving);
      const iconUrl = getEngravingIconUrl(engraving);
      const iconFields = getEngravingIconFieldSnapshot(engraving);

      console.log("[lostark engravings] render engraving object", {
        index,
        engraving,
        engravingName,
        iconUrl,
        iconFields,
      });

      if (!iconUrl) {
        fallbackItems.push({
          index,
          engravingName,
          iconFields,
        });
      }
    });

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
        const iconUrl = getEngravingIconUrl(engraving);

        return (
          <article key={`${engravingName || "engraving"}-${index}`} className={styles.engravingCard}>
            {iconUrl ? (
              <img
                className={styles.itemIcon}
                src={iconUrl}
                alt={engravingName || "engraving icon"}
                onError={handleEngravingIconError}
              />
            ) : (
              <DefaultEngravingIcon className={styles.itemIcon} />
            )}
            <div>
              <div className={styles.itemMeta}>
                <strong>Lv.{formatEngravingLevel(engraving.Level ?? engraving.level)}</strong>
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

function getEngravingIconUrl(engraving) {
  const rawIcon =
    engraving?.Icon ??
    engraving?.icon ??
    engraving?.Effect?.Icon ??
    engraving?.effect?.icon ??
    engraving?.Image ??
    engraving?.image ??
    engraving?.IconUrl ??
    engraving?.iconUrl ??
    engraving?.ImageUrl ??
    engraving?.imageUrl ??
    "";

  return normalizeIconUrl(rawIcon);
}

function getEngravingIconFieldSnapshot(engraving) {
  return {
    Icon: engraving?.Icon,
    icon: engraving?.icon,
    EffectIcon: engraving?.Effect?.Icon,
    effectIcon: engraving?.effect?.icon,
    Image: engraving?.Image,
    image: engraving?.image,
    IconUrl: engraving?.IconUrl,
    iconUrl: engraving?.iconUrl,
    ImageUrl: engraving?.ImageUrl,
    imageUrl: engraving?.imageUrl,
  };
}

function normalizeIconUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.startsWith("data:image/")) return text;
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("//")) return `https:${text}`;
  if (text.startsWith("/")) return `https://cdn-lostark.game.onstove.com${text}`;
  return text;
}

function formatEngravingLevel(level) {
  if (level == null || level === "" || level === "?뺣낫 ?놁쓬") return "0";
  return String(level);
}

function isDevMode() {
  return Boolean(import.meta?.env?.DEV);
}

function DefaultEngravingIcon({ className }) {
  const gradientId = useId();

  return (
    <svg
      className={className}
      viewBox="0 0 54 54"
      role="img"
      aria-label="engraving default icon"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="8" y1="8" x2="46" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a855f7" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <rect
        x="1"
        y="1"
        width="52"
        height="52"
        rx="14"
        fill="#091326"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
      />
      <circle cx="27" cy="27" r="15" fill={`url(#${gradientId})`} fillOpacity="0.16" />
      <path d="M19 20H35" stroke="#f4f7ff" strokeOpacity="0.92" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M18 27H36" stroke="#f4f7ff" strokeOpacity="0.84" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 34H34" stroke="#f4f7ff" strokeOpacity="0.76" strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="M23 15C22.2 18.5 21.9 22.1 21.9 27C21.9 31.9 22.2 35.5 23 39"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M31 15C31.8 18.5 32.1 22.1 32.1 27C32.1 31.9 31.8 35.5 31 39"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
