import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "../hooks/useStore";
import LiveCounter from "../components/LiveCounter";
import { matrixOf } from "../types";

const NICK_POOL = ["새 친구", "방문 손님", "동료 사장님", "신규 매장", "성수 미식가", "한남 신규"];

export default function RefereeLanding() {
  const s = useStore();
  const { token } = useParams<{ token: string }>();
  const nav = useNavigate();
  const inv = token ? s.findInvite(token) : null;
  const referrer = inv ? s.findUser(inv.referrerId) : null;
  const [nickname, setNickname] = useState(NICK_POOL[Math.floor(Math.random() * NICK_POOL.length)]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (token && inv && inv.status === "issued") {
      s.markInviteClicked(token);
    }
  }, [token]);

  const preview = useMemo(() => {
    if (!inv) return null;
    const m = matrixOf(inv.referrerKind, inv.targetKind);
    if (m === "RR" || m === "OR") return "₩50,000 첫 캠페인 지원금 +50%";
    return "첫 달 멤버십 50% 할인 + 모집 한도 +5팀";
  }, [inv]);

  if (!token) return <div className="page">잘못된 링크</div>;
  if (!inv) {
    return (
      <div className="page">
        <div className="card">
          <div className="text-error" style={{ fontSize: 16, fontWeight: 700 }}>토큰을 찾을 수 없습니다</div>
          <div className="muted mt-2" style={{ fontSize: 13 }}>이미 사용되었거나 만료된 링크입니다.</div>
          <button className="btn mt-4" onClick={() => nav("/")}>홈으로</button>
        </div>
      </div>
    );
  }
  if (inv.status === "signed_up") {
    return (
      <div className="page">
        <div className="card">
          <div style={{ fontSize: 16, fontWeight: 700 }}>이미 사용된 초대입니다</div>
          <div className="muted mt-2" style={{ fontSize: 13 }}>한 토큰은 한 번만 보상을 받을 수 있어요.</div>
          <button className="btn mt-4" onClick={() => nav("/")}>홈으로</button>
        </div>
      </div>
    );
  }
  if (Date.now() > inv.expiresAt || inv.status === "expired") {
    return (
      <div className="page">
        <div className="card">
          <div className="text-error" style={{ fontSize: 16, fontWeight: 700 }}>만료된 링크</div>
          <button className="btn mt-4" onClick={() => nav("/")}>홈으로</button>
        </div>
      </div>
    );
  }

  async function accept() {
    if (!inv) return;
    setBusy(true);
    const r = s.recordInviteAccepted({
      token: inv.token,
      refereeRole: inv.targetKind,
      refereeNickname: nickname.trim() || "익명 친구",
      refereeStoreName: inv.targetKind === "owner" ? "친구 매장" : undefined,
    });
    if (!r) {
      setBusy(false);
      return;
    }
    // 새 사용자(피추천자) 로 자동 로그인
    s.setCurrentUser(r.refereeUser.id);
    // 환영 박스로 이동, query에 token으로 보상 매칭
    nav(`/welcome/box?token=${inv.token}`, { replace: true });
  }

  return (
    <div className="page" style={{ paddingTop: 32 }}>
      <LiveCounter />

      <div className="card tile-brand" style={{ marginTop: 12, textAlign: "center", padding: 24 }}>
        <div style={{ fontSize: 64 }}>🎁</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>
          {referrer?.nickname ?? "친구"}님이<br />선물을 보냈어요
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, marginTop: 14, letterSpacing: "-0.02em" }}>
          {preview}
        </div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 10 }}>
          + 박스 오픈 시 0~5,000원 보너스 캐시
        </div>
      </div>

      <div className="card mt-4">
        <div className="section-title">30초 가입</div>
        <div className="form-group">
          <label>닉네임</label>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="예: 성수 미식가" />
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          가입 = {inv.targetKind === "owner" ? "사장님 계정 생성" : "체험자 계정 생성"}.
          본 데모에서는 SNS/매장 정보 입력을 생략합니다.
        </div>
        <button className="btn mt-4" disabled={busy} onClick={accept}>
          {busy ? "지급 중..." : "박스 받고 가입하기 →"}
        </button>
        <div className="muted center mt-4" style={{ fontSize: 11 }}>
          본 보상은 캐치랭크 마케팅 정책에 따라 지급됩니다 · 14일 내 가입 시에만 유효
        </div>
      </div>
    </div>
  );
}
