import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg",
          },
        }}
      />
    </div>
  );
}
