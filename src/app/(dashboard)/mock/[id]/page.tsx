import { MockReportView } from "@/features/mock-panel/views/mock-report-view";

export default async function MockSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MockReportView sessionId={id} />;
}
