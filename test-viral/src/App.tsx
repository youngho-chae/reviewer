import { Routes, Route, Navigate, Link, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "./hooks/useStore";
import Home from "./screens/Home";
import InviteCompose from "./screens/InviteCompose";
import RefereeLanding from "./screens/RefereeLanding";
import WelcomeBox from "./screens/WelcomeBox";
import Dashboard from "./screens/Dashboard";
import Rewards from "./screens/Rewards";
import DebugPanel from "./screens/DebugPanel";

export default function App() {
  const s = useStore();
  const me = s.getCurrentUser();
  const location = useLocation();
  const nav = useNavigate();

  // Debug top bar — switch demo user, reset.
  const isLandingRoute = location.pathname.startsWith("/i/");
  return (
    <>
      {!isLandingRoute && (
        <div className="nav-top">
          <span className="back" onClick={() => (location.pathname === "/" ? null : nav(-1))}>
            {location.pathname === "/" ? "🎁" : "‹"}
          </span>
          <h1>
            {location.pathname === "/" ? "CATCHPASS · Viral" :
             location.pathname.startsWith("/dashboard") ? "추천 현황" :
             location.pathname.startsWith("/rewards") ? "내 보상" :
             location.pathname.startsWith("/invite/new") ? "친구에게 쏘기" :
             location.pathname.startsWith("/welcome/box") ? "환영 박스" :
             location.pathname.startsWith("/debug") ? "디버그" :
             "CATCHPASS"}
          </h1>
          <span className="nav-spacer" />
          {me && <span className="role-chip"><strong>{me.nickname}</strong> · {me.role === "reviewer" ? "체험자" : "사장님"}</span>}
        </div>
      )}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/invite/new" element={<InviteCompose />} />
        <Route path="/i/:token" element={<RefereeLanding />} />
        <Route path="/welcome/box" element={<WelcomeBox />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/rewards" element={<Rewards />} />
        <Route path="/debug" element={<DebugPanel />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      {!isLandingRoute && !location.pathname.startsWith("/welcome") && (
        <nav className="bottom-nav">
          <Link className={location.pathname === "/" ? "active" : ""} to="/">
            <span className="ic">🏠</span>홈
          </Link>
          <Link className={location.pathname === "/dashboard" ? "active" : ""} to="/dashboard">
            <span className="ic">📊</span>추천 현황
          </Link>
          <Link className={location.pathname === "/rewards" ? "active" : ""} to="/rewards">
            <span className="ic">🎁</span>내 보상
          </Link>
          <Link className={location.pathname === "/debug" ? "active" : ""} to="/debug">
            <span className="ic">⚙️</span>디버그
          </Link>
        </nav>
      )}
    </>
  );
}
