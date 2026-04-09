/** Triggers a browser file download from a URL (e.g. signed S3 URL). */
export function triggerDownloadFromUrl(url: string, filename?: string): void {
  const a = document.createElement('a');
  a.href = url;
  if (filename) {
    a.download = filename;
  }
  document.body.appendChild(a);
  a.click();
  a.remove();
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
