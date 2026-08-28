import { Suspense, lazy, useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StyleRoundedIcon from "@mui/icons-material/StyleRounded";
import { getAccessToken, ensureSession } from "../shared/api";
import { signOut } from "../features/auth/api";
import CardDetail from "../pages/CardDetail";
import CardNew from "../pages/CardNew";
import Chat from "../pages/Chat";
import GroupChat from "../pages/GroupChat";
import GroupDetail from "../pages/GroupDetail";
import Home from "../pages/Home";
import Login from "../pages/Login";
import MatchDetail from "../pages/MatchDetail";
import Matches from "../pages/Matches";
import MyCards from "../pages/MyCards";
import Saved from "../pages/Saved";
import Search from "../pages/Search";
import Signup from "../pages/Signup";

const NearbyMap = lazy(() => import("../pages/NearbyMap"));

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
          <Link key={tab.to} to={tab.to} className={`${tab.tone} ${active ? "active" : ""}`}>
            <Icon />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AppHeader() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    setBusy(true);
    try {
      await signOut();
      navigate("/login", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="apphead">
      <span className="apphead-title">MeetU</span>
      <button
        type="button"
        className="apphead-logout"
        onClick={handleLogout}
        disabled={busy}
        aria-label="ログアウト"
      >
        <LogoutRoundedIcon fontSize="small" />
        {busy ? "…" : "ログアウト"}
      </button>
    </header>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = getAccessToken() !== null || (await ensureSession());
      if (!cancelled) {
        setAuthed(ok);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return <p className="loading">読み込み中…</p>;
  if (!authed) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const location = useLocation();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/signup";

  return (
    <main className="app">
      {!isAuthPage && <AppHeader />}
      <Suspense fallback={<p className="loading">読み込み中…</p>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
          <Route path="/cards/new" element={<RequireAuth><CardNew /></RequireAuth>} />
          <Route path="/cards/mine" element={<RequireAuth><MyCards /></RequireAuth>} />
          <Route path="/cards/:cardId" element={<RequireAuth><CardDetail /></RequireAuth>} />
          <Route path="/search" element={<RequireAuth><Search /></RequireAuth>} />
          <Route path="/nearby" element={<RequireAuth><NearbyMap /></RequireAuth>} />
          <Route path="/saved" element={<RequireAuth><Saved /></RequireAuth>} />
          <Route path="/matches" element={<RequireAuth><Matches /></RequireAuth>} />
          <Route path="/matches/:matchId" element={<RequireAuth><MatchDetail /></RequireAuth>} />
          <Route path="/matches/:matchId/chat" element={<RequireAuth><Chat /></RequireAuth>} />
          <Route path="/groups/:groupId" element={<RequireAuth><GroupDetail /></RequireAuth>} />
          <Route path="/groups/:groupId/chat" element={<RequireAuth><GroupChat /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {!isAuthPage && <TabBar />}
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
