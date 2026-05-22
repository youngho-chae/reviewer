const CURRENT_VERSION = 2;
const gradeOrder = ["S", "A", "B", "C", "N"];
const gradeRank = { N: 0, C: 1, B: 2, A: 3, S: 4 };
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

function toNonNegativeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : fallback;
}

function cleanText(value, fallback) {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function cleanList(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const next = value.map((item) => String(item ?? "").trim()).filter(Boolean);
  return next.length ? next : fallback;
}

function addHours(iso, hours) {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function makePassCode(grade) {
  const left = Math.floor(1000 + Math.random() * 9000);
  const right = Math.floor(1000 + Math.random() * 9000);
  return `CP-${grade}-${left}-${right}`;
}

function defaultGradeOffers(type) {
  if (type === "press") {
    return [
      { grade: "A", reward: 85000, capacity: 3, slotsLeft: 3 },
      { grade: "B", reward: 65000, capacity: 4, slotsLeft: 4 }
    ];
  }
  return [
    { grade: "A", reward: 80000, capacity: 4, slotsLeft: 4 },
    { grade: "B", reward: 50000, capacity: 6, slotsLeft: 6 },
    { grade: "C", reward: 30000, capacity: 8, slotsLeft: 8 }
  ];
}

function parseGradeOffers(payload, type) {
  const source = Array.isArray(payload.gradeOffers)
    ? payload.gradeOffers
    : defaultGradeOffers(type);
  const offers = source
    .map((offer) => {
      const grade = gradeOrder.includes(offer.grade) ? offer.grade : null;
      if (!grade) return null;
      const capacity = toNumber(offer.capacity, 1);
      const reward = toNumber(
        offer.reward,
        type === "press" ? 65000 : grade === "A" ? 80000 : 50000
      );
      return {
        grade,
        reward,
        capacity,
        slotsLeft: Math.min(toNonNegativeNumber(offer.slotsLeft, capacity), capacity)
      };
    })
    .filter(Boolean);

  return offers.length ? offers : defaultGradeOffers(type);
}

function getMinimumGrade(offers) {
  return offers.reduce((lowest, offer) => {
    return gradeRank[offer.grade] < gradeRank[lowest] ? offer.grade : lowest;
  }, offers[0]?.grade ?? "B");
}

function getRewardForGrade(campaign, grade) {
  const exact = campaign.gradeOffers?.find((offer) => offer.grade === grade);
  if (exact) return exact.reward;

  const accessible = campaign.gradeOffers
    ?.filter((offer) => gradeRank[grade] >= gradeRank[offer.grade])
    .sort((a, b) => gradeRank[b.grade] - gradeRank[a.grade])[0];
  return accessible?.reward ?? campaign.reward;
}

function reduceOfferSlot(campaign, grade) {
  const exact = campaign.gradeOffers?.find((offer) => offer.grade === grade);
  const fallback = campaign.gradeOffers
    ?.filter((offer) => gradeRank[grade] >= gradeRank[offer.grade] && offer.slotsLeft > 0)
    .sort((a, b) => gradeRank[b.grade] - gradeRank[a.grade])[0];
  const offer = exact?.slotsLeft > 0 ? exact : fallback;
  if (offer) offer.slotsLeft = Math.max(0, offer.slotsLeft - 1);
}

export function createInitialState(now = new Date().toISOString()) {
  return {
    version: CURRENT_VERSION,
    updatedAt: now,
    campaigns: [
      {
        id: "camp_visit_001",
        title: "가을 시즌 디너 캠페인",
        store: "정식당 북촌",
        type: "visit",
        category: "코스 한식",
        neighborhood: "북촌",
        address: "서울 종로구 북촌로 12",
        distance: "1.8km",
        rating: 4.8,
        reviews: 268,
        minGrade: "C",
        reward: 50000,
        capacity: 18,
        slotsLeft: 12,
        status: "open",
        channels: ["blog", "instagram", "youtube"],
        visitDays: ["화", "수", "목", "금", "토"],
        visitHours: "17:00 - 21:30",
        reviewDeadlineHours: 72,
        requiredMedia: {
          photos: 5,
          text: 500,
          videoSeconds: 15,
          exposureDays: 60
        },
        requiredMenus: ["시그니처 코스", "런치 테이스팅"],
        ownerNotice:
          "예약 없이 워크인도 가능하지만 금요일은 19시 전 방문을 권장합니다.",
        gradeOffers: [
          { grade: "A", reward: 80000, capacity: 4, slotsLeft: 3 },
          { grade: "B", reward: 50000, capacity: 6, slotsLeft: 5 },
          { grade: "C", reward: 30000, capacity: 8, slotsLeft: 4 }
        ],
        createdAt: now
      },
      {
        id: "camp_press_001",
        title: "신메뉴 보도자료 기자단",
        store: "로로비 카페",
        type: "press",
        category: "카페",
        neighborhood: "성수",
        address: "서울 성동구 연무장길 21",
        distance: "3.2km",
        rating: 4.7,
        reviews: 142,
        minGrade: "B",
        reward: 65000,
        capacity: 7,
        slotsLeft: 5,
        status: "open",
        channels: ["blog", "clip"],
        visitDays: [],
        visitHours: "자료팩 수령 후 5일 내 게시",
        reviewDeadlineHours: 120,
        requiredMedia: {
          photos: 4,
          text: 800,
          videoSeconds: 0,
          exposureDays: 60
        },
        requiredMenus: ["시즌 디저트 자료팩", "브랜드 스토리 자료팩"],
        ownerNotice:
          "매장 방문 없이 자료팩으로 작성하는 캠페인입니다. 제품명 표기를 정확히 부탁드립니다.",
        gradeOffers: [
          { grade: "A", reward: 85000, capacity: 3, slotsLeft: 2 },
          { grade: "B", reward: 65000, capacity: 4, slotsLeft: 3 }
        ],
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
        passCode: "CP-A-8420-7193",
        reviewUrl: "https://blog.example.com/catchpass-dinner",
        channel: "blog",
        adDisclosure:
          "본 게시물은 캐치패스를 통해 방문 혜택을 제공받아 작성한 후기입니다.",
        appliedAt: now,
        issuedAt: now,
        usedAt: addHours(now, 2),
        completedAt: addHours(now, 48),
        approvedAt: null,
        settlementAmount: 80000
      }
    ],
    activities: [
      {
        id: "act_seed_001",
        at: now,
        actor: "reviewer",
        title: "리뷰어 1242가 가을 시즌 디너 캠페인 리뷰 URL을 제출했습니다.",
        tone: "success"
      },
      {
        id: "act_seed_002",
        at: now,
        actor: "owner",
        title: "정식당 북촌 체험권 1매가 QR 사용 처리되었습니다.",
        tone: "info"
      }
    ]
  };
}

export function normalizeState(state) {
  if (
    !state ||
    state.version !== CURRENT_VERSION ||
    !Array.isArray(state.campaigns) ||
    !Array.isArray(state.applications)
  ) {
    return createInitialState();
  }

  const next = clone(state);
  next.version = CURRENT_VERSION;
  next.updatedAt = next.updatedAt || new Date().toISOString();
  next.activities = Array.isArray(next.activities) ? next.activities : [];

  next.campaigns = next.campaigns.map((campaign) => {
    const type = campaignTypes.has(campaign.type) ? campaign.type : "visit";
    const gradeOffers = parseGradeOffers(campaign, type);
    const capacity =
      toNumber(
        campaign.capacity,
        gradeOffers.reduce((total, offer) => total + offer.capacity, 0)
      ) || 1;
    const slotsLeft = Math.min(
      toNonNegativeNumber(campaign.slotsLeft, gradeOffers.reduce((total, offer) => total + offer.slotsLeft, 0)),
      capacity
    );
    return {
      ...campaign,
      type,
      title: cleanText(campaign.title, type === "press" ? "기자단 캠페인" : "방문형 캠페인"),
      store: cleanText(campaign.store, "캐치패스 매장"),
      category: cleanText(campaign.category, type === "press" ? "브랜드" : "맛집"),
      neighborhood: cleanText(campaign.neighborhood, "서울"),
      address: cleanText(campaign.address, "서울시 강남구 테헤란로"),
      distance: cleanText(campaign.distance, "2.4km"),
      rating: Number(campaign.rating) || 4.7,
      reviews: Number(campaign.reviews) || 80,
      minGrade: gradeOrder.includes(campaign.minGrade)
        ? campaign.minGrade
        : getMinimumGrade(gradeOffers),
      reward: toNumber(campaign.reward, gradeOffers[0]?.reward ?? 50000),
      capacity,
      slotsLeft,
      status: campaign.status === "closed" ? "closed" : "open",
      channels: cleanList(campaign.channels, type === "press" ? ["blog"] : ["blog", "instagram"]),
      visitDays: cleanList(campaign.visitDays, type === "press" ? [] : ["화", "수", "목", "금"]),
      visitHours: cleanText(
        campaign.visitHours,
        type === "press" ? "자료팩 수령 후 5일 내 게시" : "17:00 - 21:00"
      ),
      reviewDeadlineHours: toNumber(campaign.reviewDeadlineHours, type === "press" ? 120 : 72),
      requiredMedia: {
        photos: toNumber(campaign.requiredMedia?.photos, type === "press" ? 4 : 5),
        text: toNumber(campaign.requiredMedia?.text, type === "press" ? 800 : 500),
        videoSeconds: toNumber(campaign.requiredMedia?.videoSeconds, type === "press" ? 0 : 15),
        exposureDays: toNumber(campaign.requiredMedia?.exposureDays, 60)
      },
      requiredMenus: cleanList(
        campaign.requiredMenus,
        type === "press" ? ["브랜드 자료팩"] : ["대표 메뉴"]
      ),
      ownerNotice: cleanText(campaign.ownerNotice, ""),
      gradeOffers,
      createdAt: campaign.createdAt || next.updatedAt
    };
  });

  next.applications = next.applications.map((application) => {
    const campaign = next.campaigns.find((item) => item.id === application.campaignId);
    const grade = gradeOrder.includes(application.reviewerGrade)
      ? application.reviewerGrade
      : "A";
    return {
      ...application,
      reviewerName: cleanText(application.reviewerName, "리뷰어 2048"),
      reviewerGrade: grade,
      status: ["applied", "used", "completed", "approved"].includes(application.status)
        ? application.status
        : "applied",
      passCode: cleanText(application.passCode, makePassCode(grade)),
      reviewUrl: String(application.reviewUrl ?? ""),
      channel: cleanText(application.channel, campaign?.channels?.[0] ?? "blog"),
      adDisclosure: cleanText(application.adDisclosure, ""),
      appliedAt: application.appliedAt || next.updatedAt,
      issuedAt: application.issuedAt || application.appliedAt || next.updatedAt,
      usedAt: application.usedAt || null,
      completedAt: application.completedAt || null,
      approvedAt: application.approvedAt || null,
      settlementAmount: toNumber(
        application.settlementAmount,
        campaign ? getRewardForGrade(campaign, grade) : 50000
      )
    };
  });

  return next;
}

export function createCampaign(state, payload = {}) {
  const next = normalizeState(state);
  const now = new Date().toISOString();
  const type = campaignTypes.has(payload.type) ? payload.type : "visit";
  const gradeOffers = parseGradeOffers(payload, type);
  const capacity = gradeOffers.reduce((total, offer) => total + offer.capacity, 0);
  const slotsLeft = gradeOffers.reduce((total, offer) => total + offer.slotsLeft, 0);
  const minGrade = gradeOrder.includes(payload.minGrade)
    ? payload.minGrade
    : getMinimumGrade(gradeOffers);

  const campaign = {
    id: makeId("camp"),
    title: cleanText(payload.title, type === "press" ? "신규 기자단 캠페인" : "신규 방문형 캠페인"),
    store: cleanText(payload.store, "캐치패스 매장"),
    type,
    category: cleanText(payload.category, type === "press" ? "브랜드" : "맛집"),
    neighborhood: cleanText(payload.neighborhood, "서울"),
    address: cleanText(payload.address, "서울시 강남구 테헤란로"),
    distance: cleanText(payload.distance, "2.4km"),
    rating: Number(payload.rating) || 4.7,
    reviews: Number(payload.reviews) || 0,
    minGrade,
    reward: toNumber(payload.reward, gradeOffers[0]?.reward ?? (type === "press" ? 70000 : 35000)),
    capacity,
    slotsLeft,
    status: "open",
    channels: cleanList(payload.channels, type === "press" ? ["blog"] : ["blog", "instagram"]),
    visitDays: cleanList(payload.visitDays, type === "press" ? [] : ["화", "수", "목", "금"]),
    visitHours: cleanText(
      payload.visitHours,
      type === "press" ? "자료팩 수령 후 5일 내 게시" : "17:00 - 21:00"
    ),
    reviewDeadlineHours: toNumber(payload.reviewDeadlineHours, type === "press" ? 120 : 72),
    requiredMedia: {
      photos: toNumber(payload.requiredMedia?.photos, type === "press" ? 4 : 5),
      text: toNumber(payload.requiredMedia?.text, type === "press" ? 800 : 500),
      videoSeconds: toNumber(payload.requiredMedia?.videoSeconds, type === "press" ? 0 : 15),
      exposureDays: toNumber(payload.requiredMedia?.exposureDays, 60)
    },
    requiredMenus: cleanList(
      payload.requiredMenus,
      type === "press" ? ["브랜드 자료팩"] : ["대표 메뉴"]
    ),
    ownerNotice: cleanText(payload.ownerNotice, ""),
    gradeOffers,
    createdAt: now
  };

  next.campaigns.unshift(campaign);
  next.activities.unshift({
    id: makeId("act"),
    at: now,
    actor: "owner",
    title: `${campaign.store} ${type === "press" ? "기자단" : "방문형"} 캠페인이 오픈되었습니다.`,
    tone: "info"
  });
  next.updatedAt = now;
  return next;
}

export function applyCampaign(state, payload = {}) {
  const next = normalizeState(state);
  const now = new Date().toISOString();
  const campaign = next.campaigns.find((item) => item.id === payload.campaignId);
  if (!campaign) {
    throw new Error("캠페인을 찾을 수 없습니다.");
  }
  if (campaign.status !== "open" || campaign.slotsLeft <= 0) {
    throw new Error("모집이 마감된 캠페인입니다.");
  }

  const reviewerName = cleanText(payload.reviewerName, "리뷰어 2048");
  const reviewerGrade = gradeOrder.includes(payload.reviewerGrade)
    ? payload.reviewerGrade
    : "A";
  if (gradeRank[reviewerGrade] < gradeRank[campaign.minGrade]) {
    throw new Error(`${campaign.minGrade}등급 이상 참여 가능한 캠페인입니다.`);
  }

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
    reviewerGrade,
    status: "applied",
    passCode: makePassCode(reviewerGrade),
    reviewUrl: "",
    channel: campaign.channels[0] ?? "blog",
    adDisclosure: "",
    appliedAt: now,
    issuedAt: now,
    usedAt: null,
    completedAt: null,
    approvedAt: null,
    settlementAmount: getRewardForGrade(campaign, reviewerGrade)
  };

  campaign.slotsLeft = Math.max(0, campaign.slotsLeft - 1);
  reduceOfferSlot(campaign, reviewerGrade);
  next.applications.unshift(application);
  next.activities.unshift({
    id: makeId("act"),
    at: now,
    actor: "reviewer",
    title: `${reviewerName}에게 ${campaign.store} 체험권 QR이 발급되었습니다.`,
    tone: "info"
  });
  next.updatedAt = now;
  return next;
}

export function markPassUsed(state, payload = {}) {
  const next = normalizeState(state);
  const now = new Date().toISOString();
  const code = String(payload.passCode ?? "").trim().toUpperCase();
  const application = next.applications.find(
    (item) =>
      item.id === payload.applicationId ||
      String(item.passCode ?? "").toUpperCase() === code
  );
  if (!application) {
    throw new Error("체험권 QR을 찾을 수 없습니다.");
  }
  if (application.status === "approved" || application.status === "completed") {
    return next;
  }

  const campaign = next.campaigns.find((item) => item.id === application.campaignId);
  application.status = "used";
  application.usedAt = now;
  next.activities.unshift({
    id: makeId("act"),
    at: now,
    actor: "owner",
    title: `${campaign?.store ?? "매장"}에서 ${application.reviewerName} 체험권을 사용 처리했습니다.`,
    tone: "success"
  });
  next.updatedAt = now;
  return next;
}

export function completeApplication(state, payload = {}) {
  const next = normalizeState(state);
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
  application.channel = cleanText(payload.channel, application.channel || campaign?.channels?.[0] || "blog");
  application.adDisclosure = cleanText(
    payload.adDisclosure,
    "본 게시물은 캐치패스를 통해 혜택을 제공받아 작성했습니다."
  );
  application.usedAt = application.usedAt || now;
  application.completedAt = now;
  next.activities.unshift({
    id: makeId("act"),
    at: now,
    actor: "reviewer",
    title: `${application.reviewerName}가 ${campaign?.title ?? "캠페인"} 리뷰 인증을 제출했습니다.`,
    tone: "success"
  });
  next.updatedAt = now;
  return next;
}

export function approveApplication(state, payload = {}) {
  const next = normalizeState(state);
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
    title: `${campaign?.title ?? "캠페인"} 리뷰 인증을 승인했습니다.`,
    tone: "success"
  });
  next.updatedAt = now;
  return next;
}

export function summarizeState(state) {
  const normalized = normalizeState(state);
  const activeCampaigns = normalized.campaigns.filter(
    (campaign) => campaign.status === "open"
  );
  const completedApplications = normalized.applications.filter(
    (application) => application.status === "completed"
  );
  const approvedApplications = normalized.applications.filter(
    (application) => application.status === "approved"
  );
  const usedApplications = normalized.applications.filter(
    (application) => ["used", "completed", "approved"].includes(application.status)
  );

  return {
    activeCampaigns: activeCampaigns.length,
    availableSlots: activeCampaigns.reduce(
      (total, campaign) => total + campaign.slotsLeft,
      0
    ),
    pendingCompletions: completedApplications.length,
    approvedCompletions: approvedApplications.length,
    totalApplications: normalized.applications.length,
    issuedPasses: normalized.applications.length,
    usedPasses: usedApplications.length,
    pressCampaigns: activeCampaigns.filter((campaign) => campaign.type === "press").length,
    estimatedPayout: normalized.applications.reduce(
      (total, application) => total + (Number(application.settlementAmount) || 0),
      0
    )
  };
}
