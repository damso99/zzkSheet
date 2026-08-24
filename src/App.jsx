import { useState } from "react";
import RaidSchedulePage from "./pages/RaidSchedulePage/RaidSchedulePage.jsx";
import WeeklyGoldPage from "./pages/WeeklyGoldPage/WeeklyGoldPage.jsx";

const NAV_ITEMS = [
  { path: "/", label: "금일 일정", icon: "오늘" },
  { path: "/week", label: "주간 일정", icon: "주" },
  { path: "/auction", label: "쌀산기", icon: "계" },
  { path: "/personal-raid", label: "레이드 참여 현황", icon: "참" },
  { path: "/personal", label: "개인 일정", icon: "개" },
  { path: "/weekly-gold", label: "주간 골드", icon: "G" },
];

export default function App() {
  const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const initialTab =
    currentPath === "/week"
      ? "week"
      : currentPath === "/personal"
        ? "personal"
        : currentPath === "/personal-raid"
          ? "personalRaid"
          : currentPath === "/auction"
            ? "auction"
            : "today";

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
        <a className="appSidebarBrand" href="/" onClick={() => setSidebarOpen(false)}>
          <span className="appSidebarBrandMark">SOF</span>
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
                onClick={() => setSidebarOpen(false)}
              >
                <span className="appSidebarIcon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
      </aside>

      <div className="appMain">
        {currentPath === "/weekly-gold" ? <WeeklyGoldPage /> : <RaidSchedulePage initialTab={initialTab} />}
      </div>
    </div>
  );
}
