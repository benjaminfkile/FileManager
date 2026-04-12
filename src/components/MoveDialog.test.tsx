import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MoveDialog, { MoveDialogProps } from './MoveDialog';
import { getRootFolders, getFolder } from '../api/folderService';
import { IFolder } from '../types';
import { NotificationProvider } from '../contexts/NotificationContext';

jest.mock('../api/folderService');
const mockedGetRootFolders = getRootFolders as jest.MockedFunction<typeof getRootFolders>;
const mockedGetFolder = getFolder as jest.MockedFunction<typeof getFolder>;

const rootFolders: IFolder[] = [
  {
    id: 'folder-1',
    user_id: 'u1',
    parent_folder_id: null,
    name: 'Documents',
    is_deleted: false,
    deleted_at: null,
    created_at: '2026-04-08T00:00:00Z',
    updated_at: '2026-04-08T00:00:00Z',
  },
  {
    id: 'folder-2',
    user_id: 'u1',
    parent_folder_id: null,
    name: 'Photos',
    is_deleted: false,
    deleted_at: null,
    created_at: '2026-04-08T00:00:00Z',
    updated_at: '2026-04-08T00:00:00Z',
  },
];

const subFolders: IFolder[] = [
  {
    id: 'sub-1',
    user_id: 'u1',
    parent_folder_id: 'folder-1',
    name: 'Work',
    is_deleted: false,
    deleted_at: null,
    created_at: '2026-04-08T00:00:00Z',
    updated_at: '2026-04-08T00:00:00Z',
  },
];

function renderDialog(overrides: Partial<MoveDialogProps> = {}) {
  const props: MoveDialogProps = {
    open: true,
    itemId: 'file-1',
    itemType: 'file',
    itemName: 'report.pdf',
    currentFolderId: null,
    onClose: jest.fn(),
    onMove: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return {
    ...render(
      <NotificationProvider>
        <MoveDialog {...props} />
      </NotificationProvider>
    ),
    props,
  };
}

describe('MoveDialog', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedGetRootFolders.mockResolvedValue(rootFolders);
    mockedGetFolder.mockResolvedValue({
      folder: rootFolders[0],
      subFolders,
      files: [],
    });
  });

  it('does not render dialog content when open is false', () => {
    renderDialog({ open: false });
    expect(screen.queryByText('Move "report.pdf"')).not.toBeInTheDocument();
  });

  it('shows the dialog title when open is true', async () => {
    renderDialog();
    expect(screen.getByText('Move "report.pdf"')).toBeInTheDocument();
  });

  it('shows a loading indicator while fetching root folders', () => {
    mockedGetRootFolders.mockReturnValue(new Promise(() => {})); // never resolves
    renderDialog();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders root folder names after loading', async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });
    expect(screen.getByText('Photos')).toBeInTheDocument();
  });

  it('clicking a folder calls getFolder and shows subfolders', async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Documents'));

    await waitFor(() => {
      expect(mockedGetFolder).toHaveBeenCalledWith('folder-1');
    });
    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });
  });

  it('disables "Move here" when browsing the item\'s current folder', async () => {
    renderDialog({ currentFolderId: null });
    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Move here' })).toBeDisabled();
  });

  it('enables "Move here" when browsing a different location', async () => {
    renderDialog({ currentFolderId: 'some-other-folder' });
    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Move here' })).toBeEnabled();
  });

  it('clicking "Move here" calls onMove with current browsing folder ID', async () => {
    const { props } = renderDialog({ currentFolderId: 'some-other-folder' });
    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    // At root level, currentBrowsingFolderId is null
    await userEvent.click(screen.getByRole('button', { name: 'Move here' }));

    await waitFor(() => {
      expect(props.onMove).toHaveBeenCalledWith(null);
    });
  });

  it('clicking "Cancel" calls onClose', async () => {
    const { props } = renderDialog();
    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onClose).toHaveBeenCalled();
  });

  it('shows an error alert when getRootFolders rejects', async () => {
    mockedGetRootFolders.mockRejectedValue(new Error('Network error'));
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText('Failed to load folders')).toBeInTheDocument();
    });
  });

  it('shows ownership error and keeps dialog open when move returns 403', async () => {
    const error403 = { response: { status: 403 } };
    const { props } = renderDialog({
      currentFolderId: 'some-other-folder',
      onMove: jest.fn().mockRejectedValue(error403),
    });
    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Move here' }));

    await waitFor(() => {
      expect(screen.getByText('You cannot move items into a folder you do not own.')).toBeInTheDocument();
    });
    // Dialog should remain open
    expect(screen.getByText('Move "report.pdf"')).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('shows generic error message for non-403 move failures', async () => {
    const error500 = { response: { status: 500 } };
    renderDialog({
      currentFolderId: 'some-other-folder',
      onMove: jest.fn().mockRejectedValue(error500),
    });
    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Move here' }));

    await waitFor(() => {
      expect(screen.getByText('Move failed. Please try again.')).toBeInTheDocument();
    });
  });

  it('clears move error when navigating to a different folder', async () => {
    const error403 = { response: { status: 403 } };
    renderDialog({
      currentFolderId: 'some-other-folder',
      onMove: jest.fn().mockRejectedValue(error403),
    });
    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Move here' }));
    await waitFor(() => {
      expect(screen.getByText('You cannot move items into a folder you do not own.')).toBeInTheDocument();
    });

    // Navigate into a folder — error should clear
    await userEvent.click(screen.getByText('Documents'));
    await waitFor(() => {
      expect(screen.queryByText('You cannot move items into a folder you do not own.')).not.toBeInTheDocument();
    });
  });
});
