import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../hooks/useStore";
import LiveCounter from "../components/LiveCounter";
import ProgressBar from "../components/ProgressBar";

export default function Home() {
  const s = useStore();
  const me = s.getCurrentUser();
  const nav = useNavigate();
  if (!me) {
    return (
      <div className="page">
        <p className="muted">데모 사용자가 없습니다. /debug에서 초기화하세요.</p>
        <Link to="/debug" className="btn dark mt-4" style={{ display: "block", textAlign: "center" }}>디버그 패널</Link>
      </div>
    );
  }
  const trig = me.pendingTrigger;

  function goInvite() {
    nav("/invite/new");
  }

  return (
    <div className="page">
      <LiveCounter />

      <div className="card tile-brand">
        <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>{me.role === "reviewer" ? "체험자" : "사장님"} · {me.nickname}</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>친구를 초대하고<br />행운 박스를 받으세요</div>
        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 8 }}>
          누적 성공 초대 <strong>{me.inviteStats.accepted}명</strong> · 박스 등급{" "}
          <span className={`pill ${me.inviteStats.boxGrade === "gold" ? "gold" : me.inviteStats.boxGrade === "silver" ? "silver" : ""}`}>
            {me.inviteStats.boxGrade === "gold" ? "🥇 골드" : me.inviteStats.boxGrade === "silver" ? "🥈 실버" : "🎁 일반"}
          </span>
        </div>
        <button className="btn dark mt-4" style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }} onClick={goInvite}>
          🎁 친구에게 쏘기 →
        </button>
      </div>

      <div className="card mt-4">
        <div className="section-title" style={{ marginBottom: 0 }}>다음 박스까지</div>
        <ProgressBar accepted={me.inviteStats.accepted} />
      </div>

      {/* 트리거 카드 — 메인 catchpass 액션 직후에 자동으로 노출되는 추천 모듈을 시뮬레이션 */}
      {trig && (
        <div className="trigger-card" onClick={goInvite}>
          <span className="emoji">{trig.kind === "T1_pass_used" ? "✨" : trig.kind === "T4_campaign_created" ? "🎯" : "🎉"}</span>
          <div className="body">
            <div className="head">
              {trig.kind === "T1_pass_used" && "패스 사용 완료! 친구도 받게 해줄래요?"}
              {trig.kind === "T2_review_completed" && "검수 통과! 행운 박스 도착했어요"}
              {trig.kind === "T3_grade_up" && "등급 상승! 추천하면 박스 등급도 같이 올라가요"}
              {trig.kind === "T4_campaign_created" && "캠페인 등록 완료! 동료 사장님에게 추천하면 양쪽 멤버십 할인"}
              {trig.kind === "T5_owner_scan_done" && "이 손님에게도 가입 권유하면 박스 도착"}
            </div>
            <div className="sub">{trig.contextLabel}</div>
          </div>
          <span className="chev">›</span>
        </div>
      )}

      <div className="section mt-6">
        <div className="section-title">CATCHPASS 액션 시뮬레이션 (Mock 트리거)</div>
        <div className="muted mb-3" style={{ fontSize: 12 }}>
          실제로는 메인 catchpass 시스템(/o/scan, /r/passes 등)에서 어댑터를 통해 호출됩니다.
          아래는 본 트랙 테스트를 위해 직접 발사할 수 있는 버튼들.
        </div>
        {me.role === "reviewer" ? (
          <>
            <button className="btn secondary mt-2" onClick={() => s.onPassUsed({ reviewerId: me.id, passId: "ps_abc12345", savedAmount: 12000 })}>
              T1 — 패스 사용 완료 시뮬레이션
            </button>
            <button className="btn secondary mt-2" onClick={() => s.onGradeUp({ reviewerId: me.id, toGrade: "A" })}>
              T3 — A 등급 진입 시뮬레이션
            </button>
          </>
        ) : (
          <>
            <button className="btn secondary mt-2" onClick={() => s.onCampaignCreated({ ownerId: me.id, campaignId: "cp_xyz98765" })}>
              T4 — 캠페인 등록 완료 시뮬레이션
            </button>
          </>
        )}
      </div>

      <div className="section mt-6">
        <div className="section-title">바로가기</div>
        <Link to="/dashboard" className="btn dark">📊 내 추천 현황</Link>
        <Link to="/rewards" className="btn secondary mt-2">🎁 내 보상 보기</Link>
      </div>
    </div>
  );
}
