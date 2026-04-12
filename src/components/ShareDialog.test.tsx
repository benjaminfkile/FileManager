import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShareDialog, { ShareDialogProps } from './ShareDialog';
import { shareFile, unshareFile, getFileShares } from '../api/fileService';
import { shareFolder, unshareFolder, getFolderShares } from '../api/folderService';
import { searchUsers } from '../api/userService';
import { ISharedUser, IUser } from '../types';

jest.mock('../api/fileService');
jest.mock('../api/folderService');
jest.mock('../api/userService');

const mockShowNotification = jest.fn();
jest.mock('../contexts/NotificationContext', () => ({
  useNotification: () => ({ showNotification: mockShowNotification }),
}));

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { id: 'owner-1' }, isLoading: false }),
}));

jest.mock('../api/shareLinkService', () => ({
  getShareLinks: jest.fn().mockResolvedValue([]),
  createShareLink: jest.fn(),
  deleteShareLink: jest.fn(),
}));

const mockGetFileShares = getFileShares as jest.MockedFunction<typeof getFileShares>;
const mockGetFolderShares = getFolderShares as jest.MockedFunction<typeof getFolderShares>;
const mockShareFile = shareFile as jest.MockedFunction<typeof shareFile>;
const mockShareFolder = shareFolder as jest.MockedFunction<typeof shareFolder>;
const mockUnshareFile = unshareFile as jest.MockedFunction<typeof unshareFile>;
const mockUnshareFolder = unshareFolder as jest.MockedFunction<typeof unshareFolder>;
const mockSearchUsers = searchUsers as jest.MockedFunction<typeof searchUsers>;

const sharedUsers: ISharedUser[] = [
  { id: 'su1', username: 'alice', first_name: 'Alice', last_name: 'Smith', sharedAt: '2026-04-01T00:00:00Z' },
  { id: 'su2', username: 'bob', first_name: 'Bob', last_name: 'Jones', sharedAt: '2026-04-02T00:00:00Z' },
];

const searchResultUsers: IUser[] = [
  { id: 'u3', username: 'charlie', first_name: 'Charlie', last_name: 'Brown', created_at: '2026-01-01T00:00:00Z' },
];

function renderDialog(overrides: Partial<ShareDialogProps> = {}) {
  const props: ShareDialogProps = {
    open: true,
    itemId: 'item-1',
    itemType: 'file',
    itemName: 'report.pdf',
    ownerId: 'owner-1',
    onClose: jest.fn(),
    ...overrides,
  };
  return { ...render(<ShareDialog {...props} />), props };
}

describe('ShareDialog', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    mockGetFileShares.mockResolvedValue({ sharedWith: sharedUsers });
    mockGetFolderShares.mockResolvedValue({ sharedWith: sharedUsers });
    mockSearchUsers.mockResolvedValue(searchResultUsers);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders current shares on open for a file', async () => {
    renderDialog();

    await waitFor(() => {
      expect(mockGetFileShares).toHaveBeenCalledWith('item-1');
    });

    expect(await screen.findByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
  });

  it('renders current shares on open for a folder', async () => {
    renderDialog({ itemType: 'folder' });

    await waitFor(() => {
      expect(mockGetFolderShares).toHaveBeenCalledWith('item-1');
    });

    expect(await screen.findByText('alice')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    renderDialog({ open: false });
    expect(screen.queryByText('Share')).not.toBeInTheDocument();
  });

  it('debounces search by 300ms', async () => {
    renderDialog();
    await waitFor(() => expect(mockGetFileShares).toHaveBeenCalled());

    const input = screen.getByLabelText('Search users');
    fireEvent.change(input, { target: { value: 'cha' } });

    // Search should not be called yet
    expect(mockSearchUsers).not.toHaveBeenCalled();

    // Advance past debounce
    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(mockSearchUsers).toHaveBeenCalledWith('cha');
    });

    expect(await screen.findByText('charlie')).toBeInTheDocument();
  });

  it('adds a share and refreshes the list for a file', async () => {
    const newSharedUser: ISharedUser = {
      id: 'su3', username: 'charlie', first_name: 'Charlie', last_name: 'Brown', sharedAt: '2026-04-08T00:00:00Z',
    };
    mockShareFile.mockResolvedValue({ sharedWith: newSharedUser });
    mockGetFileShares
      .mockResolvedValueOnce({ sharedWith: sharedUsers })
      .mockResolvedValueOnce({ sharedWith: [...sharedUsers, newSharedUser] });

    renderDialog();
    await waitFor(() => expect(mockGetFileShares).toHaveBeenCalled());

    const input = screen.getByLabelText('Search users');
    fireEvent.change(input, { target: { value: 'charlie' } });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => expect(mockSearchUsers).toHaveBeenCalled());
    const charlieResult = await screen.findByText('charlie');
    await userEvent.click(charlieResult);

    await waitFor(() => {
      expect(mockShareFile).toHaveBeenCalledWith('item-1', 'charlie');
    });

    await waitFor(() => {
      expect(mockGetFileShares).toHaveBeenCalledTimes(2);
    });

    expect(mockShowNotification).toHaveBeenCalledWith('Shared with charlie', 'success');
  });

  it('adds a share for a folder', async () => {
    const newSharedUser: ISharedUser = {
      id: 'su3', username: 'charlie', first_name: 'Charlie', last_name: 'Brown', sharedAt: '2026-04-08T00:00:00Z',
    };
    mockShareFolder.mockResolvedValue({ sharedWith: newSharedUser });
    mockGetFolderShares
      .mockResolvedValueOnce({ sharedWith: sharedUsers })
      .mockResolvedValueOnce({ sharedWith: [...sharedUsers, newSharedUser] });

    renderDialog({ itemType: 'folder' });
    await waitFor(() => expect(mockGetFolderShares).toHaveBeenCalled());

    const input = screen.getByLabelText('Search users');
    fireEvent.change(input, { target: { value: 'charlie' } });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => expect(mockSearchUsers).toHaveBeenCalled());
    const charlieResult = await screen.findByText('charlie');
    await userEvent.click(charlieResult);

    await waitFor(() => {
      expect(mockShareFolder).toHaveBeenCalledWith('item-1', 'charlie');
    });
  });

  it('removes a share and refreshes the list for a file', async () => {
    mockUnshareFile.mockResolvedValue(undefined);
    mockGetFileShares
      .mockResolvedValueOnce({ sharedWith: sharedUsers })
      .mockResolvedValueOnce({ sharedWith: [sharedUsers[1]] });

    renderDialog();
    await waitFor(() => expect(mockGetFileShares).toHaveBeenCalled());

    const removeBtn = await screen.findByRole('button', { name: 'remove alice' });
    await userEvent.click(removeBtn);

    await waitFor(() => {
      expect(mockUnshareFile).toHaveBeenCalledWith('item-1', 'su1');
    });

    await waitFor(() => {
      expect(mockGetFileShares).toHaveBeenCalledTimes(2);
    });

    expect(mockShowNotification).toHaveBeenCalledWith('Removed share with alice', 'success');
  });

  it('removes a share for a folder', async () => {
    mockUnshareFolder.mockResolvedValue(undefined);
    mockGetFolderShares
      .mockResolvedValueOnce({ sharedWith: sharedUsers })
      .mockResolvedValueOnce({ sharedWith: [sharedUsers[1]] });

    renderDialog({ itemType: 'folder' });
    await waitFor(() => expect(mockGetFolderShares).toHaveBeenCalled());

    const removeBtn = await screen.findByRole('button', { name: 'remove alice' });
    await userEvent.click(removeBtn);

    await waitFor(() => {
      expect(mockUnshareFolder).toHaveBeenCalledWith('item-1', 'su1');
    });
  });

  it('shows empty state when no shares exist', async () => {
    mockGetFileShares.mockResolvedValue({ sharedWith: [] });
    renderDialog();

    expect(await screen.findByText('Not shared with anyone')).toBeInTheDocument();
  });

  it('shows error toast when fetching shares fails', async () => {
    mockGetFileShares.mockRejectedValue(new Error('Network error'));
    renderDialog();

    await waitFor(() => {
      expect(mockShowNotification).toHaveBeenCalledWith('Failed to load shares', 'error');
    });
  });
});
