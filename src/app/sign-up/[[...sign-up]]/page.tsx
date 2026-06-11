/** Inscription — rendue seulement quand l'auth Clerk est active. */
import { SignUp } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { isAuthEnabled } from "@/server/auth";

export default function SignUpPage() {
  if (!isAuthEnabled()) redirect("/dashboard");
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50">
      <SignUp />
    </div>
  );
}
