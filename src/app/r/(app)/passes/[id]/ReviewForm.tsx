"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SnsKind } from "@/lib/types";
import { CHANNEL_LABEL, CHANNEL_AD_NOTICE, CHANNEL_REVIEW_CONDITIONS, CHANNEL_URL_PLACEHOLDER } from "@/lib/channels";
import Icon from "@/components/Icon";

// 참여 시 채널이 확정되므로(체험권 발급 단계) 여기서는 재선택하지 않고 고정 표기.
export default function ReviewForm({ passId, channel }: { passId: string; channel: SnsKind }) {
  const router = useRouter();
  const conditions = CHANNEL_REVIEW_CONDITIONS[channel] ?? [];
  const [reviewUrl, setReviewUrl] = useState("");
  const [adChecked, setAdChecked] = useState(false);
  const [selfCheck, setSelfCheck] = useState<Record<string, boolean>>(
    Object.fromEntries(conditions.map((c) => [c.key, false])),
  );
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const allSelfChecked = conditions.every((c) => selfCheck[c.key]);
  const canSubmit = !!reviewUrl && adChecked && allSelfChecked && !loading;

  async function copyNotice() {
    try {
      await navigator.clipboard.writeText(CHANNEL_AD_NOTICE[channel]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

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

      {/* 2. 광고 표시 문구 */}
      <div>
        <h3 className="text-[14px] font-bold text-ink mb-3">2 · 광고 표시 문구 (필수)</h3>
        <div className="rounded-md border border-brand bg-brandSoft p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={adChecked}
              onChange={(e) => setAdChecked(e.target.checked)}
              className="mt-1.5 w-4 h-4 accent-brand"
            />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-ink mb-2">아래 문구를 게시물에 포함했습니다</div>
              <div className="p-3 bg-canvas rounded-sm text-[14px] text-ink leading-[1.5] break-keep">
                {CHANNEL_AD_NOTICE[channel]}
              </div>
              <button
                type="button"
                onClick={copyNotice}
                className="mt-2.5 inline-flex items-center gap-1.5 h-8 px-3 rounded-sm border border-hairline bg-canvas text-[12px] font-semibold"
              >
                <span>📋</span>
                <span>{copied ? "복사됨" : "문구 복사"}</span>
              </button>
            </div>
          </label>
          <div className="text-[11px] text-ink2 mt-3 pt-3 border-t border-dashed border-hairline leading-[1.5]">
            공정거래위원회 추천·보증 광고 안내에 따라 경제적 이해관계는 명확히 표시되어야 합니다.
          </div>
        </div>
      </div>

      {/* 3. 리뷰 URL */}
      <div>
        <h3 className="text-[14px] font-bold text-ink mb-3">3 · 리뷰 URL 제출</h3>
        <input
          value={reviewUrl}
          onChange={(e) => setReviewUrl(e.target.value)}
          placeholder={CHANNEL_URL_PLACEHOLDER[channel]}
          className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px]"
        />
      </div>

      {/* 4. 채널별 작성 조건 자가점검 */}
      <div>
        <h3 className="text-[14px] font-bold text-ink mb-3">4 · {CHANNEL_LABEL[channel]} 작성 조건 자가점검</h3>
        <p className="text-[13px] text-muted mb-3 leading-[1.5]">
          아래 조건을 모두 충족했는지 직접 확인하고 체크해주세요. 추후 운영팀이 무작위 표본 검수합니다.
        </p>
        <div className="rounded-md border border-hairline overflow-hidden">
          {conditions.map((item, i) => {
            const checked = selfCheck[item.key];
            return (
              <label
                key={item.key}
                className={`flex items-center gap-3 px-4 py-4 cursor-pointer ${i < conditions.length - 1 ? "border-b border-hairlineSoft" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setSelfCheck((s) => ({ ...s, [item.key]: e.target.checked }))}
                  className="sr-only"
                />
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${checked ? "bg-brand text-white" : "border-[1.5px] border-borderStrong text-canvas"}`}
                  aria-hidden="true"
                >
                  {checked && <Icon name="check" variant="bold" size={14} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`text-[15px] ${checked ? "text-ink font-semibold" : "text-ink"}`}>{item.label}</div>
                  <div className="text-[12px] text-muted mt-0.5">{item.hint}</div>
                </div>
              </label>
            );
          })}
        </div>
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
