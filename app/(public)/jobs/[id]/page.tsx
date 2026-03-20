import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { JobDetail } from "@/components/jobs/JobDetail";

export const dynamic = "force-dynamic";

interface JobDetailPageProps {
  params: Promise<{ id: string }>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Server Component — /jobs/[id]
 *
 * Busca o job diretamente via Prisma e repassa ao
 * client component `JobDetail`, que cuida do polling.
 */
export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = await params;

  if (!UUID_RE.test(id)) notFound();

  const job = await prisma.job.findUnique({
    where: { id },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  if (!job) notFound();

  const { steps, ...jobData } = job;

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1rem" }}>
      <JobDetail
        initialJob={jobData}
        initialSteps={steps.length > 0 ? steps : null}
      />
    </main>
  );
}
