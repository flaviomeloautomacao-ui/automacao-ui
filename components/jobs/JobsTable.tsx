import type { Job } from "@/lib/types";
import { JobStatusBadge } from "./JobStatusBadge";
import { JobActions } from "./JobActions";
import { Progress } from "@/components/ui";
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

export function JobsTable({ jobs }: JobsTableProps) {
  if (jobs.length === 0) {
    return (
      <p className={styles.empty}>
        Nenhum job encontrado. Faça um upload para começar.
      </p>
    );
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Arquivo</th>
            <th>Perfil</th>
            <th>Status</th>
            <th>Progresso</th>
            <th>Criado em</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td className={styles.filename}>{job.filename ?? "—"}</td>
              <td>{job.profile}</td>
              <td>
                <JobStatusBadge status={job.status} />
              </td>
              <td style={{ minWidth: 120 }}>
                <Progress
                  value={job.progress ?? 0}
                  showValue
                  color={
                    job.status === "error"
                      ? "red"
                      : job.status === "done"
                        ? "green"
                        : "blue"
                  }
                />
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
  );
}
