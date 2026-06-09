import type { Job } from "@/lib/types";
import { JobStatusBadge } from "./JobStatusBadge";
import { JobActions } from "./JobActions";
import { Progress } from "@/components/ui";
import { formatCostUsd } from "@/lib/formatCost";
import { getDocumentTypeLabel, getJobDocumentType } from "@/lib/documents";
import styles from "./JobsTable.module.css";

interface JobsTableProps {
  jobs: Job[];
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function progressColor(status: string) {
  return status === "error" ? "red" : status === "done" ? "green" : "blue";
}

export function JobsTable({ jobs }: JobsTableProps) {
  if (jobs.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12H9.75m6 3H9.75m-4.5-9V3.375c0-.621.504-1.125 1.125-1.125h5.25a2.25 2.25 0 0 1 2.25 2.25v1.5a2.25 2.25 0 0 0 2.25 2.25h1.5a2.25 2.25 0 0 1 2.25 2.25V15M4.5 15v4.875c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V15" />
          </svg>
        </div>
        Nenhum job encontrado. Faça um upload para começar.
      </div>
    );
  }

  return (
    <>
      {/* ── Desktop: table view ── */}
      <div className={styles.tableCard}>
        <div className={styles.wrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Arquivo</th>
                <th>Perfil</th>
                <th>Status</th>
                <th>Progresso</th>
                <th>Custo</th>
                <th>Criado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className={styles.filename}>{job.filename ?? "—"}</td>
                  <td>{getDocumentTypeLabel(getJobDocumentType(job))}</td>
                  <td>
                    <JobStatusBadge status={job.status} />
                  </td>
                  <td style={{ minWidth: 120 }}>
                    <Progress
                      value={job.progress ?? 0}
                      showValue
                      color={progressColor(job.status)}
                    />
                  </td>
                  <td className={styles.cost}>
                    {(job as Record<string, unknown>).llmCostUsd != null
                      ? formatCostUsd((job as Record<string, unknown>).llmCostUsd as number)
                      : "—"}
                  </td>
                  <td className={styles.date}>{formatDate(job.createdAt)}</td>
                  <td>
                    <JobActions jobId={job.id} status={job.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile: card view ── */}
      <div className={styles.cardList}>
        {jobs.map((job) => (
          <div key={job.id} className={styles.jobCard}>
            <div className={styles.jobCardHeader}>
              <span className={styles.jobCardFilename}>{job.filename ?? "—"}</span>
              <JobStatusBadge status={job.status} />
            </div>

            <div className={styles.jobCardMeta}>
              <div>
                <div className={styles.jobCardLabel}>Perfil</div>
                <div className={styles.jobCardValue}>{getDocumentTypeLabel(getJobDocumentType(job))}</div>
              </div>
              <div>
                <div className={styles.jobCardLabel}>Criado em</div>
                <div className={styles.jobCardValue}>{formatDate(job.createdAt)}</div>
              </div>
            </div>

            <Progress
              value={job.progress ?? 0}
              showValue
              color={progressColor(job.status)}
            />

            <div className={styles.jobCardActions}>
              <JobActions jobId={job.id} status={job.status} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
