import { useEffect, useState } from "react";
import RaidSchedulePage from "./pages/RaidSchedulePage/RaidSchedulePage.jsx";
import WeeklyGoldPage from "./pages/WeeklyGoldPage/WeeklyGoldPage.jsx";
import { DEFAULT_SHEET_URL } from "./pages/RaidSchedulePage/utils/sheetApi.js";

const NAV_ITEMS = [
  { path: "/", label: "금일 일정" },
  { path: "/week", label: "주간 일정" },
  { path: "/auction", label: "쌀산기" },
  { path: "/personal-raid", label: "레이드 참여 현황" },
  { path: "/personal", label: "개인 일정" },
  { path: "/weekly-gold", label: "주간 골드" },
];

const EXTERNAL_SITES = [
  { label: "로펙", href: "https://lopec.kr/" },
  { label: "로아랩", href: "https://lo4.app/" },
  { label: "로아와", href: "https://loawa.com/" },
  { label: "로아업", href: "https://loaup.com/" },
  { label: "로아베스팅", href: "https://www.loavesting.com/" },
];

function normalizePath(pathname) {
  return pathname.replace(/\/$/, "") || "/";
}

function getTabFromPath(path) {
  if (path === "/week") return "week";
  if (path === "/personal") return "personal";
  if (path === "/personal-raid") return "personalRaid";
  if (path === "/auction") return "auction";
  return "today";
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => normalizePath(window.location.pathname));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [raidPageVisited, setRaidPageVisited] = useState(() => normalizePath(window.location.pathname) !== "/weekly-gold");
  const [weeklyGoldVisited, setWeeklyGoldVisited] = useState(() => normalizePath(window.location.pathname) === "/weekly-gold");

  const isWeeklyGold = currentPath === "/weekly-gold";
  const initialTab = getTabFromPath(currentPath);

  useEffect(() => {
    const handlePopState = () => {
      const nextPath = normalizePath(window.location.pathname);
      setCurrentPath(nextPath);
      if (nextPath === "/weekly-gold") setWeeklyGoldVisited(true);
      else setRaidPageVisited(true);
      setSidebarOpen(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(event, path) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    const nextPath = normalizePath(path);
    if (nextPath !== currentPath) {
      window.history.pushState({}, "", nextPath);
      setCurrentPath(nextPath);
      if (nextPath === "/weekly-gold") setWeeklyGoldVisited(true);
      else setRaidPageVisited(true);
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
    setSidebarOpen(false);
  }

  return (
    <div className="appShell">
      <button
        type="button"
        className="appSidebarToggle"
        aria-label="메뉴 열기"
        aria-expanded={sidebarOpen}
        onClick={() => setSidebarOpen((value) => !value)}
      >
        <span />
        <span />
        <span />
      </button>

      {sidebarOpen ? (
        <button
          type="button"
          className="appSidebarBackdrop"
          aria-label="메뉴 닫기"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside className={`appSidebar ${sidebarOpen ? "appSidebarOpen" : ""}`} aria-label="메인 메뉴">
        <a className="appSidebarBrand" href="/" onClick={(event) => navigate(event, "/")}>
          <img className="appSidebarBrandLogo" src="/zzk-favicon-02-glow.png?v=2" alt="" aria-hidden="true" />
          <span>
            <strong>Stick Over Flow</strong>
            <small>LostArk Planner</small>
          </span>
        </a>

        <nav className="appSidebarNav">
          {NAV_ITEMS.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <a
                key={item.path}
                href={item.path}
                className={`appSidebarItem ${isActive ? "appSidebarItemActive" : ""}`}
                aria-current={isActive ? "page" : undefined}
                onClick={(event) => navigate(event, item.path)}
              >
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="appSidebarUtilities">
          <details className="appSidebarSites">
            <summary>
              <span>사이트 모음집</span>
              <span className="appSidebarSitesChevron" aria-hidden="true">⌄</span>
            </summary>
            <div className="appSidebarSitesList">
              {EXTERNAL_SITES.map((site) => (
                <a key={site.href} href={site.href} target="_blank" rel="noreferrer">
                  <span>{site.label}</span>
                  <span aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
          </details>

          <a className="appSidebarSheetLink" href={DEFAULT_SHEET_URL} target="_blank" rel="noreferrer">
            <span>Google 시트 열기</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </aside>

      <div className="appMain">
        {raidPageVisited ? (
          <div style={{ display: isWeeklyGold ? "none" : "block" }} aria-hidden={isWeeklyGold || undefined}>
            <RaidSchedulePage initialTab={initialTab} />
          </div>
        ) : null}
        {weeklyGoldVisited ? (
          <div style={{ display: isWeeklyGold ? "block" : "none" }} aria-hidden={!isWeeklyGold || undefined}>
            <WeeklyGoldPage />
          </div>
        ) : null}
      </div>
    </div>
  );
}
