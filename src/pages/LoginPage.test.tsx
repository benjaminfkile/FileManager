import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';

const mockLogin = jest.fn();
const mockedNavigate = jest.fn();

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, currentUser: null, logout: jest.fn() }),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockedNavigate,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.resetAllMocks();
});

test('"Forgot password?" link is present', () => {
  renderPage();
  expect(screen.getByRole('button', { name: /forgot password\?/i })).toBeInTheDocument();
});

test('"Forgot password?" link navigates to /forgot-password', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /forgot password\?/i }));
  expect(mockedNavigate).toHaveBeenCalledWith('/forgot-password');
});
