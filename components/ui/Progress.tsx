import styles from "./Progress.module.css";

type ProgressColor = "blue" | "green" | "red" | "yellow";

interface ProgressProps {
  /** Percentage 0–100 */
  value: number;
  /** Optional label shown above the bar */
  label?: string;
  /** Show percentage text */
  showValue?: boolean;
  color?: ProgressColor;
  className?: string;
}

export function Progress({
  value,
  label,
  showValue = false,
  color = "blue",
  className,
}: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className={styles.label}>
          {label && <span>{label}</span>}
          {showValue && <span>{Math.round(clamped)}%</span>}
        </div>
      )}
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progresso"}
      >
        <div
          className={`${styles.bar} ${styles[color]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
