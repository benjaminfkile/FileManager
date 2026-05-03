import { useCallback, useRef } from 'react';
import { useDownloads, DownloadJob } from '../contexts/DownloadsContext';
import {
  getFolderDownloadManifest,
  DownloadManifest,
} from '../api/folderService';
import { streamZipToDisk } from '../utils/folderZipDownload';
import { useNotification } from '../contexts/NotificationContext';

export interface StartOptions {
  /**
   * Custom manifest fetcher. The default hits the protected
   * `/api/folders/:id/download-manifest` endpoint; share-link callers pass
   * a fetcher that hits the public share-link endpoint instead.
   */
  manifestFn?: () => Promise<DownloadManifest>;
  /**
   * Custom progress UI throttle, in ms. Updates flush at most this often.
   * Defaults to 250ms. Tests can pass 0 for synchronous flushing.
   */
  _progressFlushMs?: number;
}

const DEFAULT_PROGRESS_FLUSH_MS = 250;

export function useFolderDownload() {
  const { jobs, addJob, updateJob } = useDownloads();
  const { showNotification } = useNotification();
  // Track last-emitted progress per job so the UI doesn't re-render on every chunk.
  const lastFlushRef = useRef<Map<string, number>>(new Map());

  const start = useCallback(
    async (folderId: string, folderName: string, options?: StartOptions): Promise<void> => {
      const manifestFn =
        options?.manifestFn ?? (() => getFolderDownloadManifest(folderId));
      const flushMs = options?._progressFlushMs ?? DEFAULT_PROGRESS_FLUSH_MS;

      const jobId = `${folderId}-${Date.now()}`;
      const controller = new AbortController();

      const retry = () => {
        start(folderId, folderName, options);
      };

      const job: DownloadJob = {
        id: jobId,
        folderId,
        folderName,
        status: 'pending',
        loadedBytes: 0,
        totalBytes: 0,
        createdAt: Date.now(),
        abort: () => controller.abort(),
        retry,
      };
      addJob(job);

      try {
        const manifest = await manifestFn();
        if (controller.signal.aborted) return;

        if (manifest.files.length === 0) {
          updateJob(jobId, {
            status: 'failed',
            error: 'Folder is empty',
            completedAt: Date.now(),
          });
          showNotification('Folder is empty', 'error');
          return;
        }

        updateJob(jobId, {
          status: 'processing',
          totalBytes: manifest.totalBytes,
        });

        let pending = 0;
        let lastFlush = Date.now();
        lastFlushRef.current.set(jobId, 0);

        const flush = () => {
          if (pending === 0) return;
          const prev = lastFlushRef.current.get(jobId) ?? 0;
          const next = prev + pending;
          lastFlushRef.current.set(jobId, next);
          pending = 0;
          updateJob(jobId, { loadedBytes: next });
        };

        await streamZipToDisk({
          files: manifest.files,
          folderName: manifest.folderName,
          signal: controller.signal,
          onProgress: (bytes) => {
            pending += bytes;
            const now = Date.now();
            if (flushMs === 0 || now - lastFlush >= flushMs) {
              lastFlush = now;
              flush();
            }
          },
        });

        flush();
        if (controller.signal.aborted) {
          updateJob(jobId, {
            status: 'failed',
            error: 'Cancelled',
            completedAt: Date.now(),
          });
          return;
        }

        updateJob(jobId, {
          status: 'ready',
          completedAt: Date.now(),
        });
      } catch (err) {
        const isAbort =
          (err as DOMException)?.name === 'AbortError' || controller.signal.aborted;
        if (isAbort) {
          updateJob(jobId, {
            status: 'failed',
            error: 'Cancelled',
            completedAt: Date.now(),
          });
          return;
        }
        const message = (err as Error)?.message ?? 'Failed to download folder';
        updateJob(jobId, {
          status: 'failed',
          error: message,
          completedAt: Date.now(),
        });
        showNotification(message, 'error');
      } finally {
        lastFlushRef.current.delete(jobId);
      }
    },
    [addJob, updateJob, showNotification]
  );

  return { start, jobs };
}
