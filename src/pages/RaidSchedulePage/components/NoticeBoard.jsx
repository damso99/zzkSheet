import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef(null);

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

  useEffect(() => {
    if (!isOpen) return;
    const saved = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    const onKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      Object.assign(document.body.style, saved);
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  const noticeContents = status === "loading" ? (
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
  );

  return (
    <section className={styles.noticeBoard} aria-label="공지사항">
      <button type="button" className={styles.noticeBoardTrigger} onClick={() => setIsOpen(true)} aria-haspopup="dialog" aria-expanded={isOpen}>
        <span className={styles.noticeBoardTriggerTitle}>공지사항</span>
        <span className={styles.noticeBoardTriggerHint}>클릭해서 크게 보기 ↗</span>
      </button>
      {isOpen && createPortal(
        <div className={styles.noticeModalOverlay} onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsOpen(false);
        }}>
          <div className={styles.noticeModalShell} role="dialog" aria-modal="true" aria-label="공지사항" aria-describedby="notice-modal-description">
            <header className={styles.noticeModalHeader}>
              <div>
                <h2>공지사항</h2>
                <p id="notice-modal-description">구글 시트 공지사항</p>
              </div>
              <button ref={closeButtonRef} className={styles.noticeModalClose} type="button" onClick={() => setIsOpen(false)} aria-label="공지사항 닫기">×</button>
            </header>
            <div className={styles.noticeModalBody}>{noticeContents}</div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
