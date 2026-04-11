import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from './RegisterPage';
import * as userService from '../api/userService';
import * as cognitoClient from '../lib/cognitoClient';
import { AuthProvider } from '../contexts/AuthContext';
import { IUser } from '../types';

jest.mock('../api/userService');
jest.mock('../lib/cognitoClient');

const mockedSignUp = cognitoClient.signUp as jest.MockedFunction<typeof cognitoClient.signUp>;
const mockedConfirmSignUp = cognitoClient.confirmSignUp as jest.MockedFunction<typeof cognitoClient.confirmSignUp>;
const mockedSignIn = cognitoClient.signIn as jest.MockedFunction<typeof cognitoClient.signIn>;
const mockedGetIdToken = cognitoClient.getIdToken as jest.MockedFunction<typeof cognitoClient.getIdToken>;

const mockedRegisterUser = userService.registerUser as jest.MockedFunction<typeof userService.registerUser>;
const mockedGetMe = userService.getMe as jest.MockedFunction<typeof userService.getMe>;

const fakeUser: IUser = {
  id: 'u1',
  first_name: 'Jane',
  last_name: 'Doe',
  username: 'janedoe',
  created_at: '2025-01-01T00:00:00.000Z',
};

const mockedNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockedNavigate,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <AuthProvider>
        <RegisterPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  mockedGetIdToken.mockResolvedValue(null); // AuthContext init: not authenticated
});

test('renders all form fields and heading', () => {
  renderPage();

  expect(screen.getByText('File Manager')).toBeInTheDocument();
  expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
});

test('shows validation errors when submitting empty form', async () => {
  renderPage();

  await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

  expect(screen.getByText('First name is required')).toBeInTheDocument();
  expect(screen.getByText('Last name is required')).toBeInTheDocument();
  expect(screen.getByText('Email is required')).toBeInTheDocument();
  expect(screen.getByText('Password is required')).toBeInTheDocument();
  expect(screen.getByText('Username is required')).toBeInTheDocument();
  expect(mockedSignUp).not.toHaveBeenCalled();
});

test('shows username validation error for invalid characters', async () => {
  renderPage();

  await userEvent.type(screen.getByLabelText(/first name/i), 'Jane');
  await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
  await userEvent.type(screen.getByLabelText(/email/i), 'jane@example.com');
  await userEvent.type(screen.getByLabelText(/^password$/i), 'Password123!');
  await userEvent.type(screen.getByLabelText(/username/i), 'bad username!');
  await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

  expect(screen.getByText('Username can only contain letters, numbers, and underscores')).toBeInTheDocument();
  expect(mockedSignUp).not.toHaveBeenCalled();
});

test('successful sign-up moves to confirmation step', async () => {
  mockedSignUp.mockResolvedValue(undefined);
  renderPage();

  await userEvent.type(screen.getByLabelText(/first name/i), 'Jane');
  await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
  await userEvent.type(screen.getByLabelText(/email/i), 'jane@example.com');
  await userEvent.type(screen.getByLabelText(/^password$/i), 'Password123!');
  await userEvent.type(screen.getByLabelText(/username/i), 'janedoe');
  await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

  await waitFor(() => {
    expect(screen.getByLabelText(/confirmation code/i)).toBeInTheDocument();
  });
  expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  expect(mockedSignUp).toHaveBeenCalledWith('jane@example.com', 'Password123!', {
    given_name: 'Jane',
    family_name: 'Doe',
  });
});

test('successful confirmation navigates to /', async () => {
  mockedSignUp.mockResolvedValue(undefined);
  mockedConfirmSignUp.mockResolvedValue(undefined);
  mockedSignIn.mockResolvedValue('fake-token');
  mockedRegisterUser.mockResolvedValue(fakeUser);
  mockedGetMe.mockResolvedValue(fakeUser);

  renderPage();

  // Step 1: sign up form
  await userEvent.type(screen.getByLabelText(/first name/i), 'Jane');
  await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
  await userEvent.type(screen.getByLabelText(/email/i), 'jane@example.com');
  await userEvent.type(screen.getByLabelText(/^password$/i), 'Password123!');
  await userEvent.type(screen.getByLabelText(/username/i), 'janedoe');
  await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

  // Step 2: confirmation code
  await waitFor(() => {
    expect(screen.getByLabelText(/confirmation code/i)).toBeInTheDocument();
  });
  await userEvent.type(screen.getByLabelText(/confirmation code/i), '123456');
  await userEvent.click(screen.getByRole('button', { name: /confirm/i }));

  await waitFor(() => {
    expect(mockedNavigate).toHaveBeenCalledWith('/');
  });
  expect(mockedRegisterUser).toHaveBeenCalledWith({
    first_name: 'Jane',
    last_name: 'Doe',
    username: 'janedoe',
  });
  expect(mockedConfirmSignUp).toHaveBeenCalledWith('jane@example.com', '123456');
});

test('displays sign-up API error message inline', async () => {
  mockedSignUp.mockRejectedValue(new Error('Email already in use'));

  renderPage();

  await userEvent.type(screen.getByLabelText(/first name/i), 'Jane');
  await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
  await userEvent.type(screen.getByLabelText(/email/i), 'jane@example.com');
  await userEvent.type(screen.getByLabelText(/^password$/i), 'Password123!');
  await userEvent.type(screen.getByLabelText(/username/i), 'janedoe');
  await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

  await waitFor(() => {
    expect(screen.getByText('Email already in use')).toBeInTheDocument();
  });
  expect(mockedNavigate).not.toHaveBeenCalled();
});

test('displays confirmation API error message inline', async () => {
  mockedSignUp.mockResolvedValue(undefined);
  mockedConfirmSignUp.mockRejectedValue(new Error('Invalid confirmation code'));

  renderPage();

  // Step 1
  await userEvent.type(screen.getByLabelText(/first name/i), 'Jane');
  await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
  await userEvent.type(screen.getByLabelText(/email/i), 'jane@example.com');
  await userEvent.type(screen.getByLabelText(/^password$/i), 'Password123!');
  await userEvent.type(screen.getByLabelText(/username/i), 'janedoe');
  await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

  // Step 2
  await waitFor(() => {
    expect(screen.getByLabelText(/confirmation code/i)).toBeInTheDocument();
  });
  await userEvent.type(screen.getByLabelText(/confirmation code/i), 'wrong');
  await userEvent.click(screen.getByRole('button', { name: /confirm/i }));

  await waitFor(() => {
    expect(screen.getByText('Invalid confirmation code')).toBeInTheDocument();
  });
  expect(mockedNavigate).not.toHaveBeenCalled();
});

test('password field has show/hide toggle', async () => {
  renderPage();

  const passwordInput = screen.getByLabelText(/^password$/i);
  expect(passwordInput).toHaveAttribute('type', 'password');

  await userEvent.click(screen.getByLabelText(/toggle password visibility/i));
  expect(passwordInput).toHaveAttribute('type', 'text');

  await userEvent.click(screen.getByLabelText(/toggle password visibility/i));
  expect(passwordInput).toHaveAttribute('type', 'password');
});
