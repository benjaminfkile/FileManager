import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DownloadsTray from './DownloadsTray';
import * as DownloadsContextModule from '../contexts/DownloadsContext';
import { DownloadJob } from '../contexts/DownloadsContext';

jest.mock('../contexts/DownloadsContext', () => ({
  ...jest.requireActual('../contexts/DownloadsContext'),
  useDownloads: jest.fn(),
}));

const mockRemoveJob = jest.fn();

function makeJob(overrides: Partial<DownloadJob>): DownloadJob {
  return {
    id: 'j1',
    folderId: 'f1',
    folderName: 'Folder 1',
    status: 'processing',
    loadedBytes: 0,
    totalBytes: 0,
    createdAt: Date.now(),
    abort: jest.fn(),
    retry: jest.fn(),
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

  it('renders pending job with Preparing… status', async () => {
    setupMocks([makeJob({ status: 'pending', folderName: 'Archive' })]);
    render(<DownloadsTray />);
    await userEvent.click(screen.getByLabelText('downloads'));
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText(/Preparing/)).toBeInTheDocument();
  });

  it('shows bytes-of-total progress for an in-flight job', async () => {
    setupMocks([
      makeJob({
        status: 'processing',
        folderName: 'Work Files',
        loadedBytes: 500_000,
        totalBytes: 1_000_000,
      }),
    ]);
    render(<DownloadsTray />);
    await userEvent.click(screen.getByLabelText('downloads'));
    expect(screen.getByText('Work Files')).toBeInTheDocument();
    expect(screen.getByText(/of/)).toBeInTheDocument();
    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });

  it('shows Cancel for in-flight job and invokes job.abort()', async () => {
    const abort = jest.fn();
    setupMocks([makeJob({ status: 'processing', abort })]);
    render(<DownloadsTray />);
    await userEvent.click(screen.getByLabelText('downloads'));
    await userEvent.click(screen.getByText('Cancel'));
    expect(abort).toHaveBeenCalledTimes(1);
  });

  it('shows Retry for failed job and invokes job.retry()', async () => {
    const retry = jest.fn();
    setupMocks([
      makeJob({ status: 'failed', error: 'Server error', retry }),
    ]);
    render(<DownloadsTray />);
    await userEvent.click(screen.getByLabelText('downloads'));
    expect(screen.getByText(/Failed: Server error/)).toBeInTheDocument();
    await userEvent.click(screen.getByText('Retry'));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('shows badge count for in-flight jobs', () => {
    const jobs = [
      makeJob({ id: 'j1', status: 'processing' }),
      makeJob({ id: 'j2', status: 'pending', folderId: 'f2' }),
      makeJob({ id: 'j3', status: 'ready', folderId: 'f3' }),
    ];
    setupMocks(jobs);
    render(<DownloadsTray />);
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
