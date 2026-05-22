"use client";

import {
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  ExternalLink,
  FileText,
  Home,
  Loader2,
  MapPinned,
  MoreHorizontal,
  Navigation,
  Plus,
  QrCode,
  Radio,
  RefreshCw,
  ScanLine,
  Search,
  Send,
  Server,
  Settings,
  ShieldCheck,
  Star,
  Store,
  Ticket,
  UserRound,
  UserRoundCheck,
  Wallet
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

type Role = "owner" | "reviewer";
type CampaignType = "visit" | "press";
type CampaignStatus = "open" | "closed";
type ApplicationStatus = "applied" | "used" | "completed" | "approved";
type Tone = "info" | "success" | "warning";
type OwnerView = "home" | "campaign" | "review" | "scan" | "report" | "more";
type ReviewerView = "home" | "map" | "pass" | "grade" | "me";

type RequiredMedia = {
  photos: number;
  text: number;
  videoSeconds: number;
  exposureDays: number;
};

type GradeOffer = {
  grade: string;
  reward: number;
  capacity: number;
  slotsLeft: number;
};

type Campaign = {
  id: string;
  title: string;
  store: string;
  type: CampaignType;
  category: string;
  neighborhood: string;
  address: string;
  distance: string;
  rating: number;
  reviews: number;
  minGrade: string;
  reward: number;
  capacity: number;
  slotsLeft: number;
  status: CampaignStatus;
  channels: string[];
  visitDays: string[];
  visitHours: string;
  reviewDeadlineHours: number;
  requiredMedia: RequiredMedia;
  requiredMenus: string[];
  ownerNotice: string;
  gradeOffers: GradeOffer[];
  createdAt: string;
};

type Application = {
  id: string;
  campaignId: string;
  reviewerName: string;
  reviewerGrade: string;
  status: ApplicationStatus;
  passCode: string;
  reviewUrl: string;
  channel: string;
  adDisclosure: string;
  appliedAt: string;
  issuedAt: string;
  usedAt: string | null;
  completedAt: string | null;
  approvedAt?: string | null;
  settlementAmount: number;
};

type Activity = {
  id: string;
  at: string;
  actor: Role;
  title: string;
  tone: Tone;
};

type CatchpassState = {
  version?: number;
  updatedAt: string;
  campaigns: Campaign[];
  applications: Application[];
  activities: Activity[];
};

type Summary = {
  activeCampaigns: number;
  availableSlots: number;
  pendingCompletions: number;
  approvedCompletions: number;
  totalApplications: number;
  issuedPasses: number;
  usedPasses: number;
  pressCampaigns: number;
  estimatedPayout: number;
};

const REVIEWER_NAME = "리뷰어 2048";
const REVIEWER_GRADE = "A";
const gradeRank: Record<string, number> = { N: 0, C: 1, B: 2, A: 3, S: 4 };

const emptyState: CatchpassState = {
  updatedAt: "",
  campaigns: [],
  applications: [],
  activities: []
};

const emptySummary: Summary = {
  activeCampaigns: 0,
  availableSlots: 0,
  pendingCompletions: 0,
  approvedCompletions: 0,
  totalApplications: 0,
  issuedPasses: 0,
  usedPasses: 0,
  pressCampaigns: 0,
  estimatedPayout: 0
};

const roleCopy = {
  owner: {
    title: "사장님용",
    headline: "모집, QR 사용, 리뷰 검수를 한 번에 관리합니다.",
    body: "방문형과 기자단 캠페인을 만들고 체험권 사용, 리뷰 인증, 멤버십 상태까지 같은 가상 서버에서 동기화합니다."
  },
  reviewer: {
    title: "체험자용",
    headline: "등급으로 체험권을 받고 리뷰 인증까지 이어갑니다.",
    body: "캠페인을 탐색하고 QR 체험권을 발급받은 뒤 리뷰 URL을 제출하면 사장님 화면의 검수 대기열에 반영됩니다."
  }
};

const typeLabel: Record<CampaignType, string> = {
  visit: "방문형",
  press: "기자단"
};

const channelLabel: Record<string, string> = {
  blog: "네이버 블로그",
  instagram: "인스타그램",
  youtube: "유튜브 쇼츠",
  tiktok: "틱톡",
  clip: "네이버 클립"
};

const statusLabel: Record<ApplicationStatus, string> = {
  applied: "QR 발급",
  used: "사용 완료",
  completed: "검수 대기",
  approved: "승인 완료"
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value || 0);
}

function formatTime(value: string | null | undefined) {
  if (!value) return "방금 전";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function apiEndpoint(serverBase: string) {
  const envBase = process.env.NEXT_PUBLIC_CATCHPASS_API_BASE || "";
  const base = (serverBase || envBase).trim().replace(/\/$/, "");
  return base ? `${base}/api/catchpass` : "/api/catchpass";
}

function canJoinCampaign(campaign: Campaign, grade: string) {
  return (gradeRank[grade] ?? 0) >= (gradeRank[campaign.minGrade] ?? 0);
}

function completionRate(campaign: Campaign) {
  if (!campaign.capacity) return 0;
  return Math.min(100, ((campaign.capacity - campaign.slotsLeft) / campaign.capacity) * 100);
}

function getCampaign(state: CatchpassState, application: Application) {
  return state.campaigns.find((campaign) => campaign.id === application.campaignId);
}

function channelText(channels: string[]) {
  return channels.map((channel) => channelLabel[channel] ?? channel).join(", ");
}

export function CatchpassWorkspace({ role }: { role: Role }) {
  const [state, setState] = useState<CatchpassState>(emptyState);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [serverBase, setServerBase] = useState("");
  const [draftServerBase, setDraftServerBase] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem("catchpass-api-base") || "";
    setServerBase(saved);
    setDraftServerBase(saved);
  }, []);

  const endpoint = useMemo(() => apiEndpoint(serverBase), [serverBase]);

  const loadState = useCallback(async () => {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) throw new Error("서버 상태를 불러오지 못했습니다.");
      const payload = await response.json();
      setState(payload.state);
      setSummary({ ...emptySummary, ...payload.summary });
      setLastSync(new Date().toISOString());
      setError("");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "서버 연결에 실패했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void loadState();
    const timer = window.setInterval(() => {
      void loadState();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [loadState]);

  const runAction = useCallback(
    async (action: string, payload: Record<string, unknown> = {}) => {
      setBusyAction(action);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, payload })
        });
        const next = await response.json();
        if (!response.ok) throw new Error(next.error || "요청 실패");
        setState(next.state);
        setSummary({ ...emptySummary, ...next.summary });
        setLastSync(new Date().toISOString());
        setError("");
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "요청을 처리하지 못했습니다."
        );
      } finally {
        setBusyAction("");
      }
    },
    [endpoint]
  );

  const saveServerBase = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = draftServerBase.trim().replace(/\/$/, "");
    window.localStorage.setItem("catchpass-api-base", next);
    setServerBase(next);
  };

  const isBusy = Boolean(busyAction);
  const myApplications = state.applications.filter(
    (application) => application.reviewerName === REVIEWER_NAME
  );
  const availableForReviewer = state.campaigns.filter(
    (campaign) => campaign.status === "open" && canJoinCampaign(campaign, REVIEWER_GRADE)
  );

  const metrics =
    role === "owner"
      ? [
          { icon: <Store size={18} />, label: "모집 캠페인", value: `${summary.activeCampaigns}개` },
          { icon: <Ticket size={18} />, label: "발급 체험권", value: `${summary.issuedPasses}매` },
          { icon: <ClipboardCheck size={18} />, label: "검수 대기", value: `${summary.pendingCompletions}건` },
          { icon: <UserRoundCheck size={18} />, label: "승인 완료", value: `${summary.approvedCompletions}건` }
        ]
      : [
          { icon: <Search size={18} />, label: "참여 가능", value: `${availableForReviewer.length}개` },
          { icon: <Ticket size={18} />, label: "내 체험권", value: `${myApplications.length}매` },
          { icon: <CheckCircle2 size={18} />, label: "사용 완료", value: `${myApplications.filter((item) => ["used", "completed", "approved"].includes(item.status)).length}건` },
          { icon: <ShieldCheck size={18} />, label: "현재 등급", value: REVIEWER_GRADE }
        ];

  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand__mark">CP</span>
          <span>CATCHPASS</span>
        </Link>
        <nav className="role-tabs" aria-label="역할 선택">
          <Link
            className={`role-tab ${role === "owner" ? "is-active" : ""}`}
            href="/owner"
          >
            사장님
          </Link>
          <Link
            className={`role-tab ${role === "reviewer" ? "is-active" : ""}`}
            href="/reviewer"
          >
            체험자
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">{roleCopy[role].title}</p>
          <h1>{roleCopy[role].headline}</h1>
          <p>{roleCopy[role].body}</p>
        </div>
        <div className={`server-chip ${error ? "server-chip--error" : ""}`} data-testid="server-status">
          {isLoading ? <Loader2 className="spin" size={16} /> : <Radio size={16} />}
          <span>{error ? "연결 확인 필요" : "가상 서버 연결됨"}</span>
        </div>
      </section>

      <section className="metrics" aria-label="연동 현황">
        {metrics.map((metric) => (
          <Metric key={metric.label} {...metric} />
        ))}
      </section>

      {error ? <div className="banner banner--error">{error}</div> : null}

      {role === "owner" ? (
        <OwnerPortal
          state={state}
          summary={summary}
          isBusy={isBusy}
          busyAction={busyAction}
          onAction={runAction}
        />
      ) : (
        <ReviewerPortal
          state={state}
          isBusy={isBusy}
          busyAction={busyAction}
          onAction={runAction}
        />
      )}

      <section className="bottom-grid">
        <ServerPanel
          endpoint={endpoint}
          draftServerBase={draftServerBase}
          lastSync={lastSync}
          isBusy={isBusy}
          onDraftServerBase={setDraftServerBase}
          onRefresh={loadState}
          onSaveServerBase={saveServerBase}
          onReset={() => runAction("resetDemo")}
        />
        <ActivityPanel activities={state.activities} />
      </section>
    </main>
  );
}

function Metric({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="metric">
      <div className="metric__icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RoleShell({
  navItems,
  activeView,
  onViewChange,
  children
}: {
  navItems: Array<{ id: string; label: string; icon: ReactNode; meta?: string }>;
  activeView: string;
  onViewChange: (view: string) => void;
  children: ReactNode;
}) {
  return (
    <section className="role-layout">
      <aside className="side-nav" aria-label="화면 이동">
        {navItems.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`nav-button ${activeView === item.id ? "is-active" : ""}`}
            onClick={() => onViewChange(item.id)}
          >
            <span className="nav-button__icon">{item.icon}</span>
            <span>
              <strong>{item.label}</strong>
              {item.meta ? <small>{item.meta}</small> : null}
            </span>
          </button>
        ))}
      </aside>
      <div className="role-main">{children}</div>
    </section>
  );
}

function OwnerPortal({
  state,
  summary,
  isBusy,
  busyAction,
  onAction
}: {
  state: CatchpassState;
  summary: Summary;
  isBusy: boolean;
  busyAction: string;
  onAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
}) {
  const [view, setView] = useState<OwnerView>("home");
  const navItems = [
    { id: "home", label: "홈", icon: <Home size={18} />, meta: "오늘 현황" },
    { id: "campaign", label: "캠페인", icon: <Plus size={18} />, meta: "방문형 · 기자단" },
    { id: "review", label: "리뷰 검수", icon: <ClipboardCheck size={18} />, meta: `${summary.pendingCompletions}건 대기` },
    { id: "scan", label: "QR 스캔", icon: <ScanLine size={18} />, meta: "체험권 사용" },
    { id: "report", label: "리포트", icon: <BarChart3 size={18} />, meta: "성과 분석" },
    { id: "more", label: "더보기", icon: <MoreHorizontal size={18} />, meta: "구독 · 로그" }
  ];

  return (
    <RoleShell
      navItems={navItems}
      activeView={view}
      onViewChange={(next) => setView(next as OwnerView)}
    >
      {view === "home" ? (
        <OwnerHome state={state} summary={summary} onView={setView} />
      ) : null}
      {view === "campaign" ? (
        <OwnerCampaignStudio
          state={state}
          isBusy={isBusy}
          busyAction={busyAction}
          onAction={onAction}
        />
      ) : null}
      {view === "review" ? (
        <OwnerReviewQueue
          state={state}
          isBusy={isBusy}
          busyAction={busyAction}
          onAction={onAction}
        />
      ) : null}
      {view === "scan" ? (
        <OwnerScanStation
          state={state}
          isBusy={isBusy}
          busyAction={busyAction}
          onAction={onAction}
        />
      ) : null}
      {view === "report" ? <OwnerReport state={state} summary={summary} /> : null}
      {view === "more" ? <OwnerMore state={state} summary={summary} onView={setView} /> : null}
    </RoleShell>
  );
}

function OwnerHome({
  state,
  summary,
  onView
}: {
  state: CatchpassState;
  summary: Summary;
  onView: (view: OwnerView) => void;
}) {
  const latestCampaign = state.campaigns[0];
  const fillRate = latestCampaign ? Math.round(completionRate(latestCampaign)) : 0;
  const waitingReview = state.applications.filter((item) => item.status === "completed");

  return (
    <div className="screen-stack">
      <section className="panel panel--ink">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Today</p>
            <h2>새 리뷰 {waitingReview.length}건이 검수를 기다립니다.</h2>
          </div>
          <Bell size={22} />
        </div>
        <div className="hero-actions">
          <button className="button button--light" type="button" onClick={() => onView("review")}>
            <ClipboardCheck size={16} />
            리뷰 검수
          </button>
          <button className="button button--light" type="button" onClick={() => onView("scan")}>
            <QrCode size={16} />
            QR 스캔
          </button>
        </div>
      </section>

      <section className="two-column">
        <div className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Membership</p>
              <h2>Standard 플랜</h2>
            </div>
            <CreditCard size={22} />
          </div>
          <div className="plan-strip">
            <span>활성 등급</span>
            <strong>C · B · A</strong>
            <small>S 등급은 Premium에서 활성화됩니다.</small>
          </div>
          <button className="button button--secondary" type="button" onClick={() => onView("more")}>
            구독 관리
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Live</p>
              <h2>이번 달 모집률</h2>
            </div>
            <BarChart3 size={22} />
          </div>
          <div className="big-number">
            <strong>{summary.totalApplications}</strong>
            <span>명 참여</span>
          </div>
          <div className="progress" aria-label="모집률">
            <span style={{ width: `${latestCampaign ? fillRate : 0}%` }} />
          </div>
          <p className="muted">{latestCampaign ? `${latestCampaign.title} · ${fillRate}% 채움` : "진행 중인 캠페인이 없습니다."}</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Campaigns</p>
            <h2>진행 중 캠페인</h2>
          </div>
          <Store size={22} />
        </div>
        <div className="campaign-grid" data-testid="owner-campaigns">
          {state.campaigns.slice(0, 3).map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              applications={state.applications.filter(
                (application) => application.campaignId === campaign.id
              )}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function OwnerCampaignStudio({
  state,
  isBusy,
  busyAction,
  onAction
}: {
  state: CatchpassState;
  isBusy: boolean;
  busyAction: string;
  onAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: "성수 신메뉴 테이스팅",
    store: "로로비 카페",
    type: "visit" as CampaignType,
    category: "카페",
    neighborhood: "성수",
    address: "서울 성동구 연무장길 21",
    visitHours: "17:00 - 21:00",
    ownerNotice: "사진 촬영은 자유롭게 가능하고, 디저트는 당일 재고에 따라 선택됩니다.",
    requiredMenus: "시즌 디저트 플레이트\n시그니처 라떼 세트",
    photos: "5",
    text: "500",
    videoSeconds: "15"
  });
  const [channels, setChannels] = useState(["blog", "instagram"]);
  const [gradeOffers, setGradeOffers] = useState({
    S: { on: false, reward: "100000", capacity: "2" },
    A: { on: true, reward: "80000", capacity: "4" },
    B: { on: true, reward: "50000", capacity: "6" },
    C: { on: false, reward: "30000", capacity: "8" }
  });

  const updateForm = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateOffer = (grade: string, key: "on" | "reward" | "capacity", value: string | boolean) => {
    setGradeOffers((current) => ({
      ...current,
      [grade]: { ...current[grade as keyof typeof current], [key]: value }
    }));
  };

  const toggleChannel = (channel: string) => {
    setChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel]
    );
  };

  const activeOffers = Object.entries(gradeOffers)
    .filter(([, offer]) => offer.on)
    .map(([grade, offer]) => ({
      grade,
      reward: Number(offer.reward),
      capacity: Number(offer.capacity)
    }));
  const totalSlots = activeOffers.reduce((total, offer) => total + offer.capacity, 0);
  const totalBudget = activeOffers.reduce(
    (total, offer) => total + offer.reward * offer.capacity,
    0
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fallbackOffers = activeOffers.length
      ? activeOffers
      : [{ grade: "A", reward: 80000, capacity: 3 }];
    await onAction("createCampaign", {
      ...form,
      type: form.type,
      channels: channels.length ? channels : ["blog"],
      visitDays: form.type === "press" ? [] : ["화", "수", "목", "금", "토"],
      requiredMenus: form.requiredMenus.split("\n"),
      requiredMedia: {
        photos: Number(form.photos),
        text: Number(form.text),
        videoSeconds: Number(form.videoSeconds),
        exposureDays: 60
      },
      gradeOffers: fallbackOffers,
      reward: fallbackOffers[0].reward
    });
  };

  return (
    <div className="screen-stack">
      <form className="panel studio" onSubmit={handleSubmit}>
        <div className="panel__header">
          <div>
            <p className="eyebrow">New campaign</p>
            <h2>새 캠페인</h2>
          </div>
          <Plus size={22} />
        </div>

        <div className="segmented" role="group" aria-label="캠페인 타입">
          {(["visit", "press"] as CampaignType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={form.type === type ? "is-active" : ""}
              onClick={() => updateForm("type", type)}
            >
              {typeLabel[type]}
            </button>
          ))}
        </div>

        <div className="form-grid">
          <label>
            캠페인명
            <input value={form.title} onChange={(event) => updateForm("title", event.target.value)} />
          </label>
          <label>
            매장명
            <input value={form.store} onChange={(event) => updateForm("store", event.target.value)} />
          </label>
          <label>
            업종
            <input value={form.category} onChange={(event) => updateForm("category", event.target.value)} />
          </label>
          <label>
            동네
            <input value={form.neighborhood} onChange={(event) => updateForm("neighborhood", event.target.value)} />
          </label>
          <label className="span-2">
            주소
            <input value={form.address} onChange={(event) => updateForm("address", event.target.value)} />
          </label>
          <label>
            {form.type === "press" ? "게시 마감" : "방문 가능 시간"}
            <input value={form.visitHours} onChange={(event) => updateForm("visitHours", event.target.value)} />
          </label>
        </div>

        <section className="sub-panel">
          <div className="section-title">
            <h3>등급별 지원금과 인원</h3>
            <span>{totalSlots}명 · {formatCurrency(form.type === "press" ? Math.round(totalBudget * 1.3) : totalBudget)}</span>
          </div>
          <div className="grade-editor">
            {Object.entries(gradeOffers).map(([grade, offer]) => (
              <div className="grade-row" key={grade}>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={offer.on}
                    onChange={(event) => updateOffer(grade, "on", event.target.checked)}
                  />
                  <GradeBadge grade={grade} />
                  <strong>{grade}등급</strong>
                </label>
                <input
                  type="number"
                  min="10000"
                  step="5000"
                  value={offer.reward}
                  onChange={(event) => updateOffer(grade, "reward", event.target.value)}
                  aria-label={`${grade}등급 지원금`}
                />
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={offer.capacity}
                  onChange={(event) => updateOffer(grade, "capacity", event.target.value)}
                  aria-label={`${grade}등급 모집 인원`}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="sub-panel">
          <div className="section-title">
            <h3>필수 리뷰 채널</h3>
          </div>
          <div className="chip-row">
            {["blog", "instagram", "youtube", "tiktok", "clip"].map((channel) => (
              <button
                type="button"
                key={channel}
                className={`chip ${channels.includes(channel) ? "is-active" : ""}`}
                onClick={() => toggleChannel(channel)}
              >
                {channelLabel[channel]}
              </button>
            ))}
          </div>
        </section>

        <div className="form-grid">
          <label>
            최소 사진
            <input type="number" value={form.photos} onChange={(event) => updateForm("photos", event.target.value)} />
          </label>
          <label>
            최소 본문
            <input type="number" value={form.text} onChange={(event) => updateForm("text", event.target.value)} />
          </label>
          <label>
            최소 영상 초
            <input type="number" value={form.videoSeconds} onChange={(event) => updateForm("videoSeconds", event.target.value)} />
          </label>
          <label className="span-2">
            필수 주문 메뉴 또는 자료팩
            <textarea value={form.requiredMenus} onChange={(event) => updateForm("requiredMenus", event.target.value)} />
          </label>
          <label className="span-2">
            매장 안내사항
            <textarea value={form.ownerNotice} onChange={(event) => updateForm("ownerNotice", event.target.value)} />
          </label>
        </div>

        <button className="button button--primary" disabled={isBusy}>
          {busyAction === "createCampaign" ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
          캠페인 오픈
        </button>
      </form>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Opened</p>
            <h2>등록된 캠페인</h2>
          </div>
          <Store size={22} />
        </div>
        <div className="campaign-grid">
          {state.campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              applications={state.applications.filter((application) => application.campaignId === campaign.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function OwnerReviewQueue({
  state,
  isBusy,
  busyAction,
  onAction
}: {
  state: CatchpassState;
  isBusy: boolean;
  busyAction: string;
  onAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
}) {
  const rows = state.applications.filter((application) =>
    ["completed", "approved"].includes(application.status)
  );

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Review queue</p>
          <h2>리뷰 검수</h2>
        </div>
        <ClipboardCheck size={22} />
      </div>
      <div className="rows" data-testid="owner-completions">
        {rows.length ? (
          rows.map((application) => {
            const campaign = getCampaign(state, application);
            return (
              <article className="review-row" key={application.id}>
                <div className="review-row__main">
                  <div className="inline-meta">
                    <StatusPill status={application.status} />
                    <GradeBadge grade={application.reviewerGrade} />
                    <span>{application.reviewerName}</span>
                  </div>
                  <h3>{campaign?.title ?? "캠페인"}</h3>
                  <p>{campaign?.store} · {channelLabel[application.channel] ?? application.channel}</p>
                  <div className="review-preview">
                    <a href={application.reviewUrl} target="_blank" rel="noreferrer">
                      {application.reviewUrl}
                      <ExternalLink size={13} />
                    </a>
                    <span>{application.adDisclosure}</span>
                  </div>
                </div>
                <button
                  className="icon-button"
                  aria-label="리뷰 승인"
                  disabled={isBusy || application.status === "approved"}
                  onClick={() => onAction("approveApplication", { applicationId: application.id })}
                >
                  {busyAction === "approveApplication" ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />}
                </button>
              </article>
            );
          })
        ) : (
          <div className="empty">검수 대기 중인 리뷰가 없습니다.</div>
        )}
      </div>
    </section>
  );
}

function OwnerScanStation({
  state,
  isBusy,
  busyAction,
  onAction
}: {
  state: CatchpassState;
  isBusy: boolean;
  busyAction: string;
  onAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
}) {
  const [scanCode, setScanCode] = useState("");
  const issuedPasses = state.applications.filter((application) => application.status === "applied");
  const codeToUse = scanCode.trim() || issuedPasses[0]?.passCode || "";
  const selected = issuedPasses.find((application) => application.passCode === codeToUse) ?? issuedPasses[0];
  const selectedCampaign = selected ? getCampaign(state, selected) : null;

  const handleScan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!codeToUse) return;
    await onAction("markPassUsed", { passCode: codeToUse });
    setScanCode("");
  };

  return (
    <div className="scan-layout">
      <section className="panel scanner-panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">QR scan</p>
            <h2>체험권 QR 스캔</h2>
          </div>
          <ScanLine size={22} />
        </div>
        <div className="viewfinder">
          <div className="viewfinder__corners" />
          <QrPattern seed={codeToUse || "catchpass"} />
        </div>
        <form className="server-form" onSubmit={handleScan}>
          <label>
            체험권 코드
            <input
              placeholder="CP-A-8420-7193"
              value={scanCode}
              onChange={(event) => setScanCode(event.target.value.toUpperCase())}
            />
          </label>
          <button className="button button--primary" disabled={isBusy || !codeToUse}>
            {busyAction === "markPassUsed" ? <Loader2 className="spin" size={16} /> : <QrCode size={16} />}
            사용 처리
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Valid pass</p>
            <h2>스캔 대기 체험권</h2>
          </div>
          <Ticket size={22} />
        </div>
        {selected ? (
          <div className="pass-detail">
            <div className="inline-meta">
              <GradeBadge grade={selected.reviewerGrade} />
              <strong>{selected.reviewerName}</strong>
            </div>
            <h3>{selectedCampaign?.title}</h3>
            <dl className="detail-list">
              <div><dt>매장</dt><dd>{selectedCampaign?.store}</dd></div>
              <div><dt>지원금</dt><dd>{formatCurrency(selected.settlementAmount)}</dd></div>
              <div><dt>리뷰 마감</dt><dd>방문일 + {selectedCampaign?.reviewDeadlineHours ?? 72}시간</dd></div>
              <div><dt>QR 코드</dt><dd>{selected.passCode}</dd></div>
            </dl>
          </div>
        ) : (
          <div className="empty">사용 처리할 체험권이 없습니다.</div>
        )}
        <div className="rows compact">
          {issuedPasses.map((application) => {
            const campaign = getCampaign(state, application);
            return (
              <button
                type="button"
                className="select-row"
                key={application.id}
                onClick={() => setScanCode(application.passCode)}
              >
                <span>{application.passCode}</span>
                <small>{campaign?.store} · {application.reviewerName}</small>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function OwnerReport({
  state,
  summary
}: {
  state: CatchpassState;
  summary: Summary;
}) {
  const totalCapacity = state.campaigns.reduce((total, campaign) => total + campaign.capacity, 0);
  const fillRate = totalCapacity ? Math.round((summary.totalApplications / totalCapacity) * 100) : 0;
  const grades = ["S", "A", "B", "C"].map((grade) => ({
    label: `${grade}등급`,
    value: state.applications.filter((application) => application.reviewerGrade === grade).length
  }));
  const channels = Object.keys(channelLabel).map((channel) => ({
    label: channelLabel[channel],
    value: state.applications.filter((application) => application.channel === channel).length
  }));

  return (
    <div className="screen-stack">
      <section className="report-grid">
        <ReportCard label="모집률" value={`${fillRate}%`} detail={`${summary.totalApplications}/${totalCapacity}명`} />
        <ReportCard label="사용 체험권" value={`${summary.usedPasses}매`} detail="QR 사용 기준" />
        <ReportCard label="예상 지원금" value={formatCurrency(summary.estimatedPayout)} detail="발급 체험권 기준" />
      </section>
      <section className="two-column">
        <BarPanel title="등급별 ROI" rows={grades} />
        <BarPanel title="리뷰 채널" rows={channels} />
      </section>
    </div>
  );
}

function OwnerMore({
  state,
  summary,
  onView
}: {
  state: CatchpassState;
  summary: Summary;
  onView: (view: OwnerView) => void;
}) {
  return (
    <div className="screen-stack">
      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Subscription</p>
            <h2>멤버십 / 구독 관리</h2>
          </div>
          <Settings size={22} />
        </div>
        <div className="plan-grid">
          {[
            { name: "Basic", price: 13900, active: false, copy: "C · B 등급" },
            { name: "Standard", price: 25900, active: true, copy: "C · B · A 등급" },
            { name: "Premium", price: 38900, active: false, copy: "S 등급 우선 매칭" }
          ].map((plan) => (
            <article className={`plan-card ${plan.active ? "is-active" : ""}`} key={plan.name}>
              <span>{plan.active ? "현재 플랜" : "플랜"}</span>
              <h3>{plan.name}</h3>
              <strong>{formatCurrency(plan.price)}</strong>
              <p>{plan.copy} · 월 무제한 모집</p>
            </article>
          ))}
        </div>
      </section>

      <section className="two-column">
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Pass log</p>
              <h2>체험권 사용 로그</h2>
            </div>
            <FileText size={22} />
          </div>
          <div className="rows compact">
            {state.applications.slice(0, 6).map((application) => {
              const campaign = getCampaign(state, application);
              return (
                <div className="select-row" key={application.id}>
                  <span>{statusLabel[application.status]} · {application.passCode}</span>
                  <small>{campaign?.store} · {formatCurrency(application.settlementAmount)}</small>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Quick menu</p>
              <h2>운영 메뉴</h2>
            </div>
            <MoreHorizontal size={22} />
          </div>
          <div className="menu-list">
            {[
              { label: "캠페인 만들기", detail: "방문형 / 기자단 등록", view: "campaign" as OwnerView },
              { label: "체험권 스캔", detail: `${summary.issuedPasses - summary.usedPasses}매 대기`, view: "scan" as OwnerView },
              { label: "리뷰 검수", detail: `${summary.pendingCompletions}건 대기`, view: "review" as OwnerView }
            ].map((item) => (
              <button type="button" key={item.label} onClick={() => onView(item.view)}>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function ReviewerPortal({
  state,
  isBusy,
  busyAction,
  onAction
}: {
  state: CatchpassState;
  isBusy: boolean;
  busyAction: string;
  onAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
}) {
  const [view, setView] = useState<ReviewerView>("home");
  const navItems = [
    { id: "home", label: "홈", icon: <Home size={18} />, meta: "체험권 탐색" },
    { id: "map", label: "지도", icon: <MapPinned size={18} />, meta: "내 주변" },
    { id: "pass", label: "내 체험권", icon: <Ticket size={18} />, meta: "QR · 인증" },
    { id: "grade", label: "등급", icon: <ShieldCheck size={18} />, meta: `${REVIEWER_GRADE}등급` },
    { id: "me", label: "MY", icon: <UserRound size={18} />, meta: "SNS 연동" }
  ];

  return (
    <RoleShell
      navItems={navItems}
      activeView={view}
      onViewChange={(next) => setView(next as ReviewerView)}
    >
      {view === "home" ? (
        <ReviewerHome
          state={state}
          isBusy={isBusy}
          busyAction={busyAction}
          onAction={onAction}
          onOpenPass={() => setView("pass")}
          onOpenMap={() => setView("map")}
        />
      ) : null}
      {view === "map" ? (
        <ReviewerMap
          state={state}
          isBusy={isBusy}
          busyAction={busyAction}
          onAction={onAction}
          onOpenPass={() => setView("pass")}
        />
      ) : null}
      {view === "pass" ? (
        <ReviewerPassVault
          state={state}
          isBusy={isBusy}
          busyAction={busyAction}
          onAction={onAction}
        />
      ) : null}
      {view === "grade" ? <ReviewerGrade state={state} /> : null}
      {view === "me" ? <ReviewerProfile state={state} /> : null}
    </RoleShell>
  );
}

function ReviewerHome({
  state,
  isBusy,
  busyAction,
  onAction,
  onOpenPass,
  onOpenMap
}: {
  state: CatchpassState;
  isBusy: boolean;
  busyAction: string;
  onAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  onOpenPass: () => void;
  onOpenMap: () => void;
}) {
  const [mode, setMode] = useState<CampaignType>("visit");
  const [query, setQuery] = useState("");
  const myApplications = state.applications.filter((application) => application.reviewerName === REVIEWER_NAME);
  const applicationByCampaign = new Map(
    myApplications.map((application) => [application.campaignId, application])
  );
  const campaigns = state.campaigns.filter((campaign) => {
    const matchesMode = campaign.type === mode;
    const text = `${campaign.title} ${campaign.store} ${campaign.neighborhood}`.toLowerCase();
    return matchesMode && text.includes(query.toLowerCase());
  });

  return (
    <div className="screen-stack">
      <section className="panel panel--ink reviewer-hero">
        <div>
          <p className="eyebrow">My grade</p>
          <div className="grade-hero">
            <GradeBadge grade={REVIEWER_GRADE} size="large" inverted />
            <div>
              <h2>{REVIEWER_GRADE}등급 체험자</h2>
              <p>완료 리뷰 14건 · 리뷰 품질 점수 892점</p>
            </div>
          </div>
        </div>
        <button className="button button--light" type="button" onClick={onOpenPass}>
          내 체험권
          <ChevronRight size={16} />
        </button>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Discover</p>
            <h2>내 주변 캐치패스</h2>
          </div>
          <button className="icon-button icon-button--blue" type="button" onClick={onOpenMap} aria-label="지도 보기">
            <MapPinned size={18} />
          </button>
        </div>
        <div className="toolbar-row">
          <div className="search-box">
            <Search size={16} />
            <input
              placeholder="매장, 동네 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="segmented segmented--compact" role="group" aria-label="캠페인 분류">
            {(["visit", "press"] as CampaignType[]).map((type) => (
              <button
                key={type}
                type="button"
                className={mode === type ? "is-active" : ""}
                onClick={() => setMode(type)}
              >
                {typeLabel[type]}
              </button>
            ))}
          </div>
        </div>
        <div className="campaign-grid" data-testid="reviewer-campaigns">
          {campaigns.map((campaign) => (
            <ReviewerCampaignCard
              key={campaign.id}
              campaign={campaign}
              application={applicationByCampaign.get(campaign.id)}
              isBusy={isBusy}
              busyAction={busyAction}
              onAction={onAction}
              onOpenPass={onOpenPass}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function ReviewerMap({
  state,
  isBusy,
  busyAction,
  onAction,
  onOpenPass
}: {
  state: CatchpassState;
  isBusy: boolean;
  busyAction: string;
  onAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  onOpenPass: () => void;
}) {
  const [selectedId, setSelectedId] = useState(state.campaigns[0]?.id ?? "");
  const myApplications = state.applications.filter((application) => application.reviewerName === REVIEWER_NAME);
  const applicationByCampaign = new Map(myApplications.map((application) => [application.campaignId, application]));
  const selected = state.campaigns.find((campaign) => campaign.id === selectedId) ?? state.campaigns[0];

  return (
    <div className="map-layout">
      <section className="map-canvas" aria-label="지도">
        <div className="map-search">
          <Navigation size={16} />
          <span>성수 · 북촌 · 강남</span>
        </div>
        {state.campaigns.map((campaign, index) => (
          <button
            type="button"
            key={campaign.id}
            className={`map-pin ${selected?.id === campaign.id ? "is-active" : ""}`}
            style={{
              left: `${18 + ((index * 23) % 62)}%`,
              top: `${24 + ((index * 17) % 52)}%`
            }}
            onClick={() => setSelectedId(campaign.id)}
          >
            <GradeBadge grade={campaign.minGrade} inverted={selected?.id === campaign.id} />
            <span>{formatCurrency(campaign.reward).replace("₩", "")}</span>
          </button>
        ))}
      </section>
      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Map mode</p>
            <h2>선택한 캠페인</h2>
          </div>
          <MapPinned size={22} />
        </div>
        {selected ? (
          <ReviewerCampaignCard
            campaign={selected}
            application={applicationByCampaign.get(selected.id)}
            isBusy={isBusy}
            busyAction={busyAction}
            onAction={onAction}
            onOpenPass={onOpenPass}
          />
        ) : (
          <div className="empty">표시할 캠페인이 없습니다.</div>
        )}
      </section>
    </div>
  );
}

function ReviewerPassVault({
  state,
  isBusy,
  busyAction,
  onAction
}: {
  state: CatchpassState;
  isBusy: boolean;
  busyAction: string;
  onAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");
  const [channel, setChannel] = useState("blog");
  const myApplications = state.applications.filter((application) => application.reviewerName === REVIEWER_NAME);
  const selected = myApplications.find((application) => application.id === selectedId) ?? myApplications[0];
  const campaign = selected ? getCampaign(state, selected) : null;

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    await onAction("completeApplication", {
      applicationId: selected.id,
      reviewUrl: reviewUrl || "https://blog.example.com/reviewer-2048",
      channel,
      adDisclosure:
        "본 게시물은 캐치패스를 통해 방문 혜택을 제공받아 작성한 후기입니다."
    });
    setReviewUrl("");
  };

  return (
    <div className="pass-layout">
      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Pass vault</p>
            <h2>내 체험권</h2>
          </div>
          <Ticket size={22} />
        </div>
        <div className="rows compact">
          {myApplications.length ? (
            myApplications.map((application) => {
              const itemCampaign = getCampaign(state, application);
              return (
                <button
                  type="button"
                  className={`select-row ${selected?.id === application.id ? "is-active" : ""}`}
                  key={application.id}
                  onClick={() => {
                    setSelectedId(application.id);
                    setChannel(application.channel || itemCampaign?.channels[0] || "blog");
                  }}
                >
                  <span>{itemCampaign?.store}</span>
                  <small>{statusLabel[application.status]} · {application.passCode}</small>
                </button>
              );
            })
          ) : (
            <div className="empty">아직 발급된 체험권이 없습니다.</div>
          )}
        </div>
      </section>

      <section className="panel pass-card">
        {selected && campaign ? (
          <>
            <div className="pass-card__top">
              <div>
                <div className="inline-meta">
                  <GradeBadge grade={selected.reviewerGrade} />
                  <span>CATCHPASS · {selected.reviewerGrade}등급</span>
                </div>
                <h2>{campaign.store}</h2>
                <p>{campaign.neighborhood} · {campaign.category}</p>
              </div>
              <StatusPill status={selected.status} />
            </div>
            <div className="qr-card">
              <QrPattern seed={selected.passCode} />
              <code>{selected.passCode}</code>
              <span>결제 전 사장님께 보여주세요</span>
            </div>
            <dl className="detail-list">
              <div><dt>지원금</dt><dd>{formatCurrency(selected.settlementAmount)}</dd></div>
              <div><dt>방문 가능</dt><dd>{campaign.visitHours}</dd></div>
              <div><dt>리뷰 마감</dt><dd>사용 후 {campaign.reviewDeadlineHours}시간</dd></div>
            </dl>
            {selected.status === "approved" || selected.status === "completed" ? (
              <div className="completion-state">
                <CheckCircle2 size={17} />
                <span>{statusLabel[selected.status]}</span>
              </div>
            ) : (
              <form className="review-submit" onSubmit={submitReview}>
                <label>
                  리뷰 채널
                  <select value={channel} onChange={(event) => setChannel(event.target.value)}>
                    {campaign.channels.map((item) => (
                      <option key={item} value={item}>
                        {channelLabel[item] ?? item}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  리뷰 URL
                  <input
                    aria-label="리뷰 URL"
                    placeholder="https://blog.example.com/review"
                    value={reviewUrl}
                    onChange={(event) => setReviewUrl(event.target.value)}
                  />
                </label>
                <button className="button button--primary" disabled={isBusy}>
                  {busyAction === "completeApplication" ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                  리뷰 인증 제출
                </button>
              </form>
            )}
          </>
        ) : (
          <div className="empty">홈에서 캠페인을 선택해 체험권을 발급받으세요.</div>
        )}
      </section>
    </div>
  );
}

function ReviewerGrade({ state }: { state: CatchpassState }) {
  const completed = state.applications.filter(
    (application) =>
      application.reviewerName === REVIEWER_NAME &&
      ["completed", "approved"].includes(application.status)
  ).length;

  return (
    <div className="screen-stack">
      <section className="panel panel--ink">
        <div className="grade-hero grade-hero--large">
          <GradeBadge grade={REVIEWER_GRADE} size="hero" inverted />
          <div>
            <p className="eyebrow">Current grade</p>
            <h2>{REVIEWER_GRADE}등급</h2>
            <p>다음 S등급까지 78% 달성</p>
          </div>
        </div>
        <div className="progress progress--light" aria-label="등급 진행률">
          <span style={{ width: "78%" }} />
        </div>
      </section>

      <section className="two-column">
        <BarPanel
          title="등급 상승 조건"
          rows={[
            { label: "완료 리뷰", value: completed + 14 },
            { label: "리뷰 품질 점수", value: 87 },
            { label: "노쇼 없음", value: 100 }
          ]}
        />
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Benefit</p>
              <h2>등급별 혜택</h2>
            </div>
            <Star size={22} />
          </div>
          <div className="benefit-list">
            {[
              ["S", "전 캠페인 우선 노출", "최대 100% 지원"],
              ["A", "상위 체험권 노출", "최대 80% 지원"],
              ["B", "기본 체험권 노출", "최대 60% 지원"],
              ["C", "웰컴 체험권", "최대 40% 지원"]
            ].map(([grade, label, amount]) => (
              <div key={grade}>
                <GradeBadge grade={grade} inverted={grade === REVIEWER_GRADE} />
                <span>
                  <strong>{label}</strong>
                  <small>{amount}</small>
                </span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function ReviewerProfile({ state }: { state: CatchpassState }) {
  const myApplications = state.applications.filter((application) => application.reviewerName === REVIEWER_NAME);
  const pressApplications = myApplications.filter((application) => {
    const campaign = getCampaign(state, application);
    return campaign?.type === "press";
  });

  return (
    <div className="screen-stack">
      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Profile</p>
            <h2>김리뷰</h2>
          </div>
          <GradeBadge grade={REVIEWER_GRADE} />
        </div>
        <div className="profile-list">
          <div><dt>완료 리뷰</dt><dd>14건</dd></div>
          <div><dt>리뷰 점수</dt><dd>892점</dd></div>
          <div><dt>누적 혜택</dt><dd>{formatCurrency(myApplications.reduce((total, item) => total + item.settlementAmount, 0))}</dd></div>
        </div>
      </section>

      <section className="two-column">
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">SNS</p>
              <h2>연동 채널</h2>
            </div>
            <ShieldCheck size={22} />
          </div>
          <div className="menu-list">
            {[
              ["네이버 블로그", "일평균 방문자 1,240명"],
              ["인스타그램", "팔로워 8,420명"],
              ["유튜브", "쇼츠 평균 조회수 18,000회"]
            ].map(([label, detail]) => (
              <button type="button" key={label}>
                <span>
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </span>
                <CheckCircle2 size={16} />
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Press vault</p>
              <h2>기자단 보관소</h2>
            </div>
            <Wallet size={22} />
          </div>
          <div className="rows compact">
            {pressApplications.length ? (
              pressApplications.map((application) => {
                const campaign = getCampaign(state, application);
                return (
                  <div className="select-row" key={application.id}>
                    <span>{campaign?.title}</span>
                    <small>{statusLabel[application.status]} · 정산 예정 {formatCurrency(application.settlementAmount)}</small>
                  </div>
                );
              })
            ) : (
              <div className="empty">진행 중인 기자단 캠페인이 없습니다.</div>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}

function ReviewerCampaignCard({
  campaign,
  application,
  isBusy,
  busyAction,
  onAction,
  onOpenPass
}: {
  campaign: Campaign;
  application?: Application;
  isBusy: boolean;
  busyAction: string;
  onAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  onOpenPass: () => void;
}) {
  const locked = !canJoinCampaign(campaign, REVIEWER_GRADE);
  return (
    <article className={`campaign campaign--reviewer ${locked ? "is-locked" : ""}`}>
      <div className="campaign__top">
        <span className="tag">{typeLabel[campaign.type]}</span>
        <span>{campaign.minGrade}등급부터</span>
      </div>
      <h3>{campaign.title}</h3>
      <p>{campaign.store} · {campaign.neighborhood} · {campaign.category}</p>
      <div className="rating-row">
        <Star size={14} />
        <span>{campaign.rating.toFixed(1)} ({formatNumber(campaign.reviews)})</span>
        <span>{campaign.distance}</span>
      </div>
      <dl className="campaign-detail">
        <div><dt>{campaign.type === "press" ? "정산금" : "지원금"}</dt><dd>{formatCurrency(campaign.reward)}</dd></div>
        <div><dt>잔여</dt><dd>{campaign.slotsLeft}/{campaign.capacity}명</dd></div>
        <div><dt>채널</dt><dd>{channelText(campaign.channels)}</dd></div>
        <div><dt>{campaign.type === "press" ? "게시" : "방문"}</dt><dd>{campaign.visitHours}</dd></div>
      </dl>
      <details className="campaign-guide">
        <summary>리뷰 조건</summary>
        <p>사진 {campaign.requiredMedia.photos}장 · 본문 {campaign.requiredMedia.text}자 · 노출 {campaign.requiredMedia.exposureDays}일</p>
        <p>{campaign.requiredMenus.join(", ")}</p>
        {campaign.ownerNotice ? <p>{campaign.ownerNotice}</p> : null}
      </details>
      {application ? (
        <button className="button button--secondary" type="button" onClick={onOpenPass}>
          <Ticket size={16} />
          {statusLabel[application.status]} 보기
        </button>
      ) : (
        <button
          className="button button--primary"
          type="button"
          disabled={isBusy || locked || campaign.slotsLeft <= 0}
          onClick={() =>
            onAction("applyCampaign", {
              campaignId: campaign.id,
              reviewerName: REVIEWER_NAME,
              reviewerGrade: REVIEWER_GRADE
            })
          }
        >
          {busyAction === "applyCampaign" ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
          {locked ? "등급 부족" : "참여하기"}
        </button>
      )}
    </article>
  );
}

function CampaignCard({
  campaign,
  applications
}: {
  campaign: Campaign;
  applications: Application[];
}) {
  const completed = applications.filter(
    (application) =>
      application.status === "completed" || application.status === "approved"
  ).length;

  return (
    <article className="campaign">
      <div className="campaign__top">
        <span className="tag">{typeLabel[campaign.type]}</span>
        <span>{campaign.minGrade}등급 이상</span>
      </div>
      <h3>{campaign.title}</h3>
      <p>{campaign.store} · {campaign.neighborhood}</p>
      <div className="campaign__meta">
        <strong>{formatCurrency(campaign.reward)}</strong>
        <span>{campaign.capacity - campaign.slotsLeft}/{campaign.capacity}명 신청</span>
      </div>
      <div className="progress" aria-label="모집 진행률">
        <span style={{ width: `${completionRate(campaign)}%` }} />
      </div>
      <div className="grade-offers">
        {campaign.gradeOffers.map((offer) => (
          <span key={offer.grade}>
            <GradeBadge grade={offer.grade} />
            {offer.slotsLeft}/{offer.capacity}
          </span>
        ))}
      </div>
      <div className="campaign__foot">
        <span>{completed}건 리뷰 제출</span>
        <span>{formatTime(campaign.createdAt)}</span>
      </div>
    </article>
  );
}

function GradeBadge({
  grade,
  inverted = false,
  size = "normal"
}: {
  grade: string;
  inverted?: boolean;
  size?: "normal" | "large" | "hero";
}) {
  return <span className={`grade-badge grade-badge--${size} ${inverted ? "is-inverted" : ""}`}>{grade}</span>;
}

function StatusPill({ status }: { status: ApplicationStatus }) {
  return <span className={`status-pill status-pill--${status}`}>{statusLabel[status]}</span>;
}

function QrPattern({ seed }: { seed: string }) {
  const base = seed.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  return (
    <div className="qr-pattern" aria-hidden="true">
      {Array.from({ length: 49 }, (_, index) => (
        <span
          key={index}
          className={(index + base) % 3 === 0 || index % 11 === 0 ? "is-on" : ""}
        />
      ))}
    </div>
  );
}

function ReportCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="panel report-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function BarPanel({
  title,
  rows
}: {
  title: string;
  rows: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Analysis</p>
          <h2>{title}</h2>
        </div>
        <BarChart3 size={22} />
      </div>
      <div className="bar-list">
        {rows.map((row) => (
          <div key={row.label}>
            <span>{row.label}</span>
            <div className="progress">
              <span style={{ width: `${(row.value / max) * 100}%` }} />
            </div>
            <strong>{formatNumber(row.value)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function ServerPanel({
  endpoint,
  draftServerBase,
  lastSync,
  isBusy,
  onDraftServerBase,
  onRefresh,
  onSaveServerBase,
  onReset
}: {
  endpoint: string;
  draftServerBase: string;
  lastSync: string;
  isBusy: boolean;
  onDraftServerBase: (value: string) => void;
  onRefresh: () => void;
  onSaveServerBase: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
}) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Virtual server</p>
          <h2>공유 API</h2>
        </div>
        <Server size={22} />
      </div>
      <form className="server-form" onSubmit={onSaveServerBase}>
        <label>
          서버 주소
          <input
            placeholder="같은 배포에서는 비워둡니다"
            value={draftServerBase}
            onChange={(event) => onDraftServerBase(event.target.value)}
          />
        </label>
        <button className="button button--secondary" type="submit">
          저장
        </button>
      </form>
      <div className="server-meta">
        <span>{endpoint}</span>
        <span>동기화 {lastSync ? formatTime(lastSync) : "대기 중"}</span>
      </div>
      <div className="panel-actions">
        <button className="button button--secondary" type="button" onClick={onRefresh}>
          <RefreshCw size={16} />
          새로고침
        </button>
        <button className="button button--ghost" type="button" disabled={isBusy} onClick={onReset}>
          초기화
        </button>
      </div>
    </section>
  );
}

function ActivityPanel({ activities }: { activities: Activity[] }) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Events</p>
          <h2>실시간 활동</h2>
        </div>
        <Radio size={22} />
      </div>
      <div className="timeline" data-testid="activity-feed">
        {activities.slice(0, 8).map((activity) => (
          <article className="timeline__item" key={activity.id}>
            <span className={`dot dot--${activity.tone}`} />
            <div>
              <p>{activity.title}</p>
              <time>{formatTime(activity.at)}</time>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
