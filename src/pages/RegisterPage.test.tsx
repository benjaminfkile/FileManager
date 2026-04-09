import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from './RegisterPage';
import * as userService from '../api/userService';
import { AuthProvider } from '../contexts/AuthContext';
import { IUser } from '../types';

jest.mock('../api/userService');
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
  localStorage.clear();
  mockedRegisterUser.mockReset();
  mockedGetMe.mockReset();
  mockedNavigate.mockReset();
});

test('renders all form fields and heading', () => {
  renderPage();

  expect(screen.getByText('File Manager')).toBeInTheDocument();
  expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
  expect(screen.getByLabelText('API Key')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
});

test('shows validation errors when submitting empty form', async () => {
  renderPage();

  await userEvent.click(screen.getByRole('button', { name: /register/i }));

  expect(screen.getByText('First name is required')).toBeInTheDocument();
  expect(screen.getByText('Last name is required')).toBeInTheDocument();
  expect(screen.getByText('Username is required')).toBeInTheDocument();
  expect(screen.getByText('API key is required')).toBeInTheDocument();
  expect(mockedRegisterUser).not.toHaveBeenCalled();
});

test('shows username validation error for invalid characters', async () => {
  renderPage();

  await userEvent.type(screen.getByLabelText(/first name/i), 'Jane');
  await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
  await userEvent.type(screen.getByLabelText(/username/i), 'bad username!');
  await userEvent.type(screen.getByLabelText('API Key'), 'abcdefghijkl');
  await userEvent.click(screen.getByRole('button', { name: /register/i }));

  expect(screen.getByText('Username can only contain letters, numbers, and underscores')).toBeInTheDocument();
  expect(mockedRegisterUser).not.toHaveBeenCalled();
});

test('shows API key length validation error', async () => {
  renderPage();

  await userEvent.type(screen.getByLabelText(/first name/i), 'Jane');
  await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
  await userEvent.type(screen.getByLabelText(/username/i), 'janedoe');
  await userEvent.type(screen.getByLabelText('API Key'), 'short');
  await userEvent.click(screen.getByRole('button', { name: /register/i }));

  expect(screen.getByText('API key must be at least 12 characters')).toBeInTheDocument();
  expect(mockedRegisterUser).not.toHaveBeenCalled();
});

test('successful registration navigates to /', async () => {
  mockedRegisterUser.mockResolvedValue(fakeUser);
  mockedGetMe.mockResolvedValue(fakeUser);

  renderPage();

  await userEvent.type(screen.getByLabelText(/first name/i), 'Jane');
  await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
  await userEvent.type(screen.getByLabelText(/username/i), 'janedoe');
  await userEvent.type(screen.getByLabelText('API Key'), 'supersecretkey');
  await userEvent.click(screen.getByRole('button', { name: /register/i }));

  await waitFor(() => {
    expect(mockedNavigate).toHaveBeenCalledWith('/');
  });

  expect(mockedRegisterUser).toHaveBeenCalledWith({
    first_name: 'Jane',
    last_name: 'Doe',
    username: 'janedoe',
    api_key: 'supersecretkey',
  });
  expect(localStorage.getItem('fm_api_key')).toBe('supersecretkey');
});

test('displays API error message inline', async () => {
  mockedRegisterUser.mockRejectedValue({
    response: { data: { errorMsg: 'Username already taken' } },
  });

  renderPage();

  await userEvent.type(screen.getByLabelText(/first name/i), 'Jane');
  await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
  await userEvent.type(screen.getByLabelText(/username/i), 'janedoe');
  await userEvent.type(screen.getByLabelText('API Key'), 'supersecretkey');
  await userEvent.click(screen.getByRole('button', { name: /register/i }));

  await waitFor(() => {
    expect(screen.getByText('Username already taken')).toBeInTheDocument();
  });

  expect(mockedNavigate).not.toHaveBeenCalled();
});

test('API key field has show/hide toggle', async () => {
  renderPage();

  const apiKeyInput = screen.getByLabelText('API Key');
  expect(apiKeyInput).toHaveAttribute('type', 'password');

  await userEvent.click(screen.getByLabelText(/toggle api key visibility/i));
  expect(apiKeyInput).toHaveAttribute('type', 'text');

  await userEvent.click(screen.getByLabelText(/toggle api key visibility/i));
  expect(apiKeyInput).toHaveAttribute('type', 'password');
});
