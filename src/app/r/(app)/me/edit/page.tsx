import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import Icon from "@/components/Icon";
import ProfileAvatar from "../ProfileAvatar";
import EditForm from "./EditForm";

export const dynamic = "force-dynamic";

// 회원 정보 수정 (2026-08-18 — 마이 [수정] 진입) — 프로필 사진·닉네임(중복확인)·
// 휴대폰 번호(새 번호 재인증)·비밀번호 변경(2회 기입, 간편로그인 계정 제외).
// 저장은 필드별 독립 — PATCH /api/reviewer/account.
export default async function EditAccountPage() {
  const me = await getCurrentReviewer();
  return (
    <div className="pb-16 bg-canvas min-h-[100dvh]">
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 grid grid-cols-[40px_1fr_40px] items-center">
          <Link href="/r/me" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="마이로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[16px] font-bold text-ink tracking-title text-center">회원 정보 수정</h1>
          <span />
        </div>
      </div>

      {/* 프로필 사진 — 탭하여 변경 (기존 업로드 컴포넌트·API 재사용) */}
      <div className="pt-5 flex flex-col items-center">
        <ProfileAvatar image={me.profileImage} initial={me.nickname.slice(0, 1)} />
        <p className="mt-2 text-[12px] text-muted">사진을 탭해서 변경할 수 있어요</p>
      </div>

      <EditForm nickname={me.nickname} phone={me.phone ?? ""} isSocial={!!me.social} />
    </div>
  );
}
