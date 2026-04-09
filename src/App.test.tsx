import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

jest.mock('./contexts/AuthContext', () => ({
  useAuth: () => ({
    isLoading: false,
    currentUser: { id: '1', username: 'testuser', firstName: 'Test', lastName: 'User' },
    apiKey: 'test-key',
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));

test('renders DrivePage at root when authenticated', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>
  );
  expect(screen.getByText('DrivePage')).toBeInTheDocument();
});
