import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCampaign,
  completeApplication,
  createCampaign,
  createInitialState,
  markPassUsed,
  summarizeState
} from "../src/lib/catchpass-core.mjs";

test("owner-created campaign becomes available to reviewers", () => {
  const state = createInitialState("2026-05-21T00:00:00.000Z");
  const next = createCampaign(state, {
    title: "성수 신메뉴 테이스팅",
    store: "로로비 카페",
    type: "visit",
    channels: ["blog", "instagram"],
    requiredMenus: ["시즌 디저트"],
    gradeOffers: [
      { grade: "A", reward: 80000, capacity: 3 },
      { grade: "B", reward: 50000, capacity: 5 }
    ]
  });

  assert.equal(next.campaigns[0].title, "성수 신메뉴 테이스팅");
  assert.equal(next.campaigns[0].capacity, 8);
  assert.equal(next.campaigns[0].slotsLeft, 8);
  assert.equal(summarizeState(next).activeCampaigns, 3);
});

test("reviewer pass can be used by owner and submitted for review", () => {
  const state = createInitialState("2026-05-21T00:00:00.000Z");
  const applied = applyCampaign(state, {
    campaignId: "camp_press_001",
    reviewerName: "리뷰어 2048",
    reviewerGrade: "A"
  });
  const application = applied.applications[0];

  assert.equal(application.status, "applied");
  assert.equal(application.passCode.startsWith("CP-A-"), true);

  const used = markPassUsed(applied, { passCode: application.passCode });
  assert.equal(used.applications[0].status, "used");

  const completed = completeApplication(used, {
    applicationId: application.id,
    reviewUrl: "https://blog.example.com/review-2048",
    channel: "blog"
  });

  assert.equal(completed.applications[0].status, "completed");
  assert.equal(completed.applications[0].reviewUrl.includes("review-2048"), true);
  assert.equal(summarizeState(completed).pendingCompletions, 2);
});
