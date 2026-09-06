import Link from "next/link";
import { useRouter } from "next/router";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StyleRoundedIcon from "@mui/icons-material/StyleRounded";
import { UserMenu } from "../widgets/user/UserMenu";

const TABS = [
  { to: "/", label: "ホーム", icon: HomeRoundedIcon, tone: "tab-pink" },
  { to: "/cards/new", label: "登録", icon: StyleRoundedIcon, tone: "tab-teal" },
  { to: "/search", label: "探す", icon: SearchRoundedIcon, tone: "tab-pink" },
  { to: "/nearby", label: "地図", icon: MapRoundedIcon, tone: "tab-teal" },
  { to: "/matches", label: "マッチ", icon: FavoriteRoundedIcon, tone: "tab-pink" },
];

function TabBar() {
  const { pathname } = useRouter();
  return (
    <nav className="tabbar">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = pathname === tab.to;
        return (
          <Link key={tab.to} href={tab.to} className={`${tab.tone} ${active ? "active" : ""}`}>
            <Icon />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** タイトルとユーザーアイコンだけ。プロフィールとログアウトは UserMenu のモーダルに集約する */
function AppHeader() {
  return (
    <header className="apphead">
      <Link href="/" className="apphead-brand" aria-label="MeetU ホーム">
        {/* ロゴはピンク1色。ヘッダーの地もピンクなので白のチップに載せて分離する */}
        <span className="apphead-logo">
          <img src="/logo.png" alt="" />
        </span>
        <span className="apphead-title">MeetU</span>
      </Link>
      <UserMenu />
    </header>
  );
}

const AUTH_PAGES = ["/login", "/signup"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useRouter();
  const isAuthPage = AUTH_PAGES.includes(pathname);

  return (
    <main className="app">
      {!isAuthPage && <AppHeader />}
      {children}
      {!isAuthPage && <TabBar />}
    </main>
  );
}
