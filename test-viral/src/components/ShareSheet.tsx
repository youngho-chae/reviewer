import { useState } from "react";
import { ShareChannel, UserKind } from "../types";

interface Props {
  inviteUrl: string;
  referrerNickname: string;
  refereePreviewLabel: string;
  refereeRoleHint: UserKind;
  onSelect: (channel: ShareChannel) => void;
  onClose: () => void;
}

const CHANNELS: { key: ShareChannel; label: string; ic: string }[] = [
  { key: "kakao", label: "카톡", ic: "💬" },
  { key: "sms", label: "문자", ic: "✉️" },
  { key: "instagram_dm", label: "인스타 DM", ic: "📷" },
  { key: "copy_link", label: "링크 복사", ic: "🔗" },
];

export default function ShareSheet({ inviteUrl, referrerNickname, refereePreviewLabel, refereeRoleHint, onSelect, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(inviteUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="share-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>친구에게 쏘기</h3>
        <div className="share-preview">
          <div className="head">📩 자동 생성된 메시지</div>
          {referrerNickname}님이 친구{refereeRoleHint === "owner" ? " 사장님" : ""}에게 {refereePreviewLabel}을(를) 보냈어요. 30초만에 받으세요 → {inviteUrl}
        </div>
        <div className="share-channels">
          {CHANNELS.map((c) => (
            <div key={c.key} className="share-ch" onClick={() => { if (c.key === "copy_link") copy(); onSelect(c.key); }}>
              <span className="ic">{c.ic}</span>
              {c.label}
            </div>
          ))}
        </div>
        <div className="copy-row">
          <span className="url font-mono">{inviteUrl}</span>
          <button className="btn inline secondary" onClick={copy}>{copied ? "복사됨" : "복사"}</button>
        </div>
        <div className="mt-4 muted center" style={{ fontSize: 11 }}>
          채널 선택 시 토큰이 발급되고, 친구가 가입하면 양측에 보상이 즉시 지급됩니다.
        </div>
      </div>
    </div>
  );
}
