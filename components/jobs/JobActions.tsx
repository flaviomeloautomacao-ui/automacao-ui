import Link from "next/link";
import { Button } from "@/components/ui";

interface JobActionsProps {
  jobId: string;
  status: string;
}

export function JobActions({ jobId, status }: JobActionsProps) {
  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      <Link href={`/jobs/${jobId}`}>
        <Button variant="secondary" size="sm">
          Detalhes
        </Button>
      </Link>

      {status === "done" && (
        <Button variant="primary" size="sm" disabled>
          Download
        </Button>
      )}
    </div>
  );
}
