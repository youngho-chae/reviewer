"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SnsKind } from "@/lib/types";
import Icon from "@/components/Icon";

const ch_label: Record<SnsKind, string> = {
  naver_blog: "네이버 블로그",
  instagram: "인스타그램",
  youtube: "유튜브 쇼츠",
  tiktok: "틱톡",
};

const ad_notice: Record<SnsKind, string> = {
  naver_blog: "본 게시물은 캐치랭크를 통해 방문 혜택을 제공받아 작성한 후기입니다.",
  instagram: "#광고 캐치랭크를 통해 방문 혜택을 제공받았습니다.",
  youtube: "캐치랭크 방문 혜택 제공",
  tiktok: "#광고 #협찬 — 캐치랭크 방문 혜택 제공",
};

const SELF_CHECK_ITEMS: { key: "photos" | "body500" | "menus" | "days30"; label: string; hint: string }[] = [
  { key: "photos", label: "사진 5장 이상", hint: "메뉴/매장/분위기를 골고루 담았어요" },
  { key: "body500", label: "본문 500자 이상", hint: "방문 경험을 충분히 묘사했어요" },
  { key: "menus", label: "메뉴 / 매장 / 분위기 사진 포함", hint: "각 카테고리당 1장 이상" },
  { key: "days30", label: "30일 이상 게시 유지", hint: "조기 삭제 시 등급 점수가 차감될 수 있어요" },
];

export default function ReviewForm({ passId, channels }: { passId: string; channels: SnsKind[] }) {
  const router = useRouter();
  const [reviewChannel, setReviewChannel] = useState<SnsKind | "">(channels[0] || "");
  const [reviewUrl, setReviewUrl] = useState("");
  const [adChecked, setAdChecked] = useState(false);
  const [selfCheck, setSelfCheck] = useState({
    photos: false,
    body500: false,
    menus: false,
    days30: false,
  });
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const allSelfChecked = selfCheck.photos && selfCheck.body500 && selfCheck.menus && selfCheck.days30;
  const canSubmit = !!reviewChannel && !!reviewUrl && adChecked && allSelfChecked && !loading;

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
    setLoading(true); setErr(null);
    const res = await fetch("/api/passes/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passId, reviewChannel, reviewUrl, selfCheck }),
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
      {/* 1. 작성 채널 */}
      <div>
        <h3 className="text-[12px] tracking-[0.18em] text-muted uppercase mb-3">1 · 작성한 채널 선택</h3>
        <div className="flex gap-2 flex-wrap">
          {channels.map((ch) => (
            <button
              key={ch}
              onClick={() => setReviewChannel(ch)}
              className={`h-10 px-4 rounded-md border text-[14px] font-semibold ${reviewChannel === ch ? "bg-ink text-white border-ink" : "bg-canvas text-ink border-hairline"}`}
            >
              {ch_label[ch]}
            </button>
          ))}
        </div>
      </div>

      {/* 2. 광고 표시 문구 (참고 이미지의 노란 박스 + 문구 복사 버튼) */}
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

      {/* 3. 리뷰 URL */}
      <div>
        <h3 className="text-[12px] tracking-[0.18em] text-muted uppercase mb-3">3 · 리뷰 URL 제출</h3>
        <input
          value={reviewUrl}
          onChange={(e) => setReviewUrl(e.target.value)}
          placeholder="https://blog.naver.com/..."
          className="w-full h-12 px-4 rounded-pill border border-hairline focus:border-brand focus:outline-none text-[17px]"
        />
      </div>

      {/* 4. 작성 조건 자가점검 — 자동 검수 폐기, 사용자 본인 확인 */}
      <div>
        <h3 className="text-[12px] tracking-[0.18em] text-muted uppercase mb-3">4 · 작성 조건 자가점검</h3>
        <p className="text-[13px] text-muted mb-3 leading-[1.5]">
          아래 조건을 모두 충족했는지 직접 확인하고 체크해주세요. 추후 운영팀이 무작위 표본 검수합니다.
        </p>
        <div className="rounded-lg border border-hairline overflow-hidden">
          {SELF_CHECK_ITEMS.map((item, i) => {
            const checked = selfCheck[item.key];
            return (
              <label
                key={item.key}
                className={`flex items-center gap-3 px-4 py-4 cursor-pointer ${i < SELF_CHECK_ITEMS.length - 1 ? "border-b border-hairlineSoft" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setSelfCheck((s) => ({ ...s, [item.key]: e.target.checked }))}
                  className="sr-only"
                />
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border ${checked ? "bg-brand border-brand text-white" : "border-hairline text-canvas"}`}
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
        className="w-full h-12 rounded-pill bg-brand text-white text-[17px] disabled:opacity-40"
      >
        {loading ? "등록 중..." : "제출하고 인증 받기"}
      </button>
    </div>
  );
}
