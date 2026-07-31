"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import { PLAN_POLICY, type PlanKey } from "@/lib/plan-policy";
import { NEXT_PLAN, PLAN_PRICE } from "@/lib/limit-refill";
import RefillFlow from "@/components/RefillFlow";
import { DELIVERY_CAT_GROUPS } from "@/lib/delivery-categories";
import { DELIVERY_ENABLED } from "@/lib/flags";
import { timeToMin, minToTime, fmtTime12 } from "@/lib/reservation";
import { CHANNEL_REVIEW_CONDITIONS, CHANNEL_LABEL } from "@/lib/channels";
import { SUPPORT_MULTIPLIER, supportForGrade } from "@/lib/grade";
import type { Grade } from "@/lib/types";

// 등급별 지원금 시트 행 (시안 — "New" = N등급 표기)
const GRADE_ROWS: Array<{ grade: Grade; label: string }> = [
  { grade: "S", label: "S등급" },
  { grade: "A", label: "A등급" },
  { grade: "B", label: "B등급" },
  { grade: "C", label: "C등급" },
  { grade: "N", label: "New" },
];

// 예약 운영시간 선택지 — 00:00 ~ 24:00, 30분 단위 (24:00 = 자정 종료, 24시간 매장용)
const HALF_HOURS: string[] = Array.from({ length: 49 }, (_, i) => minToTime(i * 30));

interface OwnerStore {
  id: string;
  name: string;
  area?: string;
  category?: string;
  address?: string;
  thumbnailUrl?: string; // 플레이스 첫 썸네일 (URL 조회 시 수집)
}

// URL로 불러온 임시 매장 (2026-07-31) — DB 미등록. 이 화면의 상태로만 유지되고
// 페이지 이탈 시 휘발되며, 캠페인 등록 제출 시 newStore로 보내 그때 저장된다.
const TEMP_STORE_ID = "__temp__";
interface TempStore extends OwnerStore {
  rating?: number;
  reviewCount?: number;
  hours?: string;
  lat?: number;
  lng?: number;
  naverPlaceId?: string;
  coverEmoji?: string;
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

const DAY_CHOICES = [7, 14, 30];

export default function NewCampaign() {
  const router = useRouter();
  const [stores, setStores] = useState<OwnerStore[]>([]);
  const [plan, setPlan] = useState<PlanKey>("Free");
  const [storeId, setStoreId] = useState("");
  const [title, setTitle] = useState(""); // 캠페인명 — 사장님 내부 관리용 (미입력 시 매장명 자동, 확정 정책 7)
  // URL로 매장정보 불러오기 (2026-07-31 개편 — 조회 전용, 확정 정책 5-1: 프리 배제 금지)
  const [showAddStore, setShowAddStore] = useState(false);
  const [placeUrl, setPlaceUrl] = useState("");
  const [manualName, setManualName] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);
  const [tempStore, setTempStore] = useState<TempStore | null>(null);
  // 캠페인 유형 (2026-07-12 레뷰 벤치마크) — 방문형 | 배송형(전국 택배 · 체험 포인트 지급 가능)
  const [kind, setKind] = useState<"visit" | "delivery">("visit");
  const [pointReward, setPointReward] = useState(""); // 배송형 기준 포인트 (선택 · 100P 단위)
  // 배송형 상품 카테고리 (필수) — 플레이스 분류가 아닌 상품군 분류 (delivery-categories.ts)
  const [productCategory, setProductCategory] = useState("");
  const [reservationRequired, setReservationRequired] = useState(false); // 캠페인 방식 = 예약 필수 (2026-07-22 §1-1)
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
  const [authorityConfirmed, setAuthorityConfirmed] = useState(false); // [필수] 매장 운영 권한 확인 (2026-07-28)
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
  const [days, setDays] = useState(7); // 진행 일수 — 시안 칩 7/14/30
  const [supportAmount, setSupportAmount] = useState("");
  const [totalQuota, setTotalQuota] = useState("");
  const [useCode, setUseCode] = useState(""); // 매장 확인 번호 (숫자 4자리)
  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [channels, setChannels] = useState<string[]>(["naver_blog", "instagram"]);
  const [keywords, setKeywords] = useState("");
  const [description, setDescription] = useState("");
  const [monthlyUsed, setMonthlyUsed] = useState(0);
  const [monthlyLimit, setMonthlyLimit] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 모집 한도 리필권 상태 (2026-07-31 BM 쿠폰형 — /api/owner/me 응답)
  const [refill, setRefill] = useState<{
    bonus: number;
    grant: number;
    price: number;
    owned: number; // 보유(미사용) 쿠폰 수 — [리필하기] 분기
    canBuy: boolean;
  } | null>(null);
  const [supportInfoOpen, setSupportInfoOpen] = useState(false); // 지원금 ⓘ
  const [codeInfoOpen, setCodeInfoOpen] = useState(false); // 매장 확인 번호 ⓘ
  const [condOpen, setCondOpen] = useState(false); // 채널별 리뷰 작성 조건
  const [leaveOpen, setLeaveOpen] = useState(false); // 이탈 확인 모달 (시안)

  const loadMe = (selectFirst: boolean) =>
    fetch("/api/owner/me")
      .then((r) => r.json())
      .then((d) => {
        setStores(d.stores || []);
        // 대표 매장이 Default 선택 (2026-07-31 — 지정은 마이페이지 [매장 정보], 미지정 시 첫 매장)
        if (selectFirst) {
          const primary = d.owner?.primaryStoreId;
          const first = (d.stores || []).find((s: OwnerStore) => s.id === primary) ?? d.stores?.[0];
          if (first) setStoreId(first.id);
        }
        if (d.owner?.plan) setPlan(d.owner.plan as PlanKey);
        if (d.monthly) {
          setMonthlyUsed(Number(d.monthly.used) || 0);
          setMonthlyLimit(d.monthly.limit === null || d.monthly.limit === undefined ? null : Number(d.monthly.limit));
        }
        setRefill(d.refill ?? null); // 모집 한도 리필권 상태 (2026-07-31 BM)
      });
  useEffect(() => {
    loadMe(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // URL로 불러온 임시 매장 포함 목록 — DB 반영이 아니라 이 화면 한정 (이탈 시 휘발)
  const allStores = useMemo<OwnerStore[]>(() => (tempStore ? [...stores, tempStore] : stores), [stores, tempStore]);
  const selectedStore = allStores.find((s) => s.id === storeId);
  const tempSelected = storeId === TEMP_STORE_ID;

  // 플레이스 첫 썸네일 → 대표 사진([0]) 프리필 (2026-07-24) — 업로드 사진(dataURL)은 건드리지
  // 않고, 다른 매장의 썸네일(http URL)이 자리에 있으면 현재 매장 것으로 교체한다. 삭제도 가능.
  useEffect(() => {
    const thumb = selectedStore?.thumbnailUrl;
    if (!thumb) return;
    setPhotos((arr) => {
      if (arr.includes(thumb)) return arr;
      const otherThumbs = allStores.map((st) => st.thumbnailUrl).filter(Boolean) as string[];
      const rest = arr.filter((p) => !otherThumbs.includes(p));
      return [thumb, ...rest].slice(0, 20);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStore?.thumbnailUrl]);
  const remaining = monthlyLimit === null ? null : Math.max(0, monthlyLimit - monthlyUsed);
  const totalQuotaNum = Math.max(0, Number(totalQuota.replace(/\D/g, "")) || 0);
  const overLimit = remaining !== null && totalQuotaNum > remaining;
  const supportNum = Math.max(0, Number(supportAmount.replace(/\D/g, "")) || 0);
  // 표시용 한도 (2026-07-31 BM 보완) — 카드·게이지는 **기본 플랜 한도 기준**으로 표기하고
  // 리필 누적 수량은 노출하지 않는다. 사용량에서 리필분을 차감해 게이지가 다시 차오른다.
  // (잔여·초과 판정은 리필 포함 실한도(monthlyLimit) 기준 유지)
  const refillAmt = refill?.bonus ?? 0;
  const baseLimit = monthlyLimit === null ? null : monthlyLimit - refillAmt;
  const shownUsed = baseLimit === null ? 0 : Math.min(baseLimit, Math.max(0, monthlyUsed - refillAmt));

  // 진행 일수 → 마감일 (생성일 기준 n일차 자정 KST 직전 — 2026-07-28 확정)
  const deadlineLabel = useMemo(() => {
    const d = new Date(Date.now() + 9 * 3600000);
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + days * 86400000 - 1);
    return `${end.getUTCMonth() + 1}월 ${end.getUTCDate()}일 (${"일월화수목금토"[end.getUTCDay()]})`;
  }, [days]);

  // 이탈 확인 (시안) — 입력이 있으면 뒤로가기 시 확인 모달
  const dirty =
    !!title || !!totalQuota || !!supportAmount || !!useCode || !!keywords || !!description ||
    photos.length > 0 || menus.some((m) => m.name || m.price) || !!tempStore || authorityConfirmed;

  function toggleChannel(c: string) {
    setChannels((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  }

  function setMenuNameAt(i: number, v: string) {
    setMenus((arr) => arr.map((m, j) => (j === i ? { ...m, name: v.slice(0, 30) } : m)));
  }
  function setMenuPriceAt(i: number, v: string) {
    setMenus((arr) => arr.map((m, j) => (j === i ? { ...m, price: v.replace(/\D/g, "").slice(0, 8) } : m)));
  }
  function removeMenuAt(i: number) {
    setMenus((arr) => arr.filter((_, j) => j !== i));
  }
  function addMenu() {
    setMenus((arr) => (arr.length >= 5 ? arr : [...arr, { name: "", price: "" }]));
  }

  // URL로 매장정보 불러오기 — 조회 전용 (DB 미등록). 이미 등록된 플레이스면 그 매장을 선택.
  async function loadStoreByUrl() {
    setAddBusy(true);
    setAddErr(null);
    const res = await fetch("/api/owner/stores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ placeUrl, name: manualName.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAddErr(data.error || "매장 정보를 불러오지 못했어요");
      setAddBusy(false);
      return;
    }
    if (data.existing) {
      // 이미 내 매장으로 등록된 플레이스 — 목록에서 그 매장을 선택
      setStores((arr) => (arr.some((s) => s.id === data.store.id) ? arr.map((s) => (s.id === data.store.id ? data.store : s)) : [...arr, data.store]));
      setStoreId(data.store.id);
      setTempStore(null);
    } else {
      // 임시 매장 — 이 화면에서만 유지 (새 URL 조회 시 교체, 이탈 시 휘발)
      setTempStore({ ...data.store, id: TEMP_STORE_ID });
      setStoreId(TEMP_STORE_ID);
    }
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
      setErr("매장 확인 번호는 숫자 4자리로 입력해주세요");
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
        // URL로 불러온 임시 매장은 등록 확정 시점에만 저장 (newStore — 2026-07-31)
        storeId: tempSelected ? undefined : storeId,
        newStore: tempSelected && tempStore ? { ...tempStore, id: undefined } : undefined,
        kind,
        title: title.trim() || undefined,
        days: Number(days),
        supportAmount: supportNum,
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
        authorityConfirmed, // [필수] 매장 운영 권한 확인 (2026-07-28 — 서버 재검증)
      }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "등록 실패");
      setBusy(false);
      return;
    }
    router.push("/o/home");
    router.refresh();
  }

  function onBack() {
    if (dirty) setLeaveOpen(true);
    else router.push("/o/home");
  }

  const infoRow = (label: string, value?: string) => (
    <div className="flex gap-4 py-1.5">
      <span className="w-16 shrink-0 text-[13px] text-muted">{label}</span>
      <span className="text-[13px] font-semibold text-ink">{value || "—"}</span>
    </div>
  );

  return (
    <div className="pb-24 bg-canvas min-h-[100dvh]">
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 flex items-center">
          <button type="button" onClick={onBack} className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="뒤로가기">
            <Icon name="chevron-left" variant="border" size={22} />
          </button>
          <h1 className="flex-1 text-center pr-10 text-[17px] font-bold text-ink tracking-title">새 캠페인 등록</h1>
        </div>
      </div>

      <form onSubmit={submit} className="px-5 pt-2 space-y-8">
        {/* 매장 — 대표 매장 기본 선택 + URL로 매장정보 불러오기(임시) + 정보 요약 카드 (시안) */}
        <section>
          <div className="text-[15px] font-bold text-ink mb-2">매장</div>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="w-full h-12 px-4 rounded-md border border-hairline bg-canvas focus:border-brand focus:outline-none text-[15px]"
          >
            {allStores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id === TEMP_STORE_ID ? `${s.name} (URL 불러옴)` : s.name}
              </option>
            ))}
            {allStores.length === 0 && <option value="">등록된 매장이 없어요</option>}
          </select>
          <button
            type="button"
            onClick={() => setShowAddStore((v) => !v)}
            className="cp-action mt-2.5 inline-flex items-center gap-1 text-[13px] font-semibold text-brand"
          >
            + URL로 매장정보 불러오기
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
                onClick={loadStoreByUrl}
                disabled={addBusy || !placeUrl.trim()}
                className="cp-action w-full h-11 rounded-md bg-ink text-white text-[14px] font-semibold disabled:bg-sunken disabled:text-mutedSoft"
              >
                {addBusy ? "불러오는 중..." : "매장 정보 불러오기"}
              </button>
              <p className="text-[11px] text-muted leading-[1.5]">
                불러온 매장 정보는 <span className="text-ink font-medium">등록되지 않고 이 화면에서만 유지</span>돼요 —
                페이지를 벗어나면 사라지고, 캠페인을 등록하면 그때 내 매장으로 함께 저장됩니다.
              </p>
            </div>
          )}
          {selectedStore && (
            <div className="mt-3 rounded-md bg-sunken px-4 py-2.5">
              {infoRow("상호명", selectedStore.name)}
              {infoRow("카테고리", selectedStore.category)}
              {infoRow("주소", selectedStore.address)}
            </div>
          )}
        </section>

        {/* 캠페인명 — 사장님 내부 관리용 (확정 정책 7). 체험자에게는 매장명으로 노출 */}
        <section>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[15px] font-bold text-ink">캠페인명</span>
            <span className="px-1.5 py-0.5 rounded-xs bg-sunken text-[11px] font-medium text-muted">선택</span>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 40))}
            placeholder="예: 신메뉴 출시 기념 체험단 모집"
            className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px]"
          />
          <p className="mt-2 text-[12px] text-muted leading-[1.5]">
            사장님 화면에서 캠페인을 구분하는 제목입니다. 미입력 시 매장명
            {selectedStore ? ` 「${selectedStore.name}」` : ""}으로 자동 설정되며, 체험자에게는 항상{" "}
            <span className="text-ink font-medium">매장명 중심으로 노출</span>됩니다.
          </p>
        </section>

        {/* 총 모집 인원 + 플랜 사용 현황 카드 (시안 — 게이지는 홈과 동일한 잔여형) */}
        <section>
          <div className="text-[15px] font-bold text-ink mb-2">총 모집 인원</div>
          <input
            value={totalQuota}
            onChange={(e) => setTotalQuota(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="예: 20"
            className={`w-full h-12 px-4 rounded-md border focus:outline-none text-[15px] ${overLimit ? "border-error focus:border-error" : "border-hairline focus:border-brand"}`}
          />
          <div className="mt-3 rounded-md bg-sunken p-4">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-ink2">{plan}</span>
              <span className="text-[15px] font-bold text-ink tabular-nums">
                {shownUsed} / {baseLimit ?? "—"}
              </span>
              {/* [리필하기] (2026-07-31 2차 보완) — 보유 쿠폰 없으면 구매, 있으면 사용 (홈과 동일 플로우) */}
              {refill && (
                <RefillFlow
                  plan={plan}
                  grant={refill.grant}
                  price={refill.price}
                  owned={refill.owned}
                  trigger="리필하기"
                  className="cp-action h-6 px-2 rounded-pill bg-brand text-white text-[11px] font-bold"
                  onDone={() => loadMe(false)}
                />
              )}
            </div>
            {/* 잔여 게이지 — 100%에서 시작해 사용할수록 줄어든다 (홈과 동일 구조).
                리필 구매 시 표시 사용량이 차감되어 다시 차오른다 (누적 한도 비노출) */}
            <div className="mt-2.5 h-2 rounded-pill bg-canvas overflow-hidden">
              <div
                className="h-full rounded-pill bg-brand"
                style={{
                  width:
                    baseLimit === null
                      ? "0%"
                      : `${Math.max(0, Math.round(((baseLimit - shownUsed) / Math.max(baseLimit, 1)) * 100))}%`,
                }}
              />
            </div>
            {/* [확정 정책 8-3] 등급 우선 모집(부스팅) 표기는 도입하지 않는다 — 전 플랜 균등 배분 */}
            <div className="mt-3 text-[13px] font-bold text-ink">{plan} 플랜 이용중 · 등급 배분 자동</div>
            <p className="mt-1 text-[12px] text-muted leading-[1.5]">
              총 모집 인원만 입력하시면 시스템이 전 등급에 자동 배분해요.
              {remaining !== null && (
                <>
                  {" "}이번 달 잔여 <span className="text-ink font-medium">{remaining}팀</span>
                  {overLimit && <span className="text-error"> — 입력값이 한도를 초과합니다</span>}
                  {" · "}
                  <Link href="/o/membership" className="text-brand font-medium">멤버십 업그레이드</Link>로 한도를 늘릴 수 있어요.
                </>
              )}
            </p>
          </div>

          {/* 한도 소진 업셀 (2026-07-31 BM 전략안 §6) — 추천 = 업그레이드(Free·Basic·Standard),
              리필권 = 보조(Basic·Standard)/메인(Premium). Free는 리필 미판매. */}
          {remaining !== null && remaining <= 0 && refill && (
            <div className="mt-3 space-y-2">
              <p className="text-[13px] font-semibold text-ink">
                이번 달 {plan === "Free" ? "무료 " : ""}모집 한도 {baseLimit}건을 모두 사용했어요.
              </p>
              {NEXT_PLAN[plan] &&
                (() => {
                  const next = NEXT_PLAN[plan]!;
                  const diff = PLAN_PRICE[next] - PLAN_PRICE[plan];
                  const nextLimit = PLAN_POLICY[next].monthlyTeamLimit;
                  const gain = nextLimit - PLAN_POLICY[plan].monthlyTeamLimit;
                  return (
                    <div className="rounded-md border-[1.5px] border-brand bg-canvas p-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded-xs bg-brand text-white text-[10px] font-bold">추천</span>
                        <span className="text-[14px] font-bold text-ink">{next}로 업그레이드</span>
                      </div>
                      <p className="mt-1 text-[12px] text-ink2 leading-[1.5]">
                        {plan === "Free"
                          ? `월 ${PLAN_PRICE[next].toLocaleString()}원으로 매월 ${nextLimit}건 모집할 수 있어요.`
                          : plan === "Standard"
                            ? `월 ${diff.toLocaleString()}원만 추가하면 매월 ${nextLimit}건을 모집할 수 있어요.`
                            : `월 ${diff.toLocaleString()}원만 추가하면 이번 달 ${gain}건을 더 모집할 수 있어요.`}
                      </p>
                      <Link
                        href="/o/membership"
                        className="cp-action mt-2.5 block w-full h-10 rounded-md bg-brand text-white text-[13px] font-bold text-center leading-10"
                      >
                        {plan === "Free" ? "Basic 시작하기" : `${next}로 업그레이드`}
                      </Link>
                    </div>
                  );
                })()}
              {plan !== "Free" && (
                <div className={`rounded-md bg-canvas p-3.5 ${plan === "Premium" ? "border-[1.5px] border-brand" : "border border-hairline"}`}>
                  <div className="text-[14px] font-bold text-ink">이번 달만 {refill.grant}건 추가</div>
                  <p className="mt-1 text-[12px] text-ink2 leading-[1.5]">
                    모집 한도 리필권 <span className="font-bold text-ink">{refill.price.toLocaleString()}원</span> — 현재
                    멤버십의 월 모집 한도를 한 번 더 충전할 수 있어요.
                  </p>
                  <RefillFlow
                    plan={plan}
                    grant={refill.grant}
                    price={refill.price}
                    owned={refill.owned}
                    trigger={`${refill.grant}건 리필하기`}
                    className={`cp-action mt-2.5 w-full h-10 rounded-md text-[13px] font-bold ${
                      plan === "Premium" ? "bg-brand text-white" : "border border-hairline bg-canvas text-ink"
                    }`}
                    onDone={() => loadMe(false)}
                  />
                  {plan === "Standard" && (
                    <p className="mt-2 text-[11px] text-muted">리필권과 100원 차이로 매월 100건을 이용할 수 있어요.</p>
                  )}
                  {plan === "Premium" && (
                    <p className="mt-2 text-[11px] text-muted leading-[1.5]">추가 한도는 다음 결제일 전까지 사용할 수 있어요.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* 캠페인 유형 — 방문형 | 배송형 (기자단은 릴리스 미제공) */}
        <section>
          <div className="text-[15px] font-bold text-ink mb-2">캠페인 유형</div>
          <div className="flex gap-2">
            {(
              [
                { key: "visit" as const, label: "방문형" },
                ...(DELIVERY_ENABLED ? [{ key: "delivery" as const, label: "배송형" }] : []),
              ]
            ).map((k) => {
              const active = kind === k.key;
              return (
                <button
                  key={k.key}
                  type="button"
                  onClick={() => {
                    setKind(k.key);
                    if (k.key === "delivery") setReservationRequired(false);
                  }}
                  aria-pressed={active}
                  className={`h-11 px-5 rounded-md text-[14px] bg-canvas ${
                    active ? "border-[1.5px] border-brand text-brand font-bold" : "border border-hairline text-ink font-medium"
                  }`}
                >
                  {k.label}
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
        </section>

        {/* 캠페인 방식 — 바로 방문 | 예약 필수 (방문형 전용, 시안 2카드) */}
        {!isDelivery && (
          <section>
            <div className="text-[15px] font-bold text-ink mb-2">캠페인 방식</div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { reserve: false, label: "🏠 바로 방문", desc: "예약 없이 방문 · 결제 시 바로 할인" },
                  { reserve: true, label: "📅 예약 필수", desc: "방문 일시 신청 후 사장님 확정 필요" },
                ]
              ).map((k) => {
                const active = reservationRequired === k.reserve;
                return (
                  <button
                    key={String(k.reserve)}
                    type="button"
                    onClick={() => setReservationRequired(k.reserve)}
                    aria-pressed={active}
                    className={`rounded-md px-3 py-3.5 text-left bg-canvas ${
                      active ? "border-[1.5px] border-brand" : "border border-hairline"
                    }`}
                  >
                    <div className={`text-[14px] font-bold ${active ? "text-brand" : "text-ink"}`}>{k.label}</div>
                    <div className="mt-0.5 text-[11px] text-muted leading-[1.4]">{k.desc}</div>
                  </button>
                );
              })}
            </div>
            {reservationRequired && (
              <p className="mt-2 text-[12px] text-muted leading-[1.5]">
                예약형은 체험자가 희망 방문 일시를 선택해 신청하고, <span className="text-ink font-medium">사장님이 확정해야 QR 체험권이 열려요</span>.
              </p>
            )}
          </section>
        )}

        {/* 배송형 — 상품 카테고리 (필수). 플레이스 분류(카페·식당)가 아닌 상품군 분류 */}
        {isDelivery && (
          <section>
            <div className="text-[15px] font-bold text-ink mb-2">상품 카테고리 (필수)</div>
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
            <div className="text-[15px] font-bold text-ink mb-2">
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
            <div className="text-[15px] font-bold text-ink mb-2">
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

        {/* 진행 일수 — 시안 칩 7/14/30 + 마감일 안내 (종료 = 생성일 기준 n일차 자정 KST 직전) */}
        <section>
          <div className="text-[15px] font-bold text-ink mb-2">진행 일수</div>
          <div className="flex gap-2">
            {DAY_CHOICES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                aria-pressed={days === d}
                className={`h-11 px-5 rounded-md text-[14px] bg-canvas tabular-nums ${
                  days === d ? "border-[1.5px] border-brand text-brand font-bold" : "border border-hairline text-ink font-medium"
                }`}
              >
                {d}일
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] font-medium text-successStrong">캠페인 마감일은 {deadlineLabel} 입니다.</p>
        </section>

        {/* 매장·상품 사진 (2026-07-17 회의) — 대표 이미지 + 추가 사진, 3~20장 필수 */}
        <section>
          <div className="text-[15px] font-bold text-ink mb-2">매장·상품 사진 (3~20장)</div>
          <div className="flex flex-wrap gap-2">
            {photos.length < 20 && (
              <label className="w-[84px] h-[84px] rounded-md border border-dashed border-hairline flex flex-col items-center justify-center gap-1 text-muted cursor-pointer">
                <Icon name="camera" variant="border" size={20} />
                <span className="text-[12px] tabular-nums">{photos.length} / 20</span>
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
              </label>
            )}
            {photos.map((src, i) => (
              <div key={i} className="relative w-[84px] h-[84px] rounded-md overflow-hidden bg-sunken border border-hairline">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`사진 ${i + 1}`} className="w-full h-full object-cover" />
                {i === 0 && (
                  <span className="absolute inset-x-0 bottom-0 py-0.5 bg-ink/70 text-white text-[10px] font-semibold text-center">
                    대표사진
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
          </div>
          {photos.length < 3 && <p className="mt-2 text-[12px] text-error">최소 3장의 이미지를 넣어주세요.</p>}
          {photoErr && <p className="mt-1 text-[12px] text-error">{photoErr}</p>}
          <p className="mt-2 text-[11px] text-muted leading-[1.5]">
            첫 장이 대표사진이에요 — 체험자 탐색 카드와 상세 화면에 캐러셀로 노출됩니다.
          </p>
        </section>

        {/* SNS 채널 + 채널별 리뷰 작성 조건 (시안) */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[15px] font-bold text-ink">
              SNS 채널 <span className="text-[12px] text-muted font-normal">(다중 선택 가능)</span>
            </span>
            <button type="button" onClick={() => setCondOpen((v) => !v)} className="cp-action text-[12px] font-semibold text-brand">
              채널별 리뷰 작성 조건 →
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => toggleChannel(c.key)}
                className={`h-10 px-4 rounded-pill text-[14px] bg-canvas ${channels.includes(c.key) ? "border-[1.5px] border-brand text-brand font-semibold" : "border border-hairline text-ink font-medium"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {condOpen && (
            <div className="mt-3 rounded-md border border-hairline p-3.5 space-y-3">
              {CHANNELS.map((c) => (
                <div key={c.key}>
                  <div className="text-[12px] font-bold text-ink">{CHANNEL_LABEL[c.key]}</div>
                  <ul className="mt-1 space-y-0.5">
                    {CHANNEL_REVIEW_CONDITIONS[c.key].map((cond) => (
                      <li key={cond.key} className="text-[12px] text-ink2">· {cond.label}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 필수 주문 메뉴 — 방문형 전용 (시안 카드형 · 선택 입력 · 최대 5개) */}
        {!isDelivery && (
        <section>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[15px] font-bold text-ink">필수 주문 메뉴</span>
            <span className="px-1.5 py-0.5 rounded-xs bg-sunken text-[11px] font-medium text-muted">선택</span>
          </div>
          <p className="text-[12px] text-muted mb-3 leading-[1.5]">
            체험자는 등록한 메뉴 중 1개를 필수로 주문해야 지원금을 받을 수 있어요. 최대 5개까지 등록 가능해요.
          </p>
          <div className="space-y-2">
            {menus.map((m, i) => (
              <div key={i} className="rounded-md bg-brandSoft p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-brand">메뉴 {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeMenuAt(i)}
                    aria-label={`메뉴 ${i + 1} 삭제`}
                    className="cp-action w-6 h-6 rounded-full grid place-items-center text-muted"
                  >
                    <Icon name="x" variant="border" size={13} />
                  </button>
                </div>
                <input
                  value={m.name}
                  onChange={(e) => setMenuNameAt(i, e.target.value)}
                  placeholder={i === 0 ? "예: 트러플 파스타" : "메뉴명"}
                  className="mt-2 w-full h-11 px-3.5 rounded-md border border-hairline bg-canvas focus:border-brand focus:outline-none text-[14px]"
                />
                <div className="mt-2 h-11 px-3.5 rounded-md border border-hairline bg-canvas flex items-center gap-2">
                  <span className="text-[13px] text-muted shrink-0">메뉴 금액</span>
                  <input
                    value={m.price}
                    onChange={(e) => setMenuPriceAt(i, e.target.value)}
                    placeholder="0"
                    inputMode="numeric"
                    className="flex-1 min-w-0 text-right text-[14px] font-semibold tabular-nums focus:outline-none bg-transparent"
                  />
                  <span className="text-[13px] text-muted shrink-0">원</span>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addMenu}
            disabled={menus.length >= 5}
            className="cp-action mt-2 w-full h-11 rounded-md border border-brand text-[14px] font-semibold text-brand inline-flex items-center justify-center gap-1.5 disabled:border-hairline disabled:text-mutedSoft"
          >
            <Icon name="plus" variant="bold" size={14} />
            <span>{menus.length >= 5 ? "최대 5개까지 등록할 수 있어요" : "메뉴 추가"}</span>
          </button>
        </section>
        )}

        {/* 필수 키워드 — 리뷰 강조 키워드 (체험자 매장 상세 노출) */}
        <section>
          <div className="text-[15px] font-bold text-ink mb-2">필수 키워드 (최대 5개)</div>
          <p className="text-[12px] text-muted mb-2 leading-[1.5]">키워드 입력 시 쉼표(,)로 구분해 입력하세요.</p>
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

        {/* 매장소개 (최대 500자) */}
        <section>
          <div className="text-[15px] font-bold text-ink mb-2">매장소개</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            rows={6}
            maxLength={500}
            placeholder="매장과 체험에 대해 체험자에게 안내할 내용을 입력하세요."
            className="w-full px-4 py-3 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px] leading-[1.5]"
          />
          <div className="mt-1 text-right text-[11px] text-muted tabular-nums">{description.length} / 500</div>
        </section>

        {/* 지원금 (방문형) / 제공 상품 정가 (배송형) — ⓘ 토글 안내 */}
        <section>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[15px] font-bold text-ink">{isDelivery ? "제공 상품 정가" : "지원금"}</span>
            <button
              type="button"
              onClick={() => setSupportInfoOpen((v) => !v)}
              aria-label="지원금 안내"
              className="cp-action w-5 h-5 rounded-full border border-hairline text-[11px] text-muted leading-none"
            >
              i
            </button>
          </div>
          <input
            value={supportAmount}
            onChange={(e) => setSupportAmount(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="예: 50000"
            className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px]"
          />
          {/* 배송형은 인라인 안내, 방문형 지원금은 등급별 지원금 바텀시트 (2026-07-31 시안) */}
          {supportInfoOpen && isDelivery && (
            <p className="mt-2 text-[12px] text-muted leading-[1.5]">
              발송하는 체험 상품의 정가입니다. 체험자 화면에 <span className="text-ink font-medium">제공 상품 가치</span>로 노출돼요.
            </p>
          )}
        </section>

        {/* 매장 확인 번호 (숫자 4자리) — 방문형 필수 (배송형은 사용 처리 개념이 없어 자동 생성) */}
        {!isDelivery && (
        <section>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[15px] font-bold text-ink">매장 확인 번호 (숫자 4자리)</span>
            <button
              type="button"
              onClick={() => setCodeInfoOpen((v) => !v)}
              aria-label="매장 확인 번호 안내"
              className="cp-action w-5 h-5 rounded-full border border-hairline text-[11px] text-muted leading-none"
            >
              i
            </button>
          </div>
          <input
            value={useCode}
            onChange={(e) => setUseCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder="예: 1234"
            maxLength={4}
            className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[18px] font-semibold tracking-[0.4em] text-center"
          />
          {codeInfoOpen && (
            <p className="mt-2 text-[12px] text-muted leading-[1.5]">
              체험자 화면에는 노출되지 않아요. 체험자가 제시한 체험권 화면에 사장님이 이 4자리를 직접 입력하거나, QR을 스캔하면 사용 처리됩니다.
            </p>
          )}
        </section>
        )}

        {/* [필수] 매장 등록 및 캠페인 운영 권한 확인 (2026-07-28 — 카피 원문) */}
        <section className="rounded-md border border-hairline p-4">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={authorityConfirmed}
              onChange={(e) => setAuthorityConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#9333EA] shrink-0"
            />
            <span className="text-[13px] font-bold text-ink leading-[1.5]">[필수] 매장 등록 및 캠페인 운영 권한 확인</span>
          </label>
          <p className="mt-2 pl-[26px] text-[12px] text-ink2 leading-[1.6]">
            · 매장 소유자·운영자 또는 적법한 위임을 받은 관리 대행사만 해당 매장의 체험단 캠페인을 생성할 수 있습니다.
          </p>
          <p className="mt-1.5 pl-[26px] text-[12px] text-muted leading-[1.6]">
            · 권한 없이 타인의 매장을 대상으로 캠페인을 생성하거나 허위 정보를 등록하여 매장 운영에 피해를 주는 경우, 캠페인
            중단 및 서비스 이용 제한 조치가 적용될 수 있으며 업무방해 등 관련 법령에 따라 민·형사상 책임이 발생할 수
            있습니다.
          </p>
        </section>

        {err && <div className="text-error text-[13px]">{err}</div>}
        <button
          disabled={
            busy || !storeId || overLimit || totalQuotaNum <= 0 || supportNum <= 0 || photos.length < 3 ||
            (!isDelivery && useCode.length !== 4) || (isDelivery && !productCategory) || !authorityConfirmed
          }
          type="submit"
          className="w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
        >
          {busy
            ? "등록 중..."
            : overLimit
              ? "월 한도 초과"
              : totalQuotaNum <= 0
                ? "총 모집 인원 입력"
                : supportNum <= 0
                  ? isDelivery ? "제공 상품 정가 입력" : "지원금 입력"
                  : !isDelivery && useCode.length !== 4
                    ? "매장 확인 번호 4자리 입력"
                    : isDelivery && !productCategory
                      ? "상품 카테고리 선택"
                      : photos.length < 3
                        ? "사진 3장 이상 등록"
                        : !authorityConfirmed
                          ? "권한 확인 동의 필요"
                          : "등록하기"}
        </button>
      </form>

      {/* 등급별 지원금 바텀시트 (2026-07-31 시안) — 지원금 ⓘ 클릭. 배율 정본 = grade.ts SUPPORT_MULTIPLIER [P1] */}
      {supportInfoOpen && !isDelivery && (
        <div className="fixed inset-0 bg-ink/45 z-50 flex items-end" onClick={() => setSupportInfoOpen(false)}>
          <div className="w-full max-h-[85dvh] overflow-y-auto rounded-t-xl bg-canvas p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-bold text-ink tracking-title">등급별 지원금</h3>
              <button
                type="button"
                onClick={() => setSupportInfoOpen(false)}
                aria-label="닫기"
                className="cp-action w-9 h-9 -mr-2 rounded-full grid place-items-center text-ink"
              >
                <Icon name="x" variant="border" size={18} />
              </button>
            </div>
            <p className="mt-3 text-[13px] text-ink2 leading-[1.6]">
              체험자 등급에 따라 지원금이 차등 지급돼요.
              <br />
              입력한 금액은 S등급 기준이며, 나머지 등급은 아래 비율로 자동 계산돼요.
            </p>
            {(() => {
              const base = supportNum > 0 ? supportNum : 10000;
              return (
                <div className="mt-4 rounded-lg bg-sunken p-4">
                  <div className="text-[14px] font-bold text-ink">예시) 지원금이 {base.toLocaleString()}원인 경우</div>
                  <div className="mt-2">
                    {GRADE_ROWS.map(({ grade, label }) => (
                      <div key={grade} className="py-2 flex items-center gap-2.5">
                        <span className="text-[14px] font-bold text-brand w-12">{label}</span>
                        <span className="text-[13px] text-ink2 tabular-nums">{Math.round(SUPPORT_MULTIPLIER[grade] * 100)}%</span>
                        <span className="ml-auto text-[15px] font-bold text-ink tabular-nums">
                          {supportForGrade(base, grade).toLocaleString()}원
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            <p className="mt-3 text-[12px] text-muted leading-[1.5]">
              지원금은 체험자 결제 시 <span className="text-ink font-medium">매장에서 직접 제공하는 할인</span>입니다 (별도 정산 없음).
            </p>
          </div>
        </div>
      )}

      {/* 이탈 확인 모달 (시안) — 입력이 있으면 뒤로가기 시 확인. [나가기]로만 이탈 (임시 매장·입력 휘발) */}
      {leaveOpen && (
        <div className="fixed inset-0 bg-ink/45 z-50 grid place-items-center px-6">
          <div className="w-full rounded-xl bg-canvas p-5">
            <h3 className="text-center text-[17px] font-bold text-ink tracking-title">작성 중인 정보가 저장되지 않습니다</h3>
            <p className="mt-2.5 text-center text-[13px] text-ink2 leading-[1.6]">
              지금 나가면 입력한 정보 모두 사라져요.
              <br />
              처음부터 다시 등록해야해요.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => router.push("/o/home")}
                className="cp-action flex-1 h-12 rounded-md bg-sunken text-[15px] font-semibold text-ink"
              >
                나가기
              </button>
              <button
                type="button"
                onClick={() => setLeaveOpen(false)}
                className="cp-action flex-[1.4] h-12 rounded-md bg-brand text-white text-[15px] font-bold"
              >
                계속 작성하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
