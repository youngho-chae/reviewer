"use client";
import { useEffect, useState } from "react";

// 웹푸시 켜기 토글 (2026-08-13) — 체험자/사장님 알림함 상단 배너.
// 상태: unsupported(브라우저 미지원) / unconfigured(VAPID 키 미설정 — 안내만) /
//       denied(권한 거부 — 브라우저 설정 안내) / on / off.
// 켜기 = sw 등록 → 권한 요청 → pushManager.subscribe(VAPID) → POST /api/push/subscribe.
// 끄기 = 브라우저 구독 해지 + DELETE (서버 구독 제거).
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "loading" | "unsupported" | "unconfigured" | "denied" | "on" | "off";

export default function PushOptIn() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState("unsupported");
        return;
      }
      try {
        const conf = await fetch("/api/push/subscribe").then((r) => r.json());
        if (!conf.configured) {
          setState("unconfigured");
          return;
        }
        if (Notification.permission === "denied") {
          setState("denied");
          return;
        }
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("unsupported");
      }
    })();
  }, []);

  async function enable() {
    setBusy(true);
    setErr(null);
    try {
      const { publicKey } = await fetch("/api/push/subscribe").then((r) => r.json());
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error();
      setState("on");
    } catch {
      setErr("푸시 알림을 켜지 못했어요. 잠시 후 다시 시도해주세요.");
    }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    setErr(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setErr("해제에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
    setBusy(false);
  }

  if (state === "loading" || state === "unsupported" || state === "unconfigured") return null;

  if (state === "denied") {
    return (
      <div className="rounded-md bg-sunken px-4 py-3 text-[12px] text-muted leading-[1.5]">
        푸시 알림이 브라우저에서 차단되어 있어요 — 브라우저 설정에서 이 사이트의 알림을 허용하면 켤 수 있어요.
      </div>
    );
  }

  return (
    <div className="rounded-md bg-brandSoft px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-ink">푸시 알림 {state === "on" ? "켜짐" : ""}</div>
        <p className="mt-0.5 text-[12px] text-ink2 leading-[1.45]">
          {state === "on" ? "새 알림을 이 기기로 바로 받아요." : "새 알림을 기기 알림으로 바로 받아보세요."}
        </p>
        {err && <p className="mt-1 text-[12px] text-error">{err}</p>}
      </div>
      <button
        type="button"
        onClick={state === "on" ? disable : enable}
        disabled={busy}
        className={`cp-action shrink-0 h-9 px-3.5 rounded-md text-[13px] font-bold disabled:opacity-60 ${
          state === "on" ? "border border-hairline bg-canvas text-ink" : "bg-brand text-white"
        }`}
      >
        {busy ? "처리 중..." : state === "on" ? "끄기" : "켜기"}
      </button>
    </div>
  );
}
