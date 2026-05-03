import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useFolderDownload } from './useFolderDownload';
import * as folderService from '../api/folderService';
import * as folderZipDownload from '../utils/folderZipDownload';
import { DownloadsProvider } from '../contexts/DownloadsContext';
import { NotificationProvider } from '../contexts/NotificationContext';

jest.mock('../lib/cognitoClient', () => ({ __esModule: true, default: {}, userPool: {} }));
jest.mock('../api/apiClient', () => ({ default: {} }));
jest.mock('../api/folderService');
jest.mock('../utils/folderZipDownload');

const mockedGetFolderDownloadManifest = folderService.getFolderDownloadManifest as jest.MockedFunction<
  typeof folderService.getFolderDownloadManifest
>;
const mockedStreamZipToDisk = folderZipDownload.streamZipToDisk as jest.MockedFunction<
  typeof folderZipDownload.streamZipToDisk
>;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    NotificationProvider,
    null,
    React.createElement(DownloadsProvider, null, children)
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  mockedStreamZipToDisk.mockResolvedValue(undefined);
});

describe('useFolderDownload', () => {
  const sampleManifest = {
    folderName: 'My Folder',
    totalBytes: 1500,
    expiresAt: '2026-05-03T12:00:00Z',
    files: [
      { zipPath: 'My Folder/a.txt', url: 'https://s3.example/a', size: 500 },
      { zipPath: 'My Folder/b.txt', url: 'https://s3.example/b', size: 1000 },
    ],
  };

  it('streams the zip to disk and marks the job ready', async () => {
    mockedGetFolderDownloadManifest.mockResolvedValue(sampleManifest);

    const { result } = renderHook(() => useFolderDownload(), { wrapper });

    await act(async () => {
      await result.current.start('folder1', 'My Folder', { _progressFlushMs: 0 });
    });

    expect(mockedGetFolderDownloadManifest).toHaveBeenCalledWith('folder1');
    expect(mockedStreamZipToDisk).toHaveBeenCalledTimes(1);
    expect(mockedStreamZipToDisk.mock.calls[0]?.[0].files).toEqual(sampleManifest.files);
    expect(mockedStreamZipToDisk.mock.calls[0]?.[0].folderName).toBe('My Folder');

    const job = result.current.jobs[0];
    expect(job?.status).toBe('ready');
    expect(job?.totalBytes).toBe(1500);
    expect(job?.completedAt).toBeDefined();
  });

  it('reports progress as the stream emits bytes', async () => {
    mockedGetFolderDownloadManifest.mockResolvedValue(sampleManifest);
    mockedStreamZipToDisk.mockImplementation(async ({ onProgress }) => {
      onProgress?.(500);
      onProgress?.(700);
      onProgress?.(300);
    });

    const { result } = renderHook(() => useFolderDownload(), { wrapper });

    await act(async () => {
      await result.current.start('folder1', 'My Folder', { _progressFlushMs: 0 });
    });

    const job = result.current.jobs[0];
    expect(job?.status).toBe('ready');
    expect(job?.loadedBytes).toBe(1500);
  });

  it('marks job failed and notifies on manifest error', async () => {
    mockedGetFolderDownloadManifest.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useFolderDownload(), { wrapper });

    await act(async () => {
      await result.current.start('folder1', 'My Folder', { _progressFlushMs: 0 });
    });

    const job = result.current.jobs[0];
    expect(job?.status).toBe('failed');
    expect(job?.error).toBe('Network error');
    expect(mockedStreamZipToDisk).not.toHaveBeenCalled();
  });

  it('marks job failed when streamZipToDisk throws', async () => {
    mockedGetFolderDownloadManifest.mockResolvedValue(sampleManifest);
    mockedStreamZipToDisk.mockRejectedValue(new Error('S3 fetch 403'));

    const { result } = renderHook(() => useFolderDownload(), { wrapper });

    await act(async () => {
      await result.current.start('folder1', 'My Folder', { _progressFlushMs: 0 });
    });

    const job = result.current.jobs[0];
    expect(job?.status).toBe('failed');
    expect(job?.error).toBe('S3 fetch 403');
  });

  it('marks job failed with "Folder is empty" when manifest has no files', async () => {
    mockedGetFolderDownloadManifest.mockResolvedValue({
      folderName: 'Empty',
      totalBytes: 0,
      expiresAt: '2026-05-03T12:00:00Z',
      files: [],
    });

    const { result } = renderHook(() => useFolderDownload(), { wrapper });

    await act(async () => {
      await result.current.start('folder1', 'Empty', { _progressFlushMs: 0 });
    });

    const job = result.current.jobs[0];
    expect(job?.status).toBe('failed');
    expect(job?.error).toBe('Folder is empty');
    expect(mockedStreamZipToDisk).not.toHaveBeenCalled();
  });

  it('uses a custom manifestFn when provided (share-link case)', async () => {
    const customManifestFn = jest.fn().mockResolvedValue(sampleManifest);

    const { result } = renderHook(() => useFolderDownload(), { wrapper });

    await act(async () => {
      await result.current.start('folder1', 'My Folder', {
        manifestFn: customManifestFn,
        _progressFlushMs: 0,
      });
    });

    expect(customManifestFn).toHaveBeenCalledTimes(1);
    expect(mockedGetFolderDownloadManifest).not.toHaveBeenCalled();
    expect(result.current.jobs[0]?.status).toBe('ready');
  });

  it('exposes abort + retry on the job', async () => {
    mockedGetFolderDownloadManifest.mockResolvedValue(sampleManifest);

    const { result } = renderHook(() => useFolderDownload(), { wrapper });

    await act(async () => {
      await result.current.start('folder1', 'My Folder', { _progressFlushMs: 0 });
    });

    const job = result.current.jobs[0];
    expect(typeof job?.abort).toBe('function');
    expect(typeof job?.retry).toBe('function');
  });
});
