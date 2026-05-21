import {
  approveApplication,
  applyCampaign,
  completeApplication,
  createCampaign,
  createInitialState
} from "./catchpass-core.mjs";

const globalKey = "__catchpass_virtual_server_state__";

export async function getState() {
  if (!globalThis[globalKey]) {
    globalThis[globalKey] = createInitialState();
  }
  return globalThis[globalKey];
}

export async function resetState() {
  globalThis[globalKey] = createInitialState();
  return globalThis[globalKey];
}

export async function mutateState(action, payload) {
  const current = await getState();
  let next;
  switch (action) {
    case "createCampaign":
      next = createCampaign(current, payload);
      break;
    case "applyCampaign":
      next = applyCampaign(current, payload);
      break;
    case "completeApplication":
      next = completeApplication(current, payload);
      break;
    case "approveApplication":
      next = approveApplication(current, payload);
      break;
    default:
      throw new Error("지원하지 않는 작업입니다.");
  }

  globalThis[globalKey] = next;
  return next;
}
