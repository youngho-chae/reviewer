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

export default function ReviewForm({ passId, channels }: { passId: string; channels: SnsKind[] }) {
  const router = useRouter();
  const [reviewChannel, setReviewChannel] = useState<SnsKind | "">("");
  const [reviewUrl, setReviewUrl] = useState("");
  const [reviewBody, setReviewBody] = useState("");
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
    <div className="mt-4 space-y-3">
      <div>
        <div className="text-[13px] font-medium mb-2">리뷰 채널</div>
        <div className="flex flex-wrap gap-2">
          {channels.map((ch) => (
            <button key={ch} onClick={() => setReviewChannel(ch)} className={`px-3 py-2 rounded-full text-[13px] border ${reviewChannel === ch ? "bg-ink text-white border-ink" : "border-hairline"}`}>
              {ch_label[ch]}
            </button>
          ))}
        </div>
      </div>
      <input
        value={reviewUrl}
        onChange={(e) => setReviewUrl(e.target.value)}
        placeholder="게시한 리뷰 URL"
        className="w-full h-12 px-3 rounded-sm border border-hairline focus:border-ink focus:outline-none text-[14px]"
      />
      <textarea
        value={reviewBody}
        onChange={(e) => setReviewBody(e.target.value)}
        placeholder="리뷰 본문 (50자 이상)"
        rows={5}
        className="w-full px-3 py-3 rounded-sm border border-hairline focus:border-ink focus:outline-none text-[14px]"
      />
      <div className="flex items-center justify-between text-[12px] text-muted">
        <span>{reviewBody.length}자</span>
        <span>광고 표시 문구는 자동 삽입됩니다</span>
      </div>
      {err && <div className="text-error text-[13px]">{err}</div>}
      <button onClick={submit} disabled={loading || !reviewChannel || !reviewUrl} className="w-full h-12 rounded-sm bg-brand text-white text-[15px] font-medium disabled:opacity-50">
        {loading ? "등록 중..." : "리뷰 등록"}
      </button>
    </div>
  );
}
