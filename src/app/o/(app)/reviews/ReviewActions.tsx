"use client";
import { useState } from "react";

// 사장님은 리뷰를 직접 검수/판정하지 않는다.
// 재작성·수정·문제 발견 시 채널톡으로 운영팀에 문의 → 운영팀이 체험자와 소통.
export default function ReviewActions({
  passId,
  storeName,
  reviewUrl,
}: {
  passId: string;
  storeName?: string;
  reviewUrl?: string;
}) {
  const [opened, setOpened] = useState(false);

  function openChanneltalk() {
    // 채널톡 위젯이 로드되어 있으면 호출, 아니면 모달로 안내
    const w = window as unknown as { ChannelIO?: (...args: unknown[]) => void };
    const payload = {
      message: `[리뷰 문의]\n매장: ${storeName ?? "-"}\n패스 ID: ${passId}\nURL: ${reviewUrl ?? "-"}\n\n문의 내용: `,
    };
    if (typeof w.ChannelIO === "function") {
      try {
        w.ChannelIO("openChat", undefined, payload.message);
        return;
      } catch {
        // fallthrough to fallback
      }
    }
    setOpened(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={openChanneltalk}
        className="cp-action mt-3 w-full h-11 rounded-pill border border-hairline bg-canvas text-[14px] font-semibold text-ink"
      >
        💬 채널톡으로 문의하기
      </button>
      {opened && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 flex items-end justify-center"
          onClick={() => setOpened(false)}
        >
          <div
            className="w-full max-w-[480px] bg-canvas rounded-t-lg p-6 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-hairline mx-auto mb-5" />
            <h3 className="text-[18px] font-semibold text-ink">운영팀에 문의 접수</h3>
            <p className="mt-2 text-[14px] text-ink2 leading-[1.5]">
              아래 정보로 채널톡에 문의를 남겨주시면 운영팀이 24시간 내 회신합니다. 사장님은 체험자와 직접 소통하지 않으셔도 됩니다.
            </p>
            <div className="mt-4 rounded-md bg-parchment p-4 text-[13px] text-ink leading-[1.6] space-y-1">
              <div><span className="text-muted mr-2">매장</span>{storeName ?? "-"}</div>
              <div><span className="text-muted mr-2">패스 ID</span>{passId}</div>
              <div className="truncate"><span className="text-muted mr-2">URL</span>{reviewUrl ?? "-"}</div>
            </div>
            <a
              href={`mailto:help@catchrank.co.kr?subject=${encodeURIComponent("[리뷰 문의] " + (storeName ?? passId))}&body=${encodeURIComponent(`매장: ${storeName ?? "-"}\n패스 ID: ${passId}\nURL: ${reviewUrl ?? "-"}\n\n문의 내용:\n`)}`}
              className="cp-action mt-5 block h-12 rounded-pill bg-brand text-white grid place-items-center text-[15px] font-semibold"
            >
              이메일로 보내기
            </a>
            <button
              onClick={() => setOpened(false)}
              className="cp-action mt-2 w-full h-11 text-[14px] text-muted"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
