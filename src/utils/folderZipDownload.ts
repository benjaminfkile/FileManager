import { downloadZip } from 'client-zip';

export interface ManifestEntry {
  zipPath: string;
  url: string;
  size: number;
}

export interface ZipDownloadOptions {
  /** Manifest entries to include in the zip. */
  files: ManifestEntry[];
  /** Suggested filename for the saved zip (without extension is fine). */
  folderName: string;
  /** Aborts in-flight fetches when the user cancels. */
  signal?: AbortSignal;
  /**
   * Called as bytes flow through. Receives the number of bytes added since
   * the last call. Use to drive a progress UI.
   */
  onProgress?: (bytes: number) => void;
}

/**
 * Streams a zip of presigned-URL files directly to the user's disk.
 *
 * Each entry's `url` is fetched (browser → S3, no API in the path), piped
 * through `client-zip`, and the resulting zip is written via:
 *   1. File System Access API (`showSaveFilePicker`) — true streaming, no
 *      buffering. Available in Chromium browsers.
 *   2. Blob fallback — assemble the zip in memory and trigger an <a download>.
 *      Used by Safari/Firefox until they ship the FS Access API.
 */
export async function streamZipToDisk(opts: ZipDownloadOptions): Promise<void> {
  const { files, folderName, signal, onProgress } = opts;
  const suggestedName = `${folderName}.zip`;

  const zipResponse = downloadZip(buildEntryStream(files, signal, onProgress));

  // Preferred path: stream through the File System Access API.
  const showPicker = (window as unknown as {
    showSaveFilePicker?: (options: {
      suggestedName?: string;
      types?: Array<{ description?: string; accept: Record<string, string[]> }>;
    }) => Promise<FileSystemFileHandle>;
  }).showSaveFilePicker;

  if (typeof showPicker === 'function') {
    let handle: FileSystemFileHandle;
    try {
      handle = await showPicker({
        suggestedName,
        types: [{ description: 'Zip archive', accept: { 'application/zip': ['.zip'] } }],
      });
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return; // user cancelled
      throw err;
    }
    // `createWritable` is part of the File System Access API. Not yet in
    // TypeScript's stock DOM lib, so we cast the handle to access it.
    const writable = await (
      handle as unknown as { createWritable: () => Promise<WritableStream<Uint8Array>> }
    ).createWritable();
    if (!zipResponse.body) throw new Error('Zip stream has no body');
    await zipResponse.body.pipeTo(writable, { signal });
    return;
  }

  // Fallback: buffer to a Blob and trigger a normal download.
  const blob = await zipResponse.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Yields one entry per file. Each entry's `input` is a `Response` whose body
 * is a stream piped through a byte-counting transform so callers can show
 * real download progress.
 */
async function* buildEntryStream(
  files: ManifestEntry[],
  signal: AbortSignal | undefined,
  onProgress: ((bytes: number) => void) | undefined
): AsyncGenerator<{ name: string; input: Response | string; lastModified?: Date }, void, void> {
  for (const entry of files) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    // Special handling for empty folder placeholders (zipPath ending in "/")
    // — emit a zero-byte entry so empty directories are preserved.
    if (entry.zipPath.endsWith('/')) {
      yield { name: entry.zipPath, input: '' };
      continue;
    }

    const response = await fetch(entry.url, { signal });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${entry.zipPath}: ${response.status} ${response.statusText}`
      );
    }

    const body = response.body;
    const trackedInput =
      body && onProgress
        ? new Response(body.pipeThrough(makeProgressStream(onProgress)), {
            headers: response.headers,
          })
        : response;

    yield {
      name: entry.zipPath,
      input: trackedInput,
      lastModified: new Date(),
    };
  }
}

function makeProgressStream(onChunk: (bytes: number) => void): TransformStream<Uint8Array, Uint8Array> {
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      onChunk(chunk.byteLength);
      controller.enqueue(chunk);
    },
  });
}
