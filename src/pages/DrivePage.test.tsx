import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DrivePage from './DrivePage';
import * as folderService from '../api/folderService';
import * as fileService from '../api/fileService';
import * as sharedService from '../api/sharedService';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { IFolder, IFile, IUser } from '../types';
import * as userService from '../api/userService';

jest.mock('../api/folderService');
jest.mock('../api/fileService');
jest.mock('../api/userService');
jest.mock('../api/sharedService');
jest.mock('../lib/cognitoClient', () => ({
  getIdToken: () => Promise.resolve('fake-token'),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('../components/MoveDialog', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  function MockMoveDialog(props: { open: any; onMove: (arg0: string) => any; onClose: any; }) {
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

const mockedGetRootFolders = folderService.getRootFolders as jest.MockedFunction<typeof folderService.getRootFolders>;
const mockedGetRootFiles = fileService.getRootFiles as jest.MockedFunction<typeof fileService.getRootFiles>;
const mockedGetMe = userService.getMe as jest.MockedFunction<typeof userService.getMe>;
const mockedMoveFile = fileService.moveFile as jest.MockedFunction<typeof fileService.moveFile>;
const mockedMoveFolder = folderService.moveFolder as jest.MockedFunction<typeof folderService.moveFolder>;
const mockedGetSharedWithMe = sharedService.getSharedWithMe as jest.MockedFunction<typeof sharedService.getSharedWithMe>;

const mockedNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockedNavigate,
}));

const currentUser: IUser = {
  id: 'u1',
  first_name: 'Test',
  last_name: 'User',
  username: 'testuser',
  created_at: '2026-01-01T00:00:00Z',
};

const folders: IFolder[] = [
  {
    id: 'f1',
    user_id: 'u1',
    parent_folder_id: null,
    name: 'Documents',
    is_deleted: false,
    deleted_at: null,
    created_at: '2026-01-10T00:00:00Z',
    updated_at: '2026-01-10T00:00:00Z',
  },
  {
    id: 'f2',
    user_id: 'u1',
    parent_folder_id: null,
    name: 'Photos',
    is_deleted: false,
    deleted_at: null,
    created_at: '2026-02-15T00:00:00Z',
    updated_at: '2026-02-15T00:00:00Z',
  },
];

const files: IFile[] = [
  {
    id: 'file1',
    user_id: 'u1',
    folder_id: null,
    name: 'report.pdf',
    s3_key: 'some-key',
    size_bytes: 1024,
    mime_type: 'application/pdf',
    is_deleted: false,
    deleted_at: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  },
];

function renderPage() {
  // Set up auth so currentUser is available
  localStorage.setItem('fm_api_key', 'test-key');
  mockedGetMe.mockResolvedValue(currentUser);

  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <NotificationProvider>
          <DrivePage />
        </NotificationProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  jest.resetAllMocks();
  mockedGetRootFolders.mockResolvedValue(folders);
  mockedGetRootFiles.mockResolvedValue([]);
  mockedMoveFile.mockResolvedValue(files[0]);
  mockedMoveFolder.mockResolvedValue(folders[0]);
  mockedGetSharedWithMe.mockResolvedValue({ folders: [], files: [] });
});

describe('DrivePage', () => {
  it('shows loading skeleton while fetching', () => {
    mockedGetRootFolders.mockReturnValue(new Promise(() => {})); // never resolves
    mockedGetRootFiles.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();

    // LoadingSkeleton renders MUI Skeleton elements
    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders folder list after loading', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });
    expect(screen.getByText('Photos')).toBeInTheDocument();
  });

  it('shows empty state when no folders', async () => {
    mockedGetRootFolders.mockResolvedValue([]);
    mockedGetRootFiles.mockResolvedValue([]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No folders yet')).toBeInTheDocument();
    });
    expect(screen.getByText('Create a folder to get started')).toBeInTheDocument();
  });

  it('renders breadcrumb with My Files', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('My Files')).toBeInTheDocument();
    });
  });

  it('navigates to /folder/:id on folder click', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Documents'));
    expect(mockedNavigate).toHaveBeenCalledWith('/folder/f1');
  });

  it('opens create folder dialog from SpeedDial', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'file actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'New folder' }));

    expect(screen.getByText('New Folder')).toBeInTheDocument();
  });

  it('opens MoveDialog when clicking Move to... on a folder', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByLabelText('actions');
    await userEvent.click(actionButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Move to...')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('Move to...'));

    expect(screen.getByTestId('move-dialog')).toBeInTheDocument();
  });

  it('opens MoveDialog when clicking Move to... on a file', async () => {
    mockedGetRootFiles.mockResolvedValue(files);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('report.pdf')).toBeInTheDocument();
    });

    // File action buttons come after folder action buttons
    const actionButtons = screen.getAllByLabelText('actions');
    await userEvent.click(actionButtons[actionButtons.length - 1]);
    await waitFor(() => {
      expect(screen.getByText('Move to...')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('Move to...'));

    expect(screen.getByTestId('move-dialog')).toBeInTheDocument();
  });

  it('calls moveFolder with correct args and refreshes on confirm', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByLabelText('actions');
    await userEvent.click(actionButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Move to...')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('Move to...'));
    await userEvent.click(screen.getByText('Confirm Move'));

    const folderCallsBefore = mockedGetRootFolders.mock.calls.length;
    await waitFor(() => {
      expect(mockedMoveFolder).toHaveBeenCalledWith('f1', 'target-folder-id');
    });
    // fetchData is called again after move
    await waitFor(() => {
      expect(mockedGetRootFolders.mock.calls.length).toBeGreaterThan(folderCallsBefore);
    });
  });

  it('calls moveFile with correct args and refreshes on confirm', async () => {
    mockedGetRootFiles.mockResolvedValue(files);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('report.pdf')).toBeInTheDocument();
    });

    const fileCallsBefore = mockedGetRootFiles.mock.calls.length;
    const actionButtons = screen.getAllByLabelText('actions');
    await userEvent.click(actionButtons[actionButtons.length - 1]);
    await waitFor(() => {
      expect(screen.getByText('Move to...')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('Move to...'));
    await userEvent.click(screen.getByText('Confirm Move'));

    await waitFor(() => {
      expect(mockedMoveFile).toHaveBeenCalledWith('file1', 'target-folder-id');
    });
    await waitFor(() => {
      expect(mockedGetRootFiles.mock.calls.length).toBeGreaterThan(fileCallsBefore);
    });
  });

  it('shows error notification on failed move', async () => {
    mockedMoveFolder.mockRejectedValueOnce(new Error('fail'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByLabelText('actions');
    await userEvent.click(actionButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Move to...')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('Move to...'));
    await userEvent.click(screen.getByText('Confirm Move'));

    await waitFor(() => {
      expect(screen.getByText('Failed to move')).toBeInTheDocument();
    });
  });

  it('calls moveFile when a file is dropped on a folder', async () => {
    mockedMoveFile.mockResolvedValue(files[0]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Documents')).toBeInTheDocument());

    const folderItem = screen.getByText('Documents').closest('li')!;
    const dragData = JSON.stringify({ id: 'file-xyz', type: 'file' });
    fireEvent.drop(folderItem, {
      dataTransfer: { getData: () => dragData },
    });

    await waitFor(() => {
      expect(mockedMoveFile).toHaveBeenCalledWith('file-xyz', 'f1');
    });
    // fetchData is called again after move
    await waitFor(() => {
      expect(mockedGetRootFolders.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('calls moveFolder when a folder is dropped on another folder', async () => {
    mockedMoveFolder.mockResolvedValue(folders[0]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Documents')).toBeInTheDocument());

    const folderItem = screen.getByText('Documents').closest('li')!;
    const dragData = JSON.stringify({ id: 'folder-abc', type: 'folder' });
    fireEvent.drop(folderItem, {
      dataTransfer: { getData: () => dragData },
    });

    await waitFor(() => {
      expect(mockedMoveFolder).toHaveBeenCalledWith('folder-abc', 'f1');
    });
  });

  it('shows error notification when drag-and-drop move fails', async () => {
    mockedMoveFile.mockRejectedValueOnce(new Error('network error'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Documents')).toBeInTheDocument());

    const folderItem = screen.getByText('Documents').closest('li')!;
    const dragData = JSON.stringify({ id: 'file-xyz', type: 'file' });
    fireEvent.drop(folderItem, {
      dataTransfer: { getData: () => dragData },
    });

    await waitFor(() => {
      expect(screen.getByText('Failed to move')).toBeInTheDocument();
    });
  });

  it('opens upload dialog from SpeedDial', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'file actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Upload file' }));

    await waitFor(() => {
      expect(screen.getByText('Upload File')).toBeInTheDocument();
    });
  });
});
