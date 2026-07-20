"use client";
import { useEffect, useRef, useState } from "react";

/**
 * QR 스캐너 (2026-07-17 정비) — 카메라 수명주기 오류 케이스 해소:
 *  - 마운트 1회만 시작(deps []) — 부모 리렌더로 인한 카메라 재시작·"scanner is not running" 방지.
 *    (onScan/onCancel은 ref로 최신 참조 유지 — 인라인 콜백이어도 안전)
 *  - 언마운트(뒤로가기·화면 전환): stop()이 "완료된 뒤" clear() —
 *    스캔 중 clear 호출 예외("Cannot clear while scan is ongoing") 방지
 *  - start()가 언마운트 이후에 늦게 성공하는 경합: 즉시 stop (카메라 LED 잔류 방지)
 *  - 같은 QR 다중 디코드(fps 10) 중복 콜백 가드 — onScan은 1회만
 */
export default function Html5QrScanner({ onScan, onCancel }: { onScan: (text: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const scannerRef = useRef<any>(null);
  const cbRef = useRef({ onScan, onCancel });
  cbRef.current = { onScan, onCancel };
  const firedRef = useRef(false);
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
            if (!mounted || firedRef.current) return;
            firedRef.current = true; // 다중 디코드 가드 — 정지는 언마운트 클린업이 단일 책임
            cbRef.current.onScan(decodedText);
          },
          () => {},
        );
        // 언마운트 후 늦게 시작된 경우 — 즉시 정지 (카메라 스트림 잔류 방지)
        if (!mounted) {
          await scanner.stop().catch(() => {});
          try { scanner.clear?.(); } catch {}
        }
      } catch (e) {
        console.warn("camera start failed", e);
        if (mounted) setCamError(true);
      }
    })();
    return () => {
      mounted = false;
      const s = scannerRef.current;
      if (!s) return;
      // stop 완료 후에만 clear — 미시작 상태의 stop reject는 무시
      Promise.resolve()
        .then(() => s.stop?.())
        .catch(() => {})
        .then(() => {
          try { s.clear?.(); } catch {}
        });
    };
  }, []);

  return (
    <div className="bg-black">
      <div ref={ref} className="w-full" />
      {camError && (
        <div className="bg-canvas px-4 py-5 text-center">
          <p className="text-[14px] font-semibold text-ink">카메라를 사용할 수 없어요</p>
          <p className="mt-1 text-[12px] text-muted leading-[1.5]">
            브라우저의 카메라 권한을 확인해주세요. 카메라가 어려우면 체험자 화면의 &apos;코드 입력&apos; 탭에서
            매장 확인 번호 4자리로 사용 처리할 수 있어요.
          </p>
          <button onClick={() => cbRef.current.onCancel()} className="mt-3 h-11 px-5 rounded-md bg-brand text-white text-[14px] font-bold">
            닫기
          </button>
        </div>
      )}
      {/* 카메라 뷰포트만 검정 — 컨트롤은 화이트 세컨더리 버튼 */}
      {!camError && (
        <button onClick={() => cbRef.current.onCancel()} className="w-full h-11 bg-canvas text-ink text-[14px] font-semibold border-t border-hairline">
          스캔 중지
        </button>
      )}
    </div>
  );
}
