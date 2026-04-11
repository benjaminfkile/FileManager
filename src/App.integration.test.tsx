import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeProvider';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import App from './App';
import { IUser } from './types';

// Mock service modules
jest.mock('./api/userService');
jest.mock('./api/folderService');
jest.mock('./api/fileService');
jest.mock('./lib/cognitoClient');
jest.mock('./api/setupInterceptors', () => ({
  setupInterceptors: () => 0,
  ejectInterceptor: () => {},
}));

import { getMe, registerUser } from './api/userService';
import { getRootFolders } from './api/folderService';
import { getRootFiles } from './api/fileService';
import { getIdToken, signOut, signUp, confirmSignUp, signIn } from './lib/cognitoClient';

const mockGetIdToken = getIdToken as jest.MockedFunction<typeof getIdToken>;
const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;
const mockSignUp = signUp as jest.MockedFunction<typeof signUp>;
const mockConfirmSignUp = confirmSignUp as jest.MockedFunction<typeof confirmSignUp>;
const mockSignIn = signIn as jest.MockedFunction<typeof signIn>;

const mockGetMe = getMe as jest.MockedFunction<typeof getMe>;
const mockRegisterUser = registerUser as jest.MockedFunction<typeof registerUser>;
const mockGetRootFolders = getRootFolders as jest.MockedFunction<typeof getRootFolders>;
const mockGetRootFiles = getRootFiles as jest.MockedFunction<typeof getRootFiles>;

const fakeUser: IUser = {
  id: 'u1',
  first_name: 'Alice',
  last_name: 'Smith',
  username: 'asmith',
  created_at: '2025-01-01T00:00:00Z',
};

function renderApp(initialRoute = '/') {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <AuthProvider>
          <NotificationProvider>
            <App />
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
  // Ensure desktop viewport so permanent drawer renders
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
  window.dispatchEvent(new Event('resize'));
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

    // "My Files" breadcrumb is visible (breadcrumb renders inside a <nav>)
    const breadcrumbNav = screen.getByRole('navigation');
    expect(within(breadcrumbNav).getByText('My Files')).toBeInTheDocument();

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
});
