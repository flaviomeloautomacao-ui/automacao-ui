import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  ComplementForm,
} from "@/components/complement/ComplementForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Server Component — /jobs/[id]/complement
 *
 * Busca report + equipments diretamente via Prisma.
 */
export default async function ComplementPage({ params }: PageProps) {
  const { id } = await params;

  if (!UUID_RE.test(id)) notFound();

  const report = await prisma.report.findUnique({
    where: { jobId: id },
  });

  if (!report) notFound();

  const equipments = await prisma.reportEquipment.findMany({
    where: { reportId: report.id },
    orderBy: { orderIndex: "asc" },
    include: {
      images: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // Serialize dates to ISO strings for client component
  const serializedReport = JSON.parse(JSON.stringify(report));
  const serializedEquipments = JSON.parse(JSON.stringify(equipments));

  return (
    <main>
      <ComplementForm
        jobId={id}
        report={serializedReport}
        equipments={serializedEquipments}
      />
    </main>
  );
}
