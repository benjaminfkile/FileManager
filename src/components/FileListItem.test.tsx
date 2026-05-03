import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileListItem, { FileListItemProps } from './FileListItem';
import { IFile } from '../types';
import { NotificationProvider } from '../contexts/NotificationContext';
import { downloadFile } from '../api/fileService';
import { triggerDownloadFromUrl } from '../utils/downloadHelpers';

const mockedDownloadFile = downloadFile as jest.MockedFunction<typeof downloadFile>;
const mockedTriggerDownloadFromUrl = triggerDownloadFromUrl as jest.MockedFunction<typeof triggerDownloadFromUrl>;

jest.mock('../lib/cognitoClient', () => ({
  __esModule: true,
  default: {},
  userPool: {},
}));
jest.mock('../api/fileService');
jest.mock('../utils/downloadHelpers');

const baseFile: IFile = {
  id: '1',
  user_id: 'u1',
  folder_id: null,
  name: 'report.pdf',
  s3_key: 'files/report.pdf',
  size_bytes: 2048,
  mime_type: 'application/pdf',
  is_deleted: false,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-03-15T12:00:00Z',
};

function renderComponent(overrides: Partial<FileListItemProps> = {}) {
  const props: FileListItemProps = {
    file: baseFile,
    isOwner: true,
    ...overrides,
  };
  return render(
    <NotificationProvider>
      <FileListItem {...props} />
    </NotificationProvider>
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  mockedDownloadFile.mockResolvedValue({
    url: 'https://cdn.example.com/signed-url',
    expiresAt: '2026-01-01T01:00:00.000Z',
  });
  mockedTriggerDownloadFromUrl.mockResolvedValue(undefined);
});

describe('FileListItem', () => {
  it('renders file name, size, and date', () => {
    renderComponent();
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
    expect(screen.getByText(/Mar 15, 2026/)).toBeInTheDocument();
  });

  it('shows owner actions in the menu', async () => {
    renderComponent();
    await userEvent.click(screen.getByLabelText('actions'));

    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
    expect(screen.getByText('Rename')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('hides owner-only actions for non-owner', async () => {
    renderComponent({ isOwner: false });
    await userEvent.click(screen.getByLabelText('actions'));

    expect(screen.getByText('Download')).toBeInTheDocument();
    expect(screen.queryByText('Rename')).not.toBeInTheDocument();
    expect(screen.queryByText('Share')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('hides Preview for non-previewable files', async () => {
    renderComponent({ file: { ...baseFile, mime_type: 'application/zip' } });
    await userEvent.click(screen.getByLabelText('actions'));

    expect(screen.queryByText('Preview')).not.toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  it('calls onPreview when Preview is clicked', async () => {
    const onPreview = jest.fn();
    renderComponent({ onPreview });
    await userEvent.click(screen.getByLabelText('actions'));
    await userEvent.click(screen.getByText('Preview'));

    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  it('calls onRename when Rename is clicked', async () => {
    const onRename = jest.fn();
    renderComponent({ onRename });
    await userEvent.click(screen.getByLabelText('actions'));
    await userEvent.click(screen.getByText('Rename'));

    expect(onRename).toHaveBeenCalledTimes(1);
  });

  it('calls onShare when Share is clicked', async () => {
    const onShare = jest.fn();
    renderComponent({ onShare });
    await userEvent.click(screen.getByLabelText('actions'));
    await userEvent.click(screen.getByText('Share'));

    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when Delete is clicked', async () => {
    const onDelete = jest.fn();
    renderComponent({ onDelete });
    await userEvent.click(screen.getByLabelText('actions'));
    await userEvent.click(screen.getByText('Delete'));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('shows "Move to..." when isOwner and onMove provided', async () => {
    const onMove = jest.fn();
    renderComponent({ onMove });
    await userEvent.click(screen.getByLabelText('actions'));

    expect(screen.getByText('Move to...')).toBeInTheDocument();
  });

  it('hides "Move to..." when onMove is not provided', async () => {
    renderComponent();
    await userEvent.click(screen.getByLabelText('actions'));

    expect(screen.queryByText('Move to...')).not.toBeInTheDocument();
  });

  it('hides "Move to..." for non-owner', async () => {
    const onMove = jest.fn();
    renderComponent({ isOwner: false, onMove });
    await userEvent.click(screen.getByLabelText('actions'));

    expect(screen.queryByText('Move to...')).not.toBeInTheDocument();
  });

  it('calls onMove when "Move to..." is clicked', async () => {
    const onMove = jest.fn();
    renderComponent({ onMove });
    await userEvent.click(screen.getByLabelText('actions'));
    await userEvent.click(screen.getByText('Move to...'));

    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('has draggable attribute on the list item', () => {
    renderComponent();
    const listItem = screen.getByRole('listitem');
    expect(listItem).toHaveAttribute('draggable', 'true');
  });

  it('sets correct drag data on dragStart', () => {
    renderComponent();
    const listItem = screen.getByRole('listitem');
    const mockSetData = jest.fn();
    fireEvent.dragStart(listItem, {
      dataTransfer: { setData: mockSetData, effectAllowed: '' },
    });
    expect(mockSetData).toHaveBeenCalledWith(
      'application/json',
      JSON.stringify({ id: baseFile.id, type: 'file' }),
    );
  });

  it('closes the menu after an action is clicked', async () => {
    renderComponent();
    await userEvent.click(screen.getByLabelText('actions'));
    await userEvent.click(screen.getByText('Download'));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('calls triggerDownloadFromUrl with the signed URL and filename on Download', async () => {
    renderComponent();
    await userEvent.click(screen.getByLabelText('actions'));
    await userEvent.click(screen.getByText('Download'));

    await waitFor(() => {
      expect(mockedTriggerDownloadFromUrl).toHaveBeenCalledWith(
        'https://cdn.example.com/signed-url',
        'report.pdf',
      );
    });
  });
});
