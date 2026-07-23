"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CHANNEL_LABEL, CHANNEL_SHORT, CHANNEL_BADGE_BG } from "@/lib/channels";
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

// 연결 가이드 (2026-07-23 시안 — 레퍼런스: 블로그 연결 모달). 마지막 어뷰징 항목은 강조.
const CONNECT_GUIDE: Record<SnsKind, string[]> = {
  naver_blog: [
    "등록 및 변경하고자 하는 블로그 URL 혹은 RSS를 입력해 주세요.",
    "블로그에 전체 공개, 검색 허용이 체크된 포스팅이 1개 이상 있어야 합니다.",
    "연결 시 네이버 로그인으로 본인 계정인지 확인하고, 입력한 블로그 주소를 계정에 귀속해요.",
    "방문자 수 조작 및 불법 프로그램 사용 등 어뷰징 행위 적발 시, 페널티가 부여됩니다.",
  ],
  instagram: [
    "프로필 주소(instagram.com/아이디)를 입력해 주세요.",
    "전체 공개 계정이어야 하고, 게시물이 1개 이상 있어야 합니다.",
    "연결 시 페이스북 로그인으로 본인 계정인지 확인해요.",
    "팔로워 수 조작 및 불법 프로그램 사용 등 어뷰징 행위 적발 시, 페널티가 부여됩니다.",
  ],
  tiktok: [
    "프로필 주소(tiktok.com/@아이디)를 입력해 주세요.",
    "전체 공개 계정이어야 하고, 게시물이 1개 이상 있어야 합니다.",
    "연결 시 틱톡 로그인으로 본인 계정인지 확인해요.",
    "팔로워 수 조작 및 불법 프로그램 사용 등 어뷰징 행위 적발 시, 페널티가 부여됩니다.",
  ],
};

// 검증 상태 칩 — ✓ 본인 인증(oauth) / 데모 인증(demo) / 미인증(자기신고)
function VerifyChip({ verified, via }: { verified: boolean; via: "oauth" | "demo" | null }) {
  if (verified && via === "oauth") {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-successSoft text-successStrong text-[11px] font-semibold">✓ 본인 인증</span>;
  }
  if (verified && via === "demo") {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-brandSoft text-brand text-[11px] font-semibold">✓ 데모 인증</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-sunken text-muted text-[11px] font-semibold">미인증</span>;
}

// SNS 채널 연결 (2026-07-23 시안 개편) — 레퍼런스형 리스트 행("{채널} 연결하기 ›") +
// 연결 바텀시트(URL 입력·연결 가이드·1:1 문의·[연결하기]) → 프로바이더 본인 인증(OAuth/데모)으로 이동.
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
  const [sheetKind, setSheetKind] = useState<SnsKind | null>(null); // 연결 시트 열린 채널
  const [url, setUrl] = useState("");
  const [influence, setInfluence] = useState("");
  const [confirmKind, setConfirmKind] = useState<SnsKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function openSheet(row: ChannelRow) {
    setSheetKind(row.kind);
    setUrl(row.url);
    setInfluence(row.influence ? String(row.influence) : "");
    setErr(null);
  }

  function startVerify(kind: SnsKind, u: string, inf: string | number) {
    const q = new URLSearchParams({ url: u, influence: String(inf || 0) });
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

  const sheetRow = sheetKind ? rows.find((r) => r.kind === sheetKind) : null;

  return (
    <div>
      {/* 결과 배너 — OAuth/데모 검증 복귀 시 */}
      <div className="px-5 space-y-2">
        {connected && (
          <div className="rounded-md bg-successSoft px-3.5 py-3 text-[13px] font-semibold text-successStrong">
            ✓ {CHANNEL_LABEL[connected as SnsKind] ?? connected} 채널이 본인 인증과 함께 연결되었어요.
          </div>
        )}
        {error && (
          <div className="rounded-md bg-errorSoft px-3.5 py-3 text-[13px] text-error leading-[1.5]">
            {error === "state"
              ? "인증 세션이 만료되었거나 요청이 유효하지 않아요. 다시 시도해주세요."
              : "본인 인증에 실패했어요. 잠시 후 다시 시도해주세요. (기존 연결 상태는 그대로예요)"}
          </div>
        )}
      </div>

      {/* 채널 리스트 — 레퍼런스형 행 (원형 아이콘 + "{채널} 연결하기 ›" + 안내) */}
      <div>
        {rows.map((row, i) => (
          <div key={row.kind} className={`px-5 py-7 ${i < rows.length - 1 ? "border-b border-hairlineSoft" : ""}`}>
            <button type="button" onClick={() => openSheet(row)} className="cp-action w-full flex items-center gap-4 text-left">
              <span className={`w-12 h-12 rounded-full grid place-items-center text-[15px] font-bold shrink-0 ${CHANNEL_BADGE_BG[row.kind]}`}>
                {CHANNEL_SHORT[row.kind]}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[17px] font-bold text-ink tracking-title">
                    {CHANNEL_LABEL[row.kind]} {row.connected ? "" : "연결하기"}
                  </span>
                  {row.connected ? <VerifyChip verified={row.verified} via={row.verifiedVia} /> : <span className="text-[15px] text-muted">›</span>}
                </span>
                <span className="block mt-1 text-[13px] text-muted truncate">
                  {row.connected
                    ? `${row.accountName ? `${row.accountName} · ` : ""}${METRIC[row.kind]} ${row.influence.toLocaleString()}명${row.grade ? ` · ${row.grade}등급` : ""}`
                    : `${CHANNEL_LABEL[row.kind]}을 연결하고 더 많은 캠페인을 체험해보세요.`}
                </span>
              </span>
            </button>

            {/* 연결된 채널 — 관리 액션 (재인증·해제) */}
            {row.connected && (
              <div className="mt-3 pl-16 flex gap-3 text-[13px]">
                <button type="button" onClick={() => openSheet(row)} className="cp-action font-semibold text-brand">
                  {row.verified ? "다시 인증" : "본인 인증하기"}
                </button>
                <button type="button" onClick={() => setConfirmKind(row.kind)} className="cp-action font-semibold text-muted">
                  연결 해제
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="px-5 pt-4 text-[12px] text-muted leading-[1.55]">
        등급은 <span className="font-semibold text-ink2">채널별로 각각 평가</span>돼요. 마이페이지에는 연결 채널 중
        가장 높은 등급(현재 <span className="font-semibold text-ink">{overallGrade}</span>)이 표기되며, 연결·해제 시
        다시 계산돼요.
      </p>

      {/* 연결 바텀시트 (2026-07-23 시안 — 레퍼런스: 블로그 연결) */}
      {sheetRow && (
        <div className="fixed inset-0 bg-ink/45 z-50 flex items-end" onClick={() => setSheetKind(null)}>
          <div
            className="bg-canvas w-full max-w-[480px] mx-auto rounded-t-xl px-6 pt-3 pb-8 max-h-[88dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pb-3">
              <span className="w-9 h-1 rounded-pill bg-borderStrong" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-10 h-10 rounded-full grid place-items-center text-[14px] font-bold ${CHANNEL_BADGE_BG[sheetRow.kind]}`}>
                  {CHANNEL_SHORT[sheetRow.kind]}
                </span>
                <h2 className="text-[18px] font-bold text-ink tracking-title">{CHANNEL_LABEL[sheetRow.kind]} 연결</h2>
              </div>
              <button type="button" onClick={() => setSheetKind(null)} aria-label="닫기" className="cp-action w-10 h-10 rounded-full text-[18px] text-ink">
                ✕
              </button>
            </div>

            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              inputMode="url"
              placeholder="http:// 또는 https://를 포함한 정확한 미디어 주소를 입력해주세요."
              className="mt-5 w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[14px]"
            />
            <input
              value={influence}
              onChange={(e) => setInfluence(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder={`${METRIC[sheetRow.kind]} 수 (본인 인증에서 확인되면 자동 반영)`}
              className="mt-2 w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[14px] tabular-nums"
            />

            {/* 연결 가이드 */}
            <div className="mt-6">
              <div className="text-[14px] font-bold text-ink">연결 가이드</div>
              <ul className="mt-3 space-y-2">
                {CONNECT_GUIDE[sheetRow.kind].map((g, i, arr) => (
                  <li key={i} className={`flex gap-2 text-[13px] leading-[1.55] ${i === arr.length - 1 ? "text-ink font-semibold" : "text-muted"}`}>
                    <span className="shrink-0">·</span>
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>

            <a href="mailto:help@catchrank.co.kr?subject=[CATCHPASS] 채널 연결 문의" className="cp-action mt-5 inline-flex items-center gap-1 text-[13px] font-semibold text-ink">
              1:1 문의하기 <span className="text-muted">›</span>
            </a>

            {err && <p className="mt-3 text-[13px] text-error">{err}</p>}
            <div className="mt-5 pt-4 border-t border-hairlineSoft">
              <button
                type="button"
                onClick={() => startVerify(sheetRow.kind, url, influence)}
                disabled={sheetRow.kind === "naver_blog" && !url.trim()}
                className="cp-action w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
              >
                {sheetRow.connected && sheetRow.verified ? "다시 인증하고 연결 갱신" : "연결하기"}
              </button>
              <p className="mt-2 text-[11px] text-muted text-center">
                [연결하기]를 누르면 {SNS_PROVIDER_LOGIN_LABEL[sheetRow.kind]}으로 본인 계정인지 확인해요.
                {!sheetRow.oauthReady && " (지금은 데모 검증 모드 — OAuth 키 설정 시 실제 로그인으로 전환)"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 해제 확인 — 중앙 모달 */}
      {confirmKind && (
        <div className="fixed inset-0 bg-ink/45 z-50 flex items-center justify-center px-6" onClick={() => !busy && setConfirmKind(null)}>
          <div
            className="w-full max-w-[400px] bg-canvas rounded-xl px-6 pt-7 pb-6 text-center"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-label="채널 연결 해제 확인"
          >
            <h2 className="text-[17px] font-bold text-ink tracking-title">
              {CHANNEL_LABEL[confirmKind]} 연결을 해제할까요?
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
