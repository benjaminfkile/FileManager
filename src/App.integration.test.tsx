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
jest.mock('./lib/cognitoClient');
jest.mock('./api/setupInterceptors', () => ({
  setupInterceptors: () => 0,
  ejectInterceptor: () => {},
}));

import { getMe, registerUser } from './api/userService';
import { getRootFolders } from './api/folderService';
import { getIdToken, signOut } from './lib/cognitoClient';

const mockGetIdToken = getIdToken as jest.MockedFunction<typeof getIdToken>;
const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;

const mockGetMe = getMe as jest.MockedFunction<typeof getMe>;
const mockRegisterUser = registerUser as jest.MockedFunction<typeof registerUser>;
const mockGetRootFolders = getRootFolders as jest.MockedFunction<typeof getRootFolders>;

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
  // Ensure desktop viewport so permanent drawer renders
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
  window.dispatchEvent(new Event('resize'));
});

describe('App integration tests', () => {
  // ---- Scenario 1: Unauthenticated user is redirected to /register ----
  test('unauthenticated user is redirected to /register', async () => {
    renderApp('/');

    // Registration form should render
    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();

    // Protected content should NOT be visible
    expect(screen.queryByText('My Files')).not.toBeInTheDocument();
    expect(screen.queryByText('Shared with Me')).not.toBeInTheDocument();
  });

  // ---- Scenario 2: Authenticated user sees the drive page ----
  test('authenticated user sees the drive page', async () => {
    mockGetIdToken.mockResolvedValue('fake-cognito-token');

    mockGetMe.mockResolvedValue(fakeUser);
    mockGetRootFolders.mockResolvedValue([]);

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
    mockRegisterUser.mockResolvedValue(fakeUser);
    mockGetMe.mockResolvedValue(fakeUser);
    mockGetRootFolders.mockResolvedValue([]);

    renderApp('/register');

    // Fill in form fields
    await userEvent.type(screen.getByLabelText(/first name/i), 'Alice');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Smith');
    await userEvent.type(screen.getByLabelText(/username/i), 'asmith');
    await userEvent.type(screen.getByLabelText('API Key'), 'supersecret1234');

    // Submit
    await userEvent.click(screen.getByRole('button', { name: /register/i }));

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
    mockGetRootFolders.mockResolvedValue([]);

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

    // Should navigate to register page
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
    });

    // Cognito signOut should have been called
    expect(mockSignOut).toHaveBeenCalled();
  });
});
