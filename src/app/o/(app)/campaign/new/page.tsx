"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewCampaign() {
  const router = useRouter();
  const [stores, setStores] = useState<any[]>([]);
  const [storeId, setStoreId] = useState("");
  const [title, setTitle] = useState("");
  const [days, setDays] = useState(30);
  const [supportAmount, setSupportAmount] = useState("50000");
  const [qS, setQS] = useState("0");
  const [qA, setQA] = useState("5");
  const [qB, setQB] = useState("10");
  const [qC, setQC] = useState("20");
  const [requiredMenus, setRequiredMenus] = useState("");
  const [channels, setChannels] = useState<string[]>(["naver_blog", "instagram"]);
  const [description, setDescription] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/owner/me").then((r) => r.json()).then((d) => {
      setStores(d.stores || []);
      if (d.stores?.[0]) setStoreId(d.stores[0].id);
    });
  }, []);

  function toggleChannel(c: string) {
    setChannels((cs) => cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storeId,
        title,
        days: Number(days),
        supportAmount: Number(supportAmount),
        quota: { S: Number(qS), A: Number(qA), B: Number(qB), C: Number(qC) },
        requiredMenus: requiredMenus.split(",").map((s) => s.trim()).filter(Boolean),
        requiredChannels: channels,
        description,
      }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      setErr(error || "생성 실패");
      setBusy(false);
      return;
    }
    router.push("/o/home");
    router.refresh();
  }

  return (
    <div className="mobile-shell px-5 pt-12 pb-24">
      <Link href="/o/home" className="text-muted text-[14px]">← 홈으로</Link>
      <h1 className="mt-4 text-[22px] font-bold">새 캠페인</h1>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <div className="text-[13px] font-medium mb-2">매장</div>
          <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="w-full h-12 px-3 rounded-sm border border-hairline focus:border-ink text-[14px]">
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <div className="text-[13px] font-medium mb-2">캠페인 제목</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 가을 시즌 디너" className="w-full h-12 px-3 rounded-sm border border-hairline focus:border-ink text-[14px]" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[13px] font-medium mb-2">진행 일수</div>
            <input value={days} onChange={(e) => setDays(Number(e.target.value))} type="number" min={1} max={90} className="w-full h-12 px-3 rounded-sm border border-hairline focus:border-ink text-[14px]" />
          </div>
          <div>
            <div className="text-[13px] font-medium mb-2">지원금 (원)</div>
            <input value={supportAmount} onChange={(e) => setSupportAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="w-full h-12 px-3 rounded-sm border border-hairline focus:border-ink text-[14px]" />
          </div>
        </div>
        <div>
          <div className="text-[13px] font-medium mb-2">등급별 모집 인원</div>
          <div className="grid grid-cols-4 gap-2">
            {([["S", qS, setQS], ["A", qA, setQA], ["B", qB, setQB], ["C", qC, setQC]] as const).map(([label, val, set]) => (
              <div key={label}>
                <div className="text-[11px] text-muted text-center">{label}</div>
                <input value={val} onChange={(e) => (set as any)(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="w-full h-11 px-2 mt-1 rounded-sm border border-hairline focus:border-ink text-[14px] text-center" />
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[13px] font-medium mb-2">필수 채널</div>
          <div className="flex flex-wrap gap-2">
            {["naver_blog", "instagram", "youtube", "tiktok"].map((c) => (
              <button key={c} type="button" onClick={() => toggleChannel(c)} className={`px-3 py-2 rounded-full text-[12px] border ${channels.includes(c) ? "bg-ink text-white border-ink" : "border-hairline"}`}>
                {({naver_blog:"네이버 블로그", instagram:"인스타", youtube:"유튜브", tiktok:"틱톡"} as Record<string,string>)[c]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[13px] font-medium mb-2">필수 주문 메뉴 (쉼표 구분)</div>
          <input value={requiredMenus} onChange={(e) => setRequiredMenus(e.target.value)} placeholder="코스 디너, 와인 페어링" className="w-full h-12 px-3 rounded-sm border border-hairline focus:border-ink text-[14px]" />
        </div>
        <div>
          <div className="text-[13px] font-medium mb-2">캠페인 설명</div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full px-3 py-3 rounded-sm border border-hairline focus:border-ink text-[14px]" />
        </div>
        {err && <div className="text-error text-[14px]">{err}</div>}
        <button disabled={busy} type="submit" className="w-full h-14 rounded-sm bg-ink text-white text-[16px] font-medium disabled:opacity-50">{busy ? "생성 중..." : "캠페인 생성"}</button>
      </form>
    </div>
  );
}
