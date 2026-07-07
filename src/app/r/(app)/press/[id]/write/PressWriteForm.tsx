"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SnsKind } from "@/lib/types";
import Icon from "@/components/Icon";

const ch_label: Record<SnsKind, string> = {
  naver_blog: "네이버 블로그",
  instagram: "인스타그램",
  tiktok: "틱톡",
};

const ad_notice: Record<SnsKind, string> = {
  naver_blog: "본 게시물은 캐치랭크를 통해 매장으로부터 자료를 제공받아 작성한 콘텐츠입니다.",
  instagram: "#광고 캐치랭크를 통해 자료를 제공받아 작성한 콘텐츠입니다.",
  tiktok: "#광고 #협찬 — 캐치랭크 자료 제공 콘텐츠",
};

export default function PressWriteForm({
  passId,
  channels,
  keywords,
}: {
  passId: string;
  channels: SnsKind[];
  keywords: string[];
}) {
  const router = useRouter();
  const [reviewChannel, setReviewChannel] = useState<SnsKind | "">(channels[0] || "");
  const [reviewUrl, setReviewUrl] = useState("");
  const [adChecked, setAdChecked] = useState(false);
  const [keywordsChecked, setKeywordsChecked] = useState(false);
  const [kitChecked, setKitChecked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 키워드가 등록되지 않은 캠페인은 키워드 체크 항목을 자동 통과 처리
  const needsKeywordCheck = keywords.length > 0;
  const allChecked = adChecked && (needsKeywordCheck ? keywordsChecked : true) && kitChecked;
  const canSubmit = !!reviewChannel && !!reviewUrl && allChecked && !loading;

  async function copyNotice() {
    if (!reviewChannel) return;
    try {
      await navigator.clipboard.writeText(ad_notice[reviewChannel as SnsKind]);
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
      body: JSON.stringify({
        passId,
        reviewChannel,
        reviewUrl,
        pressSelfCheck: { ad: adChecked, keywords: !needsKeywordCheck || keywordsChecked, kit: kitChecked },
      }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "제출 실패");
      setLoading(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-8">
      {/* 1. 작성 채널 */}
      <div>
        <h3 className="text-[12px] tracking-[0.18em] text-muted uppercase mb-3">1 · 작성한 채널 선택</h3>
        <div className="flex gap-2 flex-wrap">
          {channels.map((ch) => (
            <button
              key={ch}
              onClick={() => setReviewChannel(ch)}
              className={`h-10 px-4 rounded-md border text-[14px] font-semibold ${reviewChannel === ch ? "border-[1.5px] border-brand text-brand bg-brandSoft" : "bg-canvas text-ink border-hairline"}`}
            >
              {ch_label[ch]}
            </button>
          ))}
        </div>
      </div>

      {/* 2. 광고 표시 문구 */}
      <div>
        <h3 className="text-[12px] tracking-[0.18em] text-muted uppercase mb-3">2 · 광고 표시 문구 (필수)</h3>
        <div className="rounded-lg border border-brand bg-brandSoft p-4">
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
                {reviewChannel ? ad_notice[reviewChannel as SnsKind] : "채널을 먼저 선택해주세요"}
              </div>
              <button
                type="button"
                onClick={copyNotice}
                disabled={!reviewChannel}
                className="mt-2.5 inline-flex items-center gap-1.5 h-8 px-3 rounded-sm border border-hairline bg-canvas text-[12px] font-semibold disabled:opacity-50"
              >
                <span>📋</span>
                <span>{copied ? "복사됨" : "문구 복사"}</span>
              </button>
            </div>
          </label>
          <div className="text-[11px] text-ink2 mt-3 pt-3 border-t border-dashed border-brand/50 leading-[1.5]">
            공정거래위원회 추천·보증 광고 안내에 따라 경제적 이해관계는 명확히 표시되어야 합니다.
          </div>
        </div>
      </div>

      {/* 3. 게시 URL */}
      <div>
        <h3 className="text-[12px] tracking-[0.18em] text-muted uppercase mb-3">3 · 게시한 콘텐츠 URL</h3>
        <input
          value={reviewUrl}
          onChange={(e) => setReviewUrl(e.target.value)}
          placeholder="https://blog.naver.com/... 또는 https://www.instagram.com/p/..."
          className="w-full h-12 px-4 rounded-pill border border-hairline focus:border-brand focus:outline-none text-[17px]"
        />
        <p className="mt-2 text-[12px] text-muted leading-[1.5]">
          본인 채널에 작성한 콘텐츠의 게시 URL을 그대로 붙여넣어주세요.
        </p>
      </div>

      {/* 4. 자가 점검 */}
      <div>
        <h3 className="text-[12px] tracking-[0.18em] text-muted uppercase mb-3">4 · 작성 조건 자가점검</h3>
        <p className="text-[13px] text-muted mb-3 leading-[1.5]">
          아래 조건을 모두 충족했는지 직접 확인하고 체크해주세요. 추후 운영팀이 무작위 표본 검수합니다.
        </p>
        <div className="rounded-lg border border-hairline overflow-hidden">
          {needsKeywordCheck && (
            <label
              className="flex items-center gap-3 px-4 py-4 cursor-pointer border-b border-hairlineSoft"
            >
              <input
                type="checkbox"
                checked={keywordsChecked}
                onChange={(e) => setKeywordsChecked(e.target.checked)}
                className="sr-only"
              />
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border ${keywordsChecked ? "bg-brand border-brand text-white" : "border-hairline text-canvas"}`}
                aria-hidden="true"
              >
                {keywordsChecked && <Icon name="check" variant="bold" size={14} />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] text-ink">필수 키워드 모두 포함</div>
                <div className="text-[12px] text-muted mt-0.5">{keywords.map((k) => `#${k}`).join(" · ")}</div>
              </div>
            </label>
          )}
          <label className="flex items-center gap-3 px-4 py-4 cursor-pointer">
            <input
              type="checkbox"
              checked={kitChecked}
              onChange={(e) => setKitChecked(e.target.checked)}
              className="sr-only"
            />
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border ${kitChecked ? "bg-brand border-brand text-white" : "border-hairline text-canvas"}`}
              aria-hidden="true"
            >
              {kitChecked && <Icon name="check" variant="bold" size={14} />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] text-ink">자료팩을 활용해 콘텐츠를 작성</div>
              <div className="text-[12px] text-muted mt-0.5">제공된 사진·텍스트·브랜드 톤 중 일부를 본인 콘텐츠에 반영</div>
            </div>
          </label>
        </div>
      </div>

      {err && <div className="text-error text-[13px]">{err}</div>}
      <button
        onClick={submit}
        disabled={!canSubmit}
        className="w-full h-12 rounded-pill bg-brand text-white text-[17px] disabled:opacity-40"
      >
        {loading ? "제출 중..." : "기자단 제출"}
      </button>
    </div>
  );
}
