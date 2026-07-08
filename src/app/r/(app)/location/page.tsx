import RegionPicker from "./RegionPicker";

export const dynamic = "force-dynamic";

// 현위치 설정 (R-13, 2026-07-08) — 홈 상단 지역 드롭다운에서 페이지 전환으로 진입.
// 1차: 도·특별시·광역시(좌측 레일) → 2차: 일반 시·군·구 리스트(우측).
// 선택 시 /r/home?area= 로 복귀해 '걸어서 갈 수 있어요'가 해당 지역 기준으로 바뀐다.
export default async function LocationSetting({
  searchParams,
}: {
  searchParams: Promise<{ current?: string }>;
}) {
  const { current } = await searchParams;
  return <RegionPicker current={current} />;
}
