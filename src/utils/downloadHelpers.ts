/**
 * Triggers a browser file download from a URL.
 * For cross-origin URLs (e.g. CloudFront signed URLs), the `download` attribute
 * is ignored by browsers, so we fetch the file as a blob and use an object URL.
 */
export async function triggerDownloadFromUrl(url: string, filename?: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    const blob = await response.blob();
    triggerDownloadFromBlob(blob, filename ?? 'download');
  } catch {
    // Fallback: open in new tab if fetch fails (e.g. network restriction)
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/** Triggers a browser download from a Blob (e.g. folder zip). */
export function triggerDownloadFromBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
