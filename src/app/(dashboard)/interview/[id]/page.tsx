import { ReportView } from "@/features/interview/views/report-view";

export default async function MockSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReportView sessionId={id} />;
}
