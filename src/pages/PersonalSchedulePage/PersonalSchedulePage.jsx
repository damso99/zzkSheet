import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import { ko } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import styles from "./PersonalSchedulePage.module.css";

registerLocale("ko", ko);

const PERSONAL_SCHEDULE_API_URL = "/api/personal-schedule";

const SORT_OPTIONS = {
  latest: "최신순",
  date: "날짜순",
};

const INITIAL_FORM = {
  date: "",
  name: "",
  reason: "",
};

export default function PersonalSchedulePage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [items, setItems] = useState([]);
  const [sortMode, setSortMode] = useState("latest");
  const [selectedFilterDate, setSelectedFilterDate] = useState(() => new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const filterDatePickerRef = useRef(null);

  const sortedItems = useMemo(() => sortPersonalSchedules(items, sortMode), [items, sortMode]);
  const selectedFilterDateIso = useMemo(() => formatDateForInput(selectedFilterDate), [selectedFilterDate]);
  const filteredItems = useMemo(
    () => sortedItems.filter((item) => item.date === selectedFilterDateIso),
    [selectedFilterDateIso, sortedItems],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadPersonalSchedules({ signal: controller.signal });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!filterDatePickerRef.current?.contains(event.target)) {
        setIsCalendarOpen(false);
      }
    }

    if (isCalendarOpen) document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isCalendarOpen]);

  async function loadPersonalSchedules({ signal, silent = false } = {}) {
    if (!silent) {
      setIsLoading(true);
      setErrorMessage("");
    }

    try {
      const response = await fetch(`${PERSONAL_SCHEDULE_API_URL}?type=personal`, {
        method: "GET",
        signal,
      });
      const payload = await readJsonSafely(response);

      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || "개인일정 목록을 불러오지 못했습니다.");
      }

      setItems(normalizePersonalSchedules(payload));
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error("[personal schedule] failed to load schedules", error);
      if (!silent) setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (!signal?.aborted && !silent) setIsLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    const payload = {
      type: "personal",
      date: form.date.trim(),
      name: form.name.trim(),
      reason: form.reason.trim(),
    };

    if (!payload.date || !payload.name || !payload.reason) {
      setErrorMessage("날짜, 이름, 사유를 모두 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(PERSONAL_SCHEDULE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
      });
      const responsePayload = await readJsonSafely(response);

      if (!response.ok || responsePayload?.success === false) {
        throw new Error(responsePayload?.message || responsePayload?.error || "개인일정 등록에 실패했습니다.");
      }

      setMessage("등록 완료");
      setForm(INITIAL_FORM);
      setItems((currentItems) => [
        normalizePersonalScheduleItem({ ...payload, createdAt: new Date().toISOString() }, currentItems.length),
        ...currentItems,
      ]);
      await loadPersonalSchedules({ silent: true });
    } catch (error) {
      console.error("[personal schedule] failed to submit schedule", error);
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField(fieldName, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [fieldName]: value,
    }));
  }

  function handleFilterDateSelect(date) {
    if (!date) return;
    setSelectedFilterDate(date);
    setIsCalendarOpen(false);
  }

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} />
      <div className={styles.content}>
        <header className={styles.hero}>
          <a className={styles.backLink} href="/">
            레이드 일정으로 돌아가기
          </a>
          <p className={styles.eyebrow}>Personal Schedule</p>
          <h1>개인 일정</h1>
          <p>레이드 참여가 어려운 날짜와 사유를 Google Sheet 개인일정 탭에 기록합니다.</p>
        </header>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>개인일정 등록</h2>
              <p>날짜, 이름, 사유는 모두 필수입니다.</p>
            </div>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label>
              <span>날짜</span>
              <input
                type="date"
                value={form.date}
                required
                onChange={(event) => updateField("date", event.target.value)}
              />
            </label>
            <label>
              <span>이름</span>
              <input
                type="text"
                value={form.name}
                required
                placeholder="예: 태경"
                onChange={(event) => updateField("name", event.target.value)}
              />
            </label>
            <label className={styles.reasonField}>
              <span>사유</span>
              <input
                type="text"
                value={form.reason}
                required
                placeholder="예: 야근, 약속, 휴가"
                onChange={(event) => updateField("reason", event.target.value)}
              />
            </label>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "등록 중..." : "등록"}
            </button>
          </form>

          {message ? <p className={styles.successMessage}>{message}</p> : null}
          {errorMessage ? (
            <p className={styles.errorMessage} role="alert">
              {errorMessage}
            </p>
          ) : null}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>개인일정 목록</h2>
              <p>{formatDateLabel(selectedFilterDateIso)}에 등록된 개인일정입니다.</p>
            </div>
            <div className={styles.panelControls}>
              <label className={styles.datePickerField} ref={filterDatePickerRef}>
                <span>조회 날짜</span>
                <DatePicker
                  selected={selectedFilterDate}
                  onChange={handleFilterDateSelect}
                  onCalendarOpen={() => setIsCalendarOpen(true)}
                  onCalendarClose={() => setIsCalendarOpen(false)}
                  locale="ko"
                  dateFormat="yyyy년 M월 d일 (eee)"
                  popperClassName={styles.datePickerPopper}
                  calendarClassName={styles.datePickerCalendar}
                  wrapperClassName={styles.datePickerControl}
                  customInput={<DatePickerButton isOpen={isCalendarOpen} />}
                />
              </label>
              <label className={styles.sortSelect}>
                <span>정렬</span>
                <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
                  {Object.entries(SORT_OPTIONS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {isLoading ? (
            <div className={styles.emptyState}>개인일정을 불러오는 중입니다.</div>
          ) : filteredItems.length ? (
            <div className={styles.scheduleList}>
              {filteredItems.map((item) => (
                <article key={item.id} className={styles.scheduleCard}>
                  <time dateTime={item.date}>{formatDateLabel(item.date)}</time>
                  <strong>{item.name || "이름 없음"}</strong>
                  <p>{item.reason || "사유 없음"}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>선택한 날짜의 개인일정이 없습니다.</div>
          )}
        </section>
      </div>
    </main>
  );
}

function normalizePersonalSchedules(payload) {
  const rawItems = Array.isArray(payload)
    ? payload
    : payload?.items || payload?.schedules || payload?.rows || payload?.data || [];

  return rawItems
    .map((item, index) => normalizePersonalScheduleItem(item, index))
    .filter((item) => item.date || item.name || item.reason);
}

function normalizePersonalScheduleItem(item, index) {
  if (Array.isArray(item)) {
    return {
      id: `${item[0] || "date"}-${item[1] || "name"}-${index}`,
      date: normalizeDate(item[0]),
      name: String(item[1] || "").trim(),
      reason: String(item[2] || "").trim(),
      createdAt: normalizeDateTime(item[3]),
    };
  }

  return {
    id: String(item?.id || `${item?.date || "date"}-${item?.name || "name"}-${index}`),
    date: normalizeDate(item?.date || item?.날짜),
    name: String(item?.name || item?.이름 || "").trim(),
    reason: String(item?.reason || item?.사유 || "").trim(),
    createdAt: normalizeDateTime(item?.createdAt || item?.registeredAt || item?.등록시간),
  };
}

function sortPersonalSchedules(items, sortMode) {
  return items.slice().sort((left, right) => {
    if (sortMode === "date") {
      return `${left.date} ${left.createdAt}`.localeCompare(`${right.date} ${right.createdAt}`);
    }

    return `${right.createdAt || right.date}`.localeCompare(`${left.createdAt || left.date}`);
  });
}

function normalizeDate(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function normalizeDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

function formatDateForInput(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateButtonLabel(date) {
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

const DatePickerButton = forwardRef(function DatePickerButton({ value, onClick, isOpen }, ref) {
  return (
    <button
      type="button"
      className={styles.datePickerButton}
      onClick={onClick}
      ref={ref}
      aria-expanded={isOpen}
    >
      <CalendarIcon />
      <strong>{value}</strong>
    </button>
  );
});

function formatDateLabel(value) {
  if (!value) return "날짜 없음";

  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  } catch {
    return value;
  }
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.calendarIcon}>
      <path
        d="M7 2.75v2.5M17 2.75v2.5M3.75 9.25h16.5M6.25 5.25h11.5a2.5 2.5 0 0 1 2.5 2.5v10a2.5 2.5 0 0 1-2.5 2.5H6.25a2.5 2.5 0 0 1-2.5-2.5v-10a2.5 2.5 0 0 1 2.5-2.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
