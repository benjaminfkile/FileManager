import { renderHook, act } from '@testing-library/react';
import { useChunkedUpload } from './useChunkedUpload';
import * as chunkedUploadService from '../api/chunkedUploadService';
import * as chunkFileModule from '../utils/chunkFile';
import { IFile } from '../types';

jest.mock('../lib/cognitoClient', () => ({}));
jest.mock('../api/apiClient', () => ({ default: {} }));
jest.mock('../api/chunkedUploadService');
jest.mock('../utils/chunkFile');

const mockedService = chunkedUploadService as jest.Mocked<typeof chunkedUploadService>;
const mockedChunkFile = chunkFileModule as jest.Mocked<typeof chunkFileModule>;

const mockFile = new File(['a'.repeat(30)], 'test.txt', { type: 'text/plain' });

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
    mockedService.uploadPart.mockImplementation(async ({ partNumber }) => ({
      partNumber,
      etag: `etag-${partNumber}`,
    }));
    mockedService.completeUpload.mockResolvedValue(mockIFile);

    const { result } = renderHook(() => useChunkedUpload());

    let uploadResult: IFile | undefined;
    await act(async () => {
      uploadResult = await result.current.upload({ file: mockFile });
    });

    expect(uploadResult).toEqual(mockIFile);
    expect(result.current.progress).toBe(100);
    expect(result.current.isUploading).toBe(false);
    expect(result.current.error).toBeNull();

    expect(mockedService.initiateUpload).toHaveBeenCalledWith({
      filename: 'test.txt',
      mimeType: 'text/plain',
      size: 30,
      folderId: undefined,
    });
    expect(mockedService.uploadPart).toHaveBeenCalledTimes(4);
    expect(mockedService.completeUpload).toHaveBeenCalledWith('file-1', [
      { partNumber: 1, etag: 'etag-1' },
      { partNumber: 2, etag: 'etag-2' },
      { partNumber: 3, etag: 'etag-3' },
      { partNumber: 4, etag: 'etag-4' },
    ]);
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
    mockedService.uploadPart.mockImplementation(async ({ partNumber }) => {
      uploadPartCallCount++;
      return { partNumber, etag: `etag-${partNumber}` };
    });
    mockedService.abortUpload.mockResolvedValue(undefined);

    const { result } = renderHook(() => useChunkedUpload());

    // Trigger abort after initiateUpload resolves but before chunks finish
    // We do this by making the first batch resolve, then setting abort before second batch
    const originalUploadPart = mockedService.uploadPart.getMockImplementation()!;
    mockedService.uploadPart.mockImplementation(async (payload) => {
      const res = await originalUploadPart(payload);
      // After first batch (3 parts), trigger abort
      if (uploadPartCallCount >= 3) {
        result.current.abort();
      }
      return res;
    });

    await act(async () => {
      await expect(result.current.upload({ file: mockFile })).rejects.toThrow('Upload aborted');
    });

    expect(mockedService.abortUpload).toHaveBeenCalledWith('file-1');
    expect(mockedService.completeUpload).not.toHaveBeenCalled();
    expect(result.current.isUploading).toBe(false);
  });

  it('aborts and sets error when uploadPart fails', async () => {
    const chunks = makeChunks(3);
    mockedChunkFile.chunkFile.mockReturnValue(chunks);
    mockedService.initiateUpload.mockResolvedValue({
      uploadId: 'upload-1',
      fileId: 'file-1',
      key: 'key-1',
    });
    mockedService.uploadPart.mockRejectedValue(new Error('Network error'));
    mockedService.abortUpload.mockResolvedValue(undefined);

    const { result } = renderHook(() => useChunkedUpload());

    await act(async () => {
      await expect(result.current.upload({ file: mockFile })).rejects.toThrow('Network error');
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

    mockedService.uploadPart.mockImplementation(({ partNumber }) => {
      return new Promise((resolve) => {
        resolvers.push(() => resolve({ partNumber, etag: `etag-${partNumber}` }));
      });
    });
    mockedService.completeUpload.mockResolvedValue(mockIFile);

    const { result } = renderHook(() => useChunkedUpload());

    let uploadPromise: Promise<IFile>;
    act(() => {
      uploadPromise = result.current.upload({ file: mockFile });
    });

    // Wait for initiateUpload + chunkFile + first batch of uploadPart calls
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // First batch: 3 parts. Resolve them one at a time.
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

    // Second batch: 1 part
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

    // 4 chunks: each adds 25%
    expect(progressValues).toEqual([25, 50, 75, 100]);
    expect(result.current.progress).toBe(100);
  });
});
