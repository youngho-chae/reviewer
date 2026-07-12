"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CHANNEL_LABEL, CHANNEL_SHORT, CHANNEL_BADGE_BG, CHANNEL_URL_PLACEHOLDER } from "@/lib/channels";
import { SNS_PROVIDER_LOGIN_LABEL } from "@/lib/sns-oauth-labels";
import type { Grade, SnsKind } from "@/lib/types";

export interface ChannelRow {
  kind: SnsKind;
  connected: boolean;
  url: string;
  influence: number;
  verified: boolean;
  verifiedVia: "oauth" | "demo" | null;
  accountName: string | null;
  grade: Grade | null;
  oauthReady: boolean; // 프로바이더 OAuth 키 설정 여부 (false = 데모 검증 모드)
}

const METRIC: Record<SnsKind, string> = {
  naver_blog: "일방문자",
  instagram: "팔로워",
  tiktok: "팔로워",
};

// 검증 상태 칩 — ✓ 본인 인증(oauth) / 데모 인증(demo) / 미인증(자기신고)
function VerifyChip({ verified, via }: { verified: boolean; via: "oauth" | "demo" | null }) {
  if (verified && via === "oauth") {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-successSoft text-successStrong text-[11px] font-semibold">✓ 본인 인증</span>;
  }
  if (verified && via === "demo") {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-brandSoft text-brand text-[11px] font-semibold">✓ 데모 인증</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-sunken text-muted text-[11px] font-semibold">미인증 · 자기신고</span>;
}

// 채널 연동/해제 매니저 — 연동 시 /api/sns/{kind}/start로 전체 페이지 이동(OAuth 리다이렉트).
export default function ChannelManager({
  rows,
  connected,
  error,
  overallGrade,
}: {
  rows: ChannelRow[];
  connected: string | null;
  error: string | null;
  overallGrade: Grade;
}) {
  const router = useRouter();
  // 미연동 카드 입력값 (채널별)
  const [inputs, setInputs] = useState<Record<string, { url: string; influence: string }>>({});
  const [confirmKind, setConfirmKind] = useState<SnsKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const getInput = (kind: SnsKind) => inputs[kind] ?? { url: "", influence: "" };
  const setInput = (kind: SnsKind, patch: Partial<{ url: string; influence: string }>) =>
    setInputs((prev) => ({ ...prev, [kind]: { ...getInput(kind), ...patch } }));

  function startVerify(kind: SnsKind, url: string, influence: string | number) {
    const q = new URLSearchParams({ url, influence: String(influence || 0) });
    // OAuth 리다이렉트(외부 프로바이더) — 전체 페이지 내비게이션 필요
    window.location.href = `/api/sns/${kind}/start?${q}`;
  }

  async function disconnect(kind: SnsKind) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/sns/disconnect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || "해제에 실패했습니다");
        setBusy(false);
        return;
      }
      setConfirmKind(null);
      setBusy(false);
      router.refresh();
    } catch {
      setErr("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
      setBusy(false);
    }
  }

  return (
    <div className="px-5 space-y-3">
      {/* 결과 배너 — OAuth/데모 검증 복귀 시 */}
      {connected && (
        <div className="rounded-md bg-successSoft px-3.5 py-3 text-[13px] font-semibold text-successStrong">
          ✓ {CHANNEL_LABEL[connected as SnsKind] ?? connected} 채널이 본인 인증과 함께 연동되었어요.
        </div>
      )}
      {error && (
        <div className="rounded-md bg-errorSoft px-3.5 py-3 text-[13px] text-error leading-[1.5]">
          {error === "state"
            ? "인증 세션이 만료되었거나 요청이 유효하지 않아요. 다시 시도해주세요."
            : "본인 인증에 실패했어요. 잠시 후 다시 시도해주세요. (기존 연동 상태는 그대로예요)"}
        </div>
      )}

      {rows.map((row) => {
        const input = getInput(row.kind);
        return (
          <div key={row.kind} className="rounded-lg border border-hairline bg-canvas p-4">
            <div className="flex items-center gap-2.5">
              <span className={`w-8 h-8 rounded-md grid place-items-center text-[13px] font-bold ${CHANNEL_BADGE_BG[row.kind]}`}>
                {CHANNEL_SHORT[row.kind]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold text-ink">{CHANNEL_LABEL[row.kind]}</span>
                  {row.connected && <VerifyChip verified={row.verified} via={row.verifiedVia} />}
                </div>
                {row.connected ? (
                  <div className="text-[12px] text-muted mt-0.5 truncate">
                    {row.accountName ? `${row.accountName} · ` : ""}
                    {METRIC[row.kind]} {row.influence.toLocaleString()}명
                    {row.grade ? ` · ${row.grade}등급` : ""}
                  </div>
                ) : (
                  <div className="text-[12px] text-muted mt-0.5">연동 안 됨 — 이 채널 캠페인에 참여하려면 연동이 필요해요</div>
                )}
              </div>
            </div>

            {row.connected ? (
              <>
                {row.url && <div className="mt-2.5 text-[12px] text-info truncate">{row.url}</div>}
                <div className="mt-3 flex gap-2">
                  {row.verified ? (
                    /* 재연동(재인증) — 계정 교체·정보 갱신용. OAuth(키 설정 시) 또는 데모 승인 화면 재실행,
                       applySnsConnect가 kind 기준 upsert라 해제 없이 갱신된다 (2026-07-10) */
                    <button
                      type="button"
                      onClick={() => startVerify(row.kind, row.url, row.influence)}
                      className="cp-action flex-1 h-11 rounded-md border border-brand text-brand text-[14px] font-bold bg-canvas"
                    >
                      다시 인증 (재연동)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startVerify(row.kind, row.url, row.influence)}
                      className="cp-action flex-1 h-11 rounded-md bg-brand text-white text-[14px] font-bold"
                    >
                      {SNS_PROVIDER_LOGIN_LABEL[row.kind]}으로 본인 인증
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmKind(row.kind)}
                    className="cp-action flex-1 h-11 rounded-md border border-hairline bg-canvas text-[14px] font-semibold text-ink"
                  >
                    연동 해제
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-3 space-y-2">
                <input
                  value={input.url}
                  onChange={(e) => setInput(row.kind, { url: e.target.value })}
                  placeholder={CHANNEL_URL_PLACEHOLDER[row.kind]}
                  className="w-full h-11 px-3.5 rounded-md border border-hairline focus:border-brand focus:outline-none text-[14px]"
                />
                {row.kind === "naver_blog" && (
                  <p className="text-[11px] text-muted">네이버는 로그인으로 계정을 인증하고, 입력한 블로그 주소를 계정에 귀속해요.</p>
                )}
                <input
                  value={input.influence}
                  onChange={(e) => setInput(row.kind, { influence: e.target.value.replace(/\D/g, "") })}
                  inputMode="numeric"
                  placeholder={`${METRIC[row.kind]} 수 (인증에서 확인되면 자동 반영)`}
                  className="w-full h-11 px-3.5 rounded-md border border-hairline focus:border-brand focus:outline-none text-[14px] tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => startVerify(row.kind, input.url, input.influence)}
                  disabled={row.kind === "naver_blog" && !input.url}
                  className="cp-action w-full h-11 rounded-md bg-brand text-white text-[14px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
                >
                  {SNS_PROVIDER_LOGIN_LABEL[row.kind]}으로 본인 인증하고 연동
                </button>
                {!row.oauthReady && (
                  <p className="text-[11px] text-mutedSoft">
                    지금은 데모 검증 모드예요 — 실제 {SNS_PROVIDER_LOGIN_LABEL[row.kind]}은 OAuth 키 설정 시 자동 활성화돼요.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      <p className="pt-1 text-[12px] text-muted leading-[1.55]">
        등급은 <span className="font-semibold text-ink2">채널별로 각각 평가</span>돼요. 마이페이지에는 연동 채널 중
        가장 높은 등급(현재 <span className="font-semibold text-ink">{overallGrade}</span>)이 표기되며, 연동·해제 시
        다시 계산돼요.
      </p>

      {/* 해제 확인 — 중앙 모달 */}
      {confirmKind && (
        <div className="fixed inset-0 bg-ink/45 z-50 flex items-center justify-center px-6" onClick={() => !busy && setConfirmKind(null)}>
          <div
            className="w-full max-w-[400px] bg-canvas rounded-xl px-6 pt-7 pb-6 text-center"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-label="채널 연동 해제 확인"
          >
            <h2 className="text-[17px] font-bold text-ink tracking-title">
              {CHANNEL_LABEL[confirmKind]} 연동을 해제할까요?
            </h2>
            <p className="mt-3 text-[14px] text-ink2 leading-[1.65]">
              해제하면 이 채널 캠페인에 새로 참여할 수 없고,
              <br />
              마이페이지 표기 등급이 남은 채널 중 가장 높은
              <br />
              등급으로 바뀔 수 있어요.
              <br />
              진행 중인 체험권과 이력은 그대로 유지돼요.
            </p>
            {err && <div className="mt-3 text-[12px] text-error">{err}</div>}
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                disabled={busy}
                onClick={() => disconnect(confirmKind)}
                className="cp-action h-12 rounded-md bg-sunken text-ink text-[15px] font-semibold disabled:opacity-50"
              >
                {busy ? "해제 중..." : "해제하기"}
              </button>
              <button
                disabled={busy}
                onClick={() => setConfirmKind(null)}
                className="cp-action h-12 rounded-md bg-brand text-white text-[15px] font-bold disabled:opacity-60"
              >
                유지하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
