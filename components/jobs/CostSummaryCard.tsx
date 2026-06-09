"use client";

import { useState, useCallback } from "react";
import { formatCostUsd, formatTokens, formatDuration } from "@/lib/formatCost";
import type { ApiResponse, CostBreakdownResponse } from "@/lib/types";
import styles from "./CostSummaryCard.module.css";

interface CostSummaryCardProps {
  jobId: string;
  /** Custo pré-agregado do job (exibição rápida antes de buscar breakdown) */
  llmCostUsd?: number | null;
  llmTotalTokens?: number | null;
  llmCallCount?: number | null;
}

export function CostSummaryCard({
  jobId,
  llmCostUsd,
  llmTotalTokens,
  llmCallCount,
}: CostSummaryCardProps) {
  const [breakdown, setBreakdown] = useState<CostBreakdownResponse | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const hasCost = (llmCostUsd != null && llmCostUsd > 0) || (llmCallCount != null && llmCallCount > 0);

  const fetchBreakdown = useCallback(async () => {
    if (breakdown) return; // already fetched
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/costs`);
      if (!res.ok) return;
      const json: ApiResponse<CostBreakdownResponse> = await res.json();
      if (!json.error && json.data) {
        setBreakdown(json.data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [jobId, breakdown]);

  const handleOpenModal = () => {
    fetchBreakdown();
    setShowModal(true);
  };

  if (!hasCost) return null;

  return (
    <>
      <div className={styles.costCard}>
        <div className={styles.costHeader}>
          <span className={styles.costTitle}>
            <svg className={styles.costIcon} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            Custos LLM
          </span>
          <button className={styles.detailsBtn} onClick={handleOpenModal}>
            Ver detalhes
          </button>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{formatCostUsd(llmCostUsd)}</div>
            <div className={styles.statLabel}>Custo Total</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{formatTokens(llmTotalTokens)}</div>
            <div className={styles.statLabel}>Tokens</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{llmCallCount ?? 0}</div>
            <div className={styles.statLabel}>Chamadas</div>
          </div>
        </div>
      </div>

      {/* ── Breakdown Modal ── */}
      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Breakdown de Custos LLM</h3>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {loading && <div className={styles.empty}>Carregando...</div>}

            {!loading && breakdown && (
              <>
                {/* By Step */}
                {Object.keys(breakdown.byStep).length > 0 && (
                  <>
                    <h4 className={styles.sectionTitle}>Por Etapa</h4>
                    <table className={styles.breakdownTable}>
                      <thead>
                        <tr>
                          <th>Etapa</th>
                          <th>Custo</th>
                          <th>Tokens</th>
                          <th>Chamadas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(breakdown.byStep).map(([step, agg]) => (
                          <tr key={step}>
                            <td>{formatStepName(step)}</td>
                            <td>{formatCostUsd(agg.costUsd)}</td>
                            <td>{formatTokens(agg.tokens)}</td>
                            <td>{agg.calls}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {/* By Equipment */}
                {Object.keys(breakdown.byEquipment).length > 0 && (
                  <>
                    <h4 className={styles.sectionTitle}>Por Equipamento</h4>
                    <table className={styles.breakdownTable}>
                      <thead>
                        <tr>
                          <th>Equipamento</th>
                          <th>Custo</th>
                          <th>Tokens</th>
                          <th>Chamadas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(breakdown.byEquipment).map(([equip, agg]) => (
                          <tr key={equip}>
                            <td>{equip}</td>
                            <td>{formatCostUsd(agg.costUsd)}</td>
                            <td>{formatTokens(agg.tokens)}</td>
                            <td>{agg.calls}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {/* Pipeline Version */}
                {breakdown.pipelineVersion && (
                  <>
                    <h4 className={styles.sectionTitle}>Versão do Pipeline</h4>
                    <div className={styles.versionInfo}>
                      <div className={styles.versionRow}>
                        <span>
                          <span className={styles.versionLabel}>Modelo:</span>
                          <span className={styles.versionValue}>{breakdown.pipelineVersion.llmModel}</span>
                        </span>
                        <span>
                          <span className={styles.versionLabel}>Embedding:</span>
                          <span className={styles.versionValue}>{breakdown.pipelineVersion.embeddingModel}</span>
                        </span>
                        <span>
                          <span className={styles.versionLabel}>RAG:</span>
                          <span className={styles.versionValue}>{breakdown.pipelineVersion.ragStrategy}</span>
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {/* Registros individuais */}
                {breakdown.records.length > 0 && (
                  <>
                    <h4 className={styles.sectionTitle}>
                      Registros Individuais ({breakdown.records.length})
                    </h4>
                    <table className={styles.breakdownTable}>
                      <thead>
                        <tr>
                          <th>Etapa</th>
                          <th>Modelo</th>
                          <th>Custo</th>
                          <th>Tokens</th>
                          <th>Duração</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {breakdown.records.map((rec) => (
                          <tr key={rec.id}>
                            <td>{formatStepName(rec.step)}</td>
                            <td>{rec.model.split("/").pop()}</td>
                            <td>{formatCostUsd(rec.estimatedCostUsd)}</td>
                            <td>{formatTokens(rec.totalTokens)}</td>
                            <td>{formatDuration(rec.durationMs)}</td>
                            <td>{rec.success ? "✓" : "✗"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </>
            )}

            {!loading && !breakdown && (
              <div className={styles.empty}>Nenhum dado de custo encontrado.</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Traduz nomes de step internos para exibição legível */
function formatStepName(step: string): string {
  const names: Record<string, string> = {
    global_sections: "Seções Globais",
    per_equipment_narrative: "Narrativas por Equipamento",
    rag_embedding: "Embedding RAG",
    format_retry: "Retry de Formato",
  };
  return names[step] ?? step;
}
