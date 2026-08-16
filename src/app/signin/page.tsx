import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "./signin-form";

export const metadata: Metadata = {
  title: "Sign in | Commons Hub Brussels",
  description: "Sign in with your email or your Discord account.",
};

export default function SignInPage() {
  return (
    <div className="min-h-screen py-16">
      <div className="max-w-md mx-auto px-4">
        <Suspense fallback={null}>
          <SignInForm />
        </Suspense>
      </div>
    </div>
  );
}
