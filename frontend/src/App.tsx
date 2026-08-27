import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StyleRoundedIcon from "@mui/icons-material/StyleRounded";
import { initLiff } from "./lib/liff";
import CardDetail from "./pages/CardDetail";
import CardNew from "./pages/CardNew";
import Chat from "./pages/Chat";
import GroupChat from "./pages/GroupChat";
import GroupDetail from "./pages/GroupDetail";
import Home from "./pages/Home";
import MatchDetail from "./pages/MatchDetail";
import Matches from "./pages/Matches";
import MyCards from "./pages/MyCards";

import Saved from "./pages/Saved";
import Search from "./pages/Search";

// Leaflet は重いので、地図を開いたときだけ読み込む
const NearbyMap = lazy(() => import("./pages/NearbyMap"));

// ピンクとティールを交互に割り当てて 1:1 の比率にする
const TABS = [
  { to: "/", label: "ホーム", icon: HomeRoundedIcon, tone: "tab-pink" },
  { to: "/cards/new", label: "登録", icon: StyleRoundedIcon, tone: "tab-teal" },
  { to: "/search", label: "探す", icon: SearchRoundedIcon, tone: "tab-pink" },
  { to: "/nearby", label: "地図", icon: MapRoundedIcon, tone: "tab-teal" },
  { to: "/matches", label: "マッチ", icon: FavoriteRoundedIcon, tone: "tab-pink" },
];

function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav className="tabbar">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = pathname === tab.to;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={`${tab.tone} ${active ? "active" : ""}`}
          >
            <Icon />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    initLiff()
      .then(() => setReady(true))
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <main className="app">
        <p className="error">LIFF の初期化に失敗しました: {error}</p>
      </main>
    );
  }
  if (!ready) {
    return (
      <main className="app">
        <p className="loading">起動中…</p>
      </main>
    );
  }

  return (
    <BrowserRouter>
      <main className="app">
        <header className="apphead">MeetU</header>
        <Suspense fallback={<p className="loading">読み込み中…</p>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/cards/new" element={<CardNew />} />
          <Route path="/cards/mine" element={<MyCards />} />
          <Route path="/cards/:cardId" element={<CardDetail />} />
          <Route path="/search" element={<Search />} />
          <Route path="/nearby" element={<NearbyMap />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/matches/:matchId" element={<MatchDetail />} />
          <Route path="/matches/:matchId/chat" element={<Chat />} />
          <Route path="/groups/:groupId" element={<GroupDetail />} />
          <Route path="/groups/:groupId/chat" element={<GroupChat />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        <TabBar />
      </main>
    </BrowserRouter>
  );
}
