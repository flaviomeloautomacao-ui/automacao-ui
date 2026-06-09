import { prisma } from "@/lib/prisma";
import { JobsTableLive } from "@/components/jobs/JobsTableLive";
import Link from "next/link";
import { Button } from "@/components/ui";
import { getDatabaseErrorMessage } from "@/lib/databaseError";

export const dynamic = "force-dynamic";

export const metadata = { title: "Histórico — DHA Automação" };

export default async function JobsPage() {
  let jobs: Awaited<ReturnType<typeof prisma.job.findMany>> = [];
  let databaseError: string | null = null;

  try {
    jobs = await prisma.job.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("[JobsPage] Failed to fetch jobs", error);
    databaseError = getDatabaseErrorMessage(error);
  }

  const serializedJobs = JSON.parse(JSON.stringify(jobs));

  return (
    <div>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "var(--space-6)",
        flexWrap: "wrap",
        gap: "var(--space-4)",
      }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--text-primary)" }}>
            Histórico de Laudos
          </h1>
          <p style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)", marginTop: "var(--space-1)" }}>
            Acompanhe o status dos seus processamentos.
          </p>
        </div>
        <Link href="/upload">
          <Button variant="primary">
            + Novo Laudo
          </Button>
        </Link>
      </div>
      <JobsTableLive
        initialJobs={serializedJobs}
        initialError={databaseError}
      />
    </div>
  );
}
