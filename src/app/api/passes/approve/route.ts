import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// 사장님은 더 이상 직접 리뷰를 검수하지 않는다.
// 운영팀이 채널톡 문의 + 표본 검수를 거쳐 직접 처리하므로
// 본 엔드포인트는 비활성화(410 Gone).
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      error:
        "사장님 직접 검수는 더 이상 지원되지 않습니다. 문제가 있는 후기는 채널톡으로 운영팀에 문의해주세요.",
    },
    { status: 410 },
  );
}
