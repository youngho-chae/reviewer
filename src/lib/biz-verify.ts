// 사업자등록번호 진위확인 (2026-08-18 — 즉시 승인 플로우)
// 정본: 공공데이터포털 국세청 「사업자등록정보 진위확인 및 상태조회」 상태조회 API.
//   POST {NTS_API_BASE}/status?serviceKey={NTS_API_KEY}  body { b_no: ["10자리"] }
//   → data[0].b_stt(계속/휴업/폐업)·tax_type("…등록되지 않은 사업자등록번호…" = 미존재)
// 존재하는 번호면 유효로 판정한다 (요구 스펙 — 관리자 승인 없이 즉시 verified).
// ⚠ 국세청 API는 응답에 상호(사업자명)를 포함하지 않는다 — bizName은 데모/스텁 모드에서만
//   제공되며, 실키 모드에서 미제공 시 클라이언트가 사업장명 입력을 활성화(수동 보완)한다.
// 키 미설정 시 데모 폴백 (KFTC·SOLAPI·OAuth와 동일 관례): 형식 유효(10자리)면 존재로 간주.

const NTS_API_BASE = process.env.NTS_API_BASE || "https://api.odcloud.kr/api/nts-businessman/v1";

export function ntsConfigured(): boolean {
  return !!process.env.NTS_API_KEY;
}

export interface BizVerifyResult {
  valid: boolean;
  statusLabel: string; // "계속사업자" 등 — 미존재면 사유
  bizName?: string; // 상호 — 실 국세청 API 미제공 (데모/스텁 전용)
  demo?: boolean; // 키 미설정 데모 판정
}

export async function verifyBizNumber(bizNumber: string): Promise<BizVerifyResult> {
  const b = String(bizNumber || "").replace(/\D/g, "");
  if (b.length !== 10) return { valid: false, statusLabel: "사업자등록번호 10자리를 입력해주세요" };

  if (!ntsConfigured()) {
    // 데모 모드 — 실조회 없음 (화면에 데모 배너 노출). QA용 규칙: 끝자리 0은 미존재로 취급해
    // 실패 경로도 검증할 수 있게 한다.
    if (b.endsWith("0")) {
      return { valid: false, statusLabel: "국세청에 등록되지 않은 사업자등록번호예요", demo: true };
    }
    return { valid: true, statusLabel: "계속사업자", bizName: `데모상호 ${b.slice(6)}`, demo: true };
  }

  const url = `${NTS_API_BASE}/status?serviceKey=${encodeURIComponent(process.env.NTS_API_KEY!)}&returnType=JSON`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ b_no: [b] }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`진위확인 API 오류 (HTTP ${res.status})`);
  }
  const j = (await res.json()) as { data?: Array<{ b_no: string; b_stt?: string; b_stt_cd?: string; tax_type?: string; company?: string }> };
  const row = j.data?.[0];
  if (!row) throw new Error("진위확인 응답이 비어 있어요");
  const notFound = (row.tax_type || "").includes("등록되지 않은");
  if (notFound) return { valid: false, statusLabel: "국세청에 등록되지 않은 사업자등록번호예요" };
  return {
    valid: true,
    statusLabel: row.b_stt || "등록된 사업자",
    // 표준 응답엔 상호가 없다 — 확장 응답(company)이 있으면 사용
    ...(row.company ? { bizName: row.company } : {}),
  };
}
