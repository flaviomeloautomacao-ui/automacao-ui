"use client";

/**
 * LlmCostsDashboard — Painel de Observabilidade de Custos LLM
 *
 * Visão global com:
 *  - KPI cards (custo total, tokens, chamadas, avg por job)
 *  - Timeline de custos por dia (bar chart)
 *  - Tabela por modelo
 *  - Tabela por etapa do pipeline
 *  - Tabela por job (com link para detalhes)
 *  - Registros individuais (drill-down expandível)
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatCostUsd, formatTokens, formatDuration } from "@/lib/formatCost";
import type { ApiResponse } from "@/lib/types";
import styles from "./LlmCostsDashboard.module.css";

// ─── Types ────────────────────────────────────────────────

interface LlmCostsSummary {
  callCount: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  avgDurationMs: number;
  jobCount: number;
  errorCount: number;
  avgCostPerJob: number;
  avgTokensPerCall: number;
  periodDays: number;
}

interface ModelAggregate {
  model: string;
  provider: string;
  calls: number;
  tokens: number;
  costUsd: number;
  avgDurationMs: number;
  errors: number;
}

interface StepAggregate {
  step: string;
  callType: string;
  calls: number;
  tokens: number;
  costUsd: number;
  avgDurationMs: number;
  errors: number;
}

interface JobAggregate {
  jobId: string;
  filename: string | null;
  profile: string;
  status: string;
  jobCreatedAt: string | null;
  calls: number;
  tokens: number;
  costUsd: number;
  avgDurationMs: number;
  errors: number;
}

interface TimelinePoint {
  day: string;
  calls: number;
  tokens: number;
  costUsd: number;
  jobs: number;
}

interface RecentRecord {
  id: string;
  jobId: string;
  jobFilename: string | null;
  flow: string;
  step: string;
  provider: string;
  model: string;
  callType: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  tokensSource: string;
  estimatedCostUsd: number;
  durationMs: number;
  success: boolean;
  errorMessage: string | null;
  retryAttempt: number | null;
  equipmentName: string | null;
  promptChars: number;
  responseChars: number;
  createdAt: string;
}

interface DashboardData {
  summary: LlmCostsSummary;
  byModel: ModelAggregate[];
  byStep: StepAggregate[];
  byJob: JobAggregate[];
  timeline: TimelinePoint[];
  recentRecords: RecentRecord[];
}

// ─── Helpers ──────────────────────────────────────────────

const STEP_NAMES: Record<string, string> = {
  global_sections: "Seções Globais",
  per_equipment_narrative: "Narrativas p/ Equipamento",
  rag_embedding: "Embedding RAG",
  format_retry: "Retry de Formato",
};

function stepLabel(step: string): string {
  return STEP_NAMES[step] ?? step;
}

function statusClass(status: string): string {
  switch (status) {
    case "done": return styles.statusDone;
    case "error": return styles.statusError;
    case "processing": return styles.statusProcessing;
    default: return styles.statusDefault;
  }
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function fullDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// ─── Component ────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

export function LlmCostsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [showAllJobs, setShowAllJobs] = useState(false);

  const fetchData = useCallback(async (period: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/llm-costs?days=${period}&limit=100`);
      if (!res.ok) return;
      const json: ApiResponse<DashboardData> = await res.json();
      if (!json.error && json.data) {
        setData(json.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

  if (loading && !data) {
    return <div className={styles.loading}>Carregando dados de observabilidade...</div>;
  }

  if (!data) {
    return <div className={styles.empty}>Nenhum dado de uso LLM encontrado.</div>;
  }

  const { summary, byModel, byStep, byJob, timeline, recentRecords } = data;
  const maxTimelineCost = Math.max(...timeline.map((t) => t.costUsd), 0.001);

  const visibleRecords = showAllRecords ? recentRecords : recentRecords.slice(0, 10);
  const visibleJobs = showAllJobs ? byJob : byJob.slice(0, 10);

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Observabilidade LLM</h1>
          <p className={styles.pageDesc}>
            Visão consolidada de custos e uso de IA em todos os processos.
          </p>
        </div>
        <div className={styles.periodSelector}>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              className={`${styles.periodBtn} ${days === opt.days ? styles.periodBtnActive : ""}`}
              onClick={() => setDays(opt.days)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <svg className={styles.kpiIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            Custo Total
          </div>
          <div className={styles.kpiValue}>{formatCostUsd(summary.totalCostUsd)}</div>
          <div className={styles.kpiSub}>
            ~{formatCostUsd(summary.avgCostPerJob)} por job ({summary.jobCount} jobs)
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <svg className={styles.kpiIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            Tokens Consumidos
          </div>
          <div className={styles.kpiValue}>{formatTokens(summary.totalTokens)}</div>
          <div className={styles.kpiSub}>
            Input: {formatTokens(summary.inputTokens)} / Output: {formatTokens(summary.outputTokens)}
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <svg className={styles.kpiIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            Chamadas LLM
          </div>
          <div className={styles.kpiValue}>{summary.callCount}</div>
          <div className={styles.kpiSub}>
            ~{summary.avgTokensPerCall} tokens/chamada | {summary.errorCount} erros
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <svg className={styles.kpiIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Latência Média
          </div>
          <div className={styles.kpiValue}>{formatDuration(summary.avgDurationMs)}</div>
          <div className={styles.kpiSub}>
            Período: últimos {summary.periodDays} dias
          </div>
        </div>
      </div>

      {/* ── Timeline + By Model ── */}
      <div className={styles.panelsRow}>
        {/* Timeline */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>
              Custo Diário
              <span className={styles.panelBadge}>{timeline.length} dias</span>
            </span>
          </div>
          <div className={styles.panelBody}>
            {timeline.length > 0 ? (
              <>
                <div className={styles.timelineChart}>
                  {timeline.map((t) => (
                    <div
                      key={t.day}
                      className={styles.timelineBar}
                      style={{ height: `${Math.max(4, (t.costUsd / maxTimelineCost) * 100)}%` }}
                    >
                      <div className={styles.timelineTooltip}>
                        <strong>{shortDate(t.day)}</strong><br />
                        Custo: {formatCostUsd(t.costUsd)}<br />
                        Tokens: {formatTokens(t.tokens)}<br />
                        Chamadas: {t.calls} | Jobs: {t.jobs}
                      </div>
                    </div>
                  ))}
                </div>
                <div className={styles.timelineLabels}>
                  <span className={styles.timelineLabel}>
                    {timeline.length > 0 ? shortDate(timeline[0].day) : ""}
                  </span>
                  <span className={styles.timelineLabel}>
                    {timeline.length > 0 ? shortDate(timeline[timeline.length - 1].day) : ""}
                  </span>
                </div>
              </>
            ) : (
              <div className={styles.empty}>Sem dados no período.</div>
            )}
          </div>
        </div>

        {/* By Model */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>
              Por Modelo
              <span className={styles.panelBadge}>{byModel.length}</span>
            </span>
          </div>
          <div className={styles.panelBody}>
            {byModel.length > 0 ? (
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th>Custo</th>
                    <th>Tokens</th>
                    <th>Chamadas</th>
                    <th>Latência</th>
                  </tr>
                </thead>
                <tbody>
                  {byModel.map((m) => {
                    const pct = summary.totalCostUsd > 0 ? (m.costUsd / summary.totalCostUsd) * 100 : 0;
                    return (
                      <tr key={`${m.provider}-${m.model}`}>
                        <td>
                          <div className={styles.monoCell}>{m.model.split("/").pop()}</div>
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{m.provider}</div>
                        </td>
                        <td>
                          <div className={styles.costBarWrap}>
                            <div className={styles.costBar}>
                              <div className={styles.costBarFill} style={{ width: `${pct}%` }} />
                            </div>
                            <span className={styles.costBarValue}>{formatCostUsd(m.costUsd)}</span>
                          </div>
                        </td>
                        <td className={styles.monoCell}>{formatTokens(m.tokens)}</td>
                        <td>{m.calls}</td>
                        <td className={styles.monoCell}>{formatDuration(m.avgDurationMs)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className={styles.empty}>Sem dados.</div>
            )}
          </div>
        </div>
      </div>

      {/* ── By Step + By Job ── */}
      <div className={styles.panelsRow}>
        {/* By Step */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>
              Por Etapa do Pipeline
              <span className={styles.panelBadge}>{byStep.length}</span>
            </span>
          </div>
          <div className={styles.panelBody}>
            {byStep.length > 0 ? (
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Etapa</th>
                    <th>Tipo</th>
                    <th>Custo</th>
                    <th>Tokens</th>
                    <th>Chamadas</th>
                    <th>Erros</th>
                  </tr>
                </thead>
                <tbody>
                  {byStep.map((s) => (
                    <tr key={`${s.step}-${s.callType}`}>
                      <td>{stepLabel(s.step)}</td>
                      <td>
                        <span className={styles.statusDefault}>{s.callType}</span>
                      </td>
                      <td className={styles.costCell}>{formatCostUsd(s.costUsd)}</td>
                      <td className={styles.monoCell}>{formatTokens(s.tokens)}</td>
                      <td>{s.calls}</td>
                      <td>{s.errors > 0 ? <span className={styles.errorBadge} /> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.empty}>Sem dados.</div>
            )}
          </div>
        </div>

        {/* By Job */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>
              Por Job
              <span className={styles.panelBadge}>{byJob.length}</span>
            </span>
            {byJob.length > 10 && (
              <button
                className={styles.expandBtn}
                onClick={() => setShowAllJobs(!showAllJobs)}
              >
                {showAllJobs ? "Mostrar menos" : `Ver todos (${byJob.length})`}
              </button>
            )}
          </div>
          <div className={styles.panelBody}>
            {byJob.length > 0 ? (
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Status</th>
                    <th>Custo</th>
                    <th>Tokens</th>
                    <th>Chamadas</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleJobs.map((j) => (
                    <tr key={j.jobId}>
                      <td>
                        <Link href={`/jobs/${j.jobId}`} style={{ color: "var(--accent)", textDecoration: "none" }}>
                          {j.filename ?? j.jobId.slice(0, 8)}
                        </Link>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                          {j.profile} {j.jobCreatedAt ? `· ${shortDate(j.jobCreatedAt)}` : ""}
                        </div>
                      </td>
                      <td><span className={statusClass(j.status)}>{j.status}</span></td>
                      <td className={styles.costCell}>{formatCostUsd(j.costUsd)}</td>
                      <td className={styles.monoCell}>{formatTokens(j.tokens)}</td>
                      <td>{j.calls}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.empty}>Sem dados.</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Recent Records (drill-down) ── */}
      <div className={styles.panelFull}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>
            Registros Individuais
            <span className={styles.panelBadge}>{recentRecords.length}</span>
          </span>
          {recentRecords.length > 10 && (
            <button
              className={styles.expandBtn}
              onClick={() => setShowAllRecords(!showAllRecords)}
            >
              {showAllRecords ? "Mostrar resumo" : `Ver todos (${recentRecords.length})`}
            </button>
          )}
        </div>
        <div className={styles.panelBody}>
          {recentRecords.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Job</th>
                    <th>Etapa</th>
                    <th>Modelo</th>
                    <th>Tipo</th>
                    <th>Input</th>
                    <th>Output</th>
                    <th>Custo</th>
                    <th>Duração</th>
                    <th>Status</th>
                    <th>Equipamento</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.map((rec) => (
                    <tr key={rec.id}>
                      <td className={styles.monoCell} style={{ whiteSpace: "nowrap" }}>
                        {fullDate(rec.createdAt)}
                      </td>
                      <td>
                        <Link href={`/jobs/${rec.jobId}`} style={{ color: "var(--accent)", textDecoration: "none", fontSize: "var(--text-xs)" }}>
                          {rec.jobFilename ?? rec.jobId.slice(0, 8)}
                        </Link>
                      </td>
                      <td>{stepLabel(rec.step)}</td>
                      <td className={styles.monoCell}>{rec.model.split("/").pop()}</td>
                      <td><span className={styles.statusDefault}>{rec.callType}</span></td>
                      <td className={styles.monoCell}>{formatTokens(rec.inputTokens)}</td>
                      <td className={styles.monoCell}>{formatTokens(rec.outputTokens)}</td>
                      <td className={styles.costCell}>{formatCostUsd(rec.estimatedCostUsd)}</td>
                      <td className={styles.monoCell}>{formatDuration(rec.durationMs)}</td>
                      <td>
                        <span className={rec.success ? styles.successBadge : styles.errorBadge} />
                      </td>
                      <td style={{ fontSize: "var(--text-xs)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {rec.equipmentName ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.empty}>Sem registros individuais no período.</div>
          )}
        </div>
      </div>
    </div>
  );
}
