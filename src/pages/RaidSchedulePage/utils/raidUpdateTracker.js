const STORAGE_KEY = "zzkSheet.raidUpdates.v1";
const MAX_SEEN_RAIDS = 200;

export function getRaidTrackingKey(raid) {
  return [raid.date, raid.time || raid.blockTime, raid.startCol, raid.startRow]
    .map((value) => String(value ?? ""))
    .join("|");
}

export function getRaidContentSignature(raid) {
  return JSON.stringify({
    date: raid.date || "",
    time: raid.time || raid.blockTime || "",
    raidName: raid.raidName || "",
    participants: (raid.participants || []).map((participant) => ({
      characterName: participant.characterName || "",
      level: participant.level || "",
      ownerName: participant.ownerName || "",
      power: participant.power || "",
    })),
  });
}

export function findUpdatedRaidKeys(raids) {
  const currentEntries = raids.map((raid) => [getRaidTrackingKey(raid), getRaidContentSignature(raid)]);
  const savedState = readSavedState();

  if (!savedState.initialized) {
    const seen = Object.fromEntries(
      currentEntries.map(([key, signature]) => [key, { signature, seenAt: Date.now() }]),
    );
    writeSavedState({ initialized: true, seen });
    return new Set();
  }

  return new Set(
    currentEntries
      .filter(([key, signature]) => savedState.seen[key]?.signature !== signature)
      .map(([key]) => key),
  );
}

export function markRaidAsSeen(raid) {
  const savedState = readSavedState();
  const key = getRaidTrackingKey(raid);
  const seen = {
    ...savedState.seen,
    [key]: {
      signature: getRaidContentSignature(raid),
      seenAt: Date.now(),
    },
  };
  const trimmedSeen = Object.fromEntries(
    Object.entries(seen)
      .sort(([, left], [, right]) => (right.seenAt || 0) - (left.seenAt || 0))
      .slice(0, MAX_SEEN_RAIDS),
  );

  writeSavedState({ initialized: true, seen: trimmedSeen });
  return key;
}

function readSavedState() {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    if (value?.initialized && value.seen && typeof value.seen === "object") {
      return value;
    }
  } catch {
    // Treat unavailable or malformed storage as a first visit.
  }

  return { initialized: false, seen: {} };
}

function writeSavedState(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // The update marker still works for the current page when storage is unavailable.
  }
}
