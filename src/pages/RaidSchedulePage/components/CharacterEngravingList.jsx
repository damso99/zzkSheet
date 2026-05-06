import { useEffect } from "react";
import {
  CHARACTER_PLACEHOLDER_IMAGE,
  displayValue,
  normalizeEngravingName,
} from "../utils/characterParser.js";

export default function CharacterEngravingList({ engravings, styles }) {
  const engravingImageMap = buildEngravingImageMap(engravings);

  useEffect(() => {
    if (!isDevMode()) return;

    const fallbackItems = [];
    console.debug("[lostark engravings] image map keys", [...engravingImageMap.keys()]);

    engravings.forEach((engraving, index) => {
      const engravingName = getEngravingName(engraving);
      const normalizedName = normalizeEngravingName(engravingName);
      const imageUrl = resolveEngravingImageUrl(engraving, engravingImageMap);

      console.debug("[lostark engravings] render engraving object", {
        index,
        engraving,
        engravingName,
        normalizedName,
        directFields: getEngravingFieldSnapshot(engraving),
        imageUrl,
      });

      if (imageUrl === CHARACTER_PLACEHOLDER_IMAGE) {
        fallbackItems.push({ index, engravingName, normalizedName });
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
      {engravings.map((engraving, index) => (
        <article key={`${engraving.name}-${index}`} className={styles.engravingCard}>
          <img
            className={styles.itemIcon}
            src={resolveEngravingImageUrl(engraving, engravingImageMap)}
            alt=""
            onError={replaceWithPlaceholder}
          />
          <div>
            <div className={styles.itemMeta}>
              <strong>Lv.{formatEngravingLevel(engraving.level)}</strong>
            </div>
            <h4>{displayValue(engraving.name)}</h4>
            {engraving.description ? <p>{engraving.description}</p> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function replaceWithPlaceholder(event) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = CHARACTER_PLACEHOLDER_IMAGE;
}

function buildEngravingImageMap(engravings) {
  const map = new Map();

  engravings.forEach((engraving) => {
    const engravingName = getEngravingName(engraving);
    const normalizedName = normalizeEngravingName(engravingName);
    const imageUrl = getDirectEngravingImageCandidates(engraving).find(Boolean) || extractImageUrlsFromValue(engraving?.raw || engraving).find(Boolean);

    if (normalizedName && imageUrl && !map.has(normalizedName)) {
      map.set(normalizedName, imageUrl);
    }
  });

  return map;
}

function resolveEngravingImageUrl(engraving, engravingImageMap) {
  const directImageUrl = getDirectEngravingImageCandidates(engraving).find(Boolean);
  if (directImageUrl) return directImageUrl;

  const engravingName = getEngravingName(engraving);
  const normalizedName = normalizeEngravingName(engravingName);
  const mappedImageUrl = engravingImageMap.get(normalizedName);
  if (mappedImageUrl) return mappedImageUrl;

  return CHARACTER_PLACEHOLDER_IMAGE;
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

function getDirectEngravingImageCandidates(engraving) {
  return [
    engraving?.Icon,
    engraving?.icon,
    engraving?.IconUrl,
    engraving?.iconUrl,
    engraving?.Image,
    engraving?.image,
    engraving?.ImageUrl,
    engraving?.imageUrl,
  ]
    .map(normalizeImageCandidate)
    .filter(Boolean);
}

function getEngravingFieldSnapshot(engraving) {
  return {
    name: getEngravingName(engraving),
    Name: engraving?.Name,
    nameField: engraving?.name,
    Level: engraving?.Level,
    level: engraving?.level,
    Grade: engraving?.Grade,
    grade: engraving?.grade,
    Icon: engraving?.Icon,
    icon: engraving?.icon,
    IconUrl: engraving?.IconUrl,
    iconUrl: engraving?.iconUrl,
    Image: engraving?.Image,
    image: engraving?.image,
    ImageUrl: engraving?.ImageUrl,
    imageUrl: engraving?.imageUrl,
  };
}

function normalizeImageCandidate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.startsWith("/api/")) return text;
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("//")) return `https:${text}`;
  if (text.startsWith("/")) return `https://cdn-lostark.game.onstove.com${text}`;
  return "";
}

function extractImageUrlsFromValue(value, images = [], seen = new Set()) {
  if (!value || seen.has(value)) return images;
  if (typeof value === "string") {
    extractImageUrlsFromString(value).forEach((url) => {
      const normalized = normalizeImageCandidate(url);
      if (normalized && !images.includes(normalized)) images.push(normalized);
    });
    return images;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => extractImageUrlsFromValue(item, images, seen));
    return images;
  }
  if (typeof value === "object") {
    seen.add(value);
    for (const child of Object.values(value)) {
      extractImageUrlsFromValue(child, images, seen);
    }
  }

  return images;
}

function extractImageUrlsFromString(value) {
  const text = String(value || "").replace(/\\\//g, "/").replace(/&amp;/g, "&");
  const httpUrls = text.match(/https?:\/\/[^"'`\s<>]+?\.(?:png|jpg|jpeg|webp|gif)(?:\?[^"'`\s<>]*)?/gi) || [];
  const imgUrls = [...text.matchAll(/<img\b[^>]*\bsrc=['"]?([^"'`\s>]+)['"]?[^>]*>/gi)].map((match) => match[1]);
  const assetPaths = [...text.matchAll(/(?:\/)?(?:EFUI|efui)[^"'`\s<>]+?\.(?:png|jpg|jpeg|webp|gif)/gi)].map((match) =>
    match[0].startsWith("/") ? match[0] : `/${match[0]}`,
  );
  return [...httpUrls, ...imgUrls, ...assetPaths];
}

function formatEngravingLevel(level) {
  if (level == null || level === "" || level === "정보 없음") return "0";
  return String(level);
}

function isDevMode() {
  return Boolean(import.meta?.env?.DEV);
}
