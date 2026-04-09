import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserProfileMenu from './UserProfileMenu';

const mockLogout = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { id: '1', first_name: 'John', last_name: 'Doe', username: 'jdoe', created_at: '2024-01-01' },
    logout: mockLogout,
  }),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

beforeEach(() => {
  mockLogout.mockClear();
  mockNavigate.mockClear();
});

function renderMenu(anchorEl = document.createElement('button') as HTMLElement | null) {
  const onClose = jest.fn();
  return {
    onClose,
    ...render(
      <MemoryRouter>
        <UserProfileMenu anchorEl={anchorEl} onClose={onClose} />
      </MemoryRouter>,
    ),
  };
}

describe('UserProfileMenu', () => {
  it('renders user full name and username', () => {
    renderMenu();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jdoe')).toBeInTheDocument();
  });

  it('does not render when anchorEl is null', () => {
    renderMenu(null);
    expect(screen.queryByText('Logout')).not.toBeInTheDocument();
  });

  it('calls logout and navigates to /register on logout click', () => {
    const { onClose } = renderMenu();
    fireEvent.click(screen.getByText('Logout'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/register');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
