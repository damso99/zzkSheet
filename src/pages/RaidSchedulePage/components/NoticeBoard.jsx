import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_SHEET_URL } from "../utils/sheetApi.js";

const NOTICE_SHEET_NAME = "디코공지";
const NOTICE_CELL = "C2";
const REFRESH_MS = 60 * 1000;

function getNoticeRows(rows) {
  const value = rows?.[0]?.[0];
  const text = String(value ?? "").trim();
  return text ? [[text]] : [];
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
        const params = new URLSearchParams({
          url: DEFAULT_SHEET_URL,
          sheet: NOTICE_SHEET_NAME,
          range: NOTICE_CELL,
        });
        // The API requests headers=0 so the requested cell (C2) is returned as data.
        if (forceRefresh) params.set("_refresh", String(Date.now()));
        const response = await fetch(`/api/raid-sheet?${params}`);
        if (!response.ok) throw new Error("공지사항 셀을 불러오지 못했습니다.");
        const result = await response.json();
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
      <div
        className={styles.noticeBoardPreview}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="공지사항 크게 보기"
        onClick={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        <div className={styles.noticeBoardHeader}>
          <strong>공지사항</strong>
          <span className={styles.noticeBoardTriggerHint}>클릭해서 크게 보기 ↗</span>
        </div>
        {noticeContents}
      </div>
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
