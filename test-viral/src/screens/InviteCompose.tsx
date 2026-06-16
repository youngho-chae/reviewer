import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../hooks/useStore";
import ShareSheet from "../components/ShareSheet";
import { ShareChannel, UserKind, matrixOf } from "../types";

export default function InviteCompose() {
  const s = useStore();
  const me = s.getCurrentUser()!;
  const nav = useNavigate();
  const [targetKind, setTargetKind] = useState<UserKind>(me.role === "owner" ? "reviewer" : "reviewer");
  const [shareOpen, setShareOpen] = useState(false);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ channel: ShareChannel; token: string } | null>(null);

  const m = useMemo(() => matrixOf(me.role, targetKind), [me.role, targetKind]);

  const preview = useMemo(() => {
    switch (m) {
      case "RR": return "₩50,000 첫 캠페인 쿠폰";
      case "RO": return "첫 달 멤버십 50% 할인 쿠폰";
      case "OR": return `${me.storeName ?? "이 매장"} 첫 캠페인 ₩75,000 지원금`;
      case "OO": return "사장님 동료 가입 첫 달 멤버십 50% 할인";
    }
  }, [m, me.storeName]);

  function openShare() {
    setShareOpen(true);
  }
  function onSelectChannel(channel: ShareChannel) {
    // 토큰 발급
    const inv = s.recordInviteSent({
      referrerId: me.id,
      targetKind,
      channel,
      storeId: m === "OR" ? "demo_store" : undefined,
    });
    setIssuedToken(inv.token);
    setConfirmed({ channel, token: inv.token });
    setShareOpen(false);
  }

  const url = issuedToken ? `${location.origin}/i/${issuedToken}` : `${location.origin}/i/<token>`;
  const placeholderUrl = `${location.origin}/i/preview`;

  return (
    <div className="page">
      <div className="card tile-dark">
        <div style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.14em" }}>받는 사람이 받을 선물</div>
        <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6 }}>{preview}</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          매트릭스 <span className="pill" style={{ background: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.2)", color: "#fff" }}>{m}</span> ·{" "}
          {m === "RR" && "체험자가 친구 체험자 초대"}
          {m === "RO" && "체험자가 단골 매장(사장님) 초대"}
          {m === "OR" && "사장님이 손님(체험자) 초대"}
          {m === "OO" && "사장님이 동료 사장님 초대"}
        </div>
      </div>

      <div className="section mt-6">
        <div className="section-title">초대 대상</div>
        <div className="row gap-2 mt-2">
          <button
            className={`btn ${targetKind === "reviewer" ? "dark" : "secondary"}`}
            style={{ flex: 1 }}
            onClick={() => setTargetKind("reviewer")}
          >
            🧑 체험자 초대
          </button>
          <button
            className={`btn ${targetKind === "owner" ? "dark" : "secondary"}`}
            style={{ flex: 1 }}
            onClick={() => setTargetKind("owner")}
          >
            🏪 사장님 초대
          </button>
        </div>
      </div>

      <div className="section mt-6">
        <div className="section-title">미리보기 메시지</div>
        <div className="card" style={{ background: "var(--surface-soft)" }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>친구가 받게 될 메시지</div>
          <div style={{ fontSize: 14, color: "var(--ink)" }}>
            <strong>{me.nickname}</strong>님이 친구{targetKind === "owner" ? " 사장님" : ""}에게{" "}
            <strong style={{ color: "var(--brand)" }}>{preview}</strong>을(를) 보냈어요. 30초만에 받으세요 →
            <div className="muted font-mono mt-2" style={{ fontSize: 11 }}>{confirmed ? url : placeholderUrl}</div>
          </div>
        </div>
      </div>

      <button className="btn mt-6" onClick={openShare}>🎁 친구에게 쏘기</button>

      {confirmed && (
        <div className="section mt-6">
          <div className="card" style={{ borderColor: "var(--success)", background: "rgba(36,138,61,0.05)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--success)" }}>✓ 토큰 발급 완료</div>
            <div className="muted font-mono mt-2" style={{ fontSize: 12 }}>{url}</div>
            <div className="row mt-3 gap-2">
              <button className="btn inline secondary" onClick={() => navigator.clipboard.writeText(url)}>URL 복사</button>
              <button className="btn inline dark" onClick={() => nav(`/i/${confirmed.token}`)}>피추천자 시점에서 진입해보기 →</button>
            </div>
          </div>
        </div>
      )}

      {shareOpen && (
        <ShareSheet
          inviteUrl={url}
          referrerNickname={me.nickname}
          refereePreviewLabel={preview}
          refereeRoleHint={targetKind}
          onSelect={onSelectChannel}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
