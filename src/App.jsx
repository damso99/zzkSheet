import RaidSchedulePage from "./pages/RaidSchedulePage/RaidSchedulePage.jsx";

export default function App() {
  const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
  const initialTab =
    currentPath === "/item-price"
      ? "itemPrice"
      : currentPath === "/personal"
      ? "personal"
      : currentPath === "/personal-raid"
        ? "personalRaid"
        : "today";

  return <RaidSchedulePage initialTab={initialTab} />;
}
