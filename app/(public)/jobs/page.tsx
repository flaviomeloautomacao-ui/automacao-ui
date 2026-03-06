import { Card, CardHeader, CardBody } from "@/components/ui";
import { JobsTableLive } from "@/components/jobs/JobsTableLive";
import type { ApiResponse, Job } from "@/lib/types";

/**
 * Server Component — /jobs
 *
 * Busca a lista de jobs pelo route handler e renderiza a tabela.
 * O client component `JobsTableLive` cuida de auto-refresh enquanto
 * houver jobs ativos (queued / processing).
 */

async function fetchJobs(): Promise<Job[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/jobs?limit=50`, {
    cache: "no-store",
  });

  if (!res.ok) return [];

  const json: ApiResponse<Job[]> = await res.json();
  return json.error ? [] : json.data;
}

export default async function JobsPage() {
  const jobs = await fetchJobs();

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1rem" }}>
      <Card>
        <CardHeader>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Jobs</h1>
          <p style={{ color: "#6b7280", marginTop: "0.25rem" }}>
            Acompanhe o status dos seus processamentos.
          </p>
        </CardHeader>
        <CardBody>
          <JobsTableLive initialJobs={jobs} />
        </CardBody>
      </Card>
    </main>
  );
}
