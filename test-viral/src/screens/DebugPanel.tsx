import { useStore } from "../hooks/useStore";

export default function DebugPanel() {
  const s = useStore();
  const me = s.getCurrentUser();
  const users = s.listUsers();
  const invites = s.listInvites();
  const rewards = s.listRewards();

  return (
    <div className="page">
      <div className="card">
        <div className="section-title" style={{ marginBottom: 8 }}>현재 세션</div>
        <div className="muted" style={{ fontSize: 13 }}>
          현재 로그인 → <strong style={{ color: "var(--ink)" }}>{me?.nickname ?? "(없음)"}</strong>{" "}
          {me && <span className="pill">{me.role}</span>}
        </div>
      </div>

      <div className="card mt-4">
        <div className="section-title" style={{ marginBottom: 8 }}>데모 사용자 전환</div>
        {users.map((u) => (
          <div key={u.id} className="dash-row">
            <div className="num" style={{ fontSize: 22 }}>{u.role === "owner" ? "🏪" : "🧑"}</div>
            <div className="lab">
              <div className="title">{u.nickname}{u.storeName ? ` (${u.storeName})` : ""}</div>
              <div className="sub font-mono" style={{ fontSize: 11 }}>{u.id}</div>
              <div className="muted mt-1" style={{ fontSize: 11 }}>
                발송 {u.inviteStats.sent} · 수락 {u.inviteStats.accepted} · {u.inviteStats.boxGrade}
              </div>
            </div>
            <button
              className={`btn inline ${me?.id === u.id ? "secondary" : "dark"}`}
              onClick={() => s.setCurrentUser(u.id)}
              disabled={me?.id === u.id}
            >
              {me?.id === u.id ? "현재" : "전환"}
            </button>
          </div>
        ))}
      </div>

      <div className="card mt-4">
        <div className="section-title" style={{ marginBottom: 8 }}>전체 통계 (어드민)</div>
        <div className="stat-grid">
          <div className="stat"><div className="num">{users.length}</div><div className="lab">사용자</div></div>
          <div className="stat"><div className="num">{invites.length}</div><div className="lab">초대</div></div>
          <div className="stat"><div className="num">{rewards.length}</div><div className="lab">보상</div></div>
        </div>
        <div className="muted mt-3" style={{ fontSize: 12, lineHeight: 1.5 }}>
          초대 가입 전환율:{" "}
          <strong style={{ color: "var(--ink)" }}>
            {invites.length > 0 ? Math.round((invites.filter(i => i.status === "signed_up").length / invites.length) * 100) : 0}%
          </strong>
          <br />
          K-factor 추정: {" "}
          <strong style={{ color: "var(--ink)" }}>
            {(invites.filter(i => i.status === "signed_up").length / Math.max(1, users.length)).toFixed(2)}
          </strong>
        </div>
      </div>

      <div className="card mt-4">
        <div className="section-title" style={{ marginBottom: 8 }}>위험 작업</div>
        <button className="btn secondary" onClick={() => { if (confirm("전체 mock 데이터를 초기화합니다.")) s.reset(); }}>
          🗑 mock 데이터 전체 초기화
        </button>
        <div className="muted mt-2" style={{ fontSize: 11 }}>
          이 작업은 localStorage `catchpass.viral.v1` 키만 비웁니다. 메인 catchpass DB에는 영향이 없습니다.
        </div>
      </div>

      <div className="card mt-4">
        <div className="section-title" style={{ marginBottom: 8 }}>어댑터 인터페이스 (read-only 미리보기)</div>
        <pre style={{ fontSize: 11, background: "var(--parchment)", padding: 12, borderRadius: 8, overflow: "auto", lineHeight: 1.5 }}>
{`interface ReferralAdapter {
  recordInviteSent(args): Promise<token>
  recordInviteAccepted(args): Promise<{ referrerReward, refereeReward }>
  onPassUsed(args): Promise<void>            // T1
  onCampaignCreated(args): Promise<void>     // T4
  onGradeUp(args): Promise<void>             // T3
  getCounter(): Promise<CounterSnapshot>
}`}
        </pre>
        <div className="muted mt-2" style={{ fontSize: 11 }}>
          향후 메인 catchpass와 통합 시 이 인터페이스의 mock 구현(/test-viral/src/store/mockStore.ts)이 실서버 구현으로 교체됩니다.
          기존 src/는 미수정.
        </div>
      </div>
    </div>
  );
}
