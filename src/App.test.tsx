import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

jest.mock('./components/InterceptorSetup', () => () => null);
jest.mock('./components/DownloadsTray', () => ({ __esModule: true, default: () => null }));
jest.mock('./pages/DrivePage', () => () => <div>DrivePage</div>);
jest.mock('./pages/FolderPage', () => () => <div>FolderPage</div>);
jest.mock('./pages/SharedPage', () => () => <div>SharedPage</div>);
jest.mock('./pages/RecycleBinPage', () => () => <div>RecycleBinPage</div>);

jest.mock('./contexts/AuthContext', () => ({
  useAuth: () => ({
    isLoading: false,
    currentUser: { id: '1', username: 'testuser', first_name: 'Test', last_name: 'User' },
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));

jest.mock('./theme/ThemeProvider', () => ({
  useThemeMode: () => ({ mode: 'light', toggleMode: jest.fn() }),
}));

test('renders DrivePage at root when authenticated', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>
  );
  expect(screen.getByText('DrivePage')).toBeInTheDocument();
});
