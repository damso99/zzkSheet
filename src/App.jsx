import RaidSchedulePage from "./pages/RaidSchedulePage/RaidSchedulePage.jsx";
import WeeklyGoldPage from "./pages/WeeklyGoldPage/WeeklyGoldPage.jsx";

export default function App() {
  const currentPath = window.location.pathname.replace(/\/$/, "") || "/";

  if (currentPath === "/weekly-gold") return <WeeklyGoldPage />;

  const initialTab = currentPath === "/personal" ? "personal" : currentPath === "/personal-raid" ? "personalRaid" : currentPath === "/auction" ? "auction" : "today";
  return <RaidSchedulePage initialTab={initialTab} />;
}
