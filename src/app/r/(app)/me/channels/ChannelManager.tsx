"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CHANNEL_LABEL, CHANNEL_SHORT, CHANNEL_BADGE_BG } from "@/lib/channels";
import type { Grade, SnsKind } from "@/lib/types";

export interface ChannelRow {
  kind: SnsKind;
  connected: boolean;
  url: string;
  influence: number;
  verified: boolean;
  verifiedVia: "oauth" | "demo" | "bio" | null;
  accountName: string | null;
  grade: Grade | null;
}

const METRIC: Record<SnsKind, string> = {
  naver_blog: "일방문자",
  instagram: "팔로워",
  tiktok: "팔로워",
};

const BIO_LABEL: Record<SnsKind, string> = {
  naver_blog: "블로그 소개글",
  instagram: "프로필 소개(bio)",
  tiktok: "프로필 소개(bio)",
};

const URL_PLACEHOLDER: Record<SnsKind, string> = {
  naver_blog: "blog.naver.com/아이디 또는 아이디",
  instagram: "instagram.com/아이디 또는 @아이디",
  tiktok: "tiktok.com/@아이디 또는 @아이디",
};

// 연결 가이드 (2026-07-25 소개글 인증코드 개편). 마지막 어뷰징 항목은 강조.
const CONNECT_GUIDE: Record<SnsKind, string[]> = {
  naver_blog: [
    "발급된 계정 인증코드를 복사해 블로그 소개글 맨 앞에 붙여넣고 저장해 주세요.",
    "[인증하기]를 누르면 30분 동안 유효하며, 그 안에 인증을 완료해 주세요.",
    "인증이 완료되면 소개글의 코드는 지워도 돼요. 등급과 방문자 수는 블로그 분석으로 자동 산정돼요.",
    "방문자 수 조작 및 불법 프로그램 사용 등 어뷰징 행위 적발 시, 페널티가 부여됩니다.",
  ],
  instagram: [
    "발급된 계정 인증코드를 복사해 프로필 소개(bio) 맨 앞에 붙여넣고 저장해 주세요.",
    "[인증하기]를 누르면 30분 동안 유효하며, 그 안에 인증을 완료해 주세요.",
    "전체 공개 계정이어야 해요. 인증되면 계정 분석으로 등급과 팔로워 수가 자동 산정돼요.",
    "팔로워 수 조작 및 불법 프로그램 사용 등 어뷰징 행위 적발 시, 페널티가 부여됩니다.",
  ],
  tiktok: [
    "발급된 계정 인증코드를 복사해 프로필 소개(bio) 맨 앞에 붙여넣고 저장해 주세요.",
    "[인증하기]를 누르면 30분 동안 유효하며, 그 안에 인증을 완료해 주세요.",
    "전체 공개 계정이어야 해요. 인증되면 계정 분석으로 등급과 팔로워 수가 자동 산정돼요.",
    "팔로워 수 조작 및 불법 프로그램 사용 등 어뷰징 행위 적발 시, 페널티가 부여됩니다.",
  ],
};

// 검증 상태 칩 — ✓ 본인 인증(bio/oauth) / 데모 인증(demo) / 미인증(자기신고)
function VerifyChip({ verified, via }: { verified: boolean; via: "oauth" | "demo" | "bio" | null }) {
  if (verified && (via === "bio" || via === "oauth")) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-successSoft text-successStrong text-[11px] font-semibold">✓ 본인 인증</span>;
  }
  if (verified && via === "demo") {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-brandSoft text-brand text-[11px] font-semibold">✓ 데모 인증</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-sunken text-muted text-[11px] font-semibold">미인증</span>;
}

// SNS 채널 연결 (2026-07-25 소개글 인증코드 개편) — 레퍼런스형 리스트 행 +
// 연결 바텀시트: 계정 인증코드(8자리·1회성) → [인증하기](30분 유효 시작·주소 입력 활성화)
// → 소개글 맨 앞에 코드 삽입 → 주소 입력 → [인증완료] = 즉시 크롤링 검증.
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
  const [code, setCode] = useState<string | null>(null); // 발급된 계정 인증코드
  const [copied, setCopied] = useState(false);
  const [armedUntil, setArmedUntil] = useState<number | null>(null); // 인증하기 후 만료 시각
  const [nowTick, setNowTick] = useState(Date.now()); // 카운트다운 1초 틱
  const [url, setUrl] = useState("");
  const [confirmKind, setConfirmKind] = useState<SnsKind | null>(null); // 해제 확인 모달
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false); // 인증완료 실패 → [재시도] 라벨
  const [err, setErr] = useState<string | null>(null);
  const [errTrace, setErrTrace] = useState<string[]>([]); // 검증 실패 층별 진단 (내부 QA)
  const [justConnected, setJustConnected] = useState<SnsKind | null>(null);

  const armed = armedUntil !== null && armedUntil > nowTick;
  const leftMs = armedUntil ? Math.max(0, armedUntil - nowTick) : 0;
  const leftLabel = `${String(Math.floor(leftMs / 60000)).padStart(2, "0")}:${String(Math.floor((leftMs % 60000) / 1000)).padStart(2, "0")}`;

  // 카운트다운 틱 — 무장 상태에서만
  useEffect(() => {
    if (armedUntil === null) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [armedUntil]);

  async function openSheet(row: ChannelRow) {
    setSheetKind(row.kind);
    setUrl(row.url);
    setCode(null);
    setCopied(false);
    setArmedUntil(null);
    setFailed(false);
    setErr(null);
    setErrTrace([]);
    // 계정 인증코드 발급 (§1 — 시트 오픈 시 생성, 유효 시간은 [인증하기]부터)
    try {
      const res = await fetch("/api/sns/bio-verify/issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: row.kind }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.code) setCode(j.code);
      else setErr(j.error || "인증코드 발급에 실패했어요 — 시트를 다시 열어주세요.");
    } catch {
      setErr("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    }
  }

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  // [인증하기] — 30분 카운팅 시작 + SNS 주소 입력 활성화 (§1)
  async function arm(kind: SnsKind) {
    if (!code) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/sns/bio-verify/arm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, code }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j.error || "인증 시작에 실패했어요.");
        setBusy(false);
        return;
      }
      setArmedUntil(j.expiresAt);
      setNowTick(Date.now());
      setFailed(false);
      setBusy(false);
    } catch {
      setErr("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
      setBusy(false);
    }
  }

  // [인증완료]/[재시도] — 즉시 크롤링 검증 (§2~§4) + 네이버 블로그 등급 산정 (§5~§7)
  async function confirm(kind: SnsKind) {
    setBusy(true);
    setErr(null);
    setErrTrace([]);
    try {
      const res = await fetch("/api/sns/bio-verify/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, url }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j.error || "인증에 실패했어요.");
        setErrTrace(Array.isArray(j.trace) ? j.trace : []);
        if (j.expired) {
          // 유효 시간 만료 — [인증하기]부터 다시
          setArmedUntil(null);
          setFailed(false);
        } else {
          setFailed(true); // §3 — [재시도]로 전환
        }
        setBusy(false);
        return;
      }
      setBusy(false);
      setSheetKind(null);
      setJustConnected(kind);
      router.refresh();
    } catch {
      setErr("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
      setFailed(true);
      setBusy(false);
    }
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
      {/* 결과 배너 */}
      <div className="px-5 space-y-2">
        {(justConnected || connected) && (
          <div className="rounded-md bg-successSoft px-3.5 py-3 text-[13px] font-semibold text-successStrong">
            ✓ {CHANNEL_LABEL[(justConnected ?? connected) as SnsKind] ?? connected} 채널이 본인 인증과 함께 연결되었어요.
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

      {/* 연결 바텀시트 (2026-07-25 소개글 인증코드 개편) */}
      {sheetRow && (
        <div className="fixed inset-0 bg-ink/45 z-50 flex items-end" onClick={() => !busy && setSheetKind(null)}>
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

            {/* 계정 인증코드 (§1) — 8자리 1회성, [인증하기]부터 30분 유효 */}
            <div className="mt-5 rounded-md border border-hairline p-4">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold text-ink">계정 인증코드</div>
                {armed && (
                  <span className="text-[12px] font-semibold text-brand tabular-nums">{leftLabel} 남음</span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="flex-1 text-[22px] font-bold tracking-[0.2em] text-ink font-mono tabular-nums">
                  {code ?? "········"}
                </span>
                <button
                  type="button"
                  onClick={copyCode}
                  disabled={!code}
                  className="cp-action h-9 px-3 rounded-sm border border-hairline bg-canvas text-[12px] font-semibold disabled:opacity-50"
                >
                  {copied ? "복사됨" : "복사"}
                </button>
              </div>
              <p className="mt-2 text-[12px] text-muted leading-[1.5]">
                이 코드를 {BIO_LABEL[sheetRow.kind]} <b className="text-ink2">맨 앞</b>에 붙여넣고 저장한 뒤 돌아와주세요.
              </p>
              {!armed && (
                <button
                  type="button"
                  onClick={() => arm(sheetRow.kind)}
                  disabled={!code || busy}
                  className="cp-action mt-3 w-full h-11 rounded-md bg-brand text-white text-[14px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
                >
                  {busy ? "처리 중..." : "인증하기"}
                </button>
              )}
              {armedUntil !== null && !armed && (
                <p className="mt-2 text-[12px] text-error">인증 시간이 만료되었어요 — [인증하기]를 다시 눌러주세요.</p>
              )}
            </div>

            {/* SNS 주소 — [인증하기] 전에는 비활성 (§1) */}
            <div className="mt-4">
              <div className="text-[13px] font-semibold text-ink mb-1.5">SNS 주소</div>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                inputMode="url"
                disabled={!armed}
                placeholder={armed ? URL_PLACEHOLDER[sheetRow.kind] : "[인증하기]를 누르면 입력할 수 있어요"}
                className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[14px] disabled:bg-sunken disabled:text-mutedSoft"
              />
            </div>

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
            {/* 층별 검증 진단 — 내부 QA용 (실패 시에만 서버가 내려줌) */}
            {errTrace.length > 0 && (
              <div className="mt-1.5 space-y-0.5">
                {errTrace.map((t, i) => (
                  <p key={i} className="text-[11px] text-muted leading-[1.5]">
                    · {t}
                  </p>
                ))}
              </div>
            )}
            <div className="mt-5 pt-4 border-t border-hairlineSoft">
              <button
                type="button"
                onClick={() => confirm(sheetRow.kind)}
                disabled={!armed || !url.trim() || busy}
                className="cp-action w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
              >
                {busy ? "소개글 확인 중..." : failed ? "재시도" : "인증완료"}
              </button>
              <p className="mt-2 text-[11px] text-muted text-center">
                [인증완료]를 누르면 채널 소개글을 즉시 확인해 인증코드 일치 여부를 검증해요. 인증되면 계정
                분석으로 등급·{METRIC[sheetRow.kind]} 수가 자동 반영돼요.
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
