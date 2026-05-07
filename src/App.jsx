import { lazy, Suspense } from "react";

const PersonalSchedulePage = lazy(() => import("./pages/PersonalSchedulePage/PersonalSchedulePage.jsx"));
const RaidSchedulePage = lazy(() => import("./pages/RaidSchedulePage/RaidSchedulePage.jsx"));

export default function App() {
  const isPersonalPage = window.location.pathname.replace(/\/$/, "") === "/personal";

  return (
    <Suspense fallback={null}>
      {isPersonalPage ? <PersonalSchedulePage /> : <RaidSchedulePage />}
    </Suspense>
  );
}
