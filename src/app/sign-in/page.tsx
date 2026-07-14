import { SignInForm } from "@/features/auth/views/sign-in-form";

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  return <SignInForm searchParamsPromise={searchParams} />;
}
