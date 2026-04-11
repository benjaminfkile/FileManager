import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import FolderPage from './FolderPage';
import * as folderService from '../api/folderService';
import * as fileService from '../api/fileService';
import * as userService from '../api/userService';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { IFolder, IFile, IUser } from '../types';

jest.mock('../api/folderService');
jest.mock('../api/fileService');
jest.mock('../api/userService');
jest.mock('../lib/cognitoClient', () => ({
  getIdToken: () => Promise.resolve('fake-token'),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('../components/MoveDialog', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  function MockMoveDialog(props) {
    if (!props.open) return null;
    return React.createElement(
      'div',
      { 'data-testid': 'move-dialog' },
      React.createElement('button', { onClick: () => props.onMove('target-folder-id') }, 'Confirm Move'),
      React.createElement('button', { onClick: props.onClose }, 'Cancel'),
    );
  }
  return { __esModule: true, default: MockMoveDialog };
});

const mockedGetFolder = folderService.getFolder as jest.MockedFunction<typeof folderService.getFolder>;
const mockedGetMe = userService.getMe as jest.MockedFunction<typeof userService.getMe>;
const mockedMoveFile = fileService.moveFile as jest.MockedFunction<typeof fileService.moveFile>;
const mockedMoveFolder = folderService.moveFolder as jest.MockedFunction<typeof folderService.moveFolder>;

const mockedNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockedNavigate,
  useParams: () => ({ id: 'folder-1' }),
}));

const currentUser: IUser = {
  id: 'u1',
  first_name: 'Test',
  last_name: 'User',
  username: 'testuser',
  created_at: '2026-01-01T00:00:00Z',
};

const parentFolder: IFolder = {
  id: 'folder-1',
  user_id: 'u1',
  parent_folder_id: null,
  name: 'Documents',
  is_deleted: false,
  deleted_at: null,
  created_at: '2026-01-10T00:00:00Z',
  updated_at: '2026-01-10T00:00:00Z',
};

const subFolders: IFolder[] = [
  {
    id: 'sf1',
    user_id: 'u1',
    parent_folder_id: 'folder-1',
    name: 'Work',
    is_deleted: false,
    deleted_at: null,
    created_at: '2026-01-11T00:00:00Z',
    updated_at: '2026-01-11T00:00:00Z',
  },
];

const files: IFile[] = [
  {
    id: 'file1',
    user_id: 'u1',
    folder_id: 'folder-1',
    name: 'report.pdf',
    s3_key: 'abc/report.pdf',
    size_bytes: 1024,
    mime_type: 'application/pdf',
    is_deleted: false,
    deleted_at: null,
    created_at: '2026-01-12T00:00:00Z',
    updated_at: '2026-01-12T00:00:00Z',
  },
];

const folderResponse: folderService.GetFolderResponse = {
  folder: parentFolder,
  subFolders,
  files,
};

function renderPage() {
  localStorage.setItem('fm_api_key', 'test-key');
  mockedGetMe.mockResolvedValue(currentUser);

  return render(
    <MemoryRouter initialEntries={['/folder/folder-1']}>
      <AuthProvider>
        <NotificationProvider>
          <FolderPage />
        </NotificationProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  jest.resetAllMocks();
  mockedGetFolder.mockResolvedValue(folderResponse);
});

describe('FolderPage', () => {
  it('shows loading skeleton while fetching', () => {
    mockedGetFolder.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();

    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders sub-folders and files after loading', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('renders breadcrumb with correct path', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('My Files')).toBeInTheDocument();
    });
    expect(screen.getByText('Documents')).toBeInTheDocument();
  });

  it('shows error alert on 404', async () => {
    const error = new Error('Not found') as Error & { response: { status: number } };
    (error as unknown as { response: { status: number } }).response = { status: 404 };
    mockedGetFolder.mockRejectedValue(error);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Folder not found')).toBeInTheDocument();
    });
  });

  it('shows empty state when folder has no contents', async () => {
    mockedGetFolder.mockResolvedValue({
      folder: parentFolder,
      subFolders: [],
      files: [],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('This folder is empty')).toBeInTheDocument();
    });
  });

  it('navigates to sub-folder on click', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Work'));
    expect(mockedNavigate).toHaveBeenCalledWith('/folder/sf1');
  });

  it('shows owner actions for owned folders', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    // Open the folder's action menu
    const actionButtons = screen.getAllByLabelText('actions');
    await userEvent.click(actionButtons[0]);

    expect(screen.getByText('Rename')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it('hides owner actions for non-owned items', async () => {
    const nonOwnedFolder: IFolder = {
      ...subFolders[0],
      user_id: 'other-user',
    };
    const nonOwnedFile: IFile = {
      ...files[0],
      user_id: 'other-user',
    };
    mockedGetFolder.mockResolvedValue({
      folder: parentFolder,
      subFolders: [nonOwnedFolder],
      files: [nonOwnedFile],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    // Open the folder's action menu
    const actionButtons = screen.getAllByLabelText('actions');
    await userEvent.click(actionButtons[0]);

    expect(screen.queryByText('Rename')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    expect(screen.queryByText('Share')).not.toBeInTheDocument();
  });

  it('opens upload dialog from SpeedDial', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'file actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Upload file' }));

    expect(screen.getByText('Upload File')).toBeInTheDocument();
  });

  it('opens create folder dialog from SpeedDial', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'file actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'New folder' }));

    expect(screen.getByText('New Folder')).toBeInTheDocument();
  });

  it('opens MoveDialog when clicking Move to... on a subfolder', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByLabelText('actions');
    await userEvent.click(actionButtons[0]);
    await userEvent.click(screen.getByText('Move to...'));

    expect(screen.getByTestId('move-dialog')).toBeInTheDocument();
  });

  it('opens MoveDialog when clicking Move to... on a file', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('report.pdf')).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByLabelText('actions');
    await userEvent.click(actionButtons[1]);
    await userEvent.click(screen.getByText('Move to...'));

    expect(screen.getByTestId('move-dialog')).toBeInTheDocument();
  });

  it('calls moveFolder with correct args and refreshes on confirm', async () => {
    mockedMoveFolder.mockResolvedValue(subFolders[0]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByLabelText('actions');
    await userEvent.click(actionButtons[0]);
    await userEvent.click(screen.getByText('Move to...'));
    await userEvent.click(screen.getByText('Confirm Move'));

    await waitFor(() => {
      expect(mockedMoveFolder).toHaveBeenCalledWith('sf1', 'target-folder-id');
    });
    // getFolder is called during initial load (possibly multiple times for breadcrumbs) + refresh after move
    const callCount = mockedGetFolder.mock.calls.length;
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it('calls moveFile with correct args and refreshes on confirm', async () => {
    mockedMoveFile.mockResolvedValue(files[0]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('report.pdf')).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByLabelText('actions');
    await userEvent.click(actionButtons[1]);
    await userEvent.click(screen.getByText('Move to...'));
    await userEvent.click(screen.getByText('Confirm Move'));

    await waitFor(() => {
      expect(mockedMoveFile).toHaveBeenCalledWith('file1', 'target-folder-id');
    });
    const callCount = mockedGetFolder.mock.calls.length;
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it('shows error notification on failed move', async () => {
    mockedMoveFolder.mockRejectedValue(new Error('Move failed'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByLabelText('actions');
    await userEvent.click(actionButtons[0]);
    await userEvent.click(screen.getByText('Move to...'));
    await userEvent.click(screen.getByText('Confirm Move'));

    await waitFor(() => {
      expect(screen.getByText('Failed to move')).toBeInTheDocument();
    });
  });

  it('calls moveFile when a file is dropped on a subfolder', async () => {
    mockedMoveFile.mockResolvedValue(files[0]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Work')).toBeInTheDocument());

    const folderItem = screen.getByText('Work').closest('li')!;
    const dragData = JSON.stringify({ id: 'file-xyz', type: 'file' });
    fireEvent.drop(folderItem, {
      dataTransfer: { getData: () => dragData },
    });

    await waitFor(() => {
      expect(mockedMoveFile).toHaveBeenCalledWith('file-xyz', subFolders[0].id);
    });
    await waitFor(() => {
      expect(mockedGetFolder.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('calls moveFolder when a folder is dropped on a subfolder', async () => {
    mockedMoveFolder.mockResolvedValue(subFolders[0]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Work')).toBeInTheDocument());

    const folderItem = screen.getByText('Work').closest('li')!;
    const dragData = JSON.stringify({ id: 'folder-abc', type: 'folder' });
    fireEvent.drop(folderItem, {
      dataTransfer: { getData: () => dragData },
    });

    await waitFor(() => {
      expect(mockedMoveFolder).toHaveBeenCalledWith('folder-abc', subFolders[0].id);
    });
    await waitFor(() => {
      expect(mockedGetFolder.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows error notification when a drop move fails', async () => {
    mockedMoveFile.mockRejectedValueOnce(new Error('Move failed'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Work')).toBeInTheDocument());

    const folderItem = screen.getByText('Work').closest('li')!;
    const dragData = JSON.stringify({ id: 'file-xyz', type: 'file' });
    fireEvent.drop(folderItem, {
      dataTransfer: { getData: () => dragData },
    });

    await waitFor(() => {
      expect(screen.getByText('Failed to move')).toBeInTheDocument();
    });
  });
});
