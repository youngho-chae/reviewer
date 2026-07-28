// 브라우저 렌더 크롤 (2026-07-28 QA — 인스타그램 소개글 검증 최후 수단).
//
// 인스타그램은 서버 fetch에는 로그인 벽/429를 돌려주지만, 실제 브라우저로 열면
// 가입/로그인 안내 모달 **뒤에** 프로필(소개글 포함)이 렌더된다 — 모달 상단 X를
// 누르면 비로그인 상태로도 bio가 보인다(실측). 이를 headless Chromium으로 재현:
// 프로필 페이지 로드 → 렌더 대기 → (필요 시) 로그인 모달 닫기 → DOM에서 코드 검출.
//
// 실행 환경:
//  - Vercel(serverless): @sparticuz/chromium 바이너리 + playwright-core
//  - 로컬/샌드박스: PW_CHROMIUM_PATH 또는 PLAYWRIGHT_BROWSERS_PATH의 chromium
// 무거운 층이므로 crawlBioHasCode에서 가벼운 층(JSON API·HTML)이 모두 실패한 뒤에만 호출.

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// 로그인 안내 모달 닫기(X) 버튼 후보 — 첫 항목은 실측 class(2026-07-28 QA 제공),
// 인스타 class는 난독화라 언제든 바뀔 수 있어 aria-label 폴백을 함께 둔다.
const CLOSE_SELECTORS = [
  "div.xdg88n9.x10l6tqk.x1tk7jg1.x1vjfegm",
  '[aria-label="Close"]',
  '[aria-label="닫기"]',
  'svg[aria-label="Close"]',
  'svg[aria-label="닫기"]',
];

export interface BrowserCrawlResult {
  found: boolean;
  note: string; // trace용 한 줄 진단
}

// 프로필 URL을 브라우저로 렌더해 코드 포함 여부 확인. 실행 불가(바이너리 없음 등)는 null.
export async function crawlBioViaBrowser(url: string, code: string): Promise<BrowserCrawlResult | null> {
  let browser: import("playwright-core").Browser | null = null;
  try {
    const { chromium } = await import("playwright-core");
    if (process.env.VERCEL) {
      const sparticuz = (await import("@sparticuz/chromium")).default;
      browser = await chromium.launch({
        args: sparticuz.args,
        executablePath: await sparticuz.executablePath(),
        headless: true,
      });
    } else {
      const local =
        process.env.PW_CHROMIUM_PATH ||
        (process.env.PLAYWRIGHT_BROWSERS_PATH ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium` : undefined);
      browser = await chromium.launch({ executablePath: local, headless: true });
    }

    const page = await browser.newPage({
      userAgent: DESKTOP_UA,
      viewport: { width: 1280, height: 900 },
      locale: "ko-KR",
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForTimeout(2_000); // 클라이언트 렌더(프로필 데이터 fetch) 대기

    const hasCode = async () => {
      const html = await page.content();
      if (html.includes(code)) return true;
      const text = await page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
      return text.includes(code);
    };
    if (await hasCode()) return { found: true, note: "코드 검출" };

    // 가입/로그인 안내 모달 닫기 — X 클릭 후 재검사
    let closed = false;
    for (const sel of CLOSE_SELECTORS) {
      const clicked = await page
        .click(sel, { timeout: 800 })
        .then(() => true)
        .catch(() => false);
      if (clicked) {
        closed = true;
        break;
      }
    }
    if (closed) {
      await page.waitForTimeout(1_200);
      if (await hasCode()) return { found: true, note: "모달 닫기 후 코드 검출" };
    }
    return { found: false, note: `렌더 완료(모달 ${closed ? "닫음" : "없음/닫기 실패"}) — 코드 미검출` };
  } catch (e) {
    console.log(`[sns-bio] 브라우저 크롤 실패: ${e instanceof Error ? e.message.slice(0, 200) : "unknown"}`);
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}
