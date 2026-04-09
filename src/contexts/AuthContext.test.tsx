import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import * as userService from '../api/userService';
import { IUser } from '../types';

const fakeUser: IUser = {
  id: 'u1',
  first_name: 'Alice',
  last_name: 'Smith',
  username: 'asmith',
  created_at: '2025-01-01T00:00:00.000Z',
};

jest.mock('../api/userService');
const mockedGetMe = userService.getMe as jest.MockedFunction<typeof userService.getMe>;

function TestConsumer() {
  const { apiKey, currentUser, isLoading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="apiKey">{apiKey ?? 'null'}</span>
      <span data-testid="user">{currentUser ? currentUser.username : 'null'}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <button onClick={() => login('test-key')}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  mockedGetMe.mockReset();
});

test('renders children', () => {
  render(
    <AuthProvider>
      <p>hello</p>
    </AuthProvider>,
  );
  expect(screen.getByText('hello')).toBeInTheDocument();
});

test('on mount with a stored key, calls getMe and sets currentUser', async () => {
  localStorage.setItem('fm_api_key', 'stored-key');
  mockedGetMe.mockResolvedValue(fakeUser);

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );

  expect(screen.getByTestId('loading')).toHaveTextContent('true');

  await waitFor(() => {
    expect(screen.getByTestId('user')).toHaveTextContent('asmith');
  });

  expect(screen.getByTestId('loading')).toHaveTextContent('false');
  expect(screen.getByTestId('apiKey')).toHaveTextContent('stored-key');
  expect(mockedGetMe).toHaveBeenCalledTimes(1);
});

test('on mount with a stored key, clears key on 401', async () => {
  localStorage.setItem('fm_api_key', 'bad-key');
  mockedGetMe.mockRejectedValue({ response: { status: 401 } });

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );

  await waitFor(() => {
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  expect(screen.getByTestId('user')).toHaveTextContent('null');
  expect(screen.getByTestId('apiKey')).toHaveTextContent('null');
  expect(localStorage.getItem('fm_api_key')).toBeNull();
});

test('on mount without a stored key, does not call getMe', () => {
  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );

  expect(mockedGetMe).not.toHaveBeenCalled();
  expect(screen.getByTestId('loading')).toHaveTextContent('false');
  expect(screen.getByTestId('user')).toHaveTextContent('null');
});

test('login saves key and fetches user', async () => {
  mockedGetMe.mockResolvedValue(fakeUser);

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );

  await act(async () => {
    screen.getByText('login').click();
  });

  expect(localStorage.getItem('fm_api_key')).toBe('test-key');
  expect(screen.getByTestId('apiKey')).toHaveTextContent('test-key');
  expect(screen.getByTestId('user')).toHaveTextContent('asmith');
  expect(mockedGetMe).toHaveBeenCalledTimes(1);
});

test('logout clears localStorage and nulls currentUser', async () => {
  localStorage.setItem('fm_api_key', 'stored-key');
  mockedGetMe.mockResolvedValue(fakeUser);

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );

  await waitFor(() => {
    expect(screen.getByTestId('user')).toHaveTextContent('asmith');
  });

  act(() => {
    screen.getByText('logout').click();
  });

  expect(localStorage.getItem('fm_api_key')).toBeNull();
  expect(screen.getByTestId('user')).toHaveTextContent('null');
  expect(screen.getByTestId('apiKey')).toHaveTextContent('null');
});
