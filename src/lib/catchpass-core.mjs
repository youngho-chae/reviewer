const gradeOrder = ["S", "A", "B", "C", "N"];
const campaignTypes = new Set(["visit", "press"]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}

function cleanText(value, fallback) {
  const next = String(value ?? "").trim();
  return next || fallback;
}

export function createInitialState(now = new Date().toISOString()) {
  return {
    version: 1,
    updatedAt: now,
    campaigns: [
      {
        id: "camp_visit_001",
        title: "연남 시그니처 디너",
        store: "정식당 북촌",
        type: "visit",
        minGrade: "B",
        reward: 42000,
        capacity: 6,
        slotsLeft: 4,
        status: "open",
        channels: ["blog", "instagram"],
        createdAt: now
      },
      {
        id: "camp_press_001",
        title: "한남 디저트 신메뉴 기사형",
        store: "오르빛 카페",
        type: "press",
        minGrade: "A",
        reward: 65000,
        capacity: 3,
        slotsLeft: 2,
        status: "open",
        channels: ["blog"],
        createdAt: now
      }
    ],
    applications: [
      {
        id: "app_seed_001",
        campaignId: "camp_visit_001",
        reviewerName: "리뷰어 1242",
        reviewerGrade: "A",
        status: "completed",
        reviewUrl: "https://blog.example.com/catchpass-dinner",
        appliedAt: now,
        completedAt: now
      }
    ],
    activities: [
      {
        id: "act_seed_001",
        at: now,
        actor: "reviewer",
        title: "리뷰어 1242가 연남 시그니처 디너를 완료했습니다.",
        tone: "success"
      }
    ]
  };
}

export function createCampaign(state, payload = {}) {
  const next = clone(state);
  const now = new Date().toISOString();
  const minGrade = gradeOrder.includes(payload.minGrade)
    ? payload.minGrade
    : "B";
  const type = campaignTypes.has(payload.type) ? payload.type : "visit";
  const capacity = toNumber(payload.capacity, 5);

  const campaign = {
    id: makeId("camp"),
    title: cleanText(payload.title, "새 캠페인"),
    store: cleanText(payload.store, "캐치패스 매장"),
    type,
    minGrade,
    reward: toNumber(payload.reward, type === "press" ? 70000 : 35000),
    capacity,
    slotsLeft: capacity,
    status: "open",
    channels: Array.isArray(payload.channels) && payload.channels.length
      ? payload.channels
      : ["blog"],
    createdAt: now
  };

  next.campaigns.unshift(campaign);
  next.activities.unshift({
    id: makeId("act"),
    at: now,
    actor: "owner",
    title: `${campaign.store} 캠페인이 생성되었습니다.`,
    tone: "info"
  });
  next.updatedAt = now;
  return next;
}

export function applyCampaign(state, payload = {}) {
  const next = clone(state);
  const now = new Date().toISOString();
  const campaign = next.campaigns.find((item) => item.id === payload.campaignId);
  if (!campaign) {
    throw new Error("캠페인을 찾을 수 없습니다.");
  }
  if (campaign.status !== "open" || campaign.slotsLeft <= 0) {
    throw new Error("모집이 마감된 캠페인입니다.");
  }

  const reviewerName = cleanText(payload.reviewerName, "리뷰어 1242");
  const alreadyApplied = next.applications.some(
    (item) =>
      item.campaignId === campaign.id && item.reviewerName === reviewerName
  );
  if (alreadyApplied) {
    return next;
  }

  const application = {
    id: makeId("app"),
    campaignId: campaign.id,
    reviewerName,
    reviewerGrade: gradeOrder.includes(payload.reviewerGrade)
      ? payload.reviewerGrade
      : "A",
    status: "applied",
    reviewUrl: "",
    appliedAt: now,
    completedAt: null
  };

  campaign.slotsLeft = Math.max(0, campaign.slotsLeft - 1);
  next.applications.unshift(application);
  next.activities.unshift({
    id: makeId("act"),
    at: now,
    actor: "reviewer",
    title: `${reviewerName}가 ${campaign.title}에 신청했습니다.`,
    tone: "info"
  });
  next.updatedAt = now;
  return next;
}

export function completeApplication(state, payload = {}) {
  const next = clone(state);
  const now = new Date().toISOString();
  const application = next.applications.find(
    (item) => item.id === payload.applicationId
  );
  if (!application) {
    throw new Error("신청 내역을 찾을 수 없습니다.");
  }
  const campaign = next.campaigns.find(
    (item) => item.id === application.campaignId
  );
  application.status = "completed";
  application.reviewUrl = cleanText(
    payload.reviewUrl,
    "https://blog.example.com/catchpass-review"
  );
  application.completedAt = now;
  next.activities.unshift({
    id: makeId("act"),
    at: now,
    actor: "reviewer",
    title: `${application.reviewerName}가 ${
      campaign?.title ?? "캠페인"
    } 완료를 제출했습니다.`,
    tone: "success"
  });
  next.updatedAt = now;
  return next;
}

export function approveApplication(state, payload = {}) {
  const next = clone(state);
  const now = new Date().toISOString();
  const application = next.applications.find(
    (item) => item.id === payload.applicationId
  );
  if (!application) {
    throw new Error("신청 내역을 찾을 수 없습니다.");
  }
  const campaign = next.campaigns.find(
    (item) => item.id === application.campaignId
  );
  application.status = "approved";
  application.approvedAt = now;
  next.activities.unshift({
    id: makeId("act"),
    at: now,
    actor: "owner",
    title: `${campaign?.title ?? "캠페인"} 완료 내역을 확인했습니다.`,
    tone: "success"
  });
  next.updatedAt = now;
  return next;
}

export function summarizeState(state) {
  const activeCampaigns = state.campaigns.filter(
    (campaign) => campaign.status === "open"
  );
  const completedApplications = state.applications.filter(
    (application) => application.status === "completed"
  );
  const approvedApplications = state.applications.filter(
    (application) => application.status === "approved"
  );

  return {
    activeCampaigns: activeCampaigns.length,
    availableSlots: activeCampaigns.reduce(
      (total, campaign) => total + campaign.slotsLeft,
      0
    ),
    pendingCompletions: completedApplications.length,
    approvedCompletions: approvedApplications.length,
    totalApplications: state.applications.length
  };
}
