import React from 'react';
import { render } from '@testing-library/react';

const mockLogout = jest.fn();
const mockNavigate = jest.fn();
const mockSetup = jest.fn().mockReturnValue(42);
const mockEject = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ logout: mockLogout }),
}));

jest.mock('../api/setupInterceptors', () => ({
  setupInterceptors: (...args: unknown[]) => mockSetup(...args),
  ejectInterceptor: (...args: unknown[]) => mockEject(...args),
}));

import InterceptorSetup from './InterceptorSetup';

beforeEach(() => {
  mockSetup.mockReturnValue(42);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('InterceptorSetup', () => {
  it('registers the interceptor on mount and ejects on unmount', () => {
    const { unmount } = render(<InterceptorSetup />);

    expect(mockSetup).toHaveBeenCalledWith(mockLogout, mockNavigate);

    unmount();

    expect(mockEject).toHaveBeenCalledWith(42);
  });

  it('renders nothing', () => {
    const { container } = render(<InterceptorSetup />);
    expect(container.innerHTML).toBe('');
  });
});
