import { useCallback } from 'react';
import { useDownloads, DownloadJob, PrepareResponse, StatusResponse } from '../contexts/DownloadsContext';
import { prepareFolderDownload, getFolderDownloadStatus } from '../api/folderService';
import { triggerDownloadFromUrl } from '../utils/downloadHelpers';
import { useNotification } from '../contexts/NotificationContext';

const POLL_INTERVAL = 1500;

export interface StartOptions {
  prepareFn?: () => Promise<PrepareResponse>;
  statusFn?: (jobId: string) => Promise<StatusResponse>;
  signal?: AbortSignal;
  /** Override poll interval (ms). Intended for tests. */
  _pollInterval?: number;
}

export function useFolderDownload() {
  const { jobs, addJob, updateJob } = useDownloads();
  const { showNotification } = useNotification();

  const start = useCallback(
    async (folderId: string, folderName: string, options?: StartOptions): Promise<void> => {
      const signal = options?.signal;
      const pollInterval = options?._pollInterval ?? POLL_INTERVAL;
      const prepareFn = options?.prepareFn ?? (() => prepareFolderDownload(folderId));
      const statusFn =
        options?.statusFn ?? ((jobId: string) => getFolderDownloadStatus(folderId, jobId));

      const jobId = `${folderId}-${Date.now()}`;
      const job: DownloadJob = {
        id: jobId,
        folderId,
        folderName,
        status: 'pending',
        createdAt: Date.now(),
        prepareFn,
        statusFn,
      };
      addJob(job);

      try {
        const prepareResult = await prepareFn();
        if (signal?.aborted) return;

        if (prepareResult.status === 'ready' && prepareResult.url) {
          updateJob(jobId, { status: 'ready', url: prepareResult.url, completedAt: Date.now() });
          await triggerDownloadFromUrl(prepareResult.url, `${folderName}.zip`);
          return;
        }

        updateJob(jobId, { status: 'processing' });

        while (!signal?.aborted) {
          await new Promise<void>((resolve) => setTimeout(resolve, pollInterval));
          if (signal?.aborted) break;

          const statusResult = await statusFn(prepareResult.jobId);
          if (signal?.aborted) break;

          if (statusResult.status === 'ready' && statusResult.url) {
            updateJob(jobId, {
              status: 'ready',
              url: statusResult.url,
              completedAt: Date.now(),
            });
            await triggerDownloadFromUrl(statusResult.url, `${folderName}.zip`);
            return;
          }

          if (statusResult.status === 'failed') {
            const errorMsg = statusResult.error ?? 'Download failed';
            updateJob(jobId, { status: 'failed', error: errorMsg, completedAt: Date.now() });
            showNotification(errorMsg, 'error');
            return;
          }
        }

        if (signal?.aborted) {
          updateJob(jobId, { status: 'failed', error: 'Cancelled', completedAt: Date.now() });
        }
      } catch {
        if (signal?.aborted) return;
        const errorMsg = 'Failed to download folder';
        updateJob(jobId, { status: 'failed', error: errorMsg, completedAt: Date.now() });
        showNotification(errorMsg, 'error');
      }
    },
    [addJob, updateJob, showNotification]
  );

  return { start, jobs };
}
