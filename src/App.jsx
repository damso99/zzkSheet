import { lazy, Suspense } from "react";

const PersonalRaidPage = lazy(() => import("./pages/PersonalRaidPage/PersonalRaidPage.jsx"));
const PersonalSchedulePage = lazy(() => import("./pages/PersonalSchedulePage/PersonalSchedulePage.jsx"));
const RaidSchedulePage = lazy(() => import("./pages/RaidSchedulePage/RaidSchedulePage.jsx"));

export default function App() {
  const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
  const isPersonalPage = currentPath === "/personal";
  const isPersonalRaidPage = currentPath === "/personal-raid";

  return (
    <Suspense fallback={null}>
      {isPersonalPage ? <PersonalSchedulePage /> : null}
      {isPersonalRaidPage ? <PersonalRaidPage /> : null}
      {!isPersonalPage && !isPersonalRaidPage ? <RaidSchedulePage /> : null}
    </Suspense>
  );
}
