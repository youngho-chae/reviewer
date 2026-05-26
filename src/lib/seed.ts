import bcrypt from "bcryptjs";
import { getDB, saveDB } from "./db";
import { rid } from "./ids";
import { Campaign, Owner, Reviewer, Store } from "./types";

export function ensureSeed() {
  const db = getDB();
  if (db.seeded) return;
  db.seeded = true;

  const hash = (p: string) => bcrypt.hashSync(p, 8);

  // 시드 사장님 1명 + 매장 2개
  const owner: Owner = {
    id: rid("ow"),
    email: "demo@store.com",
    passwordHash: hash("demo1234"),
    storeName: "정식당 · 북촌",
    category: "한식",
    area: "북촌",
    plan: "Standard",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
  };
  db.owners.push(owner);

  const store1: Store = {
    id: rid("st"),
    ownerId: owner.id,
    name: "정식당 · 북촌",
    category: "한식",
    area: "북촌",
    coverEmoji: "🍱",
    rating: 4.8,
    reviewCount: 132,
    hours: "11:30 - 21:30",
  };
  const store2: Store = {
    id: rid("st"),
    ownerId: owner.id,
    name: "노아 베이커리",
    category: "카페",
    area: "삼청동",
    coverEmoji: "🥐",
    rating: 4.7,
    reviewCount: 88,
    hours: "08:00 - 20:00",
  };
  db.stores.push(store1, store2);

  const now = Date.now();
  const c1: Campaign = {
    id: rid("cp"),
    storeId: store1.id,
    kind: "visit",
    title: "가을 시즌 디너 캠페인",
    startAt: now - 1000 * 60 * 60 * 24 * 2,
    endAt: now + 1000 * 60 * 60 * 24 * 18,
    supportAmount: 100000,
    quota: { S: 5, A: 5, B: 10, C: 20 },
    used: { S: 1, A: 2, B: 3, C: 8 },
    requiredChannels: ["naver_blog", "instagram"],
    requiredMenus: ["코스 디너", "와인 페어링"],
    description: "정식당의 가을 시즌 디너를 체험하고 정성스러운 후기 부탁드립니다.",
    createdAt: now - 1000 * 60 * 60 * 24 * 2,
  };
  const c2: Campaign = {
    id: rid("cp"),
    storeId: store2.id,
    kind: "visit",
    title: "오픈 기념 베이커리 체험",
    startAt: now - 1000 * 60 * 60 * 24,
    endAt: now + 1000 * 60 * 60 * 24 * 9,
    supportAmount: 30000,
    quota: { S: 2, A: 4, B: 8, C: 16 },
    used: { S: 0, A: 1, B: 1, C: 3 },
    requiredChannels: ["instagram", "naver_blog"],
    requiredMenus: ["시그니처 크루아상", "음료 1잔"],
    description: "북촌 골목 끝, 따뜻한 빵 한 조각을 함께 나눠주세요.",
    createdAt: now - 1000 * 60 * 60 * 24,
  };
  db.campaigns.push(c1, c2);

  // 시드 체험자 — 등급 데모용
  const reviewers: Reviewer[] = [
    {
      id: rid("rv"),
      email: "demo@reviewer.com",
      passwordHash: hash("demo1234"),
      nickname: "북촌리뷰어",
      sns: [
        { kind: "naver_blog", url: "https://blog.naver.com/demo", influence: 2400 },
        { kind: "instagram", url: "https://instagram.com/demo", influence: 5800 },
      ],
      grade: "B",
      createdAt: now - 1000 * 60 * 60 * 24 * 5,
      completedReviews: 3,
      qualityScore: 88,
      noShowCount: 0,
    },
  ];
  db.reviewers.push(...reviewers);

  saveDB();
}
