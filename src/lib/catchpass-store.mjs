import {
  approveApplication,
  applyCampaign,
  completeApplication,
  createCampaign,
  createInitialState,
  markPassUsed,
  normalizeState
} from "./catchpass-core.mjs";

const globalKey = "__catchpass_virtual_server_state__";
const blobUrl = process.env.CATCHPASS_BLOB_URL || "";

async function readRemoteState() {
  if (!blobUrl) return null;
  const response = await fetch(blobUrl, {
    cache: "no-store",
    headers: { accept: "application/json" }
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("가상 서버 상태를 불러오지 못했습니다.");
  }
  return response.json();
}

async function writeRemoteState(state) {
  if (!blobUrl) return;
  const response = await fetch(blobUrl, {
    method: "PUT",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify(state)
  });
  if (!response.ok) {
    throw new Error("가상 서버 상태를 저장하지 못했습니다.");
  }
}

function hasStateChanged(previous, next) {
  return JSON.stringify(previous) !== JSON.stringify(next);
}

export async function getState() {
  if (blobUrl) {
    const remoteState = await readRemoteState();
    if (remoteState) {
      const normalized = normalizeState(remoteState);
      globalThis[globalKey] = normalized;
      if (hasStateChanged(remoteState, normalized)) {
        await writeRemoteState(normalized);
      }
      return normalized;
    }
  }

  if (!globalThis[globalKey]) {
    globalThis[globalKey] = createInitialState();
    await writeRemoteState(globalThis[globalKey]);
  }
  globalThis[globalKey] = normalizeState(globalThis[globalKey]);
  return globalThis[globalKey];
}

export async function resetState() {
  globalThis[globalKey] = createInitialState();
  await writeRemoteState(globalThis[globalKey]);
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
    case "markPassUsed":
      next = markPassUsed(current, payload);
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
  await writeRemoteState(next);
  return next;
}
