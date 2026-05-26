"use client";
import { useEffect, useRef } from "react";

export default function Html5QrScanner({ onScan, onCancel }: { onScan: (text: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const scannerRef = useRef<any>(null);

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
      <button onClick={onCancel} className="w-full h-11 bg-black text-white text-[14px]">취소</button>
    </div>
  );
}
