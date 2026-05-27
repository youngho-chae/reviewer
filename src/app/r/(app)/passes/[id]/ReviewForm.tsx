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
    <div className="mt-4 space-y-5">
      {/* 1. 채널 선택 */}
      <div>
        <h3 className="text-[14px] font-bold text-muted mb-2.5">1 · 작성한 채널 선택</h3>
        <div className="flex gap-2">
          {channels.map((ch) => (
            <button
              key={ch}
              onClick={() => setReviewChannel(ch)}
              className={`flex-1 py-3.5 rounded-md border-[1.5px] text-[12px] font-semibold ${reviewChannel === ch ? "bg-ink text-white border-ink" : "border-hairline text-ink"}`}
            >
              {ch_label[ch]}
            </button>
          ))}
        </div>
      </div>

      {/* 2. 광고 표시 문구 */}
      <div>
        <h3 className="text-[14px] font-bold text-muted mb-2.5">2 · 광고 표시 문구 (필수)</h3>
        <div className="p-4 rounded-md bg-brand/20 border border-brand">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={adChecked}
              onChange={(e) => setAdChecked(e.target.checked)}
              className="mt-1 accent-ink"
            />
            <div className="flex-1">
              <div className="text-[13px] font-bold text-ink mb-1.5">아래 문구를 게시물에 포함했습니다</div>
              <div className="p-3 bg-white rounded text-[13px] leading-relaxed">
                {reviewChannel ? ad_notice[reviewChannel as SnsKind] : "채널을 먼저 선택해주세요"}
              </div>
            </div>
          </label>
          <div className="text-[11px] text-ink2 mt-2.5 pt-2.5 border-t border-dashed border-brand/60">
            공정거래위원회 추천·보증 광고 안내에 따라 경제적 이해관계는 명확히 표시되어야 합니다.
          </div>
        </div>
      </div>

      {/* 3. URL */}
      <div>
        <h3 className="text-[14px] font-bold text-muted mb-2.5">3 · 리뷰 URL 제출</h3>
        <input
          value={reviewUrl}
          onChange={(e) => setReviewUrl(e.target.value)}
          placeholder="https://blog.naver.com/..."
          className={`w-full h-13 px-4 rounded-md border-[1.5px] text-[15px] outline-none ${reviewUrl ? "border-ink" : "border-hairline focus:border-ink"}`}
        />
      </div>

      {/* 4. 본문 */}
      <div>
        <h3 className="text-[14px] font-bold text-muted mb-2.5">4 · 리뷰 본문 (요약)</h3>
        <textarea
          value={reviewBody}
          onChange={(e) => setReviewBody(e.target.value)}
          placeholder="실제 리뷰의 50자 이상 본문을 발췌해 붙여넣어주세요"
          rows={5}
          className="w-full px-4 py-3.5 rounded-md border border-hairline focus:border-ink focus:outline-none text-[14px]"
        />
        <div className="text-[11px] text-muted mt-1.5">{reviewBody.length}자</div>
      </div>

      {err && <div className="text-error text-[13px]">{err}</div>}
      <button
        onClick={submit}
        disabled={loading || !reviewChannel || !reviewUrl || !adChecked || reviewBody.length < 50}
        className="w-full h-14 rounded-full bg-ink text-white text-[15px] font-bold disabled:opacity-40"
      >
        {loading ? "등록 중..." : "제출하고 인증 받기"}
      </button>
    </div>
  );
}
