"use client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  async function go() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <button onClick={go} className="w-full h-12 rounded-md border border-hairline bg-canvas text-brand text-[15px] font-semibold">로그아웃</button>
  );
}
