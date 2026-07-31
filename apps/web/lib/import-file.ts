import { operationalCopy } from "@/lib/operational-copy";

/** Prefer ArrayBuffer over FileReader — avoids NotReadableError on some OS/file locks. */
export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function uploadErrorMessage(
  err: unknown,
  fallback: string = operationalCopy.importLoadError,
): string {
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    const msg = (err as { message: string }).message;
    if (/[\u0600-\u06FF]/.test(msg)) return msg;
    if (/could not be read|NotReadableError|read_failed/i.test(msg)) {
      return operationalCopy.importFileReadError;
    }
  }
  return fallback;
}
