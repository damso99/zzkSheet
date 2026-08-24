import RaidSchedulePage from "./pages/RaidSchedulePage/RaidSchedulePage.jsx";
import WeeklyGoldPage from "./pages/WeeklyGoldPage/WeeklyGoldPage.jsx";

export default function App() {
  const currentPath = window.location.pathname.replace(/\/$/, "") || "/";

  if (currentPath === "/weekly-gold") return <WeeklyGoldPage />;

  const initialTab = currentPath === "/personal" ? "personal" : currentPath === "/personal-raid" ? "personalRaid" : currentPath === "/auction" ? "auction" : "today";

  return (
    <>
      <RaidSchedulePage initialTab={initialTab} />
      <a className="weeklyGoldQuickLink" href="/weekly-gold" aria-label="원정대 주간 골드 확인 페이지 열기">
        <span className="weeklyGoldQuickLinkIcon" aria-hidden="true">G</span>
        <span>주간 골드</span>
      </a>
    </>
  );
}
