"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";

// 프로필 아바타 (2026-08-05) — 사진 업로드로 프로필 꾸미기.
// 사진이 없으면 기존처럼 닉네임 첫 글자, 탭하면 파일 선택 → 240px JPEG 리사이즈 → 저장.
export default function ProfileAvatar({ image, initial }: { image?: string; initial: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function resize(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        // 정사각 중앙 크롭 + 240px — 아바타 전용 (캠페인 사진 640px 리사이즈와 동일 canvas 방식)
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = 240;
        canvas.height = 240;
        canvas
          .getContext("2d")!
          .drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 240, 240);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("이미지를 읽을 수 없어요"));
      };
      img.src = url;
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const dataUrl = await resize(file);
      const res = await fetch("/api/reviewer/profile-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || "저장에 실패했어요");
      }
      router.refresh();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "저장에 실패했어요");
    }
    setBusy(false);
  }

  return (
    <div className="shrink-0">
      <label className={`relative block w-16 h-16 cursor-pointer ${busy ? "opacity-60" : ""}`} aria-label="프로필 사진 변경">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="프로필 사진" className="w-16 h-16 rounded-full object-cover border border-hairline" />
        ) : (
          <span className="w-16 h-16 rounded-full bg-sunken border border-hairline grid place-items-center">
            <span className="text-[20px] font-bold text-ink leading-none">{initial}</span>
          </span>
        )}
        {/* 카메라 배지 — 사진 추가/변경 어포던스 */}
        <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-brand text-white grid place-items-center border-2 border-canvas">
          <Icon name="camera" variant="border" size={12} />
        </span>
        <input type="file" accept="image/*" className="sr-only" onChange={onFile} disabled={busy} />
      </label>
      {err && <p className="mt-1 text-[11px] text-error">{err}</p>}
    </div>
  );
}
