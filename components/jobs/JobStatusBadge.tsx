import { Badge } from "@/components/ui";

type JobStatus = "queued" | "awaiting_complement" | "processing" | "done" | "error";

const STATUS_MAP: Record<
  JobStatus,
  { label: string; variant: "info" | "warning" | "success" | "error" | "neutral" }
> = {
  queued: { label: "Na fila", variant: "info" },
  awaiting_complement: { label: "Aguardando complementação", variant: "warning" },
  processing: { label: "Processando", variant: "warning" },
  done: { label: "Concluído", variant: "success" },
  error: { label: "Erro", variant: "error" },
};

interface JobStatusBadgeProps {
  status: string;
}

export function JobStatusBadge({ status }: JobStatusBadgeProps) {
  const mapped = STATUS_MAP[status as JobStatus] ?? {
    label: status,
    variant: "info" as const,
  };

  return <Badge variant={mapped.variant}>{mapped.label}</Badge>;
}
