import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

const mockUseAuth = jest.fn();

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

function renderWithRouter(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/login" element={<div>LoginPage</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<div>HomePage</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('shows a spinner while auth is loading', () => {
    mockUseAuth.mockReturnValue({ isLoading: true, currentUser: null });
    renderWithRouter();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated', () => {
    mockUseAuth.mockReturnValue({ isLoading: false, currentUser: null });
    renderWithRouter();
    expect(screen.getByText('LoginPage')).toBeInTheDocument();
    expect(screen.queryByText('HomePage')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      currentUser: { id: '1', username: 'testuser', firstName: 'Test', lastName: 'User' },
    });
    renderWithRouter();
    expect(screen.getByText('HomePage')).toBeInTheDocument();
  });
});
