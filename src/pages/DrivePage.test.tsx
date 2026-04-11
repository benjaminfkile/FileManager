import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DrivePage from './DrivePage';
import * as folderService from '../api/folderService';
import * as fileService from '../api/fileService';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { IFolder, IFile, IUser } from '../types';
import * as userService from '../api/userService';

jest.mock('../api/folderService');
jest.mock('../api/fileService');
jest.mock('../api/userService');

const mockedGetRootFolders = folderService.getRootFolders as jest.MockedFunction<typeof folderService.getRootFolders>;
const mockedGetRootFiles = fileService.getRootFiles as jest.MockedFunction<typeof fileService.getRootFiles>;
const mockedGetMe = userService.getMe as jest.MockedFunction<typeof userService.getMe>;

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
