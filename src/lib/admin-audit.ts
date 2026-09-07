import type { DBShape } from "./types";
import { rid } from "./ids";

// 어드민 감사 로그 (2026-09-07 감사 개편) — 전 운영 처분(검수·출금·취소·정정·공지·DB 복원)을
// 행위자(adminId)에 귀속시키는 append-only 이력. 감사 결과 어드민 계정이 사실상 공용 1개인데
// 어떤 처분도 행위자 기록이 없어 귀속 불가였다. 호출자는 처분 성공 직후·saveDBAsync 이전에
// 호출한다 (같은 저장에 실리도록).
export function logAdminAction(
  db: DBShape,
  session: { userId: string },
  action: string,
  targetType: string,
  targetId: string,
  detail?: string,
): void {
  const admin = (db.admins ?? []).find((a) => a.id === session.userId);
  if (!db.adminActions) db.adminActions = [];
  db.adminActions.push({
    id: rid("aa"),
    at: Date.now(),
    adminId: session.userId,
    adminEmail: admin?.email ?? "(미상)",
    action,
    targetType,
    targetId,
    ...(detail ? { detail: String(detail).slice(0, 300) } : {}),
  });
}
