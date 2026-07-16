"use server";

import {
  getActiveCoarseRoleByUsername,
  resolvePostLoginPath,
} from "@divan/identity-access";
import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { signIn, signOut } from "@/auth";

export type LoginActionResult =
  | { error: true; code: string }
  | { error?: false; landingPath: string };

/**
 * Server action: verify via Auth.js Credentials → @divan/identity-access.
 * Returns role landing (or safe callbackUrl) for client navigation.
 *
 * Note: do not call auth() in the same request after signIn — the new session
 * cookie is not reliably readable yet; resolve role via username lookup instead.
 */
export async function loginAction(
  formData: FormData,
): Promise<LoginActionResult> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "").trim() || null;

  try {
    await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    const coarseRole = await getActiveCoarseRoleByUsername(username);
    if (!coarseRole) {
      // signIn already set a session cookie — clear it so UI error matches auth state.
      await signOut({ redirect: false });
      return { error: true, code: "INVALID_CREDENTIALS" };
    }

    return {
      landingPath: resolvePostLoginPath(coarseRole, callbackUrl),
    };
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
