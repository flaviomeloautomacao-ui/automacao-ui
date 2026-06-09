import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getJobDocumentType } from "@/lib/documents";
import { ComplementForm } from "@/components/complement/ComplementForm";
import { AreaComplementForm } from "@/components/complement/AreaComplementForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ComplementPage({ params }: PageProps) {
  const { id } = await params;

  if (!UUID_RE.test(id)) notFound();

  const job = await prisma.job.findUnique({
    where: { id },
    select: {
      id: true,
      profile: true,
      documentType: true,
      documentSchemaVersion: true,
    },
  });

  if (!job) notFound();

  const report = await prisma.report.findUnique({
    where: { jobId: id },
  });

  if (!report) notFound();

  const revisions = await prisma.reportRevision.findMany({
    where: { reportId: report.id },
    orderBy: { version: "asc" },
  });

  const documentType = getJobDocumentType(job);
  const isV2 = job.documentSchemaVersion === "v2";

  const serializedReport = JSON.parse(JSON.stringify(report));
  const serializedRevisions = JSON.parse(JSON.stringify(revisions));

  if (isV2 && documentType === "areas") {
    const areas = await prisma.areaReportArea.findMany({
      where: { reportId: report.id },
      orderBy: { orderIndex: "asc" },
      include: {
        sources: {
          orderBy: { orderIndex: "asc" },
        },
        photos: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const substances = await prisma.areaReportSubstance.findMany({
      where: { reportId: report.id },
      orderBy: { orderIndex: "asc" },
    });

    const references = await prisma.areaReferenceDocument.findMany({
      where: { reportId: report.id },
      orderBy: { orderIndex: "asc" },
    });

    return (
      <main>
        <AreaComplementForm
          jobId={id}
          report={serializedReport}
          revisions={serializedRevisions}
          areas={JSON.parse(JSON.stringify(areas))}
          substances={JSON.parse(JSON.stringify(substances))}
          references={JSON.parse(JSON.stringify(references))}
        />
      </main>
    );
  }

  const equipments = isV2
    ? await prisma.dhaReportEquipment.findMany({
      where: { reportId: report.id },
      orderBy: { orderIndex: "asc" },
      include: {
        images: {
          orderBy: { createdAt: "asc" },
        },
      },
    })
    : await prisma.reportEquipment.findMany({
      where: { reportId: report.id },
      orderBy: { orderIndex: "asc" },
      include: {
        images: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

  return (
    <main>
      <ComplementForm
        jobId={id}
        report={serializedReport}
        equipments={JSON.parse(JSON.stringify(equipments))}
        revisions={serializedRevisions}
      />
    </main>
  );
}
