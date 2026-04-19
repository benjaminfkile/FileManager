import { useState, useRef, useCallback } from 'react';
import { IFile } from '../types';
import { chunkFile } from '../utils/chunkFile';
import {
  initiateUpload,
  uploadPart,
  completeUpload,
  abortUpload,
  CompletedPart,
} from '../api/chunkedUploadService';

export interface ChunkedUploadOptions {
  file: File;
  folderId?: string | null;
}

export function useChunkedUpload(): {
  upload: (options: ChunkedUploadOptions) => Promise<IFile>;
  abort: () => void;
  progress: number;
  isUploading: boolean;
  error: string | null;
} {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileIdRef = useRef<string | null>(null);
  const abortedRef = useRef(false);

  const abort = useCallback(() => {
    abortedRef.current = true;
  }, []);

  const upload = useCallback(async (options: ChunkedUploadOptions): Promise<IFile> => {
    const { file, folderId } = options;

    setIsUploading(true);
    setProgress(0);
    setError(null);
    abortedRef.current = false;
    fileIdRef.current = null;

    try {
      const { fileId } = await initiateUpload({
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        folderId,
      });
      fileIdRef.current = fileId;

      if (abortedRef.current) {
        await abortUpload(fileId);
        setIsUploading(false);
        throw new Error('Upload aborted');
      }

      const chunks = chunkFile(file);
      const totalChunks = chunks.length;
      let completedCount = 0;
      const parts: CompletedPart[] = [];

      const BATCH_SIZE = 3;
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        if (abortedRef.current) {
          await abortUpload(fileId);
          setIsUploading(false);
          throw new Error('Upload aborted');
        }

        const batch = chunks.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (chunk) => {
            const result = await uploadPart({
              fileId,
              partNumber: chunk.partNumber,
              chunk: chunk.blob,
            });
            completedCount++;
            setProgress(Math.round((completedCount / totalChunks) * 100));
            return { partNumber: result.partNumber, etag: result.etag };
          })
        );
        parts.push(...batchResults);
      }

      if (abortedRef.current) {
        await abortUpload(fileId);
        setIsUploading(false);
        throw new Error('Upload aborted');
      }

      const result = await completeUpload(fileId, parts);
      setProgress(100);
      setIsUploading(false);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message !== 'Upload aborted' && fileIdRef.current) {
        try {
          await abortUpload(fileIdRef.current);
        } catch {
          // best-effort abort, ignore errors
        }
      }
      setError(message);
      setIsUploading(false);
      throw err;
    }
  }, []);

  return { upload, abort, progress, isUploading, error };
}
