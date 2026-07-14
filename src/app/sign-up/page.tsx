import { SignUpForm } from "@/features/auth/views/sign-up-form";

export default function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  return <SignUpForm searchParamsPromise={searchParams} />;
}
