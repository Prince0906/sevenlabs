import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LandingView } from "@/features/marketing/landing-view";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }
  return <LandingView />;
}
