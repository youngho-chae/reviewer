"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SnsKind } from "@/lib/types";

const ch_label: Record<SnsKind, string> = {
  naver_blog: "네이버 블로그",
  instagram: "인스타그램",
  youtube: "유튜브",
  tiktok: "틱톡",
};

const ad_notice: Record<SnsKind, string> = {
  naver_blog: "본 게시물은 캐치랭크를 통해 방문 혜택을 제공받아 작성한 후기입니다.",
  instagram: "#광고 캐치랭크를 통해 방문 혜택을 제공받았습니다.",
  youtube: "캐치랭크 방문 혜택 제공",
  tiktok: "#광고 #협찬 — 캐치랭크 방문 혜택 제공",
};

export default function ReviewForm({ passId, channels }: { passId: string; channels: SnsKind[] }) {
  const router = useRouter();
  const [reviewChannel, setReviewChannel] = useState<SnsKind | "">(channels[0] || "");
  const [reviewUrl, setReviewUrl] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [adChecked, setAdChecked] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true); setErr(null);
    const res = await fetch("/api/passes/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passId, reviewChannel, reviewUrl, reviewBody }),
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
      {/* 1. 채널 선택 */}
      <div>
        <h3 className="text-[12px] tracking-[0.18em] text-muted uppercase mb-3">1 · 작성 채널</h3>
        <div className="flex gap-2 flex-wrap">
          {channels.map((ch) => (
            <button
              key={ch}
              onClick={() => setReviewChannel(ch)}
              className={`h-9 px-4 rounded-pill text-[14px] border ${reviewChannel === ch ? "bg-ink text-white border-ink" : "bg-canvas text-ink border-hairline"}`}
            >
              {ch_label[ch]}
            </button>
          ))}
        </div>
      </div>

      {/* 2. 광고 표시 문구 */}
      <div>
        <h3 className="text-[12px] tracking-[0.18em] text-muted uppercase mb-3">2 · 광고 표시 문구 (필수)</h3>
        <div className="rounded-lg border border-hairline bg-parchment p-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={adChecked}
              onChange={(e) => setAdChecked(e.target.checked)}
              className="mt-1.5 w-4 h-4 accent-brand"
            />
            <div className="flex-1">
              <div className="text-[15px] font-semibold text-ink mb-2">아래 문구를 게시물에 포함했습니다</div>
              <div className="p-3 bg-canvas rounded-sm text-[14px] text-ink leading-[1.5]">
                {reviewChannel ? ad_notice[reviewChannel as SnsKind] : "채널을 먼저 선택해주세요"}
              </div>
            </div>
          </label>
          <div className="text-[12px] text-muted mt-3 pt-3 border-t border-hairline">
            공정거래위원회 추천·보증 광고 안내에 따라 경제적 이해관계는 명확히 표시되어야 합니다.
          </div>
        </div>
      </div>

      {/* 3. URL */}
      <div>
        <h3 className="text-[12px] tracking-[0.18em] text-muted uppercase mb-3">3 · 리뷰 URL</h3>
        <input
          value={reviewUrl}
          onChange={(e) => setReviewUrl(e.target.value)}
          placeholder="https://blog.naver.com/..."
          className="w-full h-12 px-4 rounded-pill border border-hairline focus:border-brand focus:outline-none text-[17px]"
        />
      </div>

      {/* 4. 본문 */}
      <div>
        <h3 className="text-[12px] tracking-[0.18em] text-muted uppercase mb-3">4 · 리뷰 본문 (요약)</h3>
        <textarea
          value={reviewBody}
          onChange={(e) => setReviewBody(e.target.value)}
          placeholder="실제 리뷰의 50자 이상 본문을 발췌해 붙여넣어주세요"
          rows={5}
          className="w-full px-4 py-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px] leading-[1.47]"
        />
        <div className="text-[12px] text-muted mt-1.5">{reviewBody.length}자</div>
      </div>

      {err && <div className="text-error text-[14px]">{err}</div>}
      <button
        onClick={submit}
        disabled={loading || !reviewChannel || !reviewUrl || !adChecked || reviewBody.length < 50}
        className="w-full h-12 rounded-pill bg-brand text-white text-[17px] disabled:opacity-40"
      >
        {loading ? "등록 중..." : "제출하고 인증 받기"}
      </button>
    </div>
  );
}
