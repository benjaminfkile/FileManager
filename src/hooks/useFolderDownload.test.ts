import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useFolderDownload } from './useFolderDownload';
import * as folderService from '../api/folderService';
import * as downloadHelpers from '../utils/downloadHelpers';
import { DownloadsProvider } from '../contexts/DownloadsContext';
import { NotificationProvider } from '../contexts/NotificationContext';

jest.mock('../lib/cognitoClient', () => ({ __esModule: true, default: {}, userPool: {} }));
jest.mock('../api/apiClient', () => ({ default: {} }));
jest.mock('../api/folderService');
jest.mock('../utils/downloadHelpers');

const mockedPrepareFolderDownload = folderService.prepareFolderDownload as jest.MockedFunction<
  typeof folderService.prepareFolderDownload
>;
const mockedGetFolderDownloadStatus = folderService.getFolderDownloadStatus as jest.MockedFunction<
  typeof folderService.getFolderDownloadStatus
>;
const mockedTriggerDownloadFromUrl = downloadHelpers.triggerDownloadFromUrl as jest.MockedFunction<
  typeof downloadHelpers.triggerDownloadFromUrl
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
  mockedTriggerDownloadFromUrl.mockResolvedValue(undefined);
});

describe('useFolderDownload', () => {
  it('downloads immediately when prepare returns ready', async () => {
    const prepareFn = jest.fn().mockResolvedValue({
      jobId: 'job1',
      status: 'ready',
      url: 'https://cdn.example.com/folder.zip',
    });

    const { result } = renderHook(() => useFolderDownload(), { wrapper });

    await act(async () => {
      await result.current.start('folder1', 'My Folder', { prepareFn, _pollInterval: 0 });
    });

    expect(result.current.jobs[0]?.status).toBe('ready');
    expect(result.current.jobs[0]?.url).toBe('https://cdn.example.com/folder.zip');
    expect(mockedTriggerDownloadFromUrl).toHaveBeenCalledWith(
      'https://cdn.example.com/folder.zip',
      'My Folder.zip'
    );
  });

  it('polls until status becomes ready', async () => {
    const prepareFn = jest.fn().mockResolvedValue({ jobId: 'job1', status: 'pending' });
    const statusFn = jest
      .fn()
      .mockResolvedValueOnce({ status: 'processing' })
      .mockResolvedValueOnce({ status: 'ready', url: 'https://cdn.example.com/folder.zip' });

    const { result } = renderHook(() => useFolderDownload(), { wrapper });

    await act(async () => {
      await result.current.start('folder1', 'My Folder', {
        prepareFn,
        statusFn,
        _pollInterval: 0,
      });
    });

    expect(result.current.jobs[0]?.status).toBe('ready');
    expect(statusFn).toHaveBeenCalledTimes(2);
    expect(mockedTriggerDownloadFromUrl).toHaveBeenCalledWith(
      'https://cdn.example.com/folder.zip',
      'My Folder.zip'
    );
  });

  it('marks job as failed when status returns failed', async () => {
    const prepareFn = jest.fn().mockResolvedValue({ jobId: 'job1', status: 'pending' });
    const statusFn = jest.fn().mockResolvedValue({ status: 'failed', error: 'Zip error' });

    const { result } = renderHook(() => useFolderDownload(), { wrapper });

    await act(async () => {
      await result.current.start('folder1', 'My Folder', {
        prepareFn,
        statusFn,
        _pollInterval: 0,
      });
    });

    expect(result.current.jobs[0]?.status).toBe('failed');
    expect(result.current.jobs[0]?.error).toBe('Zip error');
    expect(mockedTriggerDownloadFromUrl).not.toHaveBeenCalled();
  });

  it('marks job as failed when prepare throws', async () => {
    const prepareFn = jest.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useFolderDownload(), { wrapper });

    await act(async () => {
      await result.current.start('folder1', 'My Folder', {
        prepareFn,
        _pollInterval: 0,
      });
    });

    expect(result.current.jobs[0]?.status).toBe('failed');
    expect(result.current.jobs[0]?.error).toBe('Failed to download folder');
    expect(mockedTriggerDownloadFromUrl).not.toHaveBeenCalled();
  });

  it('uses default folderService functions when no custom options given', async () => {
    mockedPrepareFolderDownload.mockResolvedValue({
      jobId: 'job1',
      status: 'ready',
      url: 'https://cdn.example.com/folder.zip',
    });

    const { result } = renderHook(() => useFolderDownload(), { wrapper });

    await act(async () => {
      await result.current.start('folder1', 'My Folder', { _pollInterval: 0 });
    });

    expect(mockedPrepareFolderDownload).toHaveBeenCalledWith('folder1');
    expect(result.current.jobs[0]?.status).toBe('ready');
  });

  it('uses default getFolderDownloadStatus during polling', async () => {
    mockedPrepareFolderDownload.mockResolvedValue({ jobId: 'job1', status: 'pending' });
    mockedGetFolderDownloadStatus.mockResolvedValue({
      status: 'ready',
      url: 'https://cdn.example.com/folder.zip',
    });

    const { result } = renderHook(() => useFolderDownload(), { wrapper });

    await act(async () => {
      await result.current.start('folder1', 'My Folder', { _pollInterval: 0 });
    });

    expect(mockedGetFolderDownloadStatus).toHaveBeenCalledWith('folder1', 'job1');
    expect(result.current.jobs[0]?.status).toBe('ready');
  });

  it('stores job in context with correct initial state', async () => {
    const prepareFn = jest.fn().mockResolvedValue({
      jobId: 'job1',
      status: 'ready',
      url: 'https://cdn.example.com/folder.zip',
    });

    const { result } = renderHook(() => useFolderDownload(), { wrapper });

    await act(async () => {
      await result.current.start('folder-x', 'Archive', { prepareFn, _pollInterval: 0 });
    });

    const job = result.current.jobs[0];
    expect(job?.folderId).toBe('folder-x');
    expect(job?.folderName).toBe('Archive');
    expect(job?.completedAt).toBeDefined();
  });
});
