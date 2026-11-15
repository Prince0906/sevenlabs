import { RecoveryForm } from "@/features/auth/views/recovery-form";

export default function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  return <RecoveryForm mode="reset" searchParams={searchParams} />;
}
