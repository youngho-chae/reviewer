"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SnsKind } from "@/lib/types";
import { KEEP_DAYS, selfCheckConditions, receiptSelfCheckConditions } from "@/lib/channels";
import Icon from "@/components/Icon";

// 리뷰 제출 폼 (2026-07-17 시안 개편) — 리뷰 URL + '제출 전 마지막 확인' 단일 카드.
//  - 채널 표기는 페이지의 파스텔 채널 배너로 이동 (참여 시 확정 — 재선택 없음)
//  - 자가 점검(광고 문구 포함·채널별 조건)과 90일 유지 동의를 한 카드의 행으로 통합,
//    체크박스는 우측 라운드 사각형. keepAgreed는 여전히 별도 필드로 서버 필수 검증.
//  - 제출 CTA는 하단 고정 바(검수 안내 캡션 포함).
//  - 영수증 리뷰 (2026-08-07): URL 대신 작성한 영수증 리뷰 화면 캡처 업로드 (서버 필수 검증).
export default function ReviewForm({
  passId,
  channel,
  storeId,
  resubmit = false,
  receipt = false,
}: {
  passId: string;
  channel: SnsKind;
  storeId?: string;
  resubmit?: boolean; // 반려 후 재제출 — CTA 라벨만 분기
  receipt?: boolean; // 영수증 리뷰 참여 — URL 대신 캡처 업로드
}) {
  const router = useRouter();
  const conditions = receipt ? receiptSelfCheckConditions() : selfCheckConditions(channel);
  const fileRef = useRef<HTMLInputElement>(null);
  const [reviewUrl, setReviewUrl] = useState("");
  const [reviewImage, setReviewImage] = useState<string | null>(null);
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
  const evidenceReady = receipt ? !!reviewImage : !!reviewUrl && urlValid;
  const canSubmit = evidenceReady && adChecked && allSelfChecked && keepAgreed && !loading;

  // 캡처 업로드 — 클라이언트에서 최대 폭 720px JPEG로 축소해 dataURL 생성 (서버 상한 512KB)
  async function onPickImage(file: File | undefined) {
    if (!file) return;
    setErr(null);
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 720 / bmp.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      if (dataUrl.length > 700_000) {
        setErr("이미지 용량이 너무 커요. 화면을 다시 캡처해 업로드해주세요.");
        return;
      }
      setReviewImage(dataUrl);
    } catch {
      setErr("이미지를 불러오지 못했어요. 다른 파일로 시도해주세요.");
    }
  }

  async function submit() {
    setLoading(true);
    setErr(null);
    const res = await fetch("/api/passes/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        receipt
          ? { passId, reviewImage, selfCheck, adNotice: adChecked, keepAgreed }
          : { passId, reviewChannel: channel, reviewUrl, selfCheck, adNotice: adChecked, keepAgreed },
      ),
    });
    if (!res.ok) {
      const { error } = await res.json();
      setErr(error || "등록 실패");
      setLoading(false);
      return;
    }
    router.refresh();
  }

  // '제출 전 마지막 확인' 행 — 광고 문구 → 채널별 자가점검 → 90일 유지 동의 순
  const checkRows: { key: string; label: string; hint: string; checked: boolean; toggle: (v: boolean) => void }[] = [
    {
      key: "__ad_notice",
      label: "광고 표시 문구 표시",
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
    {
      key: "__keep_agreed",
      label: `등록일로부터 ${KEEP_DAYS}일 이상 유지 동의`,
      hint: "유지 기간 내 삭제·비공개 전환 시 등급 점수가 차감될 수 있어요",
      checked: keepAgreed,
      toggle: setKeepAgreed,
    },
  ];

  return (
    <>
      <div className="px-5 mt-8 space-y-8">
        {receipt ? (
          /* 영수증 리뷰 — 작성한 리뷰 화면 캡처 업로드 (검수 근거) */
          <div>
            <h3 className="text-[18px] font-bold text-ink tracking-title mb-3">영수증 리뷰 캡처</h3>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => onPickImage(e.target.files?.[0])}
            />
            {reviewImage ? (
              <div className="rounded-md border border-hairline overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={reviewImage} alt="영수증 리뷰 캡처 미리보기" className="w-full max-h-[320px] object-contain bg-sunken" />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="cp-action w-full h-11 border-t border-hairlineSoft text-[13px] font-semibold text-brand"
                >
                  다른 이미지로 변경
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="cp-action w-full rounded-md border border-dashed border-borderStrong bg-canvas py-8 text-center"
              >
                <span className="block text-[24px]" aria-hidden>🧾</span>
                <span className="mt-1.5 block text-[14px] font-semibold text-ink">작성한 영수증 리뷰 화면 업로드</span>
                <span className="mt-0.5 block text-[12px] text-muted">리뷰 내용이 보이게 캡처해주세요</span>
              </button>
            )}
          </div>
        ) : (
          /* 리뷰 URL */
          <div>
            <h3 className="text-[18px] font-bold text-ink tracking-title mb-3">리뷰 URL</h3>
            <input
              value={reviewUrl}
              onChange={(e) => setReviewUrl(e.target.value)}
              placeholder="복사한 url을 붙여넣어주세요"
              className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px] placeholder:text-mutedSoft"
            />
            {reviewUrl.trim() !== "" && !urlValid && (
              <p className="mt-1.5 text-[12px] text-error">http:// 또는 https:// 로 시작하는 게시물 주소를 입력해주세요.</p>
            )}
          </div>
        )}

        {/* 제출 전 마지막 확인 — 자가점검 + 90일 유지 동의 통합 카드 (체크박스 우측) */}
        <div>
          <h3 className="text-[18px] font-bold text-ink tracking-title mb-3">제출 전 마지막 확인</h3>
          <div className="rounded-lg border border-hairline overflow-hidden">
            {checkRows.map((item, i) => (
              <label
                key={item.key}
                className={`flex items-center gap-3 px-4 py-4 cursor-pointer ${i < checkRows.length - 1 ? "border-b border-hairlineSoft" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-semibold text-ink">{item.label}</div>
                  <div className="text-[12px] text-muted mt-0.5 leading-[1.5]">{item.hint}</div>
                </div>
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={(e) => item.toggle(e.target.checked)}
                  className="sr-only"
                />
                <span
                  className={`w-6 h-6 rounded-[8px] flex items-center justify-center flex-shrink-0 ${
                    item.checked ? "bg-brand text-white" : "border-[1.5px] border-borderStrong bg-canvas"
                  }`}
                  aria-hidden="true"
                >
                  {item.checked && <Icon name="check" variant="bold" size={14} />}
                </span>
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
      </div>

      {/* 하단 고정 제출 바 — [리뷰 제출하기] + 검수 안내 */}
      <div className="fixed bottom-[var(--bottom-nav-h,72px)] left-0 right-0 mx-auto max-w-[480px] bg-canvas border-t border-hairlineSoft z-20">
        <div className="px-5 pt-3 pb-4">
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="cp-action w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
          >
            {loading ? "제출 중..." : resubmit ? "리뷰 다시 제출하기" : "리뷰 제출하기"}
          </button>
          <p className="mt-2 text-center text-[12px] text-muted">영업일 기준 최대 3일 이내로 검수 완료되어요</p>
        </div>
      </div>
    </>
  );
}
