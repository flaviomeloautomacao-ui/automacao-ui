import type { JobStep } from "@/lib/types";
import styles from "./Stepper.module.css";

interface StepperProps {
  steps: JobStep[];
}

const STATUS_ICONS: Record<string, string> = {
  queued: "–",
  processing: "⟳",
  done: "✓",
  error: "✕",
};

function formatTime(date: string | Date | null | undefined): string | null {
  if (!date) return null;
  return new Date(date).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function Stepper({ steps }: StepperProps) {
  return (
    <div className={styles.stepper}>
      {steps.map((step) => (
        <div
          key={step.id}
          className={`${styles.step} ${styles[step.status] ?? ""}`}
        >
          <div className={`${styles.icon} ${styles[step.status] ?? ""}`}>
            {STATUS_ICONS[step.status] ?? "–"}
          </div>
          <div className={styles.content}>
            <div className={`${styles.label} ${styles[step.status] ?? ""}`}>
              {step.label}
            </div>
            <div className={styles.meta}>
              {step.status === "processing" && step.startedAt && (
                <span>Iniciado às {formatTime(step.startedAt)}</span>
              )}
              {step.status === "done" && step.completedAt && (
                <span>Concluído às {formatTime(step.completedAt)}</span>
              )}
              {step.status === "queued" && <span>Aguardando</span>}
            </div>
            {step.status === "error" && step.errorMessage && (
              <div className={styles.errorMsg}>{step.errorMessage}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
