import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SharedPage from './SharedPage';
import * as sharedService from '../api/sharedService';
import * as folderService from '../api/folderService';
import * as fileService from '../api/fileService';
import * as userService from '../api/userService';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { IFolder, IFile, IUser, ISharedFolder, ISharedFile } from '../types';

jest.mock('../api/sharedService');
jest.mock('../api/folderService');
jest.mock('../api/fileService');
jest.mock('../api/userService');

const mockedGetSharedWithMe = sharedService.getSharedWithMe as jest.MockedFunction<typeof sharedService.getSharedWithMe>;
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

const sharedFolders: ISharedFolder[] = [
  {
    id: 'sf1',
    user_id: 'other-user',
    parent_folder_id: null,
    name: 'Shared Docs',
    is_deleted: false,
    deleted_at: null,
    created_at: '2026-01-10T00:00:00Z',
    updated_at: '2026-01-10T00:00:00Z',
    shared_by: { username: 'alice', first_name: 'Alice', last_name: 'Smith' },
  },
];

const sharedFiles: ISharedFile[] = [
  {
    id: 'sfile1',
    user_id: 'other-user',
    folder_id: null,
    name: 'shared-report.pdf',
    s3_key: 'abc/shared-report.pdf',
    size_bytes: 2048,
    mime_type: 'application/pdf',
    is_deleted: false,
    deleted_at: null,
    created_at: '2026-02-15T00:00:00Z',
    updated_at: '2026-02-15T00:00:00Z',
    shared_by: { username: 'alice', first_name: 'Alice', last_name: 'Smith' },
  },
];

function renderPage() {
  localStorage.setItem('fm_api_key', 'test-key');
  mockedGetMe.mockResolvedValue(currentUser);

  return render(
    <MemoryRouter initialEntries={['/shared']}>
      <AuthProvider>
        <NotificationProvider>
          <SharedPage />
        </NotificationProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  jest.resetAllMocks();
  mockedGetSharedWithMe.mockResolvedValue({
    folders: sharedFolders,
    files: sharedFiles,
  });
});

describe('SharedPage', () => {
  it('shows loading skeleton while fetching', () => {
    mockedGetSharedWithMe.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();

    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders shared folders and files after loading', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Shared Docs')).toBeInTheDocument();
    });
    expect(screen.getByText('shared-report.pdf')).toBeInTheDocument();
  });

  it('renders section headings', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Shared Folders')).toBeInTheDocument();
    });
    expect(screen.getByText('Shared Files')).toBeInTheDocument();
  });

  it('shows empty state when nothing shared', async () => {
    mockedGetSharedWithMe.mockResolvedValue({ folders: [], files: [] });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nothing shared with you yet')).toBeInTheDocument();
    });
  });

  it('renders breadcrumb with Shared with Me', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Shared with Me')).toBeInTheDocument();
    });
  });

  it('navigates to /folder/:id on folder click', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Shared Docs')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Shared Docs'));
    expect(mockedNavigate).toHaveBeenCalledWith('/folder/sf1');
  });

  it('hides owner actions (rename, delete, share) for shared items', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Shared Docs')).toBeInTheDocument();
    });

    // Open the folder's action menu
    const actionButtons = screen.getAllByLabelText('actions');
    await userEvent.click(actionButtons[0]);

    expect(screen.queryByText('Rename')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    expect(screen.queryByText('Share')).not.toBeInTheDocument();
  });

  it('shows download action for shared folders', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Shared Docs')).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByLabelText('actions');
    await userEvent.click(actionButtons[0]);

    expect(screen.getByText('Download as zip')).toBeInTheDocument();
  });

  it('shows download action for shared files', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('shared-report.pdf')).toBeInTheDocument();
    });

    // Open the file's action menu (second action button)
    const actionButtons = screen.getAllByLabelText('actions');
    await userEvent.click(actionButtons[1]);

    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  it('only renders folder section when there are shared folders', async () => {
    mockedGetSharedWithMe.mockResolvedValue({ folders: [], files: sharedFiles });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('shared-report.pdf')).toBeInTheDocument();
    });

    expect(screen.queryByText('Shared Folders')).not.toBeInTheDocument();
    expect(screen.getByText('Shared Files')).toBeInTheDocument();
  });

  it('only renders file section when there are shared files', async () => {
    mockedGetSharedWithMe.mockResolvedValue({ folders: sharedFolders, files: [] });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Shared Docs')).toBeInTheDocument();
    });

    expect(screen.getByText('Shared Folders')).toBeInTheDocument();
    expect(screen.queryByText('Shared Files')).not.toBeInTheDocument();
  });
});
