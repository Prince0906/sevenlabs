import { RecoveryForm } from "@/features/auth/views/recovery-form";

export default function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  return <RecoveryForm mode="request" searchParams={searchParams} />;
}
