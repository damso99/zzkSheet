import { useEffect, useMemo, useState } from "react";
import styles from "./PersonalSchedulePage.module.css";

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
      const response = await fetch(`/api/personal-schedule?type=personal`, {
        method: "GET",
        signal,
      });

      const payload = await readJsonSafely(response);

      if (!response.ok) {
        throw new Error(payload?.message || "개인일정 목록을 불러오지 못했습니다.");
      }

      setItems(normalizePersonalSchedules(payload));
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error("[personal schedule] load error", error);
      if (!silent) setErrorMessage(error.message);
    } finally {
      if (!signal?.aborted && !silent) setIsLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
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
      const response = await fetch("/api/personal-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await readJsonSafely(response);

      if (!response.ok || result?.success === false) {
        throw new Error(result?.message || "등록 실패");
      }

      setMessage("등록 완료");
      setForm(INITIAL_FORM);

      await loadPersonalSchedules({ silent: true });

    } catch (error) {
      console.error("[personal schedule] submit error", error);
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  return (
      <main className={styles.page}>
        <div className={styles.content}>
          <h1>개인 일정</h1>

          <form className={styles.form} onSubmit={handleSubmit}>
            <input
                type="date"
                value={form.date}
                onChange={(e) => updateField("date", e.target.value)}
            />
            <input
                type="text"
                placeholder="이름"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
            />
            <input
                type="text"
                placeholder="사유"
                value={form.reason}
                onChange={(e) => updateField("reason", e.target.value)}
            />

            <button disabled={isSubmitting}>
              {isSubmitting ? "등록중..." : "등록"}
            </button>
          </form>

          {message && <p>{message}</p>}
          {errorMessage && <p>{errorMessage}</p>}

          {isLoading ? (
              <p>불러오는 중...</p>
          ) : (
              <div>
                {sortedItems.map((item) => (
                    <div key={item.id}>
                      <strong>{item.date}</strong> - {item.name} - {item.reason}
                    </div>
                ))}
              </div>
          )}
        </div>
      </main>
  );
}

/* ---------- util ---------- */

function normalizePersonalSchedules(data) {
  if (!Array.isArray(data)) return [];

  return data.map((item, i) => ({
    id: i,
    date: item.date,
    name: item.name,
    reason: item.reason,
  }));
}

function sortPersonalSchedules(items, mode) {
  if (mode === "date") {
    return [...items].sort((a, b) => a.date.localeCompare(b.date));
  }
  return [...items].reverse();
}

async function readJsonSafely(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}