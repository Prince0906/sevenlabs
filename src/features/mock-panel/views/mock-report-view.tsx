"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { MockReport } from "@sevenlabs/shared-types";
import { PageHeader } from "@/components/page-header";
import { pageTransition } from "@/lib/motion";
import { ReportBody } from "../components/report-body";
import { Deliberating, FailedScreen } from "../components/report-states";
import { OutcomeCapture } from "../components/outcome-capture";
import * as api from "../lib/mock-api";

/** Standalone report route (/mock/[id]) — polls until COMPLETED or FAILED. */
export function MockReportView({ sessionId }: { sessionId: string }) {
  const [view, setView] = useState<
    { kind: "loading" } | { kind: "debrief" } | { kind: "ready"; report: MockReport } | { kind: "failed"; reason?: string }
  >({ kind: "loading" });
  const etagRef = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      const r = await api.getReport(sessionId, etagRef.current);
      if (stopped) return;
      if (r.kind === "completed") {
        etagRef.current = r.etag;
        setView({ kind: "ready", report: r.report });
      } else if (r.kind === "failed") {
        setView({ kind: "failed", reason: r.reason });
      } else if (r.kind === "debrief") {
        setView((v) => (v.kind === "ready" ? v : { kind: "debrief" }));
        timer = setTimeout(poll, r.pollAfterMs);
      } else if (r.kind === "error") {
        setView({ kind: "failed" });
      }
    };
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background text-foreground">
      <PageHeader title="Panel Verdict" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <motion.div
          variants={pageTransition}
          initial="initial"
          animate="animate"
          className="mx-auto w-full max-w-3xl p-6 lg:p-12"
        >
          {view.kind === "ready" ? (
            <>
              <ReportBody report={view.report} />
              {/* The real-outcome ask lives on the RETURNING-visit report (this
                  standalone route), not the just-finished live flow (D13). */}
              <div className="mt-10">
                <OutcomeCapture sessionId={sessionId} />
              </div>
            </>
          ) : view.kind === "failed" ? (
            <FailedScreen reason={view.reason} />
          ) : (
            <Deliberating />
          )}
        </motion.div>
      </div>
    </div>
  );
}
