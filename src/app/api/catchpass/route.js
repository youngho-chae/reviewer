import {
  getState,
  mutateState,
  resetState
} from "@/lib/catchpass-store.mjs";
import { summarizeState } from "@/lib/catchpass-core.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "no-store"
};

function json(payload, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  const state = await getState();
  return json({ state, summary: summarizeState(state) });
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (body?.action === "resetDemo") {
      const state = await resetState();
      return json({ state, summary: summarizeState(state) });
    }

    const state = await mutateState(body?.action, body?.payload ?? {});
    return json({ state, summary: summarizeState(state) });
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "요청을 처리하지 못했습니다."
      },
      400
    );
  }
}
