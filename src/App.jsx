import { lazy, Suspense } from "react";

const RaidSchedulePage = lazy(() => import("./pages/RaidSchedulePage/RaidSchedulePage.jsx"));

export default function App() {
  const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
  // const initialTab =
  //   currentPath === "/personal"
  //     ? "personal"
  //     : currentPath === "/personal-raid"
  //       ? "personalRaid"
  //       : "today";

  return (
    <Suspense fallback={null}>
      <RaidSchedulePage initialTab={initialTab} />
    </Suspense>
  );
}
