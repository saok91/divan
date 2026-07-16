"use server";

import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { signIn } from "@/auth";

export type LoginActionResult =
  | { error: true; code: string }
  | undefined;

/**
 * Server action: verify via Auth.js Credentials → @divan/identity-access.
 * Does not duplicate password checks in the UI layer.
 */
export async function loginAction(
  formData: FormData,
): Promise<LoginActionResult> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", {
      username,
      password,
      redirect: false,
    });
    return undefined;
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    if (error instanceof AuthError) {
      const code =
        "code" in error && typeof error.code === "string"
          ? error.code
          : "INVALID_CREDENTIALS";
      return { error: true, code };
    }
    return { error: true, code: "INVALID_CREDENTIALS" };
  }
}
