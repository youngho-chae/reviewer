"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import { PLAN_POLICY, type PlanKey } from "@/lib/plan-policy";

interface OwnerStore {
  id: string;
  name: string;
  area?: string;
  category?: string;
}

interface MenuRow {
  name: string;
  price: string; // 화면 입력값 — 숫자만 허용
}

const CHANNELS: { key: "naver_blog" | "instagram" | "tiktok"; label: string }[] = [
  { key: "naver_blog", label: "네이버 블로그" },
  { key: "instagram", label: "인스타" },
  { key: "tiktok", label: "틱톡" },
];

export default function NewCampaign() {
  const router = useRouter();
  const [stores, setStores] = useState<OwnerStore[]>([]);
  const [plan, setPlan] = useState<PlanKey>("Free");
  const [storeId, setStoreId] = useState("");
  const [days, setDays] = useState(30);
  const [supportAmount, setSupportAmount] = useState("50000");
  const [totalQuota, setTotalQuota] = useState("20");
  const [useCode, setUseCode] = useState("");
  const [menus, setMenus] = useState<MenuRow[]>([{ name: "", price: "" }]);
  const [channels, setChannels] = useState<string[]>(["naver_blog", "instagram"]);
  const [keywords, setKeywords] = useState("");
  const [description, setDescription] = useState("");
  const [monthlyUsed, setMonthlyUsed] = useState(0);
  const [monthlyLimit, setMonthlyLimit] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/owner/me")
      .then((r) => r.json())
      .then((d) => {
        setStores(d.stores || []);
        if (d.stores?.[0]) setStoreId(d.stores[0].id);
        if (d.owner?.plan) setPlan(d.owner.plan as PlanKey);
        if (d.monthly) {
          setMonthlyUsed(Number(d.monthly.used) || 0);
          setMonthlyLimit(d.monthly.limit === null || d.monthly.limit === undefined ? null : Number(d.monthly.limit));
        }
      });
  }, []);

  const policy = PLAN_POLICY[plan];
  const selectedStore = stores.find((s) => s.id === storeId);
  const remaining = monthlyLimit === null ? null : Math.max(0, monthlyLimit - monthlyUsed);
  const totalQuotaNum = Math.max(0, Number(totalQuota.replace(/\D/g, "")) || 0);
  const overLimit = remaining !== null && totalQuotaNum > remaining;

  const formattedMonthlyLimit = useMemo(() => (monthlyLimit === null ? "무제한" : `${monthlyLimit}팀`), [monthlyLimit]);

  function toggleChannel(c: string) {
    setChannels((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  }

  function setMenuNameAt(i: number, v: string) {
    setMenus((arr) => arr.map((row, idx) => (idx === i ? { ...row, name: v } : row)));
  }
  function setMenuPriceAt(i: number, v: string) {
    const cleaned = v.replace(/\D/g, "");
    setMenus((arr) => arr.map((row, idx) => (idx === i ? { ...row, price: cleaned } : row)));
  }
  function removeMenuAt(i: number) {
    setMenus((arr) => (arr.length === 1 ? [{ name: "", price: "" }] : arr.filter((_, idx) => idx !== i)));
  }
  function addMenu() {
    setMenus((arr) => [...arr, { name: "", price: "" }]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (useCode.length !== 4) {
      setErr("사용처리 코드는 숫자 4자리로 입력해주세요");
      return;
    }
    setBusy(true);
    setErr(null);
    const cleanMenus = menus
      .map((m) => ({ name: m.name.trim(), price: m.price.trim() ? Number(m.price) : undefined }))
      .filter((m) => m.name.length > 0);
    const highlightKeywords = keywords
      .split(/[,\n]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
      .slice(0, 5);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storeId,
        days: Number(days),
        supportAmount: Number(supportAmount),
        totalQuota: totalQuotaNum,
        useCode,
        requiredMenus: cleanMenus,
        requiredChannels: channels,
        highlightKeywords,
        description,
      }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "생성 실패");
      setBusy(false);
      return;
    }
    router.push("/o/home");
    router.refresh();
  }

  return (
    <div className="pb-24 bg-canvas min-h-[100dvh]">
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 flex items-center">
          <Link href="/o/home" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="홈으로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[18px] font-bold text-ink tracking-title">새 캠페인</h1>
        </div>
      </div>

      <form onSubmit={submit} className="px-5 pt-4 space-y-8">
        {/* 매장 선택 — 캠페인 제목은 매장명으로 자동 */}
        <section>
          <div className="text-[14px] font-semibold text-ink mb-2">매장</div>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="w-full h-12 px-4 rounded-md border border-hairline bg-canvas focus:border-brand focus:outline-none text-[15px]"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {selectedStore && (
            <p className="mt-2 text-[12px] text-muted leading-[1.5]">
              캠페인 제목은 매장명 <span className="text-ink font-medium">「{selectedStore.name}」</span>으로 자동 표기됩니다.
            </p>
          )}
        </section>

        {/* 진행 일수 + 지원금 */}
        <section className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[14px] font-semibold text-ink mb-2">진행 일수</div>
            <input
              value={days}
              onChange={(e) => setDays(Number(e.target.value.replace(/\D/g, "")) || 0)}
              inputMode="numeric"
              className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px]"
            />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-ink mb-2">지원금 (원)</div>
            <input
              value={supportAmount}
              onChange={(e) => setSupportAmount(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px]"
            />
          </div>
        </section>
        <p className="text-[12px] text-muted leading-[1.5] -mt-2">
          지원금은 체험자 결제 시 <span className="text-ink font-medium">매장에서 직접 제공하는 할인</span>입니다
          (등급별 차등 지급 · 별도 정산 없음). 입력 금액은 S등급 100% 기준이에요.
        </p>

        {/* 사용처리 4자리 코드 — 필수 */}
        <section>
          <div className="text-[14px] font-semibold text-ink mb-2">사용처리 코드 (숫자 4자리)</div>
          <input
            value={useCode}
            onChange={(e) => setUseCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder="예: 1234"
            maxLength={4}
            className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[18px] font-semibold tracking-[0.4em] text-center"
          />
          <p className="mt-2 text-[12px] text-muted leading-[1.5]">
            체험자 화면에는 노출되지 않아요. 체험자가 제시한 체험권 화면에 사장님이 이 4자리를 직접 입력하거나, QR을 스캔하면 사용 처리됩니다.
          </p>
        </section>

        {/* 총 모집 인원 — 등급별이 아닌 통합 입력 + 월간 한도 안내 */}
        <section>
          <div className="text-[14px] font-semibold text-ink mb-2">총 모집 인원</div>
          <input
            value={totalQuota}
            onChange={(e) => setTotalQuota(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="예: 20"
            className={`w-full h-12 px-4 rounded-md border focus:outline-none text-[15px] ${overLimit ? "border-error focus:border-error" : "border-hairline focus:border-brand"}`}
          />
          <div className="mt-3 rounded-md bg-canvas border border-hairline p-3.5">
            <div className="flex items-center gap-2 text-[12px] text-muted">
              <span className="font-semibold text-ink">{plan} 플랜</span>
              <span>·</span>
              <span>등급 배분 자동</span>
            </div>
            <p className="mt-2 text-[13px] text-ink leading-[1.55]">
              {policy.description}. 사장님은 총 모집 인원만 설정하시면, 멤버십 등급에 맞춰 시스템이 자동으로 등급을 배분합니다.
            </p>
            <p className="mt-1.5 text-[11px] text-muted">
              모집 가능 등급: {policy.grades.join(" · ")}
              {policy.priorityGrade ? ` (${policy.priorityGrade}등급 우선)` : " (랜덤 노출)"}
            </p>
            <div className="mt-3 pt-3 border-t border-hairline flex items-center justify-between text-[12px]">
              <span className="text-muted">이번 달 모집 현황</span>
              <span className={overLimit ? "text-error font-semibold" : "text-ink font-medium"}>
                {monthlyUsed}팀 사용
                {monthlyLimit !== null && (
                  <>
                    {" / "}
                    <span className="text-muted font-normal">월 한도 {formattedMonthlyLimit}</span>
                  </>
                )}
              </span>
            </div>
            {remaining !== null && (
              <p className="mt-1 text-[11px] text-muted">
                이번 달 잔여 모집 가능 인원: <span className="text-ink font-medium">{remaining}팀</span>
                {overLimit && <span className="text-error"> · 입력값이 한도를 초과합니다</span>}
              </p>
            )}
            {monthlyLimit !== null && (
              <p className="mt-2 text-[11px] text-muted leading-[1.5]">
                월 모집 한도를 늘리려면 <Link href="/o/membership" className="text-brand font-medium">멤버십 업그레이드</Link>를 이용하세요.
              </p>
            )}
          </div>
        </section>

        {/* 필수 채널 */}
        <section>
          <div className="text-[14px] font-semibold text-ink mb-2">필수 채널</div>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => toggleChannel(c.key)}
                className={`h-10 px-4 rounded-pill text-[14px] bg-canvas ${channels.includes(c.key) ? "border-[1.5px] border-ink text-ink font-semibold" : "border border-hairline text-ink font-medium"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </section>

        {/* 필수 주문 메뉴 — 동적 입력 (메뉴명 + 가격) */}
        <section>
          <div className="text-[14px] font-semibold text-ink mb-2">필수 주문 메뉴</div>
          <p className="text-[12px] text-muted mb-3 leading-[1.5]">
            체험자가 방문 시 주문해야 하는 메뉴 (택 1). 메뉴명과 함께 가격을 입력하면 체험자에게 함께 노출됩니다.
          </p>
          <div className="space-y-2">
            {menus.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[11px] text-muted w-5 text-center">{i + 1}</span>
                <input
                  value={m.name}
                  onChange={(e) => setMenuNameAt(i, e.target.value)}
                  placeholder={i === 0 ? "예: 트러플 파스타" : "메뉴명"}
                  className="flex-1 h-11 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px]"
                />
                <div className="relative w-[120px]">
                  <input
                    value={m.price}
                    onChange={(e) => setMenuPriceAt(i, e.target.value)}
                    placeholder="가격"
                    inputMode="numeric"
                    className="w-full h-11 pl-3 pr-7 rounded-md border border-hairline focus:border-brand focus:outline-none text-[14px] text-right"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-muted pointer-events-none">원</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeMenuAt(i)}
                  aria-label="메뉴 삭제"
                  disabled={menus.length === 1 && !menus[0].name && !menus[0].price}
                  className="cp-action w-10 h-11 rounded-md border border-hairline grid place-items-center text-muted disabled:opacity-40"
                >
                  <Icon name="x" variant="border" size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addMenu}
            className="cp-action mt-3 inline-flex items-center gap-1.5 h-10 px-4 rounded-pill border border-dashed border-hairline text-[13px] font-semibold text-brand"
          >
            <Icon name="plus" variant="bold" size={14} />
            <span>메뉴 추가</span>
          </button>
        </section>

        {/* 강조 키워드 */}
        <section>
          <div className="text-[14px] font-semibold text-ink mb-2">강조 키워드</div>
          <p className="text-[12px] text-muted mb-3 leading-[1.5]">
            후기에 꼭 강조해주길 원하는 키워드를 쉼표(,)로 구분해 입력하세요. 체험자 매장 상세에 노출됩니다. (최대 5개)
          </p>
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="예: 트러플 파스타, 데이트 맛집, 분위기 좋은 곳"
            className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px]"
          />
          {keywords.trim() && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {keywords
                .split(/[,\n]/)
                .map((k) => k.trim())
                .filter((k) => k.length > 0)
                .slice(0, 5)
                .map((k, i) => (
                  <span key={`${k}-${i}`} className="px-2.5 py-1 rounded-pill bg-sunken text-[12px] text-ink2 font-medium">
                    #{k}
                  </span>
                ))}
            </div>
          )}
        </section>

        {/* 매장 소개 (최대 500자) */}
        <section>
          <div className="text-[14px] font-semibold text-ink mb-2">매장 소개</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            rows={5}
            maxLength={500}
            placeholder="매장과 체험에 대해 체험자에게 안내할 내용을 입력하세요."
            className="w-full px-4 py-3 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px] leading-[1.5]"
          />
          <div className="mt-1 text-right text-[11px] text-muted tabular-nums">{description.length} / 500</div>
        </section>

        {err && <div className="text-error text-[13px]">{err}</div>}
        <button
          disabled={busy || !storeId || overLimit || useCode.length !== 4}
          type="submit"
          className="w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
        >
          {busy ? "생성 중..." : overLimit ? "월 한도 초과" : useCode.length !== 4 ? "사용처리 코드 4자리 입력" : "캠페인 생성"}
        </button>
      </form>
    </div>
  );
}
