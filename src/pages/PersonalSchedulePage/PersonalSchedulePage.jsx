import { forwardRef, useEffect, useMemo, useState } from "react";
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

export default function PersonalSchedulePage({ embedded = false }) {
  const [form, setForm] = useState(createInitialForm);
  const [items, setItems] = useState([]);
  const [sortMode, setSortMode] = useState("latest");
  const [isFormCalendarOpen, setIsFormCalendarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const sortedItems = useMemo(() => sortPersonalSchedules(items, sortMode), [items, sortMode]);

  useEffect(() => {
    const controller = new AbortController();
    loadPersonalSchedules({ signal: controller.signal });

    return () => controller.abort();
  }, []);

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
      setForm(createInitialForm());
      setItems((currentItems) => [
        normalizePersonalScheduleItem({ ...payload, createdAt: formatLocalDateTime(new Date()) }, currentItems.length),
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

  function handleFormDateSelect(date) {
    if (!date) return;
    updateField("date", formatLocalDate(date));
    setIsFormCalendarOpen(false);
  }

  return (
    <main className={embedded ? styles.embeddedPage : styles.page}>
      {!embedded ? <div className={styles.backdrop} /> : null}
      <div className={embedded ? styles.embeddedContent : styles.content}>
        <header className={styles.hero}>
          {!embedded ? (
            <a className={styles.backLink} href="/">
              레이드 일정표로 돌아가기
            </a>
          ) : null}
          <p className={styles.eyebrow}>Personal Schedule</p>
          <h1>개인 일정</h1>
          <p>개인 참여가 필요한 날짜와 사유를 Google Sheet 개인일정 탭에 기록합니다.</p>
        </header>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>개인일정 등록</h2>
              <p>날짜, 이름, 사유를 모두 입력해 주세요.</p>
            </div>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.datePickerField}>
              <span>날짜</span>
              <DatePicker
                selected={form.date ? parseLocalDate(form.date) : new Date()}
                onChange={handleFormDateSelect}
                onCalendarOpen={() => setIsFormCalendarOpen(true)}
                onCalendarClose={() => setIsFormCalendarOpen(false)}
                locale="ko"
                dateFormat="yyyy-MM-dd (eee)"
                popperPlacement="bottom-start"
                popperProps={{ strategy: "fixed" }}
                portalId="root"
                popperClassName={styles.datePickerPopper}
                calendarClassName={styles.datePickerCalendar}
                wrapperClassName={styles.datePickerControl}
                customInput={<DatePickerButton isOpen={isFormCalendarOpen} placeholder="날짜 선택" />}
              />
            </label>
            <label>
              <span>이름</span>
              <input
                type="text"
                value={form.name}
                required
                placeholder="이름을 입력해 주세요"
                onChange={(event) => updateField("name", event.target.value)}
              />
            </label>
            <label className={styles.reasonField}>
              <span>사유</span>
              <input
                type="text"
                value={form.reason}
                required
                placeholder="예) 회식, 출장, 병원"
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
              <p>Google Sheet 개인일정 탭에서 불러온 목록입니다.</p>
            </div>
            <div className={styles.panelControls}>
              <label className={styles.sortSelect}>
                <span>정렬</span>
                <span className={styles.selectShell}>
                  <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
                    {Object.entries(SORT_OPTIONS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <SelectArrow />
                </span>
              </label>
            </div>
          </div>

          {isLoading ? (
            <div className={styles.emptyState}>개인일정을 불러오는 중입니다.</div>
          ) : sortedItems.length ? (
            <div className={styles.scheduleList}>
              {sortedItems.map((item) => (
                <article key={item.id} className={styles.scheduleCard}>
                  <time dateTime={formatScheduleDateTimeValue(item.date)}>{formatScheduleDateLabel(item.date)}</time>
                  <strong>{item.name || "이름 없음"}</strong>
                  <p>{item.reason || "사유 없음"}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>개인일정이 없습니다.</div>
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

function createInitialForm() {
  return {
    date: formatLocalDate(new Date()),
    name: "",
    reason: "",
  };
}

function sortPersonalSchedules(items, sortMode) {
  return items.slice().sort((left, right) => {
    if (sortMode === "date") {
      const leftTime = getLocalDateTime(left.date);
      const rightTime = getLocalDateTime(right.date);
      if (leftTime !== rightTime) return leftTime - rightTime;

      return `${left.createdAt || ""} ${left.name || ""}`.localeCompare(
        `${right.createdAt || ""} ${right.name || ""}`,
      );
    }

    return `${right.createdAt || right.date || ""}`.localeCompare(`${left.createdAt || left.date || ""}`);
  });
}

function normalizeDate(value) {
  return normalizePersonalDate(value);
}

function normalizeDateTime(value) {
  if (!value) return "";
  if (value instanceof Date) return formatLocalDateTime(value);
  return String(value).trim();
}

function formatLocalDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseLocalDate(value) {
  const parts = parsePersonalDateParts(value);
  if (!parts) return new Date();

  const date = new Date(parts.year, parts.month - 1, parts.day);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatLocalDateTime(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const sec = String(date.getSeconds()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`;
}

function formatScheduleDateLabel(dateString) {
  return normalizePersonalDate(dateString) || "날짜 확인 필요";
}

function formatScheduleDateTimeValue(dateString) {
  const parsed = parsePersonalDateParts(dateString);
  if (!parsed) return "";

  const { year, month, day } = parsed;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getLocalDateTime(dateString) {
  const parsed = parsePersonalDateParts(dateString);
  if (!parsed) return 0;
  return new Date(parsed.year, parsed.month - 1, parsed.day).getTime();
}

function normalizePersonalDate(value) {
  if (value == null || value === "") return "";

  const parsed = parsePersonalDateParts(value);
  if (parsed) return formatDateParts(parsed.year, parsed.month, parsed.day);

  return String(value).trim();
}

function parsePersonalDateParts(value) {
  if (value == null || value === "") return null;

  if (value instanceof Date) {
    return getValidDateParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 2000 ? serialDateToParts(value) : null;
  }

  const text = String(value).trim();
  if (!text) return null;

  const gvizMatch = text.match(
    /^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,\d{1,2},\d{1,2},\d{1,2})?\)$/,
  );
  if (gvizMatch) {
    return getValidDateParts(Number(gvizMatch[1]), Number(gvizMatch[2]) + 1, Number(gvizMatch[3]));
  }

  const isoTimestampMatch = text.match(/^\d{4}-\d{1,2}-\d{1,2}T/);
  if (isoTimestampMatch) {
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return null;
    return getValidDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  const yearFirstMatch = text.match(/^(\d{4})[./-]\s*(\d{1,2})[./-]\s*(\d{1,2})\.?$/);
  if (yearFirstMatch) {
    return getValidDateParts(
      Number(yearFirstMatch[1]),
      Number(yearFirstMatch[2]),
      Number(yearFirstMatch[3]),
    );
  }

  const koreanDateMatch = text.match(/^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?$/);
  if (koreanDateMatch) {
    return getValidDateParts(
      Number(koreanDateMatch[1]),
      Number(koreanDateMatch[2]),
      Number(koreanDateMatch[3]),
    );
  }

  const usDateMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usDateMatch) {
    return getValidDateParts(
      Number(usDateMatch[3]),
      Number(usDateMatch[1]),
      Number(usDateMatch[2]),
    );
  }

  const numericValue = Number(text);
  if (Number.isFinite(numericValue) && numericValue > 2000) {
    return serialDateToParts(numericValue);
  }

  return null;
}

function serialDateToParts(serialNumber) {
  const date = new Date(1899, 11, 30);
  date.setDate(date.getDate() + Math.floor(serialNumber));
  return getValidDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function getValidDateParts(year, month, day) {
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function formatDateParts(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const DatePickerButton = forwardRef(function DatePickerButton({ value, onClick, isOpen, placeholder }, ref) {
  return (
    <button
      type="button"
      className={styles.datePickerButton}
      onClick={onClick}
      ref={ref}
      aria-expanded={isOpen}
    >
      <CalendarIcon />
      <strong>{value || placeholder}</strong>
    </button>
  );
});

function SelectArrow() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={styles.selectArrow}>
      <path
        d="M5.5 7.5 10 12l4.5-4.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
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
