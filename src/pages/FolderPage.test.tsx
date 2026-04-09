import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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

const mockedGetFolder = folderService.getFolder as jest.MockedFunction<typeof folderService.getFolder>;
const mockedGetMe = userService.getMe as jest.MockedFunction<typeof userService.getMe>;

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

  it('opens upload dialog from FAB', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText('add'));
    await userEvent.click(screen.getByText('Upload file'));

    expect(screen.getByText('Upload File')).toBeInTheDocument();
  });

  it('opens create folder dialog from FAB', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText('add'));
    await userEvent.click(screen.getByText('Create folder'));

    expect(screen.getByText('New Folder')).toBeInTheDocument();
  });
});
