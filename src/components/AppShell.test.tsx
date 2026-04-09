import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AppShell from './AppShell';

const mockToggleMode = jest.fn();
const mockUseAuth = jest.fn();
const mockUseThemeMode = jest.fn();

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../theme/ThemeProvider', () => ({
  useThemeMode: () => mockUseThemeMode(),
}));

function renderAtRoute(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<div>DrivePage</div>} />
          <Route path="/shared" element={<div>SharedPage</div>} />
          <Route path="/recycle-bin" element={<div>RecycleBinPage</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function setDesktop(isDesktop: boolean) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: isDesktop ? query.includes('min-width') : false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    currentUser: { id: '1', first_name: 'John', last_name: 'Doe', username: 'jdoe' },
    logout: jest.fn(),
  });
  mockUseThemeMode.mockReturnValue({ mode: 'light', toggleMode: mockToggleMode });
  mockToggleMode.mockClear();
  setDesktop(true);
});

describe('AppShell', () => {
  it('renders all navigation links', () => {
    renderAtRoute('/');
    expect(screen.getByText('My Files')).toBeInTheDocument();
    expect(screen.getByText('Shared with Me')).toBeInTheDocument();
    expect(screen.getByText('Recycle Bin')).toBeInTheDocument();
  });

  it('renders app name', () => {
    renderAtRoute('/');
    expect(screen.getByText('FileManager')).toBeInTheDocument();
  });

  it('highlights the active nav item for /', () => {
    renderAtRoute('/');
    const myFilesButton = screen.getByText('My Files').closest('[role="button"]') as HTMLElement;
    expect(myFilesButton).toHaveClass('Mui-selected');
  });

  it('highlights the active nav item for /shared', () => {
    renderAtRoute('/shared');
    const sharedButton = screen.getByText('Shared with Me').closest('[role="button"]') as HTMLElement;
    expect(sharedButton).toHaveClass('Mui-selected');
  });

  it('highlights the active nav item for /recycle-bin', () => {
    renderAtRoute('/recycle-bin');
    const recycleBinButton = screen.getByText('Recycle Bin').closest('[role="button"]') as HTMLElement;
    expect(recycleBinButton).toHaveClass('Mui-selected');
  });

  it('shows user initials in avatar', () => {
    renderAtRoute('/');
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('calls toggleMode when dark-mode button is clicked', () => {
    renderAtRoute('/');
    fireEvent.click(screen.getByLabelText('toggle dark mode'));
    expect(mockToggleMode).toHaveBeenCalledTimes(1);
  });

  it('shows DarkMode icon when mode is light', () => {
    mockUseThemeMode.mockReturnValue({ mode: 'light', toggleMode: mockToggleMode });
    renderAtRoute('/');
    const button = screen.getByLabelText('toggle dark mode');
    expect(button.querySelector('[data-testid="DarkModeIcon"]')).toBeInTheDocument();
  });

  it('shows LightMode icon when mode is dark', () => {
    mockUseThemeMode.mockReturnValue({ mode: 'dark', toggleMode: mockToggleMode });
    renderAtRoute('/');
    const button = screen.getByLabelText('toggle dark mode');
    expect(button.querySelector('[data-testid="LightModeIcon"]')).toBeInTheDocument();
  });

  it('shows hamburger icon on small screen', () => {
    setDesktop(false);
    renderAtRoute('/');
    expect(screen.getByLabelText('open drawer')).toBeInTheDocument();
  });

  it('hides hamburger icon on desktop', () => {
    setDesktop(true);
    renderAtRoute('/');
    expect(screen.queryByLabelText('open drawer')).not.toBeInTheDocument();
  });

  it('renders child route content', () => {
    renderAtRoute('/');
    expect(screen.getByText('DrivePage')).toBeInTheDocument();
  });

  it('opens user profile menu on avatar click', () => {
    renderAtRoute('/');
    fireEvent.click(screen.getByLabelText('user avatar'));
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jdoe')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });
});
