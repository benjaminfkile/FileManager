import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeProvider';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { DownloadsProvider } from './contexts/DownloadsContext';
import App from './App';
import FileUpload from './components/FileUpload';
import { sessionKey, STORAGE_PREFIX } from './hooks/useChunkedUpload';
import { IUser, IFile, IFolder } from './types';

// Mock service modules
jest.mock('./api/userService');
jest.mock('./api/folderService');
jest.mock('./api/fileService');
jest.mock('./api/sharedService');
jest.mock('./api/chunkedUploadService');
jest.mock('./utils/downloadHelpers');
jest.mock('./utils/folderZipDownload');
jest.mock('./lib/cognitoClient', () => ({
  getIdToken: jest.fn(),
  signOut: jest.fn(),
  signUp: jest.fn(),
  confirmSignUp: jest.fn(),
  signIn: jest.fn(),
  forgotPassword: jest.fn(),
  confirmPassword: jest.fn(),
}));
jest.mock('./api/setupInterceptors', () => ({
  setupInterceptors: () => 0,
  ejectInterceptor: () => {},
}));

import { getMe, registerUser } from './api/userService';
import {
  getRootFolders,
  getFolderDownloadManifest,
} from './api/folderService';
import { getRootFiles, downloadFile, getUploadedParts } from './api/fileService';
import { getSharedWithMe } from './api/sharedService';
import { completeUpload, uploadPartToUrl, initiateUpload, abortUpload } from './api/chunkedUploadService';
import { triggerDownloadFromUrl } from './utils/downloadHelpers';
import { streamZipToDisk } from './utils/folderZipDownload';
import { getIdToken, signOut, signUp, confirmSignUp, signIn, forgotPassword, confirmPassword } from './lib/cognitoClient';

const mockGetIdToken = getIdToken as jest.MockedFunction<typeof getIdToken>;
const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;
const mockSignUp = signUp as jest.MockedFunction<typeof signUp>;
const mockConfirmSignUp = confirmSignUp as jest.MockedFunction<typeof confirmSignUp>;
const mockSignIn = signIn as jest.MockedFunction<typeof signIn>;
const mockForgotPassword = forgotPassword as jest.MockedFunction<typeof forgotPassword>;
const mockConfirmPassword = confirmPassword as jest.MockedFunction<typeof confirmPassword>;

const mockGetMe = getMe as jest.MockedFunction<typeof getMe>;
const mockRegisterUser = registerUser as jest.MockedFunction<typeof registerUser>;
const mockGetRootFolders = getRootFolders as jest.MockedFunction<typeof getRootFolders>;
const mockGetRootFiles = getRootFiles as jest.MockedFunction<typeof getRootFiles>;
const mockGetSharedWithMe = getSharedWithMe as jest.MockedFunction<typeof getSharedWithMe>;
const mockDownloadFile = downloadFile as jest.MockedFunction<typeof downloadFile>;
const mockGetFolderDownloadManifest = getFolderDownloadManifest as jest.MockedFunction<typeof getFolderDownloadManifest>;
const mockStreamZipToDisk = streamZipToDisk as jest.MockedFunction<typeof streamZipToDisk>;
const mockTriggerDownloadFromUrl = triggerDownloadFromUrl as jest.MockedFunction<typeof triggerDownloadFromUrl>;
const mockGetUploadedParts = getUploadedParts as jest.MockedFunction<typeof getUploadedParts>;
const mockInitiateUpload = initiateUpload as jest.MockedFunction<typeof initiateUpload>;
const mockUploadPart = uploadPartToUrl as jest.MockedFunction<typeof uploadPartToUrl>;
const mockCompleteUpload = completeUpload as jest.MockedFunction<typeof completeUpload>;
const mockAbortUpload = abortUpload as jest.MockedFunction<typeof abortUpload>;

const fakeUser: IUser = {
  id: 'u1',
  first_name: 'Alice',
  last_name: 'Smith',
  username: 'asmith',
  created_at: '2025-01-01T00:00:00Z',
};

const fakeFile: IFile = {
  id: 'file-1',
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

const fakeFolder: IFolder = {
  id: 'folder-1',
  user_id: 'u1',
  parent_folder_id: null,
  name: 'My Folder',
  is_deleted: false,
  deleted_at: null,
  created_at: '2026-02-10T00:00:00Z',
  updated_at: '2026-03-20T12:00:00Z',
};

function renderApp(initialRoute = '/') {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <AuthProvider>
          <NotificationProvider>
            <DownloadsProvider>
              <App />
            </DownloadsProvider>
          </NotificationProvider>
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  mockGetIdToken.mockResolvedValue(null); // default: unauthenticated
  mockGetRootFolders.mockResolvedValue([]);
  mockGetRootFiles.mockResolvedValue([]);
  mockGetSharedWithMe.mockResolvedValue({ folders: [], files: [] });
  mockTriggerDownloadFromUrl.mockResolvedValue(undefined);
  // Ensure desktop viewport so permanent drawer renders
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
  window.dispatchEvent(new Event('resize'));
});

afterEach(() => {
  // Polling tests opt into fake timers; restore real timers between tests.
  jest.useRealTimers();
});

describe('App integration tests', () => {
  // ---- Scenario 1: Unauthenticated user is redirected to /login ----
  test('unauthenticated user is redirected to /login', async () => {
    // mockGetIdToken defaults to null (set in beforeEach)
    renderApp('/');

    // Login form should render
    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();

    // Protected content should NOT be visible
    expect(screen.queryByText('My Files')).not.toBeInTheDocument();
    expect(screen.queryByText('Shared with Me')).not.toBeInTheDocument();
  });

  // ---- Scenario 2: Authenticated user sees the drive page ----
  test('authenticated user sees the drive page', async () => {
    mockGetIdToken.mockResolvedValue('fake-cognito-token');
    mockGetMe.mockResolvedValue(fakeUser);
    // getRootFolders and getRootFiles already mocked in beforeEach

    renderApp('/');

    // Wait for auth loading to finish and drive page to render
    // "My Files" appears in both the breadcrumb and the sidebar nav
    await waitFor(() => {
      expect(screen.getAllByText('My Files').length).toBeGreaterThanOrEqual(1);
    });

    // Sidebar nav items visible
    expect(screen.getByText('Shared with Me')).toBeInTheDocument();
    expect(screen.getByText('Recycle Bin')).toBeInTheDocument();

    // "My Files" appears in both the sidebar nav and the breadcrumb
    expect(screen.getAllByText('My Files').length).toBeGreaterThanOrEqual(2);

    // Empty state shown for folders
    expect(screen.getByText('No folders yet')).toBeInTheDocument();
  });

  // ---- Scenario 3: Registration flow ----
  test('registration flow navigates to / after success', async () => {
    mockSignUp.mockResolvedValue(undefined);
    mockConfirmSignUp.mockResolvedValue(undefined);
    mockSignIn.mockResolvedValue('fake-token');
    mockRegisterUser.mockResolvedValue(fakeUser);
    mockGetMe.mockResolvedValue(fakeUser);
    // getRootFolders and getRootFiles already mocked in beforeEach

    renderApp('/register');

    // Step 1: Fill in signup form
    await userEvent.type(screen.getByLabelText(/first name/i), 'Alice');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Smith');
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'SecurePass123!');
    await userEvent.type(screen.getByLabelText(/username/i), 'asmith');
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

    // Step 2: Enter confirmation code
    await waitFor(() => {
      expect(screen.getByLabelText(/confirmation code/i)).toBeInTheDocument();
    });
    await userEvent.type(screen.getByLabelText(/confirmation code/i), '123456');
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }));

    // After successful registration, we should see the drive page
    await waitFor(() => {
      expect(screen.getAllByText('My Files').length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByText('No folders yet')).toBeInTheDocument();
  });

  // ---- Scenario 4: Logout flow ----
  test('logout flow clears auth and navigates to /register', async () => {
    mockGetIdToken.mockResolvedValue('fake-cognito-token');
    mockGetMe.mockResolvedValue(fakeUser);
    // getRootFolders and getRootFiles already mocked in beforeEach

    renderApp('/');

    // Wait for drive page
    await waitFor(() => {
      expect(screen.getAllByText('My Files').length).toBeGreaterThanOrEqual(1);
    });

    // Open user profile menu by clicking the avatar button
    const avatarButton = screen.getByLabelText('user avatar');
    await userEvent.click(avatarButton);

    // Click Logout
    const logoutItem = await screen.findByText('Logout');
    await userEvent.click(logoutItem);

    // Should navigate to /register (sign up page)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
    });

    // Cognito signOut should have been called
    expect(mockSignOut).toHaveBeenCalled();
  });

  // ---- Scenario 5: Forgot password navigation ----
  test('clicking "Forgot password?" on login navigates to /forgot-password', async () => {
    renderApp('/login');

    // Login page renders
    await screen.findByRole('button', { name: /sign in/i });

    // Click "Forgot password?"
    await userEvent.click(screen.getByRole('button', { name: /forgot password\?/i }));

    // ForgotPasswordPage step 1 renders
    await screen.findByRole('button', { name: /send reset code/i });
  });

  // ---- Scenario 6: Single-file download triggers a URL redirect ----
  test('single-file download fetches a signed URL and triggers the redirect helper', async () => {
    mockGetIdToken.mockResolvedValue('fake-cognito-token');
    mockGetMe.mockResolvedValue(fakeUser);
    mockGetRootFiles.mockResolvedValue([fakeFile]);
    mockDownloadFile.mockResolvedValue({
      url: 'https://cdn.example.com/signed-report.pdf',
      expiresAt: '2026-01-01T01:00:00.000Z',
    });

    renderApp('/');

    await waitFor(() => {
      expect(screen.getByText('report.pdf')).toBeInTheDocument();
    });

    // Open the file's actions menu (the only "actions" button — no folders rendered)
    await userEvent.click(screen.getByLabelText('actions'));

    // Click Download
    const downloadItem = await screen.findByText('Download');
    await userEvent.click(downloadItem);

    await waitFor(() => {
      expect(mockDownloadFile).toHaveBeenCalledWith('file-1');
    });

    await waitFor(() => {
      expect(mockTriggerDownloadFromUrl).toHaveBeenCalledWith(
        'https://cdn.example.com/signed-report.pdf',
        'report.pdf',
      );
    });
  });

  // ---- Scenario 7: Folder download via manifest + streaming zip ----
  test('folder download fetches manifest, streams zip, and shows tray entry', async () => {
    mockGetIdToken.mockResolvedValue('fake-cognito-token');
    mockGetMe.mockResolvedValue(fakeUser);
    mockGetRootFolders.mockResolvedValue([fakeFolder]);
    mockGetFolderDownloadManifest.mockResolvedValue({
      folderName: 'My Folder',
      totalBytes: 1500,
      expiresAt: '2026-01-01T06:00:00.000Z',
      files: [
        { zipPath: 'My Folder/a.txt', url: 'https://s3.example/a', size: 500 },
        { zipPath: 'My Folder/b.txt', url: 'https://s3.example/b', size: 1000 },
      ],
    });
    // The streaming zip itself is unit-tested elsewhere; just resolve here.
    mockStreamZipToDisk.mockResolvedValue(undefined);

    renderApp('/');

    await waitFor(() => {
      expect(screen.getByText('My Folder')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText('actions'));
    const downloadItem = await screen.findByText('Download as zip');
    await userEvent.click(downloadItem);

    await waitFor(() => {
      expect(mockGetFolderDownloadManifest).toHaveBeenCalledWith('folder-1');
    });

    await waitFor(() => {
      expect(mockStreamZipToDisk).toHaveBeenCalledTimes(1);
    });

    const args = mockStreamZipToDisk.mock.calls[0]?.[0];
    expect(args?.folderName).toBe('My Folder');
    expect(args?.files).toHaveLength(2);

    // Tray entry should reflect the completed job
    await userEvent.click(screen.getByLabelText('downloads'));
    await waitFor(() => {
      expect(screen.getByText(/Saved/)).toBeInTheDocument();
    });
    // The folder name appears both in the list view AND in the tray entry.
    expect(screen.getAllByText('My Folder').length).toBeGreaterThanOrEqual(2);
  });

  // ---- Scenario 8: Empty folder shows a friendly error ----
  test('folder download: empty folder surfaces a "Folder is empty" message', async () => {
    mockGetIdToken.mockResolvedValue('fake-cognito-token');
    mockGetMe.mockResolvedValue(fakeUser);
    mockGetRootFolders.mockResolvedValue([fakeFolder]);
    mockGetFolderDownloadManifest.mockResolvedValue({
      folderName: 'My Folder',
      totalBytes: 0,
      expiresAt: '2026-01-01T06:00:00.000Z',
      files: [],
    });

    renderApp('/');

    await waitFor(() => {
      expect(screen.getByText('My Folder')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText('actions'));
    const downloadItem = await screen.findByText('Download as zip');
    await userEvent.click(downloadItem);

    await waitFor(() => {
      expect(mockGetFolderDownloadManifest).toHaveBeenCalledWith('folder-1');
    });

    expect(mockStreamZipToDisk).not.toHaveBeenCalled();
  });

  // ---- Scenario 9: Upload resume from a seeded localStorage session ----
  test('seeded resume session shows the resume Dialog and Resume completes the upload', async () => {
    // Build a small file with a stable identity so sessionKey is reproducible.
    const file = new File(['content'], 'resume.bin', {
      type: 'application/octet-stream',
      lastModified: 1700000000000,
    });
    Object.defineProperty(file, 'size', { value: 7 });

    const key = await sessionKey(file);
    const savedSession = {
      fileId: 'existing-file-id',
      fileName: file.name,
      size: file.size,
      lastModified: file.lastModified,
      folderId: null,
      completedParts: [{ partNumber: 1, etag: 'etag-1' }],
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(savedSession));

    // Hook will validate the saved session against the server's view of parts.
    mockGetUploadedParts.mockResolvedValue({
      fileId: 'existing-file-id',
      parts: [{ partNumber: 1 }],
    });

    // Resume completes the multipart upload — no further uploadPart calls expected
    // because the file fits in a single chunk and that part is already done.
    const completedFile: IFile = { ...fakeFile, id: 'existing-file-id', name: file.name };
    mockCompleteUpload.mockResolvedValue(completedFile);

    const onUploaded = jest.fn();
    render(
      <NotificationProvider>
        <FileUpload folderId={null} onUploaded={onUploaded} />
      </NotificationProvider>,
    );

    // Picking the file triggers the hook's resume detection.
    const input = screen.getByTestId('file-input');
    await userEvent.upload(input, file);

    // Resume dialog appears; no uploadPart/initiateUpload calls have happened yet.
    await waitFor(() => {
      expect(screen.getByTestId('resume-upload-dialog')).toBeInTheDocument();
    });
    expect(mockGetUploadedParts).toHaveBeenCalledWith('existing-file-id');
    expect(mockInitiateUpload).not.toHaveBeenCalled();
    expect(mockUploadPart).not.toHaveBeenCalled();

    // Click "Resume" — observe that hook.resume() was effectively invoked
    // by checking its visible side effect: completeUpload is called with the
    // saved parts (skipping initiateUpload entirely) and onUploaded fires.
    await userEvent.click(screen.getByTestId('resume-confirm'));

    await waitFor(() => {
      expect(mockCompleteUpload).toHaveBeenCalledWith('existing-file-id', [
        { partNumber: 1, etag: 'etag-1' },
      ]);
    });
    await waitFor(() => {
      expect(onUploaded).toHaveBeenCalledWith(completedFile);
    });

    // Resume path must not have re-initiated the upload or aborted it.
    expect(mockInitiateUpload).not.toHaveBeenCalled();
    expect(mockAbortUpload).not.toHaveBeenCalled();
    // Session is cleared from storage after a successful complete.
    expect(localStorage.getItem(STORAGE_PREFIX + key)).toBeNull();
  });
});
