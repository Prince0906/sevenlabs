import { notFound } from "next/navigation";
import { PanelPreview } from "@/features/mock-panel/components/panel-preview";

// DEV-ONLY visual preview of the warm-editorial panel redesign — renders every
// state (intro, live, verdict, deliberating, recovery) against mock data so the
// look can be reviewed without a live OpenAI key or microphone. Delete together
// with panel-preview.tsx once the redesign is signed off.
export default function MockPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PanelPreview />;
}
