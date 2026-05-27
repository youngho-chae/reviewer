"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SnsKind } from "@/lib/types";

const ch_label: Record<SnsKind, string> = {
  naver_blog: "네이버 블로그",
  instagram: "인스타그램",
  youtube: "유튜브",
  tiktok: "틱톡",
};

export default function PressWriteForm({
  passId,
  channels,
  minChars,
  keywords,
}: {
  passId: string;
  channels: SnsKind[];
  minChars: number;
  keywords: string[];
}) {
  const router = useRouter();
  const [reviewChannel, setReviewChannel] = useState<SnsKind | "">("");
  const [reviewUrl, setReviewUrl] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [adChecked, setAdChecked] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const missingKeywords = useMemo(
    () => keywords.filter((k) => !reviewBody.includes(k)),
    [reviewBody, keywords]
  );
  const isLong = reviewBody.length >= minChars;
  const canSubmit = !!reviewChannel && !!reviewUrl && isLong && missingKeywords.length === 0 && adChecked && !loading;

  async function submit() {
    setLoading(true); setErr(null);
    const res = await fetch("/api/passes/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passId, reviewChannel, reviewUrl, reviewBody }),
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
    <div className="space-y-3">
      <div>
        <div className="text-[13px] font-medium mb-2">작성 채널</div>
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
        placeholder="게시한 콘텐츠 URL"
        className="w-full h-12 px-3 rounded-sm border border-hairline focus:border-ink focus:outline-none text-[14px]"
      />
      <textarea
        value={reviewBody}
        onChange={(e) => setReviewBody(e.target.value)}
        placeholder={`본문 (최소 ${minChars.toLocaleString()}자)`}
        rows={10}
        className="w-full px-3 py-3 rounded-sm border border-hairline focus:border-ink focus:outline-none text-[14px]"
      />
      <div className="flex items-center justify-between text-[12px] text-muted">
        <span className={isLong ? "text-success" : ""}>{reviewBody.length.toLocaleString()} / {minChars.toLocaleString()}자</span>
        <span>{missingKeywords.length === 0 ? "✓ 키워드 모두 포함" : `누락: ${missingKeywords.join(", ")}`}</span>
      </div>

      <label className="flex items-start gap-2 cursor-pointer">
        <input type="checkbox" checked={adChecked} onChange={(e) => setAdChecked(e.target.checked)} className="mt-1" />
        <span className="text-[13px] text-body">광고 표시 문구를 본문에 정확히 포함했습니다</span>
      </label>

      {err && <div className="text-error text-[13px]">{err}</div>}
      <button onClick={submit} disabled={!canSubmit} className="w-full h-12 rounded-sm bg-ink text-white text-[15px] font-medium disabled:opacity-40">
        {loading ? "제출 중..." : "기자단 제출"}
      </button>
    </div>
  );
}
