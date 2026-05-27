import { SignUpForm } from "@/features/auth/components/sign-up-form";

export default function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  return <SignUpForm searchParamsPromise={searchParams} />;
}
