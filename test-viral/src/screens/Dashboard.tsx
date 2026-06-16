import { useMemo } from "react";
import { useStore } from "../hooks/useStore";
import ProgressBar from "../components/ProgressBar";
import { Invite, MatrixKey, matrixOf } from "../types";

export default function Dashboard() {
  const s = useStore();
  const me = s.getCurrentUser();
  const allInvites = s.listInvites();

  if (!me) {
    return <div className="page muted">로그인 필요</div>;
  }

  const mine = useMemo(() => allInvites.filter((i) => i.referrerId === me.id), [allInvites, me.id]);
  const allUsers = s.listUsers();
  const totalUsers = allUsers.length;

  const stats = useMemo(() => {
    const sent = mine.length;
    const clicked = mine.filter((i) => i.status !== "issued").length;
    const accepted = mine.filter((i) => i.status === "signed_up").length;
    const acceptRate = sent > 0 ? Math.round((accepted / sent) * 100) : 0;
    return { sent, clicked, accepted, acceptRate };
  }, [mine]);

  // K-factor 추산
  const k = useMemo(() => {
    const total = allUsers.length;
    if (total === 0) return 0;
    const acceptedTotal = allInvites.filter((i) => i.status === "signed_up").length;
    return acceptedTotal / total;
  }, [allUsers, allInvites]);

  // 매트릭스 분포
  const byMatrix = useMemo(() => {
    const buckets: Record<MatrixKey, number> = { RR: 0, RO: 0, OR: 0, OO: 0 };
    for (const i of mine) buckets[matrixOf(i.referrerKind, i.targetKind)] += 1;
    return buckets;
  }, [mine]);

  return (
    <div className="page">
      <div className="card">
        <div className="section-title" style={{ marginBottom: 8 }}>나의 추천 현황</div>
        <div className="stat-grid">
          <div className="stat"><div className="num">{stats.sent}</div><div className="lab">발송</div></div>
          <div className="stat"><div className="num">{stats.clicked}</div><div className="lab">클릭</div></div>
          <div className="stat"><div className="num">{stats.accepted}</div><div className="lab">가입</div></div>
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          전환율 {stats.acceptRate}% · 박스 등급{" "}
          <span className={`pill ${me.inviteStats.boxGrade === "gold" ? "gold" : me.inviteStats.boxGrade === "silver" ? "silver" : ""}`}>
            {me.inviteStats.boxGrade}
          </span>
        </div>
        <ProgressBar accepted={me.inviteStats.accepted} />
      </div>

      <div className="card mt-4">
        <div className="section-title" style={{ marginBottom: 8 }}>매트릭스 분포 (4종)</div>
        <div className="row between">
          <span className="muted" style={{ fontSize: 12 }}>RR · 체험자→체험자</span>
          <strong>{byMatrix.RR}</strong>
        </div>
        <div className="row between mt-2">
          <span className="muted" style={{ fontSize: 12 }}>RO · 체험자→사장님</span>
          <strong>{byMatrix.RO}</strong>
        </div>
        <div className="row between mt-2">
          <span className="muted" style={{ fontSize: 12 }}>OR · 사장님→체험자</span>
          <strong>{byMatrix.OR}</strong>
        </div>
        <div className="row between mt-2">
          <span className="muted" style={{ fontSize: 12 }}>OO · 사장님→사장님</span>
          <strong>{byMatrix.OO}</strong>
        </div>
      </div>

      <div className="card mt-4">
        <div className="section-title" style={{ marginBottom: 8 }}>시스템 K-factor (전체)</div>
        <div className="row between">
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: k >= 0.5 ? "var(--success)" : k >= 0.3 ? "var(--gold)" : "var(--error)" }}>
              {k.toFixed(2)}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {k >= 0.5 ? "✅ OKR 게이트 통과 (≥ 0.5)" : k >= 0.3 ? "⚠️ 게이트 근접" : "❌ 게이트 미달"}
            </div>
          </div>
          <div className="muted" style={{ fontSize: 11, textAlign: "right" }}>
            누적 가입자<br/><strong style={{ color: "var(--ink)", fontSize: 18 }}>{totalUsers}</strong>명<br/>
            누적 수락 초대<br/><strong style={{ color: "var(--ink)", fontSize: 18 }}>{allInvites.filter(i => i.status === "signed_up").length}</strong>건
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div className="section-title" style={{ marginBottom: 8 }}>내가 보낸 초대</div>
        {mine.length === 0 && <div className="muted center" style={{ fontSize: 13, padding: "16px 0" }}>아직 발송한 초대가 없어요</div>}
        {mine.map((i) => (
          <InviteRow key={i.token} invite={i} />
        ))}
      </div>
    </div>
  );
}

function InviteRow({ invite }: { invite: Invite }) {
  const m = matrixOf(invite.referrerKind, invite.targetKind);
  const status = invite.status;
  return (
    <div className="dash-row">
      <div className="num">{m}</div>
      <div className="lab">
        <div className="title font-mono" style={{ fontSize: 12 }}>{invite.token}</div>
        <div className="sub">
          {new Date(invite.createdAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          {invite.channel && ` · ${invite.channel}`}
        </div>
      </div>
      <span className={`pill ${status === "signed_up" ? "brand" : ""}`} style={{ background: status === "signed_up" ? "rgba(36,138,61,0.1)" : undefined, color: status === "signed_up" ? "var(--success)" : undefined, borderColor: status === "signed_up" ? "var(--success)" : undefined }}>
        {status === "issued" && "발송"}
        {status === "clicked" && "열람"}
        {status === "signed_up" && "✓ 가입"}
        {status === "expired" && "만료"}
      </span>
    </div>
  );
}
