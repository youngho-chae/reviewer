import { useEffect, useState } from "react";
import { store, subscribe } from "../store/mockStore";

/**
 * 단일 훅 — store 어떤 변경이든 리렌더.
 * 컴포넌트는 직접 store.* 메서드를 호출해서 값을 가져온다.
 */
export function useStore() {
  const [, setTick] = useState(0);
  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);
  return store;
}
