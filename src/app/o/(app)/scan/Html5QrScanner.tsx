"use client";
import { useEffect, useRef, useState } from "react";

export default function Html5QrScanner({ onScan, onCancel }: { onScan: (text: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const scannerRef = useRef<any>(null);
  const [camError, setCamError] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!ref.current || !mounted) return;
      const el = ref.current;
      el.id = "qr-reader-" + Math.random().toString(36).slice(2);
      const scanner = new Html5Qrcode(el.id);
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 240 },
          (decodedText) => {
            if (!mounted) return;
            onScan(decodedText);
            scanner.stop().catch(() => {});
          },
          () => {}
        );
      } catch (e) {
        console.warn("camera start failed", e);
        if (mounted) setCamError(true);
      }
    })();
    return () => {
      mounted = false;
      const s = scannerRef.current;
      if (s) {
        s.stop?.().catch(() => {});
        s.clear?.();
      }
    };
  }, [onScan]);

  return (
    <div className="bg-black">
      <div ref={ref} className="w-full" />
      {camError && (
        <div className="bg-canvas px-4 py-5 text-center">
          <p className="text-[14px] font-semibold text-ink">카메라를 사용할 수 없어요</p>
          <p className="mt-1 text-[12px] text-muted leading-[1.5]">
            브라우저의 카메라 권한을 확인하거나, 아래 매장 확인 번호 입력으로 진행해주세요.
          </p>
          <button onClick={onCancel} className="mt-3 h-11 px-5 rounded-md bg-brand text-white text-[14px] font-bold">
            코드로 입력하기
          </button>
        </div>
      )}
      {/* 카메라 뷰포트만 검정 — 컨트롤은 화이트 세컨더리 버튼 */}
      <button onClick={onCancel} className="w-full h-11 bg-canvas text-ink text-[14px] font-semibold border-t border-hairline">취소</button>
    </div>
  );
}
