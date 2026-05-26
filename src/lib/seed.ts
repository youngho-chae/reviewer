// Backwards-compat wrapper — seed로직은 seed-runner.ts에 있음.
// db.ts가 lazy require로 직접 부르므로 layout.tsx에서 호출할 필요 없지만,
// 명시적 호출 경로도 유지.
import { getDB } from "./db";

export function ensureSeed() {
  // getDB()가 호출되면 내부적으로 runSeed가 트리거되므로 사실상 no-op
  void getDB();
}
