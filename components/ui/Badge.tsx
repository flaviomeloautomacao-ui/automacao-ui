import { type HTMLAttributes, type ReactNode } from "react";
import styles from "./Badge.module.css";

type BadgeVariant = "info" | "success" | "warning" | "error" | "neutral";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
}

export function Badge({
  variant = "neutral",
  className,
  children,
  ...rest
}: BadgeProps) {
  const cls = [styles.badge, styles[variant], className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}
