import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import * as userService from '../api/userService';
import * as cognitoClient from '../lib/cognitoClient';
import { IUser } from '../types';

const fakeUser: IUser = {
  id: 'u1',
  first_name: 'Alice',
  last_name: 'Smith',
  username: 'asmith',
  created_at: '2025-01-01T00:00:00.000Z',
};

jest.mock('../api/userService');
jest.mock('../lib/cognitoClient');

const mockedGetMe = userService.getMe as jest.MockedFunction<typeof userService.getMe>;
const mockedGetIdToken = cognitoClient.getIdToken as jest.MockedFunction<typeof cognitoClient.getIdToken>;
const mockedSignIn = cognitoClient.signIn as jest.MockedFunction<typeof cognitoClient.signIn>;
const mockedSignOut = cognitoClient.signOut as jest.MockedFunction<typeof cognitoClient.signOut>;

function TestConsumer() {
  const { currentUser, isLoading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="user">{currentUser ? currentUser.username : 'null'}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <button onClick={() => login('alice@example.com', 'password123')}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

beforeEach(() => {
  mockedGetMe.mockReset();
  mockedGetIdToken.mockReset();
  mockedSignIn.mockReset();
  mockedSignOut.mockReset();
});

test('renders children', () => {
  mockedGetIdToken.mockResolvedValue(null);
  render(
    <AuthProvider>
      <p>hello</p>
    </AuthProvider>,
  );
  expect(screen.getByText('hello')).toBeInTheDocument();
});

test('on mount with existing Cognito session, calls getMe and sets currentUser', async () => {
  mockedGetIdToken.mockResolvedValue('jwt-token');
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
  expect(mockedGetIdToken).toHaveBeenCalledTimes(1);
  expect(mockedGetMe).toHaveBeenCalledTimes(1);
});

test('on mount with existing session, clears user on getMe failure', async () => {
  mockedGetIdToken.mockResolvedValue('jwt-token');
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
  expect(mockedSignOut).toHaveBeenCalled();
});

test('on mount without a Cognito session, does not call getMe', async () => {
  mockedGetIdToken.mockResolvedValue(null);

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );

  await waitFor(() => {
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  expect(mockedGetMe).not.toHaveBeenCalled();
  expect(screen.getByTestId('user')).toHaveTextContent('null');
});

test('login calls signIn then fetches user', async () => {
  mockedGetIdToken.mockResolvedValue(null);
  mockedSignIn.mockResolvedValue('jwt-token');
  mockedGetMe.mockResolvedValue(fakeUser);

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );

  await waitFor(() => {
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  await act(async () => {
    screen.getByText('login').click();
  });

  expect(mockedSignIn).toHaveBeenCalledWith('alice@example.com', 'password123');
  expect(screen.getByTestId('user')).toHaveTextContent('asmith');
  expect(mockedGetMe).toHaveBeenCalled();
});

test('logout calls signOut and clears currentUser', async () => {
  mockedGetIdToken.mockResolvedValue('jwt-token');
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

  expect(mockedSignOut).toHaveBeenCalled();
  expect(screen.getByTestId('user')).toHaveTextContent('null');
});
