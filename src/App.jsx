import PersonalSchedulePage from "./pages/PersonalSchedulePage/PersonalSchedulePage.jsx";
import RaidSchedulePage from "./pages/RaidSchedulePage/RaidSchedulePage.jsx";

export default function App() {
  if (window.location.pathname.replace(/\/$/, "") === "/personal") {
    return <PersonalSchedulePage />;
  }

  return <RaidSchedulePage />;
}
