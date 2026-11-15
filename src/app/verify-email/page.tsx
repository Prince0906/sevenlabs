import { RecoveryForm } from "@/features/auth/views/recovery-form";

export default function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  return <RecoveryForm mode="verify" searchParams={searchParams} />;
}
