/**
 * Client-side base64 → file download (Story 6.5 / 9.1).
 * Shared by export artifact panel and sample workbook catalogue.
 */
export function downloadBase64File(
  base64: string,
  filename: string,
  contentType: string,
): void {
  if (!base64) return;
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    return;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  try { a.click(); } finally {
    a.remove();
    // Keep the URL alive while the browser starts consuming the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
