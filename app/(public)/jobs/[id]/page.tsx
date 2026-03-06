import { notFound } from "next/navigation";
import { JobDetail } from "@/components/jobs/JobDetail";
import type { ApiResponse, JobDetailResponse } from "@/lib/types";

interface JobDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Server Component — /jobs/[id]
 *
 * Busca o job initial via fetch server-side e repassa ao
 * client component `JobDetail`, que cuida do polling.
 */

async function fetchJob(id: string): Promise<JobDetailResponse | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/jobs/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;

  const json: ApiResponse<JobDetailResponse> = await res.json();
  return json.error ? null : json.data;
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = await params;

  const result = await fetchJob(id);

  if (!result) {
    notFound();
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1rem" }}>
      <JobDetail initialJob={result.job} initialSteps={result.steps} />
    </main>
  );
}
