import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCampaign,
  completeApplication,
  createCampaign,
  createInitialState,
  summarizeState
} from "../src/lib/catchpass-core.mjs";

test("owner-created campaign becomes available to reviewers", () => {
  const state = createInitialState("2026-05-21T00:00:00.000Z");
  const next = createCampaign(state, {
    title: "성수 팝업 테이스팅",
    store: "레어그라운드",
    type: "visit",
    minGrade: "B",
    reward: 30000,
    capacity: 8
  });

  assert.equal(next.campaigns[0].title, "성수 팝업 테이스팅");
  assert.equal(next.campaigns[0].slotsLeft, 8);
  assert.equal(summarizeState(next).activeCampaigns, 3);
});

test("reviewer completion appears as owner pending completion", () => {
  const state = createInitialState("2026-05-21T00:00:00.000Z");
  const applied = applyCampaign(state, {
    campaignId: "camp_press_001",
    reviewerName: "리뷰어 2048",
    reviewerGrade: "A"
  });
  const application = applied.applications[0];
  const completed = completeApplication(applied, {
    applicationId: application.id,
    reviewUrl: "https://blog.example.com/review-2048"
  });

  assert.equal(completed.applications[0].status, "completed");
  assert.equal(completed.applications[0].reviewUrl.includes("review-2048"), true);
  assert.equal(summarizeState(completed).pendingCompletions, 2);
});
