/**
 * Triggers a browser file download from a URL by clicking a hidden anchor.
 *
 * The browser's native download manager handles the transfer, with its own
 * progress UI. The actual save behaviour comes from the **server-side**
 * `Content-Disposition: attachment` header (S3 presigned URLs in this app
 * bake that into the URL via `response-content-disposition`), not from the
 * `download` HTML attribute — which is ignored cross-origin anyway.
 *
 * Critically, this does NOT fetch the bytes through JavaScript. Buffering a
 * multi-GB response into a Blob blocks the tab, shows no progress, and risks
 * OOM on large files.
 */
export async function triggerDownloadFromUrl(url: string, filename?: string): Promise<void> {
  const a = document.createElement('a');
  a.href = url;
  if (filename) a.download = filename; // Hint; cross-origin servers' Content-Disposition wins.
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Triggers a browser download from a Blob (e.g. the streaming-zip fallback
 * when the File System Access API is unavailable).
 */
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
