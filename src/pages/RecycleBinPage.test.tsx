import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RecycleBinPage from './RecycleBinPage';
import * as recycleBinService from '../api/recycleBinService';
import * as fileService from '../api/fileService';
import * as folderService from '../api/folderService';
import * as userService from '../api/userService';
import * as useFolderDownloadModule from '../hooks/useFolderDownload';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { IFolder, IFile, IUser } from '../types';

jest.mock('../api/recycleBinService');
jest.mock('../api/fileService');
jest.mock('../api/folderService');
jest.mock('../api/userService');
jest.mock('../hooks/useFolderDownload', () => ({
  useFolderDownload: jest.fn(),
}));

const mockedGetRecycleBin = recycleBinService.getRecycleBin as jest.MockedFunction<typeof recycleBinService.getRecycleBin>;
const mockedRestoreAll = recycleBinService.restoreAll as jest.MockedFunction<typeof recycleBinService.restoreAll>;
const mockedEmptyRecycleBin = recycleBinService.emptyRecycleBin as jest.MockedFunction<typeof recycleBinService.emptyRecycleBin>;
const mockedRestoreFolder = folderService.restoreFolder as jest.MockedFunction<typeof folderService.restoreFolder>;
const mockedRestoreFile = fileService.restoreFile as jest.MockedFunction<typeof fileService.restoreFile>;
const mockedPermanentDeleteFile = fileService.permanentDeleteFile as jest.MockedFunction<typeof fileService.permanentDeleteFile>;
const mockedPermanentDeleteFolder = folderService.permanentDeleteFolder as jest.MockedFunction<typeof folderService.permanentDeleteFolder>;
const mockedGetMe = userService.getMe as jest.MockedFunction<typeof userService.getMe>;

const mockStartFolderDownload = jest.fn();

const currentUser: IUser = {
  id: 'u1',
  first_name: 'Test',
  last_name: 'User',
  username: 'testuser',
  created_at: '2026-01-01T00:00:00Z',
};

const deletedFolders: IFolder[] = [
  {
    id: 'df1',
    user_id: 'u1',
    parent_folder_id: null,
    name: 'Old Docs',
    is_deleted: true,
    deleted_at: '2026-03-01T00:00:00Z',
    created_at: '2026-01-10T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  },
];

const deletedFiles: IFile[] = [
  {
    id: 'dfile1',
    user_id: 'u1',
    folder_id: null,
    name: 'old-report.pdf',
    s3_key: 'abc/old-report.pdf',
    size_bytes: 4096,
    mime_type: 'application/pdf',
    is_deleted: true,
    deleted_at: '2026-03-02T00:00:00Z',
    created_at: '2026-02-15T00:00:00Z',
    updated_at: '2026-03-02T00:00:00Z',
  },
];

function renderPage() {
  localStorage.setItem('fm_api_key', 'test-key');
  mockedGetMe.mockResolvedValue(currentUser);

  return render(
    <MemoryRouter initialEntries={['/recycle-bin']}>
      <AuthProvider>
        <NotificationProvider>
          <RecycleBinPage />
        </NotificationProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  jest.resetAllMocks();
  mockedGetRecycleBin.mockResolvedValue({
    folders: deletedFolders,
    files: deletedFiles,
  });
  mockedRestoreAll.mockResolvedValue({ restoredFolders: 1, restoredFiles: 1 });
  mockedEmptyRecycleBin.mockResolvedValue(undefined);
  mockedRestoreFolder.mockResolvedValue(deletedFolders[0]);
  mockedRestoreFile.mockResolvedValue(deletedFiles[0]);
  mockedPermanentDeleteFile.mockResolvedValue(undefined);
  mockedPermanentDeleteFolder.mockResolvedValue(undefined);
  (useFolderDownloadModule.useFolderDownload as jest.Mock).mockReturnValue({
    start: mockStartFolderDownload,
    jobs: [],
  });
});

describe('RecycleBinPage', () => {
  it('shows loading skeleton while fetching', () => {
    mockedGetRecycleBin.mockReturnValue(new Promise(() => {}));
    renderPage();

    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders deleted folders and files after loading', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Old Docs')).toBeInTheDocument();
    });
    expect(screen.getByText('old-report.pdf')).toBeInTheDocument();
  });

  it('renders section headings', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Deleted Folders')).toBeInTheDocument();
    });
    expect(screen.getByText('Deleted Files')).toBeInTheDocument();
  });

  it('shows empty state when recycle bin is empty', async () => {
    mockedGetRecycleBin.mockResolvedValue({ folders: [], files: [] });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Recycle Bin is empty')).toBeInTheDocument();
    });
  });

  it('shows Restore All and Empty Bin buttons', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Restore All')).toBeInTheDocument();
    });
    expect(screen.getByText('Empty Bin')).toBeInTheDocument();
  });

  it('calls restoreAll and re-fetches on Restore All click', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Restore All')).toBeInTheDocument();
    });

    // After restore all, the next fetch returns empty
    mockedGetRecycleBin.mockResolvedValue({ folders: [], files: [] });

    await userEvent.click(screen.getByText('Restore All'));

    await waitFor(() => {
      expect(mockedRestoreAll).toHaveBeenCalled();
    });
    // Re-fetched — now shows empty
    await waitFor(() => {
      expect(screen.getByText('Recycle Bin is empty')).toBeInTheDocument();
    });
  });

  it('opens confirmation dialog on Empty Bin click', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Empty Bin')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Empty Bin'));

    expect(screen.getByText('Empty Recycle Bin?')).toBeInTheDocument();
    expect(screen.getByText('This will permanently delete all items. This action cannot be undone.')).toBeInTheDocument();
  });

  it('calls emptyRecycleBin on dialog confirm', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Empty Bin')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Empty Bin'));

    // After empty, bin will be empty
    mockedGetRecycleBin.mockResolvedValueOnce({ folders: [], files: [] });

    // Click the confirm button in the dialog (labeled "Empty Bin")
    const dialogButtons = screen.getAllByText('Empty Bin');
    // The second "Empty Bin" is the dialog confirm button
    await userEvent.click(dialogButtons[dialogButtons.length - 1]);

    await waitFor(() => {
      expect(mockedEmptyRecycleBin).toHaveBeenCalled();
    });
  });

  it('restores a folder via the item action menu', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Old Docs')).toBeInTheDocument();
    });

    // Open folder action menu
    const actionButtons = screen.getAllByLabelText('actions');
    await userEvent.click(actionButtons[0]);

    mockedGetRecycleBin.mockResolvedValueOnce({ folders: [], files: deletedFiles });

    await userEvent.click(screen.getByText('Restore'));

    await waitFor(() => {
      expect(mockedRestoreFolder).toHaveBeenCalledWith('df1');
    });
  });

  it('shows 409 error message when restoring folder with deleted parent', async () => {
    const axiosError = {
      isAxiosError: true,
      response: {
        status: 409,
        data: { message: 'Parent folder is also in the recycle bin' },
      },
    };
    mockedRestoreFolder.mockRejectedValueOnce(axiosError);

    // Mock axios.isAxiosError to recognise our mock error
    const axios = jest.requireMock('axios') as { isAxiosError: jest.Mock };
    axios.isAxiosError = jest.fn((err: unknown) => (err as { isAxiosError?: boolean })?.isAxiosError === true);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Old Docs')).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByLabelText('actions');
    await userEvent.click(actionButtons[0]);

    await userEvent.click(screen.getByText('Restore'));

    await waitFor(() => {
      expect(screen.getByText('Parent folder is also in the recycle bin')).toBeInTheDocument();
    });
  });

  it('permanently deletes a file via the item action menu', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('old-report.pdf')).toBeInTheDocument();
    });

    // Open file action menu (second actions button)
    const actionButtons = screen.getAllByLabelText('actions');
    await userEvent.click(actionButtons[1]);

    await userEvent.click(screen.getByText('Delete permanently'));

    // Confirm in the dialog
    mockedGetRecycleBin.mockResolvedValueOnce({ folders: deletedFolders, files: [] });

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockedPermanentDeleteFile).toHaveBeenCalledWith('dfile1');
    });
  });

  it('calls startFolderDownload when Download as zip is clicked for a folder', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Old Docs')).toBeInTheDocument();
    });

    // Open folder action menu
    const actionButtons = screen.getAllByLabelText('actions');
    await userEvent.click(actionButtons[0]);

    await userEvent.click(screen.getByText('Download as zip'));

    expect(mockStartFolderDownload).toHaveBeenCalledWith('df1', 'Old Docs');
  });
});
