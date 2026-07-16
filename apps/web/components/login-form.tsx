"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { operationalCopy } from "@/lib/operational-copy";
import { loginAction } from "@/lib/login-action";

function mapAuthError(code: string | undefined): string {
  if (code === "INACTIVE_ACCOUNT") {
    return operationalCopy.inactiveAccount;
  }
  if (code === "PROVIDER_UNAVAILABLE") {
    return operationalCopy.ldapUnavailable;
  }
  return operationalCopy.invalidCredentials;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    if (callbackUrl) {
      formData.set("callbackUrl", callbackUrl);
    }
    startTransition(async () => {
      const result = await loginAction(formData);
      if (result?.error) {
        setError(mapAuthError(result.code));
        return;
      }
      router.replace(result.landingPath);
      router.refresh();
    });
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="text-heading">دیوان</h1>
        <p className="text-body text-muted-foreground">
          {operationalCopy.loginPrompt}
        </p>
      </header>

      <form
        action={onSubmit}
        className="space-y-4 rounded-md border border-border bg-card p-6 text-card-foreground shadow-xs"
      >
        <div className="space-y-2">
          <label htmlFor="username" className="text-body-medium">
            نام کاربری
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            disabled={pending}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-body text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-body-medium">
            رمز عبور
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-body text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {error ? (
          <p role="alert" className="text-body text-destructive">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={pending}
        >
          {pending ? "در حال ورود…" : "ورود"}
        </Button>
      </form>
    </div>
  );
}
