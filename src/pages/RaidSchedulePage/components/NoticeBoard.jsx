import { useEffect, useState } from "react";
import { DEFAULT_SHEET_URL, loadSheetRowsByName } from "../utils/sheetApi.js";

const NOTICE_SHEET_NAME = "공지사항";
const REFRESH_MS = 60 * 1000;

function getNoticeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => (Array.isArray(row) ? row : [])
      .map((value) => String(value ?? "").trim())
      .filter(Boolean))
    .filter((cells) => cells.length > 0);
}

export default function NoticeBoard({ styles }) {
  const [noticeRows, setNoticeRows] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;

    async function refresh(forceRefresh = false) {
      try {
        const result = await loadSheetRowsByName({
          sheetUrl: DEFAULT_SHEET_URL,
          sheetName: NOTICE_SHEET_NAME,
          forceRefresh,
        });
        if (cancelled) return;
        setNoticeRows(getNoticeRows(result?.rows));
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus((previous) => previous === "ready" ? previous : "error");
      }
    }

    refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh(true);
    }, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className={styles.noticeBoard} aria-label="공지사항">
      <div className={styles.noticeBoardHeader}>
        <strong>공지사항</strong>
      </div>
      {status === "loading" ? (
        <p className={styles.noticeBoardStatus}>공지사항을 불러오는 중입니다.</p>
      ) : status === "error" ? (
        <p className={styles.noticeBoardStatus}>공지사항을 불러오지 못했습니다.</p>
      ) : noticeRows.length === 0 ? (
        <p className={styles.noticeBoardStatus}>등록된 공지사항이 없습니다.</p>
      ) : (
        <ul className={styles.noticeBoardList}>
          {noticeRows.map((cells, index) => (
            <li key={index} className={styles.noticeBoardItem}>
              {cells.map((cell, columnIndex) => (
                <span key={columnIndex} className={styles.noticeBoardCell}>{cell}</span>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
