"use client";

import { useSearchParams } from "next/navigation";

import { PersonnelEventForm } from "@/components/personnel/personnel-event-form";

/**
 * Suspense boundary child — reads ?person= for register-tab prefill (Story 4b.7).
 * No remount key: form applies inbound person when clean, or leave-guard first when dirty
 * (Stay keeps draft + restores URL; never silent person swap).
 */
export function PersonnelEventFormHost() {
  const searchParams = useSearchParams();
  const person = searchParams.get("person")?.trim() || undefined;

  return <PersonnelEventForm initialPersonId={person} />;
}
