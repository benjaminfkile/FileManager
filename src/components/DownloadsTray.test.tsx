import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DownloadsTray from './DownloadsTray';
import * as DownloadsContextModule from '../contexts/DownloadsContext';
import * as useFolderDownloadModule from '../hooks/useFolderDownload';
import * as downloadHelpers from '../utils/downloadHelpers';
import { DownloadJob } from '../contexts/DownloadsContext';

jest.mock('../contexts/DownloadsContext', () => ({
  ...jest.requireActual('../contexts/DownloadsContext'),
  useDownloads: jest.fn(),
}));
jest.mock('../hooks/useFolderDownload', () => ({
  useFolderDownload: jest.fn(),
}));
jest.mock('../utils/downloadHelpers', () => ({
  triggerDownloadFromUrl: jest.fn(),
}));

const mockRemoveJob = jest.fn();
const mockStart = jest.fn();

function makeJob(overrides: Partial<DownloadJob>): DownloadJob {
  return {
    id: 'j1',
    folderId: 'f1',
    folderName: 'Folder 1',
    status: 'processing',
    createdAt: Date.now(),
    prepareFn: jest.fn(),
    statusFn: jest.fn(),
    ...overrides,
  };
}

function setupMocks(jobs: DownloadJob[] = []) {
  (DownloadsContextModule.useDownloads as jest.Mock).mockReturnValue({
    jobs,
    addJob: jest.fn(),
    updateJob: jest.fn(),
    removeJob: mockRemoveJob,
  });
  (useFolderDownloadModule.useFolderDownload as jest.Mock).mockReturnValue({
    start: mockStart,
    jobs,
  });
  (downloadHelpers.triggerDownloadFromUrl as jest.Mock).mockResolvedValue(undefined);
}

beforeEach(() => {
  jest.clearAllMocks();
  setupMocks();
});

describe('DownloadsTray', () => {
  it('renders the downloads icon button', () => {
    render(<DownloadsTray />);
    expect(screen.getByLabelText('downloads')).toBeInTheDocument();
  });

  it('opens popover when download button is clicked', async () => {
    render(<DownloadsTray />);
    await userEvent.click(screen.getByLabelText('downloads'));
    expect(screen.getByText('Downloads')).toBeInTheDocument();
  });

  it('shows empty state when no jobs', async () => {
    render(<DownloadsTray />);
    await userEvent.click(screen.getByLabelText('downloads'));
    expect(screen.getByText('No downloads')).toBeInTheDocument();
  });

  it('renders in-flight job with folder name and status', async () => {
    setupMocks([makeJob({ status: 'processing', folderName: 'Work Files' })]);
    render(<DownloadsTray />);
    await userEvent.click(screen.getByLabelText('downloads'));
    expect(screen.getByText('Work Files')).toBeInTheDocument();
    expect(screen.getByText('Downloading...')).toBeInTheDocument();
  });

  it('renders pending job with Preparing... status', async () => {
    setupMocks([makeJob({ status: 'pending', folderName: 'Archive' })]);
    render(<DownloadsTray />);
    await userEvent.click(screen.getByLabelText('downloads'));
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('Preparing...')).toBeInTheDocument();
  });

  it('shows Retry button for failed jobs', async () => {
    setupMocks([makeJob({ status: 'failed', error: 'Server error' })]);
    render(<DownloadsTray />);
    await userEvent.click(screen.getByLabelText('downloads'));
    expect(screen.getByText('Retry')).toBeInTheDocument();
    expect(screen.getByText(/Failed: Server error/)).toBeInTheDocument();
  });

  it('calls start with job fns and removes old job when Retry is clicked', async () => {
    const prepareFn = jest.fn();
    const statusFn = jest.fn();
    const job = makeJob({ status: 'failed', error: 'Server error', prepareFn, statusFn });
    setupMocks([job]);
    render(<DownloadsTray />);
    await userEvent.click(screen.getByLabelText('downloads'));
    await userEvent.click(screen.getByText('Retry'));

    expect(mockRemoveJob).toHaveBeenCalledWith('j1');
    expect(mockStart).toHaveBeenCalledWith('f1', 'Folder 1', { prepareFn, statusFn });
  });

  it('shows Open button for ready jobs', async () => {
    setupMocks([makeJob({ status: 'ready', url: 'https://cdn.example.com/download.zip' })]);
    render(<DownloadsTray />);
    await userEvent.click(screen.getByLabelText('downloads'));
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('triggers download when Open is clicked', async () => {
    const job = makeJob({
      status: 'ready',
      url: 'https://cdn.example.com/download.zip',
      folderName: 'Documents',
    });
    setupMocks([job]);
    render(<DownloadsTray />);
    await userEvent.click(screen.getByLabelText('downloads'));
    await userEvent.click(screen.getByText('Open'));

    expect(downloadHelpers.triggerDownloadFromUrl).toHaveBeenCalledWith(
      'https://cdn.example.com/download.zip',
      'Documents.zip'
    );
  });

  it('shows badge count for in-flight jobs', () => {
    const jobs = [
      makeJob({ id: 'j1', status: 'processing' }),
      makeJob({ id: 'j2', status: 'pending', folderId: 'f2' }),
      makeJob({ id: 'j3', status: 'ready', folderId: 'f3' }),
    ];
    setupMocks(jobs);
    render(<DownloadsTray />);
    // Badge with count 2 should appear
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders multiple jobs', async () => {
    const jobs = [
      makeJob({ id: 'j1', folderName: 'Folder A', status: 'processing' }),
      makeJob({ id: 'j2', folderName: 'Folder B', status: 'failed', error: 'Err', folderId: 'f2' }),
    ];
    setupMocks(jobs);
    render(<DownloadsTray />);
    await userEvent.click(screen.getByLabelText('downloads'));
    expect(screen.getByText('Folder A')).toBeInTheDocument();
    expect(screen.getByText('Folder B')).toBeInTheDocument();
  });
});
