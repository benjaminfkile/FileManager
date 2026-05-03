import { renderHook, act } from '@testing-library/react';
import {
  useChunkedUpload,
  sessionKey,
  STORAGE_PREFIX,
  SESSION_TTL_MS,
} from './useChunkedUpload';
import * as chunkedUploadService from '../api/chunkedUploadService';
import * as fileService from '../api/fileService';
import * as chunkFileModule from '../utils/chunkFile';
import { IFile } from '../types';

jest.mock('../lib/cognitoClient', () => ({}));
jest.mock('../api/apiClient', () => ({ default: {} }));
jest.mock('../api/chunkedUploadService');
jest.mock('../api/fileService');
jest.mock('../utils/chunkFile');

const mockedService = chunkedUploadService as jest.Mocked<typeof chunkedUploadService>;
const mockedFileService = fileService as jest.Mocked<typeof fileService>;
const mockedChunkFile = chunkFileModule as jest.Mocked<typeof chunkFileModule>;

function makeFile(name = 'test.txt', size = 30, lastModified = 1700000000000): File {
  const file = new File(['a'.repeat(size)], name, {
    type: 'text/plain',
    lastModified,
  });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

const mockIFile: IFile = {
  id: 'file-1',
  user_id: 'user-1',
  folder_id: null,
  name: 'test.txt',
  s3_key: 'uploads/test.txt',
  size_bytes: 30,
  mime_type: 'text/plain',
  is_deleted: false,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function makeChunks(count: number): chunkFileModule.FileChunk[] {
  return Array.from({ length: count }, (_, i) => ({
    blob: new Blob(['chunk']),
    partNumber: i + 1,
    start: i * 10,
    end: (i + 1) * 10,
  }));
}

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  // Default getPartUrls behaviour: hand back a synthetic presigned URL per
  // requested partNumber. Tests exercising the upload loop assume this.
  mockedService.getPartUrls.mockImplementation(
    async (_fileId: string, partNumbers: number[]) =>
      partNumbers.map((p) => ({ partNumber: p, url: `https://s3.example/put?p=${p}` })),
  );
});

describe('useChunkedUpload', () => {
  it('successfully uploads a multi-chunk file', async () => {
    const chunks = makeChunks(4);
    mockedChunkFile.chunkFile.mockReturnValue(chunks);
    mockedService.initiateUpload.mockResolvedValue({
      uploadId: 'upload-1',
      fileId: 'file-1',
      key: 'key-1',
    });
    mockedService.uploadPartToUrl.mockImplementation(async ({ partNumber }) => ({
      partNumber,
      etag: `etag-${partNumber}`,
    }));
    mockedService.completeUpload.mockResolvedValue(mockIFile);

    const { result } = renderHook(() => useChunkedUpload());

    let uploadResult: IFile | null | undefined;
    await act(async () => {
      uploadResult = await result.current.upload({ file: makeFile() });
    });

    expect(uploadResult).toEqual(mockIFile);
    expect(result.current.progress).toBe(100);
    expect(result.current.isUploading).toBe(false);
    expect(result.current.error).toBeNull();

    expect(mockedService.initiateUpload).toHaveBeenCalledWith({
      filename: 'test.txt',
      mimeType: 'text/plain',
      size: 30,
      folderId: null,
    });
    expect(mockedService.uploadPartToUrl).toHaveBeenCalledTimes(4);
    expect(mockedService.completeUpload).toHaveBeenCalledWith('file-1', [
      { partNumber: 1, etag: 'etag-1' },
      { partNumber: 2, etag: 'etag-2' },
      { partNumber: 3, etag: 'etag-3' },
      { partNumber: 4, etag: 'etag-4' },
    ]);
    // localStorage cleared on success
    expect(localStorage.length).toBe(0);
  });

  it('calls abortUpload and rejects when abort() is called mid-upload', async () => {
    const chunks = makeChunks(6);
    mockedChunkFile.chunkFile.mockReturnValue(chunks);
    mockedService.initiateUpload.mockResolvedValue({
      uploadId: 'upload-1',
      fileId: 'file-1',
      key: 'key-1',
    });

    let uploadPartCallCount = 0;
    mockedService.uploadPartToUrl.mockImplementation(async ({ partNumber }) => {
      uploadPartCallCount++;
      return { partNumber, etag: `etag-${partNumber}` };
    });
    mockedService.abortUpload.mockResolvedValue(undefined);

    const { result } = renderHook(() => useChunkedUpload());

    const originalUploadPart = mockedService.uploadPartToUrl.getMockImplementation()!;
    mockedService.uploadPartToUrl.mockImplementation(async (payload) => {
      const res = await originalUploadPart(payload);
      if (uploadPartCallCount >= 3) {
        result.current.abort();
      }
      return res;
    });

    await act(async () => {
      await expect(result.current.upload({ file: makeFile() })).rejects.toThrow('Upload aborted');
    });

    expect(mockedService.abortUpload).toHaveBeenCalledWith('file-1');
    expect(mockedService.completeUpload).not.toHaveBeenCalled();
    expect(result.current.isUploading).toBe(false);
    // localStorage cleared on abort
    expect(localStorage.length).toBe(0);
  });

  it('aborts and sets error when uploadPart fails', async () => {
    const chunks = makeChunks(3);
    mockedChunkFile.chunkFile.mockReturnValue(chunks);
    mockedService.initiateUpload.mockResolvedValue({
      uploadId: 'upload-1',
      fileId: 'file-1',
      key: 'key-1',
    });
    mockedService.uploadPartToUrl.mockRejectedValue(new Error('Network error'));
    mockedService.abortUpload.mockResolvedValue(undefined);

    const { result } = renderHook(() => useChunkedUpload());

    await act(async () => {
      await expect(result.current.upload({ file: makeFile() })).rejects.toThrow('Network error');
    });

    expect(mockedService.abortUpload).toHaveBeenCalledWith('file-1');
    expect(result.current.error).toBe('Network error');
    expect(result.current.isUploading).toBe(false);
    expect(mockedService.completeUpload).not.toHaveBeenCalled();
  });

  it('increments progress correctly as parts complete', async () => {
    const chunks = makeChunks(4);
    mockedChunkFile.chunkFile.mockReturnValue(chunks);
    mockedService.initiateUpload.mockResolvedValue({
      uploadId: 'upload-1',
      fileId: 'file-1',
      key: 'key-1',
    });

    const progressValues: number[] = [];
    let resolvers: Array<(val: chunkedUploadService.UploadPartResponse) => void> = [];

    mockedService.uploadPartToUrl.mockImplementation(({ partNumber }) => {
      return new Promise((resolve) => {
        resolvers.push(() => resolve({ partNumber, etag: `etag-${partNumber}` }));
      });
    });
    mockedService.completeUpload.mockResolvedValue(mockIFile);

    const { result } = renderHook(() => useChunkedUpload());

    let uploadPromise: Promise<IFile | null>;
    act(() => {
      uploadPromise = result.current.upload({ file: makeFile() });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(resolvers.length).toBe(3);

    await act(async () => {
      resolvers[0]({ partNumber: 1, etag: 'etag-1' });
      await new Promise((r) => setTimeout(r, 0));
    });
    progressValues.push(result.current.progress);

    await act(async () => {
      resolvers[1]({ partNumber: 2, etag: 'etag-2' });
      await new Promise((r) => setTimeout(r, 0));
    });
    progressValues.push(result.current.progress);

    await act(async () => {
      resolvers[2]({ partNumber: 3, etag: 'etag-3' });
      await new Promise((r) => setTimeout(r, 0));
    });
    progressValues.push(result.current.progress);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(resolvers.length).toBe(4);

    await act(async () => {
      resolvers[3]({ partNumber: 4, etag: 'etag-4' });
      await new Promise((r) => setTimeout(r, 0));
    });
    progressValues.push(result.current.progress);

    await act(async () => {
      await uploadPromise!;
    });

    expect(progressValues).toEqual([25, 50, 75, 100]);
    expect(result.current.progress).toBe(100);
  });

  it('persists completed parts to localStorage after each batch', async () => {
    const chunks = makeChunks(4);
    mockedChunkFile.chunkFile.mockReturnValue(chunks);
    mockedService.initiateUpload.mockResolvedValue({
      uploadId: 'upload-1',
      fileId: 'file-1',
      key: 'key-1',
    });
    mockedService.uploadPartToUrl.mockImplementation(async ({ partNumber }) => ({
      partNumber,
      etag: `etag-${partNumber}`,
    }));
    mockedService.completeUpload.mockResolvedValue(mockIFile);

    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

    const { result } = renderHook(() => useChunkedUpload());

    await act(async () => {
      await result.current.upload({ file: makeFile() });
    });

    // saveSession was called multiple times during the run
    const sessionWrites = setItemSpy.mock.calls.filter(([key]) =>
      String(key).startsWith(STORAGE_PREFIX),
    );
    expect(sessionWrites.length).toBeGreaterThanOrEqual(2);

    // Final cleared after success
    expect(localStorage.length).toBe(0);
    setItemSpy.mockRestore();
  });

  describe('resumable sessions', () => {
    const file = makeFile('resume.bin', 30, 1700000000000);

    async function seedSession(parts: number[]) {
      const key = await sessionKey(file);
      const session = {
        fileId: 'file-1',
        fileName: file.name,
        size: file.size,
        lastModified: file.lastModified,
        folderId: null,
        completedParts: parts.map((n) => ({ partNumber: n, etag: `etag-${n}` })),
        savedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(session));
      return key;
    }

    it('detects a saved session and exposes pendingResume', async () => {
      await seedSession([1, 2]);
      mockedFileService.getUploadedParts.mockResolvedValue({
        fileId: 'file-1',
        parts: [{ partNumber: 1 }, { partNumber: 2 }],
      });
      mockedChunkFile.chunkFile.mockReturnValue(makeChunks(4));

      const { result } = renderHook(() => useChunkedUpload());

      let firstResult: IFile | null | undefined;
      await act(async () => {
        firstResult = await result.current.upload({ file });
      });

      expect(firstResult).toBeNull();
      expect(result.current.pendingResume).toEqual({
        fileId: 'file-1',
        alreadyUploaded: 2,
      });
      expect(mockedFileService.getUploadedParts).toHaveBeenCalledWith('file-1');
      // No new initiateUpload yet — we are waiting for the user to choose
      expect(mockedService.initiateUpload).not.toHaveBeenCalled();
    });

    it('resume() skips completed parts and uploads only the missing ones', async () => {
      await seedSession([1, 2]);
      const chunks = makeChunks(4);
      mockedChunkFile.chunkFile.mockReturnValue(chunks);
      mockedFileService.getUploadedParts.mockResolvedValue({
        fileId: 'file-1',
        parts: [{ partNumber: 1 }, { partNumber: 2 }],
      });
      mockedService.uploadPartToUrl.mockImplementation(async ({ partNumber }) => ({
        partNumber,
        etag: `new-etag-${partNumber}`,
      }));
      mockedService.completeUpload.mockResolvedValue(mockIFile);

      const { result } = renderHook(() => useChunkedUpload());

      await act(async () => {
        await result.current.upload({ file });
      });

      expect(result.current.pendingResume).not.toBeNull();

      let resumed: IFile | undefined;
      await act(async () => {
        resumed = await result.current.resume();
      });

      expect(resumed).toEqual(mockIFile);
      // Only parts 3 and 4 should have been uploaded
      const uploadedPartNumbers = mockedService.uploadPartToUrl.mock.calls.map(
        (call) => call[0].partNumber,
      );
      expect(uploadedPartNumbers).toEqual([3, 4]);

      // completeUpload receives all four parts: 1 & 2 from saved session, 3 & 4 freshly uploaded
      expect(mockedService.completeUpload).toHaveBeenCalledWith('file-1', [
        { partNumber: 1, etag: 'etag-1' },
        { partNumber: 2, etag: 'etag-2' },
        { partNumber: 3, etag: 'new-etag-3' },
        { partNumber: 4, etag: 'new-etag-4' },
      ]);
      // Did NOT initiate a new upload
      expect(mockedService.initiateUpload).not.toHaveBeenCalled();
      expect(result.current.pendingResume).toBeNull();
      expect(localStorage.length).toBe(0);
    });

    it('resumes from an arbitrary offset', async () => {
      // Start with 3 of 5 parts already uploaded
      await seedSession([1, 2, 3]);
      const chunks = makeChunks(5);
      mockedChunkFile.chunkFile.mockReturnValue(chunks);
      mockedFileService.getUploadedParts.mockResolvedValue({
        fileId: 'file-1',
        parts: [{ partNumber: 1 }, { partNumber: 2 }, { partNumber: 3 }],
      });
      mockedService.uploadPartToUrl.mockImplementation(async ({ partNumber }) => ({
        partNumber,
        etag: `new-etag-${partNumber}`,
      }));
      mockedService.completeUpload.mockResolvedValue(mockIFile);

      const { result } = renderHook(() => useChunkedUpload());

      await act(async () => {
        await result.current.upload({ file });
      });
      expect(result.current.pendingResume).toEqual({
        fileId: 'file-1',
        alreadyUploaded: 3,
      });

      await act(async () => {
        await result.current.resume();
      });

      const uploadedPartNumbers = mockedService.uploadPartToUrl.mock.calls.map(
        (call) => call[0].partNumber,
      );
      expect(uploadedPartNumbers).toEqual([4, 5]);
    });

    it('discardResume() clears state and lets a fresh upload begin', async () => {
      const key = await seedSession([1, 2]);
      const chunks = makeChunks(4);
      mockedChunkFile.chunkFile.mockReturnValue(chunks);
      mockedFileService.getUploadedParts.mockResolvedValue({
        fileId: 'file-1',
        parts: [{ partNumber: 1 }, { partNumber: 2 }],
      });
      mockedService.initiateUpload.mockResolvedValue({
        uploadId: 'upload-2',
        fileId: 'file-2',
        key: 'key-2',
      });
      mockedService.uploadPartToUrl.mockImplementation(async ({ partNumber }) => ({
        partNumber,
        etag: `etag-${partNumber}`,
      }));
      mockedService.completeUpload.mockResolvedValue(mockIFile);

      const { result } = renderHook(() => useChunkedUpload());

      await act(async () => {
        await result.current.upload({ file });
      });
      expect(result.current.pendingResume).not.toBeNull();
      expect(localStorage.getItem(STORAGE_PREFIX + key)).not.toBeNull();

      act(() => {
        result.current.discardResume();
      });
      expect(result.current.pendingResume).toBeNull();
      expect(localStorage.getItem(STORAGE_PREFIX + key)).toBeNull();

      // A second upload() call should now do a fresh initiate
      let secondResult: IFile | null | undefined;
      await act(async () => {
        secondResult = await result.current.upload({ file });
      });
      expect(secondResult).toEqual(mockIFile);
      expect(mockedService.initiateUpload).toHaveBeenCalledTimes(1);
      expect(mockedService.uploadPartToUrl).toHaveBeenCalledTimes(4);
    });

    it('persists across simulated remount — second hook instance recovers session', async () => {
      const key = await seedSession([1]);
      mockedFileService.getUploadedParts.mockResolvedValue({
        fileId: 'file-1',
        parts: [{ partNumber: 1 }],
      });
      mockedChunkFile.chunkFile.mockReturnValue(makeChunks(3));

      // First mount
      const { result: result1, unmount } = renderHook(() => useChunkedUpload());
      // Sanity: localStorage entry survives across mounts
      expect(localStorage.getItem(STORAGE_PREFIX + key)).not.toBeNull();
      unmount();

      // Second mount — fresh hook instance
      const { result: result2 } = renderHook(() => useChunkedUpload());
      expect(result1.current.pendingResume).toBeNull();

      await act(async () => {
        await result2.current.upload({ file });
      });

      expect(result2.current.pendingResume).toEqual({
        fileId: 'file-1',
        alreadyUploaded: 1,
      });
    });

    it('ignores expired sessions', async () => {
      const key = await sessionKey(file);
      const expired = {
        fileId: 'old-file',
        fileName: file.name,
        size: file.size,
        lastModified: file.lastModified,
        folderId: null,
        completedParts: [{ partNumber: 1, etag: 'etag-1' }],
        savedAt: Date.now() - SESSION_TTL_MS - 1000,
      };
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(expired));

      mockedChunkFile.chunkFile.mockReturnValue(makeChunks(2));
      mockedService.initiateUpload.mockResolvedValue({
        uploadId: 'upload-new',
        fileId: 'file-new',
        key: 'key-new',
      });
      mockedService.uploadPartToUrl.mockImplementation(async ({ partNumber }) => ({
        partNumber,
        etag: `etag-${partNumber}`,
      }));
      mockedService.completeUpload.mockResolvedValue(mockIFile);

      const { result } = renderHook(() => useChunkedUpload());

      await act(async () => {
        await result.current.upload({ file });
      });

      expect(result.current.pendingResume).toBeNull();
      expect(mockedFileService.getUploadedParts).not.toHaveBeenCalled();
      expect(mockedService.initiateUpload).toHaveBeenCalledTimes(1);
    });

    it('falls back to fresh upload when getUploadedParts fails', async () => {
      await seedSession([1]);
      mockedFileService.getUploadedParts.mockRejectedValue(new Error('Server lost session'));
      mockedChunkFile.chunkFile.mockReturnValue(makeChunks(2));
      mockedService.initiateUpload.mockResolvedValue({
        uploadId: 'upload-new',
        fileId: 'file-new',
        key: 'key-new',
      });
      mockedService.uploadPartToUrl.mockImplementation(async ({ partNumber }) => ({
        partNumber,
        etag: `etag-${partNumber}`,
      }));
      mockedService.completeUpload.mockResolvedValue(mockIFile);

      const { result } = renderHook(() => useChunkedUpload());

      let res: IFile | null | undefined;
      await act(async () => {
        res = await result.current.upload({ file });
      });

      expect(res).toEqual(mockIFile);
      expect(result.current.pendingResume).toBeNull();
      expect(mockedService.initiateUpload).toHaveBeenCalledTimes(1);
    });
  });
});
