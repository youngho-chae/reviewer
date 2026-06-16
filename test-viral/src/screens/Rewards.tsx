import { useStore } from "../hooks/useStore";
import { Reward } from "../types";

function rewardLabel(r: Reward): string {
  if (r.kind === "cash") return `보너스 캐시 ₩${r.value.toLocaleString()}`;
  if (r.kind === "support_bonus_pct") return `첫 캠페인 지원금 +${r.value}%`;
  if (r.kind === "membership_discount") return `멤버십 ${r.value}% 할인`;
  if (r.kind === "quota_bonus") return `캠페인 모집 한도 +${r.value}팀`;
  if (r.kind === "spotlight_pass") return `시그니처 우선 노출권 ${r.value}회`;
  return "보상";
}

function sourceLabel(s: Reward["source"]): string {
  return s === "referee_welcome" ? "환영 박스" : s === "referrer_box" ? "행운 박스" : "마일스톤";
}

export default function Rewards() {
  const s = useStore();
  const me = s.getCurrentUser();
  if (!me) return <div className="page muted">로그인 필요</div>;

  return (
    <div className="page">
      <div className="card">
        <div className="section-title" style={{ marginBottom: 8 }}>내 보상</div>
        <div className="stat-grid">
          <div className="stat">
            <div className="num">{me.rewards.length}</div>
            <div className="lab">총 받음</div>
          </div>
          <div className="stat">
            <div className="num">{me.rewards.filter((r) => r.usedAt).length}</div>
            <div className="lab">사용</div>
          </div>
          <div className="stat">
            <div className="num">{me.rewards.filter((r) => !r.usedAt).length}</div>
            <div className="lab">미사용</div>
          </div>
        </div>
      </div>

      <div className="card mt-4">
        {me.rewards.length === 0 && (
          <div className="muted center" style={{ fontSize: 13, padding: "20px 0" }}>
            아직 보상이 없어요.<br />친구를 초대하거나 초대 링크로 가입해보세요.
          </div>
        )}
        {me.rewards.map((r) => (
          <div key={r.id} className="dash-row">
            <div className="num" style={{ fontSize: 22 }}>
              {r.kind === "cash" ? "💵" : r.kind === "membership_discount" ? "💎" : r.kind === "support_bonus_pct" ? "💰" : r.kind === "quota_bonus" ? "📈" : "✨"}
            </div>
            <div className="lab">
              <div className="title">{rewardLabel(r)}</div>
              <div className="sub">
                {sourceLabel(r.source)} · {new Date(r.issuedAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                {(r.meta as any)?.matrix && ` · ${(r.meta as any).matrix}`}
              </div>
            </div>
            <span className="badge">{r.usedAt ? "사용" : "미사용"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
