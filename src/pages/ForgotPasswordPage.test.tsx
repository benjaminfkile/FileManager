import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ForgotPasswordPage from './ForgotPasswordPage';
import * as cognitoClient from '../lib/cognitoClient';
import { NotificationProvider } from '../contexts/NotificationContext';

jest.mock('../lib/cognitoClient', () => ({
  forgotPassword: jest.fn(),
  confirmPassword: jest.fn(),
  getIdToken: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  signUp: jest.fn(),
  confirmSignUp: jest.fn(),
}));

const mockedForgotPassword = cognitoClient.forgotPassword as jest.MockedFunction<
  typeof cognitoClient.forgotPassword
>;
const mockedConfirmPassword = cognitoClient.confirmPassword as jest.MockedFunction<
  typeof cognitoClient.confirmPassword
>;

const mockedNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockedNavigate,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <NotificationProvider>
        <ForgotPasswordPage />
      </NotificationProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.resetAllMocks();
});

test('step 1 happy path advances to step 2', async () => {
  mockedForgotPassword.mockResolvedValue(undefined);
  renderPage();

  await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
  await userEvent.click(screen.getByRole('button', { name: /send reset code/i }));

  await waitFor(() => {
    expect(screen.getByLabelText(/reset code/i)).toBeInTheDocument();
  });
  expect(mockedForgotPassword).toHaveBeenCalledWith('user@example.com');
});

test('step 1 error renders in Alert', async () => {
  mockedForgotPassword.mockRejectedValue(new Error('User not found'));
  renderPage();

  await userEvent.type(screen.getByLabelText(/email/i), 'unknown@example.com');
  await userEvent.click(screen.getByRole('button', { name: /send reset code/i }));

  await waitFor(() => {
    expect(screen.getByText('User not found')).toBeInTheDocument();
  });
  expect(mockedNavigate).not.toHaveBeenCalled();
});

test('step 2 password mismatch blocks submission', async () => {
  mockedForgotPassword.mockResolvedValue(undefined);
  renderPage();

  await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
  await userEvent.click(screen.getByRole('button', { name: /send reset code/i }));

  await waitFor(() => {
    expect(screen.getByLabelText(/reset code/i)).toBeInTheDocument();
  });

  await userEvent.type(screen.getByLabelText(/reset code/i), '123456');
  await userEvent.type(screen.getByLabelText(/^new password$/i), 'NewPass123!');
  await userEvent.type(screen.getByLabelText(/^confirm password$/i), 'DifferentPass!');
  await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

  await waitFor(() => {
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
  });
  expect(mockedConfirmPassword).not.toHaveBeenCalled();
});

test('step 2 happy path navigates to /login', async () => {
  mockedForgotPassword.mockResolvedValue(undefined);
  mockedConfirmPassword.mockResolvedValue(undefined);
  renderPage();

  await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
  await userEvent.click(screen.getByRole('button', { name: /send reset code/i }));

  await waitFor(() => {
    expect(screen.getByLabelText(/reset code/i)).toBeInTheDocument();
  });

  await userEvent.type(screen.getByLabelText(/reset code/i), '123456');
  await userEvent.type(screen.getByLabelText(/^new password$/i), 'NewPass123!');
  await userEvent.type(screen.getByLabelText(/^confirm password$/i), 'NewPass123!');
  await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

  await waitFor(() => {
    expect(mockedNavigate).toHaveBeenCalledWith('/login');
  });
  expect(mockedConfirmPassword).toHaveBeenCalledWith('user@example.com', '123456', 'NewPass123!');
});

test('step 2 Cognito error renders in Alert', async () => {
  mockedForgotPassword.mockResolvedValue(undefined);
  mockedConfirmPassword.mockRejectedValue(new Error('Invalid verification code'));
  renderPage();

  await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
  await userEvent.click(screen.getByRole('button', { name: /send reset code/i }));

  await waitFor(() => {
    expect(screen.getByLabelText(/reset code/i)).toBeInTheDocument();
  });

  await userEvent.type(screen.getByLabelText(/reset code/i), 'wrong');
  await userEvent.type(screen.getByLabelText(/^new password$/i), 'NewPass123!');
  await userEvent.type(screen.getByLabelText(/^confirm password$/i), 'NewPass123!');
  await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

  await waitFor(() => {
    expect(screen.getByText('Invalid verification code')).toBeInTheDocument();
  });
  expect(mockedNavigate).not.toHaveBeenCalled();
});
