import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardBody } from "@/components/ui";
import { JobsTableLive } from "@/components/jobs/JobsTableLive";

/**
 * Server Component — /jobs
 *
 * Busca a lista de jobs diretamente via Prisma e renderiza a tabela.
 * O client component `JobsTableLive` cuida de auto-refresh enquanto
 * houver jobs ativos (queued / processing).
 */

export default async function JobsPage() {
  const jobs = await prisma.job.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
  });

  // Serialize dates for client component
  const serializedJobs = JSON.parse(JSON.stringify(jobs));

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
          <JobsTableLive initialJobs={serializedJobs} />
        </CardBody>
      </Card>
    </main>
  );
}
