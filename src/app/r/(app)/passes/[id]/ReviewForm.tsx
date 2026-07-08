"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SnsKind } from "@/lib/types";
import { CHANNEL_LABEL, CHANNEL_REVIEW_CONDITIONS, CHANNEL_URL_PLACEHOLDER } from "@/lib/channels";
import Icon from "@/components/Icon";

// 참여 시 채널이 확정되므로(체험권 발급 단계) 여기서는 재선택하지 않고 고정 표기.
// [2026-07-08] 광고 표시 문구 원문·복사 버튼은 매장 상세(작성 전 안내)로 이동 —
// 제출 화면은 자가 점검만 수행한다. 광고 문구 포함 여부도 자가 점검 항목으로 확인.
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
  const conditions = CHANNEL_REVIEW_CONDITIONS[channel] ?? [];
  const [reviewUrl, setReviewUrl] = useState("");
  const [adChecked, setAdChecked] = useState(false);
  const [selfCheck, setSelfCheck] = useState<Record<string, boolean>>(
    Object.fromEntries(conditions.map((c) => [c.key, false])),
  );
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const allSelfChecked = conditions.every((c) => selfCheck[c.key]);
  const canSubmit = !!reviewUrl && adChecked && allSelfChecked && !loading;

  async function submit() {
    setLoading(true);
    setErr(null);
    const res = await fetch("/api/passes/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passId, reviewChannel: channel, reviewUrl, selfCheck, adNotice: adChecked }),
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
          placeholder={CHANNEL_URL_PLACEHOLDER[channel]}
          className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px]"
        />
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
