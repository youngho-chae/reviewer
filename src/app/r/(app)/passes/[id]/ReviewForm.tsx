"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SnsKind } from "@/lib/types";
import { CHANNEL_LABEL, KEEP_DAYS, selfCheckConditions } from "@/lib/channels";
import Icon from "@/components/Icon";

// 참여 시 채널이 확정되므로(체험권 발급 단계) 여기서는 재선택하지 않고 고정 표기.
// [2026-07-08] 광고 표시 문구 원문·복사 버튼은 매장 상세(작성 전 안내)로 이동 —
// 제출 화면은 자가 점검만 수행한다. 광고 문구 포함 여부도 자가 점검 항목으로 확인.
// [2026-07-10] 자가 점검 = "제출 시점에 완료된 사실"만. 게시 유지(90일)는 미래 행동이므로
// 자가 점검에서 분리해 별도 필수 동의(keepAgreed)로 받는다 — 서버도 필수 검증.
export default function ReviewForm({
  passId,
  channel,
  storeId,
}: {
  passId: string;
  channel: SnsKind;
  storeId?: string;
}) {
  const router = useRouter();
  const conditions = selfCheckConditions(channel);
  const [reviewUrl, setReviewUrl] = useState("");
  const [adChecked, setAdChecked] = useState(false);
  const [keepAgreed, setKeepAgreed] = useState(false);
  const [selfCheck, setSelfCheck] = useState<Record<string, boolean>>(
    Object.fromEntries(conditions.map((c) => [c.key, false])),
  );
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const allSelfChecked = conditions.every((c) => selfCheck[c.key]);
  // [2026-07-12 회의 §11-2] 입력 URL 형식 검증 — http(s):// 로 시작하는 유효한 주소만 제출
  const urlValid = /^https?:\/\/\S+\.\S+/.test(reviewUrl.trim());
  const canSubmit = !!reviewUrl && urlValid && adChecked && allSelfChecked && keepAgreed && !loading;

  async function submit() {
    setLoading(true);
    setErr(null);
    const res = await fetch("/api/passes/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passId, reviewChannel: channel, reviewUrl, selfCheck, adNotice: adChecked, keepAgreed }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      setErr(error || "등록 실패");
      setLoading(false);
      return;
    }
    router.refresh();
  }

  // 광고 표시 문구 포함 여부를 자가 점검 항목으로 통합 (원문·복사는 매장 상세에서)
  const checkRows: { key: string; label: string; hint: string; checked: boolean; toggle: (v: boolean) => void }[] = [
    {
      key: "__ad_notice",
      label: "광고 표시 문구를 게시물에 포함했어요",
      hint: "문구 원문은 매장 상세의 '리뷰 작성 조건'에서 복사할 수 있어요",
      checked: adChecked,
      toggle: setAdChecked,
    },
    ...conditions.map((c) => ({
      key: c.key,
      label: c.label,
      hint: c.hint,
      checked: !!selfCheck[c.key],
      toggle: (v: boolean) => setSelfCheck((s) => ({ ...s, [c.key]: v })),
    })),
  ];

  return (
    <div className="mt-6 space-y-8">
      {/* 1. 작성 채널 (참여 시 확정) */}
      <div>
        <h3 className="text-[14px] font-bold text-ink mb-3">1 · 작성 채널</h3>
        <div className="inline-flex items-center gap-2 h-10 px-4 rounded-pill bg-brandSoft text-brand text-[14px] font-semibold">
          {CHANNEL_LABEL[channel]}
        </div>
        <p className="mt-2 text-[12px] text-muted">참여 시 선택한 채널이에요. 이 채널에 작성한 게시물 URL을 제출해주세요.</p>
      </div>

      {/* 2. 리뷰 URL */}
      <div>
        <h3 className="text-[14px] font-bold text-ink mb-3">2 · 리뷰 URL 제출</h3>
        <input
          value={reviewUrl}
          onChange={(e) => setReviewUrl(e.target.value)}
          placeholder="리뷰 URL을 입력해 주세요"
          className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px]"
        />
        {reviewUrl.trim() !== "" && !urlValid && (
          <p className="mt-1.5 text-[12px] text-error">http:// 또는 https:// 로 시작하는 게시물 주소를 입력해주세요.</p>
        )}
      </div>

      {/* 3. 작성 조건 자가점검 — 광고 문구 포함 여부를 첫 항목으로 확인 */}
      <div>
        <h3 className="text-[14px] font-bold text-ink mb-3">3 · {CHANNEL_LABEL[channel]} 작성 조건 자가점검</h3>
        <p className="text-[13px] text-muted mb-3 leading-[1.5]">
          아래 조건을 모두 충족했는지 직접 확인하고 체크해주세요. 추후 운영팀이 무작위 표본 검수합니다.
        </p>
        <div className="rounded-md border border-hairline overflow-hidden">
          {checkRows.map((item, i) => (
            <label
              key={item.key}
              className={`flex items-center gap-3 px-4 py-4 cursor-pointer ${i < checkRows.length - 1 ? "border-b border-hairlineSoft" : ""}`}
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => item.toggle(e.target.checked)}
                className="sr-only"
              />
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${item.checked ? "bg-brand text-white" : "border-[1.5px] border-borderStrong text-canvas"}`}
                aria-hidden="true"
              >
                {item.checked && <Icon name="check" variant="bold" size={14} />}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-[15px] ${item.checked ? "text-ink font-semibold" : "text-ink"}`}>{item.label}</div>
                <div className="text-[12px] text-muted mt-0.5">{item.hint}</div>
              </div>
            </label>
          ))}
        </div>
        {storeId && (
          <Link href={`/r/store/${storeId}`} className="cp-action mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-brand">
            조건·광고 문구 다시 보기 (매장 상세) →
          </Link>
        )}
      </div>

      {/* 4. 게시 유지 동의 — 미래 행동에 대한 별도 필수 동의 (자가 점검과 분리) */}
      <div>
        <h3 className="text-[14px] font-bold text-ink mb-3">4 · 게시 유지 동의 (필수)</h3>
        <label className="flex items-center gap-3 px-4 py-4 rounded-md border border-hairline cursor-pointer">
          <input
            type="checkbox"
            checked={keepAgreed}
            onChange={(e) => setKeepAgreed(e.target.checked)}
            className="sr-only"
          />
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${keepAgreed ? "bg-brand text-white" : "border-[1.5px] border-borderStrong text-canvas"}`}
            aria-hidden="true"
          >
            {keepAgreed && <Icon name="check" variant="bold" size={14} />}
          </span>
          <div className="flex-1 min-w-0">
            <div className={`text-[15px] text-ink ${keepAgreed ? "font-semibold" : ""}`}>
              제출한 리뷰를 등록일로부터 {KEEP_DAYS}일 이상 유지하는 데 동의합니다.
            </div>
            <div className="text-[12px] text-muted mt-0.5">유지 기간 내 삭제·비공개 전환 시 등급 점수가 차감될 수 있어요</div>
          </div>
        </label>
      </div>

      {err && <div className="text-error text-[13px]">{err}</div>}
      <button
        onClick={submit}
        disabled={!canSubmit}
        className="w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
      >
        {loading ? "등록 중..." : "제출하고 인증 받기"}
      </button>
    </div>
  );
}
