"use client";

import {
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Loader2,
  Plus,
  Radio,
  RefreshCw,
  Send,
  Server,
  Store,
  Ticket,
  UserRoundCheck
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Role = "owner" | "reviewer";
type CampaignType = "visit" | "press";
type CampaignStatus = "open" | "closed";
type ApplicationStatus = "applied" | "completed" | "approved";
type Tone = "info" | "success" | "warning";

type Campaign = {
  id: string;
  title: string;
  store: string;
  type: CampaignType;
  minGrade: string;
  reward: number;
  capacity: number;
  slotsLeft: number;
  status: CampaignStatus;
  channels: string[];
  createdAt: string;
};

type Application = {
  id: string;
  campaignId: string;
  reviewerName: string;
  reviewerGrade: string;
  status: ApplicationStatus;
  reviewUrl: string;
  appliedAt: string;
  completedAt: string | null;
  approvedAt?: string;
};

type Activity = {
  id: string;
  at: string;
  actor: Role;
  title: string;
  tone: Tone;
};

type CatchpassState = {
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
};

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
  totalApplications: 0
};

const roleCopy = {
  owner: {
    title: "사장님용",
    subtitle: "캠페인을 생성하고 체험단 완료 제출을 확인합니다.",
    href: "/owner"
  },
  reviewer: {
    title: "체험단용",
    subtitle: "노출된 캠페인을 신청하고 완료 URL을 제출합니다.",
    href: "/reviewer"
  }
};

const typeLabel: Record<CampaignType, string> = {
  visit: "방문형",
  press: "기사형"
};

const statusLabel: Record<ApplicationStatus, string> = {
  applied: "신청됨",
  completed: "완료 제출",
  approved: "사장님 확인"
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(value);
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
      setSummary(payload.summary);
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
        setSummary(next.summary);
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
            체험단
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">{roleCopy[role].title}</p>
          <h1>{roleCopy[role].subtitle}</h1>
        </div>
        <div className="server-chip" data-testid="server-status">
          {isLoading ? <Loader2 className="spin" size={16} /> : <Radio size={16} />}
          <span>{error ? "연결 확인 필요" : "가상 서버 연결됨"}</span>
        </div>
      </section>

      <section className="metrics" aria-label="연동 현황">
        <Metric
          icon={<Store size={18} />}
          label="모집 캠페인"
          value={`${summary.activeCampaigns}개`}
        />
        <Metric
          icon={<Ticket size={18} />}
          label="남은 체험권"
          value={`${summary.availableSlots}장`}
        />
        <Metric
          icon={<ClipboardCheck size={18} />}
          label="완료 확인"
          value={`${summary.pendingCompletions}건`}
        />
        <Metric
          icon={<UserRoundCheck size={18} />}
          label="승인 완료"
          value={`${summary.approvedCompletions}건`}
        />
      </section>

      {error ? <div className="banner banner--error">{error}</div> : null}

      {role === "owner" ? (
        <OwnerPortal
          state={state}
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
  icon: React.ReactNode;
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

function OwnerPortal({
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
    title: "성수 팝업 테이스팅",
    store: "레어그라운드",
    type: "visit",
    minGrade: "B",
    reward: "35000",
    capacity: "5"
  });

  const completed = state.applications.filter(
    (application) => application.status === "completed"
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onAction("createCampaign", {
      ...form,
      reward: Number(form.reward),
      capacity: Number(form.capacity),
      channels: form.type === "press" ? ["blog"] : ["blog", "instagram"]
    });
  };

  return (
    <section className="content-grid">
      <form className="panel form-panel" onSubmit={handleSubmit}>
        <div className="panel__header">
          <div>
            <p className="eyebrow">Campaign</p>
            <h2>새 캠페인 생성</h2>
          </div>
          <CircleDollarSign size={22} />
        </div>

        <label>
          캠페인명
          <input
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
          />
        </label>
        <label>
          매장명
          <input
            value={form.store}
            onChange={(event) =>
              setForm((current) => ({ ...current, store: event.target.value }))
            }
          />
        </label>
        <div className="field-row">
          <label>
            유형
            <select
              value={form.type}
              onChange={(event) =>
                setForm((current) => ({ ...current, type: event.target.value }))
              }
            >
              <option value="visit">방문형</option>
              <option value="press">기사형</option>
            </select>
          </label>
          <label>
            최소 등급
            <select
              value={form.minGrade}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  minGrade: event.target.value
                }))
              }
            >
              <option value="S">S</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="N">N</option>
            </select>
          </label>
        </div>
        <div className="field-row">
          <label>
            지원금
            <input
              type="number"
              min="10000"
              step="5000"
              value={form.reward}
              onChange={(event) =>
                setForm((current) => ({ ...current, reward: event.target.value }))
              }
            />
          </label>
          <label>
            모집 인원
            <input
              type="number"
              min="1"
              max="30"
              value={form.capacity}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  capacity: event.target.value
                }))
              }
            />
          </label>
        </div>
        <button className="button button--primary" disabled={isBusy}>
          {busyAction === "createCampaign" ? (
            <Loader2 className="spin" size={16} />
          ) : (
            <Plus size={16} />
          )}
          캠페인 생성
        </button>
      </form>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Live</p>
            <h2>체험단 완료 확인</h2>
          </div>
          <ClipboardCheck size={22} />
        </div>
        <div className="rows" data-testid="owner-completions">
          {completed.length ? (
            completed.map((application) => {
              const campaign = state.campaigns.find(
                (item) => item.id === application.campaignId
              );
              return (
                <article className="row" key={application.id}>
                  <div>
                    <span className="tag tag--green">완료 제출</span>
                    <h3>{campaign?.title ?? "캠페인"}</h3>
                    <p>
                      {application.reviewerName} · {application.reviewUrl}
                    </p>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="완료 확인"
                    disabled={isBusy}
                    onClick={() =>
                      onAction("approveApplication", {
                        applicationId: application.id
                      })
                    }
                  >
                    <CheckCircle2 size={18} />
                  </button>
                </article>
              );
            })
          ) : (
            <div className="empty">대기 중인 완료 제출이 없습니다.</div>
          )}
        </div>
      </section>

      <section className="panel panel--wide">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Owner dashboard</p>
            <h2>진행 중 캠페인</h2>
          </div>
          <Store size={22} />
        </div>
        <div className="campaign-grid" data-testid="owner-campaigns">
          {state.campaigns.map((campaign) => (
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
    </section>
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
  const reviewerName = "리뷰어 2048";
  const reviewerGrade = "A";
  const [reviewUrls, setReviewUrls] = useState<Record<string, string>>({});
  const myApplications = state.applications.filter(
    (application) => application.reviewerName === reviewerName
  );

  const applicationByCampaign = new Map(
    myApplications.map((application) => [application.campaignId, application])
  );

  return (
    <section className="content-grid">
      <section className="panel reviewer-card">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Reviewer</p>
            <h2>{reviewerName}</h2>
          </div>
          <span className="grade-badge">{reviewerGrade}</span>
        </div>
        <dl className="profile-list">
          <div>
            <dt>진행 중</dt>
            <dd>{myApplications.filter((item) => item.status === "applied").length}건</dd>
          </div>
          <div>
            <dt>제출 완료</dt>
            <dd>
              {
                myApplications.filter(
                  (item) => item.status === "completed" || item.status === "approved"
                ).length
              }
              건
            </dd>
          </div>
          <div>
            <dt>노출 가능</dt>
            <dd>{state.campaigns.filter((item) => item.status === "open").length}개</dd>
          </div>
        </dl>
      </section>

      <section className="panel panel--wide">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Campaigns</p>
            <h2>노출된 캠페인</h2>
          </div>
          <Ticket size={22} />
        </div>
        <div className="campaign-grid" data-testid="reviewer-campaigns">
          {state.campaigns.map((campaign) => {
            const application = applicationByCampaign.get(campaign.id);
            return (
              <article className="campaign" key={campaign.id}>
                <div className="campaign__top">
                  <span className="tag">{typeLabel[campaign.type]}</span>
                  <span>{campaign.minGrade}등급 이상</span>
                </div>
                <h3>{campaign.title}</h3>
                <p>{campaign.store}</p>
                <div className="campaign__meta">
                  <strong>{formatCurrency(campaign.reward)}</strong>
                  <span>{campaign.slotsLeft}/{campaign.capacity}장 남음</span>
                </div>
                {application ? (
                  <CompletionForm
                    application={application}
                    isBusy={isBusy}
                    busyAction={busyAction}
                    value={reviewUrls[application.id] || ""}
                    onChange={(value) =>
                      setReviewUrls((current) => ({
                        ...current,
                        [application.id]: value
                      }))
                    }
                    onComplete={() =>
                      onAction("completeApplication", {
                        applicationId: application.id,
                        reviewUrl:
                          reviewUrls[application.id] ||
                          "https://blog.example.com/reviewer-2048"
                      })
                    }
                  />
                ) : (
                  <button
                    className="button button--primary"
                    disabled={isBusy || campaign.slotsLeft <= 0}
                    onClick={() =>
                      onAction("applyCampaign", {
                        campaignId: campaign.id,
                        reviewerName,
                        reviewerGrade
                      })
                    }
                  >
                    {busyAction === "applyCampaign" ? (
                      <Loader2 className="spin" size={16} />
                    ) : (
                      <Send size={16} />
                    )}
                    참여 신청
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function CompletionForm({
  application,
  isBusy,
  busyAction,
  value,
  onChange,
  onComplete
}: {
  application: Application;
  isBusy: boolean;
  busyAction: string;
  value: string;
  onChange: (value: string) => void;
  onComplete: () => void;
}) {
  if (application.status !== "applied") {
    return (
      <div className="completion-state">
        <CheckCircle2 size={17} />
        <span>{statusLabel[application.status]}</span>
      </div>
    );
  }

  return (
    <div className="complete-form">
      <input
        aria-label="리뷰 URL"
        placeholder="리뷰 URL"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button className="button button--secondary" disabled={isBusy} onClick={onComplete}>
        {busyAction === "completeApplication" ? (
          <Loader2 className="spin" size={16} />
        ) : (
          <CheckCircle2 size={16} />
        )}
        완료 제출
      </button>
    </div>
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
      <p>{campaign.store}</p>
      <div className="campaign__meta">
        <strong>{formatCurrency(campaign.reward)}</strong>
        <span>{campaign.capacity - campaign.slotsLeft}/{campaign.capacity}명 신청</span>
      </div>
      <div className="progress" aria-label="모집 진행률">
        <span
          style={{
            width: `${Math.min(
              100,
              ((campaign.capacity - campaign.slotsLeft) / campaign.capacity) * 100
            )}%`
          }}
        />
      </div>
      <div className="campaign__foot">
        <span>{completed}건 완료</span>
        <span>{formatTime(campaign.createdAt)}</span>
      </div>
    </article>
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
            placeholder="같은 배포에서는 비워둠"
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
        <button className="button button--secondary" onClick={onRefresh}>
          <RefreshCw size={16} />
          새로고침
        </button>
        <button className="button button--ghost" disabled={isBusy} onClick={onReset}>
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
        {activities.slice(0, 6).map((activity) => (
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
