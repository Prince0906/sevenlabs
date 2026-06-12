import { PageHeader } from "@/components/page-header";
import { KeyManagement } from "../components/key-management";

export function SettingsView() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background text-foreground">
      <PageHeader title="Settings" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl space-y-8 p-6 lg:p-10">
          <section className="space-y-4">
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight">API key</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Bring your own OpenAI key to run unlimited, full-length panels on your own account.
              </p>
            </div>
            <KeyManagement />
          </section>
        </div>
      </div>
    </div>
  );
}
