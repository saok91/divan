import { Suspense } from "react";

import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md space-y-6 text-center">
          <h1 className="text-heading">دیوان</h1>
          <p className="text-body text-muted-foreground">در حال بارگذاری…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
