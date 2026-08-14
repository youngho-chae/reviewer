// 웹푸시 발송 코어 (2026-08-13 — 실제 모바일 웹푸시).
//
// 구조:
//  - 구독: 브라우저 PushSubscription을 /api/push/subscribe가 db.pushSubs에 계정 귀속 저장
//    (endpoint = 기기·브라우저 단위 고유 키 — 한 계정 여러 기기 허용)
//  - 발송: sendWebPushTo()가 web-push(VAPID)로 각 구독에 암호화 페이로드 전송.
//    404/410(만료·해지) 응답은 구독을 자동 정리한다. 발송 실패는 인앱 알림함에 영향 없음.
//  - 수신: public/sw.js(서비스 워커)가 push 이벤트를 OS 알림으로 표시, 클릭 시 링크로 이동.
//
// 키: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (.env — `npx web-push generate-vapid-keys`).
// 미설정 시 isPushConfigured() = false — 구독 UI는 안내만, 발송은 조용히 스킵(인앱 알림 유지).
import webpush from "web-push";
import type { DBShape, PushSub } from "./types";

export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:help@catchrank.co.kr";

export function isPushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

let configured = false;
function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  link?: string; // 내부 경로 — 알림 클릭 시 이동 (sw.js notificationclick)
}

// 대상 계정들의 모든 구독으로 발송. 만료 구독(404/410)은 db에서 제거.
// 반환: 발송 성공 구독 수 / 정리된 만료 구독 수. (호출부가 saveDBAsync 책임)
export async function sendWebPushTo(
  db: DBShape,
  role: "reviewer" | "owner",
  userIds: string[],
  payload: PushPayload,
): Promise<{ sent: number; cleaned: number }> {
  if (!isPushConfigured()) return { sent: 0, cleaned: 0 };
  ensureConfigured();
  const targets = new Set(userIds);
  const subs = (db.pushSubs ?? []).filter((s) => s.role === role && targets.has(s.userId));
  if (subs.length === 0) return { sent: 0, cleaned: 0 };

  const body = JSON.stringify(payload);
  const dead = new Set<string>();
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body, { TTL: 60 * 60 * 24 });
        sent += 1;
      } catch (e: unknown) {
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) dead.add(s.id); // 만료·해지된 구독 — 정리
        // 그 외(네트워크·429 등)는 구독 유지 — 다음 발송에서 재시도
      }
    }),
  );
  if (dead.size > 0) {
    db.pushSubs = (db.pushSubs ?? []).filter((s) => !dead.has(s.id));
  }
  return { sent, cleaned: dead.size };
}

// 구독 등록/갱신 — endpoint 기준 upsert (같은 기기 재구독 시 키 갱신·계정 이관)
export function upsertPushSub(
  db: DBShape,
  sub: Omit<PushSub, "id" | "createdAt">,
  makeId: () => string,
): PushSub {
  db.pushSubs = db.pushSubs ?? [];
  const existing = db.pushSubs.find((s) => s.endpoint === sub.endpoint);
  if (existing) {
    existing.userId = sub.userId;
    existing.role = sub.role;
    existing.keys = sub.keys;
    return existing;
  }
  const row: PushSub = { id: makeId(), createdAt: Date.now(), ...sub };
  db.pushSubs.push(row);
  return row;
}
