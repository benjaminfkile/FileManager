import { useState, useRef, useCallback } from 'react';
import { IFile } from '../types';
import { chunkFile } from '../utils/chunkFile';
import {
  initiateUpload,
  getPartUrls,
  uploadPartToUrl,
  completeUpload,
  abortUpload,
  CompletedPart,
} from '../api/chunkedUploadService';
import { getUploadedParts } from '../api/fileService';

export const STORAGE_PREFIX = 'chunkedUpload:';
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface ChunkedUploadOptions {
  file: File;
  folderId?: string | null;
}

export interface PendingResume {
  fileId: string;
  alreadyUploaded: number;
}

interface SavedSession {
  fileId: string;
  fileName: string;
  size: number;
  lastModified: number;
  folderId: string | null;
  completedParts: CompletedPart[];
  savedAt: number;
}

export async function sessionKey(file: File): Promise<string> {
  const input = `${file.name}|${file.size}|${file.lastModified}`;
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (subtle && typeof subtle.digest === 'function') {
    const data = new TextEncoder().encode(input);
    const hashBuf = await subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback FNV-1a — only used when SubtleCrypto is unavailable (e.g. test env).
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function loadSession(key: string): SavedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedSession;
    if (!parsed || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > SESSION_TTL_MS) {
      localStorage.removeItem(STORAGE_PREFIX + key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveSession(key: string, session: SavedSession): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(session));
  } catch {
    // best-effort persistence
  }
}

function clearSession(key: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // best-effort
  }
}

export interface UseChunkedUploadResult {
  upload: (options: ChunkedUploadOptions) => Promise<IFile | null>;
  resume: () => Promise<IFile>;
  discardResume: () => void;
  abort: () => void;
  progress: number;
  isUploading: boolean;
  error: string | null;
  pendingResume: PendingResume | null;
}

export function useChunkedUpload(): UseChunkedUploadResult {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingResume, setPendingResume] = useState<PendingResume | null>(null);

  const fileIdRef = useRef<string | null>(null);
  const abortedRef = useRef(false);
  const sessionKeyRef = useRef<string | null>(null);
  const fileRef = useRef<File | null>(null);
  const folderIdRef = useRef<string | null>(null);
  const savedSessionRef = useRef<SavedSession | null>(null);

  const abort = useCallback(() => {
    abortedRef.current = true;
    if (sessionKeyRef.current) {
      clearSession(sessionKeyRef.current);
    }
  }, []);

  const performUpload = useCallback(
    async (
      file: File,
      folderId: string | null,
      key: string,
      existingFileId: string | null,
      existingParts: CompletedPart[],
    ): Promise<IFile> => {
      setIsUploading(true);
      setError(null);
      abortedRef.current = false;

      let fileId = existingFileId;
      const completedParts: CompletedPart[] = [...existingParts];

      try {
        if (!fileId) {
          const init = await initiateUpload({
            filename: file.name,
            mimeType: file.type,
            size: file.size,
            folderId,
          });
          fileId = init.fileId;
        }
        fileIdRef.current = fileId;

        if (abortedRef.current) {
          await abortUpload(fileId);
          clearSession(key);
          setIsUploading(false);
          throw new Error('Upload aborted');
        }

        const allChunks = chunkFile(file);
        const totalChunks = allChunks.length;
        const completedSet = new Set(completedParts.map((p) => p.partNumber));
        const remaining = allChunks.filter((c) => !completedSet.has(c.partNumber));

        let completedCount = completedParts.length;
        setProgress(totalChunks > 0 ? Math.round((completedCount / totalChunks) * 100) : 0);

        const persist = () => {
          saveSession(key, {
            fileId: fileId as string,
            fileName: file.name,
            size: file.size,
            lastModified: file.lastModified,
            folderId,
            completedParts: [...completedParts],
            savedAt: Date.now(),
          });
        };

        // Persist initial session even with zero new parts, so resume metadata is recoverable
        if (totalChunks > 0) {
          persist();
        }

        // Pre-fetch presigned PUT URLs for every remaining part in one call.
        // Bytes go browser → S3 directly via these URLs; the API never sees them.
        const urlMap = new Map<number, string>();
        if (remaining.length > 0) {
          const urls = await getPartUrls(
            fileId as string,
            remaining.map((c) => c.partNumber),
          );
          for (const u of urls) urlMap.set(u.partNumber, u.url);
        }

        // Hoisted out of the for-loop so it isn't a per-iteration declaration
        // (ESLint's no-loop-func rule otherwise flags closures over mutable
        // outer state like `completedCount`).
        const uploadOneChunk = async (
          chunk: (typeof remaining)[number],
        ): Promise<CompletedPart> => {
          const url = urlMap.get(chunk.partNumber);
          if (!url) {
            throw new Error(
              `Missing presigned URL for part ${chunk.partNumber}`,
            );
          }
          const result = await uploadPartToUrl({
            url,
            partNumber: chunk.partNumber,
            chunk: chunk.blob,
          });
          completedCount++;
          setProgress(Math.round((completedCount / totalChunks) * 100));
          return { partNumber: result.partNumber, etag: result.etag };
        };

        const BATCH_SIZE = 3;
        for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
          if (abortedRef.current) {
            await abortUpload(fileId);
            clearSession(key);
            setIsUploading(false);
            throw new Error('Upload aborted');
          }

          const batch = remaining.slice(i, i + BATCH_SIZE);
          const batchResults = await Promise.all(batch.map(uploadOneChunk));
          completedParts.push(...batchResults);
          persist();
        }

        if (abortedRef.current) {
          await abortUpload(fileId);
          clearSession(key);
          setIsUploading(false);
          throw new Error('Upload aborted');
        }

        const result = await completeUpload(fileId, completedParts);
        clearSession(key);
        setProgress(100);
        setIsUploading(false);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message !== 'Upload aborted' && fileId) {
          try {
            await abortUpload(fileId);
          } catch {
            // best-effort abort, ignore errors
          }
          clearSession(key);
        }
        setError(message);
        setIsUploading(false);
        throw err;
      }
    },
    [],
  );

  const upload = useCallback(
    async (options: ChunkedUploadOptions): Promise<IFile | null> => {
      const { file, folderId } = options;
      const normalizedFolderId = folderId ?? null;

      setProgress(0);
      setError(null);
      setPendingResume(null);
      abortedRef.current = false;
      fileIdRef.current = null;
      savedSessionRef.current = null;

      const key = await sessionKey(file);
      sessionKeyRef.current = key;
      fileRef.current = file;
      folderIdRef.current = normalizedFolderId;

      const saved = loadSession(key);
      if (
        saved &&
        saved.fileName === file.name &&
        saved.size === file.size &&
        saved.lastModified === file.lastModified
      ) {
        try {
          const { parts } = await getUploadedParts(saved.fileId);
          const partNumbers = new Set(parts.map((p) => p.partNumber));
          const validParts = saved.completedParts.filter((p) => partNumbers.has(p.partNumber));
          savedSessionRef.current = { ...saved, completedParts: validParts };
          setPendingResume({
            fileId: saved.fileId,
            alreadyUploaded: validParts.length,
          });
          return null;
        } catch {
          clearSession(key);
        }
      }

      return performUpload(file, normalizedFolderId, key, null, []);
    },
    [performUpload],
  );

  const resume = useCallback(async (): Promise<IFile> => {
    const session = savedSessionRef.current;
    const file = fileRef.current;
    const key = sessionKeyRef.current;
    if (!session || !file || !key) {
      throw new Error('No resumable session');
    }
    setPendingResume(null);
    return performUpload(file, session.folderId, key, session.fileId, session.completedParts);
  }, [performUpload]);

  const discardResume = useCallback(() => {
    if (sessionKeyRef.current) {
      clearSession(sessionKeyRef.current);
    }
    savedSessionRef.current = null;
    setPendingResume(null);
  }, []);

  return {
    upload,
    resume,
    discardResume,
    abort,
    progress,
    isUploading,
    error,
    pendingResume,
  };
}
