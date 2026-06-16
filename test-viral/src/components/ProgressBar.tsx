interface Props {
  accepted: number;
}

export default function ProgressBar({ accepted }: Props) {
  const milestones = [
    { label: "일반 박스", at: 0, end: 3 },
    { label: "실버 박스", at: 3, end: 5 },
    { label: "골드 박스", at: 5, end: 10 },
  ];
  const cur = milestones.find((m) => accepted >= m.at && accepted < m.end) ?? milestones[2];
  const progressInMile = Math.min(1, (accepted - cur.at) / (cur.end - cur.at));
  const next = milestones.find((m) => m.at > accepted);
  const remaining = next ? next.at - accepted : 0;

  return (
    <div className="progress">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${Math.max(8, progressInMile * 100)}%` }} />
      </div>
      <div className="meta">
        <span>현재: <strong style={{ color: "var(--ink)" }}>{cur.label}</strong></span>
        <span>
          {next ? `다음 박스까지 친구 ${remaining}명` : "최고 등급 달성"}
        </span>
      </div>
    </div>
  );
}
