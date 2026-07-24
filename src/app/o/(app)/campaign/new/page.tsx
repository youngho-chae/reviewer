"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import { PLAN_POLICY, type PlanKey } from "@/lib/plan-policy";
import { DELIVERY_CAT_GROUPS } from "@/lib/delivery-categories";
import { DELIVERY_ENABLED } from "@/lib/flags";
import { timeToMin, minToTime, fmtTime12 } from "@/lib/reservation";

// 예약 운영시간 선택지 — 00:00 ~ 24:00, 30분 단위 (24:00 = 자정 종료, 24시간 매장용)
const HALF_HOURS: string[] = Array.from({ length: 49 }, (_, i) => minToTime(i * 30));

interface OwnerStore {
  id: string;
  name: string;
  area?: string;
  category?: string;
  thumbnailUrl?: string; // 플레이스 첫 썸네일 (URL 매장 등록 시 수집)
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
  const [title, setTitle] = useState(""); // 캠페인명 — 사장님 내부 관리용 (미입력 시 매장명 자동, 확정 정책 7)
  // 플레이스 URL로 매장 추가 (확정 정책 5-1 — Free 등급 등 등록 매장이 없어도 캠페인 생성 가능)
  const [showAddStore, setShowAddStore] = useState(false);
  const [placeUrl, setPlaceUrl] = useState("");
  const [manualName, setManualName] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);
  // 캠페인 유형 (2026-07-12 레뷰 벤치마크) — 방문형 | 배송형(전국 택배 · 체험 포인트 지급 가능)
  const [kind, setKind] = useState<"visit" | "delivery">("visit");
  const [pointReward, setPointReward] = useState(""); // 배송형 기준 포인트 (선택 · 100P 단위)
  // 배송형 상품 카테고리 (필수) — 플레이스 분류가 아닌 상품군 분류 (delivery-categories.ts)
  const [productCategory, setProductCategory] = useState("");
  const [reservationRequired, setReservationRequired] = useState(false); // 예약형 (2026-07-22 §1-1 — 유형 선택)
  const [reservationNote, setReservationNote] = useState(""); // 예약 안내 (가능 요일·시간대 — 선택)
  // 예약 운영 스케줄 (2026-07-22 §2) — 요일·운영시간·브레이크·예약 오픈일·시간대 정원
  const [rsvDays, setRsvDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [rsvOpen, setRsvOpen] = useState("11:00");
  const [rsvClose, setRsvClose] = useState("21:00");
  const [rsvBreakOn, setRsvBreakOn] = useState(false);
  const [rsvBreakStart, setRsvBreakStart] = useState("15:00");
  const [rsvBreakEnd, setRsvBreakEnd] = useState("17:00");
  const [rsvOpenDate, setRsvOpenDate] = useState(""); // 예약 가능 시작일 (빈 값 = 즉시)
  const [rsvCapacity, setRsvCapacity] = useState("1"); // 같은 시간 최대 팀 수 (1~5)
  const [productOptionsRaw, setProductOptionsRaw] = useState(""); // 배송형 상품 옵션 (쉼표 구분 · 최대 5)
  // 캠페인 사진 (2026-07-17 회의) — [0]=플레이스 대표 이미지 자리 + 추가 사진, 3~20장 필수.
  // 업로드 파일은 클라이언트에서 640px·JPEG로 리사이즈해 dataURL 저장 (DB 비대화 방지)
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    setPhotoErr(null);
    const next = [...photos];
    for (const file of Array.from(files)) {
      if (next.length >= 20) break;
      if (!file.type.startsWith("image/")) continue;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new window.Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const scale = Math.min(1, 640 / img.width);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/jpeg", 0.6));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("이미지를 읽을 수 없어요")); };
        img.src = url;
      }).catch(() => "");
      if (dataUrl && dataUrl.length <= 300 * 1024) next.push(dataUrl);
    }
    setPhotos(next.slice(0, 20));
  }
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

  // 플레이스 첫 썸네일 → 대표 사진([0]) 프리필 (2026-07-24) — 업로드 사진(dataURL)은 건드리지
  // 않고, 다른 매장의 썸네일(http URL)이 자리에 있으면 현재 매장 것으로 교체한다. 삭제도 가능.
  useEffect(() => {
    const thumb = selectedStore?.thumbnailUrl;
    if (!thumb) return;
    setPhotos((arr) => {
      if (arr.includes(thumb)) return arr;
      const otherThumbs = stores.map((st) => st.thumbnailUrl).filter(Boolean) as string[];
      const rest = arr.filter((p) => !otherThumbs.includes(p));
      return [thumb, ...rest].slice(0, 20);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStore?.thumbnailUrl]);
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
  // 필수 주문 메뉴는 최대 5개 (확정 정책 6)
  function addMenu() {
    setMenus((arr) => (arr.length >= 5 ? arr : [...arr, { name: "", price: "" }]));
  }

  // 플레이스 URL로 매장 추가 — 조회 실패 시 매장명 수동 입력 폴백
  async function addStoreByUrl() {
    setAddBusy(true);
    setAddErr(null);
    const res = await fetch("/api/owner/stores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ placeUrl, name: manualName.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAddErr(data.error || "매장 추가 실패");
      setAddBusy(false);
      return;
    }
    setStores((arr) => [...arr, data.store]);
    setStoreId(data.store.id);
    setShowAddStore(false);
    setPlaceUrl("");
    setManualName("");
    setAddBusy(false);
  }

  const isDelivery = kind === "delivery";

  const isReserve = !isDelivery && reservationRequired;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isDelivery && useCode.length !== 4) {
      setErr("사용처리 코드는 숫자 4자리로 입력해주세요");
      return;
    }
    if (isReserve) {
      if (rsvDays.length === 0) {
        setErr("예약 가능한 요일을 1개 이상 선택해주세요");
        return;
      }
      if (timeToMin(rsvClose) <= timeToMin(rsvOpen)) {
        setErr("예약 종료 시간은 시작 시간보다 늦어야 해요");
        return;
      }
      if (
        rsvBreakOn &&
        (timeToMin(rsvBreakEnd) <= timeToMin(rsvBreakStart) ||
          timeToMin(rsvBreakStart) < timeToMin(rsvOpen) ||
          timeToMin(rsvBreakEnd) > timeToMin(rsvClose))
      ) {
        setErr("브레이크 타임은 운영시간 내에서 시작·종료를 선택해주세요");
        return;
      }
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
        kind,
        title: title.trim() || undefined,
        days: Number(days),
        supportAmount: Number(supportAmount),
        totalQuota: totalQuotaNum,
        useCode: isDelivery ? undefined : useCode,
        pointReward: isDelivery && pointReward ? Number(pointReward) : undefined,
        productCategory: isDelivery ? productCategory : undefined,
        productOptions: isDelivery
          ? productOptionsRaw.split(/[,\n]/).map((o) => o.trim()).filter((o) => o.length > 0).slice(0, 5)
          : undefined,
        reservationRequired: isReserve ? true : undefined,
        reservationNote: isReserve ? reservationNote.trim() || undefined : undefined,
        // 예약 운영 스케줄 (2026-07-22 §2) — 예약형 필수
        reservationSchedule: isReserve
          ? {
              days: rsvDays,
              open: rsvOpen,
              close: rsvClose,
              ...(rsvBreakOn ? { breakStart: rsvBreakStart, breakEnd: rsvBreakEnd } : {}),
              ...(rsvOpenDate ? { opensAt: Date.parse(`${rsvOpenDate}T00:00:00+09:00`) } : {}),
              slotCapacity: Math.min(5, Math.max(1, Number(rsvCapacity) || 1)),
            }
          : undefined,
        photos, // 매장·상품 사진 3~20장 (2026-07-17)
        requiredMenus: isDelivery ? [] : cleanMenus,
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
        {/* 매장 선택 — 등록 매장 선택 또는 플레이스 URL로 추가 (확정 정책 5-1) */}
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
            {stores.length === 0 && <option value="">등록된 매장이 없어요</option>}
          </select>
          <button
            type="button"
            onClick={() => setShowAddStore((v) => !v)}
            className="cp-action mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-brand"
          >
            + 플레이스 URL로 매장 추가
          </button>
          {showAddStore && (
            <div className="mt-2 rounded-md border border-hairline p-3.5 space-y-2">
              <input
                value={placeUrl}
                onChange={(e) => setPlaceUrl(e.target.value)}
                placeholder="네이버 플레이스 URL 또는 place ID"
                className="w-full h-11 px-3 rounded-md border border-hairline focus:border-brand focus:outline-none text-[14px]"
              />
              <input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="매장명 (정보를 못 불러올 때 사용)"
                className="w-full h-11 px-3 rounded-md border border-hairline focus:border-brand focus:outline-none text-[14px]"
              />
              {addErr && <p className="text-[12px] text-error">{addErr}</p>}
              <button
                type="button"
                onClick={addStoreByUrl}
                disabled={addBusy || !placeUrl.trim()}
                className="cp-action w-full h-11 rounded-md bg-ink text-white text-[14px] font-semibold disabled:bg-sunken disabled:text-mutedSoft"
              >
                {addBusy ? "불러오는 중..." : "매장 불러오기"}
              </button>
              <p className="text-[11px] text-muted leading-[1.5]">
                프리 플랜도 URL로 매장을 등록해 월 한도 내 캠페인을 만들 수 있어요. 플레이스 정보 조회가 어려우면
                매장명을 함께 입력해주세요.
              </p>
            </div>
          )}
        </section>

        {/* 캠페인 유형 — 방문형 | 예약형 | 배송형 (2026-07-22 §1-1 — 예약형을 독립 유형으로 구분) */}
        <section>
          <div className="text-[14px] font-semibold text-ink mb-2">캠페인 유형</div>
          <div className={`grid gap-2 ${DELIVERY_ENABLED ? "grid-cols-3" : "grid-cols-2"}`}>
            {(
              [
                { key: "visit", label: "🏠 방문형", desc: "예약 없이 방문 · 결제 시 직접 할인" },
                { key: "reserve", label: "📅 예약형", desc: "방문 일시 예약 후 사장님 확정" },
                // 배송형 — DELIVERY_ENABLED=false(main 릴리스)면 유형 선택에서 제외
                ...(DELIVERY_ENABLED ? [{ key: "delivery" as const, label: "📦 배송형", desc: "택배 발송 · 전국 모집" }] : []),
              ] as const
            ).map((k) => {
              const active = k.key === "delivery" ? isDelivery : !isDelivery && (k.key === "reserve") === reservationRequired;
              return (
                <button
                  key={k.key}
                  type="button"
                  onClick={() => {
                    if (k.key === "delivery") {
                      setKind("delivery");
                      setReservationRequired(false);
                    } else {
                      setKind("visit");
                      setReservationRequired(k.key === "reserve");
                    }
                  }}
                  aria-pressed={active}
                  className={`rounded-md px-3 py-3.5 text-left bg-canvas ${
                    active ? "border-[1.5px] border-brand" : "border border-hairline"
                  }`}
                >
                  <div className={`text-[15px] font-bold ${active ? "text-brand" : "text-ink"}`}>{k.label}</div>
                  <div className="mt-0.5 text-[11px] text-muted leading-[1.4]">{k.desc}</div>
                </button>
              );
            })}
          </div>
          {isDelivery && (
            <p className="mt-2 text-[12px] text-muted leading-[1.5]">
              배송형은 체험자가 배송지를 입력해 신청하고, 사장님이 <span className="text-ink font-medium">발송 처리</span>하면
              체험자에게 리뷰 기한(발송 후 7일)이 시작돼요.
            </p>
          )}
          {!isDelivery && reservationRequired && (
            <p className="mt-2 text-[12px] text-muted leading-[1.5]">
              예약형은 체험자가 희망 방문 일시를 선택해 신청하고, <span className="text-ink font-medium">사장님이 확정해야 QR 체험권이 열려요</span>.
              방문형의 이용 방식은 그대로 유지됩니다.
            </p>
          )}
        </section>

        {/* 캠페인명 — 사장님 내부 관리용 (확정 정책 7). 체험자에게는 매장명으로 노출 */}
        <section>
          <div className="text-[14px] font-semibold text-ink mb-2">
            캠페인명 <span className="text-[12px] text-muted font-normal">(내 관리용 · 선택)</span>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 40))}
            placeholder="예: 신메뉴 출시 기념 체험단 모집"
            className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px]"
          />
          <p className="mt-2 text-[12px] text-muted leading-[1.5]">
            사장님 화면에서 캠페인을 구분하는 제목이에요. 미입력 시 매장명
            {selectedStore ? ` 「${selectedStore.name}」` : ""}으로 자동 설정되며, <span className="text-ink font-medium">체험자에게는 항상 매장명 중심으로 노출</span>됩니다.
          </p>
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
            <div className="text-[14px] font-semibold text-ink mb-2">{isDelivery ? "제공 상품 정가 (원)" : "지원금 (원)"}</div>
            <input
              value={supportAmount}
              onChange={(e) => setSupportAmount(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px]"
            />
          </div>
        </section>
        <p className="text-[12px] text-muted leading-[1.5] -mt-2">
          {isDelivery ? (
            <>발송하는 체험 상품의 정가입니다. 체험자 화면에 <span className="text-ink font-medium">제공 상품 가치</span>로 노출돼요.</>
          ) : (
            <>지원금은 체험자 결제 시 <span className="text-ink font-medium">매장에서 직접 제공하는 할인</span>입니다
            (등급별 차등 지급 · 별도 정산 없음). 입력 금액은 S등급 100% 기준이에요.</>
          )}
        </p>

        {/* 배송형 — 상품 카테고리 (필수). 플레이스 분류(카페·식당)가 아닌 상품군 분류 */}
        {isDelivery && (
          <section>
            <div className="text-[14px] font-semibold text-ink mb-2">상품 카테고리 (필수)</div>
            <div className="flex flex-wrap gap-2">
              {DELIVERY_CAT_GROUPS.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setProductCategory(g.key)}
                  aria-pressed={productCategory === g.key}
                  className={`h-10 px-4 rounded-pill text-[14px] bg-canvas inline-flex items-center gap-1.5 ${
                    productCategory === g.key
                      ? "border-[1.5px] border-ink text-ink font-semibold"
                      : "border border-hairline text-ink font-medium"
                  }`}
                >
                  <span aria-hidden>{g.ic}</span>
                  {g.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-muted leading-[1.5]">
              배송 체험은 매장이 아닌 <span className="text-ink font-medium">스토어의 상품</span>이 대상이에요 — 체험자 탐색의 상품 카테고리 필터에 사용됩니다.
            </p>
          </section>
        )}

        {/* 배송형 — 상품 옵션 (선택, 2026-07-16 리뷰노트 벤치마크) */}
        {isDelivery && (
          <section>
            <div className="text-[14px] font-semibold text-ink mb-2">
              상품 옵션 <span className="text-[12px] text-muted font-normal">(선택 · 쉼표로 최대 5개)</span>
            </div>
            <input
              value={productOptionsRaw}
              onChange={(e) => setProductOptionsRaw(e.target.value)}
              placeholder="예: 화이트, 블랙"
              className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px]"
            />
            <p className="mt-2 text-[12px] text-muted leading-[1.5]">
              색상·구성 등 옵션이 있는 상품이라면 입력하세요. 체험자가 신청할 때 하나를 선택하고, 발송 대기 큐에 표시돼요.
            </p>
          </section>
        )}

        {/* 배송형 — 체험 포인트 (선택) */}
        {isDelivery && (
          <section>
            <div className="text-[14px] font-semibold text-ink mb-2">
              체험 포인트 <span className="text-[12px] text-muted font-normal">(선택 · 100P 단위)</span>
            </div>
            <input
              value={pointReward}
              onChange={(e) => setPointReward(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="예: 10000"
              className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px]"
            />
            <p className="mt-2 text-[12px] text-muted leading-[1.5]">
              리뷰가 검수를 통과하면 체험자에게 적립되는 포인트예요 (1P = 1원). 입력 금액은 S등급 100% 기준이며
              채널 등급에 따라 차등 지급됩니다. 포인트 비용 정산 방식은 운영팀 안내를 따릅니다.
            </p>
          </section>
        )}

        {/* 예약형 — 예약 운영 설정 (2026-07-22 §2: 요일·운영시간·브레이크·오픈일·시간대 정원) */}
        {isReserve && (
          <section className="rounded-lg border border-hairline p-4 space-y-5">
            <div>
              <div className="text-[14px] font-semibold text-ink">예약 운영 설정</div>
              <p className="mt-1 text-[12px] text-muted leading-[1.5]">
                네이버 예약 등 외부 플랫폼과 연동되지 않아요 — 외부 예약 상황은 캠페인 관리의{" "}
                <span className="text-ink font-medium">날짜·시간 차단</span>으로 직접 반영해주세요.
              </p>
            </div>

            {/* 예약 가능 요일 */}
            <div>
              <div className="text-[13px] font-semibold text-ink mb-2">예약 가능 요일</div>
              <div className="flex gap-1.5">
                {["일", "월", "화", "수", "목", "금", "토"].map((label, d) => {
                  const on = rsvDays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setRsvDays((arr) => (on ? arr.filter((x) => x !== d) : [...arr, d].sort()))}
                      aria-pressed={on}
                      className={`w-10 h-10 rounded-full text-[13px] font-semibold ${
                        on ? "bg-brand text-white" : "bg-canvas border border-hairline text-muted"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-muted">선택하지 않은 요일에는 체험자가 예약할 수 없어요 · 모든 운영 요일에 같은 시간이 적용돼요.</p>
            </div>

            {/* 운영시간 — 30분 단위, 24시간 매장은 오전 12시~오전 12시(24:00) */}
            <div>
              <div className="text-[13px] font-semibold text-ink mb-2">예약 가능 시간 (30분 단위)</div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={rsvOpen}
                  onChange={(e) => setRsvOpen(e.target.value)}
                  aria-label="예약 시작 시간"
                  className="h-11 px-3 rounded-sm border border-hairline bg-canvas text-[14px] text-ink"
                >
                  {HALF_HOURS.slice(0, -1).map((t) => (
                    <option key={t} value={t}>
                      {fmtTime12(t)}
                    </option>
                  ))}
                </select>
                <select
                  value={rsvClose}
                  onChange={(e) => setRsvClose(e.target.value)}
                  aria-label="예약 종료 시간"
                  className="h-11 px-3 rounded-sm border border-hairline bg-canvas text-[14px] text-ink"
                >
                  {HALF_HOURS.slice(1).map((t) => (
                    <option key={t} value={t}>
                      {t === "24:00" ? "오전 12시 (자정)" : fmtTime12(t)}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1.5 text-[11px] text-muted">
                마지막 예약 슬롯은 종료 30분 전이에요 · 24시간 매장은 오전 12시 ~ 오전 12시(자정)로 설정하세요.
              </p>
            </div>

            {/* 브레이크 타임 (선택 · 단일 구간) */}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rsvBreakOn}
                  onChange={(e) => setRsvBreakOn(e.target.checked)}
                  className="w-4 h-4 accent-[#9333EA]"
                />
                <span className="text-[13px] font-semibold text-ink">브레이크 타임 설정</span>
              </label>
              {rsvBreakOn && (
                <>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <select
                      value={rsvBreakStart}
                      onChange={(e) => setRsvBreakStart(e.target.value)}
                      aria-label="브레이크 시작"
                      className="h-11 px-3 rounded-sm border border-hairline bg-canvas text-[14px] text-ink"
                    >
                      {HALF_HOURS.slice(0, -1).map((t) => (
                        <option key={t} value={t}>
                          {fmtTime12(t)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={rsvBreakEnd}
                      onChange={(e) => setRsvBreakEnd(e.target.value)}
                      aria-label="브레이크 종료"
                      className="h-11 px-3 rounded-sm border border-hairline bg-canvas text-[14px] text-ink"
                    >
                      {HALF_HOURS.slice(1).map((t) => (
                        <option key={t} value={t}>
                          {t === "24:00" ? "오전 12시 (자정)" : fmtTime12(t)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted">브레이크 타임 시간대는 체험자 예약 화면에 비활성으로 표시돼요.</p>
                </>
              )}
            </div>

            {/* 예약 가능 시작일 (2-5) — 캠페인 공개일과 구분 */}
            <div>
              <div className="text-[13px] font-semibold text-ink mb-2">
                예약 가능 시작일 <span className="text-[12px] text-muted font-normal">(선택)</span>
              </div>
              <input
                type="date"
                value={rsvOpenDate}
                onChange={(e) => setRsvOpenDate(e.target.value)}
                className="w-full h-11 px-3 rounded-sm border border-hairline bg-canvas text-[14px] text-ink"
              />
              <p className="mt-1.5 text-[11px] text-muted leading-[1.5]">
                비워두면 캠페인 공개와 동시에 예약을 받아요. 날짜를 설정하면 그 전까지 상세 페이지는 열람 가능하지만
                예약 버튼은 <span className="text-ink font-medium">예약 오픈 예정</span>으로 비활성돼요 (권장: 공개 3일 뒤).
              </p>
            </div>

            {/* 같은 시간 최대 팀 수 (§13-A) */}
            <div>
              <div className="text-[13px] font-semibold text-ink mb-2">같은 시간 최대 팀 수</div>
              <select
                value={rsvCapacity}
                onChange={(e) => setRsvCapacity(e.target.value)}
                aria-label="같은 시간 최대 팀 수"
                className="w-full h-11 px-3 rounded-sm border border-hairline bg-canvas text-[14px] text-ink"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}팀
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-muted">시간대 정원이 차면 해당 시간은 자동으로 마감돼요 · 취소되면 자동 복구됩니다.</p>
            </div>

            {/* 예약 안내 — 가능 요일·시간대 등 자유 텍스트 (선택) */}
            <div>
              <input
                value={reservationNote}
                onChange={(e) => setReservationNote(e.target.value.slice(0, 80))}
                placeholder="예약 안내 (선택) — 예: 주차는 매장 뒤 공영주차장을 이용해주세요"
                className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px]"
              />
              <p className="mt-1.5 text-[12px] text-muted">추가 안내가 있다면 적어주세요 — 체험자 상세·신청 화면에 표시돼요.</p>
            </div>
          </section>
        )}

        {/* 사용처리 4자리 코드 — 방문형 필수 (배송형은 사용 처리 개념이 없어 자동 생성) */}
        {!isDelivery && (
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
        )}

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
            {/* [확정 정책 8-3] 등급 우선 모집(부스팅) 표기는 도입하지 않는다 — 전 플랜 균등 배분 */}
            <p className="mt-1.5 text-[11px] text-muted">모집 가능 등급: 전 등급 (배분 자동)</p>
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

        {/* 필수 주문 메뉴 — 방문형 전용 (배송형은 방문·주문 개념이 없음) */}
        {!isDelivery && (
        <section>
          <div className="text-[14px] font-semibold text-ink mb-2">
            필수 주문 메뉴 <span className="text-[12px] text-muted font-normal">(선택 입력 · 최대 5개)</span>
          </div>
          <p className="text-[12px] text-muted mb-3 leading-[1.5]">
            체험자가 방문 시 주문해야 하는 메뉴 (택 1). 지정 없이 지원 금액만 설정해도 돼요. 메뉴명과 함께 가격을
            입력하면 체험자에게 함께 노출됩니다.
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
            disabled={menus.length >= 5}
            className="cp-action mt-3 inline-flex items-center gap-1.5 h-10 px-4 rounded-pill border border-dashed border-hairline text-[13px] font-semibold text-brand disabled:text-mutedSoft"
          >
            <Icon name="plus" variant="bold" size={14} />
            <span>{menus.length >= 5 ? "최대 5개까지 등록할 수 있어요" : "메뉴 추가"}</span>
          </button>
        </section>
        )}

        {/* 매장·상품 사진 (2026-07-17 회의) — 대표 이미지 + 추가 사진, 3~20장 필수.
            체험자 탐색 카드 캐러셀·상세 히어로에 노출된다. 첫 장이 대표 이미지. */}
        <section>
          <div className="text-[14px] font-semibold text-ink mb-2">
            매장·상품 사진 <span className="text-[12px] text-muted font-normal">(필수 · 3~20장, 첫 장이 대표)</span>
          </div>
          <p className="text-[12px] text-muted mb-3 leading-[1.5]">
            플레이스 대표 이미지와 매장·메뉴 사진을 등록하세요. 체험자 탐색 카드와 상세 화면에 캐러셀로 노출됩니다.
          </p>
          <div className="flex flex-wrap gap-2">
            {photos.map((src, i) => (
              <div key={i} className="relative w-[100px] h-[75px] rounded-md overflow-hidden bg-sunken border border-hairline">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`사진 ${i + 1}`} className="w-full h-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-1 top-1 px-1 py-0.5 rounded-xs bg-ink/70 text-white text-[10px] font-semibold">
                    {src === selectedStore?.thumbnailUrl ? "대표 · 플레이스" : "대표"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setPhotos((arr) => arr.filter((_, j) => j !== i))}
                  aria-label={`사진 ${i + 1} 삭제`}
                  className="absolute right-1 top-1 w-5 h-5 rounded-full bg-ink/70 text-white text-[11px] leading-none"
                >
                  ✕
                </button>
              </div>
            ))}
            {photos.length < 20 && (
              <label className="w-[100px] h-[75px] rounded-md border border-dashed border-hairline grid place-items-center text-[12px] text-muted cursor-pointer">
                + 추가
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
              </label>
            )}
          </div>
          <p className={`mt-2 text-[12px] ${photos.length >= 3 ? "text-muted" : "text-error"}`}>
            {photos.length}/20장 등록됨{photos.length < 3 ? " — 최소 3장이 필요해요" : ""}
          </p>
          {photoErr && <p className="mt-1 text-[12px] text-error">{photoErr}</p>}
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
          disabled={busy || !storeId || overLimit || photos.length < 3 || (!isDelivery && useCode.length !== 4) || (isDelivery && !productCategory)}
          type="submit"
          className="w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
        >
          {busy
            ? "생성 중..."
            : overLimit
              ? "월 한도 초과"
              : !isDelivery && useCode.length !== 4
                ? "사용처리 코드 4자리 입력"
                : isDelivery && !productCategory
                  ? "상품 카테고리 선택"
                  : "캠페인 생성"}
        </button>
      </form>
    </div>
  );
}
