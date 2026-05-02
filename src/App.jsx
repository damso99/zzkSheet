import { useEffect, useMemo, useState } from "react";
import { DEFAULT_RULES } from "./partyLogic.js";
import CharacterPage from "./pages/CharacterPage.jsx";
import SheetPage from "./pages/SheetPage.jsx";
import styles from "./App.module.css";

const DEFAULT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1pn-86CBr_9TzKI1zncCXpo3Ge0rKjg8zA99v6twX_gA/edit?gid=521341679#gid=521341679";
const LEGACY_DEFAULT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1pn-86CBr_9TzKI1zncCXpo3Ge0rKjg8zA99v6twX_gA/edit?usp=sharing";
const REFRESH_SECONDS = 30;

const routes = {
  sheet: { title: "Sheet Dashboard", label: "시트 시각화" },
  character: { title: "Character Armory", label: "캐릭터 정보" },
};

const initialRosters = readJson("lostark.rosters", []);
const savedSheetName = localStorage.getItem("lostark.sheetName") || "";
const initialSheetName = /공지/.test(savedSheetName) ? "" : savedSheetName;
const savedSheetUrl = localStorage.getItem("lostark.sheetUrl") || "";
const initialSheetUrl = !savedSheetUrl || savedSheetUrl === LEGACY_DEFAULT_SHEET_URL ? DEFAULT_SHEET_URL : savedSheetUrl;

export default function App() {
  const [route, setRoute] = useState(localStorage.getItem("lostark.activeView") || "sheet");
  const [sheetUrl, setSheetUrl] = useState(initialSheetUrl);
  const [sheetName, setSheetName] = useState(initialSheetName);
  const [draftUrl, setDraftUrl] = useState(sheetUrl);
  const [sheet, setSheet] = useState({ rows: [], updatedAt: "", sourceUrl: sheetUrl, sheetNames: [], selectedSheet: "" });
  const [rosters, setRosters] = useState(initialRosters);
  const [selectedRepresentative, setSelectedRepresentative] = useState(
    localStorage.getItem("lostark.selectedRepresentative") || initialRosters[0]?.representative || "",
  );
  const [characterQuery, setCharacterQuery] = useState("");
  const [status, setStatus] = useState("구글 시트 시각화와 캐릭터 정보를 함께 볼 수 있습니다.");
  const [isSheetLoading, setIsSheetLoading] = useState(false);
  const [isCharacterLoading, setIsCharacterLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const selectedRoster = useMemo(
    () => rosters.find((roster) => roster.representative === selectedRepresentative) || rosters[0] || null,
    [rosters, selectedRepresentative],
  );
  const sheetStats = useMemo(() => buildSheetStats(sheet.rows), [sheet.rows]);
  const totalCharacters = rosters.reduce((sum, roster) => sum + roster.characters.length, 0);

  useEffect(() => {
    let ignore = false;

    async function loadSheet() {
      setIsSheetLoading(true);
      setStatus("시트 데이터를 가져오는 중입니다.");

      try {
        const params = new URLSearchParams({ url: sheetUrl });
        if (sheetName) params.set("sheet", sheetName);
        const body = await fetchJson(`/api/sheet?${params.toString()}`);
        if (ignore) return;

        setSheet(body);
        if (body.selectedSheet && body.selectedSheet !== sheetName) {
          setSheetName(body.selectedSheet);
          localStorage.setItem("lostark.sheetName", body.selectedSheet);
        }
        setStatus(`${body.rows.length}행을 불러왔습니다. ${new Date(body.updatedAt).toLocaleTimeString("ko-KR")} 기준`);
      } catch (error) {
        if (!ignore) setStatus(error instanceof Error ? error.message : String(error));
      } finally {
        if (!ignore) setIsSheetLoading(false);
      }
    }

    loadSheet();

    return () => {
      ignore = true;
    };
  }, [sheetUrl, sheetName, refreshKey]);

  useEffect(() => {
    const timer = setInterval(() => setRefreshKey((value) => value + 1), REFRESH_SECONDS * 1000);
    return () => clearInterval(timer);
  }, []);

  function persist(next) {
    localStorage.setItem("lostark.rosters", JSON.stringify(next.rosters ?? rosters));
    localStorage.setItem("lostark.activeView", next.route ?? route);
    localStorage.setItem("lostark.selectedRepresentative", next.selectedRepresentative ?? selectedRepresentative);
  }

  function navigate(nextRoute) {
    setRoute(nextRoute);
    persist({ route: nextRoute });
  }

  function submitSheet(event) {
    event.preventDefault();
    const nextUrl = draftUrl.trim();
    if (!nextUrl) return;

    setSheetUrl(nextUrl);
    setSheetName("");
    localStorage.setItem("lostark.sheetUrl", nextUrl);
    localStorage.removeItem("lostark.sheetName");
    navigate("sheet");
  }

  function selectSheet(nextSheetName) {
    setSheetName(nextSheetName);
    localStorage.setItem("lostark.sheetName", nextSheetName);
    navigate("sheet");
  }

  async function searchRoster(event) {
    event.preventDefault();
    const name = characterQuery.trim();
    if (!name) return;

    setIsCharacterLoading(true);
    setStatus(`${name} 원정대와 Armories 정보를 조회하는 중입니다.`);

    try {
      const [rosterResult, armoryResult] = await Promise.allSettled([
        fetchJson(`/api/roster?name=${encodeURIComponent(name)}`),
        fetchJson(`/api/character?name=${encodeURIComponent(name)}`),
      ]);

      if (rosterResult.status === "rejected") throw rosterResult.reason;

      const roster = rosterResult.value;
      const armory = armoryResult.status === "fulfilled" ? armoryResult.value.armory : {};
      const previous = rosters.find((item) => item.representative === roster.representative);
      const nextRoster = {
        ...roster,
        armory,
        raidSelections: previous?.raidSelections || {},
        selectedCharacterName: name,
      };
      const nextRosters = [nextRoster, ...rosters.filter((item) => item.representative !== roster.representative)];

      setRosters(nextRosters);
      setSelectedRepresentative(roster.representative);
      setCharacterQuery("");
      setRoute("character");
      persist({ rosters: nextRosters, selectedRepresentative: roster.representative, route: "character" });
      setStatus(`${roster.representative} 원정대 ${roster.characters.length}명을 불러왔습니다.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCharacterLoading(false);
    }
  }

  async function loadRosterCharacter(characterName) {
    if (!selectedRoster) return;
    setIsCharacterLoading(true);
    setStatus(`${characterName} 상세 정보를 조회하는 중입니다.`);

    try {
      const body = await fetchJson(`/api/character?name=${encodeURIComponent(characterName)}`);
      const nextRosters = rosters.map((roster) =>
        roster.representative === selectedRoster.representative
          ? { ...roster, armory: body.armory, selectedCharacterName: characterName }
          : roster,
      );

      setRosters(nextRosters);
      setRoute("character");
      persist({ rosters: nextRosters, route: "character" });
      setStatus(`${characterName} Armories 정보를 불러왔습니다.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCharacterLoading(false);
    }
  }

  function updateCharacterRaidSelection(characterName, raidIds) {
    if (!selectedRoster) return;

    const nextRosters = rosters.map((roster) =>
      roster.representative === selectedRoster.representative
        ? {
            ...roster,
            raidSelections: {
              ...(roster.raidSelections || {}),
              [characterName]: raidIds.slice(0, 3),
            },
          }
        : roster,
    );

    setRosters(nextRosters);
    persist({ rosters: nextRosters });
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>{route === "sheet" ? "S" : "C"}</span>
          <div>
            <p>RAID STUDIO</p>
            <h1>Raid Sheet</h1>
          </div>
        </div>

        <form className={styles.searchBox} onSubmit={submitSheet}>
          <label htmlFor="sheet-url">구글 시트 링크</label>
          <div>
            <input
              id="sheet-url"
              value={draftUrl}
              onChange={(event) => setDraftUrl(event.target.value)}
              placeholder="시트 공유 링크 입력"
              autoComplete="off"
            />
            <button type="submit" disabled={isSheetLoading} aria-label="시트 불러오기">
              ↻
            </button>
          </div>
        </form>

        <form className={styles.searchBox} onSubmit={searchRoster}>
          <label htmlFor="character-search">대표 캐릭터</label>
          <div>
            <input
              id="character-search"
              value={characterQuery}
              onChange={(event) => setCharacterQuery(event.target.value)}
              placeholder="캐릭터명 입력"
              autoComplete="off"
            />
            <button type="submit" disabled={isCharacterLoading} aria-label="캐릭터 검색">
              ⌕
            </button>
          </div>
        </form>

        <nav className={styles.nav}>
          {Object.entries(routes).map(([key, item]) => (
            <button
              key={key}
              className={route === key ? styles.activeNav : ""}
              type="button"
              onClick={() => navigate(key)}
            >
              <span>{item.label}</span>
              <b>{key === "sheet" ? sheetStats.rowCount : totalCharacters}</b>
            </button>
          ))}
        </nav>

        {route === "sheet" && (
          <section className={styles.rulesPanel}>
            <header>
              <h3>자동 갱신</h3>
              <div className={styles.ruleActions}>
                <button type="button" onClick={() => setRefreshKey((value) => value + 1)} title="즉시 새로고침">
                  ↻
                </button>
              </div>
            </header>
            <p className={styles.muted}>시트가 공개 보기 상태이면 {REFRESH_SECONDS}초마다 다시 가져옵니다.</p>
          </section>
        )}
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <p>{status}</p>
            <h2>{routes[route]?.title || routes.sheet.title}</h2>
          </div>
          <div className={styles.metrics}>
            {route === "sheet" ? (
              <>
                <Metric label="행" value={sheetStats.rowCount} />
                <Metric label="열" value={sheetStats.columnCount} />
                <Metric label="숫자" value={sheetStats.numberCount} />
              </>
            ) : (
              <>
                <Metric label="원정대" value={rosters.length} />
                <Metric label="캐릭터" value={totalCharacters} />
                <Metric label="규칙" value={DEFAULT_RULES.length} />
              </>
            )}
          </div>
        </header>

        {route === "sheet" ? (
          <SheetPage
            sheet={sheet}
            isLoading={isSheetLoading}
            onRefresh={() => setRefreshKey((value) => value + 1)}
            onSelectSheet={selectSheet}
          />
        ) : (
          <CharacterPage
            roster={selectedRoster}
            rules={DEFAULT_RULES}
            onSelectCharacter={loadRosterCharacter}
            onUpdateRaidSelection={updateCharacterRaidSelection}
          />
        )}
      </main>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className={styles.metric}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function buildSheetStats(rows) {
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const numberCount = rows.flat().filter((cell) => isNumericCell(cell)).length;

  return {
    rowCount: rows.length,
    columnCount,
    numberCount,
  };
}

function isNumericCell(value) {
  return /^-?\d[\d,]*(?:\.\d+)?%?$/.test(String(value || "").trim());
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || fallback;
  } catch {
    return fallback;
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) throw new Error(body?.detail?.Message || body?.error || "요청에 실패했습니다.");
  return body;
}
