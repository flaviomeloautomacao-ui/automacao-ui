import { LlmCostsDashboard } from "@/components/jobs/LlmCostsDashboard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Observabilidade LLM — DHA Automação" };

export default function LlmCostsPage() {
  return <LlmCostsDashboard />;
}
